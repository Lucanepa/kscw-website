// Calendar Grid — Vanilla JS month grid fetching games from PocketBase
// Mirrors the Wiedisync CalendarGrid visual style

const PB_URL = 'https://kscw-api.lucanepa.com'

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
    kscw_team?: { name: string; sport: string }
    hall?: { name: string; address: string; city: string }
  }
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

  let currentMonth = new Date()
  currentMonth.setDate(1)
  let games: PBGame[] = []
  let fetchedRange = ''
  let activeTooltip: HTMLElement | null = null

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

  // -- Build game entry chip --
  function gameChip(g: PBGame): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cal-entry'

    const isHome = g.type === 'home'
    btn.classList.add(isHome ? 'cal-entry--home' : 'cal-entry--away')

    if (g.time) {
      btn.appendChild(el('span', 'cal-entry-time', g.time.slice(0, 5)))
    }

    const opponent = isHome ? g.away_team : g.home_team
    const short = opponent.replace(/^KSC Wiedikon\s*/i, '').trim()
    btn.appendChild(el('span', 'cal-entry-title', short || opponent))

    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      showTooltip(g, btn)
    })

    return btn
  }

  // -- Tooltip --
  function showTooltip(g: PBGame, anchor: HTMLElement): void {
    closeTooltip()
    const tip = document.createElement('div')
    tip.className = 'cal-tooltip'

    const isHome = g.type === 'home'
    const isBB = g.game_id?.startsWith('bb_')
    const sportLabel = isBB ? 'Basketball' : 'Volleyball'
    const typeLabel = isHome ? homeLabel : awayLabel

    const dateObj = new Date(g.date)
    const dateStr = dateObj.toLocaleDateString(lang === 'de' ? 'de-CH' : 'en-GB', {
      weekday: 'short', day: 'numeric', month: 'long',
    })

    // Header row
    const hdr = el('div', 'cal-tooltip-header')
    hdr.appendChild(el('span', `cal-tooltip-sport cal-tooltip-sport--${isBB ? 'bb' : 'vb'}`, sportLabel))
    hdr.appendChild(el('span', `cal-tooltip-type cal-tooltip-type--${isHome ? 'home' : 'away'}`, typeLabel))
    tip.appendChild(hdr)

    // Teams
    tip.appendChild(el('div', 'cal-tooltip-teams', `${g.home_team} vs ${g.away_team}`))

    // Meta (date/time + score)
    const meta = el('div', 'cal-tooltip-meta')
    meta.appendChild(el('span', undefined, `${dateStr}${g.time ? ', ' + g.time.slice(0, 5) : ''}`))
    if (g.status === 'completed' && (g.home_score || g.away_score)) {
      meta.appendChild(el('span', 'cal-tooltip-score', `${g.home_score}:${g.away_score}`))
    }
    tip.appendChild(meta)

    // Hall
    const hall = g.expand?.hall
    if (hall) {
      const parts = [hall.name, hall.address, hall.city].filter(Boolean).join(', ')
      tip.appendChild(el('div', 'cal-tooltip-hall', parts))
    }

    document.body.appendChild(tip)
    activeTooltip = tip

    // Position
    const rect = anchor.getBoundingClientRect()
    const tipRect = tip.getBoundingClientRect()
    let top = rect.bottom + 4
    let left = rect.left + rect.width / 2 - tipRect.width / 2

    if (left < 8) left = 8
    if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8
    if (top + tipRect.height > window.innerHeight - 8) top = rect.top - tipRect.height - 4

    tip.style.top = `${top + window.scrollY}px`
    tip.style.left = `${left + window.scrollX}px`

    setTimeout(() => {
      document.addEventListener('click', closeTooltip, { once: true })
    }, 0)
  }

  function closeTooltip(): void {
    if (activeTooltip) {
      activeTooltip.remove()
      activeTooltip = null
    }
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

    // Group games by date key
    const gamesByDate = new Map<string, PBGame[]>()
    for (const g of games) {
      const key = g.date.slice(0, 10)
      if (!gamesByDate.has(key)) gamesByDate.set(key, [])
      gamesByDate.get(key)!.push(g)
    }

    container!.textContent = ''

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

      if (inMonth && dayGames.length > 0) {
        const entriesDiv = el('div', 'cal-entries')
        const maxVisible = window.innerWidth < 640 ? 2 : 3
        const visible = dayGames.slice(0, maxVisible)
        const overflow = dayGames.length - maxVisible

        for (const g of visible) {
          entriesDiv.appendChild(gameChip(g))
        }

        if (overflow > 0) {
          const more = document.createElement('button')
          more.type = 'button'
          more.className = 'cal-overflow'
          more.textContent = `+${overflow}`
          more.addEventListener('click', (e) => {
            e.stopPropagation()
            showDayModal(date, dayGames)
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
  function showDayModal(date: Date, dayGames: PBGame[]): void {
    closeTooltip()
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
      const isBB = g.game_id?.startsWith('bb_')
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

    overlay.appendChild(modal)
    document.body.appendChild(overlay)
  }

  // Initial render
  render()
}
