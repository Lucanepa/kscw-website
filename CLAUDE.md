# KSCW Website

Astro static site for KSC Wiedikon volleyball club. PocketBase API backend, Cloudflare Pages hosting.

## Commands
```bash
npm run dev          # local dev server
npx astro build      # production build → dist/
```

## Conventions

| Rule | Detail |
|------|--------|
| CSS | Custom design system in `src/styles/global.css` — **never rewrite to Tailwind** |
| i18n | Directory routing `/de/…` `/en/…`, Astro `t()` helper at build time |
| Team data | Client-side fetch from PB API (not build-time) |
| News/events | Build-time fetch in frontmatter + runtime via `data.js` |
| Board/contacts | Static JSON in `src/data/` |
| Islands | `src/islands/` for interactivity (nav, theme, animations) |
| Output | `output: 'static'` — no SSR |

## Admin Page
- `/admin` — hidden link in footer copyright text
- Auth: PocketBase `members` collection, roles: `website_admin` / `admin` / `superuser`
- Vanilla JS island, PocketBase SDK + Quill + DOMPurify via CDN

## Deployment
CF Pages project: `kscw-website` — pushes to `master` trigger deploy.

## Related
- **Wiedisync** (main KSCW platform): `github.com/Lucanepa/kscw`
- **PocketBase API**: `api.kscw.ch`
- **Session log**: `docs/sessions.md` (gitignored)
