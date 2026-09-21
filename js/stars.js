/* =========================================================
   MIDNIGHT DEVS — Campo de estrelas em canvas
   - Estrela parada: pontinho com twinkle (igual ao CSS antigo)
   - Com scroll: vira rastro (linha) proporcional à velocidade,
     com paralaxe por camada — e volta ao normal ao parar
   ========================================================= */

(() => {
  'use strict';

  const canvas = document.getElementById('stars-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let stars = [];

  /* ---------------------------------------------------------
     Configuração das camadas (fundo → frente)
     depth: paralaxe (rastro mais longo nas camadas da frente)
     --------------------------------------------------------- */
  const LAYERS = [
    { share: 0.62, sizeMin: 0.5, sizeMax: 1.2, depth: 0.30, alpha: 0.55 },
    { share: 0.28, sizeMin: 1.1, sizeMax: 1.9, depth: 0.60, alpha: 0.75 },
    { share: 0.10, sizeMin: 1.7, sizeMax: 2.6, depth: 1.00, alpha: 0.95 },
  ];

  // ~1 estrela a cada 9000px² (visual do box-shadow antigo), com teto
  const AREA_PER_STAR = 9000;
  const MAX_STARS = 280;

  function rand(min, max) { return min + Math.random() * (max - min); }

  function buildStars() {
    const total = Math.min(Math.round((W * H) / AREA_PER_STAR), MAX_STARS);
    stars = [];
    for (const layer of LAYERS) {
      const count = Math.round(total * layer.share);
      for (let i = 0; i < count; i++) {
        // Camada da frente tem algumas estrelas azul-noite (como no CSS antigo)
        const color = layer.depth === 1 && Math.random() < 0.25
          ? '107, 140, 255'
          : '255, 255, 255';
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: rand(layer.sizeMin, layer.sizeMax),
          color,
          alpha: layer.alpha * rand(0.7, 1),
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: rand(0.4, 1.4),
          depth: layer.depth,
        });
      }
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars();
    if (reducedMotion) draw(0); // sem animação: um frame estático basta
  }

  /* ---------------------------------------------------------
     Scroll → velocidade suavizada
     --------------------------------------------------------- */
  let lastY = window.scrollY;
  let vSmooth = 0;            // px/frame, suavizado
  const V_ATTACK = 0.30;      // sobe rápido enquanto scrolla
  const V_RELEASE = 0.982;    // decai devagar: cauda longa após parar
  const V_MAX = 110;          // teto da velocidade (evita rastro gigante)
  const TRAIL = 1.5;          // comprimento do rastro por px de velocidade
  const DRIFT = 0.55;         // deslocamento da estrela na direção do movimento

  function readScroll() {
    const y = window.scrollY;
    const v = y - lastY;
    lastY = y;
    // ataque rápido, solto lento: o rastro persiste ~2-3s depois de parar
    if (Math.abs(v) > Math.abs(vSmooth)) {
      vSmooth += (v - vSmooth) * V_ATTACK;
    } else {
      vSmooth *= V_RELEASE;
    }
    if (vSmooth > V_MAX) vSmooth = V_MAX;
    if (vSmooth < -V_MAX) vSmooth = -V_MAX;
  }

  /* ---------------------------------------------------------
     Desenho
     --------------------------------------------------------- */
  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    // scroll pra baixo → estrelas sobem (passamos por elas)
    const drift = -vSmooth * DRIFT;

    for (const s of stars) {
      const d = s.depth;
      // rastro: só existe com velocidade; camadas da frente esticam mais
      const len = vSmooth * d * TRAIL;
      const x = s.x;
      const y = s.y + drift * d;

      let a = s.alpha;
      if (!reducedMotion) {
        // twinkle (mesma ideia do animation CSS antigo)
        const tw = 0.55 + 0.45 * Math.sin(t * 0.001 * s.twinkleSpeed + s.phase);
        a *= tw;
        // acende bem durante o rastro
        if (len !== 0) a = Math.min(1, a * (1 + Math.min(Math.abs(len) / 60, 1) * 1.4));
      }

      if (Math.abs(len) < 2) {
        // pontinho (estado parado)
        ctx.fillStyle = `rgba(${s.color}, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // rastro: gradiente do ponto (cabeça) até o fim da linha (cauda)
        const grad = ctx.createLinearGradient(x, y, x, y + len);
        grad.addColorStop(0, `rgba(${s.color}, ${Math.min(1, a).toFixed(3)})`);
        grad.addColorStop(0.55, `rgba(${s.color}, ${(a * 0.45).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${s.color}, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.r * 1.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len);
        ctx.stroke();
        // cabeça do rastro: a própria estrela, brilhante
        ctx.fillStyle = `rgba(${s.color}, ${Math.min(1, a + 0.25).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  let rafId = null;
  function loop(t) {
    readScroll();
    draw(t);
    rafId = requestAnimationFrame(loop);
  }

  // Loop contínuo (twinkle) enquanto a aba está visível
  function start() {
    if (reducedMotion || rafId !== null) return;
    lastY = window.scrollY;
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    vSmooth = 0;
  }

  /* ---------------------------------------------------------
     Eventos
     --------------------------------------------------------- */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else { lastY = window.scrollY; start(); }
  });

  resize();
  start();
})();