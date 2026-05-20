// Tracing beam — fills a vertical bar pinned to the left of a
// `.tracing-beam-wrapper` element, driven by scroll position. Progress is
// computed from how far the wrapper has been scrolled past the viewport top.
//
// No-op if no wrapper exists. Respects prefers-reduced-motion (locks beam
// at full fill so it doesn't appear empty).

const wrappers = document.querySelectorAll<HTMLElement>('.tracing-beam-wrapper');
if (wrappers.length) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  wrappers.forEach((wrapper) => {
    const beam = wrapper.querySelector<HTMLElement>('.tracing-beam');
    if (!beam) return;

    if (prefersReducedMotion) {
      beam.style.setProperty('--beam-progress', '1');
      return;
    }

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = wrapper.getBoundingClientRect();
      const viewportH = window.innerHeight;
      // Progress reaches 1 when the wrapper bottom hits ~75% of the viewport.
      const denominator = rect.height - viewportH * 0.4;
      const numerator = -rect.top + viewportH * 0.15;
      const progress = denominator > 0
        ? Math.max(0, Math.min(1, numerator / denominator))
        : 0;
      beam.style.setProperty('--beam-progress', progress.toFixed(4));
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  });
}
