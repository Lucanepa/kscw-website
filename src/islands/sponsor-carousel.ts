// Sponsor Carousel — Infinite Scroll

const track = document.querySelector('.sponsor-track');
if (track) {
  const children = Array.from(track.children);
  if (children.length) {
    children.forEach((child) => {
      const clone = child.cloneNode(true) as HTMLElement;
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }
}
