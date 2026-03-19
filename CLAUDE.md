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

## Changelog & Versioning

- **CHANGELOG.md** at repo root — update with every meaningful change
- **Changelog on site** — displayed on `/de/club/feedback` and `/en/club/feedback` pages (both DE and EN versions)
- **Version** in `package.json` — bump with each changelog entry (semver: patch for fixes, minor for features, major for breaking changes)
- **At end of every session**: Ask the user "Should this commit be added to the changelog and version bumped?" before finishing. If yes, update CHANGELOG.md, the feedback page changelog sections (both DE and EN), and bump `package.json` version.

## Related
- **Wiedisync** (main KSCW platform): `github.com/Lucanepa/kscw`
- **PocketBase API**: `api.kscw.ch`
- **Session log**: `docs/sessions.md` (gitignored)
