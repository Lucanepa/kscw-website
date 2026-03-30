import { fetchAllItems, assetUrl } from '../directus'
import { allTeamDefs, type TeamDef } from '../../data/teams'

interface DirectusTeam {
  id: number; name: string; sport: string; league: string; color: string;
  team_picture: string | null; active: boolean; slug: string; full_name: string; season: string;
}

export interface Team extends TeamDef {
  league: string; photoUrl: string; season: string;
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
      return { ...def, league: t.league, photoUrl: assetUrl(t.team_picture, 'width=640&quality=80'), season: t.season }
    })
    .filter((t): t is Team => t !== null)
}

export async function getTeamsBySport(sport: string): Promise<Team[]> {
  const teams = await getActiveTeams()
  return teams.filter(t => t.sport === sport)
}
