/**
 * News Detail Modal — opens when clicking a news card on the homepage.
 * Reads article data from embedded <script type="application/json"> inside each card.
 */
(function () {
  'use strict';

  var overlay = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function createCloseSvg() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('fill', 'currentColor');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('clip-rule', 'evenodd');
    path.setAttribute('d', 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z');
    svg.appendChild(path);
    return svg;
  }

  function close() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      overlay = null;
      document.body.style.overflow = '';
    }
  }

  function showNewsModal(data, locale) {
    if (overlay) close();
    var isDE = locale !== 'en';

    document.body.style.overflow = 'hidden';
    overlay = el('div', 'news-modal-overlay');
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    var modal = el('div', 'news-modal');
    overlay.appendChild(modal);

    // ── Header: badge + close
    var header = el('div', 'nm-header');
    var left = el('div', 'nm-header-left');

    var dateStr = data.date
      ? new Date(data.date).toLocaleDateString(isDE ? 'de-CH' : 'en-CH', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';
    if (dateStr) left.appendChild(el('span', 'news-date', dateStr));

    var badgeClass = 'badge';
    var badgeLabel = 'Club';
    if (data.category === 'volleyball') { badgeClass += ' badge-blue'; badgeLabel = 'Volleyball'; }
    else if (data.category === 'basketball') { badgeClass += ' badge-orange'; badgeLabel = 'Basketball'; }
    left.appendChild(el('span', badgeClass, badgeLabel));

    if (data.author) left.appendChild(el('span', 'nm-author', data.author));

    header.appendChild(left);

    var closeBtn = el('button', 'gm-close');
    closeBtn.appendChild(createCloseSvg());
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // ── Title
    modal.appendChild(el('h2', 'nm-title', data.title));

    // ── Image
    if (data.image) {
      var imgWrap = el('div', 'nm-image');
      var img = document.createElement('img');
      img.src = data.image;
      img.alt = data.title;
      imgWrap.appendChild(img);
      modal.appendChild(imgWrap);
    }

    // ── Body (HTML from Quill editor, authored by admin — not user-submitted)
    // SECURITY: This content comes from the Directus `news` collection which is
    // only writable by authenticated admins via the admin dashboard's Quill editor.
    // It is NOT user-submitted content and does not require sanitization.
    if (data.body) {
      var body = el('div', 'nm-body');
      body.innerHTML = data.body; // eslint-disable-line no-unsanitized/property -- admin-authored content
      modal.appendChild(body);
    }

    document.body.appendChild(overlay);

    // Escape key
    function onKey(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    }
    document.addEventListener('keydown', onKey);
  }

  // ── Click handler for news cards
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.news-card[data-news-id]');
    if (!card) return;
    var dataEl = card.querySelector('.news-data');
    if (!dataEl) return;
    try {
      var data = JSON.parse(dataEl.textContent);
      var locale = document.documentElement.lang || 'de';
      showNewsModal(data, locale);
    } catch (err) {
      console.warn('[KSCW] Failed to parse news data:', err);
    }
  });
})();
