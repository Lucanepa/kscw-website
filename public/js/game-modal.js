/**
 * Game Detail Modal — public website version of Wiedisync's GameDetailModal.
 * Shows: teams, score, sets, date/time, venue + Google Maps link.
 * No auth, no participation, no scorer duties.
 *
 * Usage: call showGameModal(game, locale) where game is a KSCW.games[] object.
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

  function createChipSpan(D, teamShort) {
    var t = D.getTeam(teamShort);
    var chip = el('span', 'chip');
    if (t) {
      chip.style.background = t.bg;
      chip.style.color = t.text;
      chip.style.border = '1px solid ' + t.border;
      chip.textContent = t.short;
    } else {
      chip.style.background = '#e2e8f0';
      chip.style.color = '#475569';
      chip.textContent = teamShort;
    }
    return chip;
  }

  function infoRow(label, value) {
    var row = el('div', 'gm-row');
    row.appendChild(el('span', 'gm-label', label));
    if (typeof value === 'string') {
      row.appendChild(el('span', 'gm-value', value));
    } else {
      var v = el('span', 'gm-value');
      v.appendChild(value);
      row.appendChild(v);
    }
    return row;
  }

  // Close button SVG built via DOM (no innerHTML needed)
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

  window.showGameModal = function (game, locale) {
    if (overlay) close();
    var D = window.KSCW;
    if (!D) return;

    var isDE = locale !== 'en';

    document.body.style.overflow = 'hidden';
    overlay = el('div', 'game-modal-overlay');
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    var modal = el('div', 'game-modal');
    overlay.appendChild(modal);

    // ── Header: league badge + team chip + close btn
    var header = el('div', 'gm-header');
    var left = el('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '0.5rem';
    if (game.league) {
      left.appendChild(el('span', 'badge', game.league));
    }
    left.appendChild(createChipSpan(D, game.teamShort));
    header.appendChild(left);

    var closeBtn = el('button', 'gm-close');
    closeBtn.appendChild(createCloseSvg());
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // ── Score section
    var scoreSection = el('div', 'gm-score-section');
    var teamsRow = el('div', 'gm-teams-row');

    var homeEl = el('div', 'gm-team-name home-side', game.homeTeam);
    if (game.type === 'home') homeEl.classList.add('kscw');
    teamsRow.appendChild(homeEl);

    var center = el('div', 'gm-score-center');
    if (game.status === 'completed' && game.score) {
      var isWin = D.isWin(game);
      var homeSpan = el('span', '', String(game.homeScore));
      var awaySpan = el('span', '', String(game.awayScore));
      homeSpan.style.color = game.type === 'home'
        ? (isWin === true ? 'var(--success)' : isWin === false ? 'var(--danger)' : 'var(--text)')
        : 'var(--text-muted)';
      awaySpan.style.color = game.type === 'away'
        ? (isWin === true ? 'var(--success)' : isWin === false ? 'var(--danger)' : 'var(--text)')
        : 'var(--text-muted)';
      center.appendChild(homeSpan);
      center.appendChild(el('span', 'colon', ':'));
      center.appendChild(awaySpan);
    } else {
      center.appendChild(el('span', 'gm-vs', 'vs'));
    }
    teamsRow.appendChild(center);

    var awayEl = el('div', 'gm-team-name', game.awayTeam);
    if (game.type === 'away') awayEl.classList.add('kscw');
    teamsRow.appendChild(awayEl);
    scoreSection.appendChild(teamsRow);

    // Sets breakdown
    if (game.setsJson && game.setsJson.length > 0) {
      var table = el('table', 'gm-sets');
      var thead = el('thead');
      var hrow = el('tr');
      hrow.appendChild(el('th', '', ''));
      for (var si = 0; si < game.setsJson.length; si++) {
        hrow.appendChild(el('th', '', (isDE ? 'Satz ' : 'Set ') + (si + 1)));
      }
      thead.appendChild(hrow);
      table.appendChild(thead);

      var tbody = el('tbody');
      var homeRow = el('tr');
      homeRow.appendChild(el('td', '', isDE ? 'Heim' : 'Home'));
      var awayRow = el('tr');
      awayRow.appendChild(el('td', '', isDE ? 'Ausw.' : 'Away'));
      for (var sj = 0; sj < game.setsJson.length; sj++) {
        var s = game.setsJson[sj];
        var sh = s.home || 0;
        var sa = s.away || 0;
        var kscwWonSet = (sh > sa) === (game.type === 'home');
        homeRow.appendChild(el('td', kscwWonSet ? 'set-won' : 'set-lost', String(sh)));
        awayRow.appendChild(el('td', kscwWonSet ? 'set-won' : 'set-lost', String(sa)));
      }
      tbody.appendChild(homeRow);
      tbody.appendChild(awayRow);
      table.appendChild(tbody);
      scoreSection.appendChild(table);
    }

    modal.appendChild(scoreSection);

    // ── Game Info section
    var info = el('div', 'gm-section');
    info.appendChild(el('div', 'gm-section-title', isDE ? 'Spielinfo' : 'Game Info'));
    info.appendChild(infoRow(isDE ? 'Datum' : 'Date', D.formatDateLong ? D.formatDateLong(game.date) : D.formatDate(game.date)));
    info.appendChild(infoRow(isDE ? 'Anpfiff' : 'Kickoff', game.time || '\u2013'));
    info.appendChild(infoRow(isDE ? 'Typ' : 'Type', game.isHome ? (isDE ? 'Heimspiel' : 'Home') : (isDE ? 'Ausw\u00e4rtsspiel' : 'Away')));
    if (game.id) {
      info.appendChild(infoRow(isDE ? 'Spielnr.' : 'Game #', String(game.id).replace(/^(vb_|bb_)/, '')));
    }
    if (game.season) {
      info.appendChild(infoRow('Saison', game.season));
    }
    modal.appendChild(info);

    // ── Venue section
    if (game.hall && game.hall.name) {
      var venue = el('div', 'gm-section');
      venue.appendChild(el('div', 'gm-section-title', isDE ? 'Spielort' : 'Venue'));
      venue.appendChild(infoRow(isDE ? 'Halle' : 'Hall', game.hall.name));
      var addr = [game.hall.address, game.hall.city].filter(Boolean).join(', ');
      if (addr) {
        venue.appendChild(infoRow(isDE ? 'Adresse' : 'Address', addr));
      }
      if (game.hall.mapsUrl) {
        var mapsLink = el('a', 'gm-link', 'Google Maps \u2197');
        mapsLink.href = game.hall.mapsUrl;
        mapsLink.target = '_blank';
        mapsLink.rel = 'noopener noreferrer';
        venue.appendChild(infoRow(isDE ? 'Karte' : 'Map', mapsLink));
      }
      modal.appendChild(venue);
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
  };
})();
