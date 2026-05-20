// Scroll-progress bar pinned to the top of the viewport.
// Pure DOM, no framework. Respects prefers-reduced-motion (skips updates → bar
// stays at 100% once the page is loaded, which is harmless).

const bar = document.querySelector<HTMLElement>('.scroll-progress-bar');
if (bar) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    bar.style.transform = 'scaleX(0)';
  } else {
    let ticking = false;
    function update() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar!.style.transform = `scaleX(${ratio})`;
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }
}
