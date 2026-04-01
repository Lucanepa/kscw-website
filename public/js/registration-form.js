/**
 * KSCW Registration Form — Membership Type Switching + File Upload + Submission
 *
 * Reads URL params (?type=volleyball) to pre-fill membership type.
 * Fetches active teams from Directus when a sport type is selected.
 * Submits to POST /kscw/registration with Turnstile CAPTCHA (multipart/form-data).
 */
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

    var consent = document.getElementById('consent');
    if (!consent || !consent.checked) return showFeedback('error', i18n.t('registrationValidationConsent'));

    var turnstileToken = '';
    if (window.turnstile && turnstileWidgetId !== null) {
      turnstileToken = window.turnstile.getResponse(turnstileWidgetId) || '';
    }
    if (!turnstileToken) return showFeedback('error', i18n.t('registrationValidationCaptcha'));

    if (type === 'basketball') {
      var front = document.getElementById('id-front');
      var back = document.getElementById('id-back');
      if (!front.files.length || !back.files.length) {
        return showFeedback('error', i18n.t('registrationValidationID'));
      }
    }

    setLoading(true);

    // Build JSON payload (not FormData — files uploaded separately)
    var payload = {
      membership_type: type,
      vorname: val('vorname'),
      nachname: val('nachname'),
      email: val('email'),
      telefon_mobil: val('telefon'),
      adresse: val('adresse'),
      plz: val('plz'),
      ort: val('ort'),
      geburtsdatum: val('geburtsdatum'),
      nationalitaet: getNationality(),
      geschlecht: val('geschlecht'),
      bemerkungen: val('bemerkungen'),
      turnstile_token: turnstileToken,
    };

    if (type === 'volleyball') {
      payload.anrede = val('anrede');
      payload.team = val('vb-team');
      payload.beitragskategorie = val('vb-fee');
      payload.ahv_nummer = val('vb-ahv');
      payload.kantonsschule = val('kantonsschule-vb');
      var rollen = [];
      form.querySelectorAll('input[name="rolle"]:checked').forEach(function (cb) {
        rollen.push(cb.value);
      });
      if (rollen.length) payload.rolle = rollen.join(', ');
    }

    if (type === 'basketball') {
      payload.team = val('bb-team');
      payload.beitragskategorie = val('bb-fee');
      payload.ahv_nummer = val('bb-ahv');
      payload.kantonsschule = val('kantonsschule-bb');
    }

    // Step 1: Create registration (JSON)
    fetch(DIRECTUS_URL + '/kscw/registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.message || d.error || i18n.t('registrationError')); });
        return r.json();
      })
      .then(function (data) {
        // Step 2: Upload files for basketball (if any)
        if (type === 'basketball') {
          return uploadIDFiles(data.id);
        }
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

  // ── File upload (basketball) ───────────────────────────────
  function uploadIDFiles(registrationId) {
    var frontFile = document.getElementById('id-front').files[0];
    var backFile = document.getElementById('id-back').files[0];
    if (!frontFile && !backFile) return Promise.resolve();

    var uploads = [];
    if (frontFile) uploads.push(uploadSingleFile(frontFile, 'front'));
    if (backFile) uploads.push(uploadSingleFile(backFile, 'back'));

    return Promise.all(uploads).then(function (fileIds) {
      var body = {};
      if (fileIds[0]) body.id_upload_front = fileIds[0];
      if (fileIds[1]) body.id_upload_back = fileIds[1];

      return fetch(DIRECTUS_URL + '/kscw/registration/' + registrationId + '/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    });
  }

  function uploadSingleFile(file) {
    var fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'registrations');
    return fetch(DIRECTUS_URL + '/files', {
      method: 'POST',
      body: fd,
    })
      .then(function (r) {
        if (!r.ok) throw new Error('File upload failed');
        return r.json();
      })
      .then(function (data) {
        return data.data.id;
      });
  }

  // ── Helpers ───────────────────────────────────────────────
  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  function getNationality() {
    var sel = val('nationalitaet');
    if (sel === 'other') {
      return val('nationalitaet-other') || 'Andere';
    }
    return sel;
  }

  // ── Nationality "other" toggle ────────────────────────────
  var natSelect = document.getElementById('nationalitaet');
  var natOtherGroup = document.getElementById('nationality-other-group');
  if (natSelect && natOtherGroup) {
    natSelect.addEventListener('change', function () {
      natOtherGroup.style.display = natSelect.value === 'other' ? '' : 'none';
    });
  }

  // ── URL param pre-selection ───────────────────────────────
  var params = new URLSearchParams(window.location.search);
  var prefillType = params.get('type');
  if (prefillType) {
    var radio = form.querySelector('input[name="membership_type"][value="' + prefillType + '"]');
    if (radio) {
      radio.checked = true;
      onTypeChange();
    }
  }
})();
