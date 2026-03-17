/**
 * KSCW Data Layer — KSC Wiedikon (Volleyball & Basketball)
 *
 * Fetches data from the PocketBase API at kscw-api.lucanepa.com.
 * Locale-aware via window.i18n (DE/EN). Colors from src/utils/teamColors.ts.
 *
 * The same `window.KSCW` interface is preserved so all HTML pages work unchanged.
 * After async fetch completes, a `kscw-data-ready` custom event is dispatched on `document`.
 */

// ─── Team Colors (hardcoded from codebase) ──────────────────────────
var teamColors = {
  // Volleyball Men (Blue)
  H1:      { bg: '#1e40af', text: '#ffffff', border: '#1e3a8a' },
  H2:      { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' },
  H3:      { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' },
  HU23:    { bg: '#60a5fa', text: '#1e3a8a', border: '#3b82f6' },
  HU20:    { bg: '#93c5fd', text: '#1e3a8a', border: '#60a5fa' },
  Legends: { bg: '#1e3a5f', text: '#ffffff', border: '#162d4d' },

  // Volleyball Women (Rose)
  D1:      { bg: '#be123c', text: '#ffffff', border: '#9f1239' },
  D2:      { bg: '#e11d48', text: '#ffffff', border: '#be123c' },
  D3:      { bg: '#f43f5e', text: '#881337', border: '#e11d48' },
  D4:      { bg: '#fb7185', text: '#881337', border: '#f43f5e' },
  DU23:    { bg: '#fda4af', text: '#881337', border: '#fb7185' },

  // Basketball Men (Orange)
  'BB-H1':         { bg: '#9a3412', text: '#ffffff', border: '#7c2d12' },
  'BB-H3':         { bg: '#c2410c', text: '#ffffff', border: '#9a3412' },
  'BB-H4':         { bg: '#ea580c', text: '#ffffff', border: '#c2410c' },
  'BB-HU18':       { bg: '#f97316', text: '#ffffff', border: '#ea580c' },
  'BB-HU16':       { bg: '#fb923c', text: '#7c2d12', border: '#f97316' },
  'BB-HU14':       { bg: '#fdba74', text: '#7c2d12', border: '#fb923c' },
  'BB-HU12':       { bg: '#fed7aa', text: '#7c2d12', border: '#fdba74' },
  'BB-H-Classics': { bg: '#78350f', text: '#ffffff', border: '#451a03' },

  // Basketball Women (Purple)
  'BB-D1':         { bg: '#7e22ce', text: '#ffffff', border: '#6b21a8' },
  'BB-D3':         { bg: '#a855f7', text: '#ffffff', border: '#9333ea' },
  'BB-DU18':       { bg: '#c084fc', text: '#581c87', border: '#a855f7' },
  'BB-DU16':       { bg: '#d8b4fe', text: '#581c87', border: '#c084fc' },
  'BB-DU14':       { bg: '#e9d5ff', text: '#581c87', border: '#d8b4fe' },
  'BB-DU12':       { bg: '#f3e8ff', text: '#581c87', border: '#e9d5ff' },
  'BB-DU10':       { bg: '#faf5ff', text: '#581c87', border: '#f3e8ff' },
  'BB-D-Classics': { bg: '#581c87', text: '#ffffff', border: '#3b0764' },

  // Basketball Mixed (Teal)
  'BB-MU10': { bg: '#14b8a6', text: '#042f2e', border: '#0d9488' },
  'BB-MU8':  { bg: '#0d9488', text: '#ffffff', border: '#0f766e' },

  // Sub-brands
  'BB-Lions':      { bg: '#6d28d9', text: '#ffffff', border: '#5b21b6' },
  'BB-Lions D1':   { bg: '#6d28d9', text: '#ffffff', border: '#5b21b6' },
  'BB-Lions D3':   { bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed' },
  'BB-Rhinos':     { bg: '#059669', text: '#ffffff', border: '#047857' },
  'BB-Rhinos D1':  { bg: '#059669', text: '#ffffff', border: '#047857' },
  'BB-Rhinos D3':  { bg: '#34d399', text: '#064e3b', border: '#10b981' },

  // Fallback
  Other: { bg: '#6b7280', text: '#ffffff', border: '#4b5563' },
};

// ─── Team Pictures (from PocketBase) ─────────────────────────────────
var PB_FILES = 'https://kscw-api.lucanepa.com/api/files/pbc_1568971955/';
var teamPictures = {
  // Volleyball
  H1:      PB_FILES + 'qz7y8l4tz48f65j/h193rllc4ye3_7d834yw8do.jpg',
  H2:      PB_FILES + '601p27iw4xvw1ds/h29vraeson3m_zzvezaah1z.jpg',
  H3:      PB_FILES + 'il1wd1p018hrb61/image1000852_fbnjri0thk.jpg',
  Legends: PB_FILES + 'e352q254s1cip8y/image1000856_d4zcs4gmho.jpg',
  D1:      PB_FILES + 'p1i9cs4km520dd6/d1jfiquwbimv_si9bndu1ir.jpg',
  D2:      PB_FILES + '9kwn129z84967fc/d24vsjosw59i_83r02oi737.jpg',
  D3:      PB_FILES + 'c18yey33vwx9yo4/d35u0ihf626u_2ll1lkswhm.jpg',
  D4:      PB_FILES + '2h55x265r941a4k/d4jgm2oo03ah_7ouliepg2p.jpg',
  // Basketball
  'BB-H1':       PB_FILES + 'wpg9887276cdkd9/bbh1_bo760yoe5s.jpg',
  'BB-H3':       PB_FILES + 'oqqn58l012ie36e/bbh2_x8bm3fove3.jpg',
  'BB-H4':       PB_FILES + '4e65vlw744mldc0/bbh3_w5h2xtpj2x.jpg',
  'BB-Lions D1': PB_FILES + '31k9c1qk62p23oe/bblions_ldzkbkw0b2.jpg',
  'BB-Rhinos D3':PB_FILES + 'cj55682587v210q/bbrhinos_jzjphi50in.jpg',
};

// ─── teamIds map (PB team_id → display short name) ─────────────────
var teamIdMap = {
  'vb_12747': 'H3',     'vb_1394': 'D4',      'vb_14040': 'DU23',
  'vb_7563': 'HU23',    'vb_1393': 'D2',       'vb_541': 'H2',
  'vb_6023': 'Legends', 'vb_4689': 'D3',       'vb_2743': 'H1',
  'vb_1395': 'D1',      'vb_2301': 'DU23',
  'bb_1348': 'BB-H1',   'bb_4829': 'BB-H3',    'bb_7183': 'BB-H4',
  'bb_4934': 'BB-D-Classics', 'bb_4935': 'BB-H-Classics',
  'bb_4445': 'BB-Lions D1',   'bb_1077': 'BB-Rhinos D3',
  'bb_5104': 'BB-DU12', 'bb_5441': 'BB-DU14',  'bb_7182': 'BB-DU16',
  'bb_5697': 'BB-DU18', 'bb_5791': 'BB-HU12',  'bb_5790': 'BB-HU14',
  'bb_5498': 'BB-HU16', 'bb_5789': 'BB-HU18',  'bb_5287': 'BB-MU10',
  'bb_6724': 'BB-MU8',
};

/**
 * Resolve a PB team name to a teamColors key.
 * VB teams: name matches directly (e.g. "H1").
 * BB teams: need "BB-" prefix (e.g. "DU12" → "BB-DU12", "Lions D1" → "BB-Lions D1").
 */
function pbNameToColorKey(name, sport) {
  if (sport === 'volleyball') return name;
  var direct = 'BB-' + name;
  if (teamColors[direct]) return direct;
  // Long basketball names like "Herren 1 H1" — try matching known keys
  var keys = Object.keys(teamColors);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k.indexOf('BB-') !== 0) continue;
    var sc = k.slice(3);
    if (name === sc || name.indexOf(' ' + sc) === name.length - sc.length - 1) return k;
  }
  return direct;
}

/** Look up color entry for a team short name */
function getColor(short) {
  return teamColors[short] || teamColors.Other;
}

// ─── Gender detection helper ────────────────────────────────────────
function detectGender(name, sport) {
  var n = name.toLowerCase();
  if (n.indexOf('damen') !== -1 || n.indexOf(' d') !== -1 && n.match(/\bd\d/)) return 'women';
  if (n.indexOf('herren') !== -1 || n.indexOf(' h') !== -1 && n.match(/\bh\d/)) return 'men';
  if (n.indexOf('mixed') !== -1 || n.indexOf('mu') !== -1) return 'mixed';
  if (n.indexOf('lions') !== -1 || n.indexOf('rhinos') !== -1) return 'women';
  // Fallback by first character
  if (/^D/.test(name)) return 'women';
  if (/^H/.test(name)) return 'men';
  return 'men';
}


// ─── Initialize window.KSCW ─────────────────────────────────────────
window.KSCW = {

  // Status flag: false while loading, true after PB fetch completes
  ready: false,
  dataSource: 'loading', // 'loading' | 'pocketbase' | 'error'

  // ─── Club Info ──────────────────────────────────────────────
  club: {
    name: 'KSC Wiedikon',
    shortName: 'KSCW',
    founded: 1978,
    colors: { primary: '#4A55A2', secondary: '#FFC832' },
    address: 'Turnhalle Küngenmatt, Küngenmattstrasse 23, 8041 Zürich',
    email: 'info@kscw.ch',
    website: 'https://kscw.ch',
    social: {
      instagram: 'https://instagram.com/kscwiedikon',
      facebook: 'https://facebook.com/kscwiedikon',
    },
  },

  // ─── Teams (keyed by short name, populated from PB) ────────
  teams: {},

  // ─── Games (populated from PB) ────────────────────────────
  games: [],

  // ─── Rankings (populated from PB) ─────────────────────────
  rankings: {},

  // ─── News (populated from PB) ─────────────────────────────
  news: [],

  // ─── Board Members ────────────────────────────────────────
  board: [],

  // ─── Sponsors (fetched from PB /api/public/sponsors) ──────
  sponsors: [],

  // ─── Rosters (populated from PB) ──────────────────────────
  rosters: {},

  // ─── Helpers ────────────────────────────────────────────────

  /** Get team object by short name */
  getTeam: function (short) {
    return this.teams[short] || null;
  },

  /** Get all teams for a sport */
  getTeamsBySport: function (sport) {
    return Object.values(this.teams).filter(function (t) { return t.sport === sport; });
  },

  /** Get upcoming games (score === null) */
  getUpcomingGames: function () {
    var today = new Date().toISOString().slice(0, 10);
    return this.games
      .filter(function (g) { return g.score === null && g.date && g.date >= today; })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); });
  },

  /** Get completed games (score !== null), most recent first */
  getCompletedGames: function () {
    return this.games
      .filter(function (g) { return g.score !== null && g.date; })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || b.time.localeCompare(a.time); });
  },

  /** Get games for a specific team */
  getGamesByTeam: function (teamShort) {
    return this.games.filter(function (g) { return g.teamShort === teamShort; });
  },

  /** Get all sponsors (flat array) */
  getSponsors: function () {
    return this.sponsors || [];
  },

  /** Get team picture URL (or null) */
  getTeamPicture: function (short) {
    return teamPictures[short] || null;
  },

  /** Get roster for a team */
  getRoster: function (teamShort) {
    return this.rosters[teamShort] || [];
  },

  /** Format date as "DD.MM.YYYY" (Swiss) or "MM/DD/YYYY" (English) */
  formatDate: function (isoDate) {
    if (!isoDate) return '–';
    var parts = isoDate.split('-');
    if (window.i18n && i18n.getLang() === 'en') {
      return parts[1] + '/' + parts[2] + '/' + parts[0];
    }
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  },

  /** Format date as "Sa, 1. März 2026" (DE) or "Sat, March 1, 2026" (EN) */
  formatDateLong: function (isoDate) {
    var dayKeys = ['dateSun', 'dateMon', 'dateTue', 'dateWed', 'dateThu', 'dateFri', 'dateSat'];
    var monthKeys = ['dateJan', 'dateFeb', 'dateMar', 'dateApr', 'dateMay', 'dateJun',
                     'dateJul', 'dateAug', 'dateSep', 'dateOct', 'dateNov', 'dateDec'];
    var d = new Date(isoDate + 'T12:00:00');

    // Fallback arrays for when i18n isn't loaded yet
    var deFallbackDays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    var deFallbackMonths = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    var dayName = window.i18n ? i18n.t(dayKeys[d.getDay()]) : deFallbackDays[d.getDay()];
    var monthName = window.i18n ? i18n.t(monthKeys[d.getMonth()]) : deFallbackMonths[d.getMonth()];

    // German: "Sa, 1. März 2026" vs English: "Sat, March 1, 2026"
    if (window.i18n && i18n.getLang() === 'en') {
      return dayName + ', ' + monthName + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    return dayName + ', ' + d.getDate() + '. ' + monthName + ' ' + d.getFullYear();
  },

  /** Check if a game is a win for KSCW */
  isWin: function (game) {
    if (!game.score) return null;
    var parts = game.score.split(':');
    var a = parseInt(parts[0], 10);
    var b = parseInt(parts[1], 10);
    return game.isHome ? a > b : b > a;
  },
};

// ─── PocketBase API Fetch ─────────────────────────────────────────
(function () {
  'use strict';

  var PB = 'https://kscw-api.lucanepa.com';
  var D = window.KSCW;

  /**
   * Fetch all pages from a PocketBase collection (auto-paginate).
   * Returns the full items array.
   */
  function fetchAll(collection, params) {
    var qs = params || '';
    var perPage = 200;
    var url = PB + '/api/collections/' + collection + '/records?perPage=' + perPage + (qs ? '&' + qs : '');
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('PB ' + collection + ' HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        // If there are more pages, fetch them too
        if (data.totalPages > 1) {
          var promises = [];
          for (var p = 2; p <= data.totalPages; p++) {
            promises.push(
              fetch(url + '&page=' + p)
                .then(function (r) { return r.json(); })
                .then(function (d) { return d.items || []; })
            );
          }
          return Promise.all(promises).then(function (pages) {
            var all = data.items || [];
            for (var i = 0; i < pages.length; i++) {
              all = all.concat(pages[i]);
            }
            return all;
          });
        }
        return data.items || [];
      });
  }

  // Build a PB record ID → team short name lookup from fetched teams
  var pbIdToShort = {};

  /**
   * Map a PB team record to the website_draft team object shape.
   * Returns [shortName, teamObj] tuple.
   */
  function mapTeam(t) {
    var sport = t.sport || 'volleyball';
    var colorKey = pbNameToColorKey(t.name, sport);
    var c = getColor(colorKey);
    // For BB teams, short name uses "BB-" prefix unless the name already has it
    var short = colorKey; // colorKey is the canonical short name
    return [short, {
      name: t.full_name || t.name,
      short: short,
      league: t.league || '',
      sport: sport,
      gender: detectGender(t.name, sport),
      bg: c.bg,
      text: c.text,
      border: c.border,
      training: '',
      venue: 'Turnhalle Küngenmatt',
      // Extra fields from PB
      teamId: t.team_id || '',
      pbId: t.id,
      slug: t.slug || '',
      season: t.season || '',
      active: t.active !== false,
    }];
  }

  /**
   * Determine the KSCW team short name for a game.
   * Uses the expand.kscw_team relation if available, otherwise the pbIdToShort lookup.
   */
  function resolveTeamShort(g) {
    // If expanded, use the expanded team name
    if (g.expand && g.expand.kscw_team) {
      var et = g.expand.kscw_team;
      var sport = et.sport || (g.game_id && g.game_id.indexOf('bb_') === 0 ? 'basketball' : 'volleyball');
      return pbNameToColorKey(et.name, sport);
    }
    // Fallback: look up by PB record ID
    if (g.kscw_team && pbIdToShort[g.kscw_team]) {
      return pbIdToShort[g.kscw_team];
    }
    return '';
  }

  /**
   * Map a PB game record to the website_draft game object shape.
   */
  function mapGame(g) {
    var teamShort = resolveTeamShort(g);
    var isHome = g.type === 'home';
    var hasScore = g.status === 'completed' && (g.home_score > 0 || g.away_score > 0);
    var score = hasScore ? g.home_score + ':' + g.away_score : null;
    var sport = (g.game_id && g.game_id.indexOf('bb_') === 0) ? 'basketball'
              : (g.source === 'basketplan') ? 'basketball'
              : 'volleyball';

    // Opponent: for home games it's away_team, for away games it's home_team
    var opponent = isHome ? (g.away_team || '') : (g.home_team || '');

    // Set score from sets_json if available
    var setScore = null;
    if (g.sets_json && typeof g.sets_json === 'object') {
      try {
        var sets = Array.isArray(g.sets_json) ? g.sets_json : [];
        if (sets.length > 0) {
          setScore = sets.map(function (s) {
            return (s.home || s[0] || 0) + ':' + (s.away || s[1] || 0);
          }).join(', ');
        }
      } catch (e) { /* ignore */ }
    }

    // Date formatting: PB stores as "2026-03-01 17:00:00.000Z" or ISO
    var date = (g.date || '').substring(0, 10);
    var time = g.time || '';
    // PB stores time as full datetime "YYYY-MM-DD HH:MM:SS" — extract HH:MM
    if (time.indexOf(' ') !== -1) {
      time = time.split(' ')[1].substring(0, 5);
    } else if (time.length > 5) {
      time = time.substring(0, 5);
    }

    // Hall info from expand or away_hall_json
    var hallObj = null;
    if (g.expand && g.expand.hall) {
      var h = g.expand.hall;
      hallObj = { name: h.name || '', address: h.address || '', city: h.city || '', mapsUrl: h.maps_url || '' };
    } else if (g.away_hall_json) {
      var ah = g.away_hall_json;
      var mapsUrl = ah.plus_code
        ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ah.plus_code)
        : (ah.address && ah.city)
          ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ah.address + ', ' + ah.city)
          : '';
      hallObj = { name: ah.name || '', address: ah.address || '', city: ah.city || '', mapsUrl: mapsUrl };
    }

    return {
      id: g.game_id || g.id,
      date: date,
      time: time,
      teamShort: teamShort,
      opponent: opponent,
      isHome: isHome,
      score: score,
      setScore: setScore,
      sport: sport,
      // Extra PB fields for detail modal
      status: g.status || 'scheduled',
      league: g.league || '',
      season: g.season || '',
      homeTeam: g.home_team || '',
      awayTeam: g.away_team || '',
      homeScore: g.home_score || 0,
      awayScore: g.away_score || 0,
      setsJson: Array.isArray(g.sets_json) ? g.sets_json : [],
      hall: hallObj,
      type: g.type || '',
    };
  }

  /**
   * Map PB ranking records into the website_draft rankings structure.
   * Groups by league into { [leagueLabel]: { sport, league, teams: [...] } }
   */
  function mapRankings(items, teamLookup) {
    var byLeague = {};
    for (var i = 0; i < items.length; i++) {
      var r = items[i];
      var league = r.league || 'Unknown';
      var sport = (r.team_id && r.team_id.indexOf('bb_') === 0) ? 'basketball' : 'volleyball';
      var prefix = sport === 'volleyball' ? 'VB' : 'BB';
      var key = prefix + ' ' + league;

      if (!byLeague[key]) {
        byLeague[key] = { sport: sport, league: league, teams: [] };
      }

      // Determine if this is a KSCW team
      var isKSCW = false;
      if (r.team_id && teamIdMap[r.team_id]) isKSCW = true;
      if (r.team && teamLookup[r.team]) isKSCW = true;

      var entry = {
        rank: r.rank || 0,
        team: r.team_name || 'Unknown',
        played: r.played || 0,
        wins: r.won || 0,
        losses: r.lost || 0,
        setsWon: r.sets_won || null,
        setsLost: r.sets_lost || null,
        points: r.points || 0,
      };
      if (isKSCW) entry.isKSCW = true;

      byLeague[key].teams.push(entry);
    }

    // Sort each league by rank
    var keys = Object.keys(byLeague);
    for (var j = 0; j < keys.length; j++) {
      byLeague[keys[j]].teams.sort(function (a, b) { return a.rank - b.rank; });
    }

    return byLeague;
  }

  // ─── Execute the fetch ──────────────────────────────────────
  Promise.all([
    fetchAll('teams', 'filter=(active=true)'),
    fetchAll('games', 'sort=-date&expand=kscw_team,hall'),
    fetchAll('rankings', 'sort=rank'),
    fetchAll('news', 'sort=-published_at&filter=(is_published=true)'),
  ]).then(function (results) {
    var pbTeams = results[0];
    var pbGames = results[1];
    var pbRankings = results[2];
    var pbNews = results[3];

    // ── Build teams map ────────────────────────────────
    var teamsMap = {};
    var teamPbIdSet = {}; // PB record IDs of KSCW teams
    for (var i = 0; i < pbTeams.length; i++) {
      var pair = mapTeam(pbTeams[i]);
      var short = pair[0];
      var obj = pair[1];
      teamsMap[short] = obj;
      pbIdToShort[pbTeams[i].id] = short;
      teamPbIdSet[pbTeams[i].id] = true;
    }

    D.teams = teamsMap;

    // ── Build games array ──────────────────────────────
    D.games = pbGames.map(mapGame).filter(function (g) {
      return g.teamShort !== ''; // skip games without a resolved KSCW team
    });

    // ── Build rankings ─────────────────────────────────
    D.rankings = mapRankings(pbRankings, teamPbIdSet);

    // ── Map news ──────────────────────────────────────────
    D.news = pbNews.map(function (n) {
        return {
          id: n.id,
          title: n.title,
          slug: n.slug,
          date: n.published_at || n.created,
          excerpt: n.excerpt || '',
          body: n.body || '',
          category: n.category || 'club',
          author: n.author || 'KSCW',
          image: n.image ? PB + '/api/files/news/' + n.id + '/' + n.image : null,
        };
      });

    D.ready = true;
    D.dataSource = 'pocketbase';
    console.log('[KSCW] Data loaded from PocketBase: ' + pbTeams.length + ' teams, ' + D.games.length + ' games, ' + pbRankings.length + ' ranking entries, ' + (pbNews ? pbNews.length : 0) + ' news');

    // Dispatch event for pages that want to re-render with live data
    document.dispatchEvent(new Event('kscw-data-ready'));

  }).catch(function (err) {
    console.warn('[KSCW] PocketBase fetch failed:', err);
    D.ready = true;
    D.dataSource = 'error';
    document.dispatchEvent(new Event('kscw-data-ready'));
  });

})();
