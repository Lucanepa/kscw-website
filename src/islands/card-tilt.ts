// 3D mouse-tilt for elements tagged with `.tilt-3d`.
// Reads cursor position relative to the element, applies perspective + rotate
// transforms via inline style. On pointerleave the inline style is cleared so
// the element's CSS hover rule (if any) takes over.
//
// Tilt magnitude is capped at ±6deg, with rAF-throttled updates and respect
// for prefers-reduced-motion.

const els = document.querySelectorAll<HTMLElement>('.tilt-3d');
if (els.length) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    const MAX_DEG = 6;

    els.forEach((el) => {
      let raf = 0;
      let pendingX = 0;
      let pendingY = 0;

      el.style.willChange = 'transform';
      el.style.transformStyle = 'preserve-3d';

      const apply = () => {
        raf = 0;
        const rect = el.getBoundingClientRect();
        const nx = (pendingX - rect.left) / rect.width - 0.5; // -0.5..0.5
        const ny = (pendingY - rect.top) / rect.height - 0.5;
        const ry = nx * MAX_DEG * 2;   // ±MAX_DEG
        const rx = -ny * MAX_DEG * 2;
        el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(0)`;
      };

      el.addEventListener('pointermove', (e) => {
        pendingX = e.clientX;
        pendingY = e.clientY;
        if (!raf) raf = requestAnimationFrame(apply);
      });

      el.addEventListener('pointerleave', () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        el.style.transform = '';
      });
    });
  }
}
