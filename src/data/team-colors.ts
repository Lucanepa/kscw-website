export interface TeamColor {
  bg: string;
  text: string;
  border: string;
}

export const teamColors: Record<string, TeamColor> = {
  // Volleyball Men (Blue)
  H1:      { bg: '#1e40af', text: '#ffffff', border: '#1e3a8a' },
  H2:      { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' },
  H3:      { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' },
  HU23:    { bg: '#60a5fa', text: '#1e3a8a', border: '#3b82f6' },
  HU20:    { bg: '#93c5fd', text: '#1e3a8a', border: '#60a5fa' },
  Legends: { bg: '#1e3a5f', text: '#ffffff', border: '#162d4d' },
  // Volleyball Women (Rose)
  D1:      { bg: '#be123c', text: '#ffffff', border: '#9f1239' },
  D2:      { bg: '#e11d48', text: '#ffffff', border: '#be123c' },
  D3:      { bg: '#f43f5e', text: '#881337', border: '#e11d48' },
  D4:      { bg: '#fb7185', text: '#881337', border: '#f43f5e' },
  DU23:    { bg: '#fda4af', text: '#881337', border: '#fb7185' },
  // Basketball Men (Orange)
  'BB-H1':         { bg: '#9a3412', text: '#ffffff', border: '#7c2d12' },
  'BB-H3':         { bg: '#c2410c', text: '#ffffff', border: '#9a3412' },
  'BB-H4':         { bg: '#ea580c', text: '#ffffff', border: '#c2410c' },
  'BB-HU18':       { bg: '#f97316', text: '#ffffff', border: '#ea580c' },
  'BB-HU16':       { bg: '#fb923c', text: '#7c2d12', border: '#f97316' },
  'BB-HU14':       { bg: '#fdba74', text: '#7c2d12', border: '#fb923c' },
  'BB-HU12':       { bg: '#fed7aa', text: '#7c2d12', border: '#fdba74' },
  'BB-H-Classics': { bg: '#78350f', text: '#ffffff', border: '#451a03' },
  // Basketball Women (Purple)
  'BB-D1':         { bg: '#7e22ce', text: '#ffffff', border: '#6b21a8' },
  'BB-D3':         { bg: '#a855f7', text: '#ffffff', border: '#9333ea' },
  'BB-DU18':       { bg: '#c084fc', text: '#581c87', border: '#a855f7' },
  'BB-DU16':       { bg: '#d8b4fe', text: '#581c87', border: '#c084fc' },
  'BB-DU14':       { bg: '#e9d5ff', text: '#581c87', border: '#d8b4fe' },
  'BB-DU12':       { bg: '#f3e8ff', text: '#581c87', border: '#e9d5ff' },
  'BB-DU10':       { bg: '#faf5ff', text: '#581c87', border: '#f3e8ff' },
  'BB-D-Classics': { bg: '#581c87', text: '#ffffff', border: '#3b0764' },
  // Basketball Mixed (Teal)
  'BB-MU10': { bg: '#14b8a6', text: '#042f2e', border: '#0d9488' },
  'BB-MU8':  { bg: '#0d9488', text: '#ffffff', border: '#0f766e' },
  // Sub-brands
  'BB-Lions':      { bg: '#6d28d9', text: '#ffffff', border: '#5b21b6' },
  'BB-Lions D1':   { bg: '#6d28d9', text: '#ffffff', border: '#5b21b6' },
  'BB-Lions D3':   { bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed' },
  'BB-Rhinos':     { bg: '#059669', text: '#ffffff', border: '#047857' },
  'BB-Rhinos D1':  { bg: '#059669', text: '#ffffff', border: '#047857' },
  'BB-Rhinos D3':  { bg: '#34d399', text: '#064e3b', border: '#10b981' },
  // Fallback
  Other: { bg: '#6b7280', text: '#ffffff', border: '#4b5563' },
};

export function getTeamColor(short: string): TeamColor {
  return teamColors[short] ?? teamColors.Other;
}
