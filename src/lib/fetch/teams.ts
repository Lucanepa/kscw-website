import { directusFetch, assetUrl } from '../directus'
import { allTeamDefs, expandDisplayName, type TeamDef, type Training } from '../../data/teams'
import { volleyballTeams, basketballTeams } from '../../data/team-routes'

/** A weekly training slot derived from live hall slots by /kscw/public/teams. */
interface LiveTraining {
  day: Training['day']; start: string; end: string;
  hall_name: string | null; hall_address: string | null;
}

interface DirectusTeam {
  id: number; team_id: string | null; name: string; sport: string; league: string;
  color: string; team_picture: string | null; full_name: string; season: string;
  /** Weekly training summary from live hall slots (Mon→Sun). */
  trainings?: LiveTraining[];
  /**
   * `teams.open_for_players` — false when the team is full.
   *
   * Optional because the field is a later addition to /kscw/public/teams: a
   * Directus still running the previous extension build simply omits it, and an
   * older payload must not repaint the whole site.
   */
  open_for_players?: boolean;
}

export interface Team extends TeamDef {
  league: string; photoUrl: string; season: string;
  /**
   * False only when Directus says so. Fails OPEN — the opposite of the team
   * detail page, and deliberately: there the flag guards a contact channel, so an
   * unknown value must not put someone in touch with a full team. Here it only
   * paints a badge, and a missing field would otherwise stamp "Team voll" across
   * every card on the site. Silence is the safe failure for a label.
   */
  openForPlayers: boolean;
}

// Memoised for the build: the nav (Header), listing pages and detail-page
// routing all call this — one fetch per build is enough. A rejection clears the
// cache so a transient build-time failure can retry instead of poisoning every
// caller into the static fallback.
let _activeTeams: Promise<Team[]> | null = null
export function getActiveTeams(): Promise<Team[]> {
  if (!_activeTeams) {
    _activeTeams = fetchActiveTeams().catch((err) => { _activeTeams = null; throw err })
  }
  return _activeTeams
}

// The retry that absorbs a Directus restart now lives in directusFetch, so every
// build-time fetch gets it rather than this one call site (the 18.08.2026 deploy
// died on /items/teams, which had none). What stays here is the log line: a
// fallback to the static defs silently ships stale leagues, so it must be
// findable in the build output (happened in prod 2026-06-03).
async function fetchActiveTeamsRaw(): Promise<DirectusTeam[]> {
  try {
    // Custom endpoint (not /items/teams): it exposes the season-stable `team_id`
    // and a live weekly training summary, neither of which the public role can
    // read off the raw `teams` collection. Returns only active teams already.
    return await directusFetch<DirectusTeam[]>('/kscw/public/teams')
  } catch (err) {
    console.warn('[teams] live fetch failed — falling back to static defs:', err)
    throw err
  }
}

/**
 * Fill in `open_for_players` when /kscw/public/teams does not carry it yet.
 *
 * The field is a later addition to that endpoint, so a Directus still running the
 * previous extension build answers without it — and the "Team voll" badge would
 * simply never appear. The raw `teams` collection exposes the flag to the public
 * role on PROD, which is the build that serves kscw.ch, so one extra read closes
 * the gap until the extension ships. On dev `/items` is a restricted resource and
 * this read fails; that is the fail-open path, and it costs a badge, not a page.
 */
async function backfillOpenFlags(items: DirectusTeam[]): Promise<void> {
  if (!items.length || items.some((t) => typeof t.open_for_players === 'boolean')) return
  try {
    const rows = await directusFetch<{ id: number; open_for_players: boolean | null }[]>(
      '/items/teams?fields=id,open_for_players&limit=-1',
    )
    const byId = new Map(rows.map((r) => [r.id, r.open_for_players]))
    for (const t of items) {
      const flag = byId.get(t.id)
      if (typeof flag === 'boolean') t.open_for_players = flag
    }
  } catch {
    // Deliberately silent-ish: every team simply stays unbadged, which is the
    // state this site shipped in for years. A console line keeps it findable.
    console.warn('[teams] open_for_players unavailable — no team shows a "full" badge.')
  }
}

async function fetchActiveTeams(): Promise<Team[]> {
  const items = await fetchActiveTeamsRaw()
  await backfillOpenFlags(items)
  const mapped = items
    .map(t => {
      // Match priority: team_id (season-stable external id, used by basketball) →
      // teamName (volleyball short name; follows the D1/D2 league swap) → directusId
      // (legacy fallback). team_id survives both the June rollover and renames.
      const def = allTeamDefs.find(d =>
        d.team_id ? (d.sport === t.sport && d.team_id === t.team_id)
          : d.teamName ? (d.sport === t.sport && d.teamName === t.name)
            : d.directusId === String(t.id),
      )
      if (!def) {
        // ⚠ Silent drop. This is how DU20 (the girls' U20 volleyball squad) and both
        // Classics teams stayed invisible on the whole site — no nav entry, no card,
        // no detail page, and nothing anywhere to say so. A team the club adds in
        // Directus simply never appears until someone hand-writes a def below.
        //
        // The warning does not fix that, but it turns a silent omission into a line
        // in the build log, which is what makes the next one findable.
        console.warn(
          `[teams] live team has no def in src/data/teams.ts and was DROPPED — `
          + `id=${t.id} team_id=${t.team_id ?? '—'} sport=${t.sport} name="${t.name}". `
          + `It will not appear anywhere on the site until a TeamDef is added.`,
        )
        return null
      }
      const live = !!def.teamName || def.useLiveName === true
      return {
        ...def,
        directusId: String(t.id),                                       // live id (used for detail-page routing)
        displayName: live ? expandDisplayName(t.name) : def.displayName,
        chipLabel: live ? t.name : def.chipLabel,
        league: t.league,
        photoUrl: assetUrl(t.team_picture, 'width=640&quality=80'),
        season: t.season,
        // Live hall slots from /kscw/public/teams. Defs no longer carry static
        // trainings, so a team with none shows no training line (and the whole-
        // fetch-failed fallback path below renders none too).
        trainings: Array.isArray(t.trainings) ? t.trainings : [],
        openForPlayers: t.open_for_players !== false,
      }
    })
    .filter((t): t is Team => t !== null)

  reportTableDrift(items, mapped)
  return mapped
}

/**
 * Say out loud, once per build, where the two hand-maintained tables have drifted
 * from Directus.
 *
 * `src/data/teams.ts` and `src/data/team-routes.ts` are the only part of this site
 * nothing keeps in step with reality. They are consulted ONLY when the live fetch
 * fails, which is the whole problem: a wrong entry costs nothing on a good day and
 * is invisible on a bad one. DU23-2 was retired at the June 2026 rollover and sat
 * in both tables until 18.08.2026, when a build that fell back during a Directus
 * restart rebuilt /volleyball/du23-2 — and the only thing that noticed was a 404
 * e2e test, three jobs downstream of the actual cause.
 *
 * A warning, not a failure. The live path is correct whenever Directus answers, so
 * drift must never block a deploy — it just has to stop being silent.
 */
function reportTableDrift(live: DirectusTeam[], mapped: Team[]): void {
  const seen = new Set(mapped.map((t) => `${t.sport}/${t.slug}`))
  const routes = [...volleyballTeams, ...basketballTeams]

  // A def (or route) that no live team matched. Its page is gone from the real
  // site, but a fallback build will happily rebuild it — into the sitemap and the
  // search index too, since both read live-first and fall back to these tables.
  const retired = [
    ...allTeamDefs.filter((d) => !seen.has(`${d.sport}/${d.slug}`))
      .map((d) => `${d.sport}/${d.slug} (teams.ts)`),
    ...routes.filter((r) => !seen.has(`${r.sport}/${r.slug}`))
      .map((r) => `${r.sport}/${r.slug} (team-routes.ts)`),
  ]
  if (retired.length) {
    console.warn(
      '[teams] RETIRED entries still in the hand-maintained tables — a build that '
      + 'falls back to them will resurrect these pages: ' + retired.join(', '),
    )
  }

  // Ids are the softer case: /kscw/public/team/:id hops an archived row to the
  // active one sharing its `team_id`, so a stale id still resolves. It resolves to
  // the SQUAD though, not to the label — so when a label moves between squads at
  // the rollover (the D1/D2 swap), a stale id quietly renders the other team.
  const drifted = routes.flatMap((r) => {
    const t = mapped.find((m) => m.sport === r.sport && m.slug === r.slug)
    return t && t.directusId !== r.directusId
      ? [`${r.sport}/${r.slug} table=${r.directusId} live=${t.directusId}`]
      : []
  })
  if (drifted.length) {
    console.warn(
      '[teams] table ids are a season behind (harmless while the archived-row hop '
      + 'holds, wrong the moment a label moves between squads): ' + drifted.join(', '),
    )
  }

  // The reverse direction is already warned per-team above, but a count makes the
  // shape of the drift readable at a glance.
  const dropped = live.length - mapped.length
  if (dropped > 0) console.warn(`[teams] ${dropped} live team(s) dropped for want of a def.`)
}

export async function getTeamsBySport(sport: string): Promise<Team[]> {
  const teams = await getActiveTeams()
  return teams.filter(t => t.sport === sport)
}
