# Registration Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified member registration form (Volleyball/Basketball/Passive) with admin approval workflow, ClubDesk CSV export, and basketball PDF pre-fill.

**Architecture:** Astro page + vanilla JS form submits to Directus custom endpoint. Admin reviews/edits/approves in existing `/admin` panel. Approved members exported as ClubDesk-compatible CSV. Basketball PDFs pre-filled client-side with pdf-lib.

**Tech Stack:** Astro, vanilla JS, Directus (collection + custom endpoint + flows), pdf-lib (CDN), Cloudflare Turnstile

**Spec:** `docs/superpowers/specs/2026-04-01-registration-form-design.md`

---

## Prerequisites (Directus-side, not in this repo)

These must be set up on the Directus server before the frontend work:

1. **Create `registrations` collection** with fields per spec Section 2.1
2. **Create custom endpoint** `POST /kscw/registration` — validates Turnstile, stores registration, handles file uploads, returns reference number
3. **Public role permission** for file upload scoped to `registrations` folder only
4. **Auto-deletion Flow** — daily cron deleting records >90 days old
5. **Approval email Flow** — triggered on status change to `approved`, sends email with data + files
6. **Confirmation email Flow** — triggered on new registration creation. The Flow must:
   - Read the `membership_type` and form locale to determine which email template to use
   - **Volleyball:** Welcome message, fee schedule (CHF 110-440 by category), note that licence is ordered after payment, link to https://volleymanager.volleyball.ch/login, "Sportliche Grüsse"
   - **Basketball:** Summary of submitted data, next steps (admin review, document processing timeline), contact info
   - **Passive:** Summary, invoice info
   - Send to the `email` field on the registration record
   - Use Directus email template with KSCW branding

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/pages/de/weiteres/anmeldung.astro` | Create | DE registration form page |
| `src/pages/en/weiteres/anmeldung.astro` | Create | EN registration form page |
| `public/js/registration-form.js` | Create | Form logic (type switching, validation, teams fetch, submission) |
| `public/docs/demande_licence_d_new.pdf` | Create | Lizenzantrag PDF template (copy from Downloads) |
| `public/docs/player-self-declaration.pdf` | Create | FIBA Self Declaration template (optional, copy) |
| `public/docs/national-team-declaration.pdf` | Create | FIBA National Team Declaration template (optional, copy) |
| `src/pages/admin.astro` | Modify | Add "Anmeldungen" tab with list/detail/approve/reject/CSV/PDF |
| `src/pages/de/weiteres/mitgliedschaft.astro` | Modify | Update CTA buttons to link to `/de/weiteres/anmeldung` |
| `src/pages/en/weiteres/mitgliedschaft.astro` | Modify | Update CTA buttons to link to `/en/weiteres/anmeldung` |
| `src/i18n/de.json` | Modify | Add registration* translation keys (DE, build-time) |
| `src/i18n/en.json` | Modify | Add registration* translation keys (EN, build-time) |
| `public/js/i18n/de.json` | Modify | Add registration* keys (DE, runtime for JS) |
| `public/js/i18n/en.json` | Modify | Add registration* keys (EN, runtime for JS) |

---

## Task 1: i18n Translation Keys

**Files:**
- Modify: `src/i18n/de.json`
- Modify: `src/i18n/en.json`

- [ ] **Step 1: Add DE translation keys**

Add to `src/i18n/de.json` — all keys prefixed with `registration`:

```json
"registrationTitle": "Anmeldung",
"registrationSubtitle": "Mitglied werden beim KSC Wiedikon",
"registrationType": "Mitgliedschaftsart",
"registrationTypeVolleyball": "Volleyball",
"registrationTypeBasketball": "Basketball",
"registrationTypePassive": "Passivmitglied",
"registrationAnrede": "Anrede",
"registrationAnredeHerr": "Herr",
"registrationAnredeFrau": "Frau",
"registrationFirstName": "Vorname",
"registrationLastName": "Nachname",
"registrationEmail": "E-Mail-Adresse",
"registrationPhone": "Handynummer",
"registrationAddress": "Adresse",
"registrationPLZ": "PLZ",
"registrationCity": "Ort",
"registrationDOB": "Geburtsdatum",
"registrationNationality": "Nationalität",
"registrationNationalitySwiss": "Schweiz",
"registrationNationalityOther": "Andere",
"registrationGender": "Geschlecht",
"registrationGenderMale": "männlich",
"registrationGenderFemale": "weiblich",
"registrationTeam": "Team",
"registrationTeamPlaceholder": "Team auswählen…",
"registrationAHV": "AHV-Nummer",
"registrationAHVNote": "Diese Angabe benötigen wir zwingend, um in den Jugendkategorien Subventionen vom Bund zu erhalten.",
"registrationFeeCategory": "Beitragskategorie",
"registrationFeeCategoryPlaceholder": "Kategorie auswählen…",
"registrationKantonsschule": "Bist du Schüler:in oder Ehemalige:r einer Zürcher Kantonsschule?",
"registrationKantonsschuleNo": "Nein",
"registrationKantonsschuleWiedikon": "Ja, Kantonsschule Wiedikon",
"registrationKantonsschuleOther": "Ja, andere Kantonsschule",
"registrationRole": "Funktion",
"registrationRoleSchreiber": "Schreiber/Anzeiger",
"registrationRoleSchiedsrichter": "Schiedsrichter",
"registrationIDUpload": "Vorder- und Rückseite von Identitätskarte oder Pass (Bild/PDF)",
"registrationIDUploadNote": "Achtung, Ausländerausweis geht nicht!",
"registrationIDFront": "Vorderseite",
"registrationIDBack": "Rückseite",
"registrationComments": "Bemerkungen",
"registrationCommentsPlaceholder": "Optionale Bemerkungen…",
"registrationCoachNote": "Bitte kläre zuerst mit dem Trainer/der Trainerin deines Teams ab, ob ein Platz frei ist. Anmeldungen ohne vorgängige Absprache sind ungültig.",
"registrationPrivacyTitle": "Datenschutzhinweis",
"registrationPrivacyText": "Deine Daten werden auf einem Server gespeichert und ausschliesslich zur Bearbeitung deiner Vereinsmitgliedschaft verwendet. Sie werden nach 90 Tagen automatisch gelöscht. Du kannst jederzeit die vorzeitige Löschung deiner Daten per E-Mail an kscw@kscw.ch verlangen. Bei Basketball-Anmeldungen werden die Daten an Swiss Basketball zur Lizenzierung weitergeleitet.",
"registrationConsent": "Ich bin damit einverstanden, dass meine Daten gespeichert und zur Bearbeitung meiner Vereinsmitgliedschaft verwendet werden.",
"registrationSubmit": "Anmeldung absenden",
"registrationSending": "Wird gesendet…",
"registrationSuccess": "Deine Anmeldung wurde erfolgreich eingereicht! Du erhältst eine Bestätigung per E-Mail.",
"registrationError": "Fehler beim Senden. Bitte versuche es erneut.",
"registrationValidationRequired": "Bitte fülle alle Pflichtfelder aus.",
"registrationValidationEmail": "Bitte gib eine gültige E-Mail-Adresse ein.",
"registrationValidationCaptcha": "Bitte bestätige, dass du kein Roboter bist.",
"registrationValidationConsent": "Bitte akzeptiere die Datenschutzerklärung.",
"registrationValidationID": "Bitte lade Vorder- und Rückseite deines Ausweises hoch.",
"registrationVBFeeTournamentKWI": "VB Turnier KWI (CHF 110)",
"registrationVBFeeTournament": "VB Lernende/Studi Meisterschaft (CHF 210)",
"registrationVBFeeHighSchool": "VB Schüler*in Meisterschaft (CHF 310)",
"registrationVBFeeStudent": "VB Student*in Meisterschaft (CHF 380)",
"registrationVBFeeWorking": "VB Erwerbstätige (CHF 440)"
```

- [ ] **Step 2: Add EN translation keys**

Add equivalent keys to `src/i18n/en.json` with English translations.

- [ ] **Step 3: Add runtime i18n keys**

The registration form JS uses `i18n.t()` at runtime for dynamic strings (validation messages, button text). These keys must also be added to the **runtime** JSON files:
- `public/js/i18n/de.json` — add all `registration*` keys that are used in `registration-form.js` (validation messages, submit/sending text, success/error messages)
- `public/js/i18n/en.json` — same keys in English

Only the keys referenced by `i18n.t('...')` in JS need to be in the runtime files. Build-time keys (used in Astro templates via `t(locale, '...')`) only need to be in `src/i18n/*.json`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/de.json src/i18n/en.json
git commit -m "feat: add registration form i18n keys (DE + EN)"
```

---

## Task 2: Registration Form Page (DE)

**Files:**
- Create: `src/pages/de/weiteres/anmeldung.astro`

- [ ] **Step 1: Create the DE registration form page**

Follow the pattern from `src/pages/de/club/kontakt.astro`:
- Import `PageLayout`, `SectionHeader`, `t` from i18n
- Set `locale = 'de'`
- Use `PageLayout` with title/description/pageTitle/pageSubtitle

Page structure:
```
<PageLayout ...>
  <!-- Coach Note (prominent warning card) -->
  <section class="section">
    <div class="container" style="max-width: 720px;">
      <!-- Warning card with coach note text -->

      <!-- Registration Form -->
      <form id="registration-form">

        <!-- Step 1: Membership Type (radio buttons) -->
        <!-- 3 radio buttons: volleyball, basketball, passive -->

        <!-- Common Fields -->
        <!-- Vorname, Nachname (form-row with 2 columns) -->
        <!-- E-Mail -->
        <!-- Telefon Mobil -->
        <!-- Adresse -->
        <!-- PLZ, Ort (form-row with 2 columns) -->
        <!-- Geburtsdatum (type="date") -->
        <!-- Nationalität (select: Schweiz / Andere + text input) -->
        <!-- Geschlecht (select: männlich / weiblich) -->

        <!-- Volleyball-only fields (hidden by default) -->
        <div id="vb-fields" style="display: none;">
          <!-- Anrede (select: Herr/Frau) -->
          <!-- Team (select, populated from Directus) -->
          <!-- Beitragskategorie (select with VB options) -->
          <!-- AHV-Nummer (with note about U23) -->
          <!-- Kantonsschule (select: Nein / Ja KS Wiedikon / Ja andere) -->
          <!-- Rolle (checkboxes: Schreiber, Schiedsrichter) -->
        </div>

        <!-- Basketball-only fields (hidden by default) -->
        <div id="bb-fields" style="display: none;">
          <!-- Team (select, populated from Directus) -->
          <!-- Beitragskategorie (select with BB options) -->
          <!-- AHV-Nummer -->
          <!-- Kantonsschule (select) -->
          <!-- ID Upload: front (file input, accept image/*,.pdf) -->
          <!-- ID Upload: back (file input) -->
        </div>

        <!-- Bemerkungen (textarea, all types) -->

        <!-- Privacy Notice (collapsible) -->
        <details>
          <summary>{t(locale, 'registrationPrivacyTitle')}</summary>
          <p>{t(locale, 'registrationPrivacyText')}</p>
        </details>

        <!-- Consent Checkbox -->
        <label><input type="checkbox" id="consent" required> {t(locale, 'registrationConsent')}</label>

        <!-- Turnstile container -->
        <div id="turnstile-container"></div>

        <!-- Submit button -->
        <button type="submit" class="form-submit btn btn-gold">
          {t(locale, 'registrationSubmit')}
        </button>
      </form>

      <!-- Feedback message -->
      <div id="form-feedback" style="display: none;"></div>
    </div>
  </section>

  <!-- Scripts -->
  <script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script is:inline src="/js/i18n.js"></script>
  <script is:inline>i18n.init();</script>
  <script is:inline src="/js/registration-form.js"></script>
  <script src="../../../islands/scroll-animations.ts"></script>
</PageLayout>
```

**Important:** The `i18n.js` script must be loaded BEFORE `registration-form.js` so that `window.i18n` is available. The `i18n.init()` call loads the runtime translation JSON for the current locale. The registration form JS uses `i18n.t()` for dynamic strings (validation messages, button text during submit). The registration i18n keys from Task 1 must also be added to the **runtime** JSON files at `public/js/i18n/de.json` and `public/js/i18n/en.json` (not just the build-time `src/i18n/*.json` files).
```

Use CSS classes from global.css: `.form-group`, `.form-input`, `.form-select`, `.form-textarea`, `.form-label`. Use `.form-row` pattern from kontakt.astro for side-by-side fields.

All labels use `{t(locale, 'registrationXxx')}`.

- [ ] **Step 2: Verify page renders**

Run: `npm run dev`
Navigate to `http://localhost:4321/de/weiteres/anmeldung`
Expected: form renders with all fields, type radios switch field visibility

- [ ] **Step 3: Commit**

```bash
git add src/pages/de/weiteres/anmeldung.astro
git commit -m "feat: add DE registration form page"
```

---

## Task 3: Registration Form Page (EN)

**Files:**
- Create: `src/pages/en/weiteres/anmeldung.astro`

- [ ] **Step 1: Copy DE page and change locale**

Copy `src/pages/de/weiteres/anmeldung.astro` to `src/pages/en/weiteres/anmeldung.astro`. Change:
- `const locale = 'en';`
- `title="Registration — KSC Wiedikon"`
- `description` to English
- Adjust import paths (same relative depth, so paths stay the same)

- [ ] **Step 2: Commit**

```bash
git add src/pages/en/weiteres/anmeldung.astro
git commit -m "feat: add EN registration form page"
```

---

## Task 4: Registration Form JavaScript

**Files:**
- Create: `public/js/registration-form.js`

Follow the exact pattern from `public/js/contact-form.js`: IIFE, strict mode, `DIRECTUS_URL` detection, Turnstile rendering, form submission.

- [ ] **Step 1: Create the form JS with type switching**

```javascript
(function () {
  'use strict';

  var DIRECTUS_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://directus-dev.kscw.ch' : 'https://directus.kscw.ch';
  var TURNSTILE_SITE_KEY = '0x4AAAAAACoYmx3xiDfRbmv9';

  var form = document.getElementById('registration-form');
  var feedback = document.getElementById('form-feedback');
  var submitBtn = form ? form.querySelector('.form-submit') : null;
  var vbFields = document.getElementById('vb-fields');
  var bbFields = document.getElementById('bb-fields');

  if (!form) return;

  // ── Membership type switching ─────────────────────────────
  var typeRadios = form.querySelectorAll('input[name="membership_type"]');

  function onTypeChange() {
    var selected = form.querySelector('input[name="membership_type"]:checked');
    var type = selected ? selected.value : '';

    vbFields.style.display = type === 'volleyball' ? '' : 'none';
    bbFields.style.display = type === 'basketball' ? '' : 'none';

    // Toggle required attributes based on type
    toggleRequired(vbFields, type === 'volleyball');
    toggleRequired(bbFields, type === 'basketball');

    // Fetch teams for selected sport
    if (type === 'volleyball' || type === 'basketball') {
      fetchTeams(type);
    }
  }

  function toggleRequired(container, isRequired) {
    var inputs = container.querySelectorAll('[data-conditional-required]');
    for (var i = 0; i < inputs.length; i++) {
      if (isRequired) {
        inputs[i].setAttribute('required', '');
      } else {
        inputs[i].removeAttribute('required');
      }
    }
  }

  typeRadios.forEach(function (r) { r.addEventListener('change', onTypeChange); });

  // ── Turnstile ─────────────────────────────────────────────
  // (Same pattern as contact-form.js)
  var turnstileWidgetId = null;
  var turnstileContainer = document.getElementById('turnstile-container');

  function renderTurnstile() {
    if (!turnstileContainer || !window.turnstile) return;
    if (turnstileWidgetId !== null) return;
    turnstileWidgetId = window.turnstile.render(turnstileContainer, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: 'auto',
      size: 'compact',
    });
  }

  if (window.turnstile) {
    renderTurnstile();
  } else {
    var pollCount = 0;
    var pollInterval = setInterval(function () {
      pollCount++;
      if (window.turnstile) { clearInterval(pollInterval); renderTurnstile(); }
      if (pollCount > 50) clearInterval(pollInterval);
    }, 100);
  }

  // ── Team fetching ─────────────────────────────────────────
  var teamCache = {};

  function fetchTeams(sport) {
    var selectId = sport === 'volleyball' ? 'vb-team' : 'bb-team';
    var teamSelect = document.getElementById(selectId);
    if (!teamSelect) return;

    if (teamCache[sport]) {
      populateTeams(teamSelect, teamCache[sport]);
      return;
    }

    fetch(DIRECTUS_URL + '/items/teams?filter[sport][_eq]=' + sport +
      '&filter[active][_eq]=true&fields=id,name,league&sort=name&limit=-1')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var teams = (data && data.data) ? data.data : [];
        teamCache[sport] = teams;
        populateTeams(teamSelect, teams);
      })
      .catch(function () { /* silent */ });
  }

  function populateTeams(select, teams) {
    // Keep first option (placeholder)
    while (select.options.length > 1) select.remove(1);
    for (var i = 0; i < teams.length; i++) {
      var opt = document.createElement('option');
      opt.value = teams[i].name;
      opt.textContent = teams[i].name + (teams[i].league ? ' — ' + teams[i].league : '');
      select.appendChild(opt);
    }
  }

  // ── Feedback helpers ──────────────────────────────────────
  function showFeedback(type, msg) {
    if (!feedback) return;
    feedback.className = 'form-feedback form-feedback--' + type;
    feedback.textContent = msg;
    feedback.style.display = '';
  }

  function hideFeedback() {
    if (!feedback) return;
    feedback.style.display = 'none';
  }

  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    if (loading) {
      submitBtn.dataset.originalText = submitBtn.textContent;
      submitBtn.textContent = i18n.t('registrationSending');
    } else {
      submitBtn.textContent = submitBtn.dataset.originalText || i18n.t('registrationSubmit');
    }
  }

  // ── Form submission ───────────────────────────────────────
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    hideFeedback();

    var type = (form.querySelector('input[name="membership_type"]:checked') || {}).value;
    if (!type) return showFeedback('error', i18n.t('registrationValidationRequired'));

    // Consent check
    var consent = document.getElementById('consent');
    if (!consent || !consent.checked) return showFeedback('error', i18n.t('registrationValidationConsent'));

    // Turnstile
    var turnstileToken = '';
    if (window.turnstile && turnstileWidgetId !== null) {
      turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || '';
    }
    if (!turnstileToken) return showFeedback('error', i18n.t('registrationValidationCaptcha'));

    // Basketball file validation
    if (type === 'basketball') {
      var front = document.getElementById('id-front');
      var back = document.getElementById('id-back');
      if (!front.files.length || !back.files.length) {
        return showFeedback('error', i18n.t('registrationValidationID'));
      }
    }

    setLoading(true);

    // Build FormData (multipart for file support)
    var fd = new FormData();
    fd.append('membership_type', type);
    fd.append('vorname', val('vorname'));
    fd.append('nachname', val('nachname'));
    fd.append('email', val('email'));
    fd.append('telefon_mobil', val('telefon'));
    fd.append('adresse', val('adresse'));
    fd.append('plz', val('plz'));
    fd.append('ort', val('ort'));
    fd.append('geburtsdatum', val('geburtsdatum'));
    fd.append('nationalitaet', val('nationalitaet'));
    fd.append('geschlecht', val('geschlecht'));
    fd.append('bemerkungen', val('bemerkungen'));
    fd.append('turnstile_token', turnstileToken);

    if (type === 'volleyball') {
      fd.append('anrede', val('anrede'));
      fd.append('team', val('vb-team'));
      fd.append('beitragskategorie', val('vb-fee'));
      fd.append('ahv_nummer', val('vb-ahv'));
      fd.append('kantonsschule', val('kantonsschule-vb'));
      // Collect rolle checkboxes
      var rollen = [];
      form.querySelectorAll('input[name="rolle"]:checked').forEach(function(cb) {
        rollen.push(cb.value);
      });
      if (rollen.length) fd.append('rolle', rollen.join(', '));
    }

    if (type === 'basketball') {
      fd.append('team', val('bb-team'));
      fd.append('beitragskategorie', val('bb-fee'));
      fd.append('ahv_nummer', val('bb-ahv'));
      fd.append('kantonsschule', val('kantonsschule-bb'));
      fd.append('id_front', document.getElementById('id-front').files[0]);
      fd.append('id_back', document.getElementById('id-back').files[0]);
    }

    fetch(DIRECTUS_URL + '/kscw/registration', {
      method: 'POST',
      body: fd,
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || i18n.t('registrationError')); });
        return r.json();
      })
      .then(function () {
        showFeedback('success', i18n.t('registrationSuccess'));
        form.reset();
        vbFields.style.display = 'none';
        bbFields.style.display = 'none';
        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
      })
      .catch(function (err) {
        showFeedback('error', err.message || i18n.t('registrationError'));
      })
      .finally(function () {
        setLoading(false);
      });
  });

  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }
})();
```

- [ ] **Step 2: Test form behavior in dev**

Run: `npm run dev`
Test: select each membership type → correct fields appear/hide, team dropdowns populate, submit validation works.

- [ ] **Step 3: Commit**

```bash
git add public/js/registration-form.js
git commit -m "feat: add registration form JS (type switching, validation, submission)"
```

---

## Task 5: PDF Templates

**Files:**
- Create: `public/docs/demande_licence_d_new.pdf`
- Create: `public/docs/player-self-declaration.pdf`
- Create: `public/docs/national-team-declaration.pdf`

- [ ] **Step 1: Copy PDF templates to public/docs/**

```bash
mkdir -p public/docs
cp "/home/luca-canepa/Downloads/demande_licence_d_new.pdf" public/docs/
cp "/home/luca-canepa/Downloads/player-s-self-declaration-(march-2021)-form.pdf" public/docs/player-self-declaration.pdf
cp "/home/luca-canepa/Downloads/sui_national-team-declaration-(september-2022).pdf" public/docs/national-team-declaration.pdf
```

- [ ] **Step 2: Commit**

```bash
git add public/docs/
git commit -m "feat: add basketball PDF templates (Lizenzantrag, FIBA declarations)"
```

---

## Task 6: Admin Panel — Registrations Tab (List View)

**Files:**
- Modify: `src/pages/admin.astro`

This is the largest task. The admin.astro file is ~1942 lines of vanilla JS. Follow the existing patterns exactly.

- [ ] **Step 1: Add "Anmeldungen" tab button**

In `renderAdmin()` function, find where tab buttons are rendered (the `admin-tab` buttons). Add a new tab button:

```javascript
'<button class="admin-tab' + (currentTab === 'registrations' ? ' active' : '') + '" data-tab="registrations">' + t('registrations') + '</button>'
```

Add i18n keys to the admin's internal `translations` object:
```javascript
registrations: adminLang === 'de' ? 'Anmeldungen' : 'Registrations',
registrationsPending: adminLang === 'de' ? 'Ausstehend' : 'Pending',
registrationsApproved: adminLang === 'de' ? 'Genehmigt' : 'Approved',
registrationsRejected: adminLang === 'de' ? 'Abgelehnt' : 'Rejected',
registrationsApprove: adminLang === 'de' ? 'Genehmigen' : 'Approve',
registrationsReject: adminLang === 'de' ? 'Ablehnen' : 'Reject',
registrationsConfirmReject: adminLang === 'de' ? 'Anmeldung wirklich ablehnen? Die Daten werden unwiderruflich gelöscht.' : 'Really reject this registration? Data will be permanently deleted.',
registrationsExportCSV: adminLang === 'de' ? 'CSV Export (ClubDesk)' : 'CSV Export (ClubDesk)',
registrationsGeneratePDF: adminLang === 'de' ? 'Lizenzantrag generieren' : 'Generate Lizenzantrag',
registrationsGenerateFIBA: adminLang === 'de' ? 'FIBA PDFs generieren' : 'Generate FIBA PDFs',
registrationsDownloadFiles: adminLang === 'de' ? 'Dateien herunterladen' : 'Download Files',
registrationsNoEntries: adminLang === 'de' ? 'Keine Anmeldungen vorhanden.' : 'No registrations found.',
registrationsExpiring: adminLang === 'de' ? 'Wird bald gelöscht' : 'Expiring soon',
```

- [ ] **Step 2: Add registrations list loader**

In `loadItems()`, add a case for `currentTab === 'registrations'`. Follow the existing pattern:

```javascript
if (currentTab === 'registrations') {
  // Status filter (default: pending)
  var regStatusFilter = window._regStatusFilter || 'pending';

  var url = DIRECTUS_URL + '/items/registrations'
    + '?filter[status][_eq]=' + regStatusFilter
    + '&sort=-submitted_at&limit=50';

  fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token },
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    renderRegistrationsList(data.data || [], regStatusFilter);
  });
  return;
}
```

- [ ] **Step 3: Implement `renderRegistrationsList(items, statusFilter)`**

Follow the existing `admin-list` DOM pattern. Build using `document.createElement` (not innerHTML) for safety.

```javascript
function renderRegistrationsList(items, statusFilter) {
  var listContainer = document.getElementById('admin-content');

  // Status filter buttons
  var filterDiv = document.createElement('div');
  filterDiv.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;';
  ['pending', 'approved', 'rejected'].forEach(function(s) {
    var btn = document.createElement('button');
    btn.className = 'admin-btn admin-btn-sm' + (statusFilter === s ? ' admin-btn-active' : '');
    btn.textContent = t('registrations' + s.charAt(0).toUpperCase() + s.slice(1));
    btn.addEventListener('click', function() {
      window._regStatusFilter = s;
      loadItems();
    });
    filterDiv.appendChild(btn);
  });

  // CSV export button (only for approved)
  if (statusFilter === 'approved' && items.length > 0) {
    var csvBtn = document.createElement('button');
    csvBtn.className = 'admin-btn admin-btn-sm';
    csvBtn.textContent = t('registrationsExportCSV');
    csvBtn.style.marginLeft = 'auto';
    csvBtn.addEventListener('click', function() { exportCSV(items); });
    filterDiv.appendChild(csvBtn);
  }

  listContainer.innerHTML = '';
  listContainer.appendChild(filterDiv);

  if (!items.length) {
    var empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = t('registrationsNoEntries');
    listContainer.appendChild(empty);
    return;
  }

  var list = document.createElement('div');
  list.className = 'admin-list';

  items.forEach(function(item) {
    var row = document.createElement('div');
    row.className = 'admin-list-item';

    var info = document.createElement('div');
    info.className = 'admin-list-info';

    var title = document.createElement('h3');
    title.className = 'admin-list-title';
    title.textContent = item.vorname + ' ' + item.nachname;

    var meta = document.createElement('div');
    meta.className = 'admin-list-meta';

    var typeBadge = document.createElement('span');
    typeBadge.className = 'admin-badge';
    typeBadge.textContent = item.membership_type;
    meta.appendChild(typeBadge);

    if (item.team) {
      var teamSpan = document.createElement('span');
      teamSpan.textContent = item.team;
      meta.appendChild(teamSpan);
    }

    var dateSpan = document.createElement('span');
    dateSpan.textContent = item.submitted_at ? item.submitted_at.substring(0, 10) : '';
    meta.appendChild(dateSpan);

    // Expiring warning (>75 days old)
    var ageMs = Date.now() - new Date(item.submitted_at).getTime();
    var ageDays = Math.floor(ageMs / 86400000);
    if (ageDays > 75) {
      var warn = document.createElement('span');
      warn.className = 'admin-badge admin-badge-danger';
      warn.textContent = t('registrationsExpiring');
      meta.appendChild(warn);
    }

    info.appendChild(title);
    info.appendChild(meta);
    row.appendChild(info);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'admin-list-actions';

    var editBtn = document.createElement('button');
    editBtn.className = 'admin-btn admin-btn-sm';
    editBtn.textContent = t('edit');
    editBtn.addEventListener('click', function() {
      openRegistrationDetail(item);
    });
    actions.appendChild(editBtn);

    row.appendChild(actions);
    list.appendChild(row);
  });

  listContainer.appendChild(list);
}
```

- [ ] **Step 4: Verify tab renders**

Run: `npm run dev`, login to `/admin`, click "Anmeldungen" tab.
Expected: filter buttons show, list loads (empty if no registrations yet).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin.astro
git commit -m "feat: add registrations list view to admin panel"
```

---

## Task 7: Admin Panel — Registration Detail/Edit View

**Files:**
- Modify: `src/pages/admin.astro`

- [ ] **Step 1: Implement `openRegistrationDetail(item)`**

This opens a modal (following the existing `openModal` pattern) showing all fields as editable inputs. Use the existing `fieldInput`, `fieldSelect`, `fieldTextarea`, `fieldDate` helpers.

```javascript
function openRegistrationDetail(item) {
  var modal = document.getElementById('admin-modal') || createModalElement();

  var html = '<div class="admin-modal-content">' +
    '<form id="modal-form" class="admin-modal-body">' +
    '<h2>' + escapeHtml(item.vorname + ' ' + item.nachname) + '</h2>' +
    '<p class="admin-list-meta"><span class="admin-badge">' + escapeHtml(item.membership_type) + '</span>' +
    '<span class="admin-badge admin-badge-' + (item.status === 'approved' ? 'green' : 'gray') + '">' + escapeHtml(item.status) + '</span></p>' +

    fieldSelect('reg-type', t('registrationType'), [
      {v: 'volleyball', l: 'Volleyball'},
      {v: 'basketball', l: 'Basketball'},
      {v: 'passive', l: 'Passivmitglied'},
    ], item.membership_type) +
    fieldInput('reg-vorname', t('firstName'), item.vorname, true) +
    fieldInput('reg-nachname', t('lastName'), item.nachname, true) +
    fieldInput('reg-email', t('email'), item.email, true) +
    fieldInput('reg-telefon', t('phone'), item.telefon_mobil) +
    fieldInput('reg-adresse', t('address'), item.adresse) +
    fieldInput('reg-plz', 'PLZ', item.plz) +
    fieldInput('reg-ort', t('city'), item.ort) +
    fieldDate('reg-dob', t('birthdate'), item.geburtsdatum) +
    fieldInput('reg-nation', t('nationality'), item.nationalitaet) +
    fieldSelect('reg-gender', t('gender'), [
      {v: 'männlich', l: 'männlich'},
      {v: 'weiblich', l: 'weiblich'},
    ], item.geschlecht) +
    fieldInput('reg-team', t('team'), item.team) +
    fieldInput('reg-fee', t('feeCategory'), item.beitragskategorie) +
    fieldInput('reg-ahv', 'AHV', item.ahv_nummer) +
    fieldInput('reg-ks', t('kantonsschule'), item.kantonsschule) +
    fieldInput('reg-rolle', t('role'), item.rolle) +
    fieldTextarea('reg-bemerkungen', t('comments'), item.bemerkungen) +

    // File previews (basketball)
    (item.id_upload_front ? '<div class="form-group"><label>ID Vorderseite</label>' +
      '<a href="' + DIRECTUS_URL + '/assets/' + escapeAttr(item.id_upload_front) + '" target="_blank" class="admin-btn admin-btn-sm">Ansehen</a></div>' : '') +
    (item.id_upload_back ? '<div class="form-group"><label>ID Rückseite</label>' +
      '<a href="' + DIRECTUS_URL + '/assets/' + escapeAttr(item.id_upload_back) + '" target="_blank" class="admin-btn admin-btn-sm">Ansehen</a></div>' : '') +

    '<div class="admin-modal-footer">' +
    '<button type="button" id="modal-cancel" class="admin-btn">' + t('cancel') + '</button>' +

    // Download files button (if files exist)
    ((item.id_upload_front || item.id_upload_back) ?
      '<button type="button" id="reg-download-files" class="admin-btn admin-btn-sm">' + t('registrationsDownloadFiles') + '</button>' : '') +

    // PDF buttons (basketball only)
    (item.membership_type === 'basketball' ?
      '<button type="button" id="reg-gen-pdf" class="admin-btn admin-btn-sm">' + t('registrationsGeneratePDF') + '</button>' +
      '<button type="button" id="reg-gen-fiba" class="admin-btn admin-btn-sm">' + t('registrationsGenerateFIBA') + '</button>' : '') +

    // Approve/Reject (only for pending)
    (item.status === 'pending' ?
      '<button type="button" id="reg-reject" class="admin-btn admin-btn-danger">' + t('registrationsReject') + '</button>' +
      '<button type="button" id="reg-approve" class="admin-btn admin-btn-primary">' + t('registrationsApprove') + '</button>' : '') +

    // Save (for editing fields)
    '<button type="submit" id="modal-save" class="admin-btn admin-btn-primary">' + t('save') + '</button>' +

    '</div></form></div>';

  // Safe to use innerHTML directly: all dynamic values go through
  // escapeHtml/escapeAttr via fieldInput/fieldSelect/fieldTextarea helpers.
  // Do NOT use DOMPurify here — it strips `id` attributes, breaking
  // the getElementById calls below for button event wiring.
  modal.innerHTML = html;
  modal.style.display = 'flex';

  // ── Event handlers ──
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  // Save (update fields)
  document.getElementById('modal-form').addEventListener('submit', function(e) {
    e.preventDefault();
    saveRegistration(item.id);
  });

  // Approve
  var approveBtn = document.getElementById('reg-approve');
  if (approveBtn) {
    approveBtn.addEventListener('click', function() {
      updateRegistrationStatus(item.id, 'approved');
    });
  }

  // Reject with confirmation
  var rejectBtn = document.getElementById('reg-reject');
  if (rejectBtn) {
    rejectBtn.addEventListener('click', function() {
      if (confirm(t('registrationsConfirmReject'))) {
        updateRegistrationStatus(item.id, 'rejected');
      }
    });
  }

  // Download files
  var dlBtn = document.getElementById('reg-download-files');
  if (dlBtn) {
    dlBtn.addEventListener('click', function() {
      downloadRegistrationFiles(item);
    });
  }

  // PDF generation buttons — wired in Task 9
  var pdfBtn = document.getElementById('reg-gen-pdf');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', function() {
      generateLizenzantrag(item);
    });
  }

  var fibaBtn = document.getElementById('reg-gen-fiba');
  if (fibaBtn) {
    fibaBtn.addEventListener('click', function() {
      generateFIBAPDFs(item);
    });
  }
}
```

- [ ] **Step 2: Implement `saveRegistration(id)`**

Collects edited field values from the modal form and PATCHes the Directus record:

```javascript
async function saveRegistration(id) {
  var saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = t('saving');

  var payload = {
    membership_type: val('reg-type'),
    vorname: val('reg-vorname'),
    nachname: val('reg-nachname'),
    email: val('reg-email'),
    telefon_mobil: val('reg-telefon'),
    adresse: val('reg-adresse'),
    plz: val('reg-plz'),
    ort: val('reg-ort'),
    geburtsdatum: val('reg-dob'),
    nationalitaet: val('reg-nation'),
    geschlecht: val('reg-gender'),
    team: val('reg-team'),
    beitragskategorie: val('reg-fee'),
    ahv_nummer: val('reg-ahv'),
    kantonsschule: val('reg-ks'),
    rolle: val('reg-rolle'),
    bemerkungen: val('reg-bemerkungen'),
  };

  try {
    var token = await getValidToken();
    var res = await fetch(DIRECTUS_URL + '/items/registrations/' + id, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    closeModal();
    loadItems();
  } catch(err) {
    alert(t('saveError') + err.message);
    saveBtn.disabled = false;
    saveBtn.textContent = t('save');
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }
}
```

- [ ] **Step 3: Implement `updateRegistrationStatus(id, status)`**

```javascript
async function updateRegistrationStatus(id, status) {
  try {
    var token = await getValidToken();
    var payload = { status: status };
    if (status === 'approved') {
      payload.approved_at = new Date().toISOString();
      // approved_by from current user
      var userRes = await fetch(DIRECTUS_URL + '/users/me?fields=first_name,last_name', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      var user = (await userRes.json()).data;
      payload.approved_by = user.first_name + ' ' + user.last_name;
    }

    var res = await fetch(DIRECTUS_URL + '/items/registrations/' + id, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    // If rejected, delete associated files first, then the record
    if (status === 'rejected') {
      // Fetch full item to get file IDs
      var itemRes = await fetch(DIRECTUS_URL + '/items/registrations/' + id, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      var itemData = (await itemRes.json()).data;

      // Delete uploaded files
      if (itemData.id_upload_front) {
        await fetch(DIRECTUS_URL + '/files/' + itemData.id_upload_front, {
          method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token },
        });
      }
      if (itemData.id_upload_back) {
        await fetch(DIRECTUS_URL + '/files/' + itemData.id_upload_back, {
          method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token },
        });
      }

      // Delete the registration record
      await fetch(DIRECTUS_URL + '/items/registrations/' + id, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
      });
    }

    closeModal();
    loadItems();
  } catch(err) {
    alert(t('error') + err.message);
  }
}
```

- [ ] **Step 4: Implement `downloadRegistrationFiles(item)`**

```javascript
async function downloadRegistrationFiles(item) {
  var token = await getValidToken();
  var files = [];
  if (item.id_upload_front) files.push({ id: item.id_upload_front, name: 'ID_front' });
  if (item.id_upload_back) files.push({ id: item.id_upload_back, name: 'ID_back' });

  for (var i = 0; i < files.length; i++) {
    var res = await fetch(DIRECTUS_URL + '/assets/' + files[i].id, {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = item.nachname + '_' + item.vorname + '_' + files[i].name;
    a.click();
    URL.revokeObjectURL(url);

    // Delete file from Directus after download
    await fetch(DIRECTUS_URL + '/files/' + files[i].id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token },
    });
  }

  // Clear file references on the registration
  await fetch(DIRECTUS_URL + '/items/registrations/' + item.id, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_upload_front: null, id_upload_back: null }),
  });

  loadItems();
}
```

- [ ] **Step 5: Verify detail view**

Login to `/admin`, click "Anmeldungen", click edit on a test registration.
Expected: modal opens with all fields editable, approve/reject/save buttons work.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin.astro
git commit -m "feat: add registration detail/edit/approve/reject to admin"
```

---

## Task 8: Admin Panel — CSV Export

**Files:**
- Modify: `src/pages/admin.astro`

- [ ] **Step 1: Implement `exportCSV(items)`**

Client-side CSV generation with exact ClubDesk column headers, semicolon separator, UTF-8 BOM.

```javascript
function exportCSV(items) {
  var headers = [
    'Nachname', 'Vorname', 'Anrede', 'E-Mail', 'Telefon Mobil',
    'Adresse', 'PLZ', 'Ort', 'Geburtsdatum', 'Nationalität',
    'Geschlecht', 'AHV Nummer', 'Sektion', 'Status',
    'Beitragskategorie', '[Gruppen]', 'Mittelschule ZH',
    'Funktion', 'Bemerkungen', 'Land'
  ];

  var rows = items.map(function(item) {
    // Format date DD.MM.YYYY (parse by splitting, not new Date(), to avoid timezone issues)
    var dob = '';
    if (item.geburtsdatum) {
      var parts = item.geburtsdatum.split('-'); // YYYY-MM-DD from Directus
      dob = parts[2] + '.' + parts[1] + '.' + parts[0];
    }

    var sektion = item.membership_type === 'volleyball' ? 'Volleyball'
      : item.membership_type === 'basketball' ? 'Basketball' : 'KSCW';
    var status = item.membership_type === 'passive' ? 'Passivmitglied' : 'Aktivmitglied';

    return [
      item.nachname || '',
      item.vorname || '',
      item.anrede || '',
      item.email || '',
      item.telefon_mobil || '',
      item.adresse || '',
      item.plz || '',
      item.ort || '',
      dob,
      item.nationalitaet || '',
      item.geschlecht || '',
      item.ahv_nummer || '',
      sektion,
      status,
      item.beitragskategorie || '',
      item.team || '',
      item.kantonsschule || '',
      item.rolle || '',
      item.bemerkungen || '',
      'Schweiz',
    ].map(csvEscape).join(';');
  });

  // UTF-8 BOM + header + rows
  var csv = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'kscw_anmeldungen_' + new Date().toISOString().substring(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(val) {
  val = String(val);
  if (val.indexOf(';') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }
```

- [ ] **Step 2: Test CSV export**

Login to admin, filter approved registrations, click "CSV Export".
Expected: downloads `.csv` file, open in Excel → columns auto-separated by semicolons, dates in DD.MM.YYYY, headers match ClubDesk.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin.astro
git commit -m "feat: add ClubDesk-compatible CSV export for registrations"
```

---

## Task 9: Admin Panel — PDF Pre-fill (Lizenzantrag)

**Files:**
- Modify: `src/pages/admin.astro` (add pdf-lib CDN script + generation functions)

- [ ] **Step 1: Add pdf-lib CDN to admin.astro**

In the `<head>` section of admin.astro, add:

```html
<script is:inline src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
```

- [ ] **Step 2: Implement `generateLizenzantrag(item)`**

```javascript
async function generateLizenzantrag(item) {
  // Use current (possibly edited) form values from modal
  var data = getModalValues();

  var pdfBytes = await fetch('/docs/demande_licence_d_new.pdf').then(function(r) { return r.arrayBuffer(); });
  var pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
  var form = pdfDoc.getForm();

  // Fill text fields
  try { form.getTextField('undefined').setText('KSC Wiedikon'); } catch(e) {}
  try { form.getTextField('undefined_3').setText(data.nachname); } catch(e) {}
  try { form.getTextField('undefined_4').setText(data.vorname); } catch(e) {}
  try { form.getTextField('undefined_5').setText(data.adresse); } catch(e) {}
  try { form.getTextField('undefined_6').setText(data.plz); } catch(e) {}
  try { form.getTextField('undefined_7').setText(data.ort); } catch(e) {}
  try { form.getTextField('undefined_2').setText(data.email); } catch(e) {}

  // Date of birth (split to avoid timezone issues with new Date())
  if (data.geburtsdatum) {
    var dobParts = data.geburtsdatum.split('-'); // YYYY-MM-DD
    try { form.getTextField('Tag').setText(dobParts[2]); } catch(e) {}
    try { form.getTextField('Monat').setText(dobParts[1]); } catch(e) {}
    try { form.getTextField('Jahr').setText(dobParts[0]); } catch(e) {}
  }

  // Gender checkboxes
  try {
    if (data.geschlecht === 'männlich') form.getCheckBox('Mann').check();
    else if (data.geschlecht === 'weiblich') form.getCheckBox('Frau').check();
  } catch(e) {}

  // Nationality
  try {
    if (data.nationalitaet === 'Schweiz' || data.nationalitaet === 'Schweizerin, Schweizer') {
      form.getCheckBox('Schweiz').check();
    } else {
      form.getCheckBox('Andere').check();
      form.getTextField('KOPIE DES PASSES ODER DER ID BEILAGEN').setText(data.nationalitaet);
    }
  } catch(e) {}

  // New member + player checkboxes
  try { form.getCheckBox('Neues Mitglied Swiss Basketball').check(); } catch(e) {}
  try { form.getCheckBox('undefined10').check(); } catch(e) {} // Spieler

  // Flatten so fields are visible in all readers
  form.flatten();

  var filledPdf = await pdfDoc.save();
  var blob = new Blob([filledPdf], { type: 'application/pdf' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'Lizenzantrag_' + data.nachname + '_' + data.vorname + '.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

function getModalValues() {
  return {
    vorname: (document.getElementById('reg-vorname') || {}).value || '',
    nachname: (document.getElementById('reg-nachname') || {}).value || '',
    email: (document.getElementById('reg-email') || {}).value || '',
    adresse: (document.getElementById('reg-adresse') || {}).value || '',
    plz: (document.getElementById('reg-plz') || {}).value || '',
    ort: (document.getElementById('reg-ort') || {}).value || '',
    geburtsdatum: (document.getElementById('reg-dob') || {}).value || '',
    geschlecht: (document.getElementById('reg-gender') || {}).value || '',
    nationalitaet: (document.getElementById('reg-nation') || {}).value || '',
  };
}
```

- [ ] **Step 3: Implement `generateFIBAPDFs(item)` (optional PDFs)**

Similar pattern for the two FIBA PDFs. Uses field names from the pypdf analysis:

```javascript
async function generateFIBAPDFs(item) {
  var data = getModalValues();

  // Player's Self Declaration
  var pdf1Bytes = await fetch('/docs/player-self-declaration.pdf').then(function(r) { return r.arrayBuffer(); });
  var pdf1 = await PDFLib.PDFDocument.load(pdf1Bytes);
  var form1 = pdf1.getForm();
  try { form1.getTextField('Last Name').setText(data.nachname); } catch(e) {}
  try { form1.getTextField('First Name').setText(data.vorname); } catch(e) {}
  try { form1.getTextField('Nationality').setText(data.nationalitaet); } catch(e) {}
  try { form1.getTextField('Current Club').setText('KSC Wiedikon'); } catch(e) {}
  try { form1.getTextField('Season').setText('2025/2026'); } catch(e) {}
  form1.flatten();
  downloadPdf(await pdf1.save(), 'SelfDeclaration_' + data.nachname + '_' + data.vorname + '.pdf');

  // National Team Declaration
  var pdf2Bytes = await fetch('/docs/national-team-declaration.pdf').then(function(r) { return r.arrayBuffer(); });
  var pdf2 = await PDFLib.PDFDocument.load(pdf2Bytes);
  var form2 = pdf2.getForm();
  try { form2.getTextField('Last Name Nom Nachname').setText(data.nachname); } catch(e) {}
  try { form2.getTextField('First Name Prénom Vorname').setText(data.vorname); } catch(e) {}
  try { form2.getTextField('Date of birth Date de Naissance Geburtsdatum').setText(
    data.geburtsdatum ? formatDateDot(data.geburtsdatum) : ''); } catch(e) {}
  try { form2.getTextField('Nationality Nationalité Nationalität').setText(data.nationalitaet); } catch(e) {}
  try { form2.getTextField('New Club Nouveau club Neuer Club').setText('KSC Wiedikon'); } catch(e) {}
  form2.flatten();
  downloadPdf(await pdf2.save(), 'NationalTeamDecl_' + data.nachname + '_' + data.vorname + '.pdf');
}

function downloadPdf(bytes, filename) {
  var blob = new Blob([bytes], { type: 'application/pdf' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDateDot(dateStr) {
  var parts = dateStr.split('-'); // YYYY-MM-DD
  return parts[2] + '.' + parts[1] + '.' + parts[0];
}
```

- [ ] **Step 4: Test PDF generation**

Open a basketball registration in admin detail view, click "Lizenzantrag generieren".
Expected: PDF downloads with pre-filled name, address, DOB, nationality, checkboxes.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin.astro
git commit -m "feat: add PDF pre-fill for basketball Lizenzantrag + FIBA declarations"
```

---

## Task 10: Update Mitgliedschaft Pages

**Files:**
- Modify: `src/pages/de/weiteres/mitgliedschaft.astro`
- Modify: `src/pages/en/weiteres/mitgliedschaft.astro`

- [ ] **Step 1: Update DE CTA buttons**

In `src/pages/de/weiteres/mitgliedschaft.astro`, replace the three external links (lines ~260-267):

```astro
<!-- Old: external links -->
<!-- <a href="https://www.kscw.ch/weiteres/mitglied_werden/volleyball" ... -->
<!-- <a href="https://forms.gle/v4qNHrQybzpFuXgW9" ... -->
<!-- <a href="https://www.kscw.ch/weiteres/mitglied_werden" ... -->

<!-- New: internal links to registration form -->
<a href="/de/weiteres/anmeldung?type=volleyball" class="btn btn-gold" style="font-size: 1rem; padding: var(--space-md) var(--space-xl);">
  <span>{t(locale, 'membershipRegisterVB')}</span>
</a>
<a href="/de/weiteres/anmeldung?type=basketball" class="btn" style="font-size: 1rem; padding: var(--space-md) var(--space-xl); background: var(--kscw-blue); color: white;">
  <span>{t(locale, 'membershipRegisterBB')}</span>
</a>
<a href="/de/weiteres/anmeldung?type=passive" class="btn btn-outline" style="font-size: 1rem; padding: var(--space-md) var(--space-xl);">
  <span>{t(locale, 'membershipRegisterPassive')}</span>
</a>
```

Also remove `target="_blank" rel="noopener noreferrer"` since these are now internal links.

- [ ] **Step 2: Update EN CTA buttons**

Same changes in `src/pages/en/weiteres/mitgliedschaft.astro` with `/en/weiteres/anmeldung?type=...` paths.

- [ ] **Step 3: Add URL param pre-selection to registration-form.js**

In `public/js/registration-form.js`, add at the **end of the IIFE** (after the `form.addEventListener('submit', ...)` block and `function onTypeChange()` definition), so that all functions are defined before this code runs:

```javascript
// Pre-select type from URL param
var params = new URLSearchParams(window.location.search);
var prefillType = params.get('type');
if (prefillType) {
  var radio = form.querySelector('input[name="membership_type"][value="' + prefillType + '"]');
  if (radio) {
    radio.checked = true;
    onTypeChange();
  }
}
```

- [ ] **Step 4: Verify links work**

Navigate to `/de/weiteres/mitgliedschaft`, click each CTA button.
Expected: navigates to `/de/weiteres/anmeldung` with correct type pre-selected.

- [ ] **Step 5: Commit**

```bash
git add src/pages/de/weiteres/mitgliedschaft.astro src/pages/en/weiteres/mitgliedschaft.astro public/js/registration-form.js
git commit -m "feat: update mitgliedschaft CTAs to use internal registration form"
```

---

## Task 11: Build Verification

- [ ] **Step 1: Run production build**

```bash
npx astro build
```

Expected: builds successfully with no errors.

- [ ] **Step 2: Check for broken links**

Verify all internal links resolve:
- `/de/weiteres/anmeldung` exists
- `/en/weiteres/anmeldung` exists
- `/de/weiteres/mitgliedschaft` CTA buttons point to internal URLs
- `/admin` loads with new "Anmeldungen" tab

- [ ] **Step 3: Commit if any fixes needed**

---

## Execution Order & Dependencies

```
Task 1 (i18n) ─── no deps
Task 5 (PDFs) ─── no deps
     │
Task 2 (DE page) ← Task 1
Task 3 (EN page) ← Task 1
Task 4 (Form JS) ← Task 1
     │
Task 6 (Admin list) ← Task 1
Task 7 (Admin detail) ← Task 6
Task 8 (CSV export) ← Task 6
Task 9 (PDF pre-fill) ← Task 5, Task 7
     │
Task 10 (Update mitgliedschaft) ← Task 4
Task 11 (Build verification) ← all
```

Tasks 1 and 5 can run in parallel. Tasks 2, 3, 4 can run in parallel after Task 1. Tasks 6-9 are sequential. Task 10 can run after Task 4.
