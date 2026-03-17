export interface TeamRoute {
  slug: string;
  pbId: string;
  short: string;
  sport: 'volleyball' | 'basketball';
}

export const volleyballTeams: TeamRoute[] = [
  { slug: 'h1', pbId: 'qz7y8l4tz48f65j', short: 'H1', sport: 'volleyball' },
  { slug: 'h2', pbId: '601p27iw4xvw1ds', short: 'H2', sport: 'volleyball' },
  { slug: 'h3', pbId: 'il1wd1p018hrb61', short: 'H3', sport: 'volleyball' },
  { slug: 'legends', pbId: 'e352q254s1cip8y', short: 'Legends', sport: 'volleyball' },
  { slug: 'd1', pbId: 'p1i9cs4km520dd6', short: 'D1', sport: 'volleyball' },
  { slug: 'd2', pbId: '9kwn129z84967fc', short: 'D2', sport: 'volleyball' },
  { slug: 'd3', pbId: 'c18yey33vwx9yo4', short: 'D3', sport: 'volleyball' },
  { slug: 'd4', pbId: '2h55x265r941a4k', short: 'D4', sport: 'volleyball' },
  { slug: 'du23', pbId: 'vo89vn93wdoo01o', short: 'DU23', sport: 'volleyball' },
  { slug: 'hu23', pbId: '6380e7aj8z80o79', short: 'HU23', sport: 'volleyball' },
  { slug: 'hu20', pbId: '274nyi35of7v34x', short: 'HU20', sport: 'volleyball' },
];

export const basketballTeams: TeamRoute[] = [
  { slug: 'h1', pbId: 'wpg9887276cdkd9', short: 'BB-H1', sport: 'basketball' },
  { slug: 'h3', pbId: 'oqqn58l012ie36e', short: 'BB-H3', sport: 'basketball' },
  { slug: 'h4', pbId: '4e65vlw744mldc0', short: 'BB-H4', sport: 'basketball' },
  { slug: 'lions', pbId: '31k9c1qk62p23oe', short: 'BB-Lions D1', sport: 'basketball' },
  { slug: 'rhinos', pbId: 'cj55682587v210q', short: 'BB-Rhinos D3', sport: 'basketball' },
];

export const allTeams = [...volleyballTeams, ...basketballTeams];
