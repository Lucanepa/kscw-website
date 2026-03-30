# PocketBase → Directus Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all PocketBase API calls with Directus REST, eliminate `data.js` global pattern in favor of per-page fetch modules, rewrite admin page auth/CRUD, and migrate file assets.

**Architecture:** Thin typed fetch wrapper (`src/lib/directus.ts`) with runtime hostname detection (prod/dev). Per-page fetch modules replace the monolithic `data.js`. Admin page uses Directus REST directly (no SDK). Custom endpoints reused from wiedisync (`/kscw/*`).

**Tech Stack:** Astro (static), TypeScript, vanilla JS (islands), Directus REST API, Cloudflare Pages, Turnstile CAPTCHA.

**Spec:** `docs/superpowers/specs/2026-03-30-directus-migration-design.md`

**Reference:** wiedisync API client at `~/Desktop/Github/wiedisync/src/lib/api.ts` — adapt patterns for non-SDK fetch wrapper.

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `src/lib/directus.ts` | Directus REST fetch wrapper, URL detection, asset URLs, auth helpers |
| `src/lib/utils.ts` | Date formatting, game helpers extracted from `data.js` |
| `src/lib/fetch/teams.ts` | Fetch active teams, merge with static TeamDef |
| `src/lib/fetch/games.ts` | Fetch games with team/hall relations |
| `src/lib/fetch/rankings.ts` | Fetch rankings grouped by league |
| `src/lib/fetch/news.ts` | Fetch published news with asset URLs |
| `src/lib/fetch/events.ts` | Fetch events (build-time and client-side) |
| `src/lib/fetch/sponsors.ts` | Fetch sponsors with logos |
| `src/lib/fetch/team-detail.ts` | Fetch single team via custom endpoint |
| `scripts/migrate-assets.ts` | One-time PB→Directus file migration (not committed) |

### Modified Files

| File | Changes |
|---|---|
| `src/data/teams.ts` | Replace `pbId` with `directusId`, update `TeamDef` interface |
| `src/pages/admin.astro` | Remove PB SDK, rewrite auth + CRUD to Directus REST |
| `src/islands/calendar-grid.ts` | Replace PB fetches with directus.ts imports |
| `src/pages/de/index.astro` | Replace build-time PB fetch with directus.ts |
| `src/pages/en/index.astro` | Same as DE homepage |
| `src/pages/de/weiteres/kalender.astro` | Replace build-time event fetch |
| `src/pages/en/weiteres/kalender.astro` | Same as DE calendar |
| `src/pages/de/sponsoren/index.astro` | Replace inline PB sponsor fetch |
| `src/pages/en/sponsoren/index.astro` | Same as DE sponsors |
| `public/js/team-page.js` | Replace PB API calls + window.KSCW usage with direct Directus fetch |
| `public/js/scoreboard.js` | Replace window.KSCW dependency with direct Directus fetch |
| `public/js/game-modal.js` | Replace window.KSCW helpers with local utils |
| `public/js/news-modal.js` | Update image URL patterns for Directus assets |
| `public/js/feedback-form.js` | Replace PB endpoint with Directus REST |
| `public/js/contact-form.js` | Replace PB endpoints with Directus REST + custom endpoint |
| `public/_headers` | Update CSP connect-src and img-src |
| `src/pages/de/volleyball/[slug].astro` | Replace `pbId` with `directusId` in TEAM_CONFIG, remove data.js |
| `src/pages/en/volleyball/[slug].astro` | Same as DE volleyball slug |
| `src/pages/de/basketball/[slug].astro` | Replace `pbId` with `directusId` in TEAM_CONFIG, remove data.js |
| `src/pages/en/basketball/[slug].astro` | Same as DE basketball slug |
| `src/pages/de/club/kontakt.astro` | Remove data.js script tag, replace any window.KSCW usage |
| `src/pages/en/club/kontakt.astro` | Same as DE contact |
| `tests/e2e/admin.spec.ts` | Update PB_URL to Directus URL |
| `README.md` | Update api.kscw.ch reference |

### Deleted Files

| File | Reason |
|---|---|
| `public/js/data.js` | Replaced by per-page fetch modules |
| `src/lib/pocketbase.ts` | Replaced by `src/lib/directus.ts` |

---

## Layer 1: Foundation

### Task 1: Create Directus fetch wrapper (`src/lib/directus.ts`)

**Files:**
- Create: `src/lib/directus.ts`
- Reference: `~/Desktop/Github/wiedisync/src/lib/api.ts`

- [ ] **Step 1: Create `src/lib/directus.ts` with URL detection and core fetch**

```typescript
/**
 * Directus REST API wrapper for kscw-website.
 * No SDK dependency — plain fetch with typed helpers.
 */

// ── Config ──────────────────────────────────────────────────────────

function getDirectusUrl(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h === 'kscw.ch' || h === 'www.kscw.ch') return 'https://directus.kscw.ch'
    return 'https://directus-dev.kscw.ch'
  }
  return import.meta.env.DIRECTUS_URL || 'https://directus-dev.kscw.ch'
}

/** Use this for build-time code (Astro frontmatter). For client-side, use getDirectusUrl() directly. */
export const DIRECTUS_URL = getDirectusUrl()
export { getDirectusUrl }

// ── Core fetch ──────────────────────────────────────────────────────

/** JSON-only fetch. For FormData uploads, use createRecord/updateRecord which bypass this. */
export async function directusFetch<T>(
  path: string,
  options?: RequestInit & { token?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options?.headers as Record<string, string> ?? {}),
  }
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Directus ${path}: ${res.status} ${body}`)
  }
  return res.json()
}

// ── Collection queries ──────────────────────────────────────────────

interface QueryParams {
  filter?: Record<string, unknown>
  sort?: string[]
  fields?: string[]
  limit?: number
  offset?: number
}

function buildQueryString(params: QueryParams): string {
  const parts: string[] = []
  if (params.filter) parts.push(`filter=${encodeURIComponent(JSON.stringify(params.filter))}`)
  if (params.sort?.length) parts.push(`sort=${params.sort.join(',')}`)
  if (params.fields?.length) parts.push(`fields=${params.fields.join(',')}`)
  if (params.limit !== undefined) parts.push(`limit=${params.limit}`)
  if (params.offset !== undefined) parts.push(`offset=${params.offset}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export async function fetchItems<T = Record<string, unknown>>(
  collection: string,
  params?: QueryParams,
): Promise<T[]> {
  const qs = params ? buildQueryString(params) : ''
  const res = await directusFetch<{ data: T[] }>(`/items/${collection}${qs}`)
  return res.data
}

export async function fetchAllItems<T = Record<string, unknown>>(
  collection: string,
  params?: Omit<QueryParams, 'limit'>,
): Promise<T[]> {
  return fetchItems<T>(collection, { ...params, limit: -1 })
}

export async function fetchItem<T = Record<string, unknown>>(
  collection: string,
  id: string | number,
  fields?: string[],
): Promise<T> {
  const qs = fields?.length ? `?fields=${fields.join(',')}` : ''
  const res = await directusFetch<{ data: T }>(`/items/${collection}/${id}${qs}`)
  return res.data
}

// ── Mutations ───────────────────────────────────────────────────────

export async function createRecord<T = Record<string, unknown>>(
  collection: string,
  data: Record<string, unknown> | FormData,
  token: string,
): Promise<T> {
  const isForm = data instanceof FormData
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}`, {
    method: 'POST',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
    },
    body: isForm ? data : JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Create ${collection}: ${res.status}`)
  return (await res.json()).data
}

export async function updateRecord<T = Record<string, unknown>>(
  collection: string,
  id: string | number,
  data: Record<string, unknown> | FormData,
  token: string,
): Promise<T> {
  const isForm = data instanceof FormData
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}/${id}`, {
    method: 'PATCH',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
    },
    body: isForm ? data : JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Update ${collection}/${id}: ${res.status}`)
  return (await res.json()).data
}

export async function deleteRecord(
  collection: string,
  id: string | number,
  token: string,
): Promise<void> {
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Delete ${collection}/${id}: ${res.status}`)
}

// ── Auth ────────────────────────────────────────────────────────────

interface AuthResult {
  access_token: string
  refresh_token: string
  expires: number
}

export async function login(email: string, password: string): Promise<AuthResult> {
  return directusFetch<{ data: AuthResult }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }).then(r => r.data)
}

export async function refreshToken(token: string): Promise<AuthResult> {
  return directusFetch<{ data: AuthResult }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: token, mode: 'json' }),
  }).then(r => r.data)
}

export async function getCurrentUser(token: string) {
  return directusFetch<{ data: { id: string; email: string; role: { name: string } } }>(
    '/users/me?fields=id,email,first_name,last_name,role.name',
    { token },
  ).then(r => r.data)
}

// ── Assets ──────────────────────────────────────────────────────────

export function assetUrl(fileId: string | null | undefined, transforms?: string): string {
  if (!fileId) return ''
  return transforms
    ? `${DIRECTUS_URL}/assets/${fileId}?${transforms}`
    : `${DIRECTUS_URL}/assets/${fileId}`
}

// ── Custom KSCW endpoints ───────────────────────────────────────────

export async function kscwApi<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> },
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...options?.headers,
  }
  const res = await fetch(`${DIRECTUS_URL}/kscw${path}`, {
    method: options?.method || 'GET',
    headers,
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  })
  if (!res.ok) throw new Error(`KSCW API ${path}: ${res.status}`)
  return res.json()
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/luca-canepa/Desktop/Github/kscw-website && npx tsc --noEmit src/lib/directus.ts 2>&1 || echo "Check for type errors"`

- [ ] **Step 3: Commit**

```bash
git add src/lib/directus.ts
git commit -m "feat: add Directus REST fetch wrapper (replaces PocketBase)"
```

### Task 2: Create utility helpers (`src/lib/utils.ts`)

**Files:**
- Create: `src/lib/utils.ts`
- Reference: `public/js/data.js:104-135` (helper functions to extract)

- [ ] **Step 1: Create `src/lib/utils.ts` with date and game helpers**

```typescript
/**
 * Shared utility functions — extracted from data.js.
 * Used by per-page fetch modules and vanilla JS islands.
 */

export function formatDate(isoDate: string, locale = 'de-CH'): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateLong(isoDate: string, locale = 'de-CH'): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatTime(time: string): string {
  if (!time) return ''
  return time.slice(0, 5) // "HH:MM:SS" → "HH:MM"
}

export function isWin(homeScore: number, awayScore: number, isHome: boolean): boolean {
  if (isHome) return homeScore > awayScore
  return awayScore > homeScore
}

export function getLeagueKey(sport: string, league: string): string {
  return `${sport}_${league}`.toLowerCase().replace(/\s+/g, '_')
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add shared utility helpers (extracted from data.js)"
```

### Task 3: Update `src/data/teams.ts` — replace `pbId` with `directusId`

**Files:**
- Modify: `src/data/teams.ts`

- [ ] **Step 1: Read `src/data/teams.ts` to get current `TeamDef` interface and all `pbId` values**

Read the file to capture all pbId → directusId mappings needed.

- [ ] **Step 2: Update the `TeamDef` interface**

Replace `pbId: string` with `directusId: string` in the interface definition (~line 26).

- [ ] **Step 3: Replace all `pbId:` values with `directusId:` values**

For each team, replace `pbId: '<pb-random-id>'` with `directusId: '<directus-integer-id>'`.

**To get Directus IDs:** Query `https://directus-dev.kscw.ch/items/teams?fields=id,name&filter[active][_eq]=true&limit=-1` and map each team name to its Directus integer ID.

- [ ] **Step 4: Verify build**

Run: `cd /home/luca-canepa/Desktop/Github/kscw-website && npx astro build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/data/teams.ts
git commit -m "feat: replace pbId with directusId in team definitions"
```

### Task 4: Migrate file assets from PocketBase to Directus

**Files:**
- Create: `scripts/migrate-assets.ts` (one-time, gitignored)

- [ ] **Step 1: Create migration script**

The script should:
1. Read all team records from PB (`https://api.kscw.ch/api/collections/teams/records?perPage=200`)
2. For each team with a `team_picture`, download the file from PB
3. Upload to Directus via `POST /files` (multipart/form-data with admin token)
4. Update the Directus team record with the new asset ID
5. Repeat for news images and sponsor logos
6. Output a mapping of old PB file URLs → new Directus asset IDs

- [ ] **Step 2: Run migration against dev**

Run: `DIRECTUS_URL=https://directus-dev.kscw.ch DIRECTUS_TOKEN=<admin-token> npx tsx scripts/migrate-assets.ts`

Verify: Check a few asset URLs in browser — `https://directus-dev.kscw.ch/assets/<id>?width=640`

- [ ] **Step 3: Run migration against prod**

Run: `DIRECTUS_URL=https://directus.kscw.ch DIRECTUS_TOKEN=<admin-token> npx tsx scripts/migrate-assets.ts`

- [ ] **Step 4: Add script to .gitignore**

```bash
echo "scripts/migrate-assets.ts" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore one-time migration script"
```

---

## Layer 2: Read Paths (Tasks 5-18 parallelizable, Task 19 depends on all others completing)

### Task 5: Create teams fetch module

**Files:**
- Create: `src/lib/fetch/teams.ts`
- Reference: `src/data/teams.ts` (static TeamDef), `public/js/data.js:138-220` (team mapping)

- [ ] **Step 1: Create `src/lib/fetch/teams.ts`**

```typescript
import { fetchAllItems, assetUrl } from '../directus'
import { allTeamDefs, type TeamDef } from '../../data/teams'

interface DirectusTeam {
  id: number
  name: string
  sport: string
  league: string
  color: string
  team_picture: string | null
  active: boolean
  slug: string
  full_name: string
  season: string
}

export interface Team extends TeamDef {
  league: string
  photoUrl: string
  season: string
}

export async function getActiveTeams(): Promise<Team[]> {
  const items = await fetchAllItems<DirectusTeam>('teams', {
    filter: { active: { _eq: true } },
    sort: ['sport', 'name'],
    fields: ['id', 'name', 'sport', 'league', 'color', 'team_picture', 'slug', 'full_name', 'season'],
  })
  return items
    .map(t => {
      const def = allTeamDefs.find(d => d.directusId === String(t.id))
      if (!def) return null
      return {
        ...def,
        league: t.league,
        photoUrl: assetUrl(t.team_picture, 'width=640&quality=80'),
        season: t.season,
      }
    })
    .filter((t): t is Team => t !== null)
}

export async function getTeamsBySport(sport: string): Promise<Team[]> {
  const teams = await getActiveTeams()
  return teams.filter(t => t.sport === sport)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fetch/teams.ts
git commit -m "feat: add teams fetch module (Directus)"
```

### Task 6: Create games fetch module

**Files:**
- Create: `src/lib/fetch/games.ts`
- Reference: `public/js/data.js:220-380` (game mapping), wiedisync game patterns

- [ ] **Step 1: Create `src/lib/fetch/games.ts`**

```typescript
import { fetchAllItems } from '../directus'
import { todayISO } from '../utils'

interface DirectusGame {
  id: number
  game_id: string
  date: string
  time: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string
  type: string
  league: string
  season: string
  sets_json: string | null
  kscw_team: { id: number; name: string; sport: string; color: string } | null
  hall: { id: number; name: string; address: string } | null
}

export interface Game {
  id: string
  gameId: string
  date: string
  time: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: string
  type: string
  league: string
  season: string
  setsJson: string | null
  teamId: string | null
  teamName: string | null
  teamSport: string | null
  teamColor: string | null
  hallName: string | null
  hallAddress: string | null
}

function mapGame(g: DirectusGame): Game {
  return {
    id: String(g.id),
    gameId: g.game_id,
    date: g.date,
    time: g.time,
    homeTeam: g.home_team,
    awayTeam: g.away_team,
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
    type: g.type,
    league: g.league,
    season: g.season,
    setsJson: g.sets_json,
    teamId: g.kscw_team ? String(g.kscw_team.id) : null,
    teamName: g.kscw_team?.name ?? null,
    teamSport: g.kscw_team?.sport ?? null,
    teamColor: g.kscw_team?.color ?? null,
    hallName: g.hall?.name ?? null,
    hallAddress: g.hall?.address ?? null,
  }
}

export async function getUpcomingGames(options?: { teamId?: string; sport?: string; limit?: number }): Promise<Game[]> {
  const conditions: Record<string, unknown>[] = [
    { date: { _gte: todayISO() } },
    { status: { _neq: 'cancelled' } },
  ]
  if (options?.teamId) conditions.push({ kscw_team: { _eq: options.teamId } })
  if (options?.sport) conditions.push({ kscw_team: { sport: { _eq: options.sport } } })

  const items = await fetchAllItems<DirectusGame>('games', {
    filter: { _and: conditions },
    sort: ['date', 'time'],
    fields: ['*', 'kscw_team.id', 'kscw_team.name', 'kscw_team.sport', 'kscw_team.color', 'hall.id', 'hall.name', 'hall.address'],
  })
  const mapped = items.map(mapGame)
  return options?.limit ? mapped.slice(0, options.limit) : mapped
}

export async function getCompletedGames(options?: { teamId?: string; sport?: string; limit?: number }): Promise<Game[]> {
  const conditions: Record<string, unknown>[] = [
    { status: { _eq: 'completed' } },
  ]
  if (options?.teamId) conditions.push({ kscw_team: { _eq: options.teamId } })
  if (options?.sport) conditions.push({ kscw_team: { sport: { _eq: options.sport } } })

  const items = await fetchAllItems<DirectusGame>('games', {
    filter: { _and: conditions },
    sort: ['-date', '-time'],
    fields: ['*', 'kscw_team.id', 'kscw_team.name', 'kscw_team.sport', 'kscw_team.color', 'hall.id', 'hall.name', 'hall.address'],
  })
  const mapped = items.map(mapGame)
  return options?.limit ? mapped.slice(0, options.limit) : mapped
}

export async function getAllGames(options?: { sport?: string }): Promise<Game[]> {
  const conditions: Record<string, unknown>[] = []
  if (options?.sport) conditions.push({ kscw_team: { sport: { _eq: options.sport } } })

  const items = await fetchAllItems<DirectusGame>('games', {
    filter: conditions.length ? { _and: conditions } : undefined,
    sort: ['-date', '-time'],
    fields: ['*', 'kscw_team.id', 'kscw_team.name', 'kscw_team.sport', 'kscw_team.color', 'hall.id', 'hall.name', 'hall.address'],
  })
  return items.map(mapGame)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fetch/games.ts
git commit -m "feat: add games fetch module (Directus)"
```

### Task 7: Create rankings fetch module

**Files:**
- Create: `src/lib/fetch/rankings.ts`
- Reference: `public/js/data.js:380-440` (rankings mapping)

- [ ] **Step 1: Create `src/lib/fetch/rankings.ts`**

```typescript
import { fetchAllItems } from '../directus'
import { getLeagueKey } from '../utils'

interface DirectusRanking {
  id: number
  rank: number
  team_id: string
  team_name: string
  league: string
  sport: string
  played: number
  won: number
  lost: number
  sets_won: number
  sets_lost: number
  points: number
}

export interface RankingEntry {
  rank: number
  teamId: string
  teamName: string
  played: number
  won: number
  lost: number
  setsWon: number
  setsLost: number
  points: number
}

export interface LeagueRankings {
  sport: string
  league: string
  key: string
  teams: RankingEntry[]
}

export async function getRankings(): Promise<Record<string, LeagueRankings>> {
  const items = await fetchAllItems<DirectusRanking>('rankings', {
    sort: ['sport', 'league', 'rank'],
    fields: ['rank', 'team_id', 'team_name', 'league', 'sport', 'played', 'won', 'lost', 'sets_won', 'sets_lost', 'points'],
  })

  const grouped: Record<string, LeagueRankings> = {}
  for (const r of items) {
    const key = getLeagueKey(r.sport, r.league)
    if (!grouped[key]) {
      grouped[key] = { sport: r.sport, league: r.league, key, teams: [] }
    }
    grouped[key].teams.push({
      rank: r.rank,
      teamId: r.team_id,
      teamName: r.team_name,
      played: r.played,
      won: r.won,
      lost: r.lost,
      setsWon: r.sets_won,
      setsLost: r.sets_lost,
      points: r.points,
    })
  }
  return grouped
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fetch/rankings.ts
git commit -m "feat: add rankings fetch module (Directus)"
```

### Task 8: Create news fetch module

**Files:**
- Create: `src/lib/fetch/news.ts`
- Reference: `src/pages/de/index.astro:9-30` (build-time), `public/js/data.js:440-480` (client-side)

- [ ] **Step 1: Create `src/lib/fetch/news.ts`**

```typescript
import { fetchItems, assetUrl } from '../directus'

interface DirectusNews {
  id: number
  title: string
  title_en: string | null
  slug: string
  excerpt: string | null
  body: string
  category: string
  author: string
  published_at: string
  is_published: boolean
  image: string | null
  date_created: string
}

export interface NewsArticle {
  id: string
  title: string
  titleEn: string | null
  slug: string
  excerpt: string | null
  body: string
  category: string
  author: string
  date: string
  imageUrl: string | null
}

function mapNews(n: DirectusNews): NewsArticle {
  return {
    id: String(n.id),
    title: n.title,
    titleEn: n.title_en,
    slug: n.slug,
    excerpt: n.excerpt,
    body: n.body,
    category: n.category,
    author: n.author,
    date: n.published_at || n.date_created,
    imageUrl: assetUrl(n.image, 'width=800&quality=80'),
  }
}

/** Build-time or client-side: fetch latest published news. */
export async function getLatestNews(limit = 6): Promise<NewsArticle[]> {
  const items = await fetchItems<DirectusNews>('news', {
    filter: { is_published: { _eq: true } },
    sort: ['-published_at'],
    fields: ['id', 'title', 'title_en', 'slug', 'excerpt', 'body', 'category', 'author', 'published_at', 'image', 'date_created'],
    limit,
  })
  return items.map(mapNews)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fetch/news.ts
git commit -m "feat: add news fetch module (Directus)"
```

### Task 9: Create events fetch module

**Files:**
- Create: `src/lib/fetch/events.ts`
- Reference: `src/pages/de/index.astro:32-48` (build-time), `src/pages/de/weiteres/kalender.astro`

- [ ] **Step 1: Create `src/lib/fetch/events.ts`**

```typescript
import { fetchItems, fetchAllItems } from '../directus'
import { todayISO } from '../utils'

interface DirectusEvent {
  id: number
  title: string
  event_type: string
  start_date: string
  end_date: string | null
  all_day: boolean
  location: string | null
  description: string | null
}

export interface CalendarEvent {
  id: string
  title: string
  eventType: string
  startDate: string
  endDate: string | null
  allDay: boolean
  location: string | null
  description: string | null
}

function mapEvent(e: DirectusEvent): CalendarEvent {
  return {
    id: String(e.id),
    title: e.title,
    eventType: e.event_type,
    startDate: e.start_date,
    endDate: e.end_date,
    allDay: e.all_day,
    location: e.location,
    description: e.description,
  }
}

/** Build-time: fetch upcoming events for homepage. */
export async function getUpcomingEvents(limit = 3): Promise<CalendarEvent[]> {
  const items = await fetchItems<DirectusEvent>('events', {
    filter: { start_date: { _gte: todayISO() } },
    sort: ['start_date'],
    fields: ['id', 'title', 'event_type', 'start_date', 'end_date', 'all_day', 'location', 'description'],
    limit,
  })
  return items.map(mapEvent)
}

/** Build-time: fetch all events for calendar page. */
export async function getAllEvents(): Promise<CalendarEvent[]> {
  const items = await fetchAllItems<DirectusEvent>('events', {
    sort: ['start_date'],
    fields: ['id', 'title', 'event_type', 'start_date', 'end_date', 'all_day', 'location', 'description'],
  })
  return items.map(mapEvent)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fetch/events.ts
git commit -m "feat: add events fetch module (Directus)"
```

### Task 10: Create sponsors fetch module

**Files:**
- Create: `src/lib/fetch/sponsors.ts`
- Reference: `src/pages/de/sponsoren/index.astro`, `src/lib/pocketbase.ts:55-60`

- [ ] **Step 1: Create `src/lib/fetch/sponsors.ts`**

```typescript
import { fetchAllItems, assetUrl } from '../directus'

interface DirectusSponsor {
  id: number
  name: string
  logo: string | null
  logo_url: string | null
  website_url: string | null
}

export interface Sponsor {
  id: string
  name: string
  logoUrl: string
  websiteUrl: string | null
}

export async function getSponsors(): Promise<Sponsor[]> {
  const items = await fetchAllItems<DirectusSponsor>('sponsors', {
    sort: ['name'],
    fields: ['id', 'name', 'logo', 'logo_url', 'website_url'],
  })
  return items.map(s => ({
    id: String(s.id),
    name: s.name,
    logoUrl: s.logo ? assetUrl(s.logo, 'width=300&quality=80') : (s.logo_url ?? ''),
    websiteUrl: s.website_url,
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fetch/sponsors.ts
git commit -m "feat: add sponsors fetch module (Directus)"
```

### Task 11: Create team detail fetch module

**Files:**
- Create: `src/lib/fetch/team-detail.ts`
- Reference: `public/js/team-page.js:15-100`, `src/lib/pocketbase.ts:49-53`

- [ ] **Step 1: Create `src/lib/fetch/team-detail.ts`**

```typescript
import { kscwApi, assetUrl } from '../directus'

export interface TeamDetail {
  id: string
  name: string
  fullName: string
  sport: string
  league: string
  color: string
  photoUrl: string
  season: string
  collectionId: string
  roster: Array<{ id: string; firstName: string; lastName: string; position: string | null }>
  coaches: Array<{ id: string; firstName: string; lastName: string }>
  trainings: Array<{ day: string; time: string; location: string }>
  sponsors: Array<{ id: string; name: string; logoUrl: string; websiteUrl: string | null }>
}

/** Fetch full team detail via custom endpoint. */
export async function getTeamDetail(teamId: string): Promise<TeamDetail> {
  const data = await kscwApi<any>(`/public/team/${teamId}`)
  return {
    id: String(data.id),
    name: data.name,
    fullName: data.full_name,
    sport: data.sport,
    league: data.league,
    color: data.color,
    photoUrl: assetUrl(data.team_picture, 'width=1280&quality=80'),
    season: data.season,
    collectionId: data.collectionId ?? '',
    roster: (data.roster ?? []).map((m: any) => ({
      id: String(m.id),
      firstName: m.first_name,
      lastName: m.last_name,
      position: m.position ?? null,
    })),
    coaches: (data.coaches ?? []).map((c: any) => ({
      id: String(c.id),
      firstName: c.first_name,
      lastName: c.last_name,
    })),
    trainings: data.trainings ?? [],
    sponsors: (data.sponsors ?? []).map((s: any) => ({
      id: String(s.id),
      name: s.name,
      logoUrl: s.logo ? assetUrl(s.logo, 'width=200&quality=80') : (s.logo_url ?? ''),
      websiteUrl: s.website_url ?? null,
    })),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fetch/team-detail.ts
git commit -m "feat: add team detail fetch module (Directus)"
```

### Task 12: Rewrite homepage build-time fetches (DE + EN)

**Files:**
- Modify: `src/pages/de/index.astro`
- Modify: `src/pages/en/index.astro`

- [ ] **Step 1: Read both homepage files to understand current frontmatter and template structure**

- [ ] **Step 2: Update DE homepage frontmatter**

Replace the PB fetch block in `src/pages/de/index.astro` frontmatter:
- Remove `const PB = 'https://api.kscw.ch'`
- Import from `../../lib/fetch/news` and `../../lib/fetch/events`
- Replace news fetch with `const newsArticles = await getLatestNews(6)`
- Replace events fetch with `const upcomingEvents = await getUpcomingEvents(3)`

- [ ] **Step 3: Update DE homepage template**

- Update news card image src: replace PB file URL pattern with `article.imageUrl`
- Update any inline `<script>` that fetches sponsors: replace PB URL with Directus import

- [ ] **Step 4: Apply same changes to EN homepage**

Mirror the DE changes in `src/pages/en/index.astro`.

- [ ] **Step 5: Test build**

Run: `npx astro build 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/pages/de/index.astro src/pages/en/index.astro
git commit -m "feat: homepage fetches from Directus (news, events, sponsors)"
```

### Task 13: Rewrite calendar pages (DE + EN) + calendar island

**Files:**
- Modify: `src/pages/de/weiteres/kalender.astro`
- Modify: `src/pages/en/weiteres/kalender.astro`
- Modify: `src/islands/calendar-grid.ts`

- [ ] **Step 1: Read all three files**

- [ ] **Step 2: Update calendar page frontmatter (DE)**

Replace PB event fetch with `import { getAllEvents } from '../../../lib/fetch/events'` and `const events = await getAllEvents()`.

- [ ] **Step 3: Update calendar island**

In `src/islands/calendar-grid.ts`:
- Remove `const PB_URL = 'https://api.kscw.ch'` (line 4)
- Replace game fetch with Directus REST: `${DIRECTUS_URL}/items/games?fields=*,kscw_team.id,kscw_team.name,kscw_team.sport,kscw_team.color,hall.id,hall.name,hall.address&filter=...&sort=date,time&limit=-1`
- Replace team fetch with Directus REST: `${DIRECTUS_URL}/items/teams?filter[active][_eq]=true&fields=id,name,sport,color&sort=sport,name&limit=-1`
- Import `DIRECTUS_URL` from directus.ts or inline the hostname detection for the island context

**Note:** Since this is a TS island compiled to client JS, it needs the runtime URL detection. Either import from directus.ts (if bundled) or inline a minimal `getDirectusUrl()`.

- [ ] **Step 4: Apply same calendar page changes to EN**

- [ ] **Step 5: Test build + verify calendar loads**

Run: `npx astro build && npx astro preview`

- [ ] **Step 6: Commit**

```bash
git add src/pages/de/weiteres/kalender.astro src/pages/en/weiteres/kalender.astro src/islands/calendar-grid.ts
git commit -m "feat: calendar pages + island fetch from Directus"
```

### Task 14: Rewrite sponsor pages (DE + EN)

**Files:**
- Modify: `src/pages/de/sponsoren/index.astro`
- Modify: `src/pages/en/sponsoren/index.astro`

- [ ] **Step 1: Read both sponsor pages**

- [ ] **Step 2: Update DE sponsor page**

- Replace inline `<script>` that fetches from `https://api.kscw.ch/api/public/sponsors` with build-time fetch in frontmatter using `getSponsors()` from `../../lib/fetch/sponsors`
- Render sponsor cards as static HTML (no client-side fetch needed — sponsors rarely change)
- Use `sponsor.logoUrl` for images (already Directus asset URL)

- [ ] **Step 3: Apply same changes to EN**

- [ ] **Step 4: Test build**

- [ ] **Step 5: Commit**

```bash
git add src/pages/de/sponsoren/index.astro src/pages/en/sponsoren/index.astro
git commit -m "feat: sponsor pages fetch from Directus (build-time)"
```

### Task 15: Rewrite `team-page.js`

**Files:**
- Modify: `public/js/team-page.js`

- [ ] **Step 1: Read `public/js/team-page.js` fully**

- [ ] **Step 2: Replace PB references**

- Remove `var PB = 'https://api.kscw.ch'` (line 15)
- Add Directus URL detection at top of file (inline, since this is a vanilla JS file in `public/`):
  ```javascript
  var DIRECTUS_URL = (window.location.hostname === 'kscw.ch' || window.location.hostname === 'www.kscw.ch')
    ? 'https://directus.kscw.ch' : 'https://directus-dev.kscw.ch';
  ```
- Replace `window.TEAM_CONFIG.pbId` usage with `window.TEAM_CONFIG.directusId`
- Replace team photo URL: `PB + '/api/files/...'` → `DIRECTUS_URL + '/assets/' + teamData.team_picture + '?width=1280&quality=80'`
- Replace roster/team detail fetch: use `/kscw/public/team/${teamId}` custom endpoint
- Remove all `window.KSCW` references — fetch data directly from Directus instead

- [ ] **Step 3: Update team detail `[slug].astro` templates (4 files)**

In each of these files, update `window.TEAM_CONFIG` to pass `directusId` instead of `pbId`, and remove the `<script is:inline src="/js/data.js">` tag:
- `src/pages/de/volleyball/[slug].astro`
- `src/pages/en/volleyball/[slug].astro`
- `src/pages/de/basketball/[slug].astro`
- `src/pages/en/basketball/[slug].astro`

Replace:
```javascript
window.TEAM_CONFIG = { short: short, pbId: pbId }
```
With:
```javascript
window.TEAM_CONFIG = { short: short, directusId: directusId }
```

Also remove any `<script is:inline src="/js/data.js"></script>` tags since team-page.js now fetches directly from Directus.

- [ ] **Step 4: Test a team page in dev**

Run: `npx astro dev` → visit a team page → verify roster, photo, games load

- [ ] **Step 5: Commit**

```bash
git add public/js/team-page.js src/pages/de/volleyball/\[slug\].astro src/pages/en/volleyball/\[slug\].astro src/pages/de/basketball/\[slug\].astro src/pages/en/basketball/\[slug\].astro
git commit -m "feat: team pages fetch from Directus (team-page.js + [slug].astro templates)"
```

### Task 16: Rewrite `scoreboard.js`

**Files:**
- Modify: `public/js/scoreboard.js`

- [ ] **Step 1: Read `public/js/scoreboard.js` fully**

- [ ] **Step 2: Replace `window.KSCW` dependency**

- Add Directus URL detection at top
- Replace `window.KSCW.rawRankings` usage with direct Directus fetch: `GET /items/rankings?sort=sport,league,rank&limit=-1`
- Replace `window.KSCW.teamIdMap` with team name lookup from rankings data
- Remove `kscw-data-ready` event listener — fetch data on DOMContentLoaded instead

- [ ] **Step 3: Test scoreboard rendering**

- [ ] **Step 4: Commit**

```bash
git add public/js/scoreboard.js
git commit -m "feat: scoreboard.js fetches rankings from Directus"
```

### Task 17: Rewrite `game-modal.js` and `news-modal.js`

**Files:**
- Modify: `public/js/game-modal.js`
- Modify: `public/js/news-modal.js`

- [ ] **Step 1: Read both files**

- [ ] **Step 2: Update `game-modal.js`**

- Remove `window.KSCW` references (`D.getTeam()`, `D.isWin()`, `D.formatDate()`)
- Inline the helper functions or import from a shared vanilla JS utility
- The modal receives game data via function call arguments — the data format will match the new `Game` interface from the calling page

- [ ] **Step 3: Update `news-modal.js`**

- The modal reads from embedded `<script type="application/json">` data attributes — these are rendered at build time
- Update image URL references: the build-time news data now uses `imageUrl` (Directus asset URL) instead of PB file URL
- No direct API calls to change — just data format alignment

- [ ] **Step 4: Test modals**

- [ ] **Step 5: Commit**

```bash
git add public/js/game-modal.js public/js/news-modal.js
git commit -m "feat: game/news modals use Directus data format"
```

### Task 18: Rewrite sport overview pages (volleyball + basketball, DE + EN)

**Files:**
- Modify: `src/pages/de/volleyball/index.astro`
- Modify: `src/pages/en/volleyball/index.astro`
- Modify: `src/pages/de/basketball/index.astro`
- Modify: `src/pages/en/basketball/index.astro`

- [ ] **Step 1: Read all four sport pages**

- [ ] **Step 2: Replace `window.KSCW` and `kscw-data-ready` patterns**

These pages likely listen for `kscw-data-ready` to populate games/rankings. Replace with:
- Build-time fetch for team lists (import from `../../lib/fetch/teams`)
- Client-side `<script>` that fetches games/rankings directly from Directus using inline URL detection

- [ ] **Step 3: Remove `<script src="/js/data.js">` script tags from these pages**

- [ ] **Step 4: Test all four pages**

- [ ] **Step 5: Commit**

```bash
git add src/pages/de/volleyball/index.astro src/pages/en/volleyball/index.astro src/pages/de/basketball/index.astro src/pages/en/basketball/index.astro
git commit -m "feat: sport overview pages fetch from Directus"
```

### Task 19: Delete `data.js` and `pocketbase.ts`

**Files:**
- Delete: `public/js/data.js`
- Delete: `src/lib/pocketbase.ts`

- [ ] **Step 1: Verify no remaining references**

Run:
```bash
grep -r "data\.js" src/ public/ --include="*.astro" --include="*.ts" --include="*.js"
grep -r "pocketbase" src/ --include="*.ts" --include="*.astro"
```

If any references remain, fix them first.

- [ ] **Step 2: Remove script tags**

Find and remove `<script src="/js/data.js"></script>` from any layout or page files that still include it.

- [ ] **Step 3: Delete the files**

```bash
rm public/js/data.js src/lib/pocketbase.ts
```

- [ ] **Step 4: Test build**

Run: `npx astro build 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add -u public/js/data.js src/lib/pocketbase.ts
# Also add any layout files where script tags were removed
git commit -m "feat: remove data.js and pocketbase.ts (replaced by Directus modules)"
```

---

## Layer 3: Write Paths (parallelizable with Layer 2)

### Task 20: Rewrite admin page auth + CRUD

**Files:**
- Modify: `src/pages/admin.astro`

- [ ] **Step 1: Read `src/pages/admin.astro` fully (1849 lines)**

Focus on: PB SDK CDN tag (~line 26), PB_URL/pb init (~lines 33-35), auth functions (~lines 181-320), CRUD functions (~lines 490-580), create/update (~lines 850-855), delete (~line 561).

- [ ] **Step 2: Remove PocketBase SDK CDN and init**

- Remove: `<script is:inline src="https://cdn.jsdelivr.net/npm/pocketbase@0.25.2/dist/pocketbase.umd.js"></script>`
- Remove: `var pb = new PocketBase(PB_URL)` and `var PB_URL = 'https://api.kscw.ch'`
- Add Directus URL detection and auth token management at top of script:

```javascript
var DIRECTUS_URL = (window.location.hostname === 'kscw.ch' || window.location.hostname === 'www.kscw.ch')
  ? 'https://directus.kscw.ch' : 'https://directus-dev.kscw.ch';

var AUTH_KEY = 'kscw_admin_auth';

function storeAuth(result) {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: Date.now() + result.expires, // Directus returns expires in ms
  }));
}

function getAuth() {
  var raw = sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

async function getValidToken() {
  var auth = getAuth();
  if (!auth) return null;
  if (auth.expires_at - Date.now() < 30000) {
    var res = await fetch(DIRECTUS_URL + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refresh_token, mode: 'json' }),
    });
    if (!res.ok) { sessionStorage.removeItem(AUTH_KEY); return null; }
    var data = await res.json();
    storeAuth(data.data);
    return data.data.access_token;
  }
  return auth.access_token;
}
```

- [ ] **Step 3: Rewrite login function**

Replace `pb.collection('members').authWithPassword(email, password, { headers: authHeaders })` with:

```javascript
var res = await fetch(DIRECTUS_URL + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: email, password: password }),
});
if (!res.ok) throw new Error('Login failed');
var data = await res.json();
storeAuth(data.data);
```

- [ ] **Step 4: Rewrite `isAuthorized()` function**

Replace PB authStore check with:

```javascript
async function isAuthorized() {
  var token = await getValidToken();
  if (!token) return false;
  var res = await fetch(DIRECTUS_URL + '/users/me?fields=id,email,first_name,last_name,role.name', {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) return false;
  var user = (await res.json()).data;
  var roleName = user.role ? user.role.name : '';
  return ['website_admin', 'admin', 'superuser'].indexOf(roleName.toLowerCase()) !== -1;
}
```

- [ ] **Step 5: Rewrite CRUD operations**

Replace all `pb.collection(collection).getList/getOne/create/update/delete` calls:

```javascript
// List items
async function loadItems(collection, sort, limit) {
  var token = await getValidToken();
  var url = DIRECTUS_URL + '/items/' + collection + '?sort=' + sort + '&limit=' + (limit || 50);
  var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
  return (await res.json()).data;
}

// Get one item
async function getItem(collection, id) {
  var token = await getValidToken();
  var res = await fetch(DIRECTUS_URL + '/items/' + collection + '/' + id, {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  return (await res.json()).data;
}

// Create item
async function createItem(collection, formData) {
  var token = await getValidToken();
  var res = await fetch(DIRECTUS_URL + '/items/' + collection, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData, // FormData for multipart (images)
  });
  if (!res.ok) throw new Error('Create failed: ' + res.status);
  return (await res.json()).data;
}

// Update item
async function updateItem(collection, id, formData) {
  var token = await getValidToken();
  var res = await fetch(DIRECTUS_URL + '/items/' + collection + '/' + id, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData,
  });
  if (!res.ok) throw new Error('Update failed: ' + res.status);
  return (await res.json()).data;
}

// Delete item
async function deleteItem(collection, id) {
  var token = await getValidToken();
  var res = await fetch(DIRECTUS_URL + '/items/' + collection + '/' + id, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token },
  });
  if (!res.ok) throw new Error('Delete failed: ' + res.status);
}
```

- [ ] **Step 6: Rewrite password reset**

Replace `pb.collection('members').requestPasswordReset(email)` with:
```javascript
await fetch(DIRECTUS_URL + '/kscw/password-request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: email }),
});
```

- [ ] **Step 7: Update image URL references in admin**

Replace PB file URL construction in news image display with Directus asset URLs:
```javascript
// Old: PB_URL + '/api/files/news/' + item.id + '/' + item.image
// New: DIRECTUS_URL + '/assets/' + item.image + '?width=400&quality=80'
```

- [ ] **Step 8: Rewrite logout**

Replace `pb.authStore.clear()` with `sessionStorage.removeItem(AUTH_KEY)`.

- [ ] **Step 9: Test admin page end-to-end**

Run: `npx astro dev` → visit `/admin` → test login, list news, create news, edit, delete, logout.

- [ ] **Step 10: Commit**

```bash
git add src/pages/admin.astro
git commit -m "feat: admin page uses Directus REST (replaces PocketBase SDK)"
```

### Task 21: Rewrite feedback form

**Files:**
- Modify: `public/js/feedback-form.js`

- [ ] **Step 1: Read `public/js/feedback-form.js`**

- [ ] **Step 2: Replace PB endpoint**

- Change `var PB = 'https://api.kscw.ch'` → Directus URL detection
- Replace `fetch(PB + '/api/collections/feedback/records', ...)` with `fetch(DIRECTUS_URL + '/items/feedback', ...)`
- Keep FormData construction the same (multipart for screenshot)
- Keep Turnstile token in body (Directus hook validates it)

- [ ] **Step 3: Test feedback form submission**

- [ ] **Step 4: Commit**

```bash
git add public/js/feedback-form.js
git commit -m "feat: feedback form submits to Directus"
```

### Task 22: Rewrite contact form + contact pages

**Files:**
- Modify: `public/js/contact-form.js`
- Modify: `src/pages/de/club/kontakt.astro` (remove `data.js` script tag, replace any `window.KSCW` usage)
- Modify: `src/pages/en/club/kontakt.astro` (same)

- [ ] **Step 1: Read `public/js/contact-form.js`**

- [ ] **Step 2: Replace PB endpoints**

- Change `var PB = 'https://api.kscw.ch'` → Directus URL detection
- Replace team dropdown fetch:
  ```javascript
  // Old: PB + '/api/collections/teams/records?filter=...'
  // New: DIRECTUS_URL + '/items/teams?filter[sport][_eq]=' + sport + '&filter[active][_eq]=true&fields=id,name,league&sort=name&limit=-1'
  ```
- Replace form submit:
  ```javascript
  // Old: fetch(PB + '/api/contact', ...)
  // New: fetch(DIRECTUS_URL + '/kscw/contact', ...)
  ```
- Keep Turnstile integration unchanged

- [ ] **Step 3: Update contact pages (DE + EN)**

In `src/pages/de/club/kontakt.astro` and `src/pages/en/club/kontakt.astro`:
- Remove `<script is:inline src="/js/data.js"></script>` tag
- Replace any `window.KSCW` references (e.g., team lists for dropdown) — the contact-form.js now fetches teams directly

- [ ] **Step 4: Test contact form**

Run: `npx astro dev` → visit contact page → select sport → verify team dropdown loads → submit test

- [ ] **Step 5: Commit**

```bash
git add public/js/contact-form.js src/pages/de/club/kontakt.astro src/pages/en/club/kontakt.astro
git commit -m "feat: contact form + pages use Directus endpoints"
```

---

## Layer 4: Cleanup

### Task 23: Update CSP headers and remove PB text references

**Files:**
- Modify: `public/_headers`
- Modify: `src/pages/de/club/feedback.astro`
- Modify: `src/pages/en/club/feedback.astro`

- [ ] **Step 1: Update CSP in `public/_headers`**

Replace `api.kscw.ch` with `directus.kscw.ch directus-dev.kscw.ch` in:
- `connect-src`
- `img-src`

- [ ] **Step 2: Remove PB text references in feedback pages**

If `feedback.astro` mentions "PocketBase" in visible text, update to "Directus" or remove the reference.

- [ ] **Step 3: Commit**

```bash
git add public/_headers src/pages/de/club/feedback.astro src/pages/en/club/feedback.astro
git commit -m "chore: update CSP headers and remove PocketBase text references"
```

### Task 24: Final verification — zero PB references

- [ ] **Step 1: Run all verification greps**

```bash
echo "=== api.kscw.ch ==="
grep -rn "api\.kscw\.ch" src/ public/ || echo "PASS"

echo "=== pocketbase/PocketBase ==="
grep -rn "pocketbase\|PocketBase" src/ public/ || echo "PASS"

echo "=== window.KSCW ==="
grep -rn "window\.KSCW" src/ public/ || echo "PASS"

echo "=== kscw-data-ready ==="
grep -rn "kscw-data-ready" src/ public/ || echo "PASS"

echo "=== pb./pb_/pbId ==="
grep -rn "pb\.\|pb_\|pbId" src/ public/ || echo "PASS"

echo "=== /api/files/ ==="
grep -rn "/api/files/" src/ public/ || echo "PASS"

echo "=== /api/collections/ ==="
grep -rn "/api/collections/" src/ public/ || echo "PASS"
```

All should show PASS. Fix any remaining references found.

- [ ] **Step 2: Full build test**

Run: `npx astro build`

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final PocketBase cleanup — zero remaining references"
```

### Task 25: Update CLAUDE.md, README.md, e2e tests, and add .env

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (update `api.kscw.ch` reference)
- Modify: `tests/e2e/admin.spec.ts` (update `PB_URL` to Directus URL)
- Create: `.env.example`

- [ ] **Step 1: Update CLAUDE.md**

Replace PocketBase references with Directus:
- "PocketBase API backend" → "Directus API backend"
- Update API URL references
- Update admin page description

- [ ] **Step 2: Update `README.md`**

Replace `api.kscw.ch` reference with `directus.kscw.ch` in the Backend row.

- [ ] **Step 3: Update `tests/e2e/admin.spec.ts`**

Replace `const PB_URL = 'https://api.kscw.ch'` with `const DIRECTUS_URL = ...` and update any test assertions that reference PB endpoints.

- [ ] **Step 4: Create `.env.example`**

```
# Directus API URL (used at build-time for Astro frontmatter fetches)
# For local dev, this points to the dev instance
DIRECTUS_URL=https://directus-dev.kscw.ch
```

- [ ] **Step 5: Create `.env` (gitignored)**

```bash
cp .env.example .env
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md tests/e2e/admin.spec.ts .env.example
git commit -m "docs: update CLAUDE.md, README, e2e tests for Directus + add .env.example"
```
