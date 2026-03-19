// Event card expand/collapse toggle
document.querySelectorAll('.event-card--clickable').forEach((card) => {
  card.addEventListener('click', () => {
    card.classList.toggle('event-card--open');
  });
});
