/**
 * The fee table on the signup form vs. the invoice engine.
 *
 * `public/js/registration-fees.js` is a hand copy of feeBreakdown() in
 * wiedisync/directus/extensions/kscw-endpoints/src/clubdesk-update.js (bases
 * from CD_BEITRAG_MAP, surcharge sets, isU16Plus, the guest rule) plus the
 * licence split of migration 323-dues-rate-licence-split.sql. The engine lives
 * in another repo and needs a member row, so the page cannot call it — it can
 * only agree with it. Every figure below is a LITERAL taken from the engine, not
 * recomputed: a copy that agrees with itself proves nothing. When the club
 * changes a fee, both the engine and the page change, and so does this file.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Tier = 'intro' | 'youth' | 'adult' | 'none';
type Sport = 'volleyball' | 'basketball' | 'passive';
interface Category { sport: Sport; base: number; licence: number; tier: Tier }
interface Breakdown {
  category: string; base: number; licence: number; clubFee: number;
  surcharge: number; guestDiscount: number; total: number;
  coachWaiver: boolean; refereeNote: boolean;
}
interface Fees {
  NO_LICENCE_SURCHARGE: number;
  GUEST_DISCOUNT: number;
  CATEGORIES: Record<string, Category>;
  categoriesFor(sport: Sport, funktion: string): string[];
  isU16Plus(dobIso: string, refYear?: number): boolean | null;
  breakdown(opts: {
    category: string; funktion?: string; dob?: string;
    scorer?: boolean; referee?: boolean; refYear?: number;
  }): Breakdown | null;
}

/** Load the ES5 file the way a browser would, and hand back window.KSCW_FEES. */
function loadFees(): Fees {
  const src = readFileSync(resolve(process.cwd(), 'public/js/registration-fees.js'), 'utf8');
  const sandbox: { KSCW_FEES?: Fees } = {};
  new Function('window', src)(sandbox);
  if (!sandbox.KSCW_FEES) throw new Error('public/js/registration-fees.js did not export window.KSCW_FEES');
  return sandbox.KSCW_FEES;
}

const fees = loadFees();
const REF_YEAR = 2026;

describe('constants mirror the engine', () => {
  it('NO_LICENCE_SURCHARGE 100, GUEST_DISCOUNT 110', () => {
    expect(fees.NO_LICENCE_SURCHARGE).toBe(100);
    expect(fees.GUEST_DISCOUNT).toBe(110);
  });
});

describe('CATEGORIES', () => {
  // clubdesk-update.js CD_BEITRAG_MAP (base) — BB amounts are the post-2026-08-10
  // ones — and migration 323 licence_chf (licence: RLL 110, JLL 60, BB 0).
  const ENGINE: Array<[string, Sport, number, number, Tier]> = [
    ['VB Turnier KWI',                  'volleyball', 110, 60,  'intro'],
    ['VB Schüler*in Turnier',           'volleyball', 210, 60,  'youth'],
    ['VB Schüler*in Meisterschaft',     'volleyball', 310, 60,  'youth'],
    ['VB Student*in Meisterschaft',     'volleyball', 380, 110, 'adult'],
    ['VB Erwerbstätige',                'volleyball', 440, 110, 'adult'],
    ['BB Erwerbstätige 1. Liga',        'basketball', 570, 0,   'adult'],
    ['BB Lernende/Studierende 1. Liga', 'basketball', 470, 0,   'adult'],
    ['BB Erwerbstätige',                'basketball', 520, 0,   'adult'],
    ['BB Lernende/Studierende',         'basketball', 420, 0,   'adult'],
    ['BB Jugend Meisterschaft',         'basketball', 320, 0,   'youth'],
    ['BB Minis Turnier',                'basketball', 220, 0,   'youth'],
    ['Passivmitglied',                  'passive',    40,  0,   'none'],
    ['Gratis',                          'passive',    0,   0,   'none'],
  ];

  it.each(ENGINE)('%s → %s, base %i, licence %i, tier %s', (name, sport, base, licence, tier) => {
    expect(fees.CATEGORIES[name]).toEqual({ sport, base, licence, tier });
  });

  it('holds exactly the engine categories, in select order', () => {
    expect(Object.keys(fees.CATEGORIES)).toEqual(ENGINE.map(([name]) => name));
  });

  it('never carves a licence larger than the fee (migration 323 CHECK)', () => {
    for (const c of Object.values(fees.CATEGORIES)) {
      expect(c.licence).toBeGreaterThanOrEqual(0);
      expect(c.licence).toBeLessThanOrEqual(c.base);
    }
  });
});

describe('isU16Plus', () => {
  it('born <= refYear − 15 is U16+', () => {
    expect(fees.isU16Plus('2011-09-30', REF_YEAR)).toBe(true);
    expect(fees.isU16Plus('2011-01-01', REF_YEAR)).toBe(true);
  });
  it('born after that is not', () => {
    expect(fees.isU16Plus('2012-01-01', REF_YEAR)).toBe(false);
  });
  it('unknown or unparsable is null, not false', () => {
    expect(fees.isU16Plus('', REF_YEAR)).toBeNull();
    expect(fees.isU16Plus('garbage', REF_YEAR)).toBeNull();
  });
});

describe('VB Erwerbstätige (adult tier)', () => {
  it('no scorer licence → 330 + 110 licence + 100 surcharge = 540', () => {
    const b = fees.breakdown({ category: 'VB Erwerbstätige', funktion: 'Spieler*in', dob: '1990-01-01', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b).toEqual({
      category: 'VB Erwerbstätige', base: 440, licence: 110, clubFee: 330,
      surcharge: 100, guestDiscount: 0, total: 540, coachWaiver: false, refereeNote: false,
    });
  });
  it('scorer licence → 440', () => {
    const b = fees.breakdown({ category: 'VB Erwerbstätige', funktion: 'Spieler*in', dob: '1990-01-01', scorer: true, referee: false, refYear: REF_YEAR });
    expect(b?.surcharge).toBe(0);
    expect(b?.total).toBe(440);
  });
  it('referee → 440 and the referee note', () => {
    const b = fees.breakdown({ category: 'VB Erwerbstätige', funktion: 'Spieler*in', dob: '1990-01-01', scorer: false, referee: true, refYear: REF_YEAR });
    expect(b?.surcharge).toBe(0);
    expect(b?.total).toBe(440);
    expect(b?.refereeNote).toBe(true);
    expect(b?.coachWaiver).toBe(false);
  });
  it('adult tier is surcharged without a birthdate', () => {
    const b = fees.breakdown({ category: 'VB Erwerbstätige', funktion: 'Spieler*in', dob: '', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.surcharge).toBe(100);
  });
});

describe('VB Turnier KWI (intro tier)', () => {
  it('is never surcharged, even for an adult without a licence', () => {
    const b = fees.breakdown({ category: 'VB Turnier KWI', funktion: 'Spieler*in', dob: '1990-01-01', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.surcharge).toBe(0);
    expect(b?.total).toBe(110);
    expect(b?.licence).toBe(60);
    expect(b?.clubFee).toBe(50);
  });
});

describe('VB Schüler*in Meisterschaft (youth tier)', () => {
  const base = { category: 'VB Schüler*in Meisterschaft', funktion: 'Spieler*in', scorer: false, referee: false, refYear: REF_YEAR };
  // Engine: born <= refYear − 15 (2026 → 2011) is U16+. 2012 is one year short.
  it('U16+ by birth year → surcharge', () => {
    const b = fees.breakdown({ ...base, dob: '2011-05-01' });
    expect(b?.surcharge).toBe(100);
    expect(b?.total).toBe(410);
  });
  it('younger → no surcharge', () => {
    expect(fees.breakdown({ ...base, dob: '2012-01-01' })?.surcharge).toBe(0);
    const b = fees.breakdown({ ...base, dob: '2013-01-01' });
    expect(b?.surcharge).toBe(0);
    expect(b?.total).toBe(310);
  });
  it('unknown birthdate → no surcharge (null is not U16+)', () => {
    const b = fees.breakdown({ ...base, dob: '' });
    expect(b?.surcharge).toBe(0);
    expect(b?.total).toBe(310);
  });
});

describe('guest', () => {
  it('VB Erwerbstätige → −110, never surcharged, no licence line', () => {
    const b = fees.breakdown({ category: 'VB Erwerbstätige', funktion: 'Guest', dob: '1990-01-01', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.guestDiscount).toBe(110);
    expect(b?.surcharge).toBe(0);
    expect(b?.total).toBe(330);
    // finance.js zeroes a guest's licence portion — the reduction IS the licence
    // coming off — so the invoice reads 440 / −110 / 330 with no licence line.
    expect(b?.clubFee).toBe(440);
    expect(b?.licence).toBe(0);
  });
  it('a guest\'s referee tick does not raise the note — the engine has no guest referee rule', () => {
    const b = fees.breakdown({ category: 'VB Erwerbstätige', funktion: 'Guest', dob: '1990-01-01', scorer: false, referee: true, refYear: REF_YEAR });
    expect(b?.surcharge).toBe(0);
    expect(b?.total).toBe(330);
  });
  it('VB Schüler*in Turnier → 100', () => {
    const b = fees.breakdown({ category: 'VB Schüler*in Turnier', funktion: 'Guest', dob: '2010-01-01', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.surcharge).toBe(0);
    expect(b?.total).toBe(100);
  });
  it('never goes below 0 — the reduction is capped at the base', () => {
    const b = fees.breakdown({ category: 'Passivmitglied', funktion: 'Guest', dob: '', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.guestDiscount).toBe(40);
    expect(b?.total).toBe(0);
    const g = fees.breakdown({ category: 'Gratis', funktion: 'Guest', dob: '', scorer: false, referee: false, refYear: REF_YEAR });
    expect(g?.guestDiscount).toBe(0);
    expect(g?.total).toBe(0);
  });
});

describe('coach', () => {
  it('may only pick Gratis', () => {
    expect(fees.categoriesFor('volleyball', 'Trainer*in')).toEqual(['Gratis']);
    expect(fees.categoriesFor('basketball', 'Trainer*in')).toEqual(['Gratis']);
  });
  it('Gratis → 0 with the coach note', () => {
    const b = fees.breakdown({ category: 'Gratis', funktion: 'Trainer*in', dob: '1990-01-01', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.total).toBe(0);
    expect(b?.surcharge).toBe(0);
    expect(b?.coachWaiver).toBe(true);
    expect(b?.category).toBe('Gratis');
  });
  it('is computed as Gratis even if the select still says something else', () => {
    const b = fees.breakdown({ category: 'VB Erwerbstätige', funktion: 'Trainer*in', dob: '1990-01-01', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.category).toBe('Gratis');
    expect(b?.total).toBe(0);
    expect(b?.coachWaiver).toBe(true);
  });
});

describe('categoriesFor', () => {
  const VB = ['VB Turnier KWI', 'VB Schüler*in Turnier', 'VB Schüler*in Meisterschaft', 'VB Student*in Meisterschaft', 'VB Erwerbstätige'];
  const BB = ['BB Erwerbstätige 1. Liga', 'BB Lernende/Studierende 1. Liga', 'BB Erwerbstätige', 'BB Lernende/Studierende', 'BB Jugend Meisterschaft', 'BB Minis Turnier'];

  it('guest: volleyball without the KWI intro tier, order kept', () => {
    expect(fees.categoriesFor('volleyball', 'Guest')).toEqual(VB.slice(1));
  });
  it('guest: all six basketball categories (no intro tier)', () => {
    expect(fees.categoriesFor('basketball', 'Guest')).toEqual(BB);
  });
  it('player: the whole sport in select order', () => {
    expect(fees.categoriesFor('volleyball', 'Spieler*in')).toEqual(VB);
    expect(fees.categoriesFor('basketball', 'Spieler*in')).toEqual(BB);
  });
  it('team lead, other and unset see the whole sport too', () => {
    for (const f of ['Teamverantwortliche*r', 'Andere', '']) {
      expect(fees.categoriesFor('volleyball', f)).toEqual(VB);
      expect(fees.categoriesFor('basketball', f)).toEqual(BB);
    }
  });
  it('passive: Passivmitglied and Gratis', () => {
    expect(fees.categoriesFor('passive', '')).toEqual(['Passivmitglied', 'Gratis']);
  });
});

describe('basketball', () => {
  it('BB Erwerbstätige, no scorer licence → 620 with no licence portion', () => {
    const b = fees.breakdown({ category: 'BB Erwerbstätige', funktion: 'Spieler*in', dob: '1990-01-01', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.licence).toBe(0);
    expect(b?.clubFee).toBe(520);
    expect(b?.surcharge).toBe(100);
    expect(b?.total).toBe(620);
  });
  it('BB Erwerbstätige with a table-official licence → 520', () => {
    const b = fees.breakdown({ category: 'BB Erwerbstätige', funktion: 'Spieler*in', dob: '1990-01-01', scorer: true, referee: false, refYear: REF_YEAR });
    expect(b?.total).toBe(520);
  });
  it('BB Minis Turnier, born 2016 → 220', () => {
    const b = fees.breakdown({ category: 'BB Minis Turnier', funktion: 'Spieler*in', dob: '2016-03-15', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.surcharge).toBe(0);
    expect(b?.total).toBe(220);
  });
});

describe('passive and unknown', () => {
  it('Passivmitglied → 40', () => {
    const b = fees.breakdown({ category: 'Passivmitglied', funktion: '', dob: '', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.total).toBe(40);
    expect(b?.surcharge).toBe(0);
    expect(b?.licence).toBe(0);
  });
  it('Gratis → 0', () => {
    const b = fees.breakdown({ category: 'Gratis', funktion: '', dob: '', scorer: false, referee: false, refYear: REF_YEAR });
    expect(b?.total).toBe(0);
    expect(b?.coachWaiver).toBe(false);
  });
  it('unknown category → null, never a guessed amount', () => {
    expect(fees.breakdown({ category: 'VB Superliga', refYear: REF_YEAR })).toBeNull();
    expect(fees.breakdown({ category: '', refYear: REF_YEAR })).toBeNull();
  });
});
