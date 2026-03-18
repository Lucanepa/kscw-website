# QR-Based External User Invite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coaches add external players/guests to a team via QR code scan, creating shell accounts that bypass the signup+approval flow.

**Architecture:** New `team_invites` PocketBase collection + `shell`/`shell_expires`/`shell_reminder_sent` fields on `members`. PB hooks handle API endpoints (create, claim, extend) and cron jobs (expiry, reminders, invite cleanup). Frontend adds an invite modal in RosterEditor, a public `/join/:token` page, and shell member indicators in the roster.

**Tech Stack:** React 19 + TypeScript + Vite + TailwindCSS + shadcn/ui + PocketBase (hooks in ES5/goja JS) + Playwright (e2e)

**Spec:** `docs/superpowers/specs/2026-03-18-qr-external-user-invite-design.md`

**Target repo:** `/home/luca-canepa/Desktop/Github/wiedisync`

**IMPORTANT — PB Hook Syntax:** PocketBase uses the goja JS engine which only supports ES5. All PB hooks MUST use `var` (not const/let), `function(){}` (not arrow functions), string concatenation (not template literals), and NO optional chaining, destructuring, or `for...of`. Follow patterns from existing hooks like `contact_form_api.pb.js` and `participation_priority.pb.js`.

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `pb_hooks/shell_invite_api.pb.js` | API endpoints: create invite, claim invite, extend shell, get invite info |
| `pb_hooks/shell_crons.pb.js` | Cron jobs: shell expiry, reminder, invite cleanup |
| `pb_hooks/shell_password.pb.js` | Hook: flip `shell` to false on password change |
| `src/modules/teams/InviteExternalUserModal.tsx` | Modal: role picker + QR code display |
| `src/modules/auth/JoinPage.tsx` | Public page: `/join/:token` claim form |
| `src/i18n/locales/de/join.ts` | German translations for join namespace |
| `src/i18n/locales/en/join.ts` | English translations for join namespace |
| `e2e/tests/public/join-invite.spec.ts` | E2E tests for the invite/claim flow |

### Modified Files

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `TeamInvite` type, `shell`/`shell_expires`/`shell_reminder_sent` to `Member` |
| `src/modules/teams/RosterEditor.tsx` | Add "Add External User" button + modal trigger |
| `src/modules/teams/MemberRow.tsx` | Shell member indicator (yellow accent, expiry countdown, extend button) |
| `src/App.tsx` | Add `/join/:token` route |
| `src/modules/games/components/GameDetailModal.tsx` | Disable game participation for guests |
| `pb_hooks/participation_priority.pb.js` | Server-side guest game restriction |
| `src/i18n/locales/de/teams.ts` | New keys for invite/shell UI |
| `src/i18n/locales/en/teams.ts` | New keys for invite/shell UI |
| `src/i18n/locales/de/games.ts` | Guest restriction message |
| `src/i18n/locales/en/games.ts` | Guest restriction message |
| `src/i18n/index.ts` | Register `join` namespace |

---

## Task 1: Type Definitions

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add TeamInvite type and update Member type**

In `src/types/index.ts`, add the `TeamInvite` interface after the `MemberTeam` interface (~line 70):

```typescript
export interface TeamInvite extends RecordModel {
  token: string
  team: string
  invited_by: string
  guest_level: number // 0=player, 1-3=guest
  status: 'pending' | 'claimed' | 'expired'
  claimed_by: string
  expires_at: string
}
```

Add fields to the `Member` interface (~line 40-62):

```typescript
  shell: boolean
  shell_expires: string
  shell_reminder_sent: boolean
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add TeamInvite type and shell fields to Member"
```

---

## Task 2: PocketBase Collection Setup

**Files:**
- The `team_invites` collection is created via PocketBase admin UI

- [ ] **Step 1: Create collection in PocketBase admin**

Open PocketBase admin at the URL configured in `VITE_PB_URL` (check `.env` or `.env.local`). Create the `team_invites` collection with these fields:

| Field | Type | Options |
|-------|------|---------|
| `token` | text | required, unique |
| `team` | relation → teams | required |
| `invited_by` | relation → members | required |
| `guest_level` | number | required, min: 0, max: 3 |
| `status` | select | required, values: pending/claimed/expired |
| `claimed_by` | relation → members | optional |
| `expires_at` | datetime | required |

Add indexes:
- `idx_token` on `token` (unique — auto from constraint)
- `idx_team_status` on `team, status`
- `idx_status_expires` on `status, expires_at`

- [ ] **Step 2: Add fields to existing `members` collection**

In PocketBase admin, add to the `members` collection:
- `shell` — boolean, default: false
- `shell_expires` — datetime, optional
- `shell_reminder_sent` — boolean, default: false

Add index:
- `idx_shell_expiry` on `shell, shell_expires, member_active`

- [ ] **Step 3: Verify**

Confirm `team_invites` collection is visible with all fields. Confirm `members` has the three new fields.

---

## Task 3: Invite API Endpoints (PocketBase Hook)

**Files:**
- Create: `pb_hooks/shell_invite_api.pb.js`

**Reference files to read first:**
- `pb_hooks/team_permissions_lib.js` — for `arrayContains()`, `getAuth()`, `getRoles()` helpers
- `pb_hooks/contact_form_api.pb.js` — for `routerAdd` pattern and `$apis.requestInfo(e).body`
- `pb_hooks/notifications_lib.js` — for `getCurrentSeason()` helper

- [ ] **Step 1: Write the complete hook file**

```javascript
// pb_hooks/shell_invite_api.pb.js
// API endpoints for QR-based external user invite system

/// <reference path="../pb_data/types.d.ts" />

var permLib = require(__hooks + "/team_permissions_lib.js")

// Helper: get current season string (e.g., "2025/26")
// Matches pattern from notifications_lib.js
function getCurrentSeason() {
  var now = new Date()
  var year = now.getFullYear()
  var month = now.getMonth() // 0-indexed
  if (month < 7) year-- // before August → previous year's season
  var nextYear = (year + 1) % 100
  return year + "/" + (nextYear < 10 ? "0" + nextYear : nextYear)
}

// Helper: check if user is coach/team_responsible/admin for a team
function hasInvitePermission(auth, team) {
  var authId = auth.id
  var roles = auth.get("role") || []
  var sport = team.getString("sport")

  // Superuser can do anything
  if (permLib.arrayContains(roles, "superuser")) return true

  // Sport admin
  if (sport === "volleyball" && permLib.arrayContains(roles, "vb_admin")) return true
  if (sport === "basketball" && permLib.arrayContains(roles, "bb_admin")) return true

  // Coach or team_responsible
  var coaches = team.get("coach") || []
  var teamResp = team.get("team_responsible") || []
  if (permLib.arrayContains(coaches, authId)) return true
  if (permLib.arrayContains(teamResp, authId)) return true

  return false
}

// ── POST /api/team-invites/create ──────────────────────────────────
// Auth: coach, team_responsible, or sport admin
// Body: { team, guest_level }
// Returns: { token, qr_url, expires_at }
routerAdd("POST", "/api/team-invites/create", function(e) {
  var auth = e.requestInfo().auth
  if (!auth) {
    throw new ForbiddenError("Authentication required.")
  }

  var body = $apis.requestInfo(e).body
  var teamId = (body.team || "").trim()
  var guestLevel = parseInt(body.guest_level || "0", 10)

  if (!teamId) {
    throw new BadRequestError("team is required")
  }
  if (isNaN(guestLevel) || guestLevel < 0 || guestLevel > 3) {
    throw new BadRequestError("guest_level must be 0, 1, 2, or 3")
  }

  var team = $app.findRecordById("teams", teamId)

  if (!hasInvitePermission(auth, team)) {
    throw new ForbiddenError("Not authorized to create invites for this team")
  }

  // Check max pending invites per team (20)
  var pending = []
  try {
    pending = $app.findRecordsByFilter(
      "team_invites",
      'team = "' + teamId + '" && status = "pending"',
      "", 21, 0
    )
  } catch(err) {
    pending = []
  }
  if (pending.length >= 20) {
    throw new BadRequestError("Maximum pending invites (20) reached for this team")
  }

  // Generate crypto-random token (32 chars, URL-safe)
  var token = $security.randomStringWithAlphabet(
    32,
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  )

  // Create invite record
  var collection = $app.findCollectionByNameOrId("team_invites")
  var record = new Record(collection)
  record.set("token", token)
  record.set("team", teamId)
  record.set("invited_by", auth.id)
  record.set("guest_level", guestLevel)
  record.set("status", "pending")
  record.set("expires_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())

  $app.save(record)

  var appUrl = $app.settings().meta.appURL || "https://wiedisync.kscw.ch"
  var qrUrl = appUrl + "/join/" + token

  return e.json(200, {
    token: token,
    qr_url: qrUrl,
    expires_at: record.getString("expires_at")
  })
})

// ── POST /api/team-invites/claim ──────────────────────────────────
// Auth: None (public)
// Body: { token, first_name, last_name, email }
// Creates shell member + member_teams record
routerAdd("POST", "/api/team-invites/claim", function(e) {
  var body = $apis.requestInfo(e).body
  var token = (body.token || "").trim()
  var firstName = (body.first_name || "").trim()
  var lastName = (body.last_name || "").trim()
  var email = (body.email || "").trim().toLowerCase()

  if (!token || !firstName || !lastName || !email) {
    throw new BadRequestError("token, first_name, last_name, and email are all required")
  }

  // Validate email format
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new BadRequestError("Invalid email format")
  }

  // Find invite
  var invite
  try {
    invite = $app.findFirstRecordByFilter(
      "team_invites",
      'token = "' + token + '"'
    )
  } catch(err) {
    throw new NotFoundError("Invalid invite link")
  }

  // Check invite status
  if (invite.getString("status") === "claimed") {
    throw new BadRequestError("This invite has already been used")
  }
  if (invite.getString("status") === "expired" || new Date(invite.getString("expires_at")) < new Date()) {
    throw new BadRequestError("This invite has expired. Ask your coach for a new one.")
  }

  // Check email uniqueness
  var existingMember = null
  try {
    existingMember = $app.findFirstRecordByFilter("members", 'email = "' + email + '"')
  } catch(err) {
    // Not found — good
  }
  if (existingMember) {
    throw new BadRequestError("This email is already registered. Please log in instead.")
  }

  // Check max shell members per team (10)
  var teamId = invite.getString("team")
  var currentSeason = getCurrentSeason()

  var teamMembers = []
  try {
    teamMembers = $app.findRecordsByFilter(
      "member_teams",
      'team = "' + teamId + '" && season = "' + currentSeason + '"',
      "", 200, 0
    )
  } catch(err) {
    teamMembers = []
  }

  var shellCount = 0
  for (var i = 0; i < teamMembers.length; i++) {
    try {
      var m = $app.findRecordById("members", teamMembers[i].getString("member"))
      if (m.getBool("shell")) shellCount++
    } catch(err) {
      // skip
    }
  }

  if (shellCount >= 10) {
    throw new BadRequestError("Maximum shell members (10) reached for this team")
  }

  // Create shell member
  var membersCollection = $app.findCollectionByNameOrId("members")
  var member = new Record(membersCollection)
  member.set("email", email)
  member.set("first_name", firstName)
  member.set("last_name", lastName)
  member.set("shell", true)
  member.set("shell_expires", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
  member.set("shell_reminder_sent", false)
  member.set("approved", true)
  member.set("member_active", true)
  member.set("active", true)
  member.set("role", ["user"])
  // Set a random password (they'll reset it via email)
  member.setPassword($security.randomString(32))

  $app.save(member)

  // Create member_teams record
  var mtCollection = $app.findCollectionByNameOrId("member_teams")
  var mt = new Record(mtCollection)
  mt.set("member", member.id)
  mt.set("team", teamId)
  mt.set("season", currentSeason)
  mt.set("guest_level", invite.get("guest_level"))

  $app.save(mt)

  // Mark invite as claimed
  invite.set("status", "claimed")
  invite.set("claimed_by", member.id)
  $app.save(invite)

  // Get team name for response
  var team = $app.findRecordById("teams", teamId)
  var teamName = team.getString("full_name") || team.getString("name")

  // Return success — password reset email is triggered from the frontend
  // after a successful claim (using pb.collection('members').requestPasswordReset(email))
  return e.json(200, {
    success: true,
    member_id: member.id,
    team_name: teamName,
    email: email
  })
})

// ── POST /api/team-invites/extend ──────────────────────────────────
// Auth: coach or team_responsible
// Body: { member_id }
// Resets shell_expires to now + 30 days
routerAdd("POST", "/api/team-invites/extend", function(e) {
  var auth = e.requestInfo().auth
  if (!auth) {
    throw new ForbiddenError("Authentication required.")
  }

  var body = $apis.requestInfo(e).body
  var memberId = (body.member_id || "").trim()

  if (!memberId) {
    throw new BadRequestError("member_id is required")
  }

  var member = $app.findRecordById("members", memberId)
  if (!member.getBool("shell")) {
    throw new BadRequestError("This member is not a shell account")
  }

  // Find which team this shell member belongs to (via member_teams)
  var currentSeason = getCurrentSeason()
  var mt = $app.findFirstRecordByFilter(
    "member_teams",
    'member = "' + memberId + '" && season = "' + currentSeason + '"'
  )
  var teamId = mt.getString("team")

  // Check permissions
  var team = $app.findRecordById("teams", teamId)
  if (!hasInvitePermission(auth, team)) {
    throw new ForbiddenError("Not authorized to extend shell accounts for this team")
  }

  // Reset 30-day timer
  member.set("shell_expires", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
  member.set("member_active", true) // reactivate if expired
  member.set("shell_reminder_sent", false) // reset reminder flag
  $app.save(member)

  return e.json(200, {
    success: true,
    shell_expires: member.getString("shell_expires")
  })
})

// ── GET /api/team-invites/info/{token} ─────────────────────────────
// Auth: None (public)
// Returns invite details for the join page
routerAdd("GET", "/api/team-invites/info/{token}", function(e) {
  var token = e.request.pathValue("token")

  var invite
  try {
    invite = $app.findFirstRecordByFilter(
      "team_invites",
      'token = "' + token + '"'
    )
  } catch(err) {
    throw new NotFoundError("Invalid invite link")
  }

  if (invite.getString("status") === "claimed") {
    throw new BadRequestError("This invite has already been used")
  }
  if (invite.getString("status") === "expired" || new Date(invite.getString("expires_at")) < new Date()) {
    throw new BadRequestError("This invite has expired. Ask your coach for a new one.")
  }

  var team = $app.findRecordById("teams", invite.getString("team"))

  return e.json(200, {
    team_name: team.getString("full_name") || team.getString("name"),
    sport: team.getString("sport"),
    guest_level: invite.get("guest_level"),
    expires_at: invite.getString("expires_at")
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add pb_hooks/shell_invite_api.pb.js
git commit -m "feat(api): add invite create/claim/extend/info endpoints"
```

---

## Task 4: Shell Cron Jobs

**Files:**
- Create: `pb_hooks/shell_crons.pb.js`

- [ ] **Step 1: Write the cron hooks**

```javascript
// pb_hooks/shell_crons.pb.js
// Cron jobs for shell account lifecycle management

/// <reference path="../pb_data/types.d.ts" />

// ── Shell Expiry Check — daily at 02:00 UTC ────────────────────────
// Deactivates shell accounts past their expiry date
cronAdd("shell_expiry", "0 2 * * *", function() {
  var now = new Date().toISOString()

  var expired = []
  try {
    expired = $app.findRecordsByFilter(
      "members",
      "shell = true && member_active = true && shell_expires != '' && shell_expires <= '" + now + "'",
      "-shell_expires",
      500, 0
    )
  } catch(err) {
    expired = []
  }

  for (var i = 0; i < expired.length; i++) {
    expired[i].set("member_active", false)
    $app.save(expired[i])
  }

  if (expired.length > 0) {
    console.log("[shell_expiry] Deactivated " + expired.length + " expired shell accounts")
  }
})

// ── Shell Reminder — daily at 09:00 UTC ────────────────────────────
// Sends reminder to shell accounts within 10 days of expiry.
// Uses shell_reminder_sent flag for idempotency — a missed cron run
// won't cause reminders to be permanently lost, and a successful
// send won't produce duplicates.
cronAdd("shell_reminder", "0 9 * * *", function() {
  var tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()

  var expiringSoon = []
  try {
    expiringSoon = $app.findRecordsByFilter(
      "members",
      "shell = true && member_active = true && shell_reminder_sent = false && shell_expires != '' && shell_expires <= '" + tenDaysFromNow + "'",
      "-shell_expires",
      500, 0
    )
  } catch(err) {
    expiringSoon = []
  }

  for (var i = 0; i < expiringSoon.length; i++) {
    var member = expiringSoon[i]
    try {
      // Use PB's built-in password reset email as the reminder
      // This sends a link they can use to set a password and convert to full member
      var message = new MailerMessage()
      message.from = { address: $app.settings().meta.senderAddress, name: $app.settings().meta.senderName }
      message.to = [{ address: member.getString("email") }]
      message.subject = "Your KSC Wiedikon access expires soon"
      message.html = "<p>Your temporary access to KSC Wiedikon expires in less than 10 days.</p>" +
        "<p>To keep your account, please set a password by clicking the link in your original welcome email, " +
        "or ask your coach for a new invite.</p>"
      $app.newMailClient().send(message)

      member.set("shell_reminder_sent", true)
      $app.save(member)
    } catch(err) {
      console.log("[shell_reminder] Failed to send reminder to " + member.getString("email") + ": " + err)
      // Leave shell_reminder_sent = false for retry on next run
    }
  }

  if (expiringSoon.length > 0) {
    console.log("[shell_reminder] Processed " + expiringSoon.length + " reminders")
  }
})

// ── Invite Expiry Cleanup — daily at 03:00 UTC ────────────────────
// Marks expired pending invites
cronAdd("invite_expiry", "0 3 * * *", function() {
  var now = new Date().toISOString()

  var expired = []
  try {
    expired = $app.findRecordsByFilter(
      "team_invites",
      "status = 'pending' && expires_at <= '" + now + "'",
      "-expires_at",
      500, 0
    )
  } catch(err) {
    expired = []
  }

  for (var i = 0; i < expired.length; i++) {
    expired[i].set("status", "expired")
    $app.save(expired[i])
  }

  if (expired.length > 0) {
    console.log("[invite_expiry] Expired " + expired.length + " invites")
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add pb_hooks/shell_crons.pb.js
git commit -m "feat(crons): add shell expiry, reminder, and invite cleanup cron jobs"
```

---

## Task 5: Shell Password Hook

**Files:**
- Create: `pb_hooks/shell_password.pb.js`

**Reference:** `pb_hooks/member_active.pb.js` — for hook registration pattern with `e.record`, `e.app.save()`

- [ ] **Step 1: Write the password change hook**

```javascript
// pb_hooks/shell_password.pb.js
// Flips shell=false when a shell member sets their password
// (password reset changes tokenKey — we detect that)

/// <reference path="../pb_data/types.d.ts" />

onRecordAfterUpdateSuccess("members", function(e) {
  var record = e.record
  var original = record.original()

  // Only care about shell accounts
  if (!original.getBool("shell")) {
    return
  }

  // Check if password was changed (tokenKey changes on password update)
  if (record.getString("tokenKey") !== original.getString("tokenKey")) {
    // Only convert to full member if account is still active
    if (record.getBool("member_active")) {
      record.set("shell", false)
      record.set("shell_expires", "")
      record.set("shell_reminder_sent", false)
      e.app.save(record)
      console.log("[shell_password] Shell account " + record.getString("email") + " converted to full member")
    }
    // If member_active is false (expired), password is set but account stays inactive.
    // Coach must extend or re-invite.
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add pb_hooks/shell_password.pb.js
git commit -m "feat(hooks): convert shell to full member on password set"
```

---

## Task 6: Guest Game Restriction (Server-side)

**Files:**
- Modify: `pb_hooks/participation_priority.pb.js`

**Reference:** Read `pb_hooks/participation_priority.pb.js` and `pb_hooks/participation_priority_lib.js` first to understand the existing hook pattern and `getGuestLevel()` helper.

- [ ] **Step 1: Read current participation hooks**

Read both files to understand where to add the new hook.

- [ ] **Step 2: Add guest game restriction**

At the TOP of `pb_hooks/participation_priority.pb.js` (before the existing `onRecordAfterCreateSuccess` hook), add:

```javascript
// ── Block guests from game participation ────────────────────────────
// Platform-wide rule: guests (any level > 0) cannot participate in games.
// Also blocks scorer duty assignment for guests.
onRecordBeforeCreateRequest("participations", function(e) {
  var record = e.record
  var activityType = record.getString("activity_type")
  var status = record.getString("status")

  // Only block game confirmations
  if (activityType !== "game") {
    return
  }
  if (status !== "confirmed" && status !== "tentative") {
    return
  }

  var memberId = record.getString("member")
  var activityId = record.getString("activity_id")

  // Find the game to get the team
  var game = $app.findRecordById("games", activityId)
  var teamId = game.getString("kscw_team")

  // Check guest level using existing helper
  var lib = require(__hooks + "/participation_priority_lib.js")
  var guestLevel = lib.getGuestLevel(memberId, teamId)

  if (guestLevel > 0) {
    throw new BadRequestError("Guests cannot participate in games")
  }
})
```

- [ ] **Step 3: Commit**

```bash
git add pb_hooks/participation_priority.pb.js
git commit -m "feat(hooks): block guests from game participation (server-side)"
```

---

## Task 7: Guest Game Restriction (Frontend)

**Files:**
- Modify: `src/modules/games/components/GameDetailModal.tsx`

- [ ] **Step 1: Read GameDetailModal.tsx**

Read the file to find where participation buttons are rendered (~lines 145-262) and the existing `canParticipateIn` check (~line 70). Also note how `useAuth` is imported — the hook provides `isGuestIn(teamId)` which returns `true` if `getGuestLevel(teamId) > 0`.

- [ ] **Step 2: Add guest check to game participation UI**

In `GameDetailModal.tsx`, destructure `isGuestIn` from the existing `useAuth()` call. Then wrap the participation buttons:

```typescript
// Add isGuestIn to the existing useAuth destructure:
const { user, isCoachOf, canParticipateIn, isGuestIn } = useAuth()

// ...

// In the JSX, where participation buttons are rendered, wrap them:
{isGuestIn(game.kscw_team) ? (
  <p className="text-sm text-muted-foreground py-4 text-center">
    {t('games:guestsCannotParticipate')}
  </p>
) : (
  // existing participation buttons JSX
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/games/components/GameDetailModal.tsx
git commit -m "feat(games): show guest restriction message instead of participation buttons"
```

---

## Task 8: Invite External User Modal

**Files:**
- Create: `src/modules/teams/InviteExternalUserModal.tsx`

- [ ] **Step 1: Install QR code library**

```bash
npm install qrcode.react
```

- [ ] **Step 2: Write the modal component**

Note: PocketBase is imported as `import pb from '../../pb'` (or equivalent relative path). Check existing imports in `RosterEditor.tsx` for the exact relative path from `src/modules/teams/`.

```typescript
// src/modules/teams/InviteExternalUserModal.tsx
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import { Button } from '../../components/ui/button'
import pb from '../../pb'

interface Props {
  open: boolean
  onClose: () => void
  teamId: string
  teamName: string
}

const GUEST_LEVELS = [
  { value: 0, labelKey: 'teams:player' },
  { value: 1, labelKey: 'teams:guestL1' },
  { value: 2, labelKey: 'teams:guestL2' },
  { value: 3, labelKey: 'teams:guestL3' },
] as const

export default function InviteExternalUserModal({ open, onClose, teamId, teamName }: Props) {
  const { t } = useTranslation(['teams', 'common'])
  const [guestLevel, setGuestLevel] = useState<number>(0)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await pb.send('/api/team-invites/create', {
        method: 'POST',
        body: { team: teamId, guest_level: guestLevel },
      })
      setQrUrl(res.qr_url)
    } catch (err: any) {
      setError(err.message || t('common:error'))
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!qrUrl) return
    await navigator.clipboard.writeText(qrUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setQrUrl(null)
    setGuestLevel(0)
    setError(null)
    setCopied(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('teams:inviteExternalUser')}>
      <p className="text-sm text-muted-foreground mb-4">
        {t('teams:inviteExternalUserDesc', { teamName })}
      </p>

      {!qrUrl ? (
        <>
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">
              {t('teams:joinAs')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {GUEST_LEVELS.map((gl) => (
                <Button
                  key={gl.value}
                  variant={guestLevel === gl.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGuestLevel(gl.value)}
                >
                  {gl.value === 0
                    ? t('teams:player')
                    : t('teams:guest') + ' L' + gl.value}
                </Button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive mb-4">{error}</p>}

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? t('common:loading') : t('teams:generateQR')}
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG value={qrUrl} size={200} />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {t('teams:inviteLinkExpiry')}
          </p>

          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              {t('common:close')}
            </Button>
            <Button variant="secondary" onClick={handleCopyLink} className="flex-1">
              {copied ? t('common:copied') : t('teams:copyLink')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/teams/InviteExternalUserModal.tsx package.json package-lock.json
git commit -m "feat(teams): add InviteExternalUserModal with QR code generation"
```

---

## Task 9: Add Button to RosterEditor

**Files:**
- Modify: `src/modules/teams/RosterEditor.tsx`

- [ ] **Step 1: Read RosterEditor.tsx**

Read the file, focusing on the toolbar/header area (~lines 487-525) and imports. Note how other components are imported (relative paths like `'./MemberRow'`).

- [ ] **Step 2: Add import and state**

At the top of the file, add:

```typescript
import InviteExternalUserModal from './InviteExternalUserModal'
```

Inside the component, add state:

```typescript
const [inviteModalOpen, setInviteModalOpen] = useState(false)
```

- [ ] **Step 3: Add button next to existing "Add member" section**

Near the "Add member" heading area (~line 487), add the button:

```typescript
<div className="flex items-center justify-between mb-4">
  <h2>{t('teams:addMember')}</h2>
  <Button
    variant="outline"
    size="sm"
    onClick={() => setInviteModalOpen(true)}
    className="border-kscw-accent text-kscw-accent hover:bg-kscw-accent/10"
  >
    {t('teams:addExternalUser')}
  </Button>
</div>
```

- [ ] **Step 4: Add modal at end of JSX**

Before the closing fragment/div of the component's return, add:

```typescript
<InviteExternalUserModal
  open={inviteModalOpen}
  onClose={() => setInviteModalOpen(false)}
  teamId={team.id}
  teamName={team.full_name || team.name}
/>
```

- [ ] **Step 5: Add extend handler for shell members**

Add a function to handle extending shell accounts (called from MemberRow):

```typescript
const handleExtendShell = async (memberId: string) => {
  try {
    await pb.send('/api/team-invites/extend', {
      method: 'POST',
      body: { member_id: memberId },
    })
    refetch() // re-fetch roster to update expiry display
  } catch (err: any) {
    console.error('Failed to extend shell account:', err)
  }
}
```

Pass `onExtendShell={handleExtendShell}` to MemberRow components.

- [ ] **Step 6: Commit**

```bash
git add src/modules/teams/RosterEditor.tsx
git commit -m "feat(teams): add 'Add External User' button and extend handler to RosterEditor"
```

---

## Task 10: Shell Member Indicators in MemberRow

**Files:**
- Modify: `src/modules/teams/MemberRow.tsx`

- [ ] **Step 1: Read MemberRow.tsx**

Read the file to understand the member display pattern (~lines 148-156 for guest badge), the component's props interface, and how `cn()` is used for class merging.

- [ ] **Step 2: Add props for shell functionality**

Add to the component's props:

```typescript
onExtendShell?: (memberId: string) => void
isEditing?: boolean
```

- [ ] **Step 3: Add shell indicator**

Near the existing guest level badge (around line 156), add a shell account indicator:

```typescript
{member.shell && (
  <div className="flex items-center gap-1 mt-0.5">
    <span className="text-xs text-kscw-accent">
      {t('teams:shellAccount')}
      {member.shell_expires && (
        <>
          {' · '}
          {t('teams:expiresIn', {
            days: Math.max(0, Math.ceil(
              (new Date(member.shell_expires).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            ))
          })}
        </>
      )}
    </span>
    {isEditing && onExtendShell && (
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-kscw-accent h-auto py-0 px-1"
        onClick={() => onExtendShell(member.id)}
      >
        {t('teams:extend')}
      </Button>
    )}
  </div>
)}
```

- [ ] **Step 4: Add yellow left border for shell members**

On the `<tr>` element, add conditional styling:

```typescript
<tr className={cn(
  // existing classes
  member.shell && 'border-l-2 border-l-kscw-accent bg-kscw-accent/5'
)}>
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/teams/MemberRow.tsx
git commit -m "feat(teams): add shell member indicators and extend button"
```

---

## Task 11: Public Join Page

**Files:**
- Create: `src/modules/auth/JoinPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the JoinPage component**

Note: Check `src/modules/auth/SignUpPage.tsx` for the exact relative import path to `pb` from the `auth` module.

```typescript
// src/modules/auth/JoinPage.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import pb from '../../pb'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'

interface InviteInfo {
  team_name: string
  sport: string
  guest_level: number
  expires_at: string
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation(['join', 'teams', 'auth', 'common'])
  const navigate = useNavigate()

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [teamName, setTeamName] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!token) return
    pb.send('/api/team-invites/info/' + token, { method: 'GET' })
      .then((data: InviteInfo) => {
        setInviteInfo(data)
        setTeamName(data.team_name)
      })
      .catch((err: any) => {
        setError(err.message || t('join:invalidLink'))
      })
      .finally(() => setLoading(false))
  }, [token, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await pb.send('/api/team-invites/claim', {
        method: 'POST',
        body: { token, first_name: firstName, last_name: lastName, email },
      })
      setTeamName(res.team_name)

      // Trigger password reset email from the frontend
      // This is the same pattern used in SignUpPage.tsx for unclaimed accounts
      try {
        await pb.collection('members').requestPasswordReset(res.email)
      } catch {
        // Non-critical — they can request it again later
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || t('common:error'))
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabel = inviteInfo
    ? inviteInfo.guest_level === 0
      ? t('teams:player')
      : t('teams:guest') + ' L' + inviteInfo.guest_level
    : ''

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t('common:loading')}</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-2xl font-bold">{t('join:success')}</h1>
          <p className="text-muted-foreground">
            {t('join:successDesc', { teamName })}
          </p>
          <Button onClick={() => navigate('/login')} variant="outline">
            {t('join:goToLogin')}
          </Button>
        </div>
      </div>
    )
  }

  if (error && !inviteInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-destructive">{t('join:error')}</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">
            {t('join:title', { teamName: inviteInfo?.team_name })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">KSC Wiedikon</p>
          <span className="inline-block mt-2 text-xs bg-primary text-primary-foreground px-3 py-1 rounded-full">
            {t('join:joiningAs', { role: roleLabel })}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t('auth:firstName')} *</label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('auth:lastName')} *</label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('auth:email')} *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? t('common:loading') : t('join:joinTeam')}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          {t('join:passwordLater')}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add route in App.tsx**

In `src/App.tsx`, add import and route in the standalone routes section (~lines 46-53, alongside `/login`, `/signup`, `/reset-password/:token`):

```typescript
import JoinPage from './modules/auth/JoinPage'
// ...
<Route path="join/:token" element={<JoinPage />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/JoinPage.tsx src/App.tsx
git commit -m "feat(auth): add public /join/:token page for QR invite claims"
```

---

## Task 12: Translation Keys

**Files:**
- Create: `src/i18n/locales/de/join.ts`
- Create: `src/i18n/locales/en/join.ts`
- Modify: `src/i18n/locales/de/teams.ts`
- Modify: `src/i18n/locales/en/teams.ts`
- Modify: `src/i18n/locales/de/games.ts`
- Modify: `src/i18n/locales/en/games.ts`
- Modify: `src/i18n/index.ts`

**Reference:** Check existing namespace files (e.g., `src/i18n/locales/de/common.ts`) for the export format: `export default { key: 'value' }`. Also check `src/i18n/locales/gsw/`, `fr/`, `it/` — you should add at minimum `de` and `en`, with fallback covering the others.

- [ ] **Step 1: Create join namespace files**

```typescript
// src/i18n/locales/de/join.ts
export default {
  title: '{{teamName}} beitreten',
  joiningAs: 'Beitreten als {{role}}',
  joinTeam: 'Team beitreten',
  success: 'Du bist dabei!',
  successDesc: 'Du bist {{teamName}} beigetreten. Prüfe deine E-Mails, um ein Passwort zu setzen und die Registrierung abzuschliessen.',
  goToLogin: 'Zum Login',
  passwordLater: 'Du erhältst eine E-Mail, um dein Passwort zu setzen',
  invalidLink: 'Dieser Einladungslink ist ungültig oder abgelaufen',
  error: 'Ungültige Einladung',
}
```

```typescript
// src/i18n/locales/en/join.ts
export default {
  title: 'Join {{teamName}}',
  joiningAs: 'Joining as {{role}}',
  joinTeam: 'Join Team',
  success: "You're in!",
  successDesc: "You've joined {{teamName}}. Check your email to set a password and complete your registration.",
  goToLogin: 'Go to Login',
  passwordLater: "You'll receive an email to set your password",
  invalidLink: 'This invite link is invalid or has expired',
  error: 'Invalid Invite',
}
```

- [ ] **Step 2: Add keys to existing teams namespace**

Add to `src/i18n/locales/de/teams.ts`:

```typescript
  inviteExternalUser: 'Externen Benutzer hinzufügen',
  inviteExternalUserDesc: 'QR-Code generieren, damit jemand {{teamName}} beitreten kann',
  joinAs: 'Beitreten als:',
  player: 'Spieler/in',
  guest: 'Gast',
  generateQR: 'QR-Code generieren',
  inviteLinkExpiry: 'Link läuft in 24 Stunden ab · Einmalig verwendbar',
  copyLink: 'Link kopieren',
  addExternalUser: 'Externen Benutzer hinzufügen',
  shellAccount: 'Temporär',
  expiresIn: 'läuft in {{days}}T ab',
  extend: 'Verlängern',
```

Add to `src/i18n/locales/en/teams.ts`:

```typescript
  inviteExternalUser: 'Add External User',
  inviteExternalUserDesc: 'Generate a QR code for someone to join {{teamName}}',
  joinAs: 'Join as:',
  player: 'Player',
  guest: 'Guest',
  generateQR: 'Generate QR Code',
  inviteLinkExpiry: 'Link expires in 24 hours · Single use',
  copyLink: 'Copy Link',
  addExternalUser: 'Add External User',
  shellAccount: 'Temporary',
  expiresIn: 'expires in {{days}}d',
  extend: 'Extend',
```

- [ ] **Step 3: Add guest restriction key to games namespace**

Add to `src/i18n/locales/de/games.ts`:

```typescript
  guestsCannotParticipate: 'Gäste können nicht an Spielen teilnehmen',
```

Add to `src/i18n/locales/en/games.ts`:

```typescript
  guestsCannotParticipate: 'Guests cannot participate in games',
```

- [ ] **Step 4: Register join namespace in i18n/index.ts**

In `src/i18n/index.ts`, import the new join namespace files and add them to the resources object:

```typescript
import deJoin from './locales/de/join'
import enJoin from './locales/en/join'

// In the resources object:
de: { /* existing namespaces */, join: deJoin },
en: { /* existing namespaces */, join: enJoin },
```

Also add `'join'` to the `ns` array if one exists in the init config.

- [ ] **Step 5: Add common:copied key if missing**

Check if `common:copied` exists in `src/i18n/locales/de/common.ts` and `en/common.ts`. If not, add:

```typescript
// de/common.ts
  copied: 'Kopiert!',

// en/common.ts
  copied: 'Copied!',
```

- [ ] **Step 6: Commit**

```bash
git add src/i18n/
git commit -m "feat(i18n): add translation keys for invite flow, shell accounts, and guest restriction"
```

---

## Task 13: E2E Test — Invite Flow

**Files:**
- Create: `e2e/tests/public/join-invite.spec.ts`

- [ ] **Step 1: Write the e2e test**

```typescript
// e2e/tests/public/join-invite.spec.ts
import { test, expect } from '@playwright/test'

test.describe('QR Invite Join Page', () => {
  test('shows error for invalid token', async ({ page }) => {
    await page.goto('/join/invalid-token-12345')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toContainText(/invalid|expired|ungültig|abgelaufen/i)
  })

  test('join page loads without crashing', async ({ page }) => {
    await page.goto('/join/test-token')
    await page.waitForLoadState('domcontentloaded')
    const body = page.locator('body')
    await expect(body).not.toContainText('Error boundary')
  })
})
```

- [ ] **Step 2: Run the test**

```bash
npx playwright test e2e/tests/public/join-invite.spec.ts --reporter=list
```

Expected: first test passes (invalid token shows error message), second passes (page renders without crashing).

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/public/join-invite.spec.ts
git commit -m "test(e2e): add basic invite join page tests"
```

---

## Execution Order

Tasks can be partially parallelized:

```
Task 1 (types) ─────────────────────┐
Task 2 (PB collection) ─────────────┤
                                     ├─→ Task 3 (API endpoints) ──→ Task 8 (Modal) ──→ Task 9 (RosterEditor)
Task 5 (password hook) ─────────────┤                               Task 11 (JoinPage + route)
Task 4 (cron jobs) ─────────────────┘                               Task 10 (MemberRow indicators)

Task 6 (server guest restriction) ──→ Task 7 (frontend guest restriction)

Task 12 (translations) — can run anytime, but best before Tasks 7-11

All tasks ──→ Task 13 (e2e tests)
```
