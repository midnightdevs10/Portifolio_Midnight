/* =========================================================
   MIDNIGHT DEVS — Cena 3D
   - Lua GIRA no eixo Y (Three.js em moon-3d.js)
   - Aqui fica: tilt do palco, paralaxe
   - Logo MD acende com glow ciano (controlado no moon-3d.js)
   ========================================================= */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarsePointer = window.matchMedia('(hover: none)').matches;

  if (typeof gsap === 'undefined') {
    console.warn('[midnight] GSAP não carregou.');
    return;
  }

  const hero       = document.querySelector('.hero');
  const scene      = document.getElementById('scene-3d');

  if (!hero || !scene) return;

  /* =========================================================
     TILT DO PALCO (sem parallax da lua — ela fica parada no eixo)
     A lua é 3D e tem sua própria câmera em moon-3d.js
     ========================================================= */
  const sceneRx = gsap.quickTo(scene, 'rotateX', { duration: 1.6, ease: 'power4.out' });
  const sceneRy = gsap.quickTo(scene, 'rotateY', { duration: 1.8, ease: 'power4.out' });

  /* =========================================================
     IDLE FLOATING
     ========================================================= */
  let idleTimer = null;
  let isIdle = false;

  const idleAnim = gsap.timeline({ paused: true, repeat: -1, yoyo: true })
    .to(scene, { yPercent: 1.5, duration: 4.0, ease: 'sine.inOut' });

  function startIdle() { if (!isIdle) { isIdle = true; idleAnim.play(); } }
  function stopIdle()  { if (isIdle)  { isIdle = false; idleAnim.pause(); gsap.to(scene, { y: 0, duration: 0.8, ease: 'power2.out' }); } }
  function resetIdleTimer() { stopIdle(); clearTimeout(idleTimer); idleTimer = setTimeout(startIdle, 1500); }

  /* =========================================================
     MOUSE TRACKER — só inclina o palco
     ========================================================= */
  if (!prefersReducedMotion && !isCoarsePointer) {
    function onMouseMove(e) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nx = (e.clientX / w) * 2 - 1;
      const ny = (e.clientY / h) * 2 - 1;

      sceneRx(ny * -12);
      sceneRy(nx *  12);

      resetIdleTimer();
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    hero.addEventListener('mouseleave', () => {
      sceneRx(0); sceneRy(0);
      clearTimeout(idleTimer);
      startIdle();
    });
    hero.addEventListener('mouseenter', () => { stopIdle(); resetIdleTimer(); });

    resetIdleTimer();
  }

  /* =========================================================
     OVERLAY DE CARREGAMENTO
     Some quando moon-3d.js emitir 'moon-ready' (ou após 10s fallback)
     ========================================================= */
  const preload = document.getElementById('preload');
  if (preload) {
    const reveal = () => preload.classList.add('is-hidden');
    window.addEventListener('moon-ready', reveal, { once: true });
    // Fallback de segurança
    setTimeout(reveal, 10000);
  }

  /* =========================================================
     SCROLL REVEAL
     ========================================================= */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }

  /* =========================================================
     NAV
     ========================================================= */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 30) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* =========================================================
     HAMBURGER MENU (mobile)
     ========================================================= */
  const navToggle = document.getElementById('nav-toggle');
  const navLinks  = document.getElementById('nav-links');

  function closeMenu() {
    if (!navToggle || !navLinks) return;
    navToggle.classList.remove('is-open');
    navLinks.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Abrir menu');
  }
  function openMenu() {
    if (!navToggle || !navLinks) return;
    navToggle.classList.add('is-open');
    navLinks.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Fechar menu');
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (navLinks.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    // Fecha ao clicar em qualquer link do menu
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Fecha ao clicar fora do menu
    document.addEventListener('click', (e) => {
      if (!navLinks.classList.contains('is-open')) return;
      if (navLinks.contains(e.target) || navToggle.contains(e.target)) return;
      closeMenu();
    });

    // Fecha com Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('is-open')) closeMenu();
    });

    // Se a tela for redimensionada pra desktop, garante que o menu está fechado
    window.addEventListener('resize', () => {
      if (window.innerWidth > 720) closeMenu();
    });
  }

  /* =========================================================
     SMOOTH SCROLL
     ========================================================= */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId.length > 1) {
        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

})();
