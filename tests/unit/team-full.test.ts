import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import de from '../../public/js/i18n/de.json';
import en from '../../public/js/i18n/en.json';

/**
 * A full team must not be contactable.
 *
 * `teams.open_for_players` is the single authority for open-vs-full across the
 * site (YouthMeta.astro, youth-status.js, contact-form.js, team-page.js). A team
 * page used to render its gold "get in touch" button for a full team anyway —
 * directly under a note saying the team was full — and /club/kontakt let the same
 * team through its dropdown with the submit enabled. Both doors led to a coach who
 * could only answer no.
 */
const teamPage = readFileSync('public/js/team-page.js', 'utf8');
const contactForm = readFileSync('public/js/contact-form.js', 'utf8');
const teamHero = readFileSync('src/components/TeamHero.astro', 'utf8');
const teamCard = readFileSync('src/components/TeamCard.astro', 'utf8');
const teamsFetch = readFileSync('src/lib/fetch/teams.ts', 'utf8');
const teamDetail = readFileSync('src/lib/fetch/teamDetail.ts', 'utf8');

describe('a full team offers no way to get in touch', () => {
  it('team-page.js builds the CTA button only when the team is open', () => {
    // The button block must sit inside the isOpen branch, not beside it.
    const guarded = /if \(isOpen\) \{[\s\S]{0,400}?teamCTAButton/.test(teamPage);
    expect(guarded, 'the teamCTAButton anchor is no longer gated on isOpen').toBe(true);
  });

  it('team-page.js never routes a full team at /club/kontakt', () => {
    // One href, one guard: if a second contactHref consumer appears it has to be
    // re-checked against isOpen by hand.
    const hrefUses = teamPage.match(/contactHref/g) || [];
    expect(hrefUses.length, 'more than one contactHref consumer to audit').toBe(2);
  });

  it('contact-form.js blocks the submit for any closed team', () => {
    // The branch for a closed non-youth team: note + setSubmitBlocked(true).
    const branch = contactForm.slice(
      contactForm.indexOf('team.open_for_players === false) {'),
    );
    expect(branch).toContain('contactTeamFullNoContact');
    const untilElse = branch.slice(0, branch.indexOf('} else {'));
    expect(untilElse, 'a full team can still submit the contact form')
      .toContain('setSubmitBlocked(true)');
  });
});

describe('a full team says so', () => {
  it('the build-time hero carries the badge', () => {
    expect(teamHero).toContain('!team.openForPlayers');
    expect(teamHero).toContain('data-i18n="teamFullBadge"');
  });

  it('the client hero renders the identical badge, so the swap is a no-op', () => {
    expect(teamPage).toContain("fullBadge.className = 'hero-team-full'");
    expect(teamPage).toContain("setAttribute('data-i18n', 'teamFullBadge')");
    expect(teamHero).toContain('class="hero-team-full"');
  });

  it('open_for_players fails closed — only an explicit true is open', () => {
    expect(teamDetail).toContain('raw.open_for_players === true');
  });

  it('the listing cards wear the same badge', () => {
    expect(teamCard).toContain('badge-team-full');
    expect(teamCard).toContain("data-i18n=\"teamFullBadge\"");
  });

  it('the listing flag fails OPEN — a missing field must not paint every card full', () => {
    // The opposite of the detail page on purpose: there an unknown value guards a
    // contact channel, here it would stamp "Team voll" across the whole site.
    expect(teamsFetch).toContain('t.open_for_players !== false');
  });

  it('a full team is not even offered in the contact dropdown', () => {
    expect(contactForm).toContain('if (isFull && !isYouthBB) continue;');
  });

  it('tells the two backend rejections apart by code, never by a waitlist column', () => {
    // tests/unit/youth-basketball.test.ts bans reading waitlist_url here (the
    // 2026-08-18 DU12 inversion); the error code carries the distinction instead.
    expect(contactForm).toContain("d.error === 'team_closed'");
    expect(contactForm).toContain("d.error === 'team_full'");
  });

  it('defines the full-team strings in both dictionaries', () => {
    for (const key of ['teamFullBadge', 'teamFullTitle', 'contactTeamFullNoContact',
      'contactTeamFullNoWaitlist']) {
      expect(de, `missing in de.json: ${key}`).toHaveProperty(key);
      expect(en, `missing in en.json: ${key}`).toHaveProperty(key);
    }
  });
});
