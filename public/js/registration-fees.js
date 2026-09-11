/**
 * KSCW registration — the fee an applicant will be invoiced, computed on the page.
 *
 * The signup form shows a "Dein Beitrag pro Saison" table while the applicant
 * picks a category. That table has one job: say what the invoice will say. The
 * invoice is produced by ONE engine — feeBreakdown() in
 *   wiedisync/directus/extensions/kscw-endpoints/src/clubdesk-update.js
 * (CD_BEITRAG_MAP bases, SURCHARGE_ADULT / SURCHARGE_YOUTH, isU16Plus,
 * NO_LICENCE_SURCHARGE, GUEST_DISCOUNT) — and its lines are labelled by
 * finance.js, whose licence split comes from migration
 *   wiedisync/directus/scripts/323-dues-rate-licence-split.sql
 * (the federation licence is a portion INSIDE the fee, never on top of it).
 *
 * This file MIRRORS that engine; it does not consult it, because the public page
 * is static and the engine needs a member row. So every number and every rule
 * below is a copy. ⚠ Changing one here without changing the engine — or the
 * other way round — makes the form lie to the applicant about their own bill.
 * tests/unit/registration-fees.test.ts pins the copies to the engine's figures.
 *
 * Category keys are the ClubDesk names, identical to the <option value>s in
 * src/pages/weiteres/anmeldung.astro — the payload field `beitragskategorie` is
 * what the engine later looks up in CD_BEITRAG_MAP. Insertion order is display
 * order. Consumed by public/js/registration-form.js (loaded before it, like
 * federations.js). Plain ES5 on purpose: no build step touches public/js.
 */
(function () {
  'use strict';

  // Engine: NO_LICENCE_SURCHARGE — owed by a member with scorer/table duty and
  // no licence. GUEST_DISCOUNT — taken off a guest's base, who does no duty.
  var NO_LICENCE_SURCHARGE = 100;
  var GUEST_DISCOUNT = 110;

  // base    = CD_BEITRAG_MAP (the WITH-licence amount, i.e. the invoice total
  //           before adjustments; every BB category rose CHF 10 on 2026-08-10)
  // licence = migration 323 licence_chf: Swiss Volley RLL 110 for adults and
  //           students, JLL 60 for the school tiers and KWI, 0 for every BB
  //           category (nobody has given the club a Swiss Basketball figure)
  //           and for Passiv/Gratis. It is carved OUT of base, never added.
  // tier    = which surcharge set the engine holds the category in:
  //           'adult' → SURCHARGE_ADULT (inherently U16+, surcharged on a missing
  //           licence regardless of birthdate); 'youth' → SURCHARGE_YOUTH (only
  //           when isU16Plus() === true); 'intro' / 'none' → in neither set.
  var CATEGORIES = {
    'VB Turnier KWI':                  { sport: 'volleyball', base: 110, licence: 60,  tier: 'intro' },
    'VB Schüler*in Turnier':           { sport: 'volleyball', base: 210, licence: 60,  tier: 'youth' },
    'VB Schüler*in Meisterschaft':     { sport: 'volleyball', base: 310, licence: 60,  tier: 'youth' },
    'VB Student*in Meisterschaft':     { sport: 'volleyball', base: 380, licence: 110, tier: 'adult' },
    'VB Erwerbstätige':                { sport: 'volleyball', base: 440, licence: 110, tier: 'adult' },
    'BB Erwerbstätige 1. Liga':        { sport: 'basketball', base: 570, licence: 0,   tier: 'adult' },
    'BB Lernende/Studierende 1. Liga': { sport: 'basketball', base: 470, licence: 0,   tier: 'adult' },
    'BB Erwerbstätige':                { sport: 'basketball', base: 520, licence: 0,   tier: 'adult' },
    'BB Lernende/Studierende':         { sport: 'basketball', base: 420, licence: 0,   tier: 'adult' },
    'BB Jugend Meisterschaft':         { sport: 'basketball', base: 320, licence: 0,   tier: 'youth' },
    'BB Minis Turnier':                { sport: 'basketball', base: 220, licence: 0,   tier: 'youth' },
    'Passivmitglied':                  { sport: 'passive',    base: 40,  licence: 0,   tier: 'none' },
    'Gratis':                          { sport: 'passive',    base: 0,   licence: 0,   tier: 'none' }
  };

  function has(k) {
    return Object.prototype.hasOwnProperty.call(CATEGORIES, k);
  }

  // Engine isU16Plus(): "U16" is a birth-year band, approximated by age — born
  // in or before refYear − 15 counts. Unknown or unparsable birthdate → null, so
  // a youth player is never surcharged on an age nobody knows.
  function isU16Plus(dobIso, refYear) {
    if (!dobIso) return null;
    var y = Number(String(dobIso).slice(0, 4));
    if (!isFinite(y) || y % 1 !== 0 || y < 1900) return null;
    if (typeof refYear !== 'number' || !isFinite(refYear)) refYear = new Date().getFullYear();
    return (refYear - y) >= 15;
  }

  // Which categories a person with this function may pick.
  //   Trainer*in → 'Gratis' only: a coach of an active team is a member who owes
  //                nothing (engine: Gratis, migration 262), so the category IS
  //                the waiver — there is no coach rule inside feeBreakdown().
  //   Guest      → the sport's tiers minus the intro one: the KWI first-licence
  //                offer is for pupils joining the club, not for a guest of it.
  //   anyone else → the whole sport. Passive has no function select at all.
  function categoriesFor(sport, funktion) {
    if (funktion === 'Trainer*in') return ['Gratis'];
    var out = [];
    for (var k in CATEGORIES) {
      if (!has(k) || CATEGORIES[k].sport !== sport) continue;
      if (funktion === 'Guest' && CATEGORIES[k].tier === 'intro') continue;
      out.push(k);
    }
    return out;
  }

  // Engine feeBreakdown(), minus the per-member overrides a treasurer sets
  // after the fact (fee_base_override, fee_discount …) — an applicant has none.
  //   opts.category  ClubDesk name (a select value)
  //   opts.funktion  'Guest' → guest rule; 'Trainer*in' → Gratis; else member
  //   opts.dob       ISO date string or '' — gates the youth surcharge only
  //   opts.scorer    true when the applicant holds the sport's scorer licence
  //   opts.referee   true when the applicant referees — waives the surcharge.
  //                  ⚠ That is club policy, NOT a feeBreakdown() rule: its
  //                  hasLicence reads scorer_vb / the OTR-OTN flags only. The
  //                  policy lives in deriveOffiziellenLizenz() (scorer_vb OR
  //                  referee_vb → 'VB SC': a VB referee is automatically a
  //                  scorer) and in the treasurer billing a referee as Gratis,
  //                  which is what the referee note promises.
  //   opts.refYear   calendar year for the age gate (tests pass it; the page
  //                  omits it)
  // Returns null for an unknown category — never a guessed amount.
  function breakdown(opts) {
    opts = opts || {};
    var k = String(opts.category == null ? '' : opts.category).replace(/^\s+|\s+$/g, '');
    var coach = opts.funktion === 'Trainer*in';
    // The coach's select is forced to Gratis by the form; compute from the same
    // category so the table can never show a fee the payload does not carry.
    if (coach) k = 'Gratis';
    if (!has(k)) return null;

    var cat = CATEGORIES[k];
    var base = cat.base;
    var guest = opts.funktion === 'Guest';
    // finance.js zeroes a guest's licence portion: a guest holds no licence at
    // all, the CHF 110 reduction IS the licence coming off, and printing both
    // would show it twice. So a guest's line 1 is the full base.
    var licence = guest ? 0 : cat.licence;
    var referee = opts.referee === true;
    var scorer = opts.scorer === true;

    var surcharge = 0;
    var guestDiscount = 0;
    if (guest) {
      // Engine: base minus CHF 110 floored at 0, and NEVER the surcharge.
      guestDiscount = Math.min(Math.max(base, 0), GUEST_DISCOUNT);
    } else {
      var eligible = cat.tier === 'adult'
        || (cat.tier === 'youth' && isU16Plus(opts.dob, opts.refYear) === true);
      // !referee is the club-policy waiver (see opts.referee above), not engine.
      if (eligible && !scorer && !referee) surcharge = NO_LICENCE_SURCHARGE;
    }

    var total = base + surcharge - guestDiscount;
    if (total < 0) total = 0;

    return {
      category: k,
      base: base,
      licence: licence,
      // Invoice line 1 (finance.js): the club's own fee; the licence stands
      // beside it and the two sum back to base. Itemisation, not a surcharge.
      clubFee: base - licence,
      surcharge: surcharge,
      guestDiscount: guestDiscount,
      total: total,
      coachWaiver: coach,
      refereeNote: referee
    };
  }

  window.KSCW_FEES = {
    NO_LICENCE_SURCHARGE: NO_LICENCE_SURCHARGE,
    GUEST_DISCOUNT: GUEST_DISCOUNT,
    CATEGORIES: CATEGORIES,
    categoriesFor: categoriesFor,
    isU16Plus: isU16Plus,
    breakdown: breakdown
  };
})();
