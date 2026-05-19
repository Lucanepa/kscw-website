# Admin Section Access Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers grant/revoke `/admin` sections per individual website admin, with server-enforced access (not UI-only), shipped in two safe additive phases plus a separately-green-lit role migration.

**Architecture:** A new internal Postgres table (`website_admin_access`, raw-knex, no Directus REST surface) + a new `/kscw/wadmin` endpoint in the wiedisync `kscw-endpoints` extension that identifies the caller from their token but reaches data via admin-accountability `ItemsService` (idiomatic; no service-token proxy). `admin.astro` routes its six sections through `/kscw/wadmin/<section>/…`, builds tabs from `/kscw/wadmin/me`, and gains a manager-only grant grid. Today's admins are all on `admin_access=true` roles (managers) so Phases A+B are zero-impact for them; the `Website Admin` non-admin role + user migration is Phase C, separate.

**Tech Stack:** Directus 11 endpoint extension (Express router, ESM), Knex/pg, vitest (hermetic knex mocks), Astro static site, vanilla-JS island (DOM built with `createElement`/`textContent` — the project bundles DOMPurify; never assign untrusted strings to `innerHTML`).

**Spec:** `docs/superpowers/specs/2026-05-19-admin-section-access-design.md`

**Two repos:**
- **W** = `/home/luca-canepa/Desktop/Github/wiedisync` (branch `dev`)
- **K** = `/home/luca-canepa/Desktop/Github/kscw-website` (branch `dev`)

---

## File Structure

**W (wiedisync):**
- Create `directus/scripts/063-website-admin-access.sql` — the internal table (one responsibility: schema).
- Modify `directus/extensions/kscw-endpoints/src/opnform.js` — export reusable `listSubmissions` / `deleteSubmission` / `getCount` / `badSlug` (behavior-preserving refactor so `wadmin` can delegate without duplicating the OpnForm PAT logic).
- Create `directus/extensions/kscw-endpoints/src/wadmin.js` — the gated endpoint (auth/role resolution, section contract, item routes, opnform delegation, management routes). One responsibility: access control + data dispatch.
- Modify `directus/extensions/kscw-endpoints/src/index.js` — import + `registerWadmin(router, ctx)` (one line, mirrors `registerOpnform`).
- Create `directus/extensions/kscw-endpoints/src/__tests__/opnform.test.js` — locks the extracted `listSubmissions`/`badSlug` contract.
- Create `directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js` — hermetic auth/contract matrix.
- Modify `directus/scripts/setup-permissions.mjs` — **Phase C only**, the `Website Admin` role + `KSCW Website Admin` policy.

**K (kscw-website):**
- Modify `src/pages/admin.astro` — `wadmin()` helper, `/me`-driven tabs + empty state, section call-site swaps, manager-only Admin grid.

**Untouched on purpose:** `directus/scripts/_migrations-tracker.sql` (its backfill list is for *historical* manually-applied migrations; `apply-migrations.mjs` records new ones automatically — adding 063 there would wrongly mark it pre-applied). `/files`, `/users/me`, `items/teams`, `/assets/*` stay direct Directus calls.

---

## Conventions for every task

- **W tests:** from the W repo root, `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/<file>` (vitest config `vitest.config.ts` already globs `directus/extensions/**/__tests__/**/*.test.js`). Hermetic — mock knex via a chainable shim exactly like `directus/extensions/kscw-endpoints/src/__tests__/broadcast-helpers.test.js`.
- **K verification:** `npx astro build` from the K repo root must succeed (this static site has no island unit harness; build + the documented manual script is the gate — do not fabricate a test framework).
- **DOM safety (K):** build elements with `document.createElement` + `textContent` and `appendChild`. Do not assign concatenated/user data to `innerHTML`. (`escapeHtml`/`escapeAttr` exist for the file's legacy string paths; new code uses DOM nodes.)
- **Commits:** after each task's tests/build pass, commit in that task's repo. End commit messages with the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- **Deploy/migrate are user-run `[CLI]`** (the `db:*` / `ext:deploy:*` npm scripts SSH the Hetzner host — not agent-run). Tasks that need them stop and hand the exact command to the user.

---

## Task A1: Create the `website_admin_access` migration (W)

**Files:**
- Create: `directus/scripts/063-website-admin-access.sql`

- [ ] **Step 1: Write the migration file**

Create `directus/scripts/063-website-admin-access.sql`:

```sql
-- 063-website-admin-access.sql
-- Per-user website-admin section grants for /admin (kscw-website).
-- Internal config table — deliberately NOT registered in Directus
-- (no directus_collections/directus_fields row), so there is no
-- /items/website_admin_access REST surface. Reached only via the
-- /kscw/wadmin endpoint (raw knex). See
-- docs/superpowers/specs/2026-05-19-admin-section-access-design.md.

BEGIN;

CREATE TABLE IF NOT EXISTS website_admin_access (
  id           serial PRIMARY KEY,
  "user"       uuid NOT NULL UNIQUE
                 REFERENCES directus_users(id) ON DELETE CASCADE,
  sections     jsonb NOT NULL DEFAULT '[]'::jsonb,
  date_created timestamptz NOT NULL DEFAULT now(),
  date_updated timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE website_admin_access IS
  'kscw-website /admin per-user section grants. Internal — not a Directus collection; only reachable via /kscw/wadmin.';
COMMENT ON COLUMN website_admin_access.sections IS
  'JSON array of section keys: news, events, registrations, sponsors, scorer_courses, mixed_turnier';

COMMIT;
```

- [ ] **Step 2: Sanity-check the SQL is well-formed**

Run (from W root): `grep -c 'BEGIN;\|COMMIT;' directus/scripts/063-website-admin-access.sql`
Expected: `2`. Then:
Run: `grep -n 'IF NOT EXISTS\|ON DELETE CASCADE\|jsonb NOT NULL DEFAULT' directus/scripts/063-website-admin-access.sql`
Expected: three matching lines.

- [ ] **Step 3: Confirm the runner sees it as pending (no apply yet)**

Read-only but SSHes the host — hand to the user:
> `[CLI]` In the W repo: `npm run db:migrate:status:dev`
> Expected: `063-website-admin-access.sql` listed **pending**. Do **not** apply yet (applied in Task A8 after the extension exists, so prod is never half-migrated).

- [ ] **Step 4: Commit**

```bash
cd /home/luca-canepa/Desktop/Github/wiedisync
git add directus/scripts/063-website-admin-access.sql
git commit -m "feat(db): website_admin_access internal table (063)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task A2: Refactor `opnform.js` to export reusable functions (W)

Behavior-preserving: extract the submission-list / delete / count bodies into exported functions so `wadmin` can delegate without duplicating the OpnForm PAT/base logic. `registerOpnform`'s routes become thin callers — identical responses.

**Files:**
- Modify: `directus/extensions/kscw-endpoints/src/opnform.js`
- Test: `directus/extensions/kscw-endpoints/src/__tests__/opnform.test.js`

- [ ] **Step 1: Write the failing test**

Create `directus/extensions/kscw-endpoints/src/__tests__/opnform.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { badSlug, listSubmissions } from '../opnform.js'

describe('opnform exports', () => {
  it('badSlug rejects empty and bad, accepts normal slugs', () => {
    expect(badSlug('')).toBe(true)
    expect(badSlug('a b')).toBe(true)
    expect(badSlug('scorer-kurse-2026-en')).toBe(false)
  })

  describe('listSubmissions', () => {
    const realFetch = global.fetch
    beforeEach(() => { process.env.OPNFORM_PAT = 'test-pat' })
    afterEach(() => { global.fetch = realFetch })

    it('shapes the payload from OpnForm responses', async () => {
      const calls = []
      global.fetch = vi.fn(async (url) => {
        calls.push(String(url))
        if (String(url).includes('/submissions')) {
          return { ok: true, text: async () => JSON.stringify({
            data: [{ id: 1 }], meta: { total: 1, last_page: 1 } }) }
        }
        return { ok: true, text: async () => JSON.stringify({
          data: { title: 'Form X', properties: [{ id: 'f1', name: 'Name', type: 'text' }] } }) }
      })
      const out = await listSubmissions('my-form', { page: 1, perPage: 100 })
      expect(out.title).toBe('Form X')
      expect(out.fields).toEqual([{ id: 'f1', name: 'Name', type: 'text' }])
      expect(out.data).toEqual([{ id: 1 }])
      expect(out.total).toBe(1)
      expect(out.last_page).toBe(1)
      expect(calls.some(u => u.includes('/forms/my-form/submissions'))).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run it — verify it fails**

Run (W root): `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/opnform.test.js`
Expected: FAIL — `badSlug`/`listSubmissions` not exported (`does not provide an export named 'badSlug'`).

- [ ] **Step 3: Extract and export the functions**

In `directus/extensions/kscw-endpoints/src/opnform.js`:

(a) Add `export` to `badSlug`:
```js
export function badSlug(slug) {
  return !slug || !SLUG_RE.test(slug)
}
```

(b) Add these exported functions immediately **after** `getFormMeta` (before `export function registerOpnform`):

```js
export async function getCount(slug) {
  const cached = countCache.get(slug)
  if (cached && cached.expiresAt > Date.now()) return { count: cached.value, cached: true }
  const json = await opnformFetch(`/forms/${encodeURIComponent(slug)}/submissions?per_page=1`)
  const total = Number(json?.meta?.total ?? 0) || 0
  countCache.set(slug, { value: total, expiresAt: Date.now() + COUNT_CACHE_TTL_MS })
  return { count: total, cached: false }
}

export async function listSubmissions(slug, { page = 1, perPage = 100 } = {}) {
  const pp = Math.min(100, Math.max(1, Number(perPage) || 100))
  const pg = Math.max(1, Number(page) || 1)
  const [submissionsJson, meta] = await Promise.all([
    opnformFetch(`/forms/${encodeURIComponent(slug)}/submissions?per_page=${pp}&page=${pg}`),
    getFormMeta(slug),
  ])
  const data = Array.isArray(submissionsJson?.data) ? submissionsJson.data : []
  const total = Number(submissionsJson?.meta?.total ?? data.length)
  const lastPage = Number(submissionsJson?.meta?.last_page ?? 1)
  return { title: meta.title, fields: meta.properties, data, total, page: pg, per_page: pp, last_page: lastPage }
}

export async function deleteSubmission(slug, id) {
  await opnformFetch(
    `/forms/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  countCache.delete(slug)
  return { ok: true }
}
```

(c) Replace the three route handler bodies in `registerOpnform` so they call the new functions (responses unchanged). Count route body:
```js
    try {
      const r = await getCount(slug)
      res.json(r)
    } catch (err) {
      if (err.status === 404) return res.status(404).json({ error: 'Form not found' })
      log.warn({ msg: 'OpnForm count failed', slug, status: err.status, error: err.message })
      res.status(err.status || 502).json({ error: 'Upstream error' })
    }
```
Submissions route body:
```js
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 100))
    const page = Math.max(1, Number(req.query.page) || 1)
    try {
      const payload = await listSubmissions(slug, { page, perPage })
      res.json(payload)
    } catch (err) {
      if (err.status === 404) return res.status(404).json({ error: 'Form not found' })
      log.warn({ msg: 'OpnForm submissions failed', slug, status: err.status, error: err.message })
      res.status(err.status || 502).json({ error: 'Upstream error' })
    }
```
Delete route body:
```js
    try {
      await deleteSubmission(slug, id)
      res.json({ ok: true })
    } catch (err) {
      if (err.status === 404) return res.status(404).json({ error: 'Submission not found' })
      if (err.status === 401 || err.status === 403) {
        log.warn({ msg: 'OpnForm delete unauthorized', slug, id, status: err.status })
        return res.status(403).json({ error: 'OpnForm rejected the delete — the OPNFORM_PAT likely lacks the forms-write ability' })
      }
      log.warn({ msg: 'OpnForm delete failed', slug, id, status: err.status, error: err.message })
      res.status(err.status || 502).json({ error: 'Upstream error' })
    }
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/opnform.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/luca-canepa/Desktop/Github/wiedisync
git add directus/extensions/kscw-endpoints/src/opnform.js directus/extensions/kscw-endpoints/src/__tests__/opnform.test.js
git commit -m "refactor(opnform): export listSubmissions/deleteSubmission/getCount/badSlug

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task A3: `wadmin.js` core — contract, role resolution, `/me` (W)

**Files:**
- Create: `directus/extensions/kscw-endpoints/src/wadmin.js`
- Test: `directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`

- [ ] **Step 1: Write the failing test (pure helpers + `/me` logic)**

Create `directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  ALL_SECTIONS, SECTION_COLLECTIONS,
  isManager, normalizeSections, computeAccess,
} from '../wadmin.js'

function makeDb({ roleRow = null, accessRow = null } = {}) {
  return (table) => {
    const chain = {
      join: () => chain,
      leftJoin: () => chain,
      where: () => chain,
      whereRaw: () => chain,
      orderBy: () => chain,
      select: () => chain,
      first: async () => (table === 'directus_users' ? roleRow : accessRow),
    }
    return chain
  }
}

describe('wadmin core', () => {
  it('contract covers exactly the 6 sections', () => {
    expect(ALL_SECTIONS).toEqual(
      ['news','events','registrations','sponsors','scorer_courses','mixed_turnier'])
    expect(Object.keys(SECTION_COLLECTIONS).sort()).toEqual([...ALL_SECTIONS].sort())
    expect(SECTION_COLLECTIONS.mixed_turnier).toEqual(
      ['mixed_tournament_signups','participations','members'])
  })

  it('isManager is case-insensitive for Superuser/Administrator only', () => {
    expect(isManager('Superuser')).toBe(true)
    expect(isManager('administrator')).toBe(true)
    expect(isManager('Website Admin')).toBe(false)
    expect(isManager('Member')).toBe(false)
    expect(isManager(null)).toBe(false)
  })

  it('normalizeSections drops unknown keys and handles array or json string', () => {
    expect(normalizeSections(['news','bogus','events'])).toEqual(['news','events'])
    expect(normalizeSections('["sponsors","x"]')).toEqual(['sponsors'])
    expect(normalizeSections(null)).toEqual([])
  })

  it('computeAccess: manager → all 6', async () => {
    const db = makeDb({ roleRow: { role_name: 'Superuser' } })
    expect(await computeAccess(db, 'u1')).toEqual({ isSuperuser: true, sections: ALL_SECTIONS })
  })

  it('computeAccess: Website Admin with row → its sections', async () => {
    const db = makeDb({
      roleRow: { role_name: 'Website Admin' },
      accessRow: { sections: ['news','scorer_courses'] },
    })
    expect(await computeAccess(db, 'u2')).toEqual(
      { isSuperuser: false, sections: ['news','scorer_courses'] })
  })

  it('computeAccess: Website Admin no row → []', async () => {
    const db = makeDb({ roleRow: { role_name: 'Website Admin' }, accessRow: null })
    expect(await computeAccess(db, 'u3')).toEqual({ isSuperuser: false, sections: [] })
  })

  it('computeAccess: other role → []', async () => {
    const db = makeDb({ roleRow: { role_name: 'Member' } })
    expect(await computeAccess(db, 'u4')).toEqual({ isSuperuser: false, sections: [] })
  })

  it('computeAccess: unknown user (no role row) fails closed', async () => {
    const db = makeDb({ roleRow: null })
    expect(await computeAccess(db, 'u5')).toEqual({ isSuperuser: false, sections: [] })
  })
})
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`
Expected: FAIL — `Cannot find module '../wadmin.js'`.

- [ ] **Step 3: Create `wadmin.js` with the core (helpers + `registerWadmin` skeleton with only `/me`)**

Create `directus/extensions/kscw-endpoints/src/wadmin.js`:

```js
/**
 * /kscw/wadmin — per-user website-admin section access.
 *
 * The caller's token only IDENTIFIES them (id + role via the
 * directus_users→directus_roles join, as in bugfixes.js). Data is
 * reached with admin-accountability ItemsService (idiomatic; no
 * service-token proxy). website_admin_access is an internal table
 * read/written via raw knex (no Directus REST surface).
 *
 * Manager = Superuser/Administrator (admin_access=true today) → all
 * sections + the management grid. Website Admin = the Phase-C
 * non-admin role → only granted sections. Any other role → nothing.
 */

import { badSlug, listSubmissions, deleteSubmission } from './opnform.js'

export const ALL_SECTIONS = [
  'news', 'events', 'registrations', 'sponsors', 'scorer_courses', 'mixed_turnier',
]

export const SECTION_COLLECTIONS = {
  news: ['news'],
  events: ['events'],
  registrations: ['registrations'],
  sponsors: ['sponsors'],
  scorer_courses: ['scorer_courses'],
  mixed_turnier: ['mixed_tournament_signups', 'participations', 'members'],
}

const MANAGER_ROLES = new Set(['superuser', 'administrator'])
const GATED_ROLE = 'website admin'

export function isManager(roleName) {
  return !!roleName && MANAGER_ROLES.has(String(roleName).toLowerCase())
}

export function normalizeSections(raw) {
  let arr = raw
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw) } catch { arr = [] }
  }
  if (!Array.isArray(arr)) return []
  return arr.filter((s) => ALL_SECTIONS.includes(s))
}

async function resolveRoleName(database, userId) {
  if (!userId) return null
  const row = await database('directus_users')
    .join('directus_roles', 'directus_users.role', 'directus_roles.id')
    .where('directus_users.id', userId)
    .select('directus_roles.name as role_name')
    .first()
  return row ? row.role_name : null
}

// { isSuperuser, sections } — fail-closed on anything ambiguous.
export async function computeAccess(database, userId) {
  const roleName = await resolveRoleName(database, userId)
  if (isManager(roleName)) return { isSuperuser: true, sections: ALL_SECTIONS }
  if (String(roleName || '').toLowerCase() !== GATED_ROLE) {
    return { isSuperuser: false, sections: [] }
  }
  const row = await database('website_admin_access')
    .where('user', userId)
    .select('sections')
    .first()
  return { isSuperuser: false, sections: normalizeSections(row ? row.sections : null) }
}

export function registerWadmin(router, ctx) {
  const { logger } = ctx
  const database = ctx.database
  const log = logger.child({ endpoint: 'wadmin' })

  router.get('/wadmin/me', async (req, res) => {
    const userId = req.accountability?.user
    if (!userId) return res.status(401).json({ error: 'unauthenticated' })
    try {
      res.json(await computeAccess(database, userId))
    } catch (e) {
      log.warn({ msg: 'wadmin/me failed', error: e.message })
      res.status(200).json({ isSuperuser: false, sections: [] }) // fail closed
    }
  })

  // Per-section item routes — Task A4.
  // Scorer-course OpnForm delegation — Task A5.
  // Management routes — Task A6.
}
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`
Expected: PASS (7 tests). (`badSlug`/`listSubmissions`/`deleteSubmission` import resolves because Task A2 exported them.)

- [ ] **Step 5: Commit**

```bash
cd /home/luca-canepa/Desktop/Github/wiedisync
git add directus/extensions/kscw-endpoints/src/wadmin.js directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js
git commit -m "feat(wadmin): core contract + role resolution + /me

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task A4: `wadmin.js` per-section item routes (W)

Adds the gated CRUD routes that reach the six content collections via admin-accountability `ItemsService`.

**Files:**
- Modify: `directus/extensions/kscw-endpoints/src/wadmin.js`
- Test: `directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`

- [ ] **Step 1: Add failing tests for the gate + scope helpers**

Append to `wadmin.test.js` (extend the existing import from `../wadmin.js` to also import `authorize, assertCollection, parseQuery`):

```js
import { authorize, assertCollection, parseQuery } from '../wadmin.js'

describe('wadmin gate + scope', () => {
  const dbManager = (t) => ({ join(){return this}, leftJoin(){return this},
    where(){return this}, whereRaw(){return this}, orderBy(){return this},
    select(){return this}, first: async()=> t==='directus_users'
      ? { role_name:'Superuser' } : null })
  const dbGated = (sections) => (t) => ({ join(){return this}, leftJoin(){return this},
    where(){return this}, whereRaw(){return this}, orderBy(){return this},
    select(){return this}, first: async()=> t==='directus_users'
      ? { role_name:'Website Admin' } : { sections } })

  it('authorize: manager passes any section', async () => {
    expect(await authorize(dbManager, 'u', 'sponsors'))
      .toEqual({ ok: true, isSuperuser: true })
  })
  it('authorize: gated with grant passes that section', async () => {
    expect(await authorize(dbGated(['news']), 'u', 'news'))
      .toEqual({ ok: true, isSuperuser: false })
  })
  it('authorize: gated without grant → section_not_granted', async () => {
    expect(await authorize(dbGated(['news']), 'u', 'sponsors'))
      .toEqual({ ok: false, status: 403, error: 'section_not_granted' })
  })
  it('authorize: unknown section → unknown_section', async () => {
    expect(await authorize(dbManager, 'u', 'bogus'))
      .toEqual({ ok: false, status: 404, error: 'unknown_section' })
  })

  it('assertCollection: in-contract ok, out-of-contract rejected', () => {
    expect(assertCollection('news', 'news')).toBe(true)
    expect(assertCollection('news', 'sponsors')).toBe(false)
    expect(assertCollection('mixed_turnier', 'members')).toBe(true)
  })

  it('parseQuery maps Directus REST query to ItemsService query', () => {
    expect(parseQuery({
      filter: { active: { _eq: 'true' } },
      fields: 'id,title', sort: '-date,name', limit: '-1',
    })).toEqual({
      filter: { active: { _eq: 'true' } },
      fields: ['id','title'], sort: ['-date','name'], limit: -1,
    })
    expect(parseQuery({})).toEqual({})
  })
})
```

- [ ] **Step 2: Run — verify new tests fail**

Run: `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`
Expected: FAIL — `authorize`/`assertCollection`/`parseQuery` not exported.

- [ ] **Step 3: Implement the helpers + routes**

In `wadmin.js`, add these exported helpers (above `registerWadmin`):

```js
// → { ok:true, isSuperuser } | { ok:false, status, error }
export async function authorize(database, userId, section) {
  if (!ALL_SECTIONS.includes(section)) {
    return { ok: false, status: 404, error: 'unknown_section' }
  }
  const { isSuperuser, sections } = await computeAccess(database, userId)
  if (isSuperuser) return { ok: true, isSuperuser: true }
  if (sections.includes(section)) return { ok: true, isSuperuser: false }
  return { ok: false, status: 403, error: 'section_not_granted' }
}

export function assertCollection(section, collection) {
  return (SECTION_COLLECTIONS[section] || []).includes(collection)
}

export function parseQuery(q) {
  const out = {}
  if (q && typeof q.filter === 'object' && q.filter !== null) out.filter = q.filter
  if (typeof q?.fields === 'string') out.fields = q.fields.split(',').map(s => s.trim()).filter(Boolean)
  if (typeof q?.sort === 'string') out.sort = q.sort.split(',').map(s => s.trim()).filter(Boolean)
  if (q?.limit !== undefined) out.limit = Number(q.limit)
  if (q?.offset !== undefined) out.offset = Number(q.offset)
  if (q?.page !== undefined) out.page = Number(q.page)
  if (typeof q?.search === 'string') out.search = q.search
  return out
}
```

In `registerWadmin`, after the `const log = ...` line add the services + helpers, and replace the `// Per-section item routes — Task A4.` comment with the routes:

```js
  const { services, getSchema } = ctx
  const { ItemsService } = services

  async function svc(collection) {
    const schema = await getSchema()
    return new ItemsService(collection, { schema, knex: database, accountability: { admin: true } })
  }

  function sendErr(res, e) {
    const name = e && e.constructor && e.constructor.name
    if (name === 'ForbiddenError') return res.status(403).json({ error: 'forbidden' })
    if (name === 'InvalidPayloadError' || name === 'FailedValidationError') {
      return res.status(400).json({ error: 'invalid_payload' })
    }
    log.warn({ msg: 'wadmin items error', error: e && e.message })
    return res.status(500).json({ error: 'internal' })
  }

  // Resolve+authorize+scope once; returns the collection or null
  // (response already sent on failure).
  async function guard(req, res) {
    const userId = req.accountability?.user
    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return null }
    const { section, collection } = req.params
    const a = await authorize(database, userId, section)
    if (!a.ok) { res.status(a.status).json({ error: a.error, section }); return null }
    if (!assertCollection(section, collection)) {
      res.status(403).json({ error: 'resource_out_of_scope', collection }); return null
    }
    return collection
  }

  router.get('/wadmin/:section/items/:collection', async (req, res) => {
    const c = await guard(req, res); if (!c) return
    try { res.json({ data: await (await svc(c)).readByQuery(parseQuery(req.query)) }) }
    catch (e) { sendErr(res, e) }
  })

  router.get('/wadmin/:section/items/:collection/:id', async (req, res) => {
    const c = await guard(req, res); if (!c) return
    try { res.json({ data: await (await svc(c)).readOne(req.params.id, parseQuery(req.query)) }) }
    catch (e) { sendErr(res, e) }
  })

  router.post('/wadmin/:section/items/:collection', async (req, res) => {
    const c = await guard(req, res); if (!c) return
    try {
      const id = await (await svc(c)).createOne(req.body)
      res.json({ data: { id } })
    } catch (e) { sendErr(res, e) }
  })

  router.patch('/wadmin/:section/items/:collection/:id', async (req, res) => {
    const c = await guard(req, res); if (!c) return
    try {
      await (await svc(c)).updateOne(req.params.id, req.body)
      res.json({ data: { id: req.params.id } })
    } catch (e) { sendErr(res, e) }
  })

  router.delete('/wadmin/:section/items/:collection/:id', async (req, res) => {
    const c = await guard(req, res); if (!c) return
    try {
      await (await svc(c)).deleteOne(req.params.id)
      res.json({ ok: true })
    } catch (e) { sendErr(res, e) }
  })
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`
Expected: PASS (A3's 7 + the new 6).

- [ ] **Step 5: Commit**

```bash
cd /home/luca-canepa/Desktop/Github/wiedisync
git add directus/extensions/kscw-endpoints/src/wadmin.js directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js
git commit -m "feat(wadmin): gated per-section item CRUD routes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task A5: `wadmin.js` scorer-course OpnForm delegation (W)

`scorer_courses` reaches OpnForm submissions. Routes are gated to the `scorer_courses` section, then delegate to the Task-A2 exports (already imported at the top of `wadmin.js` from Task A3).

**Files:**
- Modify: `directus/extensions/kscw-endpoints/src/wadmin.js`
- Test: `directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`

- [ ] **Step 1: Add the delegation routes**

In `registerWadmin`, replace `// Scorer-course OpnForm delegation — Task A5.`:

```js
  async function guardScorer(req, res) {
    const userId = req.accountability?.user
    if (!userId) { res.status(401).json({ error: 'unauthenticated' }); return false }
    const a = await authorize(database, userId, 'scorer_courses')
    if (!a.ok) { res.status(a.status).json({ error: a.error, section: 'scorer_courses' }); return false }
    if (badSlug(req.params.slug)) { res.status(400).json({ error: 'Invalid slug' }); return false }
    return true
  }

  router.get('/wadmin/scorer_courses/opnform/forms/:slug/submissions', async (req, res) => {
    if (!(await guardScorer(req, res))) return
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 100))
    const page = Math.max(1, Number(req.query.page) || 1)
    try {
      res.json(await listSubmissions(req.params.slug, { page, perPage }))
    } catch (err) {
      if (err.status === 404) return res.status(404).json({ error: 'Form not found' })
      log.warn({ msg: 'wadmin opnform list failed', slug: req.params.slug, status: err.status })
      res.status(err.status || 502).json({ error: 'Upstream error' })
    }
  })

  router.delete('/wadmin/scorer_courses/opnform/forms/:slug/submissions/:id', async (req, res) => {
    if (!(await guardScorer(req, res))) return
    if (!/^[0-9]+$/.test(String(req.params.id))) {
      return res.status(400).json({ error: 'Invalid submission id' })
    }
    try {
      await deleteSubmission(req.params.slug, req.params.id)
      res.json({ ok: true })
    } catch (err) {
      if (err.status === 404) return res.status(404).json({ error: 'Submission not found' })
      if (err.status === 401 || err.status === 403) {
        return res.status(403).json({ error: 'OpnForm rejected the delete — the OPNFORM_PAT likely lacks the forms-write ability' })
      }
      log.warn({ msg: 'wadmin opnform delete failed', slug: req.params.slug, status: err.status })
      res.status(err.status || 502).json({ error: 'Upstream error' })
    }
  })
```

- [ ] **Step 2: Add a hermetic test for the shared slug validator**

Append to `wadmin.test.js`:

```js
import { badSlug as wadminBadSlug } from '../opnform.js'
describe('wadmin scorer delegation guards', () => {
  it('reuses opnform badSlug for slug validation', () => {
    expect(wadminBadSlug('ok-slug')).toBe(false)
    expect(wadminBadSlug('bad slug')).toBe(true)
  })
})
```
(Route-level auth ordering 401→403→400 is covered by the `authorize` matrix in A4.)

- [ ] **Step 3: Run the full suite — verify green**

Run: `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/`
Expected: PASS — `opnform.test.js` + `wadmin.test.js` all green.

- [ ] **Step 4: Commit**

```bash
cd /home/luca-canepa/Desktop/Github/wiedisync
git add directus/extensions/kscw-endpoints/src/wadmin.js directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js
git commit -m "feat(wadmin): scorer_courses OpnForm submission delegation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task A6: `wadmin.js` manager-only management routes (W)

`GET /wadmin/admins` lists `Website Admin` users + grants; `PUT /wadmin/admins/:id` upserts a grant row. Manager-only.

**Files:**
- Modify: `directus/extensions/kscw-endpoints/src/wadmin.js`
- Test: `directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`

- [ ] **Step 1: Add failing tests for the manager guard + upsert payload**

Append to `wadmin.test.js`:

```js
import { isManagerUser, buildUpsert } from '../wadmin.js'

describe('wadmin management', () => {
  const db = (role) => () => ({ join(){return this}, leftJoin(){return this},
    where(){return this}, whereRaw(){return this}, orderBy(){return this},
    select(){return this}, first: async()=>({ role_name: role }) })

  it('isManagerUser true for Superuser, false for Website Admin', async () => {
    expect(await isManagerUser(db('Superuser'), 'u')).toBe(true)
    expect(await isManagerUser(db('Website Admin'), 'u')).toBe(false)
    expect(await isManagerUser(db(null), 'u')).toBe(false)
  })

  it('buildUpsert filters sections and sets the conflict target', () => {
    const u = buildUpsert('user-1', ['news','x','sponsors'])
    expect(u.row.user).toBe('user-1')
    expect(JSON.parse(u.row.sections)).toEqual(['news','sponsors'])
    expect(u.conflict).toBe('user')
  })
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`
Expected: FAIL — `isManagerUser`/`buildUpsert` not exported.

- [ ] **Step 3: Implement helpers + routes**

Add exported helpers to `wadmin.js`:

```js
export async function isManagerUser(database, userId) {
  if (!userId) return false
  const row = await database('directus_users')
    .join('directus_roles', 'directus_users.role', 'directus_roles.id')
    .where('directus_users.id', userId)
    .select('directus_roles.name as role_name')
    .first()
  return isManager(row ? row.role_name : null)
}

export function buildUpsert(userId, sections) {
  return {
    row: { user: userId, sections: JSON.stringify(normalizeSections(sections)) },
    conflict: 'user',
  }
}
```

In `registerWadmin`, replace `// Management routes — Task A6.`:

```js
  router.get('/wadmin/admins', async (req, res) => {
    const userId = req.accountability?.user
    if (!(await isManagerUser(database, userId))) {
      return res.status(403).json({ error: 'manager_required' })
    }
    try {
      const rows = await database('directus_users')
        .join('directus_roles', 'directus_users.role', 'directus_roles.id')
        .leftJoin('website_admin_access', 'website_admin_access.user', 'directus_users.id')
        .whereRaw('LOWER(directus_roles.name) = ?', ['website admin'])
        .select(
          'directus_users.id as id',
          'directus_users.first_name as first_name',
          'directus_users.last_name as last_name',
          'directus_users.email as email',
          'website_admin_access.sections as sections',
        )
        .orderBy(['directus_users.first_name', 'directus_users.last_name'])
      res.json({
        data: rows.map((r) => ({
          id: r.id,
          name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email,
          email: r.email,
          sections: normalizeSections(r.sections),
        })),
      })
    } catch (e) {
      log.warn({ msg: 'wadmin/admins list failed', error: e.message })
      res.status(500).json({ error: 'internal' })
    }
  })

  router.put('/wadmin/admins/:id', async (req, res) => {
    const userId = req.accountability?.user
    if (!(await isManagerUser(database, userId))) {
      return res.status(403).json({ error: 'manager_required' })
    }
    const target = req.params.id
    const sections = Array.isArray(req.body?.sections) ? req.body.sections : []
    try {
      const { row, conflict } = buildUpsert(target, sections)
      await database('website_admin_access')
        .insert(row)
        .onConflict(conflict)
        .merge({ sections: row.sections, date_updated: database.fn.now() })
      res.json({ data: { id: target, sections: normalizeSections(sections) } })
    } catch (e) {
      log.warn({ msg: 'wadmin/admins upsert failed', error: e.message })
      res.status(500).json({ error: 'internal' })
    }
  })
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js`
Expected: PASS (all wadmin tests).

- [ ] **Step 5: Commit**

```bash
cd /home/luca-canepa/Desktop/Github/wiedisync
git add directus/extensions/kscw-endpoints/src/wadmin.js directus/extensions/kscw-endpoints/src/__tests__/wadmin.test.js
git commit -m "feat(wadmin): manager-only grant management routes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task A7: Register `wadmin` in `index.js` (W)

**Files:**
- Modify: `directus/extensions/kscw-endpoints/src/index.js` (import near line 36; call at ~line 1865 after `registerOpnform`)

- [ ] **Step 1: Add the import**

In `index.js`, immediately after `import { registerOpnform } from './opnform.js'`:
```js
import { registerWadmin } from './wadmin.js'
```

- [ ] **Step 2: Register the routes**

In `index.js`, immediately after the line `registerOpnform(router, ctx)`:
```js
    registerWadmin(router, ctx)
```

- [ ] **Step 3: Verify wiring + full suite green**

Run (W root): `grep -n "registerWadmin" directus/extensions/kscw-endpoints/src/index.js`
Expected: two lines (import + call).
Run: `npx vitest run directus/extensions/kscw-endpoints/src/__tests__/`
Expected: PASS — all green, no regressions.

- [ ] **Step 4: Commit**

```bash
cd /home/luca-canepa/Desktop/Github/wiedisync
git add directus/extensions/kscw-endpoints/src/index.js
git commit -m "feat(wadmin): register /kscw/wadmin endpoint

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task A8: Deploy Phase A (USER-RUN `[CLI]` — runbook)

Not agent-run: every command SSHes the Hetzner host. Present as an ordered checklist; wait for confirmation of each.

- [ ] **Step 1: Push W `dev`** → `[CLI]` W repo: `git push origin dev`

- [ ] **Step 2: Apply migration 063 — dev then prod**
> `[CLI]` `npm run db:migrate:dev` → 063 applied. `npm run db:migrate:status:dev` → 063 = applied.
> `[CLI]` `npm run db:migrate:prod` ; `npm run db:migrate:status:prod` → 063 applied.

- [ ] **Step 3: Deploy the extension — dev then prod**
> `[CLI]` `npm run ext:deploy:dev` (restarts `directus-kscw-dev`).
> `[CLI]` `npm run ext:deploy:prod` (restarts `directus-kscw`).

- [ ] **Step 4: Smoke-verify (manager token `$T` from the `/admin` session, sessionStorage `kscw_admin_auth`)**
```
curl -s -H "Authorization: Bearer $T" https://directus-dev.kscw.ch/kscw/wadmin/me
```
Expected: `{"isSuperuser":true,"sections":["news","events","registrations","sponsors","scorer_courses","mixed_turnier"]}`
```
curl -s -o /dev/null -w "%{http_code}" https://directus-dev.kscw.ch/kscw/wadmin/me
```
Expected: `401`.

- [ ] **Step 5: Gate** — do not start Phase B until Step 4 returns the manager payload on **dev**; repeat against prod before B's prod deploy.

---

## Task B1: `wadmin()` helper + `/me` access load in `admin.astro` (K)

**Files:**
- Modify: `src/pages/admin.astro` (module state near line 38; helpers after `getValidToken` ~line 71)

- [ ] **Step 1: Add module state**

After `var currentTab = 'news';` (line 38), add:
```js
    var adminAccess = { isSuperuser: false, sections: [] };
    var SECTION_ORDER = ['news','events','registrations','sponsors','scorer_courses','mixed_turnier'];
```

- [ ] **Step 2: Add `wadmin()` + `loadAccess()`**

After `getValidToken` closes (after line 71, before the `// ── i18n ──` comment):
```js
    // Section data goes through the gated endpoint. /users/me,
    // items/teams, /files and /assets stay direct (see spec).
    async function wadmin(section, subpath, opts) {
      var token = await getValidToken();
      var o = opts || {};
      var headers = Object.assign({}, o.headers || {}, { 'Authorization': 'Bearer ' + token });
      return fetch(DIRECTUS_URL + '/kscw/wadmin/' + section + '/' + subpath, Object.assign({}, o, { headers: headers }));
    }
    async function loadAccess() {
      var token = await getValidToken();
      if (!token) { adminAccess = { isSuperuser: false, sections: [] }; return adminAccess; }
      try {
        var res = await fetch(DIRECTUS_URL + '/kscw/wadmin/me', {
          headers: { 'Authorization': 'Bearer ' + token },
        });
        if (!res.ok) { adminAccess = { isSuperuser: false, sections: [] }; return adminAccess; }
        var j = await res.json();
        adminAccess = {
          isSuperuser: !!j.isSuperuser,
          sections: Array.isArray(j.sections) ? j.sections : [],
        };
      } catch (e) {
        adminAccess = { isSuperuser: false, sections: [] };
      }
      return adminAccess;
    }
```

- [ ] **Step 3: Build check** — Run (K root): `npx astro build` → succeeds (helpers are dead code until B2; confirms no syntax error).

- [ ] **Step 4: Commit**
```bash
cd /home/luca-canepa/Desktop/Github/kscw-website
git add src/pages/admin.astro
git commit -m "feat(admin): wadmin() fetch helper + /me access loader

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task B2: `/me`-driven tabs + empty state (K)

**Files:**
- Modify: `src/pages/admin.astro` (tab bar 641-646; render entrypoint after `isAuthorized`; tab-click handler ~667)

- [ ] **Step 1: Load access before the admin UI renders**

In the render path entered after `isAuthorized()` is true (the function emitting the `<div class="admin-tabs">` markup), add `await loadAccess();` as its first statement, before any markup is built.

- [ ] **Step 2: Empty-state early exit (gated, no sections) — safe DOM**

Immediately after the `await loadAccess();` line, before any tab markup:
```js
          if (!adminAccess.isSuperuser && adminAccess.sections.length === 0) {
            var shell = document.createElement('div');
            shell.className = 'admin-shell';
            var empty = document.createElement('div');
            empty.className = 'admin-empty';
            empty.textContent = 'No sections assigned — ask a superuser to grant access.';
            shell.appendChild(empty);
            app.replaceChildren(shell);
            return;
          }
```

- [ ] **Step 3: Replace the hardcoded tab bar with a generated one**

Just before the `'<div class="admin-tabs">' +` line, add:
```js
          var TAB_LABELS = {
            news: 'News', events: 'Events',
            registrations: t('registrations'), sponsors: t('sponsors'),
            scorer_courses: t('scorerCourses'), mixed_turnier: t('mixedTurnier'),
          };
          var visibleSections = SECTION_ORDER.filter(function(s) {
            return adminAccess.isSuperuser || adminAccess.sections.indexOf(s) !== -1;
          });
          if (visibleSections.indexOf(currentTab) === -1) {
            currentTab = visibleSections.length ? visibleSections[0] : '';
          }
          var tabsHtml = visibleSections.map(function(s) {
            return '<button class="admin-tab' + (currentTab === s ? ' active' : '') +
              '" data-tab="' + s + '">' + escapeHtml(TAB_LABELS[s]) + '</button>';
          }).join('');
```
Replace lines 641–646 (the six literal `<button>` strings) so the markup interpolates `tabsHtml`, and append the manager-only Admin tab:
```js
          '<div class="admin-tabs">' + tabsHtml +
          (adminAccess.isSuperuser ? '<button class="admin-tab' + (currentTab === 'admin' ? ' active' : '') + '" data-tab="admin">Admin</button>' : '') +
```
(The `'</div>'` that previously followed line 646 stays. `TAB_LABELS` values are static i18n strings, passed through `escapeHtml` for consistency with the file's existing escaped-string tab markup.)

- [ ] **Step 4: Build check** — `npx astro build` → succeeds.

- [ ] **Step 5: Commit**
```bash
cd /home/luca-canepa/Desktop/Github/kscw-website
git add src/pages/admin.astro
git commit -m "feat(admin): render tabs from /kscw/wadmin/me + empty state

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task B3: Route section data calls through `wadmin()` (K)

Swap each section's Directus call to the gated endpoint. **Leave direct:** teams (304), users (313), `/users/me` (324), `/files` (1384, 1389, 1413, 1424, 2392), `/assets/*` image `src` and view links.

Mapping (section → call sites; line numbers are pre-edit anchors — re-grep before each):
- **registrations** → `'registrations'` : 696–699, 1342, 1370, 1378, 1394, 1429
- **mixed_turnier** → `'mixed_turnier'` : 720, 723, 726
- **sponsors** → `'sponsors'` : 749, 1777
- **scorer_courses** → `'scorer_courses'` : 769, 1911, 2210, 2332
- **news/events** → `currentTab` (`'news'`|`'events'`) : 786–790, 871, 885, 2497–2501

- [ ] **Step 1: Convert item-collection calls**

Rewrite each `fetch(DIRECTUS_URL + '/items/<collection>' + rest, opts)` → `wadmin('<section>', 'items/<collection>' + rest, opts)`; drop the now-duplicated `Authorization` header (wadmin injects it); keep `method`/`body`/`Content-Type`. Examples:

registrations list (696–699): `var url = DIRECTUS_URL + '/items/registrations'` … `fetch(url, {headers:{Authorization…}})` →
```js
          return wadmin('registrations', 'items/registrations', {});
```
registrations by-id patch (e.g. 1370) →
```js
      var res = await wadmin('registrations', 'items/registrations/' + id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
```
news/events generic list (786–790): `'/items/' + collection + '?sort=' + sort + '&limit=50'` →
```js
        return wadmin(currentTab, 'items/' + collection + '?sort=' + sort + '&limit=50', {});
```
news/events by-id (871, 885) and create/update (2497–2501): section = `currentTab`, subpath `items/<collection>[/<id>]`, keep method/body, drop Authorization.

- [ ] **Step 2: Convert scorer-course OpnForm calls**

2210 →
```js
                return wadmin('scorer_courses', 'opnform/forms/' + encodeURIComponent(src.slug) + '/submissions?per_page=100', {});
```
2332 →
```js
                return wadmin('scorer_courses', 'opnform/forms/' + encodeURIComponent(row.slug) + '/submissions/' + encodeURIComponent(row.id), { method: 'DELETE' });
```

- [ ] **Step 3: Confirm no section path still hits Directus directly**

Run (K root): `grep -n "DIRECTUS_URL + '/items/" src/pages/admin.astro`
Expected: **no matches**.
Run: `grep -n "DIRECTUS_URL + '/kscw/opnform" src/pages/admin.astro`
Expected: **no matches** (all moved to `wadmin('scorer_courses', 'opnform/...')`).
Run: `grep -n "/files\|/users/me\|/items/teams\|DIRECTUS_URL + '/users?\|/assets/" src/pages/admin.astro`
Expected: still present (intentionally direct).

- [ ] **Step 4: Build check** — `npx astro build` → succeeds.

- [ ] **Step 5: Commit**
```bash
cd /home/luca-canepa/Desktop/Github/kscw-website
git add src/pages/admin.astro
git commit -m "feat(admin): route all section data through /kscw/wadmin

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task B4: Manager-only Admin grant grid (K) — safe DOM

**Files:**
- Modify: `src/pages/admin.astro` (new `admin` tab body branch; grid binder helpers)

- [ ] **Step 1: Render the grid (createElement/textContent — no innerHTML)**

In the section-body render (the `if (currentTab === 'registrations')` … chain), add a branch:
```js
      if (currentTab === 'admin' && adminAccess.isSuperuser) {
        var host = document.getElementById('admin-section-body') || app;
        host.replaceChildren();
        var loading = document.createElement('div');
        loading.className = 'admin-grid-loading';
        loading.textContent = 'Loading…';
        host.appendChild(loading);
        getValidToken().then(function(token) {
          return fetch(DIRECTUS_URL + '/kscw/wadmin/admins', {
            headers: { 'Authorization': 'Bearer ' + token },
          });
        }).then(function(r) { return r.ok ? r.json() : { data: [] }; }).then(function(j) {
          var rows = (j && j.data) || [];
          host.replaceChildren();
          if (!rows.length) {
            var em = document.createElement('div');
            em.className = 'admin-empty';
            em.textContent = 'No Website Admin users yet. (Users gain this role in the Phase C migration.)';
            host.appendChild(em);
            return;
          }
          var table = document.createElement('table');
          table.className = 'admin-grant-grid';
          var thead = document.createElement('tr');
          var th0 = document.createElement('th');
          th0.textContent = 'User';
          thead.appendChild(th0);
          SECTION_ORDER.forEach(function(s) {
            var th = document.createElement('th');
            th.textContent = s;
            thead.appendChild(th);
          });
          table.appendChild(thead);
          rows.forEach(function(u) {
            var tr = document.createElement('tr');
            var td0 = document.createElement('td');
            var nameDiv = document.createElement('div');
            nameDiv.textContent = u.name;
            var emailSmall = document.createElement('small');
            emailSmall.textContent = u.email;
            td0.appendChild(nameDiv);
            td0.appendChild(emailSmall);
            tr.appendChild(td0);
            SECTION_ORDER.forEach(function(s) {
              var td = document.createElement('td');
              var cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.checked = u.sections.indexOf(s) !== -1;
              cb.setAttribute('data-uid', u.id);
              cb.setAttribute('data-sec', s);
              td.appendChild(cb);
              tr.appendChild(td);
            });
            table.appendChild(tr);
          });
          var status = document.createElement('div');
          status.className = 'admin-grant-status';
          status.id = 'grant-status';
          host.appendChild(table);
          host.appendChild(status);
          bindGrantGrid(host, rows);
        });
        return;
      }
```

- [ ] **Step 2: Add the debounced PUT-on-toggle binder**

Near the other helpers:
```js
    function bindGrantGrid(host, rows) {
      var byId = {};
      rows.forEach(function(u) { byId[u.id] = u.sections.slice(); });
      var timers = {};
      host.addEventListener('change', function(e) {
        var cb = e.target;
        if (!cb || cb.type !== 'checkbox') return;
        var uid = cb.getAttribute('data-uid');
        var sec = cb.getAttribute('data-sec');
        var arr = byId[uid] || [];
        var i = arr.indexOf(sec);
        if (cb.checked && i === -1) arr.push(sec);
        if (!cb.checked && i !== -1) arr.splice(i, 1);
        byId[uid] = arr;
        clearTimeout(timers[uid]);
        timers[uid] = setTimeout(function() { saveGrant(uid, arr); }, 400);
      });
    }
    async function saveGrant(uid, sections) {
      var status = document.getElementById('grant-status');
      if (status) status.textContent = 'Saving…';
      try {
        var token = await getValidToken();
        var res = await fetch(DIRECTUS_URL + '/kscw/wadmin/admins/' + encodeURIComponent(uid), {
          method: 'PUT',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections: sections }),
        });
        if (status) status.textContent = res.ok ? 'Saved' : 'Save failed';
      } catch (e) {
        if (status) status.textContent = 'Save failed';
      }
    }
```

- [ ] **Step 3: Ensure the `admin` tab is clickable**

The B2 tab bar appends `data-tab="admin"` for managers. The existing tab-click handler (~667: `currentTab = this.getAttribute('data-tab');` then re-render) is generic — confirm it re-renders for `'admin'`. If it special-cases known tabs in a switch, add an `'admin'` case that calls the same re-render.

- [ ] **Step 4: Build check** — `npx astro build` → succeeds.

- [ ] **Step 5: Commit**
```bash
cd /home/luca-canepa/Desktop/Github/kscw-website
git add src/pages/admin.astro
git commit -m "feat(admin): manager-only section grant grid

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task B5: Deploy Phase B + end-to-end enforcement proof

**Files:** none (deploy + manual verification)

- [ ] **Step 1: Deploy**
> `[CLI]` K repo: `git push origin dev` (review), then when ready `git checkout prod && git merge --ff-only dev && git push origin prod && git checkout dev` (triggers Cloudflare Pages deploy).

- [ ] **Step 2: Manager smoke (browser)**

On `https://kscw-website.pages.dev/admin` as a current admin (manager):
1. Tab bar shows all six section tabs **plus** an `Admin` tab.
2. Every section tab still loads/saves exactly as before (news list, sponsor edit, scorer submissions, registrations, mixed turnier) — confirms the `wadmin()` swap is transparent for managers.
3. `Admin` tab shows "No Website Admin users yet."

- [ ] **Step 3: Enforcement proof with a throwaway user (no real migration)**

User actions in Directus **dev** admin UI: create temp user `wadmin-test@kscw.ch`. Assign a **non-`admin_access`** role — if `Website Admin` doesn't exist yet, create just the role with `admin_access:false` (no policy) for this test. With that user's token `$TT`:
```
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TT" https://directus-dev.kscw.ch/items/scorer_courses
```
Expected: **403** (no direct collection perm — real enforcement; a 200 means the test user still has an `admin_access` role — pick a non-admin role).
```
curl -s -H "Authorization: Bearer $TT" https://directus-dev.kscw.ch/kscw/wadmin/me
```
Expected: `{"isSuperuser":false,"sections":[]}`.
Grant `scorer_courses` to that user via the manager Admin grid, then:
```
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TT" https://directus-dev.kscw.ch/kscw/wadmin/scorer_courses/items/scorer_courses
```
Expected: **200**. Untick the grant → repeat → **403**. Delete the temp user (and the throwaway role if created).

- [ ] **Step 4: Gate Phase C** — A+B complete and proven. **Stop.** Phase C needs explicit user green-light + the who-list.

---

## Phase C — role migration (RUNBOOK; separate, requires green-light)

**Do not start without:** (1) explicit user instruction, and (2) the user's list of exactly which humans stay manager (`Superuser`/`Administrator`) vs. become `Website Admin`. Never inferred.

### C1: Add `Website Admin` role + policy to `setup-permissions.mjs` (W)

In `directus/scripts/setup-permissions.mjs`:
- Add to `ROLE_DEFS` (after the `Member` entry):
```js
  { name: 'Website Admin', icon: 'web', description: 'kscw-website /admin — section access via /kscw/wadmin only' },
```
- In `main()`, after the other `findOrCreatePolicy` calls (~line 339):
```js
  const WEBSITE_ADMIN_POLICY = await findOrCreatePolicy('KSCW Website Admin', {
    icon: 'web', admin_access: false, app_access: true,
  })
```
- Attach near the other `attachPolicyToRole` calls (~line 363):
```js
  await attachPolicyToRole(roleMap['Website Admin'], WEBSITE_ADMIN_POLICY)
```
- In the per-policy permission section (mirror the `clearPolicyPermissions` pattern other policies use):
```js
  await clearPolicyPermissions(WEBSITE_ADMIN_POLICY, 'Website Admin')
  // No content-collection perms — all six go through /kscw/wadmin.
  // Flat file create+read so direct admin.astro uploads keep working.
  await setPerm(WEBSITE_ADMIN_POLICY, 'directus_files', 'create')
  await setPermRead(WEBSITE_ADMIN_POLICY, 'directus_files')
```
Apply (USER-RUN `[CLI]`): `npm run db:setup-perms:dev` then `:prod`.

### C2: Pre-seed grants, then migrate users (USER-RUN)

For each human becoming `Website Admin`: **first** set their grants via the manager Admin grid, **then** change their Directus role to `Website Admin`. Order matters — grants before the role flip so they never see an empty admin mid-UAT.

### C3: Acceptance (USER-RUN, dev then prod)

Migrated `Website Admin` user token `$WA`:
```
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $WA" https://directus.kscw.ch/items/scorer_courses          # expect 403
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $WA" https://directus.kscw.ch/kscw/wadmin/scorer_courses/items/scorer_courses  # expect 200 if granted, 403 if not
```
Confirm the user can still log into `/admin` and operate exactly their granted sections, and uploads still work.

### Rollback
- C: reassign migrated users to their prior role (policy inert unused). A: `DROP TABLE website_admin_access` + revert extension commits + redeploy. B: revert the `admin.astro` commits (managers were never gated).

---

## Completion (per project `CLAUDE.md`)

**Minor** version bump (new feature). On completion: CHANGELOG.md entry, bump `package.json`, update changelog sections on `/de/club/feedback` and `/en/club/feedback`. Ask the user before doing so (project convention).

> Separately still pending from the prior UAT session (unrelated): the `3.6.1` patch entry for the already-deployed calendar-link / admin-date / TSV-export fixes — confirm with the user whether that is folded in or kept distinct.
