/**
 * KSCW Team Page — Dynamic Data Loader
 *
 * Fetches roster, trainings, coach/captain from the Directus custom endpoint
 * and populates the team page sections.
 *
 * Usage: set window.TEAM_CONFIG = { short: 'H1', directusId: '1' }
 */
(function () {
  'use strict';

  var CFG = window.TEAM_CONFIG;
  if (!CFG || (!CFG.short && !CFG.directusId)) return;

  var DIRECTUS_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://directus-dev.kscw.ch' : 'https://directus.kscw.ch';
  var TEAM = CFG.short || '';
  var TEAM_DIRECTUS_ID = CFG.directusId;
  var IS_WOMEN = false; // set after team data loads

  function getPosLabel(key) {
    var map = {
      setter: 'posSetter', opposite: 'posOpposite',
      outside_hitter: 'posOutsideHitter', outside: 'posOutsideHitter',
      middle_blocker: 'posMiddleBlocker', middle: 'posMiddleBlocker',
      libero: 'posLibero',
      point_guard: 'posPointGuard', shooting_guard: 'posShootingGuard',
      small_forward: 'posSmallForward', power_forward: 'posPowerForward', center: 'posCenter'
    };
    // Feminine forms for women's teams
    var femMap = { setter: 'posSetterF' };
    var i18nKey = (IS_WOMEN && femMap[key]) ? femMap[key] : (map[key] || 'posPlayer');
    return i18n.t(i18nKey);
  }

  function positionText(positions) {
    if (!positions || !positions.length) return '';
    var filtered = positions.filter(function (p) { return p !== 'other'; });
    if (!filtered.length) return '';
    return filtered.map(function (p) { return getPosLabel(p); }).join(', ');
  }

  function esc(s) { var d = document.createElement('span'); d.textContent = s; return d.innerHTML; }

  function hideSection(tabId) {
    var btn = document.querySelector('[data-tab="' + tabId + '"]');
    if (btn) btn.style.display = 'none';
    var panel = document.querySelector('[data-tab-panel="' + tabId + '"]');
    if (panel) panel.style.display = 'none';
  }

  // ── Render hero section dynamically ──────────────────────────────
  function renderHero(teamData) {
    var container = document.getElementById('team-hero-container');
    if (!container) return;

    // Always use KSCW brand blue for team hero
    var color = 'var(--kscw-blue)';

    var section = document.createElement('section');
    section.className = 'team-hero';
    section.style.setProperty('--team-color', color);

    var inner = document.createElement('div');
    inner.className = 'container';

    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = color;
    chip.style.color = '#fff';
    chip.style.marginBottom = '0.75rem';
    chip.style.display = 'inline-block';
    chip.textContent = TEAM;
    inner.appendChild(chip);

    var h1 = document.createElement('h1');
    h1.textContent = teamData.full_name || teamData.name || TEAM;
    inner.appendChild(h1);

    var league = document.createElement('p');
    league.className = 'team-league';
    league.textContent = (teamData.league || '') + (teamData.season ? ' — ' + i18n.t('teamSeason') + ' ' + teamData.season : '');
    inner.appendChild(league);

    section.appendChild(inner);
    container.appendChild(section);
  }

  // ── Render team photo ──────────────────────────────────────────────
  function renderTeamPhoto(teamData) {
    if (document.querySelector('.team-photo')) return;
    if (!teamData.team_picture) return;

    var url = DIRECTUS_URL + '/assets/' + teamData.team_picture + '?width=1280&quality=80';

    function createPhotoEl() {
      var wrapper = document.createElement('div');
      wrapper.className = 'team-photo-wrapper';
      var img = document.createElement('img');
      img.src = url;
      img.alt = i18n.t('teamPhoto') + ' ' + esc(teamData.name || TEAM);
      img.className = 'team-photo';
      img.loading = 'lazy';
      wrapper.appendChild(img);
      return wrapper;
    }

    var container = document.getElementById('team-photo-container');
    if (!container) {
      // Fallback: insert after hero
      container = document.querySelector('.team-hero');
      if (!container) return;
      container.parentNode.insertBefore(createPhotoEl(), container.nextSibling);
      return;
    }
    container.appendChild(createPhotoEl());
  }

  // ── Render CTA section ─────────────────────────────────────────────
  function renderCTA(teamData) {
    var container = document.getElementById('cta-container');
    if (!container) return;

    var section = document.createElement('section');
    section.className = 'cta-section';

    var inner = document.createElement('div');
    inner.className = 'container';

    var h2 = document.createElement('h2');
    h2.textContent = i18n.t('teamCTA', { team: teamData.name || TEAM });
    inner.appendChild(h2);

    var p = document.createElement('p');
    p.textContent = i18n.t('teamCTAText');
    inner.appendChild(p);

    var btn = document.createElement('a');
    btn.href = '/club/kontakt.html';
    btn.className = 'btn btn-gold';
    btn.textContent = i18n.t('teamCTAButton');
    inner.appendChild(btn);

    section.appendChild(inner);
    container.appendChild(section);
  }

  // ── Render Instagram Embed ─────────────────────────────────────────
  function renderInstagramEmbed(teamData) {
    var container = document.getElementById('instagram-embed-container');
    var embedEl = document.getElementById('instagram-embed');
    if (!container || !embedEl) return;

    var url = teamData.social_url || '';
    if (!url || url.indexOf('instagram.com/') === -1) return;

    // Extract handle from URL like https://www.instagram.com/kscw_h1/
    var match = url.match(/instagram\.com\/([^/?]+)/);
    if (!match) return;
    var handle = match[1];

    container.style.display = '';

    // Update heading
    var heading = document.getElementById('instagram-heading');
    if (heading) heading.textContent = '@' + handle;

    // Build oEmbed-based embed using Instagram's blockquote + embed.js
    var blockquote = document.createElement('blockquote');
    blockquote.className = 'instagram-media';
    blockquote.setAttribute('data-instgrm-permalink', 'https://www.instagram.com/' + handle + '/');
    blockquote.setAttribute('data-instgrm-captioned', '');
    blockquote.style.cssText = 'background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin:0 auto; max-width:540px; min-width:326px; padding:0; width:calc(100% - 2px);';

    var fallback = document.createElement('a');
    fallback.href = 'https://www.instagram.com/' + handle + '/';
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
    fallback.textContent = i18n.t('teamInstagramFollow', { handle: '@' + handle }) || '@' + handle + ' auf Instagram';
    fallback.style.cssText = 'display:block; padding:2rem; text-align:center; color:var(--kscw-blue); font-weight:600;';
    blockquote.appendChild(fallback);

    embedEl.textContent = '';
    embedEl.appendChild(blockquote);

    // Load Instagram embed.js (idempotent — checks for existing script)
    if (!document.getElementById('instagram-embed-js')) {
      var script = document.createElement('script');
      script.id = 'instagram-embed-js';
      script.async = true;
      script.src = 'https://www.instagram.com/embed.js';
      document.body.appendChild(script);
    } else if (window.instgrm && window.instgrm.Embeds) {
      window.instgrm.Embeds.process();
    }
  }

  // ── Fetch team data from public API ───────────────────────────────
  function fetchTeamData() {
    if (!TEAM_DIRECTUS_ID) { hideSection('kader'); hideSection('training'); return; }

    fetch(DIRECTUS_URL + '/kscw/public/team/' + TEAM_DIRECTUS_ID)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (resp) {
        // Directus wraps response in { data: { ...team fields, roster, coaches, ... } }
        var raw = resp.data || resp;
        var teamData = {
          id: raw.id,
          name: raw.name,
          full_name: raw.full_name,
          team_id: raw.team_id,
          sport: raw.sport,
          league: raw.league,
          season: raw.season,
          color: raw.color,
          active: raw.active,
          team_picture: raw.team_picture,
          team_picture_pos: raw.team_picture_pos,
          social_url: raw.social_url
        };

        // Detect women's team for gendered translations
        var name = (teamData.name || '').toLowerCase();
        var league = (teamData.league || '').toLowerCase();
        IS_WOMEN = /^d\d|^du\d|damen|frauen/.test(name) || /damen|frauen/.test(league);

        // Derive TEAM short name from API if not set
        if (!TEAM && teamData.name) {
          TEAM = teamData.name;
          CFG.short = TEAM;
        }

        // Update page title
        document.title = (teamData.full_name || teamData.name || 'Team') + ' — KSC Wiedikon';

        // Render hero, photo, Instagram, CTA
        renderHero(teamData);
        renderTeamPhoto(teamData);
        renderInstagramEmbed(teamData);
        renderCTA(teamData);

        // Map Directus field names to expected names
        var roster = raw.roster || [];
        var coaches = raw.coaches || [];
        var captains = raw.captains || [];
        var trainings = raw.upcoming_trainings || raw.trainings || [];
        var rawUpcoming = raw.upcoming_games || raw.upcoming || [];
        var rawResults = raw.results || [];
        var rankings = raw.rankings || [];
        var sponsors = raw.sponsors || [];

        // Map raw game objects to the format buildGameRow expects
        function mapGame(g) {
          var score = (g.home_score != null && g.away_score != null)
            ? g.home_score + ':' + g.away_score : (g.score || null);
          var isHome = g.isHome != null ? g.isHome : g.type === 'home';
          return {
            game_id: g.game_id || g.id,
            date: g.date,
            time: g.time || '',
            home_team: g.home_team,
            away_team: g.away_team,
            score: score,
            isHome: isHome,
            league: g.league || teamData.league || '',
            season: g.season || teamData.season || '',
            hall: g.hall || null,
            sets_json: g.sets_json || null,
            sport: g.sport || teamData.sport || 'volleyball',
            status: g.status || (score ? 'completed' : 'scheduled'),
            referees: g.referees || null,
            scorer_team: g.scorer_team || null,
            bb_officials: g.bb_officials || null
          };
        }
        var upcoming = rawUpcoming.map(mapGame);
        var results = rawResults.map(mapGame);

        // Add sport field to rankings for frontend rendering
        for (var ri = 0; ri < rankings.length; ri++) {
          if (!rankings[ri].sport) rankings[ri].sport = teamData.sport || 'volleyball';
        }

        // Render tab content
        renderRoster(roster, coaches, captains);
        initRosterViewToggle();
        renderTrainings(trainings);
        renderHookGames(upcoming, results, teamData);
        renderHookRankings(rankings, teamData);
        renderSponsors(sponsors);

        // Update static tab labels and headings with i18n
        updateStaticLabels();
      })
      .catch(function () { hideSection('kader'); hideSection('training'); });
  }

  // ── Update static HTML labels with i18n ───────────────────────────
  function updateStaticLabels() {
    // Tab labels
    var tabMap = {
      kader: 'teamTabRoster',
      spiele: 'teamTabGames',
      rangliste: 'teamTabRankings',
      training: 'teamTabTraining',
      sponsoren: 'teamTabSponsors'
    };
    var keys = Object.keys(tabMap);
    for (var i = 0; i < keys.length; i++) {
      var btn = document.querySelector('[data-tab="' + keys[i] + '"]');
      if (btn) btn.textContent = i18n.t(tabMap[keys[i]]);
    }

    // Section headings in the spiele tab
    var upcomingH2 = document.querySelector('#upcoming-section h2');
    if (upcomingH2) upcomingH2.textContent = i18n.t('teamUpcoming');
    var resultsH2 = document.querySelector('#results-section h2');
    if (resultsH2) resultsH2.textContent = i18n.t('teamResults');
  }

  // ── Roster View Toggle ───────────────────────────────────────────
  function initRosterViewToggle() {
    var toggle = document.getElementById('roster-view-toggle');
    if (!toggle) return;
    var gridBtn = toggle.querySelector('[data-view="grid"]');
    var listBtn = toggle.querySelector('[data-view="list"]');
    var rosterEl = document.getElementById('roster-grid');
    if (!gridBtn || !listBtn || !rosterEl) return;

    var saved = null;
    try { saved = localStorage.getItem('kscw-roster-view'); } catch (e) {}
    if (saved === 'list') {
      rosterEl.classList.add('roster-list');
      gridBtn.classList.remove('active');
      listBtn.classList.add('active');
    }

    function setView(mode) {
      var coachEl = document.getElementById('coach-grid');
      if (mode === 'list') {
        rosterEl.classList.add('roster-list');
        if (coachEl) coachEl.classList.add('roster-list');
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
      } else {
        rosterEl.classList.remove('roster-list');
        if (coachEl) coachEl.classList.remove('roster-list');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
      }
      try { localStorage.setItem('kscw-roster-view', mode); } catch (e) {}
    }
    gridBtn.addEventListener('click', function () { setView('grid'); });
    listBtn.addEventListener('click', function () { setView('list'); });
  }

  // ── Render Sponsors ─────────────────────────────────────────────
  function renderSponsors(sponsors) {
    var el = document.getElementById('team-sponsors-grid');
    if (!el) return;
    if (!sponsors.length) { hideSection('sponsoren'); return; }

    var frag = document.createDocumentFragment();
    for (var i = 0; i < sponsors.length; i++) {
      var sp = sponsors[i];
      var card = document.createElement('div');
      card.className = 'sponsor-page-card';

      var wrapper = card;
      if (sp.website_url) {
        var link = document.createElement('a');
        link.href = sp.website_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'sponsor-page-card';
        wrapper = link;
        card = link;
      }

      var logoRef = sp.logo_url || sp.logo;
      if (logoRef) {
        var img = document.createElement('img');
        img.src = logoRef.indexOf('http') === 0 ? logoRef : DIRECTUS_URL + '/assets/' + logoRef + '?width=200&quality=80';
        img.alt = sp.name;
        img.className = 'sponsor-logo';
        img.loading = 'lazy';
        wrapper.appendChild(img);
      }

      if (sp.name) {
        var nameEl = document.createElement('div');
        nameEl.className = 'sponsor-name';
        nameEl.textContent = sp.name;
        wrapper.appendChild(nameEl);
      }

      frag.appendChild(card);
    }

    el.textContent = '';
    el.appendChild(frag);
  }

  // ── Render Roster ─────────────────────────────────────────────────
  function renderRoster(roster, coach, captain) {
    var el = document.getElementById('roster-grid');
    if (!el) return;
    if (!roster.length) { hideSection('kader'); return; }

    roster.sort(function (a, b) {
      if (a.guest_level !== b.guest_level) return a.guest_level - b.guest_level;
      return (a.last_name || '').localeCompare(b.last_name || '');
    });

    // Build captain lookup by full name
    var captainNames = {};
    for (var ci = 0; ci < captain.length; ci++) {
      captainNames[captain[ci].first_name + ' ' + captain[ci].last_name] = true;
    }

    var frag = document.createDocumentFragment();
    for (var i = 0; i < roster.length; i++) {
      var m = roster[i];
      if (m.guest_level > 0) continue;

      var isCaptain = captainNames[m.first_name + ' ' + m.last_name] === true;
      var card = document.createElement('div');
      card.className = 'roster-card' + (isCaptain ? ' captain-card' : '');

      var photoId = m.photo_url || m.photo;
      if (photoId && m.website_visible !== false) {
        var img = document.createElement('img');
        img.src = photoId.indexOf('http') === 0 ? photoId : DIRECTUS_URL + '/assets/' + photoId + '?width=200&quality=80';
        img.alt = '';
        img.className = 'roster-avatar';
        img.style.objectFit = 'cover';
        img.loading = 'lazy';
        card.appendChild(img);
      } else {
        var av = document.createElement('img');
        av.className = 'roster-avatar';
        av.src = '/images/kscw_weiss.png';
        av.alt = '';
        av.loading = 'lazy';
        card.appendChild(av);
      }

      var info = document.createElement('div');
      var nameEl = document.createElement('div');
      nameEl.className = 'roster-name';
      nameEl.textContent = m.first_name + ' ' + m.last_name;
      info.appendChild(nameEl);

      var posText = positionText(m.position);
      var numText = m.number ? ' · #' + m.number : '';
      var subtitle = posText + numText;
      if (subtitle) {
        var posEl = document.createElement('div');
        posEl.className = 'roster-position';
        posEl.textContent = subtitle;
        info.appendChild(posEl);
      }

      card.appendChild(info);

      if (isCaptain) {
        var badge = document.createElement('div');
        badge.className = 'captain-badge';
        badge.textContent = 'K';
        badge.title = i18n.t(IS_WOMEN ? 'teamCaptainF' : 'teamCaptain');
        card.appendChild(badge);
      }

      frag.appendChild(card);
    }

    el.textContent = '';
    el.appendChild(frag);

    var metaEl = document.getElementById('roster-meta');
    if (metaEl) {
      metaEl.textContent = '';

      // Coach cards
      if (coach.length) {
        var label = document.createElement('p');
        label.style.fontWeight = '600';
        label.style.fontSize = 'var(--text-sm)';
        label.style.color = 'var(--text-secondary)';
        label.textContent = i18n.t('teamCoach') + ':';
        metaEl.appendChild(label);

        var coachGrid = document.createElement('div');
        var isListMode = false;
        try { isListMode = localStorage.getItem('kscw-roster-view') === 'list'; } catch (e) {}
        coachGrid.className = 'roster-grid' + (isListMode ? ' roster-list' : '');
        coachGrid.id = 'coach-grid';
        coachGrid.style.marginTop = 'var(--space-sm)';

        for (var ci = 0; ci < coach.length; ci++) {
          var c = coach[ci];
          var cCard = document.createElement('div');
          cCard.className = 'roster-card';

          var cPhotoId = c.photo_url || c.photo;
          if (cPhotoId) {
            var cImg = document.createElement('img');
            cImg.src = cPhotoId.indexOf('http') === 0 ? cPhotoId : DIRECTUS_URL + '/assets/' + cPhotoId + '?width=200&quality=80';
            cImg.alt = '';
            cImg.className = 'roster-avatar';
            cImg.style.objectFit = 'cover';
            cImg.loading = 'lazy';
            cCard.appendChild(cImg);
          } else {
            var cAv = document.createElement('img');
            cAv.className = 'roster-avatar';
            cAv.src = '/images/kscw_weiss.png';
            cAv.alt = '';
            cAv.loading = 'lazy';
            cCard.appendChild(cAv);
          }

          var cInfo = document.createElement('div');
          var cName = document.createElement('div');
          cName.className = 'roster-name';
          cName.textContent = c.first_name + ' ' + c.last_name;
          cInfo.appendChild(cName);
          cCard.appendChild(cInfo);
          coachGrid.appendChild(cCard);
        }

        metaEl.appendChild(coachGrid);
      }
    }
  }

  // ── Render Trainings ──────────────────────────────────────────────
  function renderTrainings(trainings) {
    var el = document.getElementById('training-list');
    if (!el) return;
    if (!trainings.length) { hideSection('training'); return; }

    // Filter out cancelled and past trainings
    var today = new Date().toISOString().slice(0, 10);
    trainings = trainings.filter(function (t) {
      if (t.cancelled) return false;
      // Filter by valid_from/valid_until if present (hall_slots)
      if (t.valid_from && today < t.valid_from.slice(0, 10)) return false;
      if (t.valid_until && today > t.valid_until.slice(0, 10)) return false;
      // Filter past individual training dates
      if (t.date && t.date.slice(0, 10) < today) return false;
      return true;
    });
    if (!trainings.length) { hideSection('training'); return; }

    // Deduplicate into weekly summary (group by day + time + hall)
    var dayNames = { de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
    var dayOrder = { So: 0, Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var seen = {};
    var weekly = [];
    for (var i = 0; i < trainings.length; i++) {
      var t = trainings[i];
      var dayLabel = t.day || '';
      if (!dayLabel && t.date) {
        var lang = (i18n.getLang && i18n.getLang()) || 'de';
        var names = dayNames[lang] || dayNames.de;
        var dateObj = new Date(t.date);
        dayLabel = names[dateObj.getUTCDay()];
      }
      var startTime = (t.start_time || '').slice(0, 5);
      var endTime = (t.end_time || '').slice(0, 5);
      var hallName = t.hall_name || '';
      var key = dayLabel + '|' + startTime + '|' + endTime + '|' + hallName;
      if (!seen[key]) {
        seen[key] = true;
        weekly.push({ day: dayLabel, start: startTime, end: endTime, hall: hallName, address: t.hall_address || '' });
      }
    }
    // Sort by day of week
    weekly.sort(function (a, b) { return (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0); });

    var frag = document.createDocumentFragment();
    for (var j = 0; j < weekly.length; j++) {
      var w = weekly[j];
      var row = document.createElement('div');
      row.className = 'training-item';

      var dayEl = document.createElement('span');
      dayEl.className = 'training-day';
      dayEl.textContent = w.day + ' ' + w.start + '–' + w.end;
      row.appendChild(dayEl);

      var hallEl = document.createElement('span');
      hallEl.className = 'training-hall';
      hallEl.textContent = w.hall + (w.address ? ' · ' + w.address : '');
      row.appendChild(hallEl);

      frag.appendChild(row);
    }

    el.textContent = '';
    el.appendChild(frag);
  }

  // ── Game table helpers (matches homepage format) ────────────────────

  function makeCell(content, className) {
    var td = document.createElement('td');
    if (className) td.className = className;
    if (typeof content === 'string') td.textContent = content;
    else if (content) td.appendChild(content);
    return td;
  }

  function createChip(teamShort) {
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = '#6b7280'; chip.style.color = '#fff'; chip.textContent = teamShort;
    return chip;
  }

  /** Map hook game data to the modal-compatible format */
  function toModalGame(g, teamData) {
    var scoreParts = g.score ? g.score.split(':') : [];
    var homeScore = scoreParts.length === 2 ? parseInt(scoreParts[0], 10) : 0;
    var awayScore = scoreParts.length === 2 ? parseInt(scoreParts[1], 10) : 0;
    return {
      teamShort: TEAM,
      sport: g.sport || 'volleyball',
      date: g.date,
      time: g.time || '',
      homeTeam: g.home_team,
      awayTeam: g.away_team,
      isHome: g.isHome,
      type: g.isHome ? 'home' : 'away',
      score: g.score || null,
      homeScore: homeScore,
      awayScore: awayScore,
      status: g.score ? 'completed' : 'scheduled',
      league: g.league || (teamData && teamData.league) || '',
      season: g.season || (teamData && teamData.season) || '',
      id: g.game_id || '',
      hall: g.hall || null,
      setsJson: g.sets_json || null,
      referees: g.referees || null,
      scorerTeam: g.scorer_team || null,
      bbOfficials: g.bb_officials || null,
      opponent: g.isHome ? g.away_team : g.home_team
    };
  }

  function formatDateLocal(iso) {
    if (!iso) return '\u2013';
    try {
      var d = new Date(iso + 'T12:00:00');
      return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return '\u2013'; }
  }

  function buildGameRow(g, showScore, teamData) {
    var tr = document.createElement('tr');
    var modalGame = toModalGame(g, teamData);
    tr._gameData = modalGame;

    // Date
    tr.appendChild(makeCell(formatDateLocal(g.date), 'gt-date'));

    // Time
    tr.appendChild(makeCell(g.time || '', 'gt-time'));

    // Home/Away badge
    var badge = document.createElement('span');
    badge.className = 'game-badge ' + (g.isHome ? 'home' : 'away');
    badge.textContent = g.isHome ? i18n.t('teamBadgeHome') : i18n.t('teamBadgeAway');
    tr.appendChild(makeCell(badge, 'gt-loc'));

    // Matchup
    var matchup = g.isHome
      ? ('KSCW vs ' + (g.away_team || ''))
      : ((g.home_team || '') + ' vs KSCW');
    tr.appendChild(makeCell(matchup, 'gt-matchup'));

    // Score or empty
    if (showScore && g.score) {
      var scoreSpan = document.createElement('span');
      scoreSpan.className = 'game-score';
      var scoreParts = g.score.split(':');
      var homeS = parseInt(scoreParts[0], 10);
      var awayS = parseInt(scoreParts[1], 10);
      var win = g.isHome ? homeS > awayS : awayS > homeS;
      var loss = g.isHome ? homeS < awayS : awayS < homeS;
      if (win) scoreSpan.className += ' win';
      else if (loss) scoreSpan.className += ' loss';
      scoreSpan.textContent = g.score;
      tr.appendChild(makeCell(scoreSpan, 'gt-score'));
    } else {
      tr.appendChild(makeCell('', 'gt-score'));
    }

    return tr;
  }

  function renderGameTable(containerId, games, showScore, teamData) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = '';

    if (!games.length) {
      var p = document.createElement('p');
      p.className = 'text-muted text-sm';
      p.textContent = showScore ? i18n.t('teamNoResults') : i18n.t('teamNoGames');
      container.appendChild(p);
      return;
    }

    var table = document.createElement('table');
    table.className = 'game-table';
    var tbody = document.createElement('tbody');
    for (var i = 0; i < games.length; i++) {
      tbody.appendChild(buildGameRow(games[i], showScore, teamData));
    }
    table.appendChild(tbody);
    container.appendChild(table);

    // Click → modal
    table.addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (tr && tr._gameData && window.showGameModal) {
        var locale = (i18n.getLang && i18n.getLang()) || 'de';
        window.showGameModal(tr._gameData, locale);
      }
    });
  }

  // ── Render Games from hook response ─────────────────────────────────
  function renderHookGames(upcoming, results, teamData) {
    var upcomingSection = document.getElementById('upcoming-section');
    var resultsSection = document.getElementById('results-section');

    if (upcoming.length) {
      if (upcomingSection) upcomingSection.style.display = '';
      renderGameTable('upcoming-games', upcoming, false, teamData);
    } else {
      if (upcomingSection) upcomingSection.style.display = 'none';
    }

    if (results.length) {
      if (resultsSection) resultsSection.style.display = '';
      renderGameTable('recent-results', results, true, teamData);
    } else {
      if (resultsSection) resultsSection.style.display = 'none';
    }
  }

  // ── Render Rankings from hook response ─────────────────────────────
  function renderHookRankings(rankings, teamInfo) {
    var rankEl = document.getElementById('rankings-table');
    if (!rankEl) return;
    rankEl.textContent = '';

    if (!rankings.length) {
      var p = document.createElement('p');
      p.className = 'text-muted text-sm';
      p.textContent = i18n.t('teamNoRankings');
      rankEl.appendChild(p);
      return;
    }

    var h2 = document.createElement('h2');
    h2.style.fontSize = 'var(--text-2xl)';
    h2.style.marginBottom = 'var(--space-lg)';
    h2.textContent = teamInfo.league || i18n.t('rankingRankings');
    rankEl.appendChild(h2);

    // Detect sport from first ranking entry
    var isVB = rankings.length > 0 && rankings[0].sport === 'volleyball';

    var wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    var table = document.createElement('table');

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    var headers = ['#', i18n.t('rankingPoints'), i18n.t('rankingTeam'), i18n.t('rankingPlayed'), i18n.t('rankingWon'), i18n.t('rankingLost')];
    if (isVB) headers.push(i18n.t('rankingSets'));
    headers.forEach(function (t) {
      var th = document.createElement('th'); th.textContent = t; headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var myTeamId = teamInfo.team_id || '';
    var totalTeams = rankings.length;
    var tbody = document.createElement('tbody');
    for (var j = 0; j < rankings.length; j++) {
      var rw = rankings[j];
      var tr = document.createElement('tr');
      if (rw.team_id === myTeamId) tr.className = 'table-highlight';

      // Promotion/relegation color band (volleyball only)
      var promoColor = isVB ? getPromotionColor(teamInfo.league || '', rw.rank, totalTeams, rw.team_name || rw.team) : null;
      if (promoColor) {
        tr.style.borderLeft = '4px solid ' + promoColor;
      }

      // Rank
      var tdRank = document.createElement('td');
      tdRank.className = 'table-rank';
      tdRank.textContent = rw.rank != null ? rw.rank : '-';
      tr.appendChild(tdRank);

      // Points (bold)
      var tdPts = document.createElement('td');
      var strong = document.createElement('strong');
      strong.textContent = rw.points != null ? rw.points : '-';
      tdPts.appendChild(strong);
      tr.appendChild(tdPts);

      // Team name (ellipsis on overflow)
      var tdTeam = document.createElement('td');
      tdTeam.className = 'table-team';
      tdTeam.style.maxWidth = '180px';
      tdTeam.style.overflow = 'hidden';
      tdTeam.style.textOverflow = 'ellipsis';
      tdTeam.textContent = rw.team_name || rw.team || '?';
      tr.appendChild(tdTeam);

      // Played
      var tdSp = document.createElement('td');
      tdSp.textContent = rw.played != null ? rw.played : '-';
      tr.appendChild(tdSp);

      // Wins — with clear/narrow split for VB
      var tdW = document.createElement('td');
      if (isVB && (rw.wins_clear || rw.wins_narrow)) {
        tdW.textContent = (rw.won || 0);
        var wSub = document.createElement('span');
        wSub.style.fontSize = 'var(--text-xs)';
        wSub.style.color = 'var(--text-muted)';
        wSub.style.display = 'block';
        wSub.textContent = (rw.wins_clear || 0) + '/' + (rw.wins_narrow || 0);
        tdW.appendChild(wSub);
      } else {
        tdW.textContent = rw.won != null ? rw.won : '-';
      }
      tr.appendChild(tdW);

      // Losses — with clear/narrow split for VB
      var tdL = document.createElement('td');
      if (isVB && (rw.defeats_clear || rw.defeats_narrow)) {
        tdL.textContent = (rw.lost || 0);
        var lSub = document.createElement('span');
        lSub.style.fontSize = 'var(--text-xs)';
        lSub.style.color = 'var(--text-muted)';
        lSub.style.display = 'block';
        lSub.textContent = (rw.defeats_clear || 0) + '/' + (rw.defeats_narrow || 0);
        tdL.appendChild(lSub);
      } else {
        tdL.textContent = rw.lost != null ? rw.lost : '-';
      }
      tr.appendChild(tdL);

      // Sets (VB only)
      if (isVB) {
        var tdSets = document.createElement('td');
        tdSets.textContent = (rw.sets_won || 0) + ':' + (rw.sets_lost || 0);
        tr.appendChild(tdSets);
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    rankEl.appendChild(wrap);
  }

  // ── Promotion / relegation colors (volleyball) ─────────────────────
  function getPromotionColor(league, rank, totalTeams, teamName) {
    // Skip youth, classics, cup, etc.
    if (/U\d|Jugend|Junior|Classics|Cup|Turnier|Plausch|Mini/i.test(league)) return null;
    // Skip "talents" teams
    if (teamName && /talents/i.test(teamName)) return null;

    var m = league.match(/(\d)\.\s*Liga/i);
    if (!m) return null;
    var level = parseInt(m[1], 10);

    var green = '#22c55e', blue = '#3b82f6', orange = '#f97316', red = '#ef4444';

    switch (level) {
      case 5:
        if (rank === 1) return green;
        return null;
      case 4:
        if (rank === 1) return green;
        if (rank === totalTeams) return red;
        return null;
      case 3:
        if (rank === 1) return green;
        if (rank === 2) return blue;
        if (rank === totalTeams) return red;
        return null;
      case 2:
        if (rank === 1) return green;
        if (rank === totalTeams || rank === totalTeams - 1) return red;
        if (rank === totalTeams - 2) return orange;
        return null;
      case 1:
        if (rank === 1) return green;
        if (rank === totalTeams) return red;
        return null;
      default:
        return null;
    }
  }

  // ── Tab switching ────────────────────────────────────────────────
  var tabBar = document.querySelector('.tab-bar');
  if (tabBar) {
    tabBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      var tab = btn.getAttribute('data-tab');
      // Update buttons
      tabBar.querySelectorAll('.tab-btn').forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      // Update panels
      document.querySelectorAll('.tab-panel').forEach(function (p) {
        p.classList.remove('active');
      });
      var panel = document.querySelector('[data-tab-panel="' + tab + '"]');
      if (panel) panel.classList.add('active');
    });
  }

  // ── Image Lightbox ──────────────────────────────────────────────
  var lightboxOverlay = null;

  function openLightbox(src, alt, caption) {
    if (lightboxOverlay) closeLightbox();

    lightboxOverlay = document.createElement('div');
    lightboxOverlay.className = 'image-lightbox-overlay';

    var content = document.createElement('div');
    content.className = 'image-lightbox-content';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'image-lightbox-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', closeLightbox);
    content.appendChild(closeBtn);

    var img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    content.appendChild(img);

    if (caption) {
      var cap = document.createElement('div');
      cap.className = 'image-lightbox-caption';
      cap.textContent = caption;
      content.appendChild(cap);
    }

    lightboxOverlay.appendChild(content);
    lightboxOverlay.addEventListener('click', function (e) {
      if (e.target === lightboxOverlay) closeLightbox();
    });

    document.body.appendChild(lightboxOverlay);
    // Trigger transition
    requestAnimationFrame(function () {
      lightboxOverlay.classList.add('visible');
    });
  }

  function closeLightbox() {
    if (!lightboxOverlay) return;
    lightboxOverlay.classList.remove('visible');
    var ol = lightboxOverlay;
    setTimeout(function () { if (ol.parentNode) ol.parentNode.removeChild(ol); }, 200);
    lightboxOverlay = null;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  // Delegate click on team photo and roster avatars
  document.addEventListener('click', function (e) {
    // Team photo
    var teamPhoto = e.target.closest('.team-photo');
    if (teamPhoto) {
      var fullSrc = teamPhoto.src.replace(/\?thumb=[^&]+/, '');
      openLightbox(fullSrc, teamPhoto.alt);
      return;
    }
    // Roster avatar (only img, not initials div)
    var avatar = e.target.closest('img.roster-avatar');
    if (avatar) {
      var fullSrc = avatar.src.replace(/\?thumb=[^&]+/, '');
      var card = avatar.closest('.roster-card');
      var nameEl = card && card.querySelector('.roster-name');
      var caption = nameEl ? nameEl.textContent : '';
      openLightbox(fullSrc, caption, caption);
      return;
    }
  });

  // ── Init ──────────────────────────────────────────────────────────
  // Wait for i18n translations to load before rendering
  if (window.i18nReady) {
    window.i18nReady.then(fetchTeamData);
  } else {
    fetchTeamData();
  }

  // ── Re-render on language change ──────────────────────────────────
  document.addEventListener('langChanged', function () {
    if (window.TEAM_CONFIG && window.TEAM_CONFIG.directusId) {
      // Clear rendered content so fetchTeamData re-renders fresh
      var heroContainer = document.getElementById('team-hero-container');
      if (heroContainer) heroContainer.textContent = '';
      var photoContainer = document.getElementById('team-photo-container');
      if (photoContainer) photoContainer.textContent = '';
      var existingPhoto = document.querySelector('.team-photo');
      if (existingPhoto) existingPhoto.remove();
      var ctaContainer = document.getElementById('cta-container');
      if (ctaContainer) ctaContainer.textContent = '';
      var igContainer = document.getElementById('instagram-embed-container');
      if (igContainer) igContainer.style.display = 'none';
      var igEmbed = document.getElementById('instagram-embed');
      if (igEmbed) igEmbed.textContent = '';

      fetchTeamData();
    }
  });
})();
