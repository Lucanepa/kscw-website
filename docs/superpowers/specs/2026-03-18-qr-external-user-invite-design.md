# QR-Based External User Invite

**Date:** 2026-03-18
**Status:** Draft
**Platform:** Wiedisync (KSCW main app)
**Repo:** github.com/Lucanepa/kscw
**Note:** This spec lives in kscw-website for convenience but describes a Wiedisync feature. Implementation happens in the `kscw` (Wiedisync) repo.

## Problem

Coaches need to quickly add players or guests to a team roster — people who don't have an account yet. The current flow requires the person to sign up, select a team, wait for coach approval, and only then appear on the roster. This is too slow for common scenarios like a friend filling in for one game or a guest joining for a training session.

## Solution

Coaches generate a single-use QR code from the Roster Editor. The person scans it, fills in a minimal form (name + email), and is instantly added to the roster as a **shell account** — a temporary member record that expires after 30 days unless extended or converted to a full account.

## Architecture: Hybrid Approach

New `team_invites` collection for QR token management. When claimed, creates a standard `Member` record with `shell: true` and a `member_teams` record — reusing existing roster and participation infrastructure.

## Data Model

### New Collection: `team_invites`

| Field | Type | Description |
|-------|------|-------------|
| `token` | text, unique, required | Crypto-random URL-safe string (32 chars) |
| `team` | relation → teams, required | Target team |
| `invited_by` | relation → members, required | Coach who created the invite |
| `guest_level` | number (0-3), required | 0 = player, 1-3 = guest level. Single source of truth for role. |
| `status` | select: "pending" \| "claimed" \| "expired" | Invite lifecycle state |
| `claimed_by` | relation → members, optional | Set when someone scans and submits |
| `expires_at` | datetime, required | QR link expiry (24h from creation) |

**Validation rules:**
- `guest_level` must be 0, 1, 2, or 3
- `guest_level = 0` means player; `guest_level > 0` means guest at that level
- The separate `role` field is dropped — it's fully derivable from `guest_level`

### Modified: `members` collection

New fields:

| Field | Type | Description |
|-------|------|-------------|
| `shell` | boolean, default false | True = hasn't completed full registration (no password set) |
| `shell_expires` | datetime, optional | 30 days from creation, extendable by coach |
| `shell_reminder_sent` | boolean, default false | Set to true when day-20 reminder email is sent (idempotency guard) |

**Existing fields used:**
- `member_active` (boolean) — already exists. Set to `true` on first login (via `member_active.pb.js` hook). Shell expiry sets this to `false`, which hides the member from active roster queries across all teams. This is acceptable because shell accounts only belong to one team (the one they were invited to).
- `approved` (boolean) — already exists. Set to `true` on claim to bypass the normal pending/approval flow.

### Unchanged: `member_teams`

Created as usual when invite is claimed. `guest_level` set from the invite's value. `season` = current season.

## User Flow

### Coach Side (Roster Editor)

1. Coach taps **"Add External User"** button in RosterEditor toolbar
2. Modal appears with role selection: **Player**, **Guest L1**, **Guest L2**, **Guest L3**
3. QR code is generated and displayed (encodes full URL: `https://<app-domain>/join/<token>`)
4. "Copy Link" button available as fallback (e.g., for sending via chat). Copies the full URL.
5. QR is single-use, link expires in 24 hours

### Person Scanning

1. Scans QR → opens `https://<app-domain>/join/<token>` in mobile browser
2. Page shows team name, club name, and role they're joining as
3. Fills in: **first name** (required), **last name** (required), **email** (required)
4. Taps "Join Team"
5. Sees confirmation: "You're in!"
6. Receives email with link to set password and complete full registration

### After Submission

**Immediately:**
- `Member` record created: `shell: true`, `approved: true`, `member_active: true`, `shell_expires: now + 30 days`
- `member_teams` record created with appropriate `guest_level` and current `season`
- `team_invites.status` → "claimed", `claimed_by` set
- Coach's roster updates (real-time via PocketBase subscriptions)

**Registration completion email:**
- Sent immediately after claim using PocketBase's built-in password reset flow (`pb.collection('members').requestPasswordReset(email)`)
- The email contains a link to PB's password reset page. Once the password is set, a PB hook checks: if `member_active = true`, flip `shell` to `false` (full member). If `member_active = false` (expired), the password is set but the account stays inactive — the coach must extend or re-invite.
- This reuses the existing "unclaimed account" pattern from `SignUpPage.tsx` — same flow used when an existing member hasn't set a password yet

**Later:**
- Reminder email at day 20 if still a shell account (sent by cron hook — see Cron Jobs section)
- At day 30: `member_active: false` if coach hasn't extended
- Coach can extend from roster editor (resets 30-day timer, no email sent to user)

## Shell Account Permissions

Shell accounts participate in the platform like regular members, with these constraints:

| Action | Shell + Player (L0) | Shell + Guest (L1-3) |
|--------|---------------------|----------------------|
| View team roster | Yes | Yes |
| Respond to trainings (yes/no/maybe) | Yes | Yes |
| Respond to events (yes/no/maybe) | Yes | Yes |
| Participate in games | Yes | **No** |
| Scorer duty assignments | Yes | **No** |

**Platform-wide rule:** Guests at any level (1-3) cannot participate in games. This applies to all guest members, not just shell accounts.

## Edge Cases

### Email already exists
Person scans QR and enters an email already in the system → "This email is already registered. Please log in instead." Checked via the existing `/api/check-email` endpoint before attempting record creation. Coach can add existing members through the normal roster search.

### QR scanned after expiry
24h has passed → "This invite has expired. Ask your coach for a new one."

### QR scanned twice (already claimed)
Second scan → "This invite has already been used."

### Shell account expires (day 30, not extended)
`member_active: false`. The account stays in the database. The person can no longer participate. To rejoin, the coach must either extend (if they notice in time) or generate a new invite. Setting a password on an expired shell does NOT auto-reactivate — the coach must explicitly extend or re-invite.

### Coach extends shell account
Resets the 30-day timer from the roster editor. No notification sent to the user.

### Coach leaves team or is deactivated
Pending (unclaimed) invites created by that coach remain valid until their 24h expiry. No cleanup needed — the invite is tied to the team, not the coach's ongoing role.

## UI Components

### 1. RosterEditor — "Add External User" button
New button in the toolbar alongside existing "Add Member". Styled with KSCW brand accent (#FFC832 border).

### 2. Invite Modal
Overlay with:
- Role picker (Player / Guest L1 / Guest L2 / Guest L3)
- QR code display (generated client-side from the invite URL)
- "Copy Link" button
- "Cancel" button
- Note: "Link expires in 24 hours · Single use"

### 3. Join Page (`/join/<token>`)
Public page (no auth required) with:
- Team name and club branding
- Role badge ("Joining as Player" / "Joining as Guest L1")
- Form: first name, last name, email
- "Join Team" submit button
- Post-submit confirmation with note about setting password later

### 4. Roster — Shell Member Indicators
Shell members shown with:
- Yellow left border accent (#FFC832)
- "Shell account · expires in X days" subtitle
- "Extend" button (coach only, in roster editor view)

## Security Considerations

- Tokens are crypto-random (32 chars, URL-safe) — not guessable
- Single-use: claimed invites cannot be reused
- 24h expiry on the QR/link itself
- Shell accounts have no password — they cannot log in until they complete registration
- Email validation on the join form to prevent garbage data
- Rate limiting on the `/api/team-invites/claim` endpoint: max 10 claims per IP per hour
- Rate limiting on the `/api/team-invites/create` endpoint: max 50 invites per user per hour
- Max 20 pending (unclaimed) invites per team at any time — prevents invite spam
- Max 10 shell members per team — prevents roster abuse
- Email uniqueness check via `/api/check-email` before creating the member record

## API Endpoints

### `POST /api/team-invites/create`
**Auth:** Coach, team_responsible, or admin (vb_admin/bb_admin for their sport, superuser for all)
**Body:** `{ team, guest_level }`
**Rate limit:** Max 50 invites per user per hour
**Validates:** User has coach/team_responsible role for this team; team has < 20 pending invites
**Returns:** `{ token, qr_url, expires_at }`

### `GET /join/<token>` (page route)
**Auth:** None (public)
**Validates:** Token exists, status = "pending", not expired
**Renders:** Join form with team info pre-filled

### `POST /api/team-invites/claim`
**Auth:** None (public)
**Body:** `{ token, first_name, last_name, email }`
**Validates:** Token valid + not expired + not claimed; email not already registered; team has < 10 shell members
**Creates:** Member (shell) + member_teams record
**Updates:** Invite status → "claimed"
**Side effect:** Triggers PB password reset email to the provided address

### `POST /api/team-invites/extend`
**Auth:** Coach or team_responsible of the team
**Body:** `{ member_id }`
**Validates:** Member is a shell account on this team
**Updates:** `shell_expires` → now + 30 days

## Cron Jobs (PocketBase Hooks)

### Shell Expiry Check — daily at 02:00 UTC

```
pb.crons.add("shell_expiry", "0 2 * * *", handler)
```

**Logic:**
1. Query all members where `shell = true AND shell_expires <= now AND member_active = true`
2. Set `member_active: false` for each
3. Log count of deactivated shells

### Shell Reminder — daily at 09:00 UTC

```
pb.crons.add("shell_reminder", "0 9 * * *", handler)
```

**Logic:**

1. Query all members where `shell = true AND member_active = true AND shell_reminder_sent = false AND shell_expires <= now + 10 days`
2. For each: send reminder email "Your temporary access to [Team] expires soon. Set a password to keep your account: [link]"
3. Set `shell_reminder_sent: true` for each successfully emailed member
4. If email service is unavailable for a member, skip (leave `shell_reminder_sent: false`) — will retry on next cron run

Uses `shell_reminder_sent` flag for idempotency — a missed cron run won't cause reminders to be permanently lost, and a successful send won't produce duplicates.

### Invite Expiry Cleanup — daily at 03:00 UTC

```
pb.crons.add("invite_expiry", "0 3 * * *", handler)
```

**Logic:**
1. Query all `team_invites` where `status = "pending" AND expires_at <= now`
2. Set `status: "expired"` for each

## Indexes

### `team_invites`

- `token` — unique index (auto from unique constraint)
- `team, status` — for pending invite count checks
- `status, expires_at` — for invite expiry cron cleanup

### `members`

- `shell, shell_expires, member_active` — for shell expiry and reminder cron queries
- `shell, member_active, shell_reminder_sent` — for reminder cron

## Dependencies

- QR code generation library (client-side, e.g., `qrcode.react` or similar)
- PocketBase cron hooks (3 jobs: shell expiry, shell reminder, invite cleanup)
- PocketBase built-in password reset flow for registration completion emails
- Existing `/api/check-email` endpoint for duplicate detection
