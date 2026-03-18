// Accordion toggle for collapsible sections
document.querySelectorAll('.accordion-header').forEach((header) => {
  header.addEventListener('click', () => {
    const item = header.closest('.accordion-item');
    if (!item) return;
    item.classList.toggle('open');
  });
});
