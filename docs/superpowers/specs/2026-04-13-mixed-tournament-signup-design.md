# Mixed Tournament Signup Page — Design Spec

**Date:** 2026-04-13
**Event:** KSCW Mixed-Turnier, Sunday 19 April 2026, 12:30–18:00 (game start 13:00)
**Type:** Semi-public form (no login required, accessible via direct link)

## Overview

A one-off event signup page allowing anyone (members and non-members) to register for the KSCW Mixed Tournament. Follows the established volley-feedback form pattern: Astro pages with vanilla JS, Directus REST API, Turnstile CAPTCHA.

Key features:
- Member name autocomplete from Directus Flow (auto-fills team + sex)
- Sex selection (required, for mixed team balancing)
- Position preferences (1st required, 2nd/3rd optional)
- Wiedisync nudge popup for recognized members
- Auto-creates Wiedisync participation for members
- Confirmation email via Directus Flow
- Admin tab for viewing signups

## Pages

| Locale | URL | File |
|--------|-----|------|
| DE | `/de/volleyball/mixed-turnier` | `src/pages/de/volleyball/mixed-turnier.astro` |
| EN | `/en/volleyball/mixed-tournament` | `src/pages/en/volleyball/mixed-tournament.astro` |

Form JS: `public/js/mixed-tournament-form.js`

Not linked from navigation — shared via direct link.

## Form Structure

### Event Banner (decorative, not a form section)
Styled card showing: event name, date (Sunday 19 April 2026), time (12:30, game start 13:00), end time (18:00).

### Section 1 — About You

| Field | Type | Required | Auto-fill from member? |
|-------|------|----------|----------------------|
| Name | Text input + autocomplete dropdown | Yes | Selection trigger |
| Email | Email input | Yes | No (not in Flow data) |
| Team | Multiselect chips (same as volley feedback) | No | Yes |
| Sex | Select (Männlich/Weiblich) | Yes | Yes |

- Name autocomplete: 150ms debounce, case-insensitive substring match, max 8 results
- Selecting a name from the dropdown sets `isMember = true` and auto-fills team + sex
- Team chips: same colored chip pattern as volley-feedback (grouped by Herren/Damen/Nachwuchs)
- Sex auto-filled from member data but editable

### Section 2 — Position Preferences

| Field | Type | Required |
|-------|------|----------|
| 1st preference | Dropdown | Yes |
| 2nd preference | Dropdown | No |
| 3rd preference | Dropdown | No |

Position options (value → DE label → EN label):
- `setter` → Zuspieler/in → Setter
- `outside` → Aussen → Outside Hitter
- `middle` → Mitte → Middle Blocker
- `opposite` → Diagonal → Opposite
- `libero` → Libero → Libero
- `universal` → Universal → Universal

Validation: selected positions must be unique (no duplicates across the three dropdowns).

### Section 3 — Notes

| Field | Type | Required |
|-------|------|----------|
| Comment | Textarea | No |

Placeholder: "Allergien, Verfügbarkeit, sonstige Hinweise…"

### Footer
- Turnstile CAPTCHA (`0x4AAAAAACoYmx3xiDfRbmv9`)
- Submit button: "Anmeldung absenden" / "Submit sign-up"

## Validation

All checks run on submit click, before any API calls:
1. **Name** — non-empty string (trimmed)
2. **Email** — non-empty, basic email format check (contains `@` and `.`)
3. **Sex** — must be selected (`männlich` or `weiblich`)
4. **Position 1** — must be selected
5. **Positions unique** — if 2nd/3rd are set, they must differ from each other and from 1st
6. **Turnstile** — valid CAPTCHA response token required

Turnstile token is sent as `X-Turnstile-Token` header on submission (same pattern as volley-feedback).

## Submission Flow

### Non-member path (name typed freely)
1. Click submit → validate → POST to Directus `mixed_tournament_signups` with `X-Turnstile-Token` header → show success message (replaces form)

### Member path (name selected from dropdown)
1. Click submit → validate form (no API calls yet)
2. Show modal overlay **before submission** (backdrop + centered card):
   - Title: "Danke für deine Anmeldung!" / "Thanks for signing up!"
   - Body: "Dein Wiedisync-Konto wartet darauf, von dir aktiviert zu werden. Da Wiedisync für Trainings, Spiele, Schreibereinsätze, Spesen und mehr verwendet wird, empfehle ich dir, den Registrierungsprozess abzuschliessen."
   - Primary button: "Für Wiedisync registrieren" / "Sign up for Wiedisync" → fires submission + opens `wiedisync.kscw.ch/signup` in new tab
   - Small secondary button: "Später" / "Later" → fires submission only
   - No close-on-backdrop-click — user must choose one option
3. On either button click: POST to `mixed_tournament_signups` + POST to `participations` (via Directus Flow, see below) → show success message (replaces form)

### Duplicate submissions
Duplicates are allowed — for a small club one-off event, dedup is handled manually in Directus admin if needed. No unique constraint on name or email.

## Directus Integration

### Collection: `mixed_tournament_signups` (to be created)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | integer | auto | PK |
| name | string | yes | |
| email | string | yes | |
| sex | string | yes | Always stored as German lowercase: `männlich` / `weiblich` regardless of locale |
| teams | json | no | array of chip labels e.g. ["H1"] |
| position_1 | string | yes | setter/outside/middle/opposite/libero/universal |
| position_2 | string | no | |
| position_3 | string | no | |
| notes | text | no | |
| is_member | boolean | no | true if selected from dropdown |
| member_id | integer | no | FK to members, nullable |
| date_created | timestamp | auto | |

Public access: create-only (no read/update/delete without auth).

### Participation record (for members only)

**Created via a Directus Flow** (not direct public POST) to avoid granting public create access to the core `participations` collection. The frontend POSTs to `mixed_tournament_signups` only; a Directus Flow triggered on item creation in that collection checks `is_member === true` and creates the participation record server-side with admin privileges:

```json
{
  "activity_type": "event",
  "activity_id": "<EVENT_ID>",
  "member": <member_id>,
  "status": "confirmed",
  "note": "setter > outside > libero"
}
```

The `note` field uses internal position keys (locale-independent), joined with ` > `.

`EVENT_ID` is the ID of the event record created in the `events` collection (one-time setup). Defined as `var EVENT_ID = <number>;` at the top of `mixed-tournament-form.js` alongside `DIRECTUS_URL`.

### Member data Flow update

The existing Directus Flow (`/flows/trigger/531dc3c2-64ec-4a7e-a989-da983d3530e4`) currently returns `{ name, functions, teams }`.

It needs to also return `id` and `sex` so the form can:
- Auto-fill sex
- Include `member_id` in the signup payload
- Create the participation record

### Confirmation email

A Directus Flow triggered on `mixed_tournament_signups` item creation sends a confirmation email to the submitted email address. This is a backend-only concern, not built in the frontend.

## Wiedisync Nudge Popup

**Trigger:** `isMember === true` (name was selected from the autocomplete dropdown, not typed freely).

**Modal design:**
- Semi-transparent backdrop (rgba(0,0,0,0.5))
- Centered card, max-width 480px, rounded corners, padding
- Brand blue (#4A55A2) title
- Body text explaining Wiedisync
- Primary button (brand blue): "Für Wiedisync registrieren" → opens wiedisync.kscw.ch/signup in new tab, then submits
- Secondary small text button: "Später" → submits without opening link
- No close-on-backdrop-click (must choose an option)

## Admin Tab

New "Mixed Turnier" tab in `/admin` page, alongside existing tabs (News, Events, Registrations, Sponsors).

### Summary bar
- Total signups count
- Male/Female split: count where `sex === 'männlich'` for M, `sex === 'weiblich'` for F (e.g. "12 Anmeldungen — 7M / 5F")

### Table columns

| Datum | Name | Email | Geschlecht | Team | Pos 1 | Pos 2 | Pos 3 | Mitglied | Bemerkungen |
|-------|------|-------|------------|------|-------|-------|-------|----------|-------------|

- Team: colored chips (same style as registration admin)
- Mitglied: checkmark icon if `is_member: true`
- Bemerkungen: truncated, speech bubble icon → modal with full text (DOMPurify sanitized)
- Sorted by newest first

### CSV Export
- Semicolon-separated
- Same pattern as registration CSV export
- Columns: Datum, Name, Email, Geschlecht, Team, Position 1, Position 2, Position 3, Mitglied, Bemerkungen

### Auth
The admin page already requires Directus login. Reading `mixed_tournament_signups` uses the authenticated admin token (collection is create-only for public, read requires auth).

### Read-only
No edit/delete from admin UI — manage data directly in Directus if needed.

## Pre-requisites (manual, one-time)

1. **Create `mixed_tournament_signups` collection** in Directus with the schema above. Set public access to create-only.
2. **Create the event** in `events` collection:
   - `title`: "Mixed-Turnier 2026"
   - `start_date`: 2026-04-19T12:30:00
   - `end_date`: 2026-04-19T18:00:00
   - `event_type`: "tournament"
   - `participation_mode`: "opt_in"
   - Note the resulting `id` for the form JS constant.
3. **Update the Directus Flow** to return `id` and `sex` in member data.
4. **Set up confirmation email Flow** triggered on `mixed_tournament_signups` creation.
5. **Create a Directus Flow** triggered on `mixed_tournament_signups` item creation that creates the `participations` record server-side (admin privileges) when `is_member === true`. Do NOT grant public create access to `participations`.

## i18n Keys

All keys prefixed with `mixedTourney*`. Base form keys already added to `src/i18n/de.json` and `src/i18n/en.json`. The following keys still need to be added:
- `mixedTourneyEmail` — "E-Mail" / "Email"
- `mixedTourneyEmailPlaceholder` — "deine@email.ch" / "your@email.ch"
- `mixedTourneyValidationEmail` — "Bitte gib eine gültige E-Mail-Adresse ein" / "Please enter a valid email address"
- `mixedTourneyWiedisyncTitle` — "Danke für deine Anmeldung!" / "Thanks for signing up!"
- `mixedTourneyWiedisyncText` — (Wiedisync nudge body text, see Submission Flow)
- `mixedTourneyWiedisyncSignup` — "Für Wiedisync registrieren" / "Sign up for Wiedisync"
- `mixedTourneyWiedisyncLater` — "Später" / "Later"

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Create | `src/pages/de/volleyball/mixed-turnier.astro` | German page |
| Create | `src/pages/en/volleyball/mixed-tournament.astro` | English page |
| Create | `public/js/mixed-tournament-form.js` | Form logic (vanilla JS) |
| Edit | `src/i18n/de.json` | Add missing i18n keys |
| Edit | `src/i18n/en.json` | Add missing i18n keys |
| Edit | `src/pages/admin.astro` | Add Mixed Turnier tab |

## Styling

Reuse the volley-feedback CSS design system:
- `.vf-*` class prefix renamed to `.mt-*` (mixed tournament)
- Same section cards, autocomplete dropdown, team chips, form inputs
- Event banner: larger card with gold accent border, centered text
- Modal: new `.mt-modal-*` classes for the Wiedisync popup
- Responsive: same breakpoints as volley feedback (480px)
