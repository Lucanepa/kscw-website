# Registration Form — Design Spec

**Date:** 2026-04-01
**Status:** Draft
**Replaces:** kscw.ch/weiteres/mitglied_werden/volleyball (ClubDesk form) + Google Forms basketball registration

## Problem

The current kscw.ch site (ClubDesk) hosts the volleyball registration form, and basketball uses a Google Form. When kscw.ch is decommissioned as the public site, these forms need to live on the new Astro website. ClubDesk remains the member database (source of truth for financials) — there is no API, so data enters ClubDesk via CSV import.

## Solution Overview

A unified member registration form on the Astro site for all three membership types (Volleyball, Basketball, Passive). Submissions are stored in a Directus collection with an admin approval workflow. Approved registrations can be exported as ClubDesk-compatible CSV. Basketball registrations include file uploads (ID, signed Lizenzantrag PDF) and pre-filled PDF generation from admin.

---

## 1. Registration Form (User-Facing)

**URL:** `/de/weiteres/mitgliedschaft` (extend existing page) or `/de/weiteres/anmeldung` (new page)
**Pattern:** Astro page + vanilla JS in `/public/js/`, Turnstile CAPTCHA, POST to Directus endpoint.
**Upload strategy:** All submissions use `multipart/form-data` (even non-basketball, for simplicity). The custom endpoint `/kscw/registration` handles both form fields and file uploads in a single request. Directus public role needs file upload permission scoped to the `registrations` folder only.

### 1.1 Form Fields

**Step 1 — Membership Type** (radio buttons, controls which fields appear):
- Volleyball
- Basketball
- Passivmitglied

**Common Fields (all types):**
| Field | Type | Required | ClubDesk Column |
|---|---|---|---|
| Vorname | text | yes | `Vorname` |
| Nachname | text | yes | `Nachname` |
| E-Mail | email | yes | `E-Mail` |
| Telefon Mobil | tel | yes | `Telefon Mobil` |
| Adresse | text | yes | `Adresse` |
| PLZ | text | yes | `PLZ` |
| Ort | text | yes | `Ort` |
| Geburtsdatum | date | yes | `Geburtsdatum` (DD.MM.YYYY) |
| Nationalität | text/select | yes | `Nationalität` |
| Geschlecht | select (männlich/weiblich) | yes | `Geschlecht` |
| Bemerkungen | textarea | no | `Bemerkungen` |

**Volleyball-only:**
| Field | Type | Required | ClubDesk Column |
|---|---|---|---|
| Anrede | select (Herr/Frau) | yes | `Anrede` |
| Team | select (fetched from Directus) | yes | `[Gruppen]` |
| Beitragskategorie | select | yes | `Beitragskategorie` |
| AHV-Nummer | text | yes (U23 — age calculated from DOB client-side + validated server-side) | `AHV Nummer` |
| Kantonsschule ZH | select (Nein/Ja KS Wiedikon/Ja andere) | yes | `Mittelschule ZH` |
| Rolle | checkbox (Schreiber/Schiedsrichter) | no | `Funktion` |

**Volleyball Beitragskategorie options:**
- VB Turnier KWI (CHF 110)
- VB Lernende/Studi Meisterschaft (CHF 210)
- VB Schüler*in Meisterschaft (CHF 310)
- VB Student*in Meisterschaft (CHF 380)
- VB Erwerbstätige (CHF 440)

**Basketball-only:**
| Field | Type | Required | ClubDesk Column |
|---|---|---|---|
| Team | select (BB teams) | yes | `[Gruppen]` |
| Beitragskategorie | select | yes | `Beitragskategorie` |
| AHV-Nummer | text | yes | `AHV Nummer` |
| Kantonsschule ZH | select (Nein/Ja KS Wiedikon/Ja andere) | yes | `Mittelschule ZH` |
| ID-Kopie | file upload (front+back, PDF/image, max 10MB each) | yes | — |

**Passive-only:**
- No additional fields beyond common fields.

### 1.2 Form Behavior

- Membership type selection shows/hides relevant fields
- Team dropdown fetched from Directus (filtered by sport), same pattern as contact form
- Client-side validation before submission
- Turnstile CAPTCHA (existing site key: `0x4AAAAAACoYmx3xiDfRbmv9`)
- Consent checkbox (mandatory), text along the lines of:
  > "Ich bin damit einverstanden, dass meine Daten auf einem Server gespeichert und zur Bearbeitung meiner Vereinsmitgliedschaft verwendet werden. Die Daten werden nach 90 Tagen automatisch gelöscht. Ich kann jederzeit die vorzeitige Löschung meiner Daten per E-Mail an kscw@kscw.ch verlangen."
  - EN equivalent provided via i18n
- Coach note displayed prominently: registration only valid after confirming with team coach
- Submit → POST to Directus custom endpoint `/kscw/registration`
- Success → confirmation message on page + **confirmation email** sent to the user's email (see Section 3.3)

### 1.3 i18n

All labels/messages via `t(locale, key)` — DE and EN versions.

---

## 2. Directus Backend

### 2.1 Collection: `registrations`

| Field | Type | Notes |
|---|---|---|
| id | uuid | auto |
| status | string | `pending` / `approved` / `rejected` |
| membership_type | string | `volleyball` / `basketball` / `passive` |
| anrede | string | nullable |
| vorname | string | |
| nachname | string | |
| email | string | |
| telefon_mobil | string | |
| adresse | string | |
| plz | string | |
| ort | string | |
| geburtsdatum | date | |
| nationalitaet | string | |
| geschlecht | string | |
| ahv_nummer | string | nullable, encrypted at rest |
| team | string | team name/ID |
| beitragskategorie | string | nullable |
| kantonsschule | string | nullable |
| rolle | string | nullable |
| bemerkungen | text | nullable |
| id_upload_front | file | nullable (BB only) |
| id_upload_back | file | nullable (BB only) |
| submitted_at | datetime | auto |
| approved_at | datetime | nullable |
| approved_by | string | nullable |
| reference_number | string | auto-generated (e.g. REG-2026-0042) |

### 2.2 Custom Endpoint: `POST /kscw/registration`

- Validates Turnstile token
- Validates required fields based on membership_type
- Stores registration in collection
- Handles file uploads (ID copies)
- Returns reference number

### 2.3 Auto-Deletion

Scheduled task (Directus Flow or cron) runs daily:
- Delete all registrations + associated files older than **90 days** from submission date
- Regardless of status
- Admin list view shows a warning badge on records approaching 90 days (e.g. ">75 days old")

---

## 3. Admin Panel (`/admin`)

### 3.1 New Tab: "Anmeldungen"

Added to the existing admin page as a new tab alongside news/events.

**List View:**
- Table: Ref#, Name, Type (VB/BB/Passiv), Team, Status, Date
- Filter by status (pending/approved/rejected) — default: pending
- Sort by date (newest first)

**Detail View (click on row):**
- All submitted fields displayed in editable form
- Admin can modify any field (fix typos, correct team, adjust fee category)
- File previews for uploaded ID copies
- Action buttons:
  - **Approve** → sets status to `approved`, records `approved_at` + `approved_by`, triggers approval email
  - **Reject** → confirmation dialog first ("Anmeldung wirklich ablehnen?"), then sets status to `rejected` and deletes the registration + files
  - **Download Files** → downloads uploaded ID/PDF files, then deletes them from Directus

**Basketball PDF Generation:**
- "Lizenzantrag generieren" button — generates pre-filled Swiss Basketball Lizenzantrag PDF using `pdf-lib` client-side with the (potentially edited) registration data
- "FIBA PDFs generieren" button (optional) — generates Player's Self Declaration + National Team Declaration

Pre-filled fields in Lizenzantrag:
| PDF Field | Source |
|---|---|
| `undefined` (Name des Klubs) | "KSC Wiedikon" (hardcoded) |
| `undefined_3` (Name/Nachname) | `nachname` |
| `undefined_4` (Vorname) | `vorname` |
| `undefined_5` (Strasse) | `adresse` |
| `undefined_6` (PLZ) | `plz` |
| `undefined_7` (Ort) | `ort` |
| `undefined_2` (E-Mail) | `email` |
| `Tag` / `Monat` / `Jahr` | from `geburtsdatum` |
| `Mann` / `Frau` | from `geschlecht` |
| `Schweiz` / `Andere` + text | from `nationalitaet` |
| `Neues Mitglied Swiss Basketball` | checked |
| `undefined10` (Spieler) | checked |
| League checkboxes | from team mapping |

**PDF template versioning:** The Lizenzantrag PDF template is stored in the repo at `public/docs/demande_licence_d_new.pdf`. The PDF field names (e.g. `undefined_3`) are internal names from the original PDF author. If Swiss Basketball issues a new Lizenzantrag version, all field names must be re-mapped. Pin the template version and never auto-update.

**CSV Export:**
- "CSV Export" button — exports approved registrations as semicolon-separated CSV (UTF-8)
- Column headers match ClubDesk exactly:
  ```
  Nachname;Vorname;Anrede;E-Mail;Telefon Mobil;Adresse;PLZ;Ort;Geburtsdatum;Nationalität;Geschlecht;AHV Nummer;Sektion;Status;Beitragskategorie;[Gruppen];Mittelschule ZH;Funktion;Bemerkungen;Land
  ```
- Date format: DD.MM.YYYY
- `Sektion`: "Volleyball", "Basketball", or "KSCW" (passive)
- `Status`: "Aktivmitglied" (VB/BB) or "Passivmitglied"
- `Land`: default "Schweiz"
- ClubDesk auto-maps these headers — no manual column assignment needed

### 3.2 Approval Email

On approval, send email to a configurable processing address containing:
- All registration data (formatted)
- Attached uploaded files (ID copies) if still present in Directus. If files were already downloaded and deleted, the email notes "Files already downloaded by admin."
- Membership type + team
- Reference number

---

## 4. Privacy

Privacy for registration is handled **inline on the form page** (not added to the main Datenschutzerklärung). A collapsible/expandable privacy notice is shown above the consent checkbox, covering:

- **What's collected:** personal info, AHV number, nationality, ID copies (basketball)
- **Purpose:** club membership processing, sports federation licence applications (Swiss Volley, Swiss Basketball, FIBA)
- **Recipients:** KSCW administration, ClubDesk (member database), relevant sports federation
- **Storage:** data is uploaded to and stored on a server (Directus), encrypted at rest for sensitive fields (AHV)
- **Retention:** all registration data and uploaded files automatically deleted after 90 days
- **Early deletion:** users can request deletion at any time by emailing kscw@kscw.ch
- **Legal basis:** consent (checkbox on form) + legitimate interest for club operations (Swiss DSG)

The consent checkbox text (see section 1.2) summarizes this in plain language.

---

## 5. Integration with Existing Pages

### 5.1 Mitgliedschaft Page Update

The existing `/de/weiteres/mitgliedschaft` page currently links to external forms. Update:
- Replace the three external buttons (VB registration, BB registration, passive) with links/anchors to the new unified form
- Could be: same page with form below fees section, or separate `/de/weiteres/anmeldung` page
- Recommendation: **separate page** (`/de/weiteres/anmeldung`) to keep the info page clean and the form focused

### 5.2 Navigation

No nav changes needed — registration is accessed via the Mitgliedschaft page CTA buttons.

---

## 6. File Structure

```
src/pages/de/weiteres/anmeldung.astro     — DE registration form page
src/pages/en/weiteres/anmeldung.astro     — EN registration form page
public/js/registration-form.js            — Form logic (vanilla JS)
public/docs/demande_licence_d_new.pdf     — Lizenzantrag template
public/docs/player-self-declaration.pdf   — FIBA Self Declaration template (optional)
public/docs/national-team-declaration.pdf — FIBA National Team Declaration template (optional)
src/i18n/de.json                          — DE translations (registration* keys)
src/i18n/en.json                          — EN translations (registration* keys)
```

Admin panel changes are inline in `src/pages/admin.astro` (existing pattern).

Directus changes:
- New `registrations` collection
- New custom endpoint `/kscw/registration` (handles multipart/form-data)
- Public role: file upload permission scoped to `registrations` folder only
- New Flow for auto-deletion (daily cron)
- New Flow for approval email

---

## 7. Tech Decisions

| Decision | Choice | Reason |
|---|---|---|
| Form framework | Vanilla JS (no framework) | Matches existing contact form pattern |
| PDF generation | `pdf-lib` (client-side) | No server dependency, fills existing form fields |
| File upload | Directus files API | Already handles file storage |
| CSV export | Client-side JS | Simple, no backend needed |
| CAPTCHA | Cloudflare Turnstile | Already in use |
| Email | Directus Flows | Already configured for other notifications |

---

## 8. Out of Scope

- Online payment / fee collection
- Digital signature on PDFs (user prints, signs, scans)
- Swiss Volley licence forms (volleyball doesn't require them via this form)
- Automatic ClubDesk sync (no API available)
- Member portal / login for members
