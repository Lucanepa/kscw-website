// Sparkles canvas — soft twinkling particles drifting upward. Mounts on any
// `<canvas class="sparkles-canvas">` element. One rAF loop per canvas, paused
// via IntersectionObserver when off-screen. Honours prefers-reduced-motion
// (renders a single static frame and bails).

interface Particle {
  x: number;
  y: number;
  baseR: number;
  phase: number;
  vy: number;
}

const canvases = document.querySelectorAll<HTMLCanvasElement>('.sparkles-canvas');
canvases.forEach((canvas) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colorAttr = canvas.dataset.color || 'rgba(255, 220, 130, 1)';

  let particles: Particle[] = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = true;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.max(20, Math.min(110, Math.floor((width * height) / 7500)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      baseR: Math.random() * 1.3 + 0.3,
      phase: Math.random() * Math.PI * 2,
      vy: -(Math.random() * 0.18 + 0.04),
    }));
  }

  function drawStatic() {
    ctx!.clearRect(0, 0, width, height);
    particles.forEach((p) => {
      ctx!.fillStyle = colorAttr.replace(/,\s*1\)$/, ', 0.7)');
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, p.baseR, 0, Math.PI * 2);
      ctx!.fill();
    });
  }

  function frame() {
    if (!running) return;
    ctx!.clearRect(0, 0, width, height);
    particles.forEach((p) => {
      p.phase += 0.045;
      p.y += p.vy;
      if (p.y < -2) {
        p.y = height + 2;
        p.x = Math.random() * width;
      }
      const twinkle = (Math.sin(p.phase) + 1) / 2;
      const r = p.baseR * (0.55 + twinkle * 0.45);
      const alpha = 0.25 + twinkle * 0.55;
      ctx!.fillStyle = colorAttr.replace(/,\s*1\)$/, `, ${alpha.toFixed(3)})`);
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx!.fill();
    });
    requestAnimationFrame(frame);
  }

  resize();
  if (prefersReducedMotion) {
    drawStatic();
    return;
  }

  // Pause when the canvas scrolls out of view.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const wasRunning = running;
        running = entry.isIntersecting;
        if (running && !wasRunning) requestAnimationFrame(frame);
      });
    }, { threshold: 0 });
    io.observe(canvas);
  }

  window.addEventListener('resize', resize, { passive: true });
  requestAnimationFrame(frame);
});
