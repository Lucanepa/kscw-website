# Wire Tina CMS Collections to Astro Templates

**Date:** 2026-03-18
**Status:** Approved

## Goal

Connect Tina CMS collections to Astro page templates so non-technical editors can manage content via `/admin/`. Currently, Tina collections exist but templates ignore them and use hardcoded values. Additionally, add automatic DE→EN translation for news articles.

## Scope

### 1. Board Members (`vorstand.astro`)

**Current state:** DE template uses 8 hardcoded `<BoardCard>` components with i18n role keys. EN template has fully hardcoded inline HTML (no `BoardCard` component, own `<style>` block). Tina `boardMember` collection exists with 2 entries but is unused by templates.

**Target state:**
- Both DE and EN templates query Tina `boardMember` collection at build time
- EN template refactored to use `BoardCard` component (same as DE)
- Loop over entries sorted by `order` field
- Use `role_de` / `role_en` based on page locale
- Display `photo` if set (prop: `photoUrl`), fall back to initials
- Auto-generate initials from `name` if `initials` field is empty
- Remove all hardcoded board member data from templates

**Tina collection (existing, no schema changes):**
```
boardMember: name, initials, role_de, role_en, photo, order
```

**Content to create** (6 missing members, 2 exist):
| Name | Initials | role_de | role_en | Order |
|------|----------|---------|---------|-------|
| Michelle Howald | MH | Praesidentin | President | 1 |
| Anja Jimenez | AJ | Vize-Praesidentin | Vice President | 2 |
| Dario Kaufmann | DK | Kassier | Treasurer | 3 |
| Radomir Radovanovic | RR | Kassier | Treasurer | 4 |
| Roger Ruebsam | RR | Aktuar | Secretary | 5 |
| Anne Grimshaw | AG | Beisitzerin | Assessor | 6 |
| Rachel Moser | RM | TK Basketball | TC Basketball | 7 |
| Thamayanth Kanagalingam | TK | TK Volleyball | TC Volleyball | 8 |

**Cleanup:** Remove orphaned `boardRole*` i18n keys from `de.json`/`en.json` after migration.

### 2. Contact Page (`kontakt.astro`)

**Current state:** Sidebar has 4 hardcoded cards: General (club email, no person), Volleyball (1 person), Basketball (2 people), Social Media (links). Form section uses i18n (stays as-is). DE uses `BaseLayout` with manual header; EN uses `PageLayout`.

**Target state:**
- New Tina collection `contactPerson` for sport contact entries
- Sidebar cards for General, Volleyball, Basketball rendered from Tina data
- Multiple contacts with same `sport` value render in the same card (grouped)
- Social Media card stays hardcoded (links, not person data)
- General card: if no `contactPerson` with `sport: general`, show just club name + `kontakt@kscw.ch`
- Sport icons stay hardcoded per sport value (volleyball=globe icon blue, basketball=ball icon orange)
- Form structure unchanged (i18n-driven)

**New Tina collection:**
```
contactPerson:
  path: content/contact-persons
  format: md
  fields:
    - name (string, isTitle, required)
    - role_de (string)
    - role_en (string)
    - email (string, required)
    - sport (string, options: [general, volleyball, basketball], required)
    - order (number, required)
```

**Content to create:**
| Name | Email | Sport | Order |
|------|-------|-------|-------|
| Thamayanth Kanagalingam | volleyball@kscw.ch | volleyball | 1 |
| Anja Jimenez | anja.jimenez@kscw.ch | basketball | 1 |
| Rachel Moser | rachel.moser@kscw.ch | basketball | 2 |

### 3. News — Flatten Structure + Wire Templates + Auto-Translation (DE→EN)

**Current state:** Tina `news` collection has `content/news/de/` and `content/news/en/` subfolders with a `locale` field. No Astro template queries the Tina client. Tina admin shows confusing duplicate folder listings.

**Target state:**
- Flatten news to `content/news/` (no locale subfolders). Editors see articles directly, no folders.
- Remove `locale` field from news schema — all articles are written in German
- Astro news templates query Tina `newsConnection` at build time
- GitHub Action auto-translates DE articles to EN

**Migration steps:**
1. Move `content/news/de/*.mdx` → `content/news/*.mdx`
2. Delete `content/news/de/` and `content/news/en/` folders
3. Remove `locale` field from news collection in `tina/config.ts`
4. Update Astro templates to query flat collection

**Auto-translated EN files** live in `content/news-en/` — a separate directory NOT managed by Tina (editors don't see it). Astro reads it at build time for `/en/` pages.

**GitHub Action workflow:**
- Trigger: push to `master` with changes in `content/news/**`
- For each new/changed article, translate title, excerpt, body to English
- Commit EN file to `content/news-en/{same-filename}` with message "auto-translate: {filename}"
- This triggers a CF Pages rebuild with both languages
- If an editor wants to tweak a translation, they edit the file in `content/news-en/` via git (not Tina)

**Translation API:** DeepL Free API (500k chars/month, excellent DE→EN quality). GitHub secret: `DEEPL_API_KEY`.

### 4. Sponsors CTA (low priority)

Sponsor list stays in PocketBase. "Become a Sponsor" CTA uses i18n strings — works fine. Skip unless time permits.

## Infrastructure

- Merge `dev` into `master` and push (Tina Cloud reads `master`)
- Tina stays on v3.5.0 (v3.6.2 has broken posthog import in build)

## Out of Scope

- About Us page (stays as template code + i18n)
- Team pages, game data, rankings (PocketBase)
- Navigation structure, layouts
- i18n string management (except orphaned boardRole* cleanup)
- Sponsor list (PocketBase via Wiedisync)

## Technical Approach

### Querying Tina in Astro

Templates use the generated Tina client at build time. Import path from `src/pages/de/club/`:

```astro
---
import client from '../../../../tina/__generated__/client';

const boardRes = await client.queries.boardMemberConnection({ first: 50 });
const members = boardRes.data.boardMemberConnection.edges
  .map(e => e.node)
  .sort((a, b) => a.order - b.order);
---
```

### Error Handling

Wrap Tina queries in try/catch. If Tina Cloud is unreachable during build, render a placeholder rather than failing the build:

```astro
let members = [];
try {
  const res = await client.queries.boardMemberConnection({ first: 50 });
  members = res.data.boardMemberConnection.edges.map(e => e.node).sort((a, b) => a.order - b.order);
} catch (e) {
  console.warn('Failed to fetch board members from Tina:', e.message);
}
```

### Bilingual Content

- Board members: single entry per person, `role_de` / `role_en` selected by page locale
- Contact persons: same pattern
- News: separate DE/EN files; EN auto-generated by GitHub Action, editable if needed

### Contact Sidebar Rendering

```
for each sport in [general, volleyball, basketball]:
  filter contactPersons by sport, sort by order
  render card with sport-specific icon (hardcoded SVG map)
  if sport === general AND no persons: show club name + kontakt@kscw.ch
  else: render each person (name + email)
render Social Media card (hardcoded, not from Tina)
```

## Success Criteria

1. Board members on `/de/club/vorstand` and `/en/club/vorstand` render from Tina data
2. Contact sidebar on `/de/club/kontakt` and `/en/club/kontakt` renders from Tina data
3. News pages query Tina collection at build time
4. GitHub Action translates new DE news articles to EN automatically
5. Editors can add/edit/remove board members, contacts, and news via `/admin/`
6. Build passes with `npm run build` (including when Tina Cloud is unreachable)
7. Verify that Tina Cloud commits trigger CF Pages rebuilds
