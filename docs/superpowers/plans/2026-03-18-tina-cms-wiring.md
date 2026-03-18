# Tina CMS Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Tina CMS collections to Astro templates so editors can manage board members, contacts, and news via `/admin/`, with automatic DE→EN translation for news.

**Architecture:** Astro pages query Tina's generated GraphQL client at build time. Board members and contacts use bilingual fields (role_de/role_en) in single entries. News is written in German only; a GitHub Action translates to English via DeepL and commits the result.

**Tech Stack:** Astro 6, Tina CMS 3.5.0, DeepL Free API, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-18-tina-cms-wiring-design.md`

---

## File Map

**Create:**
- `content/board-members/dario-kaufmann.md`
- `content/board-members/radomir-radovanovic.md`
- `content/board-members/roger-ruebsam.md`
- `content/board-members/anne-grimshaw.md`
- `content/board-members/rachel-moser.md`
- `content/board-members/thamayanth-kanagalingam.md`
- `content/contact-persons/thamayanth-kanagalingam.md`
- `content/contact-persons/anja-jimenez.md`
- `content/contact-persons/rachel-moser.md`
- `.github/workflows/translate-news.yml`
- `.github/workflows/scripts/translate-news.mjs`

**Modify:**
- `tina/config.ts` — add `contactPerson` collection, update `news` collection (remove locale, flatten path)
- `src/pages/de/club/vorstand.astro` — replace hardcoded cards with Tina query loop
- `src/pages/en/club/vorstand.astro` — replace hardcoded HTML with BoardCard + Tina query
- `src/pages/de/club/kontakt.astro` — replace hardcoded sidebar with Tina query
- `src/pages/en/club/kontakt.astro` — same
- `src/components/BoardCard.astro` — add auto-initials fallback
- `src/pages/de/index.astro` — wire news grid to Tina (replace client-side JS)
- `src/pages/en/index.astro` — same, reading from `content/news-en/`

**Move:**
- `content/news/de/2026-03-willkommen.mdx` → `content/news/2026-03-willkommen.mdx`

**Delete:**
- `content/news/de/` directory
- `content/news/en/` directory (and `2026-03-welcome.mdx` — will be auto-generated)

---

## Task 1: Merge dev → master

- [ ] **Step 1: Merge and push**

```bash
cd ~/Desktop/Github/kscw-website
git checkout master
git merge dev
git push origin master
```

- [ ] **Step 2: Switch back to dev**

```bash
git checkout dev
```

- [ ] **Step 3: Commit checkpoint**

No commit needed — this is a merge.

---

## Task 2: Create Board Member Content Files

**Files:**
- Create: `content/board-members/dario-kaufmann.md`
- Create: `content/board-members/radomir-radovanovic.md`
- Create: `content/board-members/roger-ruebsam.md`
- Create: `content/board-members/anne-grimshaw.md`
- Create: `content/board-members/rachel-moser.md`
- Create: `content/board-members/thamayanth-kanagalingam.md`
- Modify: `content/board-members/michelle-howald.md` (verify existing)
- Modify: `content/board-members/anja-jimenez.md` (verify existing)

- [ ] **Step 1: Create the 6 missing board member files**

Each file follows this format (example for Dario Kaufmann):

```markdown
---
name: Dario Kaufmann
initials: DK
role_de: Kassier
role_en: Treasurer
order: 3
---
```

Full list:

| File | name | initials | role_de | role_en | order |
| --- | --- | --- | --- | --- | --- |
| dario-kaufmann.md | Dario Kaufmann | DK | Kassier | Treasurer | 3 |
| radomir-radovanovic.md | Radomir Radovanovic | RR | Kassier | Treasurer | 4 |
| roger-ruebsam.md | Roger Ruebsam | RR | Aktuar | Secretary | 5 |
| anne-grimshaw.md | Anne Grimshaw | AG | Beisitzerin | Assessor | 6 |
| rachel-moser.md | Rachel Moser | RM | TK Basketball | TC Basketball | 7 |
| thamayanth-kanagalingam.md | Thamayanth Kanagalingam | TK | TK Volleyball | TC Volleyball | 8 |

- [ ] **Step 2: Verify existing files match expected data**

Check `michelle-howald.md` has `order: 1`, `role_de: Präsidentin`, `role_en: President`.
Check `anja-jimenez.md` has `order: 2`, `role_de: Vizepräsidentin`, `role_en: Vice President`.

- [ ] **Step 3: Build test**

```bash
npm run build 2>&1 | tail -5
```

Expected: build passes, 65+ pages built.

- [ ] **Step 4: Commit**

```bash
git add content/board-members/
git commit -m "content: add all 8 board member files for Tina CMS"
```

---

## Task 3: Wire Board Members Templates to Tina

**Files:**
- Modify: `src/components/BoardCard.astro`
- Modify: `src/pages/de/club/vorstand.astro`
- Modify: `src/pages/en/club/vorstand.astro`

- [ ] **Step 1: Update BoardCard to auto-generate initials**

In `src/components/BoardCard.astro`, change the Props interface to make `initials` optional, and add auto-generation from `name`:

```astro
---
interface Props {
  name: string;
  initials?: string;
  role: string;
  photoUrl?: string;
}

const { name, initials: providedInitials, role, photoUrl } = Astro.props;
const initials = providedInitials || name.split(' ').map(w => w[0]).join('').toUpperCase();
---
```

Rest of the template stays the same.

- [ ] **Step 2: Rewrite DE vorstand.astro to query Tina**

Replace the entire frontmatter and board-grid section in `src/pages/de/club/vorstand.astro`:

```astro
---
import PageLayout from '../../../layouts/PageLayout.astro';
import BoardCard from '../../../components/BoardCard.astro';
import CTA from '../../../components/CTA.astro';
import { t } from '../../../lib/i18n';
import client from '../../../../tina/__generated__/client';

const locale = 'de';

let members = [];
try {
  const res = await client.queries.boardMemberConnection({ first: 50 });
  members = (res.data.boardMemberConnection.edges ?? [])
    .map(e => e.node)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
} catch (e) {
  console.warn('Failed to fetch board members from Tina:', e.message);
}
---
<PageLayout
  title="Vorstand — KSC Wiedikon"
  description="Der Vorstand des KSC Wiedikon — die Menschen hinter dem Verein."
  locale={locale}
  pageTitle={t(locale, 'boardTitle')}
  pageSubtitle={t(locale, 'boardSubtitle')}
>
  <section class="section">
    <div class="container">
      <div class="board-grid">
        {members.length > 0 ? (
          members.map(m => (
            <BoardCard
              name={m.name}
              initials={m.initials}
              role={m.role_de || m.name}
              photoUrl={m.photo}
            />
          ))
        ) : (
          <p>Keine Vorstandsmitglieder gefunden.</p>
        )}
      </div>
    </div>
  </section>

  <CTA
    title={t(locale, 'boardCTA')}
    text={t(locale, 'boardCTAText')}
    buttonLabel={t(locale, 'boardCTAButton')}
    buttonHref={`/${locale}/club/kontakt`}
  />

  <script src="../../../islands/scroll-animations.ts"></script>
</PageLayout>
```

Keep the existing `<style>` block unchanged.

- [ ] **Step 3: Rewrite EN vorstand.astro to use BoardCard + Tina**

Replace the entire content of `src/pages/en/club/vorstand.astro` with the same structure as DE, but with `locale = 'en'` and `m.role_en` instead of `m.role_de`. Also use EN meta text:

```astro
---
import PageLayout from '../../../layouts/PageLayout.astro';
import BoardCard from '../../../components/BoardCard.astro';
import CTA from '../../../components/CTA.astro';
import { t } from '../../../lib/i18n';
import client from '../../../../tina/__generated__/client';

const locale = 'en';

let members = [];
try {
  const res = await client.queries.boardMemberConnection({ first: 50 });
  members = (res.data.boardMemberConnection.edges ?? [])
    .map(e => e.node)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
} catch (e) {
  console.warn('Failed to fetch board members from Tina:', e.message);
}
---
<PageLayout
  title="Board — KSC Wiedikon"
  description="The board of KSC Wiedikon — the people behind the club."
  locale={locale}
  pageTitle={t(locale, 'boardTitle')}
  pageSubtitle={t(locale, 'boardSubtitle')}
>
  <section class="section">
    <div class="container">
      <div class="board-grid">
        {members.length > 0 ? (
          members.map(m => (
            <BoardCard
              name={m.name}
              initials={m.initials}
              role={m.role_en || m.name}
              photoUrl={m.photo}
            />
          ))
        ) : (
          <p>No board members found.</p>
        )}
      </div>
    </div>
  </section>

  <CTA
    title={t(locale, 'boardCTA')}
    text={t(locale, 'boardCTAText')}
    buttonLabel={t(locale, 'boardCTAButton')}
    buttonHref={`/${locale}/club/kontakt`}
  />

  <script src="../../../islands/scroll-animations.ts"></script>
</PageLayout>
```

Keep the `<style>` block from DE (the board-grid responsive styles). Remove the old EN-specific inline styles (`.board-card`, `.board-avatar`, etc.) since `BoardCard.astro` handles that now.

- [ ] **Step 4: Build test**

```bash
npm run build 2>&1 | tail -5
```

Expected: build passes. Check output includes vorstand pages.

- [ ] **Step 5: Visual verification**

```bash
npm run dev
```

Visit `http://localhost:4321/de/club/vorstand/` and `http://localhost:4321/en/club/vorstand/`. Verify all 8 board members render with correct names and roles per locale.

- [ ] **Step 6: Remove orphaned i18n keys**

Remove the following keys from both `src/i18n/de.json` and `src/i18n/en.json` (they are now replaced by Tina `role_de`/`role_en` fields):
- `boardRolePresident`
- `boardRoleVicePresident`
- `boardRoleTreasurer`
- `boardRoleSecretary`
- `boardRoleAssessor`
- `boardRoleTKBasketball`
- `boardRoleTKVolleyball`

- [ ] **Step 7: Commit**

```bash
git add src/components/BoardCard.astro src/pages/de/club/vorstand.astro src/pages/en/club/vorstand.astro src/i18n/de.json src/i18n/en.json
git commit -m "feat: wire board members page to Tina CMS collection"
```

---

## Task 4: Add contactPerson Collection to Tina

**Files:**
- Modify: `tina/config.ts`
- Create: `content/contact-persons/thamayanth-kanagalingam.md`
- Create: `content/contact-persons/anja-jimenez.md`
- Create: `content/contact-persons/rachel-moser.md`

- [ ] **Step 1: Add contactPerson collection to tina/config.ts**

Add after the `boardMember` collection in the `collections` array:

```typescript
{
  name: 'contactPerson',
  label: 'Contact Persons',
  path: 'content/contact-persons',
  format: 'md',
  fields: [
    {
      type: 'string',
      name: 'name',
      label: 'Name',
      isTitle: true,
      required: true,
    },
    {
      type: 'string',
      name: 'email',
      label: 'Email',
      required: true,
    },
    {
      type: 'string',
      name: 'sport',
      label: 'Sport',
      options: ['general', 'volleyball', 'basketball'],
      required: true,
    },
    {
      type: 'number',
      name: 'order',
      label: 'Sort Order',
      required: true,
    },
  ],
},
```

- [ ] **Step 2: Create content/contact-persons/ directory and content files**

`content/contact-persons/thamayanth-kanagalingam.md`:

```markdown
---
name: Thamayanth Kanagalingam
email: volleyball@kscw.ch
sport: volleyball
order: 1
---
```

`content/contact-persons/anja-jimenez.md`:

```markdown
---
name: Anja Jimenez
email: anja.jimenez@kscw.ch
sport: basketball
order: 1
---
```

`content/contact-persons/rachel-moser.md`:

```markdown
---
name: Rachel Moser
email: rachel.moser@kscw.ch
sport: basketball
order: 2
---
```

- [ ] **Step 3: Regenerate Tina types**

```bash
npx tinacms build
```

This regenerates `tina/__generated__/types.ts` and `tina/__generated__/client.ts` with the new `contactPersonConnection` query.

- [ ] **Step 4: Build test**

```bash
npm run build 2>&1 | tail -5
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add tina/config.ts content/contact-persons/ tina/__generated__/
git commit -m "feat: add contactPerson Tina collection with initial data"
```

---

## Task 5: Wire Contact Page Sidebar to Tina

**Files:**
- Modify: `src/pages/de/club/kontakt.astro`
- Modify: `src/pages/en/club/kontakt.astro`

- [ ] **Step 1: Rewrite DE kontakt.astro sidebar**

Add Tina client import and query to frontmatter:

```astro
---
import BaseLayout from '../../../layouts/BaseLayout.astro';
import { t } from '../../../lib/i18n';
import client from '../../../../tina/__generated__/client';

const locale = 'de';

let contactPersons = [];
try {
  const res = await client.queries.contactPersonConnection({ first: 50 });
  contactPersons = (res.data.contactPersonConnection.edges ?? [])
    .map(e => e.node)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
} catch (e) {
  console.warn('Failed to fetch contact persons from Tina:', e.message);
}

const volleyballContacts = contactPersons.filter(c => c.sport === 'volleyball');
const basketballContacts = contactPersons.filter(c => c.sport === 'basketball');
---
```

Replace the sidebar section (lines 75-132 in current DE file) with:

```astro
<!-- Sidebar -->
<div class="contact-sidebar">
  <h2>{t(locale, 'contactSidebar')}</h2>

  <!-- General -->
  <div class="contact-info-card">
    <h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--kscw-blue, #4A55A2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      <span>{t(locale, 'contactGeneral')}</span>
    </h3>
    <p>
      KSC Wiedikon<br>
      <a href="mailto:kontakt@kscw.ch">kontakt@kscw.ch</a>
    </p>
  </div>

  <!-- Volleyball -->
  {volleyballContacts.length > 0 && (
    <div class="contact-info-card">
      <h3>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--kscw-blue, #4A55A2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M2 12c3-3 6.5-5 10-5s7 2 10 5"/><path d="M2 12c3 3 6.5 5 10 5s7-2 10-5"/></svg>
        Volleyball
      </h3>
      {volleyballContacts.map(c => (
        <p style={volleyballContacts.indexOf(c) > 0 ? 'margin-top: var(--space-sm);' : ''}>
          {c.name}<br>
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </p>
      ))}
    </div>
  )}

  <!-- Basketball -->
  {basketballContacts.length > 0 && (
    <div class="contact-info-card">
      <h3>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M7 12a5 5 0 0 1 10 0"/><path d="M12 7a5 5 0 0 0 0 10"/></svg>
        Basketball
      </h3>
      {basketballContacts.map(c => (
        <p style={basketballContacts.indexOf(c) > 0 ? 'margin-top: var(--space-sm);' : ''}>
          {c.name}<br>
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </p>
      ))}
    </div>
  )}

  <!-- Social Media (stays hardcoded) -->
  <div class="contact-info-card">
    <h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--kscw-blue, #4A55A2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
      <span>{t(locale, 'contactSocialMedia')}</span>
    </h3>
    <div class="social-links">
      <a href="https://www.facebook.com/kscwiedikon/" class="social-link">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
        KSC-Wiedikon
      </a>
      <a href="https://www.instagram.com/ksc_wiedikon/" class="social-link">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
        @ksc_wiedikon
      </a>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Rewrite EN kontakt.astro sidebar**

Same approach as DE. Add Tina import/query to frontmatter. Replace sidebar. The only difference: the EN template already uses `PageLayout` (not `BaseLayout`), so keep that. Social media card uses Lucide `data-lucide` icons instead of inline SVGs — keep the EN icon approach.

The sidebar replacement is identical except it uses EN's existing icon approach (`data-lucide` attributes).

- [ ] **Step 3: Build test**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Visual verification**

```bash
npm run dev
```

Visit `http://localhost:4321/de/club/kontakt/` and EN version. Verify:
- General card shows "KSC Wiedikon" + kontakt@kscw.ch
- Volleyball card shows Thamayanth Kanagalingam
- Basketball card shows Anja Jimenez + Rachel Moser (grouped)
- Social media card unchanged

- [ ] **Step 5: Commit**

```bash
git add src/pages/de/club/kontakt.astro src/pages/en/club/kontakt.astro
git commit -m "feat: wire contact page sidebar to Tina CMS contactPerson collection"
```

---

## Task 6: Flatten News Collection + Wire Templates

**Files:**
- Modify: `tina/config.ts` (remove `locale` field from news)
- Move: `content/news/de/2026-03-willkommen.mdx` → `content/news/2026-03-willkommen.mdx`
- Delete: `content/news/de/`, `content/news/en/`
- Modify: `src/pages/de/index.astro` (wire news grid to Tina)
- Modify: `src/pages/en/index.astro` (same)

- [ ] **Step 1: Update news collection in tina/config.ts**

Remove the `locale` field from the news collection. The `path` stays `content/news` (already correct — articles will be directly in this folder now).

Remove this block from the news fields array:

```typescript
{
  type: 'string',
  name: 'locale',
  label: 'Language',
  options: ['de', 'en'],
  required: true,
},
```

- [ ] **Step 2: Move news files and delete locale folders**

```bash
mv content/news/de/2026-03-willkommen.mdx content/news/2026-03-willkommen.mdx
rm -rf content/news/de content/news/en
```

- [ ] **Step 3: Remove locale from news frontmatter**

Edit `content/news/2026-03-willkommen.mdx` — remove the `locale: de` line from frontmatter.

- [ ] **Step 4: Create content/news-en/ directory for auto-translations**

```bash
mkdir -p content/news-en
```

Add a `.gitkeep` file so the directory is tracked:

```bash
touch content/news-en/.gitkeep
```

- [ ] **Step 5: Regenerate Tina types**

```bash
npx tinacms build
```

- [ ] **Step 6: Build test**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add tina/config.ts content/news/ content/news-en/ tina/__generated__/
git commit -m "feat: flatten news collection, remove locale subfolders"
```

---

## Task 7: Wire News Grid on Homepage to Tina

**Files:**
- Modify: `src/pages/de/index.astro` (replace client-side news JS with Tina query)
- Modify: `src/pages/en/index.astro` (read from `content/news-en/` via glob)

Currently, news on the homepage is rendered client-side via `window.KSCW.news` from `/js/data.js`. Replace with build-time data from Tina (DE) and file glob (EN).

- [ ] **Step 1: Wire DE index news to Tina**

Add to the frontmatter of `src/pages/de/index.astro`:

```astro
import client from '../../../tina/__generated__/client';

let newsArticles = [];
try {
  const res = await client.queries.newsConnection({ first: 6, sort: 'date' });
  newsArticles = (res.data.newsConnection.edges ?? [])
    .map(e => e.node)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
} catch (e) {
  console.warn('Failed to fetch news from Tina:', e.message);
}
```

Replace the `<div id="news-grid" class="grid grid-3">` empty div and its client-side JS rendering with server-rendered cards:

```astro
<div class="grid grid-3">
  {newsArticles.length > 0 ? (
    newsArticles.map(n => (
      <article class="card news-card fade-in">
        <div class="card-img-placeholder">
          {n.image ? (
            <img src={n.image} alt={n.title} style="width:100%;height:100%;object-fit:cover;" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
          )}
        </div>
        <div class="card-body">
          <div class="flex items-center gap-sm mb-md">
            <span class="news-date">{new Date(n.date).toLocaleDateString('de-CH')}</span>
            <span class={`badge ${n.category === 'volleyball' ? 'badge-blue' : n.category === 'basketball' ? 'badge-orange' : ''}`}>
              {n.category === 'volleyball' ? 'Volleyball' : n.category === 'basketball' ? 'Basketball' : 'Club'}
            </span>
          </div>
          <h3>{n.title}</h3>
          <p class="news-excerpt">{n.excerpt}</p>
        </div>
      </article>
    ))
  ) : (
    <p>Keine News vorhanden.</p>
  )}
</div>
```

Remove the client-side JS that populates `#news-grid` (the `D.news` rendering block).

- [ ] **Step 2: Wire EN index news via file glob**

The EN translations live in `content/news-en/` (not a Tina collection). Use Astro's `import.meta.glob` to read them:

```astro
const newsFiles = import.meta.glob('/content/news-en/*.mdx', { eager: true });
const newsArticlesEn = Object.values(newsFiles)
  .map(f => f.frontmatter)
  .filter(f => f?.title)
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 6);
```

Render the same card structure as DE but with `en-CH` locale formatting and English fallback text.

Note: if `content/news-en/` is empty (no translations yet), the grid shows "No news available." — this is expected until the GitHub Action runs.

- [ ] **Step 3: Build test**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/de/index.astro src/pages/en/index.astro
git commit -m "feat: wire homepage news grid to Tina (DE) and file glob (EN)"
```

---

## Task 8: GitHub Action for DeepL Auto-Translation (renumbered from 7)

**Files:**
- Create: `.github/workflows/translate-news.yml`
- Create: `.github/workflows/scripts/translate-news.mjs`

**Prerequisites:** Add `DEEPL_API_KEY` as a GitHub repository secret on `kscw-website`.

- [ ] **Step 1: Create the translation script**

`.github/workflows/scripts/translate-news.mjs`:

```javascript
// Translates news MDX files from DE to EN using DeepL Free API.
// Usage: node translate-news.mjs <source-file> <target-file>

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';
const DEEPL_API_KEY = process.env.DEEPL_API_KEY;

if (!DEEPL_API_KEY) {
  console.error('DEEPL_API_KEY environment variable is required');
  process.exit(1);
}

const [sourceFile, targetFile] = process.argv.slice(2);

if (!sourceFile || !targetFile) {
  console.error('Usage: node translate-news.mjs <source.mdx> <target.mdx>');
  process.exit(1);
}

async function translate(text) {
  const res = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` },
    body: JSON.stringify({ text: [text], source_lang: 'DE', target_lang: 'EN' }),
  });
  if (!res.ok) throw new Error(`DeepL API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.translations[0].text;
}

// Parse frontmatter + body
const raw = await readFile(sourceFile, 'utf-8');
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
if (!fmMatch) {
  console.error('Could not parse frontmatter from', sourceFile);
  process.exit(1);
}

const frontmatter = fmMatch[1];
const body = fmMatch[2].trim();

// Extract title and excerpt using regex (handles colons in values)
const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
const excerptMatch = frontmatter.match(/^excerpt:\s*(.+)$/m);
const title = titleMatch?.[1]?.trim() || '';
const excerpt = excerptMatch?.[1]?.trim() || '';

// Translate title, excerpt, body
console.log(`Translating: ${title || sourceFile}`);
const [titleEn, excerptEn, bodyEn] = await Promise.all([
  title ? translate(title) : '',
  excerpt ? translate(excerpt) : '',
  body ? translate(body) : '',
]);

// Replace translated fields in frontmatter using regex
let newFm = frontmatter;
if (titleEn) newFm = newFm.replace(/^title:\s*.+$/m, `title: ${titleEn}`);
if (excerptEn) newFm = newFm.replace(/^excerpt:\s*.+$/m, `excerpt: ${excerptEn}`);

const output = `---\n${newFm}\n---\n\n${bodyEn}\n`;

await mkdir(dirname(targetFile), { recursive: true });
await writeFile(targetFile, output, 'utf-8');
console.log(`Written: ${targetFile}`);
```

- [ ] **Step 2: Create the GitHub Action workflow**

`.github/workflows/translate-news.yml`:

```yaml
name: Translate News (DE → EN)

on:
  push:
    branches: [master]
    paths:
      - 'content/news/**'

permissions:
  contents: write

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Find changed news files
        id: changed
        run: |
          files=$(git diff --name-only ${{ github.event.before }} ${{ github.sha }} -- 'content/news/*.mdx' || true)
          echo "files=$files" >> "$GITHUB_OUTPUT"
          echo "Changed news files: $files"

      - name: Translate changed files
        if: steps.changed.outputs.files != ''
        env:
          DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
        run: |
          for file in ${{ steps.changed.outputs.files }}; do
            basename=$(basename "$file")
            target="content/news-en/$basename"
            node .github/workflows/scripts/translate-news.mjs "$file" "$target"
          done

      - name: Commit translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add content/news-en/
          if git diff --cached --quiet; then
            echo "No translation changes to commit"
          else
            git commit -m "auto-translate: update EN news translations"
            git push
          fi
```

- [ ] **Step 3: Build test (local — just verify files exist)**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Action for automatic DE→EN news translation via DeepL"
```

---

## Task 9: Merge to master + Final Verification

- [ ] **Step 1: Build final check**

```bash
npm run build 2>&1 | grep -E "(error|✓|built)" | head -10
```

- [ ] **Step 2: Merge and push**

```bash
git checkout master
git merge dev
git push origin master
git checkout dev
```

- [ ] **Step 3: Verify Tina admin**

Visit `https://kscw-website.pages.dev/admin/` after CF Pages rebuilds. Check:
- Board Members collection shows 8 entries
- Contact Persons collection shows 3 entries
- News collection shows articles without locale subfolders

- [ ] **Step 4: End-to-end test**

Edit a board member in Tina admin (e.g., change a role), save, wait for CF Pages rebuild, verify the change appears on the live site.

---

## Task 10 (Post-deploy): Set Up DeepL API Key

This is a manual step for the repo owner:

- [ ] **Step 1: Get DeepL API key**

Sign up at https://www.deepl.com/pro-api (Free plan, 500k chars/month).

- [ ] **Step 2: Add GitHub secret**

GitHub → `kscw-website` → Settings → Secrets → Actions → New: `DEEPL_API_KEY` = your key.

- [ ] **Step 3: Test the workflow**

Create a test news article in Tina admin, save. Verify the GitHub Action runs and creates an EN translation in `content/news-en/`.
