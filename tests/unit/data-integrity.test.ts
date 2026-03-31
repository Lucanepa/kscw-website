import { describe, it, expect } from 'vitest';
import boardMembers from '../../src/data/board-members.json';
import contactPersons from '../../src/data/contact-persons.json';
import { allTeamDefs } from '../../src/data/teams';

describe('board-members.json', () => {
  it('has at least one entry', () => {
    expect(boardMembers.length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const member of boardMembers) {
      expect(member.name, `Missing name`).toBeTruthy();
      expect(member.initials, `Missing initials for ${member.name}`).toBeTruthy();
      expect(member.role_de, `Missing role_de for ${member.name}`).toBeTruthy();
      expect(member.role_en, `Missing role_en for ${member.name}`).toBeTruthy();
      expect(typeof member.order, `Invalid order for ${member.name}`).toBe('number');
    }
  });
});

describe('contact-persons.json', () => {
  it('has at least one entry', () => {
    expect(contactPersons.length).toBeGreaterThan(0);
  });

  it('every entry has required fields', () => {
    for (const person of contactPersons) {
      expect(person.name, `Missing name`).toBeTruthy();
      expect(person.email, `Missing email for ${person.name}`).toBeTruthy();
      expect(person.email).toContain('@');
      expect(person.sport, `Missing sport for ${person.name}`).toBeTruthy();
      expect(typeof person.order, `Invalid order for ${person.name}`).toBe('number');
    }
  });
});

describe('teams.ts', () => {
  it('has at least one team', () => {
    expect(allTeamDefs.length).toBeGreaterThan(0);
  });

  it('every team has required fields', () => {
    for (const team of allTeamDefs) {
      // directusId may be empty for website-only teams not yet in Directus
      expect(typeof team.directusId, `Invalid directusId type for ${team.displayName}`).toBe('string');
      expect(team.slug, `Missing slug for ${team.displayName}`).toBeTruthy();
      expect(team.sport, `Missing sport for ${team.displayName}`).toBeTruthy();
      expect(team.displayName, `Missing displayName`).toBeTruthy();
      expect(team.category, `Missing category for ${team.displayName}`).toBeTruthy();
      expect(['volleyball', 'basketball']).toContain(team.sport);
      expect(['men', 'women', 'youth']).toContain(team.category);
    }
  });

  it('no duplicate slugs within the same sport', () => {
    const seen = new Map<string, string>();
    for (const team of allTeamDefs) {
      const key = `${team.sport}:${team.slug}`;
      expect(seen.has(key), `Duplicate slug "${team.slug}" in ${team.sport}: ${seen.get(key)} and ${team.displayName}`).toBe(false);
      seen.set(key, team.displayName);
    }
  });
});
