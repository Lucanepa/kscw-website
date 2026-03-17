// Mobile Navigation + Desktop Touch Dropdowns + Sticky Header

// 1. Sticky Header Shadow
const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// 2. Mobile Nav Toggle
const hamburger = document.querySelector('.nav-hamburger');
const mobileNav = document.querySelector('.mobile-nav');

if (hamburger) {
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.body.classList.toggle('nav-open');
  });

  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('nav-open')) return;
    const target = e.target as HTMLElement;
    if (mobileNav?.contains(target)) return;
    if (hamburger.contains(target)) return;
    document.body.classList.remove('nav-open');
  });

  if (mobileNav) {
    mobileNav.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('a')) {
        document.body.classList.remove('nav-open');
      }
    });
  }
}

// 3. Mobile Accordion
document.querySelectorAll('.mobile-nav-link').forEach((link) => {
  const parent = link.closest('.mobile-nav-item');
  if (!parent) return;
  const subnav = parent.querySelector('.mobile-subnav');
  if (!subnav) return;

  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.mobile-nav-item.open').forEach((item) => {
      if (item !== parent) item.classList.remove('open');
    });
    parent.classList.toggle('open');
  });
});

// 4. Desktop Dropdown Touch Support
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach((item) => {
  const dropdown = item.querySelector('.nav-dropdown');
  if (!dropdown) return;
  const link = item.querySelector('.nav-link');
  if (!link) return;

  link.addEventListener('click', (e) => {
    if (window.matchMedia('(hover: hover)').matches) return;
    if (!item.classList.contains('open')) {
      e.preventDefault();
      navItems.forEach((other) => {
        if (other !== item) other.classList.remove('open');
      });
      item.classList.add('open');
    }
  });
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  navItems.forEach((item) => {
    if (!item.contains(target)) item.classList.remove('open');
  });
});

// 5. Active Nav Highlighting
const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
document.querySelectorAll('.nav-link, .dropdown-link, .mobile-nav-link, .mobile-sublink').forEach((link) => {
  const href = link.getAttribute('href');
  if (!href) return;
  const linkPath = href.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
  if (linkPath === currentPath) {
    link.classList.add('active');
    const parentItem = link.closest('.nav-item');
    if (parentItem) {
      const parentLink = parentItem.querySelector('.nav-link');
      if (parentLink) parentLink.classList.add('active');
    }
  }
});

// 6. Smooth Scroll for Anchor Links
document.addEventListener('click', (e) => {
  const link = (e.target as HTMLElement).closest('a[href*="#"]');
  if (!link) return;
  const href = link.getAttribute('href')!;
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return;
  const path = href.substring(0, hashIndex);
  if (path && path !== '' && path !== window.location.pathname) return;
  const targetId = href.substring(hashIndex + 1);
  if (!targetId) return;
  const targetEl = document.getElementById(targetId);
  if (!targetEl) return;
  e.preventDefault();
  const headerEl = document.querySelector('.site-header');
  const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
  const targetPosition = targetEl.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
  window.scrollTo({ top: targetPosition, behavior: 'smooth' });
  history.pushState(null, '', '#' + targetId);
});
