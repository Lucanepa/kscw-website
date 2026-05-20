// Cursor-following spotlight inside cards within a `.card-glow-grid` container.
// Each card gets a radial-gradient overlay driven by --mouse-x / --mouse-y
// CSS vars. Delegated mousemove on the grid keeps listener count low.
// No-op if no matching grids exist on the page.

const grids = document.querySelectorAll<HTMLElement>('.card-glow-grid');
if (grids.length) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    grids.forEach((grid) => {
      grid.addEventListener('mousemove', (e) => {
        const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('.card');
        if (!target || !grid.contains(target)) return;
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        target.style.setProperty('--mouse-x', `${x}px`);
        target.style.setProperty('--mouse-y', `${y}px`);
      });
    });
  }
}
