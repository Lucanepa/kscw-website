# KSCW Website

Public website for **KSC Wiedikon** — a volleyball and basketball club based in Zurich, Switzerland.

**Live:** [kscw.ch](https://kscw.ch)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Astro 6](https://astro.build) (static output) |
| Styling | Custom CSS design system (no Tailwind) |
| Backend | [PocketBase](https://pocketbase.io) API (`api.kscw.ch`) |
| Hosting | Cloudflare Pages |
| i18n | Directory routing (`/de/…`, `/en/…`) with build-time `t()` helper |

## Features

- **Bilingual** — Full German and English versions
- **Dynamic team pages** — Live game data, rankings, rosters, and training schedules fetched from PocketBase
- **Calendar** — Event grid with tooltips and detail modals
- **Admin dashboard** — Hidden `/admin` page with Quill rich-text editor for managing news and events
- **Feedback form** — Bug reports, feature requests, and general feedback with Cloudflare Turnstile CAPTCHA and file upload
- **Dark mode** — System-aware theme toggle
- **Interactive islands** — Lightweight client-side interactivity without a JS framework

## Project Structure

```
src/
  pages/          # Astro routes (/de/…, /en/…, /admin)
  components/     # Reusable Astro components
  layouts/        # BaseLayout, PageLayout
  islands/        # Client-side interactivity (theme, nav, calendar, etc.)
  data/           # Static JSON/TS (teams, board, contacts)
  lib/            # Utilities (PocketBase client, i18n helper)
  i18n/           # Translation files (de.json, en.json)
  styles/         # Custom CSS design system (global.css)
public/           # Static assets (images, favicons)
```

## Getting Started

```bash
npm install
npm run dev       # Dev server at localhost:4321
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

## Deployment

Pushes to the `prod` branch trigger automatic deployment via Cloudflare Pages.

## Related

- [Wiedisync](https://github.com/Lucanepa/wiedisync) — Member-facing club platform (React + PocketBase)
