/**
 * KSCW Scoreboard — Vanilla JS
 *
 * Renders a scoreboard card showing aggregated season stats for KSCW teams.
 * Supports Absolute / Per Game toggle, expandable metric breakdowns, and i18n.
 *
 * Usage: renderScoreboard('container-id', 'all' | 'volleyball' | 'basketball')
 * Requires: data.js loaded first (window.KSCW with rawRankings + teamIdMap available globally)
 */
(function () {
  'use strict';

  // ── i18n labels ────────────────────────────────────────────────────
  var labels = {
    de: {
      title: 'KSCW Scoreboard',
      volleyball: 'Volleyball',
      basketball: 'Basketball',
      metric: 'Metrik',
      total: 'Total',
      avg: 'Schnitt',
      most: 'Meiste',
      absolute: 'Absolut',
      perGame: 'Pro Spiel',
      season: 'Saison',
      teams: 'Teams',
      rank: '#',
      team: 'Team',
      percent: '%',
      unavailable: 'N/A',
      needsTeams: 'Mindestens 2 KSCW-Teams erforderlich.',
      rankingPoints: 'Ranglistenpunkte',
      wins: 'Siege',
      narrowWins: 'Knappe Siege',
      losses: 'Niederlagen',
      narrowLosses: 'Knappe Niederlagen',
      setsWon: 'Sätze gew.',
      setsLost: 'Sätze verl.',
      pointsWon: 'Punkte erzielt',
      pointsLost: 'Punkte erhalten',
    },
    en: {
      title: 'KSCW Scoreboard',
      volleyball: 'Volleyball',
      basketball: 'Basketball',
      metric: 'Metric',
      total: 'Total',
      avg: 'Avg',
      most: 'Most',
      absolute: 'Absolute',
      perGame: 'Per Game',
      season: 'Season',
      teams: 'Teams',
      rank: '#',
      team: 'Team',
      percent: '%',
      unavailable: 'N/A',
      needsTeams: 'Needs at least 2 KSCW teams.',
      rankingPoints: 'Ranking points',
      wins: 'Wins',
      narrowWins: 'Narrow wins',
      losses: 'Losses',
      narrowLosses: 'Narrow losses',
      setsWon: 'Sets won',
      setsLost: 'Sets lost',
      pointsWon: 'Points won',
      pointsLost: 'Points lost',
    },
  };

  function getLang() {
    var path = window.location.pathname;
    if (path.indexOf('/en/') === 0 || path === '/en') return 'en';
    return 'de';
  }

  function t(key) {
    var lang = getLang();
    return (labels[lang] && labels[lang][key]) || labels.de[key] || key;
  }

  // ── Metric definitions ──────────────────────────────────────────────
  var VB_METRICS = [
    { key: 'points', label: 'rankingPoints', get: function (r) { return r.points || 0; } },
    { key: 'won', label: 'wins', get: function (r) { return r.won || 0; } },
    { key: 'wins_narrow', label: 'narrowWins', get: function (r) { return r.wins_narrow; }, optional: true },
    { key: 'lost', label: 'losses', get: function (r) { return r.lost || 0; } },
    { key: 'defeats_narrow', label: 'narrowLosses', get: function (r) { return r.defeats_narrow; }, optional: true },
    { key: 'sets_won', label: 'setsWon', get: function (r) { return r.sets_won || 0; } },
    { key: 'sets_lost', label: 'setsLost', get: function (r) { return r.sets_lost || 0; } },
    { key: 'points_won', label: 'pointsWon', get: function (r) { return r.points_won || 0; } },
    { key: 'points_lost', label: 'pointsLost', get: function (r) { return r.points_lost || 0; } },
  ];

  var BB_METRICS = [
    { key: 'points', label: 'rankingPoints', get: function (r) { return r.points || 0; } },
    { key: 'won', label: 'wins', get: function (r) { return r.won || 0; } },
    { key: 'lost', label: 'losses', get: function (r) { return r.lost || 0; } },
    { key: 'points_won', label: 'pointsWon', get: function (r) { return r.points_won || 0; } },
    { key: 'points_lost', label: 'pointsLost', get: function (r) { return r.points_lost || 0; } },
  ];

  // ── Helpers ─────────────────────────────────────────────────────────
  function formatSwiss(n) {
    if (n >= 1000) {
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    }
    return n.toString();
  }

  function formatVal(v, mode) {
    if (mode === 'perGame') return v.toFixed(1).replace('.', ',');
    return formatSwiss(Math.round(v));
  }

  function computeRanking(rows, getValue, perGame) {
    var best = {};
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var raw = getValue(row);
      if (raw == null) continue;
      var val = perGame ? (row.played > 0 ? raw / row.played : null) : raw;
      if (val == null) continue;
      if (best[row.team_id] === undefined || val > best[row.team_id]) {
        best[row.team_id] = val;
      }
    }
    var arr = [];
    for (var tid in best) {
      arr.push({ teamId: tid, value: best[tid] });
    }
    arr.sort(function (a, b) { return b.value - a.value || a.teamId.localeCompare(b.teamId); });
    return arr;
  }

  function computeTotal(rows, getValue) {
    var sum = 0, count = 0;
    for (var i = 0; i < rows.length; i++) {
      var v = getValue(rows[i]);
      if (v != null) { sum += v; count++; }
    }
    return count > 0 ? sum : null;
  }

  function computePerGameAvg(rows, getValue) {
    var sum = 0, count = 0;
    for (var i = 0; i < rows.length; i++) {
      var v = getValue(rows[i]);
      var p = rows[i].played;
      if (v != null && p > 0) { sum += v / p; count++; }
    }
    return count > 0 ? sum / count : null;
  }

  // ── Create chip element ─────────────────────────────────────────────
  function createChip(teamShort, label) {
    var D = window.KSCW;
    var tc = D ? D.getTeam(teamShort) : null;
    var chip = document.createElement('span');
    chip.className = 'chip';
    if (tc) {
      chip.style.background = tc.bg;
      chip.style.color = tc.text;
      chip.style.border = '1px solid ' + tc.border;
    } else {
      chip.style.background = '#e2e8f0';
      chip.style.color = '#475569';
    }
    chip.textContent = label || teamShort;
    return chip;
  }

  // ── Build a sport section ───────────────────────────────────────────
  function buildSection(sportKey, rows, metrics, container) {
    var state = { mode: 'absolute', expanded: {} };

    var card = document.createElement('div');
    card.className = 'scoreboard-card card';

    // Header
    var header = document.createElement('div');
    header.className = 'scoreboard-header';

    var titleEl = document.createElement('h3');
    titleEl.className = 'scoreboard-sport-title';
    titleEl.textContent = 'KSCW ' + t(sportKey);
    header.appendChild(titleEl);

    var badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = rows.length + ' ' + t('teams');
    header.appendChild(badge);
    card.appendChild(header);

    // Season badge
    if (rows.length > 0 && rows[0].season) {
      var seasonBadge = document.createElement('div');
      seasonBadge.className = 'scoreboard-season';
      var sb = document.createElement('span');
      sb.className = 'badge';
      sb.textContent = t('season') + ' ' + rows[0].season;
      seasonBadge.appendChild(sb);
      card.appendChild(seasonBadge);
    }

    if (rows.length < 2) {
      var msg = document.createElement('p');
      msg.className = 'scoreboard-empty';
      msg.textContent = t('needsTeams');
      card.appendChild(msg);
      container.appendChild(card);
      return;
    }

    // Toggle
    var toggleWrap = document.createElement('div');
    toggleWrap.className = 'scoreboard-toggle';

    var btnAbs = document.createElement('button');
    btnAbs.type = 'button';
    btnAbs.className = 'sport-tab active';
    btnAbs.textContent = t('absolute');

    var btnPg = document.createElement('button');
    btnPg.type = 'button';
    btnPg.className = 'sport-tab';
    btnPg.textContent = t('perGame');

    toggleWrap.appendChild(btnAbs);
    toggleWrap.appendChild(btnPg);
    card.appendChild(toggleWrap);

    // Table container
    var tableWrap = document.createElement('div');
    tableWrap.className = 'scoreboard-table-wrap';
    card.appendChild(tableWrap);

    function renderTable() {
      // Clear existing content safely
      while (tableWrap.firstChild) tableWrap.removeChild(tableWrap.firstChild);
      var isPerGame = state.mode === 'perGame';

      var table = document.createElement('table');
      table.className = 'scoreboard-table';

      // Thead
      var thead = document.createElement('thead');
      var thr = document.createElement('tr');
      var th1 = document.createElement('th'); th1.textContent = t('metric'); th1.className = 'sb-col-metric';
      var th2 = document.createElement('th'); th2.textContent = isPerGame ? t('avg') : t('total'); th2.className = 'sb-col-total';
      var th3 = document.createElement('th'); th3.textContent = t('most'); th3.className = 'sb-col-most';
      thr.appendChild(th1); thr.appendChild(th2); thr.appendChild(th3);
      thead.appendChild(thr);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');

      for (var mi = 0; mi < metrics.length; mi++) {
        var m = metrics[mi];
        var ranking = computeRanking(rows, m.get, isPerGame);
        if (m.optional && ranking.length === 0) continue;

        var totalVal = isPerGame ? computePerGameAvg(rows, m.get) : computeTotal(rows, m.get);
        var topVal = ranking.length > 0 ? ranking[0].value : null;
        var topTeams = topVal === null ? [] : ranking.filter(function (e) { return e.value === topVal; });
        var pct = !isPerGame && topVal !== null && totalVal !== null && totalVal > 0
          ? Math.round((topVal / totalVal) * 100) : null;

        var rowKey = sportKey + ':' + m.key;
        var isExpanded = !!state.expanded[rowKey];

        // Main row
        var tr = document.createElement('tr');
        tr.className = 'scoreboard-metric-row';
        tr.setAttribute('data-key', rowKey);

        var td1 = document.createElement('td');
        td1.className = 'sb-col-metric';
        var expandIcon = document.createElement('span');
        expandIcon.className = 'sb-expand-icon';
        expandIcon.textContent = isExpanded ? '\u25BE' : '\u25B8';
        td1.appendChild(expandIcon);
        td1.appendChild(document.createTextNode(' ' + t(m.label)));

        var td2 = document.createElement('td');
        td2.className = 'sb-col-total';
        td2.textContent = totalVal === null ? t('unavailable') : formatVal(totalVal, state.mode);

        var td3 = document.createElement('td');
        td3.className = 'sb-col-most';
        if (topVal === null || topTeams.length === 0) {
          td3.textContent = t('unavailable');
        } else {
          for (var ti = 0; ti < topTeams.length; ti++) {
            var shortName = teamIdMap[topTeams[ti].teamId] || topTeams[ti].teamId;
            var chipLabel = pct !== null
              ? shortName + ' - ' + formatVal(topVal, state.mode) + ' (' + pct + '%)'
              : shortName + ' - ' + formatVal(topVal, state.mode);
            td3.appendChild(createChip(shortName, chipLabel));
            if (ti < topTeams.length - 1) td3.appendChild(document.createTextNode(' '));
          }
        }

        tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
        tbody.appendChild(tr);

        // Click handler
        (function (rk) {
          tr.addEventListener('click', function () {
            state.expanded[rk] = !state.expanded[rk];
            renderTable();
          });
        })(rowKey);

        // Expanded breakdown
        if (isExpanded && ranking.length > 0 && totalVal !== null) {
          var expTr = document.createElement('tr');
          var expTd = document.createElement('td');
          expTd.setAttribute('colspan', '3');
          expTd.className = 'scoreboard-expand-cell';

          var subTable = document.createElement('table');
          subTable.className = 'scoreboard-sub-table';
          var subThead = document.createElement('thead');
          var subThr = document.createElement('tr');
          var sth1 = document.createElement('th'); sth1.textContent = t('rank');
          var sth2 = document.createElement('th'); sth2.textContent = t('team');
          var sth3 = document.createElement('th'); sth3.textContent = t(m.label);
          var sth4 = document.createElement('th'); sth4.textContent = t('percent');
          subThr.appendChild(sth1); subThr.appendChild(sth2); subThr.appendChild(sth3); subThr.appendChild(sth4);
          subThead.appendChild(subThr);
          subTable.appendChild(subThead);

          var subTbody = document.createElement('tbody');
          for (var ri = 0; ri < ranking.length; ri++) {
            var entry = ranking[ri];
            var short = teamIdMap[entry.teamId] || entry.teamId;
            var prev = ri > 0 ? ranking[ri - 1] : null;
            var rank = prev && prev.value === entry.value ? ri : ri + 1;
            var rowPct = !isPerGame && totalVal > 0 ? Math.round((entry.value / totalVal) * 100) : null;

            var subTr = document.createElement('tr');
            var std1 = document.createElement('td'); std1.textContent = '#' + rank;
            var std2 = document.createElement('td'); std2.appendChild(createChip(short, short));
            var std3 = document.createElement('td'); std3.textContent = formatVal(entry.value, state.mode);
            var std4 = document.createElement('td'); std4.textContent = rowPct !== null ? rowPct + '%' : '\u2013';
            subTr.appendChild(std1); subTr.appendChild(std2); subTr.appendChild(std3); subTr.appendChild(std4);
            subTbody.appendChild(subTr);
          }
          subTable.appendChild(subTbody);
          expTd.appendChild(subTable);
          expTr.appendChild(expTd);
          tbody.appendChild(expTr);
        }
      }

      table.appendChild(tbody);
      tableWrap.appendChild(table);
    }

    // Toggle handlers
    btnAbs.addEventListener('click', function () {
      state.mode = 'absolute';
      btnAbs.classList.add('active');
      btnPg.classList.remove('active');
      renderTable();
    });
    btnPg.addEventListener('click', function () {
      state.mode = 'perGame';
      btnPg.classList.add('active');
      btnAbs.classList.remove('active');
      renderTable();
    });

    renderTable();
    container.appendChild(card);
  }

  // ── Main render function ────────────────────────────────────────────
  window.renderScoreboard = function (containerId, sportFilter) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var D = window.KSCW;
    if (!D || !D.rawRankings) return;

    var rankings = D.rawRankings;

    var sports = sportFilter === 'all' ? ['volleyball', 'basketball']
      : sportFilter === 'volleyball' ? ['volleyball']
      : ['basketball'];

    // Grid wrapper for side-by-side when showing both
    var grid = document.createElement('div');
    grid.className = sports.length > 1 ? 'scoreboard-grid' : '';

    for (var si = 0; si < sports.length; si++) {
      var sport = sports[si];
      var prefix = sport === 'volleyball' ? 'vb_' : 'bb_';
      var metrics = sport === 'volleyball' ? VB_METRICS : BB_METRICS;

      // Filter to KSCW teams for this sport
      var sportRows = rankings.filter(function (r) {
        return r.team_id && r.team_id.indexOf(prefix) === 0 && !!teamIdMap[r.team_id];
      });

      // Find latest season
      var seasons = sportRows.map(function (r) { return r.season; }).filter(Boolean);
      seasons.sort(function (a, b) { return b.localeCompare(a); });
      var latestSeason = seasons[0] || null;
      var seasonRows = latestSeason
        ? sportRows.filter(function (r) { return r.season === latestSeason; })
        : sportRows;

      buildSection(sport, seasonRows, metrics, grid);
    }

    container.appendChild(grid);
  };

  // ── Auto-render on data ready ───────────────────────────────────────
  function autoRender() {
    // Render all scoreboard containers on the page
    var containers = document.querySelectorAll('[data-scoreboard]');
    for (var i = 0; i < containers.length; i++) {
      var el = containers[i];
      if (el.children.length > 0) continue; // already rendered
      var filter = el.getAttribute('data-scoreboard') || 'all';
      window.renderScoreboard(el.id, filter);
    }
  }

  if (window.KSCW && window.KSCW.ready) {
    autoRender();
  } else {
    document.addEventListener('kscw-data-ready', autoRender);
  }
})();
