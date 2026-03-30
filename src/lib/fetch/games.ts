import { fetchAllItems } from '../directus'
import { todayISO } from '../utils'

interface DirectusGame {
  id: number; game_id: string; date: string; time: string;
  home_team: string; away_team: string; home_score: number | null; away_score: number | null;
  status: string; type: string; league: string; season: string; sets_json: string | null;
  kscw_team: { id: number; name: string; sport: string; color: string } | null;
  hall: { id: number; name: string; address: string } | null;
}

export interface Game {
  id: string; gameId: string; date: string; time: string;
  homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null;
  status: string; type: string; league: string; season: string; setsJson: string | null;
  teamId: string | null; teamName: string | null; teamSport: string | null; teamColor: string | null;
  hallName: string | null; hallAddress: string | null;
}

function mapGame(g: DirectusGame): Game {
  return {
    id: String(g.id), gameId: g.game_id, date: g.date, time: g.time,
    homeTeam: g.home_team, awayTeam: g.away_team,
    homeScore: g.home_score, awayScore: g.away_score,
    status: g.status, type: g.type, league: g.league, season: g.season, setsJson: g.sets_json,
    teamId: g.kscw_team ? String(g.kscw_team.id) : null,
    teamName: g.kscw_team?.name ?? null, teamSport: g.kscw_team?.sport ?? null,
    teamColor: g.kscw_team?.color ?? null,
    hallName: g.hall?.name ?? null, hallAddress: g.hall?.address ?? null,
  }
}

const GAME_FIELDS = ['*', 'kscw_team.id', 'kscw_team.name', 'kscw_team.sport', 'kscw_team.color', 'hall.id', 'hall.name', 'hall.address']

export async function getUpcomingGames(options?: { teamId?: string; sport?: string; limit?: number }): Promise<Game[]> {
  const conditions: Record<string, unknown>[] = [
    { date: { _gte: todayISO() } }, { status: { _neq: 'cancelled' } },
  ]
  if (options?.teamId) conditions.push({ kscw_team: { _eq: options.teamId } })
  if (options?.sport) conditions.push({ kscw_team: { sport: { _eq: options.sport } } })
  const items = await fetchAllItems<DirectusGame>('games', {
    filter: { _and: conditions }, sort: ['date', 'time'], fields: GAME_FIELDS,
  })
  const mapped = items.map(mapGame)
  return options?.limit ? mapped.slice(0, options.limit) : mapped
}

export async function getCompletedGames(options?: { teamId?: string; sport?: string; limit?: number }): Promise<Game[]> {
  const conditions: Record<string, unknown>[] = [{ status: { _eq: 'completed' } }]
  if (options?.teamId) conditions.push({ kscw_team: { _eq: options.teamId } })
  if (options?.sport) conditions.push({ kscw_team: { sport: { _eq: options.sport } } })
  const items = await fetchAllItems<DirectusGame>('games', {
    filter: { _and: conditions }, sort: ['-date', '-time'], fields: GAME_FIELDS,
  })
  const mapped = items.map(mapGame)
  return options?.limit ? mapped.slice(0, options.limit) : mapped
}

export async function getAllGames(options?: { sport?: string }): Promise<Game[]> {
  const conditions: Record<string, unknown>[] = []
  if (options?.sport) conditions.push({ kscw_team: { sport: { _eq: options.sport } } })
  const items = await fetchAllItems<DirectusGame>('games', {
    filter: conditions.length ? { _and: conditions } : undefined, sort: ['-date', '-time'], fields: GAME_FIELDS,
  })
  return items.map(mapGame)
}
