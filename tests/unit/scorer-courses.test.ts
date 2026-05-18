import { describe, it, expect } from 'vitest';
import { scorerCourses, getUpcomingScorerCourses, localeSlug, normalizeFormSlug, type ScorerCourse } from 'src/data/scorer-courses';

const base: ScorerCourse = {
  id: 't', titleDe: 'Kurs', titleEn: 'Course',
  dateISO: '2026-07-08', time: '18:00', mode: 'in_person',
  formSlugDe: null, formSlugEn: 'schreiberkurs-2026-07-08-en',
};

describe('scorer-courses data', () => {
  it('every course has a stable id and at least one locale title', () => {
    for (const c of scorerCourses) {
      expect(c.id, 'missing id').toBeTruthy();
      expect(c.titleDe && c.titleEn, `missing titles for ${c.id}`).toBeTruthy();
      expect(['in_person', 'recorded', 'both']).toContain(c.mode);
    }
  });

  it('getUpcomingScorerCourses keeps null-date (TBA) and future, drops past, sorts by date', () => {
    const tba = { ...base, id: 'tba', dateISO: null };
    const past = { ...base, id: 'past', dateISO: '2020-01-01' };
    const future = { ...base, id: 'future', dateISO: '2099-01-01' };
    const soon = { ...base, id: 'soon', dateISO: '2030-01-01' };
    const out = getUpcomingScorerCourses([past, future, tba, soon], new Date('2026-06-01'));
    expect(out.map(c => c.id)).toEqual(['soon', 'future', 'tba']);
  });

  it('localeSlug returns the locale form slug or null', () => {
    expect(localeSlug(base, 'en')).toBe('schreiberkurs-2026-07-08-en');
    expect(localeSlug(base, 'de')).toBeNull();
  });

  it('normalizeFormSlug extracts the bare slug from a full forms.kscw.ch URL', () => {
    expect(normalizeFormSlug('https://forms.kscw.ch/forms/scorer-kurse-2026-en-l3tcje'))
      .toBe('scorer-kurse-2026-en-l3tcje');
    expect(normalizeFormSlug('http://forms.kscw.ch/forms/abc-123/')).toBe('abc-123');
    expect(normalizeFormSlug('https://forms.kscw.ch/forms/abc-123?foo=1#x')).toBe('abc-123');
  });

  it('normalizeFormSlug is idempotent for already-bare slugs and null-safe', () => {
    expect(normalizeFormSlug('scorer-2026-07-08-en')).toBe('scorer-2026-07-08-en');
    expect(normalizeFormSlug(null)).toBeNull();
    expect(normalizeFormSlug('')).toBeNull();
    expect(normalizeFormSlug('   ')).toBeNull();
  });
});
