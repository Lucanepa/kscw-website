import { fetchAllItems } from '../directus'
import { getLeagueKey } from '../utils'

interface DirectusRanking {
  id: number; rank: number; team_id: string; team_name: string;
  league: string; sport: string; played: number; won: number; lost: number;
  sets_won: number; sets_lost: number; points: number;
}

export interface RankingEntry {
  rank: number; teamId: string; teamName: string;
  played: number; won: number; lost: number;
  setsWon: number; setsLost: number; points: number;
}

export interface LeagueRankings {
  sport: string; league: string; key: string; teams: RankingEntry[];
}

export async function getRankings(): Promise<Record<string, LeagueRankings>> {
  const items = await fetchAllItems<DirectusRanking>('rankings', {
    sort: ['sport', 'league', 'rank'],
    fields: ['rank', 'team_id', 'team_name', 'league', 'sport', 'played', 'won', 'lost', 'sets_won', 'sets_lost', 'points'],
  })
  const grouped: Record<string, LeagueRankings> = {}
  for (const r of items) {
    const key = getLeagueKey(r.sport, r.league)
    if (!grouped[key]) grouped[key] = { sport: r.sport, league: r.league, key, teams: [] }
    grouped[key].teams.push({
      rank: r.rank, teamId: r.team_id, teamName: r.team_name,
      played: r.played, won: r.won, lost: r.lost,
      setsWon: r.sets_won, setsLost: r.sets_lost, points: r.points,
    })
  }
  return grouped
}
