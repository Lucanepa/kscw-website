// Scorer-course sign-up — dynamic client render.
// Replaces the former build-time array: fetches active courses from the
// Directus `scorer_courses` collection (public read), applies the same
// upcoming/null-last filter as getUpcomingScorerCourses, renders a card +
// embedded OpnForm iframe per course, then fills the live sign-up count
// per slug via the Directus OpnForm proxy. Admin edits appear on next
// page load — no rebuild. Degrades silently if Directus is unreachable.

import { getUpcomingScorerCourses, localeSlug, type ScorerCourse } from '../data/scorer-courses';
import { formatDate } from '../lib/utils';
import { getDirectusUrl } from '../lib/directus';

const container = document.querySelector<HTMLElement>('[data-scorer-courses]');

if (container) {
  const locale = (container.dataset.locale === 'en' ? 'en' : 'de') as 'de' | 'en';
  const txt = {
    soon: container.dataset.soon || '',
    opensSoon: container.dataset.opensSoon || '',
    mode: {
      in_person: container.dataset.modeInPerson || '',
      recorded: container.dataset.modeRecorded || '',
      both: container.dataset.modeBoth || '',
    } as Record<ScorerCourse['mode'], string>,
    countOne: container.dataset.countOne || '1',
    countMany: container.dataset.countMany || '{n}',
  };
  const section = container.closest<HTMLElement>('[data-scorer-section]');
  const base = getDirectusUrl();

  const el = (tag: string, attrs: Record<string, string> = {}, text?: string) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };

  const mapRow = (r: Record<string, unknown>): ScorerCourse => ({
    id: String(r.slug_id ?? r.id ?? ''),
    titleDe: String(r.title_de ?? ''),
    titleEn: String(r.title_en ?? ''),
    dateISO: (r.date_iso as string | null) ?? null,
    time: (r.time as string | null) ?? null,
    mode: (['in_person', 'recorded', 'both'].includes(r.mode as string)
      ? (r.mode as ScorerCourse['mode'])
      : 'in_person'),
    formSlugDe: (r.form_slug_de as string | null) ?? null,
    formSlugEn: (r.form_slug_en as string | null) ?? null,
  });

  const fillCount = (badge: HTMLElement, slug: string) => {
    fetch(`${base}/kscw/opnform/forms/${encodeURIComponent(slug)}/count`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const count = Number(json?.count);
        if (!Number.isFinite(count) || count < 1) return;
        const tpl = count === 1 ? txt.countOne : txt.countMany;
        badge.textContent = tpl.replace('{n}', String(count));
        badge.hidden = false;
      })
      .catch(() => { /* upstream unreachable — leave hidden */ });
  };

  const render = (courses: ScorerCourse[]) => {
    for (const course of courses) {
      const slug = localeSlug(course, locale);
      const title = locale === 'en' ? course.titleEn : course.titleDe;

      const card = el('div', { class: 'card' });
      const body = el('div', {
        class: 'card-body',
        style: 'display: flex; flex-direction: column; gap: var(--space-md);',
      });

      const headRow = el('div', {
        style: 'display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-md); flex-wrap: wrap;',
      });
      headRow.appendChild(el('h3', { style: 'margin: 0;' }, title));
      const when = course.dateISO
        ? formatDate(course.dateISO) + (course.time ? ` · ${course.time}` : '')
        : txt.soon;
      headRow.appendChild(el('span', { style: 'font-weight: 600; color: var(--kscw-blue);' }, when));
      body.appendChild(headRow);

      const metaRow = el('div', {
        style: 'display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap;',
      });
      metaRow.appendChild(el('span', {
        class: 'chip',
        style: 'background: var(--kscw-gold); color: var(--text-on-gold);',
      }, txt.mode[course.mode] || ''));
      if (slug) {
        const badge = el('span', { class: 'scorer-count' });
        badge.hidden = true;
        metaRow.appendChild(badge);
        fillCount(badge, slug);
      }
      body.appendChild(metaRow);

      if (slug) {
        const frame = el('iframe', {
          class: 'scorer-iframe',
          src: `https://forms.kscw.ch/forms/${slug}`,
          title,
          loading: 'lazy',
        });
        body.appendChild(frame);
      } else if (course.dateISO) {
        // Date is set but no sign-up form yet — say so without re-claiming
        // the date is TBD. When the date itself is null the header span
        // already shows the full "date to be announced" message.
        body.appendChild(el('p', {
          style: 'color: var(--text-muted); font-style: italic; margin: 0;',
        }, txt.opensSoon));
      }

      card.appendChild(body);
      container.appendChild(card);
    }
  };

  fetch(`${base}/items/scorer_courses?filter[active][_eq]=true&fields=slug_id,title_de,title_en,date_iso,time,mode,form_slug_de,form_slug_en,sort&sort=sort&limit=-1`)
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => {
      const rows = Array.isArray(json?.data) ? (json.data as Record<string, unknown>[]) : [];
      const upcoming = getUpcomingScorerCourses(rows.map(mapRow));
      if (!upcoming.length) return;
      render(upcoming);
      if (section) section.hidden = false;
    })
    .catch(() => { /* Directus unreachable — section stays hidden */ });
}
