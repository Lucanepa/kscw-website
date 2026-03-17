// Stat Counter Animation

const statElements = document.querySelectorAll<HTMLElement>('.stat-number[data-value]');
if (statElements.length) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateCounter(el: HTMLElement) {
    const raw = el.getAttribute('data-value') || '0';
    const targetValue = parseInt(raw, 10);
    if (isNaN(targetValue)) return;
    const suffix = raw.replace(/[\d]/g, '');

    if (prefersReducedMotion) {
      el.textContent = targetValue + suffix;
      return;
    }

    const duration = 1500;
    let startTime: number | null = null;

    function step(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(easedProgress * targetValue);
      el.textContent = currentValue + (progress === 1 ? suffix : '');
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    statElements.forEach((el) => {
      const value = el.getAttribute('data-value') || '0';
      const num = parseInt(value, 10);
      const suffix = value.replace(/[\d]/g, '');
      el.textContent = (isNaN(num) ? value : String(num)) + suffix;
    });
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    statElements.forEach((el) => observer.observe(el));
  }
}
