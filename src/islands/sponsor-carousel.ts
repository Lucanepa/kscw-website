// Sponsor Carousel — Infinite Scroll

const track = document.querySelector('.sponsor-track');

function cloneSponsors() {
  if (!track) return;
  const children = Array.from(track.children).filter(
    (c) => c.getAttribute('aria-hidden') !== 'true'
  );
  if (children.length) {
    children.forEach((child) => {
      const clone = child.cloneNode(true) as HTMLElement;
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  }
}

if (track) {
  const children = Array.from(track.children).filter(
    (c) => c.getAttribute('aria-hidden') !== 'true'
  );
  if (children.length) {
    // Items already present — clone immediately
    cloneSponsors();
  } else {
    // Items not yet loaded — observe for first mutation
    const observer = new MutationObserver(() => {
      const real = Array.from(track.children).filter(
        (c) => c.getAttribute('aria-hidden') !== 'true'
      );
      if (real.length) {
        observer.disconnect();
        cloneSponsors();
      }
    });
    observer.observe(track, { childList: true });
  }
}
