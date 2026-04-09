# KSCW Volley Feedback Page — Design Spec

## Overview

Hidden feedback page for TK Volleyball members to rate club leadership and provide season feedback. Replaces the existing Google Form with a native form that stores data in Directus.

**URL**: `/de/club/volley-feedback` + `/en/club/volley-feedback` (bilingual, not in nav)

## Architecture

- **Approach**: Single-page vanilla JS (matches existing feedback/contact/registration form patterns)
- **Backend**: New Directus collection `volley_feedback` + Directus Flow proxy for member names
- **Bot protection**: Cloudflare Turnstile (existing site key)
- **Admin**: New tab in `/admin` page for viewing responses

## Data Model — `volley_feedback` Collection

| Field | Type | Notes |
|-------|------|-------|
| id | UUID (auto) | Primary key |
| season | String | Auto-set "2025/2026" |
| is_anonymous | Boolean | Default false |
| name | String (nullable) | Null if anonymous |
| functions | JSON array | ["player", "coach", "team_responsible", "other"] |
| teams | JSON array | ["H1", "D2", ...] — chipLabels from teams.ts |
| other_function | String (nullable) | Free text if "Other" selected |
| other_team | String (nullable) | Free text if "Other" selected |
| rating_verein | Integer 1-5 (nullable) | Club overall |
| rating_vorstand | Integer 1-5 (nullable) | Board |
| rating_tk_leitung | Integer 1-5 (nullable) | TK Volleyball leadership (Thamy) |
| rating_training | Integer 1-5 (nullable) | Training quality |
| rating_kommunikation | Integer 1-5 (nullable) | Communication |
| feedback_text | Text (nullable) | General season feedback |
| ideas_text | Text (nullable) | Ideas / suggestions |
| other_text | Text (nullable) | Questions, remarks, wishes |
| locale | String | "de" or "en" |
| date_created | Timestamp (auto) | Directus auto-field |

### Permissions

| Role | Create | Read | Update | Delete |
|------|--------|------|--------|--------|
| Public | Yes | No | No | No |
| website_admin / admin | Yes | Yes | Yes | Yes |

## Form Sections

### Section 0: Anonymous Toggle
- Gold-tinted banner at top with switch
- When ON: Section 1 (identity) collapses with smooth transition, fields cleared and excluded from submission

### Section 1: Über dich / About You
- **Name**: Text input with autocomplete from Directus proxy (`/kscw/member-names`). Free text always accepted. Selecting a member auto-fills function + teams if metadata available (still editable).
- **Function**: Multiselect toggle chips — Spieler/in, Coach, Teamverantwortliche/r, Andere. "Andere" shows inline text input.
- **Teams**: Dropdown multiselect with search. Volleyball only (12 teams). Grouped: Herren (H1, H2, H3, Legends), Damen (D1, D2, D3, D4), Nachwuchs (DU23-1, DU23-2, HU23, HU20). Selected teams appear as colored tags using actual chipBg/chipText from teams.ts. "Andere" at bottom.

### Section 2: Bewertung / Rating
- 5 rating categories, each with 1-5 numbered boxes (44×44px touch targets)
- All optional. Click to select, click again to deselect.
- Selected = brand blue (#4A55A2) fill, white text
- Categories: Verein, Vorstand, TK Volleyball Leitung, Trainingsqualität, Kommunikation

### Section 3: Deine Meinung / Your Opinion
- 3 textareas (mirrors Google Form):
  1. Feedback zur Saison 2025/2026
  2. Ideen / Änderungsvorschläge
  3. Weiteres (Fragen, Anmerkungen, Wünsche)

### Section 4: Submit
- Cloudflare Turnstile widget
- Submit button (brand blue)
- Validation: at least one rating OR one text field must be filled + Turnstile required
- Success: replace form with "Danke für dein Feedback!" message

## Name Proxy Endpoint

Directus Flow (webhook trigger) at `/kscw/member-names`:
- GET request, no auth required
- Returns: `[{ "name": "Max Mustermann" }, ...]`
- Fetches from `/users` internally, returns only first_name + last_name
- Optional: include team/function metadata if available in user profile

## Admin Dashboard (new tab in /admin)

### Summary Cards (top row)
- Total responses, anonymous count, top 2 average ratings

### Vertical Bar Chart
- 5 bars for average ratings (Verein, Vorstand, TK Ltg., Training, Komm.)
- Brand blue gradient, value labels on top, category labels below
- Height proportional to rating (max = 5.0)

### Response Table
- Columns: Datum, Name, Team, Verein, Vorstand, TK, Training, Komm., Text
- Team chips with actual colors from teams.ts
- Anonymous rows highlighted gold tint
- Team filter dropdown + CSV Export button
- Speech bubble icon → modal with full text feedback (DOMPurify sanitized)

## Files to Create/Modify

### New Files
- `src/pages/de/club/volley-feedback.astro` — German page
- `src/pages/en/club/volley-feedback.astro` — English page
- `public/js/volley-feedback-form.js` — All form interactivity

### Modified Files
- `src/pages/admin.astro` — Add "Volley Feedback" tab
- `src/i18n/de.json` — Add translation keys
- `src/i18n/en.json` — Add translation keys

### Directus Setup (both dev + prod)
- Create `volley_feedback` collection with schema above
- Set public role permissions (create only)
- Create Flow for `/kscw/member-names` proxy endpoint

## Contrast Checks (KSCW brand)
- Rating selected: #4A55A2 bg + white text → ~7.2:1 ✓
- Function chip selected: #4A55A2 bg + white text → ~7.2:1 ✓
- Team chips: use chipBg/chipText from teams.ts (pre-verified in existing site)
- Anonymous banner: gold-50 bg + dark text → verify during implementation
