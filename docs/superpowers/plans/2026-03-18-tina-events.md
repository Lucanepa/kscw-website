# Tina CMS Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tina CMS event collection for club events, display them on homepage and calendar page, and auto-translate to English via DeepL.

**Architecture:** New Tina `event` collection stores German events as MDX. The existing DeepL translation script (renamed to `translate-content.mjs`) is extended to also translate events. Homepage shows upcoming events as cards. Calendar page injects events as build-time JSON, and `calendar-grid.ts` renders them alongside PocketBase games.

**Tech Stack:** Astro, Tina CMS, DeepL Free API, GitHub Actions, vanilla TypeScript

**Spec:** `docs/superpowers/specs/2026-03-18-tina-events-design.md`

---

## File Structure

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `tina/config.ts` | Add `event` collection |
| Create | `content/events/.gitkeep` | German events directory |
| Create | `content/events-en/.gitkeep` | English events directory |
| Rename+Modify | `.github/scripts/translate-news.mjs` → `translate-content.mjs` | Extend for events |
| Modify | `.github/workflows/translate-news.yml` | Rename, add events paths + git add |
| Modify | `src/i18n/de.json` | Add event i18n keys |
| Modify | `src/i18n/en.json` | Add event i18n keys |
| Modify | `src/pages/de/index.astro` | Add upcoming events section |
| Modify | `src/pages/en/index.astro` | Add upcoming events section |
| Modify | `src/pages/de/weiteres/kalender.astro` | Inject events JSON + events list |
| Modify | `src/pages/en/weiteres/kalender.astro` | Inject events JSON + events list |
| Modify | `src/islands/calendar-grid.ts` | Render event chips + tooltip |
| Modify | `src/styles/global.css` | Event chip, card, badge styles |

---

### Task 1: Add event Tina collection + content directories

**Files:**
- Modify: `tina/config.ts:233` (before closing `],` of collections array)
- Create: `content/events/.gitkeep`
- Create: `content/events-en/.gitkeep`

- [ ] **Step 1: Add event collection to tina/config.ts**

Insert before the closing `],` of the `collections` array (line 234):

```typescript
      {
        name: 'event',
        label: 'Events',
        path: 'content/events',
        format: 'mdx',
        fields: [
          {
            type: 'string',
            name: 'title',
            label: 'Title',
            isTitle: true,
            required: true,
          },
          {
            type: 'datetime',
            name: 'date',
            label: 'Start Date',
            required: true,
          },
          {
            type: 'datetime',
            name: 'endDate',
            label: 'End Date',
          },
          {
            type: 'string',
            name: 'time',
            label: 'Time (e.g. 19:00)',
          },
          {
            type: 'string',
            name: 'location',
            label: 'Location',
          },
          {
            type: 'string',
            name: 'category',
            label: 'Category',
            options: ['social', 'assembly', 'volunteer', 'other'],
            required: true,
          },
          {
            type: 'image',
            name: 'image',
            label: 'Featured Image',
          },
          {
            type: 'rich-text',
            name: 'body',
            label: 'Description',
            isBody: true,
          },
        ],
      },
```

- [ ] **Step 2: Create content directories**

```bash
mkdir -p content/events content/events-en
touch content/events/.gitkeep content/events-en/.gitkeep
```

- [ ] **Step 3: Create a sample event for testing**

Create `content/events/2026-04-gv.mdx`:

```mdx
---
title: Generalversammlung 2026
date: 2026-04-15T00:00:00.000Z
time: "19:00"
location: Turnhalle Sihlfeld
category: assembly
---

Die jährliche Generalversammlung des KSC Wiedikon. Alle Mitglieder sind herzlich eingeladen.
```

- [ ] **Step 4: Verify Tina build**

```bash
npx tinacms build --skip-cloud-checks
```

Expected: Build succeeds, new `event` collection recognized.

- [ ] **Step 5: Commit**

```bash
git add tina/config.ts content/events/ content/events-en/
git commit -m "feat: add event Tina collection with sample data"
```

---

### Task 2: Add i18n keys

**Files:**
- Modify: `src/i18n/de.json`
- Modify: `src/i18n/en.json`

- [ ] **Step 1: Add German event keys to de.json**

Add the following keys (find a logical place near existing keys):

```json
"homeEvents": "Veranstaltungen",
"calendarEvents": "Kommende Veranstaltungen",
"eventCategorySocial": "Gesellig",
"eventCategoryAssembly": "Versammlung",
"eventCategoryVolunteer": "Freiwillig",
"eventCategoryOther": "Sonstiges",
"noUpcomingEvents": "Keine kommenden Veranstaltungen"
```

- [ ] **Step 2: Add English event keys to en.json**

```json
"homeEvents": "Events",
"calendarEvents": "Upcoming Events",
"eventCategorySocial": "Social",
"eventCategoryAssembly": "Assembly",
"eventCategoryVolunteer": "Volunteer",
"eventCategoryOther": "Other",
"noUpcomingEvents": "No upcoming events"
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/de.json src/i18n/en.json
git commit -m "feat: add event i18n keys"
```

---

### Task 3: Extend DeepL translation for events

**Files:**
- Rename+Modify: `.github/scripts/translate-news.mjs` → `.github/scripts/translate-content.mjs`
- Modify: `.github/workflows/translate-news.yml`

- [ ] **Step 1: Rename the script**

```bash
git mv .github/scripts/translate-news.mjs .github/scripts/translate-content.mjs
```

- [ ] **Step 2: Rewrite translate-content.mjs**

Replace the full content of `.github/scripts/translate-content.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Translates German content (news + events) to English using DeepL Free API.
 * Zero dependencies — uses Node.js built-ins only.
 *
 * Usage: DEEPL_API_KEY=xxx node .github/scripts/translate-content.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';
const API_KEY = process.env.DEEPL_API_KEY;

if (!API_KEY) {
  console.error('ERROR: DEEPL_API_KEY environment variable is not set.');
  process.exit(1);
}

// ── Content types to translate ──

const CONTENT_TYPES = [
  {
    name: 'news',
    deDir: 'content/news',
    enDir: 'content/news-en',
    hashFields: (fm, body) => `${fm.title || ''}\n${fm.excerpt || ''}\n${body}`,
    translateFields: (fm, body) => [fm.title || '', fm.excerpt || '', body],
    buildEnFrontmatter: ([enTitle, enExcerpt, enBody], fm) => {
      const en = { title: enTitle, excerpt: enExcerpt, date: fm.date || '', category: fm.category || '' };
      if (fm.image) en.image = fm.image;
      return { frontmatter: en, body: enBody };
    },
  },
  {
    name: 'events',
    deDir: 'content/events',
    enDir: 'content/events-en',
    hashFields: (fm, body) => `${fm.title || ''}\n${body}`,
    translateFields: (fm, body) => [fm.title || '', body],
    buildEnFrontmatter: ([enTitle, enBody], fm) => {
      const en = { title: enTitle, date: fm.date || '', category: fm.category || '' };
      if (fm.endDate) en.endDate = fm.endDate;
      if (fm.time) en.time = fm.time;
      if (fm.location) en.location = fm.location;
      if (fm.image) en.image = fm.image;
      return { frontmatter: en, body: enBody };
    },
  },
];

// ── Frontmatter parsing ──

function parseMdx(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    frontmatter[key] = val;
  }
  return { frontmatter, body: match[2].trim() };
}

function yamlValue(v) {
  if (/[:#'"[\]{}|>&*!%@`]/.test(v) || v.trim() !== v) {
    return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return v;
}

function buildMdx(frontmatter, body) {
  const lines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${yamlValue(v)}`)
    .join('\n');
  return `---\n${lines}\n---\n\n${body}\n`;
}

// ── Hashing ──

function computeHash(input) {
  return createHash('md5').update(input).digest('hex').slice(0, 12);
}

function getExistingHash(enFilePath) {
  if (!existsSync(enFilePath)) return null;
  const parsed = parseMdx(readFileSync(enFilePath, 'utf-8'));
  return parsed?.frontmatter?.source_hash ?? null;
}

// ── DeepL API ──

async function translateTexts(texts) {
  const params = new URLSearchParams();
  for (const t of texts) {
    params.append('text', t || ' ');
  }
  params.append('source_lang', 'DE');
  params.append('target_lang', 'EN-GB');

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  };

  let response = await fetch(DEEPL_URL, fetchOptions);

  if (response.status === 429) {
    console.warn('Rate limited by DeepL, retrying in 5s...');
    await new Promise(r => setTimeout(r, 5000));
    response = await fetch(DEEPL_URL, fetchOptions);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DeepL API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.translations.map(t => t.text);
}

// ── Main ──

async function main() {
  let totalTranslated = 0;

  for (const ct of CONTENT_TYPES) {
    if (!existsSync(ct.deDir)) continue;

    const deFiles = readdirSync(ct.deDir).filter(f => f.endsWith('.mdx'));
    if (!deFiles.length) {
      console.log(`[${ct.name}] No files found.`);
      continue;
    }

    console.log(`\n── ${ct.name} ──`);

    for (const file of deFiles) {
      const dePath = join(ct.deDir, file);
      const enPath = join(ct.enDir, file);

      const content = readFileSync(dePath, 'utf-8');
      const parsed = parseMdx(content);

      if (!parsed) {
        console.warn(`Skipping ${file}: could not parse frontmatter.`);
        continue;
      }

      const { frontmatter, body } = parsed;

      // Skip files with manual_override flag
      if (existsSync(enPath)) {
        const enParsed = parseMdx(readFileSync(enPath, 'utf-8'));
        if (enParsed?.frontmatter?.manual_override === 'true') {
          console.log(`⊘ ${file} — manual override, skipping`);
          continue;
        }
      }

      const hashInput = ct.hashFields(frontmatter, body);
      const hash = computeHash(hashInput);
      const existingHash = getExistingHash(enPath);

      if (hash === existingHash) {
        console.log(`✓ ${file} — up to date`);
        continue;
      }

      console.log(`→ ${file} — translating...`);

      const textsToTranslate = ct.translateFields(frontmatter, body);
      const translated = await translateTexts(textsToTranslate);
      const { frontmatter: enFm, body: enBody } = ct.buildEnFrontmatter(translated, frontmatter);
      enFm.source_hash = hash;

      writeFileSync(enPath, buildMdx(enFm, enBody));
      console.log(`✓ ${file} — translated`);
      totalTranslated++;
    }
  }

  console.log(`\nDone. Translated ${totalTranslated} file(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Update the workflow**

Replace `.github/workflows/translate-news.yml` with:

```yaml
name: Translate Content (DE → EN)

on:
  push:
    branches: [master, dev]
    paths:
      - 'content/news/**'
      - 'content/events/**'

permissions:
  contents: write

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run translation script
        env:
          DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
        run: node .github/scripts/translate-content.mjs

      - name: Commit translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add content/news-en/ content/events-en/
          if git diff --staged --quiet; then
            echo "No translation changes to commit."
          else
            git commit -m "chore: translate content to English [skip ci]"
            git push
          fi
```

- [ ] **Step 4: Test locally**

```bash
node .github/scripts/translate-content.mjs 2>&1 | head -1
```

Expected: `ERROR: DEEPL_API_KEY environment variable is not set.`

- [ ] **Step 5: Test with API key**

```bash
DEEPL_API_KEY="9e79f3ef-10ce-42de-a368-3cd676b16ccd:fx" node .github/scripts/translate-content.mjs
```

Expected: Translates both the news article and the sample event.

- [ ] **Step 6: Verify output**

```bash
cat content/events-en/2026-04-gv.mdx
```

Expected: English title, body. German date, time, location, category copied as-is. `source_hash` present.

- [ ] **Step 7: Commit**

```bash
git add .github/scripts/ .github/workflows/ content/events-en/
git commit -m "feat: extend DeepL translation to events, rename to translate-content"
```

---

### Task 4: Add event styles to global.css

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add event CSS classes**

Append to `src/styles/global.css`:

```css
/* ── Events ── */

.event-card {
  border-left: 3px solid #22c55e;
}

.event-card .card-body {
  padding: var(--space-md);
}

.event-location {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.badge-green {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.cal-entry--event {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
  border-left: 2px solid #22c55e;
}

.cal-entry--event:hover {
  background: rgba(34, 197, 94, 0.25);
}

.cal-modal-row--event {
  border-left: 3px solid #22c55e;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: add event CSS styles"
```

---

### Task 5: Add events section to DE homepage

**Files:**
- Modify: `src/pages/de/index.astro`

- [ ] **Step 1: Add event data fetch in frontmatter**

After the news fetch block (line 18), add:

```javascript
let upcomingEvents = [];
try {
  const evRes = await client.queries.eventConnection({ first: 20 });
  const now = new Date();
  upcomingEvents = (evRes.data.eventConnection.edges ?? [])
    .map(e => e.node)
    .filter(e => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);
} catch (e) {
  console.warn('Failed to fetch events from Tina:', e.message);
}
```

- [ ] **Step 2: Add events HTML section**

After the closing `</section>` of the News section, add:

```astro
  <!-- Events -->
  {upcomingEvents.length > 0 && (
    <section class="section-alt" id="events">
      <div class="container">
        <SectionHeader title={t(locale, 'homeEvents')} />
        <div class="grid grid-3">
          {upcomingEvents.map(ev => (
            <article class="card event-card fade-in">
              <div class="card-body">
                <div class="flex items-center gap-sm mb-md">
                  <span class="news-date">{new Date(ev.date).toLocaleDateString('de-CH')}</span>
                  <span class="badge badge-green">
                    {ev.category === 'social' ? t(locale, 'eventCategorySocial')
                      : ev.category === 'assembly' ? t(locale, 'eventCategoryAssembly')
                      : ev.category === 'volunteer' ? t(locale, 'eventCategoryVolunteer')
                      : t(locale, 'eventCategoryOther')}
                  </span>
                </div>
                <h3>{ev.title}</h3>
                {ev.time && <p class="event-location">{ev.time}</p>}
                {ev.location && <p class="event-location">{ev.location}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )}
```

- [ ] **Step 3: Verify build**

```bash
npx tinacms build --skip-cloud-checks && npx astro build
```

Expected: Build succeeds. DE homepage includes the events section.

- [ ] **Step 4: Commit**

```bash
git add src/pages/de/index.astro
git commit -m "feat: add upcoming events section to DE homepage"
```

---

### Task 6: Add events section to EN homepage

**Files:**
- Modify: `src/pages/en/index.astro`

- [ ] **Step 1: Add event data loading in frontmatter**

After the EN news loading block, add:

```javascript
const EN_EVENTS_DIR = 'content/events-en';
const upcomingEvents = existsSync(EN_EVENTS_DIR)
  ? readdirSync(EN_EVENTS_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => {
      const content = readFileSync(join(EN_EVENTS_DIR, f), 'utf-8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return null;
      const fm = {};
      for (const line of match[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        fm[key] = val;
      }
      return fm;
    })
    .filter(f => f?.title && new Date(f.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3)
  : [];
```

Also add imports at the top of the frontmatter:

```javascript
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
```

(Note: `readdirSync`, `readFileSync`, `join` may already be imported for news — check and avoid duplicates.)

- [ ] **Step 2: Add events HTML section**

Same HTML as DE homepage but with `'en-CH'` date locale and English i18n keys. Insert after the News section closing `</section>`:

```astro
  <!-- Events -->
  {upcomingEvents.length > 0 && (
    <section class="section-alt" id="events">
      <div class="container">
        <SectionHeader title={t(locale, 'homeEvents')} />
        <div class="grid grid-3">
          {upcomingEvents.map(ev => (
            <article class="card event-card fade-in">
              <div class="card-body">
                <div class="flex items-center gap-sm mb-md">
                  <span class="news-date">{new Date(ev.date).toLocaleDateString('en-CH')}</span>
                  <span class="badge badge-green">
                    {ev.category === 'social' ? t(locale, 'eventCategorySocial')
                      : ev.category === 'assembly' ? t(locale, 'eventCategoryAssembly')
                      : ev.category === 'volunteer' ? t(locale, 'eventCategoryVolunteer')
                      : t(locale, 'eventCategoryOther')}
                  </span>
                </div>
                <h3>{ev.title}</h3>
                {ev.time && <p class="event-location">{ev.time}</p>}
                {ev.location && <p class="event-location">{ev.location}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )}
```

- [ ] **Step 3: Verify build**

```bash
npx tinacms build --skip-cloud-checks && npx astro build
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/en/index.astro
git commit -m "feat: add upcoming events section to EN homepage"
```

---

### Task 7: Add events to calendar page (DE + EN)

**Files:**
- Modify: `src/pages/de/weiteres/kalender.astro`
- Modify: `src/pages/en/weiteres/kalender.astro`

- [ ] **Step 1: Modify DE calendar page**

Add Tina event data fetch in the frontmatter:

```javascript
import client from '../../../../tina/__generated__/client';

let allEvents = [];
try {
  const evRes = await client.queries.eventConnection({ first: 100 });
  allEvents = (evRes.data.eventConnection.edges ?? [])
    .map(e => ({
      title: e.node.title,
      date: e.node.date,
      endDate: e.node.endDate || '',
      time: e.node.time || '',
      location: e.node.location || '',
      category: e.node.category || 'other',
    }));
} catch (e) {
  console.warn('Failed to fetch events from Tina:', e.message);
}

const now = new Date();
const upcomingEvents = allEvents
  .filter(e => new Date(e.date) >= now)
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
```

Add events JSON injection and upcoming events list inside the template. Before the `<script>` tags at the bottom, add:

```astro
  <!-- Events data for calendar grid -->
  <script id="events-data" type="application/json" set:html={JSON.stringify(allEvents)} />

  <!-- Upcoming Events List -->
  {upcomingEvents.length > 0 && (
    <section class="section-alt">
      <div class="container">
        <SectionHeader title={t(locale, 'calendarEvents')} />
        <div class="grid grid-3">
          {upcomingEvents.map(ev => (
            <article class="card event-card fade-in">
              <div class="card-body">
                <div class="flex items-center gap-sm mb-md">
                  <span class="news-date">{new Date(ev.date).toLocaleDateString('de-CH')}</span>
                  <span class="badge badge-green">
                    {ev.category === 'social' ? t(locale, 'eventCategorySocial')
                      : ev.category === 'assembly' ? t(locale, 'eventCategoryAssembly')
                      : ev.category === 'volunteer' ? t(locale, 'eventCategoryVolunteer')
                      : t(locale, 'eventCategoryOther')}
                  </span>
                </div>
                <h3>{ev.title}</h3>
                {ev.time && <p class="event-location">{ev.time}</p>}
                {ev.location && <p class="event-location">{ev.location}</p>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )}
```

Insert this between the calendar grid section and the iCal subscriptions section.

- [ ] **Step 2: Modify EN calendar page**

Same pattern but using fs-based reading for events from `content/events-en/`. Add frontmatter:

```javascript
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const EN_EVENTS_DIR = 'content/events-en';
let allEvents = [];
if (existsSync(EN_EVENTS_DIR)) {
  allEvents = readdirSync(EN_EVENTS_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => {
      const content = readFileSync(join(EN_EVENTS_DIR, f), 'utf-8');
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return null;
      const fm = {};
      for (const line of match[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        let val = line.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        fm[key] = val;
      }
      return fm;
    })
    .filter(Boolean);
}

const now = new Date();
const upcomingEvents = allEvents
  .filter(e => new Date(e.date) >= now)
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
```

Then add the same `<script id="events-data">` and events list HTML as DE but with `'en-CH'` locale.

- [ ] **Step 3: Verify build**

```bash
npx tinacms build --skip-cloud-checks && npx astro build
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/de/weiteres/kalender.astro src/pages/en/weiteres/kalender.astro
git commit -m "feat: inject events into calendar pages"
```

---

### Task 8: Extend calendar-grid.ts for events

**Files:**
- Modify: `src/islands/calendar-grid.ts`

- [ ] **Step 1: Add CalendarEvent interface and data loading**

After the `PBGame` interface (line 21), add:

```typescript
interface CalendarEvent {
  title: string
  date: string
  endDate?: string
  time?: string
  location?: string
  category: string
  body?: string
}
```

After `let activeTooltip: HTMLElement | null = null` (line 46), add:

```typescript
  // Load build-time events
  let calEvents: CalendarEvent[] = []
  const evDataEl = document.getElementById('events-data')
  if (evDataEl) {
    try {
      calEvents = JSON.parse(evDataEl.textContent || '[]')
    } catch { /* ignore */ }
  }
```

- [ ] **Step 2: Add eventChip function**

After the `gameChip` function (line 144), add:

```typescript
  function eventChip(ev: CalendarEvent): HTMLElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cal-entry cal-entry--event'

    if (ev.time) {
      btn.appendChild(el('span', 'cal-entry-time', ev.time))
    }

    btn.appendChild(el('span', 'cal-entry-title', ev.title))

    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      showEventTooltip(ev, btn)
    })

    return btn
  }
```

- [ ] **Step 3: Add showEventTooltip function**

After the `closeTooltip` function (line 212), add:

```typescript
  function showEventTooltip(ev: CalendarEvent, anchor: HTMLElement): void {
    closeTooltip()
    const tip = document.createElement('div')
    tip.className = 'cal-tooltip'

    const hdr = el('div', 'cal-tooltip-header')
    const catLabel = ev.category.charAt(0).toUpperCase() + ev.category.slice(1)
    hdr.appendChild(el('span', 'cal-tooltip-sport cal-tooltip-sport--event', catLabel))
    tip.appendChild(hdr)

    tip.appendChild(el('div', 'cal-tooltip-teams', ev.title))

    const dateObj = new Date(ev.date)
    const dateStr = dateObj.toLocaleDateString(lang === 'de' ? 'de-CH' : 'en-GB', {
      weekday: 'short', day: 'numeric', month: 'long',
    })
    const meta = el('div', 'cal-tooltip-meta')
    meta.appendChild(el('span', undefined, `${dateStr}${ev.time ? ', ' + ev.time : ''}`))
    tip.appendChild(meta)

    if (ev.location) {
      tip.appendChild(el('div', 'cal-tooltip-hall', ev.location))
    }

    document.body.appendChild(tip)
    activeTooltip = tip

    const rect = anchor.getBoundingClientRect()
    const tipRect = tip.getBoundingClientRect()
    let top = rect.bottom + 4
    let left = rect.left + rect.width / 2 - tipRect.width / 2
    if (left < 8) left = 8
    if (left + tipRect.width > window.innerWidth - 8) left = window.innerWidth - tipRect.width - 8
    if (top + tipRect.height > window.innerHeight - 8) top = rect.top - tipRect.height - 4
    tip.style.top = `${top + window.scrollY}px`
    tip.style.left = `${left + window.scrollX}px`

    setTimeout(() => {
      document.addEventListener('click', closeTooltip, { once: true })
    }, 0)
  }
```

- [ ] **Step 4: Integrate events into the render function**

In the `render` function, after the games grouping block (line 233), add events grouping:

```typescript
    // Group events by date key
    const eventsByDate = new Map<string, CalendarEvent[]>()
    for (const ev of calEvents) {
      const key = ev.date.slice(0, 10)
      if (!eventsByDate.has(key)) eventsByDate.set(key, [])
      eventsByDate.get(key)!.push(ev)
    }
```

In the day cell rendering (inside the `for (const date of days)` loop), modify the entries block.

Replace lines 326-349 (the `if (inMonth && dayGames.length > 0)` block) with:

```typescript
      const dayEvents = eventsByDate.get(key) || []
      const allEntries = dayGames.length + dayEvents.length

      if (inMonth && allEntries > 0) {
        const entriesDiv = el('div', 'cal-entries')
        const maxVisible = window.innerWidth < 640 ? 2 : 3
        let count = 0

        for (const g of dayGames) {
          if (count >= maxVisible) break
          entriesDiv.appendChild(gameChip(g))
          count++
        }

        for (const ev of dayEvents) {
          if (count >= maxVisible) break
          entriesDiv.appendChild(eventChip(ev))
          count++
        }

        const overflow = allEntries - maxVisible
        if (overflow > 0) {
          const more = document.createElement('button')
          more.type = 'button'
          more.className = 'cal-overflow'
          more.textContent = `+${overflow}`
          more.addEventListener('click', (e) => {
            e.stopPropagation()
            showDayModal(date, dayGames, dayEvents)
          })
          entriesDiv.appendChild(more)
        }

        cell.appendChild(entriesDiv)
      }
```

- [ ] **Step 5: Update showDayModal to handle events**

Change the `showDayModal` function signature from `(date: Date, dayGames: PBGame[])` to `(date: Date, dayGames: PBGame[], dayEvents: CalendarEvent[] = [])`.

After the games loop in `showDayModal` (after line 404), add event rows:

```typescript
    for (const ev of dayEvents) {
      const row = el('div', 'cal-modal-row cal-modal-row--event')

      const rowHdr = el('div', 'cal-modal-row-header')
      const catLabel = ev.category.charAt(0).toUpperCase() + ev.category.slice(1)
      rowHdr.appendChild(el('span', 'cal-tooltip-sport cal-tooltip-sport--event', catLabel))
      if (ev.time) rowHdr.appendChild(el('span', 'cal-modal-time', ev.time))
      row.appendChild(rowHdr)

      row.appendChild(el('div', 'cal-modal-teams', ev.title))

      if (ev.location) {
        row.appendChild(el('div', 'cal-modal-hall', ev.location))
      }

      modal.appendChild(row)
    }
```

- [ ] **Step 6: Add event sport badge CSS class**

In `src/styles/global.css`, add:

```css
.cal-tooltip-sport--event {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}
```

- [ ] **Step 7: Verify build**

```bash
npx tinacms build --skip-cloud-checks && npx astro build
```

- [ ] **Step 8: Commit**

```bash
git add src/islands/calendar-grid.ts src/styles/global.css
git commit -m "feat: render events in calendar grid with tooltip and modal"
```

---

### Task 9: Full build verification

- [ ] **Step 1: Run full build**

```bash
npx tinacms build --skip-cloud-checks && npx astro build
```

Expected: 65+ pages built successfully.

- [ ] **Step 2: Verify DE homepage has events section**

```bash
grep -o 'Veranstaltungen' dist/de/index.html | head -1
```

Expected: `Veranstaltungen`

- [ ] **Step 3: Verify EN homepage has events section**

```bash
grep -o 'Events' dist/en/index.html | head -3
```

- [ ] **Step 4: Verify calendar page has events JSON**

```bash
grep -o 'events-data' dist/de/weiteres/kalender/index.html | head -1
```

Expected: `events-data`

- [ ] **Step 5: Final commit of any remaining changes**

```bash
git status
```

If clean, proceed. Otherwise commit any remaining files.
