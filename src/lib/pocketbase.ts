import type { TeamDef, TeamData } from '../data/teams';
import { allTeamDefs, getBadgeText } from '../data/teams';

const PB_URL = 'https://kscw-api.lucanepa.com';
const PB_FILES = `${PB_URL}/api/files/pbc_1568971955`;

interface PBTeamRecord {
  id: string;
  name: string;
  league: string;
  color: string;
  team_picture: string;
  sport: string;
  active: boolean;
}

/**
 * Fetch all teams from PB and merge with static TeamDef config.
 * Returns TeamData[] enriched with league and photoUrl.
 * Falls back to static data if PB is unreachable.
 */
export async function fetchAllTeams(): Promise<TeamData[]> {
  let pbTeams: PBTeamRecord[] = [];
  try {
    const res = await fetch(
      `${PB_URL}/api/collections/teams/records?perPage=100&fields=id,name,league,color,team_picture,sport,active`
    );
    if (res.ok) {
      const data = await res.json();
      pbTeams = data.items ?? [];
    }
  } catch {
    // PB unreachable — fall back to static config
  }

  const pbMap = new Map<string, PBTeamRecord>();
  for (const t of pbTeams) pbMap.set(t.id, t);

  return allTeamDefs.map((def): TeamData => {
    const pb = pbMap.get(def.pbId);
    const league = pb?.league ?? def.fallbackLeague ?? '';
    const photoUrl = pb?.team_picture
      ? `${PB_FILES}/${def.pbId}/${pb.team_picture}?thumb=640x0`
      : null;
    return { ...def, league, photoUrl };
  });
}

export async function fetchTeamData(teamId: string) {
  const res = await fetch(`${PB_URL}/api/public/team/${teamId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchSponsors() {
  const res = await fetch(`${PB_URL}/api/public/sponsors`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.sponsors ?? [];
}

export async function fetchGames() {
  const res = await fetch(`${PB_URL}/api/public/games?sort=-date`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.games ?? [];
}
