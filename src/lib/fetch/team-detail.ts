import { kscwApi, assetUrl } from '../directus'

export interface TeamDetail {
  id: string; name: string; fullName: string; sport: string; league: string;
  color: string; photoUrl: string; season: string; collectionId: string;
  roster: Array<{ id: string; firstName: string; lastName: string; position: string | null }>;
  coaches: Array<{ id: string; firstName: string; lastName: string; email: string | null }>;
  openForPlayers: boolean;
  trainings: Array<{ day: string; time: string; location: string }>;
  /** Upcoming trial trainings (Probetrainings) — only populated when openForPlayers is true.
   *  Render next to the "Get in touch" CTA so prospective players see when to drop in. */
  trialTrainings: Array<{
    id: string;
    date: string;         // YYYY-MM-DD
    startTime: string;    // HH:MM
    endTime: string;      // HH:MM
    hallName: string | null;
    hallAddress: string | null;
    notes: string | null;
  }>;
  sponsors: Array<{ id: string; name: string; logoUrl: string; websiteUrl: string | null }>;
}

export async function getTeamDetail(teamId: string): Promise<TeamDetail> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await kscwApi<any>(`/public/team/${teamId}`)
  return {
    id: String(data.id), name: data.name, fullName: data.full_name,
    sport: data.sport, league: data.league, color: data.color,
    photoUrl: assetUrl(data.team_picture, 'width=1280&quality=80'),
    season: data.season, collectionId: data.collectionId ?? '',
    roster: (data.roster ?? []).map((m: any) => ({
      id: String(m.id), firstName: m.first_name, lastName: m.last_name, position: m.position ?? null,
    })),
    coaches: (data.coaches ?? []).map((c: any) => ({
      id: String(c.id), firstName: c.first_name, lastName: c.last_name, email: c.email ?? null,
    })),
    openForPlayers: data.open_for_players ?? false,
    trainings: data.trainings ?? [],
    trialTrainings: (data.trial_trainings ?? []).map((t: any) => ({
      id: String(t.id),
      date: String(t.date ?? '').slice(0, 10),
      startTime: String(t.start_time ?? '').slice(0, 5),
      endTime: String(t.end_time ?? '').slice(0, 5),
      hallName: t.hall_name ?? null,
      hallAddress: t.hall_address ?? null,
      notes: t.notes ?? null,
    })),
    sponsors: (data.sponsors ?? []).map((s: any) => ({
      id: String(s.id), name: s.name,
      logoUrl: s.logo ? assetUrl(s.logo, 'width=200&quality=80') : (s.logo_url ?? ''),
      websiteUrl: s.website_url ?? null,
    })),
  }
}
