/* =========================================================
   xeni CODE — Variation 1: Wireframe / Geometric Mesh
   Vanilla JS. No libraries.
   ========================================================= */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------
     1. MOBILE MENU
     ---------------------------------------------------- */
  const burger = document.querySelector('.nav__burger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (burger && mobileMenu) {
    const toggle = (open) => {
      const willOpen = open ?? burger.getAttribute('aria-expanded') !== 'true';
      burger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (willOpen) {
        mobileMenu.hidden = false;
        mobileMenu.setAttribute('data-open', 'true');
      } else {
        mobileMenu.setAttribute('data-open', 'false');
        setTimeout(() => { mobileMenu.hidden = true; }, 50);
      }
    };
    burger.addEventListener('click', () => toggle());
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));
    window.addEventListener('resize', () => { if (window.innerWidth > 960) toggle(false); });
  }

  /* ----------------------------------------------------
     2. REVEAL ON SCROLL
     ---------------------------------------------------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  /* ----------------------------------------------------
     3. STAT COUNTERS
     ---------------------------------------------------- */
  const counters = document.querySelectorAll('.counter');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    // HTML ships with real values for crawlers; reset to 0 for smooth animation.
    counters.forEach(c => { c.textContent = '0'; });
    const cio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = parseInt(el.dataset.target, 10);
        const duration = 1600;
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutCubic
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.floor(eased * target).toString();
          if (t < 1) requestAnimationFrame(tick);
          else el.textContent = target.toString();
        };
        requestAnimationFrame(tick);
        cio.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach(c => cio.observe(c));
  } else {
    counters.forEach(c => { c.textContent = c.dataset.target; });
  }

  /* ----------------------------------------------------
     4. CONTACT FORM — submits to Web3Forms relay
     ---------------------------------------------------- */
  const WEB3FORMS_KEY = '56cf17d4-4f42-42b0-abd3-934ced1a38aa';
  const form = document.getElementById('contact-form');
  const success = document.getElementById('form-success');
  const errorEl = document.getElementById('form-error');
  if (form && success) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const submitLabel = submitBtn && submitBtn.querySelector('span');
    const originalLabel = submitLabel ? submitLabel.textContent : '';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Basic validation
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const type = form.type.value;
      const message = form.message.value.trim();
      if (!name || !email || !type || !message) {
        form.reportValidity();
        return;
      }
      // Honeypot — silently drop bot submissions.
      // NOTE: must check `.checked`, not `.value` — a checkbox's `.value`
      // is always "on" regardless of state, which would drop every submission.
      if (form.botcheck && form.botcheck.checked) return;

      if (errorEl) errorEl.hidden = true;
      success.hidden = true;
      [...form.elements].forEach(el => el.disabled = true);
      if (submitBtn) submitBtn.classList.add('is-loading');
      if (submitLabel) submitLabel.textContent = 'Sending…';

      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY,
            subject: `[xeni CODE] New ${type} inquiry from ${name}`,
            from_name: 'xeni CODE website',
            // Submissions are delivered to xenicode.company@gmail.com (the
            // inbox bound to the Web3Forms access key). A Gmail forwarding
            // rule on that account then mirrors every message to
            // fm.marais@gmail.com, so we don't need to list it here.
            name,
            email,
            type,
            message,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Submission failed');
        }
        // Success — clear inputs and re-enable so a follow-up message is possible
        form.reset();
        [...form.elements].forEach(el => el.disabled = false);
        success.hidden = false;
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        // Failure — leave the user's typed values intact so they can retry
        [...form.elements].forEach(el => el.disabled = false);
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } finally {
        if (submitBtn) submitBtn.classList.remove('is-loading');
        if (submitLabel) submitLabel.textContent = originalLabel;
      }
    });
  }

  /* ----------------------------------------------------
     5. YEAR
     ---------------------------------------------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ----------------------------------------------------
     6. HERO MESH — particle/line canvas written from scratch
     ---------------------------------------------------- */
  const canvas = document.getElementById('mesh');
  if (!canvas) return;
  if (prefersReducedMotion) {
    // Draw a single static frame so the hero still has some texture
    drawStaticMesh(canvas);
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  let W = 0, H = 0, DPR = 1;
  let particles = [];
  const mouse = { x: -9999, y: -9999, active: false };
  let rafId = null;

  // Density tuning based on viewport area
  const densityFor = (w, h) => {
    const area = w * h;
    // ~1 particle per 11,000 px² on desktop, capped
    return Math.max(42, Math.min(140, Math.floor(area / 11000)));
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  function seed() {
    const count = densityFor(W, H);
    particles = new Array(count).fill(0).map(() => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() < 0.15 ? 2.0 : 1.1,   // a few "anchor" nodes
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  function step() {
    ctx.clearRect(0, 0, W, H);

    // Soft gradient paper wash so the hero doesn't look flat
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, 'rgba(15,15,15,1)');
    grd.addColorStop(1, 'rgba(10,10,10,1)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Update particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      // Gentle mouse repulsion within radius
      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx*dx + dy*dy;
        const R = 160;
        if (d2 < R*R && d2 > 1) {
          const d = Math.sqrt(d2);
          const force = (1 - d / R) * 0.6;
          p.vx += (dx / d) * force * 0.1;
          p.vy += (dy / d) * force * 0.1;
        }
      }

      // Damping — keeps motion slow & elegant
      p.vx *= 0.985;
      p.vy *= 0.985;

      // Tiny brownian nudge so they never go fully still
      p.vx += (Math.random() - 0.5) * 0.008;
      p.vy += (Math.random() - 0.5) * 0.008;

      // Wrap edges
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;

      p.pulse += 0.015;
    }

    // Draw connecting lines — the wireframe mesh itself
    const threshold = Math.min(180, Math.max(110, W / 9));
    const t2 = threshold * threshold;

    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < t2) {
          const alpha = (1 - d2 / t2) * 0.55;
          ctx.strokeStyle = `rgba(245, 245, 245, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Mouse connection lines — highlighted
    if (mouse.active) {
      const mThresh = 180;
      const mT2 = mThresh * mThresh;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < mT2) {
          const alpha = (1 - d2 / mT2) * 0.9;
          ctx.strokeStyle = `rgba(245, 245, 245, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes on top
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const breath = (Math.sin(p.pulse) + 1) * 0.5;
      const r = p.r + breath * 0.3;

      // Outer ring for anchor nodes
      if (p.r > 1.5) {
        ctx.strokeStyle = 'rgba(245,245,245,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(245,245,245,0.9)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouse marker — a tiny triangle crosshair
    if (mouse.active) {
      ctx.strokeStyle = 'rgba(29, 232, 181, 0.9)'; // accent
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mouse.x - 10, mouse.y);
      ctx.lineTo(mouse.x + 10, mouse.y);
      ctx.moveTo(mouse.x, mouse.y - 10);
      ctx.lineTo(mouse.x, mouse.y + 10);
      ctx.stroke();
    }

    rafId = requestAnimationFrame(step);
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = mouse.x >= 0 && mouse.x <= W && mouse.y >= 0 && mouse.y <= H;
  }
  function onMouseLeave() { mouse.active = false; }

  function onTouch(e) {
    if (!e.touches || !e.touches[0]) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.touches[0].clientX - rect.left;
    mouse.y = e.touches[0].clientY - rect.top;
    mouse.active = true;
  }
  function onTouchEnd() { mouse.active = false; }

  // Pause animation when tab is hidden
  function onVisibility() {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId) {
      rafId = requestAnimationFrame(step);
    }
  }

  // Pause when hero is out of view
  let heroVisible = true;
  if ('IntersectionObserver' in window) {
    const hio = new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
      if (!heroVisible && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      } else if (heroVisible && !rafId && !document.hidden) {
        rafId = requestAnimationFrame(step);
      }
    }, { threshold: 0 });
    hio.observe(canvas);
  }

  // Boot
  resize();
  window.addEventListener('resize', debounce(resize, 200));
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('touchmove', onTouch, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd);
  document.addEventListener('visibilitychange', onVisibility);
  rafId = requestAnimationFrame(step);

  /* ---------------- helpers ---------------- */
  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  function drawStaticMesh(canvas) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    const pts = [];
    const count = 60;
    // Deterministic-ish layout
    for (let i = 0; i < count; i++) {
      pts.push({
        x: (Math.sin(i * 12.9898) * 43758.5453) % 1 * w,
        y: (Math.cos(i * 78.233) * 43758.5453) % 1 * h,
      });
      if (pts[i].x < 0) pts[i].x += w;
      if (pts[i].y < 0) pts[i].y += h;
    }
    ctx.strokeStyle = 'rgba(245,245,245,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i+1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        if (dx*dx + dy*dy < 140*140) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.fillStyle = 'rgba(245,245,245,0.85)';
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
})();
