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
3. **`Website Admin` role + `KSCW Website Admin` policy** — *Phase C only, separately green-lit.* A new non-`admin_access` role/policy in `setup-permissions.mjs` with **no** direct perms on the six collections + `directus_files` (so `/kscw/wadmin` is its only data path) but `app_access:true` (can still log into the Directus-auth'd admin page). Named users are migrated onto it. Today's admins are all on `admin_access=true` roles (`Superuser`/`Administrator`) that bypass every permission — no policy lockdown can gate them; only moving them off `admin_access` can.
4. **`admin.astro` changes** — thin fetch-wrapper + `/me`-driven tabs + manager-only Admin tab.

**Mechanism (codebase-fit, decided at planning):** the endpoint does **not** HTTP-proxy Directus and uses **no extra env secret**. It reaches data the way every other `kscw-endpoints` route does — `new ItemsService(collection, { schema, knex: database, accountability: { admin: true } })` (and `FilesService`/`UsersService` likewise). The caller's token is used only to *identify* the caller (id + role); it never grants the data access. Role name is resolved server-side via the `directus_users → directus_roles` join already used in `bugfixes.js` (`.join('directus_roles', 'directus_users.role', 'directus_roles.id').select('directus_roles.name')`), not from `req.accountability` (which carries no role name). Same security guarantee as a service-token proxy; idiomatic and smaller attack surface.

### Section → backend-resource contract

This table is the authorization contract the endpoint enforces (scope-check, Part: lifecycle step 3):

| Section | Allowed Directus resources |
|---|---|
| `news` | `items/news*` |
| `events` | `items/events*` |
| `registrations` | `items/registrations*` |
| `sponsors` | `items/sponsors*` |
| `scorer_courses` | `items/scorer_courses*`, `/kscw/opnform/forms/*` |
| `mixed_turnier` | `items/mixed_tournament_signups*`, `items/participations*`, `items/members*` |
| **direct to Directus (not wadmin)** | `users/me`, `items/teams` (read), `/files` (upload/asset) |

**`/files` decision (planning):** file upload stays a **direct** `POST /files` from `admin.astro` to Directus — the established codebase pattern (frontend → Directus `/files`, then pass the returned id; cf. `registration.js`). The extension has **no** multipart-streaming precedent; building one would be speculative, precedent-less code for a manager-only operation while Phase C is deferred. Enforcement for files is therefore not endpoint-mediated; instead the Phase-C `KSCW Website Admin` policy is granted a **narrow `directus_files: create + read`** (no other collection access) so gated admins can still upload. File *deletes* remain the accepted-coarse YAGNI below.

### `website_admin_access` — internal config table (NOT a Directus collection)

Decided at planning: this is a plain Postgres table created by a numbered SQL migration (`directus/scripts/063-website-admin-access.sql`, applied via `npm run db:migrate:*`), **not registered in Directus** (`directus_collections`/`directus_fields`). Consequence: there is **no `/items/website_admin_access` REST surface at all** — it is unreachable except through `/kscw/wadmin`. That is strictly stronger than role-permission lockdown on a Directus collection, and matches the raw-knex config-table pattern already used in `kscw-endpoints` (e.g. `bugfixes.js`).

| Column | Type | Notes |
|---|---|---|
| `id` | `serial PRIMARY KEY` | |
| `user` | `uuid NOT NULL UNIQUE REFERENCES directus_users(id) ON DELETE CASCADE` | the gated admin |
| `sections` | `jsonb NOT NULL DEFAULT '[]'` | array of section keys, e.g. `["news","events"]` |
| `date_created` | `timestamptz NOT NULL DEFAULT now()` | |
| `date_updated` | `timestamptz NOT NULL DEFAULT now()` | |

The endpoint reads/writes it via raw knex (`database('website_admin_access')…`), with admin-accountability `ItemsService` reserved for the six **content** collections (which are real Directus collections needing Directus query semantics).

## Request lifecycle

### `GET /kscw/wadmin/me`

1. Resolve caller from `req.accountability.user` (no user → **401**). Look up role name via the `directus_users → directus_roles` join. Unknown user/role → fail closed.
2. **Manager** — role name ∈ `{Superuser, Administrator}` (the only `admin_access=true` roles; case-insensitive compare) → `{ isSuperuser: true, sections: <all 6> }`. These are never gated and are the only roles that see the management grid.
3. **Gated admin** — role name `Website Admin` (the non-`admin_access` role introduced in Phase C; until then no users hold it) → read `website_admin_access` where `user = id` via raw knex → `{ isSuperuser: false, sections: row?.sections ?? [] }`. No row → `[]`.
4. Any other role → not a website admin → `{ isSuperuser: false, sections: [] }` (frontend renders nothing).

### Per-section data routes

Concrete REST-shaped routes (not arbitrary subpath proxy). `:collection` is validated against the section's allowed set before any data access:

- `GET    /kscw/wadmin/:section/items/:collection`        → `ItemsService.readByQuery(query)`
- `GET    /kscw/wadmin/:section/items/:collection/:id`    → `ItemsService.readOne(id, query)`
- `POST   /kscw/wadmin/:section/items/:collection`        → `ItemsService.createOne(body)`
- `PATCH  /kscw/wadmin/:section/items/:collection/:id`    → `ItemsService.updateOne(id, body)`
- `DELETE /kscw/wadmin/:section/items/:collection/:id`    → `ItemsService.deleteOne(id)`
- `* /kscw/wadmin/scorer_courses/opnform/forms/:slug/...` → delegate to the existing opnform handlers, section-gated

(`/files` is **not** a wadmin route — see the `/files` decision above.)

Per request:

1. Auth caller (`req.accountability.user` → id; role-name join → role).
2. **Section authorization:** manager (step-2 roles), or `:section` ∈ caller's `sections`. Else **403** `{error:'section_not_granted', section}`.
3. **Scope-check:** `:collection` (or `files`/`opnform`) must be in that section's allowed set (contract table). Else **403** `{error:'resource_out_of_scope'}`. This is the real teeth — it stops a `news`-granted admin reaching `sponsors` via their own grant.
4. Perform the op through the admin-accountability service. The Directus REST query string (`filter`/`fields`/`sort`/`limit`/`deep`) is parsed into the `ItemsService` query object via Directus's query sanitizer; method/body pass through. Return the service result (or its sanitized error) as JSON.

### Manager-only management routes

"Manager" = role ∈ `{Superuser, Administrator}` (step-2 of `/me`). Non-manager → **403**.

- `GET /kscw/wadmin/admins` → `[{ id, name, email, sections[] }]` — `directus_users` whose role (resolved via the `directus_roles` join) is `Website Admin`, left-joined (raw knex) to `website_admin_access`. Before Phase C this list is empty (no user holds that role yet); the grid still renders, just with no rows.
- `PATCH /kscw/wadmin/admins/:id` body `{ sections:[…] }` → upsert that user's `website_admin_access` row via raw knex (`ON CONFLICT (user) DO UPDATE`). Non-manager → **403**. (PATCH not PUT — Directus's default `CORS_METHODS` is `GET,POST,PATCH,DELETE`; PUT preflight is rejected cross-origin.)

## Error handling

| Condition | Response |
|---|---|
| Invalid/expired token | **401** |
| Valid token, section not granted | **403** `section_not_granted` |
| Subpath outside section contract | **403** `resource_out_of_scope` |
| Non-superuser hits management routes | **403** |
| `website_admin_access` unreachable / ambiguous role / missing row | **fail closed** — zero sections, never fail open |
| `ItemsService` throws | log via the endpoint logger; respond **500** `{error:'internal'}` (no Directus internals leaked); Directus `ForbiddenError`/`InvalidPayloadError` mapped to **403**/**400** |

**Fail-closed principle:** any ambiguity = deny.

### Accepted boundary (YAGNI)

`/files` is not endpoint-mediated (see the `/files` decision). Under Phase C the gated `KSCW Website Admin` policy gets a flat `directus_files: create + read` — any gated admin can therefore read/replace any file id (Directus files carry no section tag, and the admin UI effectively only uploads). Per-file ownership tracking and section-scoped file access are explicitly out of scope.

## Frontend changes (`admin.astro`)

Three deliberately thin changes:

1. **`wadmin()` helper:** `wadmin(section, subpath, opts) → fetch(\`${DIRECTUS_URL}/kscw/wadmin/${section}/${subpath}\`, opts)`, same `Authorization: Bearer <getValidToken()>` header as today. Mechanically swap each section's existing `fetch(DIRECTUS_URL+'/items/<c>'…)` and `'/kscw/opnform/…'` calls to route through `wadmin('<section>', …)`. `/users/me`, `items/teams`, **and `/files` upload** stay as direct Directus calls (per the `/files` decision).
2. **`/me`-driven tabs:** call `GET /kscw/wadmin/me` on load; build the tab bar from returned `sections` instead of the hardcoded six (`admin.astro:641-646`). `currentTab` defaults to the first granted section in the canonical order (`news`, `events`, `registrations`, `sponsors`, `scorer_courses`, `mixed_turnier`), not the literal `'news'` (`admin.astro:38`). `!isSuperuser && sections.length === 0` → render empty state *"No sections assigned — ask a superuser to grant access,"* no tabs, no content.
3. **Manager-only "Admin" tab:** appears only when `/me` returns `isSuperuser:true`. A grid: one row per `Website Admin` user (`name · email`), one checkbox column per section. Toggling a checkbox → debounced `PATCH /kscw/wadmin/admins/<id>` with a small saved/error indicator. Before Phase C the grid has no rows (no user holds the role). No bulk-apply, no per-section descriptions.

## Rollout sequence

The scorer-course feature is in **live UAT**; ordering must never lock out a working admin. **Decided at planning ("phase it"):** ship the full machinery (A + B) now with no user-identity change; the risky role migration (C) is a separate, explicitly green-lit step. A + B already deliver *real* endpoint enforcement for any non-`admin_access` caller and full UI gating; C extends that hard guarantee to today's admins. The guarantee is deferred, not dropped.

### Phase A — backend, additive (this plan)
1. `directus/scripts/063-website-admin-access.sql` creating the internal table; apply via `npm run db:migrate:dev` then `:prod` *(user-run `[CLI]`; the `db:*` scripts SSH the Hetzner DB container — not agent-run)*.
2. New `wadmin.js` endpoint + registration in `index.js` + vitest suite. Deploy via `npm run ext:deploy:dev` then `:prod` *(user-run `[CLI]`)*. Nothing depends on it yet; direct `/items/*` still works → zero user impact.
3. No seeding required — no users hold the gated role yet; managers (`Superuser`/`Administrator`) keep full access automatically (step-2 of `/me`).

### Phase B — frontend cutover (this plan)
4. Ship `admin.astro` (wrapper + `/me` tabs + manager-only Admin grid). Today's admins are all managers → they see everything + the grid; zero functional change for them, instantly revertible.
5. **End-to-end enforcement proof without touching real users:** create one throwaway test user on a non-`admin_access` role, exercise `/kscw/wadmin` (ungranted → 403, grant a section via the grid → 200, revoke → 403), then delete the test user. Proves the boundary is real before any real migration.

### Phase C — role migration (SEPARATE; needs explicit green-light + the "who" list)
6. Add `Website Admin` role + `KSCW Website Admin` policy to `setup-permissions.mjs`: `admin_access:false`, `app_access:true`, **no** perms on the 6 content collections, plus a single flat `directus_files: create + read` (so direct uploads from `admin.astro` keep working). Apply via `npm run db:setup-perms:dev`/`:prod` *(user-run `[CLI]`)*.
7. User supplies exactly which humans stay manager (`Superuser`/`Administrator`) vs. become `Website Admin`. Migrate the named users' role (Directus user-role change). Pre-seed their `website_admin_access` grants **before** the role flip so they never see an empty admin mid-UAT.
8. **Acceptance test (proves hiding ≠ UI-only):** a migrated `Website Admin` user → direct `GET /items/scorer_courses` = **403**; via `/kscw/wadmin/scorer_courses/items/scorer_courses` with grant = **200**; revoke grant = **403**.

### Rollback
- A: drop the table (`DROP TABLE website_admin_access`) + revert the extension commit + redeploy.
- B: revert the `admin.astro` commit (managers were never gated, so no access lost).
- C: re-assign the migrated users back to their prior role; the `Website Admin` policy is inert once unused.

## Testing

**Phase A — endpoint (vitest, hermetic; mirrors `__tests__/broadcast-helpers.test.js` knex-mock style):**
- `/me`: no `accountability.user` → 401; role `Superuser`/`Administrator` → `isSuperuser:true` + all 6; role `Website Admin` with a grant row → those sections; with no row → `[]`; any other role → `[]`.
- Per-section: manager → any section; gated with grant → that section; gated without grant → 403 `section_not_granted`; `:collection` outside the section contract → 403 `resource_out_of_scope`.
- Management: non-manager → 403; `PATCH /admins/:id` upsert is idempotent (insert then update same user) and reflected by a subsequent `/admins`.

**Phase B — frontend (manual, documented script):** manager sees all tabs + Admin grid; the throwaway non-`admin_access` test user with zero grants sees the empty state; with a partial grant sees only those tabs; grid toggle persists across reload.

**Phase C — acceptance:** the boundary-proof in step 8, run against dev first, then prod, on a migrated user.

## Completion

Per project convention (`CLAUDE.md`): this is a **minor** version bump (new feature). On completion add a CHANGELOG.md entry, bump `package.json`, and update the changelog sections on both `/de/club/feedback` and `/en/club/feedback`.

## Out of scope

- Per-file ownership/section tagging.
- Bulk grant/revoke UI, audit log of grant changes, per-section human-readable descriptions.
- Any non-manager path to the management routes.
- Migrating users *automatically* — Phase C role moves are an explicit, human-confirmed list, never inferred.
