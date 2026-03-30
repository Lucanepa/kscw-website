/**
 * Shared utility functions for KSCW website
 * Extracted from public/js/data.js for reuse across components and islands
 */

/**
 * Format ISO date string as locale-specific date
 * @param isoDate ISO date string (YYYY-MM-DD)
 * @param locale Locale code (default: 'de-CH')
 * @returns Formatted date (e.g., "30.03.2026" for de-CH)
 */
export function formatDate(isoDate: string, locale = 'de-CH'): string {
  if (!isoDate) return '–';

  try {
    const date = new Date(isoDate + 'T12:00:00');
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '–';
  }
}

/**
 * Format ISO date string as long locale-specific date with weekday
 * @param isoDate ISO date string (YYYY-MM-DD)
 * @param locale Locale code (default: 'de-CH')
 * @returns Formatted date (e.g., "So, 30. März 2026" for de-CH)
 */
export function formatDateLong(isoDate: string, locale = 'de-CH'): string {
  if (!isoDate) return '–';

  try {
    const date = new Date(isoDate + 'T12:00:00');
    return date.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '–';
  }
}

/**
 * Format time string to HH:MM
 * @param time Time string (HH:MM:SS or HH:MM)
 * @returns Formatted time (e.g., "17:00")
 */
export function formatTime(time: string): string {
  if (!time) return '';
  return time.slice(0, 5);
}

/**
 * Determine if a game is a win for KSCW
 * @param homeScore Home team score
 * @param awayScore Away team score
 * @param isHome Whether KSCW is the home team
 * @returns true if KSCW won, false otherwise
 */
export function isWin(homeScore: number, awayScore: number, isHome: boolean): boolean {
  return isHome ? homeScore > awayScore : awayScore > homeScore;
}

/**
 * Generate a unique key for a league
 * @param sport Sport name (e.g., 'volleyball', 'basketball')
 * @param league League name (e.g., '1. Liga', 'Damen 2')
 * @returns League key (e.g., 'volleyball_1_liga')
 */
export function getLeagueKey(sport: string, league: string): string {
  return `${sport}_${league}`.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 * @returns Today's date as ISO string
 */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
