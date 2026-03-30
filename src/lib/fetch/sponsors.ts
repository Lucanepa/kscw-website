import { fetchAllItems, assetUrl } from '../directus'

interface DirectusSponsor {
  id: number; name: string; logo: string | null; logo_url: string | null; website_url: string | null;
}

export interface Sponsor {
  id: string; name: string; logoUrl: string; websiteUrl: string | null;
}

export async function getSponsors(): Promise<Sponsor[]> {
  const items = await fetchAllItems<DirectusSponsor>('sponsors', {
    sort: ['name'],
    fields: ['id', 'name', 'logo', 'logo_url', 'website_url'],
  })
  return items.map(s => ({
    id: String(s.id), name: s.name,
    logoUrl: s.logo ? assetUrl(s.logo, 'width=300&quality=80') : (s.logo_url ?? ''),
    websiteUrl: s.website_url,
  }))
}
