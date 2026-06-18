/* =========================================================
   MIDNIGHT DEVS — Lua 3D via Three.js
   Modelo NASA LRO moon.glb + logo MD como filho da lua
   ========================================================= */

(() => {
  'use strict';

  if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
    console.warn('[moon-3d] Three.js ou GLTFLoader não carregou.');
    return;
  }

  const canvas   = document.getElementById('moon-canvas');
  const moonEl   = document.getElementById('moon-scene');
  if (!canvas || !moonEl) return;

  /* =========================================================
     SETUP THREE.JS
     ========================================================= */
  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.outputEncoding = THREE.sRGBEncoding;

  /* =========================================================
     ILUMINAÇÃO
     ========================================================= */
  const sun = new THREE.DirectionalLight(0xfff4d6, 2.4);
  sun.position.set(-3, 1.5, 4);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);

  const rim = new THREE.DirectionalLight(0x00f5d4, 0.4);
  rim.position.set(2, 0, -4);
  scene.add(rim);

  /* =========================================================
     CARREGA MODELO NASA MOON
     ========================================================= */
  const loader = new THREE.GLTFLoader();
  let moonMesh = null;
  let logoMesh = null; // filho da lua, vai mostrar a logo

  loader.load(
    'assets/3d/moon.glb',
    (gltf) => {
      moonMesh = gltf.scene;

      // Centraliza e normaliza tamanho
      const box = new THREE.Box3().setFromObject(moonMesh);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      moonMesh.position.sub(center);
      const scale = 2.0 / size;
      moonMesh.scale.setScalar(scale);

      scene.add(moonMesh);

      // CRÍTICO: DecalGeometry lê mesh.matrixWorld internamente.
      // Sem este update, ele gera vértices no lugar errado (matriz identidade).
      moonMesh.updateMatrixWorld(true);

      // Cria o filho logo (decal projetado na topografia real da lua)
      // try/catch: se o decal falhar, a lua ainda carrega e gira normal.
      try {
        buildLogoMesh();
      } catch (e) {
        console.error('[moon-3d] falhou ao criar decal:', e);
      }

      window.dispatchEvent(new CustomEvent('moon-ready'));
      startRotation();
    },
    (xhr) => {
      // onProgress — emite durante o download. Não é erro.
      // console.log('[moon-3d] carregando:', xhr.loaded, '/', xhr.total);
    },
    (err) => {
      // onError — erro REAL de carregamento
      console.error('[moon-3d] erro ao carregar .glb:', err);
      window.dispatchEvent(new CustomEvent('moon-ready'));
    }
  );

  /* =========================================================
     LOGO + ANEL PRETO COLADOS NA SUPERFÍCIE DA LUA (DECALS)
     - Dois decals filhos do moonMesh, então giram junto com a lua
     - Quando passam pra trás da lua, o depthTest os oculta naturalmente
     - Cada decal usa uma textura + tamanho próprios
     ========================================================= */

  // Constante da lua (raio em unidades mundiais, medido anteriormente).
  const MOON_RADIUS = 0.58;

  /* Cria a textura da LOGO COM BORDA PRETA: logo branca centralizada,
     com disco preto sólido ao redor (mesmo efeito do CircleGeometry antigo).
     O céu da logo original fica transparente → a moldura preta aparece. */
  function makeLogoTexture() {
    const SIZE = 1024;
    const BG_THRESHOLD = 25;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // Limpa tudo (transparente)
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Disco preto sólido ocupando quase todo o canvas.
    // É esse disco que vai aparecer como "sombra/borda" ao redor da logo.
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const discRadius = SIZE * 0.46; // disco preto grande
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, discRadius, 0, Math.PI * 2);
    ctx.fill();

    // Logo original (com céu preto) — pintamos de branco onde tem logo
    // e mantemos o céu da logo como TRANSPARENTE (deixa o preto do disco passar).
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Primeiro, desenhamos a logo inteira no canvas (por cima do disco preto)
      ctx.drawImage(img, 0, 0, SIZE, SIZE);

      // Agora varremos pixel a pixel:
      //   - onde era o CÉU da logo (preto puro na imagem original), transparente
      //   - onde era a LOGO (qualquer cor não-preta), branco opaco
      const id = ctx.getImageData(0, 0, SIZE, SIZE);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const luma = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (luma < BG_THRESHOLD) {
          d[i + 3] = 0; // céu → transparente (deixa o preto do disco aparecer)
        } else {
          d[i] = 255;   // logo → branco opaco
          d[i + 1] = 255;
          d[i + 2] = 255;
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(id, 0, 0);
      tex.needsUpdate = true;
    };
    img.onerror = () => console.error('[moon-3d] erro logo principal');
    img.src = 'assets/logo_midnight.jpeg';

    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  /* Cria a textura do ANEL PRETO: não usado mais — a borda preta agora
     está embutida na textura da logo. Mantida aqui caso queira reativar. */
  function makeRingTexture() {
    const SIZE = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const rOuter = SIZE * 0.49;
    const rInner = SIZE * (0.49 - 0.09);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, 0, Math.PI * 2, false);
    ctx.arc(cx, cy, rInner, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  /* Projeta uma textura na topografia da lua como decal filho do moonMesh.
     Parâmetros:
       texture      — THREE.Texture a projetar
       decalWidth   — largura/altura da "caixa" do decal (em unidades mundiais)
       decalDepth   — profundidade da "caixa" do decal
       polygonOffset — offset do material pra evitar z-fighting (negativo = mais perto)
     Retorna a Mesh criada (já adicionada como filha do moonMesh). */
  function buildDecal(texture, decalWidth, decalDepth, polygonOffset = -2) {
    const targetMesh = findFirstMesh(moonMesh);
    if (!targetMesh) {
      throw new Error('Nenhuma Mesh com geometry encontrada dentro do moonMesh');
    }

    const decalPos    = new THREE.Vector3(0, 0, MOON_RADIUS);
    const decalOrient = new THREE.Euler(0, 0, 0);
    const decalSize   = new THREE.Vector3(decalWidth, decalWidth, decalDepth);

    const decalGeom = new THREE.DecalGeometry(targetMesh, decalPos, decalOrient, decalSize);
    console.log('[moon-3d] decal vertices:', decalGeom.attributes.position?.count);

    if (!decalGeom.attributes.position || decalGeom.attributes.position.count === 0) {
      throw new Error('DecalGeometry não intersectou a mesh (0 vértices)');
    }

    // Converte vértices pra coordenadas LOCAIS do moonMesh (pra rotação funcionar).
    decalGeom.applyMatrix4(targetMesh.matrixWorld.clone().invert());

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: polygonOffset,
      polygonOffsetUnits: polygonOffset,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(decalGeom, mat);
    moonMesh.add(mesh);
    return mesh;
  }

  /* Orquestra a construção do decal: a textura já tem o disco preto embutido
     (borda/moldura). Um único decal com a logo + moldura preta. */
  function buildLogoMesh() {
    const logoTex = makeLogoTexture();
    // Decal cobre a lua inteira (2.1x o raio) com profundidade suficiente
    // pra pegar toda a curvatura. O disco preto embutido vira a "sombra/borda".
    const decal = buildDecal(logoTex, MOON_RADIUS * 2.1, MOON_RADIUS * 0.8, -2);
    logoMesh = decal;
  }

  /* Helper: percorre recursivamente a hierarquia e devolve a primeira
     THREE.Mesh que tiver .geometry — DecalGeometry precisa de uma mesh
     com BufferGeometry, não de Group/Scene. */
  function findFirstMesh(obj) {
    if (obj.isMesh && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
      return obj;
    }
    if (obj.children) {
      for (const child of obj.children) {
        const found = findFirstMesh(child);
        if (found) return found;
      }
    }
    return null;
  }

  /* =========================================================
     RENDER LOOP + RESIZE
     ========================================================= */
  function resize() {
    const rect = moonEl.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(moonEl);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  /* =========================================================
     ROTAÇÃO DA LUA — AUTO + DRAG MANUAL
     - Sem interação: gira 360° em 12s no eixo Y
     - Segurar + arrastar: para o auto, gira de acordo com o drag
       (horizontal = Y, vertical = X, com limite nos polos)
     - Soltar: depois de 1.5s sem arrastar, volta o auto-rotate
     ========================================================= */

  // Velocidade angular do auto-rotate (radianos/segundo)
  // 2π em 12s = ~0.524 rad/s
  const AUTO_ROTATION_SPEED = (Math.PI * 2) / 12;

  // Limite de inclinação vertical (pra não capotar nos polos)
  const MAX_TILT_X = Math.PI * 0.45; // ~81°

  // Após soltar, espera N ms antes de retomar auto-rotate
  const RESUME_DELAY_MS = 1500;

  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let resumeTimeout = null;
  let moonRotY = 0; // rotação Y acumulada (radianos)
  let moonRotX = 0; // rotação X acumulada (radianos)

  // Captura o estado atual da rotação (usado ao iniciar o drag)
  function captureRotation() {
    if (moonMesh) {
      moonRotY = moonMesh.rotation.y;
      moonRotX = moonMesh.rotation.x;
    }
  }

  // Aplica a rotação atual ao mesh
  function applyRotation() {
    if (!moonMesh) return;
    moonMesh.rotation.y = moonRotY;
    moonMesh.rotation.x = moonRotX;
  }

  // Mata o auto-rotate (cancela a timeline do GSAP e qualquer timeout pendente)
  function pauseAutoRotation() {
    if (typeof gsap !== 'undefined' && moonMesh) {
      gsap.killTweensOf(moonMesh.rotation);
    }
    if (resumeTimeout) {
      clearTimeout(resumeTimeout);
      resumeTimeout = null;
    }
  }

  // Retoma o auto-rotate (cria uma nova timeline infinita no Y)
  function resumeAutoRotation() {
    if (typeof gsap === 'undefined' || !moonMesh) return;
    captureRotation(); // sincroniza moonRotY com o estado atual
    // GSAP anima de moonRotY → moonRotY + 2π em 12s, loop infinito
    // Cada novo ciclo captura o valor atual (caso o drag tenha mexido)
    gsap.to(moonMesh.rotation, {
      y: moonRotY + Math.PI * 2,
      duration: 12,
      ease: 'none',
      repeat: -1,
      onRepeat: () => {
        // Quando completa um ciclo, recaptura o Y atual e continua
        captureRotation();
        gsap.set(moonMesh.rotation, { y: moonRotY });
      },
    });
  }

  // Inicia o auto-rotate pela primeira vez (depois do modelo carregar)
  function startRotation() {
    resumeAutoRotation();
  }

  // Sensibilidade do drag: quanto rotação por pixel arrastado
  const DRAG_SENSITIVITY = 0.005;

  function onPointerDown(e) {
    // Só inicia drag se o pointer estiver em cima do canvas/lua
    if (!moonMesh) return;
    isDragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    pauseAutoRotation();
    // cursor "segurando"
    moonEl.style.cursor = 'grabbing';
    // captura o pointer pra continuar recebendo eventos mesmo se sair da lua
    if (e.target.setPointerCapture && e.pointerId !== undefined) {
      try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    }
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    // Arrastar pra direita → lua gira pra direita (Y+)
    // Arrastar pra cima    → lua gira pra cima   (X-)
    moonRotY += dx * DRAG_SENSITIVITY;
    moonRotX += dy * DRAG_SENSITIVITY;
    // Limita o tilt vertical pra não capotar
    if (moonRotX >  MAX_TILT_X) moonRotX =  MAX_TILT_X;
    if (moonRotX < -MAX_TILT_X) moonRotX = -MAX_TILT_X;
    applyRotation();
  }

  function onPointerUp(e) {
    if (!isDragging) return;
    isDragging = false;
    moonEl.style.cursor = 'grab';
    // Soltou: agenda o retorno do auto-rotate
    if (resumeTimeout) clearTimeout(resumeTimeout);
    resumeTimeout = setTimeout(() => {
      resumeTimeout = null;
      if (!isDragging) resumeAutoRotation();
    }, RESUME_DELAY_MS);
  }

  // Atacha os listeners no container (não só no canvas, pra pegar área toda da lua)
  moonEl.style.cursor = 'grab';
  moonEl.style.touchAction = 'none'; // previne scroll ao arrastar no touch

  moonEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  /* =========================================================
     TILT DA CÂMERA (continua igual — paralaxe com o mouse)
     ========================================================= */
  let targetCamX = 0, targetCamY = 0;
  let currentCamX = 0, currentCamY = 0;

  function onMouseMove(e) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const nx = (e.clientX / w) * 2 - 1;
    const ny = (e.clientY / h) * 2 - 1;
    targetCamX = nx * 0.6;
    targetCamY = -ny * 0.4;
  }
  window.addEventListener('mousemove', onMouseMove, { passive: true });

  function cameraTilt() {
    currentCamX += (targetCamX - currentCamX) * 0.06;
    currentCamY += (targetCamY - currentCamY) * 0.06;
    camera.position.x = currentCamX;
    camera.position.y = currentCamY;
    camera.lookAt(0, 0, 0);
    requestAnimationFrame(cameraTilt);
  }
  cameraTilt();

})();