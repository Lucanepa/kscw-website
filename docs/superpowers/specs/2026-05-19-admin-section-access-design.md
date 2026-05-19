# Admin section access control — design

**Date:** 2026-05-19
**Status:** Approved (brainstorming complete, ready for implementation plan)
**Repos:** `kscw-website` (frontend `admin.astro`) + `wiedisync` (Directus collection, `kscw-endpoints` extension, role permissions)

## Problem

`/admin` exposes six sections (`news`, `events`, `registrations`, `sponsors`, `scorer_courses`, `mixed_turnier`) to every website admin. We need superusers to grant/revoke section visibility **per individual admin**, with **real backend-enforced access control** — not a UI hide. Default for an ungranted admin = **no sections**.

## Decisions (locked during brainstorming)

- Security model: **real access control** (server-enforced, verifiable), not UI-only.
- Granularity: **per individual admin**.
- Role boundary: Directus role `superuser` is the manager and is never gated.
- Default access: **no sections** until explicitly granted (opt-in).
- Approach: **A — gated endpoint + config collection** (mirrors the existing `/kscw/opnform/…` pattern in `kscw-endpoints`).

## Architecture

The enforcement boundary lives in **Directus** (`wiedisync`), because `admin.astro` is a client-side island and any client check is cosmetic. Four components:

1. **`website_admin_access`** — new Directus collection.
2. **`/kscw/wadmin` endpoint extension** — new, in `kscw-endpoints`.
3. **Directus role lockdown** — gated roles lose direct CRUD on section collections.
4. **`admin.astro` changes** — thin fetch-wrapper + `/me`-driven tabs + superuser Admin tab.

### Section → backend-resource contract

This table is the authorization contract the endpoint enforces (scope-check, Part: lifecycle step 3):

| Section | Allowed Directus resources |
|---|---|
| `news` | `items/news*`, `files` |
| `events` | `items/events*`, `files` |
| `registrations` | `items/registrations*`, `files` |
| `sponsors` | `items/sponsors*`, `files` |
| `scorer_courses` | `items/scorer_courses*`, `/kscw/opnform/forms/*` |
| `mixed_turnier` | `items/mixed_tournament_signups*`, `items/participations*`, `items/members*` |
| **always-open (not proxied)** | `users/me`, `items/teams` (read) — called directly against Directus |

### `website_admin_access` collection

| Field | Type | Notes |
|---|---|---|
| `id` | pk | |
| `user` | o2o → `directus_users`, **unique** | the gated admin |
| `sections` | JSON | array of section keys, e.g. `["news","events"]` |
| `date_created` / `date_updated` | timestamp | standard audit fields |

Direct read/write permitted **only** to role `superuser`. The endpoint reads/writes it with the service token, not the caller's token.

## Request lifecycle

### `GET /kscw/wadmin/me`

1. Validate caller token → user id + role name. Invalid/expired → **401** (frontend's existing login redirect handles it).
2. `superuser` → `{ isSuperuser: true, sections: <all 6> }`.
3. Else read `website_admin_access` where `user = id` → `{ isSuperuser: false, sections: row?.sections ?? [] }`. No row → `[]`.

### `ANY /kscw/wadmin/<section>/<directus-subpath>`

Example: `GET /kscw/wadmin/news/items/news?filter…`

1. Auth caller (token → id + role).
2. **Section authorization:** `superuser`, or `<section>` ∈ caller's `sections`. Else **403** `{error:'section_not_granted', section}`.
3. **Scope-check:** the `<directus-subpath>` must fall within that section's allowed-resource set (contract table). Else **403** `{error:'resource_out_of_scope'}`. This is the real teeth — it stops a `news`-granted admin tunnelling to `items/sponsors` via their own grant.
4. Proxy verbatim (method, query, body) to Directus using the **service token** held in the `kscw-endpoints` extension env. Return upstream status + body unchanged.

### Superuser-only management routes

- `GET /kscw/wadmin/admins` → `[{ id, name, email, sections[] }]` — `directus_users` in gated roles (`website_admin`/`admin`/`administrator`) joined to `website_admin_access`. Superuser token required, else **403**.
- `PUT /kscw/wadmin/admins/<id>` body `{ sections:[…] }` → upsert that user's `website_admin_access` row. Superuser token required.

## Error handling

| Condition | Response |
|---|---|
| Invalid/expired token | **401** |
| Valid token, section not granted | **403** `section_not_granted` |
| Subpath outside section contract | **403** `resource_out_of_scope` |
| Non-superuser hits management routes | **403** |
| `website_admin_access` unreachable / ambiguous role / missing row | **fail closed** — zero sections, never fail open |
| Directus upstream error | pass through status + body |

**Fail-closed principle:** any ambiguity = deny.

### Accepted boundary (YAGNI)

`files` is shared across the four file-capable sections. File **uploads** (`POST /files`) are gated by the calling section. File **deletes** (`DELETE /files/<id>`) are coarse — any file-capable section can delete any file id, because Directus files carry no section tag and the admin UI effectively only uploads. Per-file ownership tracking is explicitly out of scope.

## Frontend changes (`admin.astro`)

Three deliberately thin changes:

1. **`wadmin()` helper:** `wadmin(section, subpath, opts) → fetch(\`${base}/kscw/wadmin/${section}/${subpath}\`, opts)`, same user-token `Authorization` header as today. Mechanically swap each section's existing `fetch(base+'/items/<c>'…)` / `'/files'` / `'/kscw/opnform/…'` calls to route through `wadmin('<section>', …)`. `/users/me` and `items/teams` stay as direct Directus calls.
2. **`/me`-driven tabs:** call `GET /kscw/wadmin/me` on load; build the tab bar from returned `sections` instead of the hardcoded list. `currentTab` defaults to the first granted section in the canonical order (`news`, `events`, `registrations`, `sponsors`, `scorer_courses`, `mixed_turnier`), not the literal `'news'`. `!isSuperuser && sections.length === 0` → render empty state *"No sections assigned — ask a superuser to grant access,"* no tabs, no content.
3. **Superuser-only "Admin" tab:** appears only when `/me` returns `isSuperuser:true`. A grid: one row per gated admin (`id · name · email`), one checkbox column per section. Toggling a checkbox → debounced `PUT /kscw/wadmin/admins/<id>` with a small saved/error indicator. No bulk-apply, no per-section descriptions.

## Rollout sequence

The scorer-course feature is in **live UAT**; ordering must never lock out a working admin.

### Phase A — backend, additive, no enforcement
1. Create `website_admin_access` (prod + dev); direct R/W restricted to `superuser`. *(Directus admin operation — run by the user via Directus UI/admin API, not agent prod SSH.)*
2. Deploy the `/kscw/wadmin` extension to wiedisync prod via the existing extension-deploy path. Nothing depends on it yet; old direct `/items/*` still works → zero user impact.
3. **Seed rows granting every current website admin all 6 sections** (incl. whoever runs scorer UAT). The "default = nothing" rule governs *new/ungranted* users only; existing admins must not lose access when enforcement flips.

### Phase B — frontend cutover, no lockdown yet
4. Ship `admin.astro` (wrapper + `/me` tabs + Admin tab). Page now routes through wadmin, but direct Directus still works → safe, instantly revertible.
5. Superuser smoke-test: Admin tab loads; toggling a test admin changes their visible tabs.

### Phase C — flip the real boundary (only risky step, instantly reversible)
6. Lock down Directus role perms: `website_admin`/`admin`/`administrator` lose direct CRUD on the 6 collections + `files`; `superuser` keeps it.
7. **Acceptance test (proves hiding ≠ UI-only):** non-superuser admin token → direct `GET /items/scorer_courses` = **403**; same user via `/kscw/wadmin/scorer_courses/…` with grant = **200**; revoke grant = **403**.

### Rollback
Phase C is a single Directus permission change — re-grant role perms to fully revert. Phases A/B are purely additive (drop the collection / revert the frontend commit).

## Testing

- **Endpoint auth matrix:** no token → 401; ungranted section → 403; out-of-scope subpath → 403; superuser → all sections; granted admin → that section only.
- **Boundary proof (acceptance):** post-Phase-C, a non-superuser admin token cannot read `items/scorer_courses` directly.
- **Management routes:** non-superuser → 403; superuser `PUT` round-trips and is reflected by `/me` and `GET /admins`.
- **Frontend:** zero-section user sees empty state; tab list matches grant; Admin-tab toggle persists and re-renders.

## Completion

Per project convention (`CLAUDE.md`): this is a **minor** version bump (new feature). On completion add a CHANGELOG.md entry, bump `package.json`, and update the changelog sections on both `/de/club/feedback` and `/en/club/feedback`.

## Out of scope

- Per-file ownership/section tagging.
- Bulk grant/revoke UI, audit log of grant changes, per-section human-readable descriptions.
- Any non-`superuser` path to the management routes.
