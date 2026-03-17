const PB_URL = 'https://kscw-api.lucanepa.com';

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
