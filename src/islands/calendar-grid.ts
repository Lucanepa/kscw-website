// Calendar Grid — Vanilla JS month grid fetching games from PocketBase
// With filter toolbar, sport/team colors, and iCal subscribe modal

const PB_URL = 'https://api.kscw.ch'

interface PBTeam {
  id: string
  name: string
  sport: string
  color: string
}

interface PBGame {
  id: string
  game_id: string
  date: string
  time: string
  home_team: string
  away_team: string
  home_score: number
  away_score: number
  status: string
  type: string
  expand?: {
    kscw_team?: PBTeam
    hall?: { name: string; address: string; city: string }
  }
}

interface CalendarEvent {
  title: string
  date: string
  endDate?: string
  time?: string
  location?: string
  category: string
  body?: string
}

const container = document.getElementById('calendar-grid')
if (container) {
  const lang = container.dataset.lang || 'de'

  const dayHeaders =
    lang === 'de'
      ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const monthNames =
    lang === 'de'
      ? ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
      : ['January','February','March','April','May','June','July','August','September','October','November','December']

  const todayLabel = lang === 'de' ? 'Heute' : 'Today'
  const homeLabel = lang === 'de' ? 'Heim' : 'Home'
  const awayLabel = lang === 'de' ? 'Auswärts' : 'Away'
  const loadingLabel = lang === 'de' ? 'Spiele werden geladen...' : 'Loading games...'
  const subscribeLabel = lang === 'de' ? 'Abonnieren' : 'Subscribe'
  const downloadLabel = lang === 'de' ? 'Herunterladen' : 'Download'
  const subscribeTitle = lang === 'de' ? 'Kalender abonnieren' : 'Subscribe to Calendar'
  const allTeamsLabel = lang === 'de' ? 'Alle Teams' : 'All Teams'
  const eventsLabel = 'Events'
  const homeGamesLabel = lang === 'de' ? 'Heimspiele' : 'Home Games'
  const awayGamesLabel = lang === 'de' ? 'Auswärtsspiele' : 'Away Games'

  let currentMonth = new Date()
  currentMonth.setDate(1)
  let games: PBGame[] = []
  let fetchedRange = ''
  // Filter state
  let filterType = new Set(['home', 'away'])
  let filterSport = new Set(['volleyball', 'basketball'])
  let filterTeams = new Set<string>() // empty = all

  // Teams list
  let allTeams: PBTeam[] = []

  // Load build-time events
  let calEvents: CalendarEvent[] = []
  const evDataEl = document.getElementById('events-data')
  if (evDataEl) {
    try {
      calEvents = JSON.parse(evDataEl.textContent || '[]')
    } catch { /* ignore */ }
  }

  // -- Date helpers --
  function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1)
  }
  function endOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0)
  }
  function startOfWeek(d: Date): Date {
    const day = d.getDay()
    const diff = (day === 0 ? -6 : 1) - day
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  }
  function endOfWeek(d: Date): Date {
    const day = d.getDay()
    const diff = day === 0 ? 0 : 7 - day
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  }
  function toDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }
  function isSameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  }
  function eachDay(start: Date, end: Date): Date[] {
    const days: Date[] = []
    const cur = new Date(start)
    while (cur <= end) {
      days.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }

  // -- Safe text helper --
  function el(tag: string, cls?: string, text?: string): HTMLElement {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (text) e.textContent = text
    return e
  }

  // -- Color helpers --
  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  function getTeamSport(g: PBGame): string {
    return g.expand?.kscw_team?.sport || (g.game_id?.startsWith('bb_') ? 'basketball' : 'volleyball')
  }

  // -- Fetch teams --
  async function fetchTeams(): Promise<void> {
    try {
      const url = `${PB_URL}/api/collections/teams/records?perPage=100&sort=sport,name&fields=id,name,sport,color`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      allTeams = data.items || []
    } catch {
      allTeams = []
    }
  }

  // -- Fetch games --
  async function fetchGames(month: Date): Promise<void> {
    const mStart = startOfMonth(month)
    const mEnd = endOfMonth(month)
    const gridStart = startOfWeek(mStart)
    const gridEnd = endOfWeek(mEnd)

    const from = toDateKey(gridStart)
    const to = toDateKey(new Date(gridEnd.getFullYear(), gridEnd.getMonth(), gridEnd.getDate() + 1))
    const rangeKey = `${from}_${to}`
    if (rangeKey === fetchedRange) return
    fetchedRange = rangeKey

    try {
      const filter = encodeURIComponent(`date>="${from}" && date<"${to}"`)
      const url =
        `${PB_URL}/api/collections/games/records?perPage=200&sort=date,time` +
        `&filter=${filter}` +
        `&fields=id,game_id,date,time,home_team,away_team,home_score,away_score,status,type` +
        `&expand=kscw_team,hall`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      games = data.items || []
    } catch {
      games = []
    }
  }

  // -- Filter games --
  function applyFilters(gameList: PBGame[]): PBGame[] {
    return gameList.filter(g => {
      if (!filterType.has(g.type)) return false
      const sport = getTeamSport(g)
      if (!filterSport.has(sport)) return false
      if (filterTeams.size > 0 && g.expand?.kscw_team?.id && !filterTeams.has(g.expand.kscw_team.id)) return false
      return true
    })
  }

  // -- Build game entry chip --
  function gameChip(g: PBGame): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cal-entry'

    const isHome = g.type === 'home'
    const teamColor = g.expand?.kscw_team?.color || (isHome ? '#4A55A2' : '#d97706')
    const teamName = g.expand?.kscw_team?.name || (isHome ? g.home_team : g.away_team)

    // Use team color for chip background
    btn.style.background = hexToRgba(teamColor, 0.15)
    btn.style.borderLeft = `3px solid ${teamColor}`

    // Sport dot
    const sport = getTeamSport(g)
    const dot = el('span', 'cal-sport-dot')
    dot.style.background = sport === 'basketball' ? '#d97706' : 'var(--kscw-blue)'
    btn.appendChild(dot)

    // Time
    if (g.time) {
      btn.appendChild(el('span', 'cal-entry-time', g.time.slice(0, 5)))
    }

    // H/A badge
    const badge = el('span', 'cal-entry-badge', isHome ? 'H' : 'A')
    badge.style.color = isHome ? 'var(--kscw-blue)' : '#d97706'
    btn.appendChild(badge)

    // Team name
    btn.appendChild(el('span', 'cal-entry-title', teamName))

    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      showGameDetail(g)
    })

    return btn
  }

  // -- Event chip --
  function eventChip(ev: CalendarEvent): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cal-entry cal-entry--event'

    if (ev.time) {
      btn.appendChild(el('span', 'cal-entry-time', ev.time))
    }

    btn.appendChild(el('span', 'cal-entry-title', ev.title))

    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      showEventDetail(ev)
    })

    return btn
  }

  // -- Game detail modal --
  function showGameDetail(g: PBGame): void {
    const overlay = el('div', 'cal-modal-overlay')
    overlay.addEventListener('click', () => overlay.remove())

    const modal = el('div', 'cal-modal')
    modal.style.maxWidth = '420px'
    modal.addEventListener('click', (e) => e.stopPropagation())

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'cal-modal-close'
    closeBtn.textContent = '\u00D7'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    const isHome = g.type === 'home'
    const isBB = getTeamSport(g) === 'basketball'
    const sportLabel = isBB ? 'Basketball' : 'Volleyball'
    const typeLabel = isHome ? homeLabel : awayLabel
    const teamColor = g.expand?.kscw_team?.color || '#4A55A2'

    // Header badges
    const hdr = el('div', 'cal-modal-row-header')
    hdr.style.marginBottom = 'var(--space-sm)'
    hdr.appendChild(el('span', `cal-tooltip-sport cal-tooltip-sport--${isBB ? 'bb' : 'vb'}`, sportLabel))
    hdr.appendChild(el('span', `cal-tooltip-type cal-tooltip-type--${isHome ? 'home' : 'away'}`, typeLabel))
    if (g.expand?.kscw_team?.name) {
      const teamChip = el('span', 'cal-detail-team', g.expand.kscw_team.name)
      teamChip.style.background = hexToRgba(teamColor, 0.15)
      teamChip.style.color = teamColor
      teamChip.style.border = `1px solid ${hexToRgba(teamColor, 0.3)}`
      hdr.appendChild(teamChip)
    }
    modal.appendChild(hdr)

    // Teams title
    modal.appendChild(el('h3', 'cal-modal-title', `${g.home_team} vs ${g.away_team}`))

    // Score (if completed)
    if (g.status === 'completed' && (g.home_score || g.away_score)) {
      const scoreDiv = el('div', 'cal-detail-score', `${g.home_score} : ${g.away_score}`)
      modal.appendChild(scoreDiv)
    }

    // Date & Time
    const dateObj = new Date(g.date)
    const dateStr = dateObj.toLocaleDateString(lang === 'de' ? 'de-CH' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const infoList = el('div', 'cal-detail-info')
    infoList.appendChild(makeInfoRow('\uD83D\uDCC5', dateStr))
    if (g.time) infoList.appendChild(makeInfoRow('\u23F0', g.time.slice(0, 5)))

    // Hall
    const hall = g.expand?.hall
    if (hall) {
      infoList.appendChild(makeInfoRow('\uD83C\uDFE2', hall.name))
      const addr = [hall.address, hall.city].filter(Boolean).join(', ')
      if (addr) infoList.appendChild(makeInfoRow('\uD83D\uDCCD', addr))
    }

    // Status
    if (g.status === 'postponed') {
      infoList.appendChild(makeInfoRow('\u26A0\uFE0F', lang === 'de' ? 'Verschoben' : 'Postponed'))
    }

    modal.appendChild(infoList)

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler) }
    }
    document.addEventListener('keydown', escHandler)
  }

  // -- Event detail modal --
  function showEventDetail(ev: CalendarEvent): void {
    const overlay = el('div', 'cal-modal-overlay')
    overlay.addEventListener('click', () => overlay.remove())

    const modal = el('div', 'cal-modal')
    modal.style.maxWidth = '420px'
    modal.addEventListener('click', (e) => e.stopPropagation())

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'cal-modal-close'
    closeBtn.textContent = '\u00D7'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    // Category badge
    const hdr = el('div', 'cal-modal-row-header')
    hdr.style.marginBottom = 'var(--space-sm)'
    const catLabel = ev.category.charAt(0).toUpperCase() + ev.category.slice(1)
    hdr.appendChild(el('span', 'cal-tooltip-sport cal-tooltip-sport--event', catLabel))
    modal.appendChild(hdr)

    // Title
    modal.appendChild(el('h3', 'cal-modal-title', ev.title))

    // Info
    const dateObj = new Date(ev.date)
    const dateStr = dateObj.toLocaleDateString(lang === 'de' ? 'de-CH' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const infoList = el('div', 'cal-detail-info')
    infoList.appendChild(makeInfoRow('\uD83D\uDCC5', dateStr))
    if (ev.time) infoList.appendChild(makeInfoRow('\u23F0', ev.time))
    if (ev.location) infoList.appendChild(makeInfoRow('\uD83D\uDCCD', ev.location))
    modal.appendChild(infoList)

    // Description
    if (ev.body) {
      const desc = document.createElement('div')
      desc.className = 'cal-modal-desc'
      // SAFE: ev.body is admin-authored content sanitized with DOMPurify at save time in the admin panel.
      // No user-generated content flows here. textContent is not used because rich text formatting
      // (bold, links, lists) from the Quill editor must be preserved.
      desc.innerHTML = ev.body
      modal.appendChild(desc)
    }

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler) }
    }
    document.addEventListener('keydown', escHandler)
  }

  // -- Info row helper --
  function makeInfoRow(icon: string, text: string): HTMLElement {
    const row = el('div', 'cal-detail-row')
    row.appendChild(el('span', 'cal-detail-icon', icon))
    row.appendChild(el('span', undefined, text))
    return row
  }

  // -- Close all filter dropdowns --
  function closeAllDropdowns(): void {
    container!.querySelectorAll('.cal-filter-btn.open').forEach(b => b.classList.remove('open'))
    container!.querySelectorAll('.cal-filter-dropdown').forEach(d => (d as HTMLElement).style.display = 'none')
  }

  // -- Render filter toolbar --
  function renderToolbar(): HTMLElement {
    const toolbar = el('div', 'cal-toolbar')

    const filters = el('div', 'cal-filters')

    // -- Type filter --
    filters.appendChild(makeDropdown(
      filterType.size === 2 ? `${homeLabel}, ${awayLabel}` : filterType.has('home') ? homeLabel : awayLabel,
      filterType.size < 2,
      [
        { id: 'home', label: homeLabel, checked: filterType.has('home') },
        { id: 'away', label: awayLabel, checked: filterType.has('away') },
      ],
      [],
      (id, checked) => {
        if (checked) filterType.add(id); else filterType.delete(id)
        if (filterType.size === 0) filterType.add(id) // prevent empty
        render()
      }
    ))

    // -- Sport filter --
    filters.appendChild(makeDropdown(
      filterSport.size === 2 ? 'Volleyball, Basketball' : filterSport.has('volleyball') ? 'Volleyball' : 'Basketball',
      filterSport.size < 2,
      [
        { id: 'volleyball', label: 'Volleyball', checked: filterSport.has('volleyball') },
        { id: 'basketball', label: 'Basketball', checked: filterSport.has('basketball') },
      ],
      [],
      (id, checked) => {
        if (checked) filterSport.add(id); else filterSport.delete(id)
        if (filterSport.size === 0) filterSport.add(id)
        render()
      }
    ))

    // -- Team filter --
    const vbTeams = allTeams.filter(t => t.sport === 'volleyball')
    const bbTeams = allTeams.filter(t => t.sport === 'basketball')
    const teamOptions = [
      ...vbTeams.map(t => ({ id: t.id, label: t.name, checked: filterTeams.size === 0 || filterTeams.has(t.id) })),
      ...bbTeams.map(t => ({ id: t.id, label: t.name, checked: filterTeams.size === 0 || filterTeams.has(t.id) })),
    ]
    const teamGroups = [
      { label: 'Volleyball', startIdx: 0 },
      { label: 'Basketball', startIdx: vbTeams.length },
    ]
    const teamLabel = filterTeams.size === 0
      ? allTeamsLabel
      : `${filterTeams.size} Team${filterTeams.size > 1 ? 's' : ''}`

    filters.appendChild(makeDropdown(
      teamLabel,
      filterTeams.size > 0,
      teamOptions,
      teamGroups,
      (id, checked) => {
        if (checked) {
          filterTeams.add(id)
        } else {
          filterTeams.delete(id)
        }
        // If all teams selected, reset to empty (= all)
        if (filterTeams.size >= allTeams.length) {
          filterTeams.clear()
        }
        render()
      }
    ))

    toolbar.appendChild(filters)

    // -- Subscribe button --
    const subBtn = document.createElement('button')
    subBtn.type = 'button'
    subBtn.className = 'cal-subscribe-btn'
    // Calendar download SVG icon
    const calSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    calSvg.setAttribute('width', '16')
    calSvg.setAttribute('height', '16')
    calSvg.setAttribute('viewBox', '0 0 24 24')
    calSvg.setAttribute('fill', 'none')
    calSvg.setAttribute('stroke', 'currentColor')
    calSvg.setAttribute('stroke-width', '2')
    calSvg.setAttribute('stroke-linecap', 'round')
    calSvg.setAttribute('stroke-linejoin', 'round')
    const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p1.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4')
    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    p2.setAttribute('points', '7 10 12 15 17 10')
    const p3 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    p3.setAttribute('x1', '12'); p3.setAttribute('x2', '12')
    p3.setAttribute('y1', '15'); p3.setAttribute('y2', '3')
    calSvg.append(p1, p2, p3)
    subBtn.appendChild(calSvg)
    subBtn.appendChild(document.createTextNode(subscribeTitle))
    subBtn.addEventListener('click', () => showSubscribeModal())
    toolbar.appendChild(subBtn)

    return toolbar
  }

  // -- Generic dropdown builder --
  function makeDropdown(
    label: string,
    isActive: boolean,
    options: { id: string; label: string; checked: boolean }[],
    groups: { label: string; startIdx: number }[],
    onChange: (id: string, checked: boolean) => void
  ): HTMLElement {
    const wrap = el('div', 'cal-filter-wrap')

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cal-filter-btn' + (isActive ? ' active' : '')
    btn.textContent = label
    const arrow = el('span', 'cal-filter-arrow', '\u25BC')
    btn.appendChild(arrow)

    const dropdown = el('div', 'cal-filter-dropdown')
    dropdown.style.display = 'none'

    let groupIdx = 0
    for (let i = 0; i < options.length; i++) {
      // Insert group label if needed
      if (groups.length > 0 && groupIdx < groups.length && i === groups[groupIdx].startIdx) {
        dropdown.appendChild(el('div', 'cal-filter-group-label', groups[groupIdx].label))
        groupIdx++
      }

      const opt = options[i]
      const lbl = document.createElement('label')
      lbl.className = 'cal-filter-option'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = opt.checked
      cb.addEventListener('change', () => {
        onChange(opt.id, cb.checked)
      })
      lbl.appendChild(cb)
      lbl.appendChild(document.createTextNode(opt.label))
      dropdown.appendChild(lbl)
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const isOpen = btn.classList.contains('open')
      closeAllDropdowns()
      if (!isOpen) {
        btn.classList.add('open')
        dropdown.style.display = 'block'
      }
    })

    dropdown.addEventListener('click', (e) => e.stopPropagation())

    wrap.appendChild(btn)
    wrap.appendChild(dropdown)
    return wrap
  }

  // -- Render calendar --
  async function render(): Promise<void> {
    container!.textContent = ''
    container!.appendChild(el('div', 'cal-loading', loadingLabel))
    await fetchGames(currentMonth)

    const mStart = startOfMonth(currentMonth)
    const mEnd = endOfMonth(currentMonth)
    const gridStart = startOfWeek(mStart)
    const gridEnd = endOfWeek(mEnd)
    const days = eachDay(gridStart, gridEnd)
    const today = new Date()

    // Apply filters
    const filteredGames = applyFilters(games)

    // Group games by date key
    const gamesByDate = new Map<string, PBGame[]>()
    for (const g of filteredGames) {
      const key = g.date.slice(0, 10)
      if (!gamesByDate.has(key)) gamesByDate.set(key, [])
      gamesByDate.get(key)!.push(g)
    }

    // Group events by date key
    const eventsByDate = new Map<string, CalendarEvent[]>()
    for (const ev of calEvents) {
      const key = ev.date.slice(0, 10)
      if (!eventsByDate.has(key)) eventsByDate.set(key, [])
      eventsByDate.get(key)!.push(ev)
    }

    container!.textContent = ''

    // Toolbar (filters + subscribe)
    container!.appendChild(renderToolbar())

    // Header: prev / month-year + today / next
    const header = el('div', 'cal-header')

    const prevBtn = document.createElement('button')
    prevBtn.type = 'button'
    prevBtn.className = 'cal-nav-btn'
    prevBtn.setAttribute('aria-label', 'Previous month')
    const prevSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    prevSvg.setAttribute('width', '20')
    prevSvg.setAttribute('height', '20')
    prevSvg.setAttribute('viewBox', '0 0 24 24')
    prevSvg.setAttribute('fill', 'none')
    prevSvg.setAttribute('stroke', 'currentColor')
    prevSvg.setAttribute('stroke-width', '2')
    prevSvg.setAttribute('stroke-linecap', 'round')
    prevSvg.setAttribute('stroke-linejoin', 'round')
    const prevPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    prevPath.setAttribute('d', 'M15 19l-7-7 7-7')
    prevSvg.appendChild(prevPath)
    prevBtn.appendChild(prevSvg)
    prevBtn.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
      render()
    })

    const nextBtn = document.createElement('button')
    nextBtn.type = 'button'
    nextBtn.className = 'cal-nav-btn'
    nextBtn.setAttribute('aria-label', 'Next month')
    const nextSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    nextSvg.setAttribute('width', '20')
    nextSvg.setAttribute('height', '20')
    nextSvg.setAttribute('viewBox', '0 0 24 24')
    nextSvg.setAttribute('fill', 'none')
    nextSvg.setAttribute('stroke', 'currentColor')
    nextSvg.setAttribute('stroke-width', '2')
    nextSvg.setAttribute('stroke-linecap', 'round')
    nextSvg.setAttribute('stroke-linejoin', 'round')
    const nextPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    nextPath.setAttribute('d', 'M9 5l7 7-7 7')
    nextSvg.appendChild(nextPath)
    nextBtn.appendChild(nextSvg)
    nextBtn.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
      render()
    })

    const titleEl = el('div', 'cal-title')
    titleEl.appendChild(el('span', 'cal-month-label', `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`))
    const todayBtn = document.createElement('button')
    todayBtn.type = 'button'
    todayBtn.className = 'cal-today-btn'
    todayBtn.textContent = todayLabel
    todayBtn.addEventListener('click', () => {
      currentMonth = new Date()
      currentMonth.setDate(1)
      render()
    })
    titleEl.appendChild(todayBtn)

    header.appendChild(prevBtn)
    header.appendChild(titleEl)
    header.appendChild(nextBtn)
    container!.appendChild(header)

    // Day-of-week headers
    const dow = el('div', 'cal-dow')
    for (const d of dayHeaders) {
      dow.appendChild(el('div', 'cal-dow-cell', d))
    }
    container!.appendChild(dow)

    // Grid
    const grid = el('div', 'cal-grid')

    for (const date of days) {
      const key = toDateKey(date)
      const inMonth = isSameMonth(date, currentMonth)
      const isToday_ = isSameDay(date, today)
      const dayGames = gamesByDate.get(key) || []

      const cell = el('div', 'cal-cell')
      if (!inMonth) cell.classList.add('cal-cell--outside')
      if (isToday_) cell.classList.add('cal-cell--today')

      const num = el('div', 'cal-day-num', String(date.getDate()))
      if (isToday_) num.classList.add('cal-day-num--today')
      cell.appendChild(num)

      const dayEvents = eventsByDate.get(key) || []
      const allEntries = dayGames.length + dayEvents.length

      if (inMonth && allEntries > 0) {
        const entriesDiv = el('div', 'cal-entries')
        const maxVisible = window.innerWidth < 640 ? 2 : 3
        let count = 0

        for (const g of dayGames) {
          if (count >= maxVisible) break
          entriesDiv.appendChild(gameChip(g))
          count++
        }

        for (const ev of dayEvents) {
          if (count >= maxVisible) break
          entriesDiv.appendChild(eventChip(ev))
          count++
        }

        const overflow = allEntries - maxVisible
        if (overflow > 0) {
          const more = document.createElement('button')
          more.type = 'button'
          more.className = 'cal-overflow'
          more.textContent = `+${overflow}`
          more.addEventListener('click', (e) => {
            e.stopPropagation()
            showDayModal(date, dayGames, dayEvents)
          })
          entriesDiv.appendChild(more)
        }

        cell.appendChild(entriesDiv)
      }

      grid.appendChild(cell)
    }

    container!.appendChild(grid)
  }

  // -- Day overflow modal --
  function showDayModal(date: Date, dayGames: PBGame[], dayEvents: CalendarEvent[] = []): void {
    const overlay = el('div', 'cal-modal-overlay')
    overlay.addEventListener('click', () => overlay.remove())

    const modal = el('div', 'cal-modal')
    modal.addEventListener('click', (e) => e.stopPropagation())

    const dateStr = date.toLocaleDateString(lang === 'de' ? 'de-CH' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    })

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'cal-modal-close'
    closeBtn.textContent = '\u00D7'
    closeBtn.addEventListener('click', () => overlay.remove())

    modal.appendChild(closeBtn)
    modal.appendChild(el('h3', 'cal-modal-title', dateStr))

    for (const g of dayGames) {
      const row = el('div', 'cal-modal-row')

      const isHome = g.type === 'home'
      const isBB = getTeamSport(g) === 'basketball'
      const typeLabel = isHome ? homeLabel : awayLabel

      const rowHdr = el('div', 'cal-modal-row-header')
      rowHdr.appendChild(el('span', `cal-tooltip-sport cal-tooltip-sport--${isBB ? 'bb' : 'vb'}`, isBB ? 'BB' : 'VB'))
      rowHdr.appendChild(el('span', `cal-tooltip-type cal-tooltip-type--${isHome ? 'home' : 'away'}`, typeLabel))
      if (g.time) rowHdr.appendChild(el('span', 'cal-modal-time', g.time.slice(0, 5)))
      row.appendChild(rowHdr)

      let teamsText = `${g.home_team} vs ${g.away_team}`
      if (g.status === 'completed' && (g.home_score || g.away_score)) {
        teamsText += ` \u2014 ${g.home_score}:${g.away_score}`
      }
      row.appendChild(el('div', 'cal-modal-teams', teamsText))

      const hall = g.expand?.hall
      if (hall) {
        row.appendChild(el('div', 'cal-modal-hall', [hall.name, hall.city].filter(Boolean).join(', ')))
      }

      modal.appendChild(row)
    }

    for (const ev of dayEvents) {
      const row = el('div', 'cal-modal-row cal-modal-row--event')

      const rowHdr = el('div', 'cal-modal-row-header')
      const catLabel = ev.category.charAt(0).toUpperCase() + ev.category.slice(1)
      rowHdr.appendChild(el('span', 'cal-tooltip-sport cal-tooltip-sport--event', catLabel))
      if (ev.time) rowHdr.appendChild(el('span', 'cal-modal-time', ev.time))
      row.appendChild(rowHdr)

      row.appendChild(el('div', 'cal-modal-teams', ev.title))

      if (ev.location) {
        row.appendChild(el('div', 'cal-modal-hall', ev.location))
      }

      if (ev.body) {
        const desc = document.createElement('div')
        desc.className = 'cal-modal-desc'
        // SAFE: ev.body is admin-authored content sanitized with DOMPurify at save time.
        desc.innerHTML = ev.body
        row.appendChild(desc)
      }

      modal.appendChild(row)
    }

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler) }
    }
    document.addEventListener('keydown', escHandler)
  }

  // -- iCal Subscribe Modal --
  function showSubscribeModal(): void {
    closeAllDropdowns()

    const overlay = el('div', 'cal-modal-overlay')
    overlay.addEventListener('click', () => overlay.remove())

    const modal = el('div', 'cal-modal')
    modal.style.maxWidth = '520px'
    modal.addEventListener('click', (e) => e.stopPropagation())

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'cal-modal-close'
    closeBtn.textContent = '\u00D7'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    modal.appendChild(el('h3', 'cal-modal-title', subscribeTitle))

    // State for subscribe modal
    const subSources = { home: true, away: true, events: true }
    const subSports = { volleyball: true, basketball: true }
    const subTeams = new Set<string>() // tracks EXCLUDED team IDs

    // -- Sources section --
    const srcSection = el('div', 'cal-sub-section')
    srcSection.appendChild(el('div', 'cal-sub-section-title', lang === 'de' ? 'Quellen' : 'Sources'))
    const srcChecks = el('div', 'cal-sub-checks')
    srcChecks.appendChild(makeCheckLabel(homeGamesLabel, true, (c) => { subSources.home = c }))
    srcChecks.appendChild(makeCheckLabel(awayGamesLabel, true, (c) => { subSources.away = c }))
    srcChecks.appendChild(makeCheckLabel(eventsLabel, true, (c) => { subSources.events = c }))
    srcSection.appendChild(srcChecks)
    modal.appendChild(srcSection)

    // -- Sport section --
    const sportSection = el('div', 'cal-sub-section')
    sportSection.appendChild(el('div', 'cal-sub-section-title', lang === 'de' ? 'Sportart' : 'Sport'))
    const sportChecks = el('div', 'cal-sub-checks')
    sportChecks.appendChild(makeCheckLabel('Volleyball', true, (c) => { subSports.volleyball = c }))
    sportChecks.appendChild(makeCheckLabel('Basketball', true, (c) => { subSports.basketball = c }))
    sportSection.appendChild(sportChecks)
    modal.appendChild(sportSection)

    // -- Teams section --
    const teamSection = el('div', 'cal-sub-section')
    teamSection.appendChild(el('div', 'cal-sub-section-title', 'Teams'))
    const teamDiv = el('div', 'cal-sub-teams')

    const vbTeams = allTeams.filter(t => t.sport === 'volleyball')
    const bbTeams = allTeams.filter(t => t.sport === 'basketball')

    if (vbTeams.length > 0) {
      teamDiv.appendChild(el('div', 'cal-filter-group-label', 'Volleyball'))
      for (const t of vbTeams) {
        teamDiv.appendChild(makeCheckLabel(t.name, true, (c) => {
          if (c) subTeams.delete(t.id); else subTeams.add(t.id)
        }))
      }
    }
    if (bbTeams.length > 0) {
      teamDiv.appendChild(el('div', 'cal-filter-group-label', 'Basketball'))
      for (const t of bbTeams) {
        teamDiv.appendChild(makeCheckLabel(t.name, true, (c) => {
          if (c) subTeams.delete(t.id); else subTeams.add(t.id)
        }))
      }
    }

    teamSection.appendChild(teamDiv)
    modal.appendChild(teamSection)

    // -- Action buttons --
    const actions = el('div', 'cal-sub-actions')

    const subBtnEl = document.createElement('button')
    subBtnEl.type = 'button'
    subBtnEl.className = 'btn btn-primary'
    subBtnEl.textContent = subscribeLabel
    subBtnEl.addEventListener('click', () => {
      const url = buildIcalUrl('webcal', subSources, subSports, subTeams)
      window.location.href = url
    })

    const dlBtn = document.createElement('button')
    dlBtn.type = 'button'
    dlBtn.className = 'btn btn-outline'
    dlBtn.textContent = downloadLabel
    dlBtn.addEventListener('click', () => {
      const url = buildIcalUrl('https', subSources, subSports, subTeams)
      window.open(url, '_blank')
    })

    actions.appendChild(subBtnEl)
    actions.appendChild(dlBtn)
    modal.appendChild(actions)

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler) }
    }
    document.addEventListener('keydown', escHandler)
  }

  function makeCheckLabel(text: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const lbl = document.createElement('label')
    lbl.className = 'cal-sub-check'
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = checked
    cb.addEventListener('change', () => onChange(cb.checked))
    lbl.appendChild(cb)
    lbl.appendChild(document.createTextNode(text))
    return lbl
  }

  function buildIcalUrl(
    protocol: string,
    sources: { home: boolean; away: boolean; events: boolean },
    sports: { volleyball: boolean; basketball: boolean },
    excludedTeams: Set<string>
  ): string {
    const srcParts: string[] = []
    if (sources.home) srcParts.push('games-home')
    if (sources.away) srcParts.push('games-away')
    if (sources.events) srcParts.push('events')

    const params = new URLSearchParams()
    if (srcParts.length > 0 && srcParts.length < 3) {
      params.set('source', srcParts.join(','))
    }

    // Sport-specific route or param
    const onlyVB = sports.volleyball && !sports.basketball
    const onlyBB = sports.basketball && !sports.volleyball
    let path = '/api/ical'
    if (onlyVB) path = '/api/ical/volleyball'
    else if (onlyBB) path = '/api/ical/basketball'

    // Team filter: include only non-excluded teams
    if (excludedTeams.size > 0) {
      const included = allTeams
        .filter(t => !excludedTeams.has(t.id))
        .map(t => t.id)
      if (included.length > 0 && included.length < allTeams.length) {
        params.set('team', included.join(','))
      }
    }

    const qs = params.toString()
    return `${protocol}://api.kscw.ch${path}${qs ? '?' + qs : ''}`
  }

  // Close dropdowns on outside click
  document.addEventListener('click', () => closeAllDropdowns())

  // Initial load
  fetchTeams().then(() => render())
}
