// Theme Toggle (dark/light mode)

function initThemeToggle() {
  const toggles = document.querySelectorAll('.theme-toggle');

  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const isLight = document.documentElement.classList.toggle('light');
      localStorage.setItem('kscw-theme', isLight ? 'light' : 'dark');

      toggles.forEach((b) => {
        const icon = b.querySelector('[data-lucide]');
        const label = b.querySelector('.theme-label');
        if (icon) icon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
        if (label) label.textContent = isLight ? 'Dark Mode' : 'Light Mode';
        if (typeof (window as any).lucide !== 'undefined') {
          (window as any).lucide.createIcons();
        }
      });
    });
  });
}

initThemeToggle();
