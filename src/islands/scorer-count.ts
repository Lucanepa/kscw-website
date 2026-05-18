// Scorer-course sign-up count badge.
// Fetches the live OpnForm submission count via the Directus proxy
// (GET /kscw/opnform/forms/:slug/count) and reveals a localized badge.
// Hidden until a count >= 1 is known — never shows "0 signed up" on a
// sign-up form, and degrades silently if the upstream is unreachable.

import { getDirectusUrl } from '../lib/directus';

const badges = document.querySelectorAll<HTMLElement>('.scorer-count[data-count-slug]');

if (badges.length) {
  const base = getDirectusUrl();

  badges.forEach((el) => {
    const slug = el.getAttribute('data-count-slug');
    if (!slug) return;

    fetch(`${base}/kscw/opnform/forms/${encodeURIComponent(slug)}/count`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const count = Number(json?.count);
        if (!Number.isFinite(count) || count < 1) return;

        const tpl =
          count === 1
            ? el.getAttribute('data-count-one') || '1'
            : el.getAttribute('data-count-many') || '{n}';
        el.textContent = tpl.replace('{n}', String(count));
        el.hidden = false;
      })
      .catch(() => {
        /* upstream unreachable — leave the badge hidden */
      });
  });
}
