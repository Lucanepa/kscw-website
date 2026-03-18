# Tina CMS Events — Design Spec

## Overview

Add a Tina CMS `event` collection for club events (social gatherings, assemblies, volunteer days) that are not games or trainings. Events display on the homepage and calendar page, and get auto-translated to English via the existing DeepL pipeline.

Event detail/permalink pages are out of scope — events are lightweight content shown inline on homepage and calendar.

## Tina Collection

**Name:** `event`
**Path:** `content/events/`
**Format:** MDX

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | Yes | `isTitle: true` — used in Tina admin listing |
| `date` | datetime | Yes | Start date |
| `endDate` | datetime | No | End date (for multi-day events) |
| `time` | string | No | Start time, e.g. "18:00" |
| `location` | string | No | Venue name or address |
| `category` | string (enum) | Yes | `social` / `assembly` / `volunteer` / `other` |
| `image` | image | No | Featured image |
| `body` | rich-text | No | `isBody: true` — event description below frontmatter (prose only, no JSX) |

### Example File

```mdx
---
title: Generalversammlung 2026
date: 2026-04-15T00:00:00.000Z
time: "19:00"
location: Turnhalle Sihlfeld
category: assembly
---

Die jährliche Generalversammlung des KSC Wiedikon findet statt.
```

## DeepL Translation

Rename `.github/scripts/translate-news.mjs` → `translate-content.mjs` and extend to handle both news and events. Rename workflow to "Translate Content (DE → EN)".

### News translation (unchanged)
- Scan `content/news/*.mdx` → `content/news-en/*.mdx`
- Hash: `md5(title + excerpt + body)`
- Translate: title, excerpt, body

### Events translation (new)
- Scan `content/events/*.mdx` → `content/events-en/*.mdx`
- Hash: `md5(title + body)` — no excerpt field
- Translate: title, body
- Copy as-is: date, endDate, time, location, category, image
- Same `source_hash` and `manual_override` support

### Workflow changes
- Path filter extended: `content/news/**` AND `content/events/**`
- Commit step: `git add content/news-en/ content/events-en/`

## Homepage — "Upcoming Events" Section

**Position:** Between News and Upcoming Games sections (both DE and EN pages).

**Data source:**
- DE: Tina GraphQL client at build time (`client.queries.eventConnection({ first: 20 })`) — fetch more than needed, filter client-side by date
- EN: `fs.readdirSync('content/events-en/')` with frontmatter parsing (same pattern as EN news)

**Display:**
- Filter: only events where `date >= build date`
- Sort: ascending by date (soonest first)
- Limit: 3 events
- Card layout adapted from news card style — shows date, category badge, title, location (no excerpt since events have no excerpt field)
- Section header uses i18n keys: `homeEvents` (DE: "Veranstaltungen", EN: "Events")

## Calendar Page — Events in Grid

**Data injection:** Astro renders all events as a JSON array in a `<script id="events-data" type="application/json">` tag on the calendar page at build time.

### Events JSON shape

```typescript
interface CalendarEvent {
  title: string;
  date: string;       // ISO date
  endDate?: string;    // ISO date
  time?: string;       // e.g. "19:00"
  location?: string;
  category: string;
  body?: string;       // plain text description (stripped from MDX)
}
```

DE page: events from Tina GraphQL. EN page: events from `content/events-en/` via fs.

**Note:** Events on the calendar are build-time snapshots. Games are fetched live from PocketBase. New events won't appear until the next site build/deploy.

### Calendar grid integration

Extend `src/islands/calendar-grid.ts` to:
1. Parse events JSON from `#events-data` on page load
2. Render event chips in day cells alongside game chips
3. Event chips use distinct color (green, `#22c55e`) and a calendar icon (Lucide `calendar-days`)
4. New `showEventTooltip(event, anchor)` function (separate from game tooltip — different data shape)
5. Events included in existing `showDayModal` overflow — rendered as event items alongside game items
6. Events respect existing chip limit per day and "+N" overflow logic

### Events list below grid

Static Astro HTML section below the calendar grid:
- Section header: `calendarEvents` i18n key
- Shows all upcoming events (date >= build date) as cards, no limit
- Same card format as homepage events section

## Styling

Add to `src/styles/global.css`:
- `.event-chip` — green chip style for calendar grid (`background: #22c55e`)
- `.event-card` — card style for homepage/calendar event lists (adapted from `.news-card`)
- `.event-tooltip` — tooltip/modal styles for event detail popup
- `.badge-green` — green badge for event category (alongside existing `badge-blue`, `badge-orange`)
- Category-specific badge colors if desired (or single green for all event categories)

## Content Structure

```
content/
  events/                    # German events (Tina-managed)
    2026-04-gv.mdx
  events-en/                 # English translations (auto-generated)
    .gitkeep
    2026-04-gv.mdx
```

## i18n Keys

Add to `src/i18n/de.json` and `src/i18n/en.json`:

| Key | DE | EN |
|-----|----|----|
| `homeEvents` | Veranstaltungen | Events |
| `calendarEvents` | Kommende Veranstaltungen | Upcoming Events |
| `eventCategorySocial` | Gesellig | Social |
| `eventCategoryAssembly` | Versammlung | Assembly |
| `eventCategoryVolunteer` | Freiwillig | Volunteer |
| `eventCategoryOther` | Sonstiges | Other |
| `noUpcomingEvents` | Keine kommenden Veranstaltungen | No upcoming events |

## Files to Create/Modify

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `tina/config.ts` | Add `event` collection |
| Create | `content/events/` | German events directory |
| Create | `content/events-en/.gitkeep` | English events directory |
| Rename+Modify | `.github/scripts/translate-news.mjs` → `translate-content.mjs` | Extend to translate events |
| Modify | `.github/workflows/translate-news.yml` | Rename, add events path trigger + git add |
| Modify | `src/pages/de/index.astro` | Add upcoming events section |
| Modify | `src/pages/en/index.astro` | Add upcoming events section |
| Modify | `src/pages/de/weiteres/kalender.astro` | Inject events JSON + events list |
| Modify | `src/pages/en/weiteres/kalender.astro` | Inject events JSON + events list |
| Modify | `src/islands/calendar-grid.ts` | Render event chips + event tooltip |
| Modify | `src/styles/global.css` | Event chip, card, tooltip, badge styles |
| Modify | `src/i18n/de.json` | Add event i18n keys |
| Modify | `src/i18n/en.json` | Add event i18n keys |

## Edge Cases

- **No events:** Sections show "No upcoming events" message via i18n
- **Past events:** Filtered out at build time on homepage/calendar list; visible in calendar grid for their historical date
- **Multi-day events:** Show on start date only in calendar grid (endDate shown in tooltip)
- **Event without time:** Display date only, omit time in card/tooltip
- **Event without body:** Tooltip shows title, date, location only
- **Build-time vs runtime:** Events are static (build-time). Games are dynamic (PocketBase). Events update on next deploy.
