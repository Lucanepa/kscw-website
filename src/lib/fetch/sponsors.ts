import { fetchAllItems, assetUrl } from '../directus'

interface DirectusSponsor {
  id: number; name: string; logo: string | null; website_url: string | null;
}

export interface Sponsor {
  id: string; name: string; logoUrl: string; websiteUrl: string | null;
}

export async function getSponsors(): Promise<Sponsor[]> {
  const items = await fetchAllItems<DirectusSponsor>('sponsors', {
    sort: ['name'],
    fields: ['id', 'name', 'logo', 'website_url'],
    filter: { team_page_only: { _eq: false } },
  })
  return items.map(s => ({
    id: String(s.id), name: s.name,
    logoUrl: s.logo ? assetUrl(s.logo, 'width=300&quality=80') : '',
    websiteUrl: s.website_url,
  }))
}
