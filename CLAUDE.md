# KSCW Website

Public club website for KSC Wiedikon — Astro + Tina CMS.

## Tech Stack
- **Framework**: Astro (static site generation)
- **CMS**: Tina CMS (visual content editing, git-backed)
- **Styling**: Custom CSS design system (src/styles/global.css) — no Tailwind
- **Icons**: Lucide (CDN)
- **Data**: PocketBase API (kscw-api.lucanepa.com) for dynamic team/game/sponsor data
- **Hosting**: Cloudflare Pages (project: kscw-website)
- **Language**: German UI default, English supported via /de/ and /en/ directory routing

## Key Patterns
- **CSS kept verbatim** from original website_draft/ — do not rewrite to Tailwind
- **Team data is client-side**: Rosters, games, rankings fetched from PB API at runtime (not build-time)
- **Sponsors stay in PocketBase**: Managed via Wiedisync admin, not Tina
- **i18n via directory routing**: /de/... and /en/... — Astro's t() helper at build time
- **Island scripts** in src/islands/ handle interactivity (nav, theme, animations)
- **Static generation only**: output: 'static', no SSR needed

## Tina CMS Collections
- **page**: Static page content (MDX) — about, membership, calendar, etc.
- **news**: News articles (MDX) — title, excerpt, date, category, body
- **boardMember**: Board members (MD) — name, role (DE/EN), photo, sort order

## Deployment
- Build: `npx tinacms build && npx astro build`
- Output: dist/
- CF Pages project: kscw-website
- Tina Cloud auto-commits content changes → triggers rebuild

## Related
- **Wiedisync** (main KSCW app): github.com/Lucanepa/kscw
- **PocketBase API**: kscw-api.lucanepa.com
