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
  var locale = document.documentElement.lang || 'de';

  if (!form) return;

  // ── Country data (ISO code → dial code, DE name, EN name) ──────────
  var FAVORITE_CODES = ['CH', 'DE', 'FR', 'AT', 'IT'];

  var COUNTRIES = [
    { code: 'AF', dial: '+93', de: 'Afghanistan', en: 'Afghanistan' },
    { code: 'EG', dial: '+20', de: 'Ägypten', en: 'Egypt' },
    { code: 'AL', dial: '+355', de: 'Albanien', en: 'Albania' },
    { code: 'DZ', dial: '+213', de: 'Algerien', en: 'Algeria' },
    { code: 'AD', dial: '+376', de: 'Andorra', en: 'Andorra' },
    { code: 'AO', dial: '+244', de: 'Angola', en: 'Angola' },
    { code: 'AG', dial: '+1-268', de: 'Antigua und Barbuda', en: 'Antigua and Barbuda' },
    { code: 'GQ', dial: '+240', de: 'Äquatorialguinea', en: 'Equatorial Guinea' },
    { code: 'AR', dial: '+54', de: 'Argentinien', en: 'Argentina' },
    { code: 'AM', dial: '+374', de: 'Armenien', en: 'Armenia' },
    { code: 'AZ', dial: '+994', de: 'Aserbaidschan', en: 'Azerbaijan' },
    { code: 'ET', dial: '+251', de: 'Äthiopien', en: 'Ethiopia' },
    { code: 'AU', dial: '+61', de: 'Australien', en: 'Australia' },
    { code: 'BS', dial: '+1-242', de: 'Bahamas', en: 'Bahamas' },
    { code: 'BH', dial: '+973', de: 'Bahrain', en: 'Bahrain' },
    { code: 'BD', dial: '+880', de: 'Bangladesch', en: 'Bangladesh' },
    { code: 'BB', dial: '+1-246', de: 'Barbados', en: 'Barbados' },
    { code: 'BY', dial: '+375', de: 'Belarus', en: 'Belarus' },
    { code: 'BE', dial: '+32', de: 'Belgien', en: 'Belgium' },
    { code: 'BZ', dial: '+501', de: 'Belize', en: 'Belize' },
    { code: 'BJ', dial: '+229', de: 'Benin', en: 'Benin' },
    { code: 'BT', dial: '+975', de: 'Bhutan', en: 'Bhutan' },
    { code: 'BO', dial: '+591', de: 'Bolivien', en: 'Bolivia' },
    { code: 'BA', dial: '+387', de: 'Bosnien und Herzegowina', en: 'Bosnia and Herzegovina' },
    { code: 'BW', dial: '+267', de: 'Botswana', en: 'Botswana' },
    { code: 'BR', dial: '+55', de: 'Brasilien', en: 'Brazil' },
    { code: 'BN', dial: '+673', de: 'Brunei', en: 'Brunei' },
    { code: 'BG', dial: '+359', de: 'Bulgarien', en: 'Bulgaria' },
    { code: 'BF', dial: '+226', de: 'Burkina Faso', en: 'Burkina Faso' },
    { code: 'BI', dial: '+257', de: 'Burundi', en: 'Burundi' },
    { code: 'CL', dial: '+56', de: 'Chile', en: 'Chile' },
    { code: 'CN', dial: '+86', de: 'China', en: 'China' },
    { code: 'CR', dial: '+506', de: 'Costa Rica', en: 'Costa Rica' },
    { code: 'CI', dial: '+225', de: 'Côte d\'Ivoire', en: 'Côte d\'Ivoire' },
    { code: 'DK', dial: '+45', de: 'Dänemark', en: 'Denmark' },
    { code: 'DE', dial: '+49', de: 'Deutschland', en: 'Germany' },
    { code: 'DM', dial: '+1-767', de: 'Dominica', en: 'Dominica' },
    { code: 'DO', dial: '+1-809', de: 'Dominikanische Republik', en: 'Dominican Republic' },
    { code: 'DJ', dial: '+253', de: 'Dschibuti', en: 'Djibouti' },
    { code: 'EC', dial: '+593', de: 'Ecuador', en: 'Ecuador' },
    { code: 'SV', dial: '+503', de: 'El Salvador', en: 'El Salvador' },
    { code: 'ER', dial: '+291', de: 'Eritrea', en: 'Eritrea' },
    { code: 'EE', dial: '+372', de: 'Estland', en: 'Estonia' },
    { code: 'SZ', dial: '+268', de: 'Eswatini', en: 'Eswatini' },
    { code: 'FJ', dial: '+679', de: 'Fidschi', en: 'Fiji' },
    { code: 'FI', dial: '+358', de: 'Finnland', en: 'Finland' },
    { code: 'FR', dial: '+33', de: 'Frankreich', en: 'France' },
    { code: 'GA', dial: '+241', de: 'Gabun', en: 'Gabon' },
    { code: 'GM', dial: '+220', de: 'Gambia', en: 'Gambia' },
    { code: 'GE', dial: '+995', de: 'Georgien', en: 'Georgia' },
    { code: 'GH', dial: '+233', de: 'Ghana', en: 'Ghana' },
    { code: 'GD', dial: '+1-473', de: 'Grenada', en: 'Grenada' },
    { code: 'GR', dial: '+30', de: 'Griechenland', en: 'Greece' },
    { code: 'GT', dial: '+502', de: 'Guatemala', en: 'Guatemala' },
    { code: 'GN', dial: '+224', de: 'Guinea', en: 'Guinea' },
    { code: 'GW', dial: '+245', de: 'Guinea-Bissau', en: 'Guinea-Bissau' },
    { code: 'GY', dial: '+592', de: 'Guyana', en: 'Guyana' },
    { code: 'HT', dial: '+509', de: 'Haiti', en: 'Haiti' },
    { code: 'HN', dial: '+504', de: 'Honduras', en: 'Honduras' },
    { code: 'IN', dial: '+91', de: 'Indien', en: 'India' },
    { code: 'ID', dial: '+62', de: 'Indonesien', en: 'Indonesia' },
    { code: 'IQ', dial: '+964', de: 'Irak', en: 'Iraq' },
    { code: 'IR', dial: '+98', de: 'Iran', en: 'Iran' },
    { code: 'IE', dial: '+353', de: 'Irland', en: 'Ireland' },
    { code: 'IS', dial: '+354', de: 'Island', en: 'Iceland' },
    { code: 'IL', dial: '+972', de: 'Israel', en: 'Israel' },
    { code: 'IT', dial: '+39', de: 'Italien', en: 'Italy' },
    { code: 'JM', dial: '+1-876', de: 'Jamaika', en: 'Jamaica' },
    { code: 'JP', dial: '+81', de: 'Japan', en: 'Japan' },
    { code: 'YE', dial: '+967', de: 'Jemen', en: 'Yemen' },
    { code: 'JO', dial: '+962', de: 'Jordanien', en: 'Jordan' },
    { code: 'KH', dial: '+855', de: 'Kambodscha', en: 'Cambodia' },
    { code: 'CM', dial: '+237', de: 'Kamerun', en: 'Cameroon' },
    { code: 'CA', dial: '+1', de: 'Kanada', en: 'Canada' },
    { code: 'CV', dial: '+238', de: 'Kap Verde', en: 'Cape Verde' },
    { code: 'KZ', dial: '+7', de: 'Kasachstan', en: 'Kazakhstan' },
    { code: 'QA', dial: '+974', de: 'Katar', en: 'Qatar' },
    { code: 'KE', dial: '+254', de: 'Kenia', en: 'Kenya' },
    { code: 'KG', dial: '+996', de: 'Kirgisistan', en: 'Kyrgyzstan' },
    { code: 'KI', dial: '+686', de: 'Kiribati', en: 'Kiribati' },
    { code: 'CO', dial: '+57', de: 'Kolumbien', en: 'Colombia' },
    { code: 'KM', dial: '+269', de: 'Komoren', en: 'Comoros' },
    { code: 'CD', dial: '+243', de: 'Kongo (Dem. Rep.)', en: 'Congo (DRC)' },
    { code: 'CG', dial: '+242', de: 'Kongo (Rep.)', en: 'Congo (Republic)' },
    { code: 'XK', dial: '+383', de: 'Kosovo', en: 'Kosovo' },
    { code: 'HR', dial: '+385', de: 'Kroatien', en: 'Croatia' },
    { code: 'CU', dial: '+53', de: 'Kuba', en: 'Cuba' },
    { code: 'KW', dial: '+965', de: 'Kuwait', en: 'Kuwait' },
    { code: 'LA', dial: '+856', de: 'Laos', en: 'Laos' },
    { code: 'LS', dial: '+266', de: 'Lesotho', en: 'Lesotho' },
    { code: 'LV', dial: '+371', de: 'Lettland', en: 'Latvia' },
    { code: 'LB', dial: '+961', de: 'Libanon', en: 'Lebanon' },
    { code: 'LR', dial: '+231', de: 'Liberia', en: 'Liberia' },
    { code: 'LY', dial: '+218', de: 'Libyen', en: 'Libya' },
    { code: 'LI', dial: '+423', de: 'Liechtenstein', en: 'Liechtenstein' },
    { code: 'LT', dial: '+370', de: 'Litauen', en: 'Lithuania' },
    { code: 'LU', dial: '+352', de: 'Luxemburg', en: 'Luxembourg' },
    { code: 'MG', dial: '+261', de: 'Madagaskar', en: 'Madagascar' },
    { code: 'MW', dial: '+265', de: 'Malawi', en: 'Malawi' },
    { code: 'MY', dial: '+60', de: 'Malaysia', en: 'Malaysia' },
    { code: 'MV', dial: '+960', de: 'Malediven', en: 'Maldives' },
    { code: 'ML', dial: '+223', de: 'Mali', en: 'Mali' },
    { code: 'MT', dial: '+356', de: 'Malta', en: 'Malta' },
    { code: 'MA', dial: '+212', de: 'Marokko', en: 'Morocco' },
    { code: 'MH', dial: '+692', de: 'Marshallinseln', en: 'Marshall Islands' },
    { code: 'MR', dial: '+222', de: 'Mauretanien', en: 'Mauritania' },
    { code: 'MU', dial: '+230', de: 'Mauritius', en: 'Mauritius' },
    { code: 'MX', dial: '+52', de: 'Mexiko', en: 'Mexico' },
    { code: 'FM', dial: '+691', de: 'Mikronesien', en: 'Micronesia' },
    { code: 'MD', dial: '+373', de: 'Moldau', en: 'Moldova' },
    { code: 'MC', dial: '+377', de: 'Monaco', en: 'Monaco' },
    { code: 'MN', dial: '+976', de: 'Mongolei', en: 'Mongolia' },
    { code: 'ME', dial: '+382', de: 'Montenegro', en: 'Montenegro' },
    { code: 'MZ', dial: '+258', de: 'Mosambik', en: 'Mozambique' },
    { code: 'MM', dial: '+95', de: 'Myanmar', en: 'Myanmar' },
    { code: 'NA', dial: '+264', de: 'Namibia', en: 'Namibia' },
    { code: 'NR', dial: '+674', de: 'Nauru', en: 'Nauru' },
    { code: 'NP', dial: '+977', de: 'Nepal', en: 'Nepal' },
    { code: 'NZ', dial: '+64', de: 'Neuseeland', en: 'New Zealand' },
    { code: 'NI', dial: '+505', de: 'Nicaragua', en: 'Nicaragua' },
    { code: 'NL', dial: '+31', de: 'Niederlande', en: 'Netherlands' },
    { code: 'NE', dial: '+227', de: 'Niger', en: 'Niger' },
    { code: 'NG', dial: '+234', de: 'Nigeria', en: 'Nigeria' },
    { code: 'KP', dial: '+850', de: 'Nordkorea', en: 'North Korea' },
    { code: 'MK', dial: '+389', de: 'Nordmazedonien', en: 'North Macedonia' },
    { code: 'NO', dial: '+47', de: 'Norwegen', en: 'Norway' },
    { code: 'OM', dial: '+968', de: 'Oman', en: 'Oman' },
    { code: 'AT', dial: '+43', de: 'Österreich', en: 'Austria' },
    { code: 'PK', dial: '+92', de: 'Pakistan', en: 'Pakistan' },
    { code: 'PW', dial: '+680', de: 'Palau', en: 'Palau' },
    { code: 'PS', dial: '+970', de: 'Palästina', en: 'Palestine' },
    { code: 'PA', dial: '+507', de: 'Panama', en: 'Panama' },
    { code: 'PG', dial: '+675', de: 'Papua-Neuguinea', en: 'Papua New Guinea' },
    { code: 'PY', dial: '+595', de: 'Paraguay', en: 'Paraguay' },
    { code: 'PE', dial: '+51', de: 'Peru', en: 'Peru' },
    { code: 'PH', dial: '+63', de: 'Philippinen', en: 'Philippines' },
    { code: 'PL', dial: '+48', de: 'Polen', en: 'Poland' },
    { code: 'PT', dial: '+351', de: 'Portugal', en: 'Portugal' },
    { code: 'RW', dial: '+250', de: 'Ruanda', en: 'Rwanda' },
    { code: 'RO', dial: '+40', de: 'Rumänien', en: 'Romania' },
    { code: 'RU', dial: '+7', de: 'Russland', en: 'Russia' },
    { code: 'SB', dial: '+677', de: 'Salomonen', en: 'Solomon Islands' },
    { code: 'ZM', dial: '+260', de: 'Sambia', en: 'Zambia' },
    { code: 'WS', dial: '+685', de: 'Samoa', en: 'Samoa' },
    { code: 'SM', dial: '+378', de: 'San Marino', en: 'San Marino' },
    { code: 'ST', dial: '+239', de: 'São Tomé und Príncipe', en: 'São Tomé and Príncipe' },
    { code: 'SA', dial: '+966', de: 'Saudi-Arabien', en: 'Saudi Arabia' },
    { code: 'SE', dial: '+46', de: 'Schweden', en: 'Sweden' },
    { code: 'CH', dial: '+41', de: 'Schweiz', en: 'Switzerland' },
    { code: 'SN', dial: '+221', de: 'Senegal', en: 'Senegal' },
    { code: 'RS', dial: '+381', de: 'Serbien', en: 'Serbia' },
    { code: 'SC', dial: '+248', de: 'Seychellen', en: 'Seychelles' },
    { code: 'SL', dial: '+232', de: 'Sierra Leone', en: 'Sierra Leone' },
    { code: 'SG', dial: '+65', de: 'Singapur', en: 'Singapore' },
    { code: 'SK', dial: '+421', de: 'Slowakei', en: 'Slovakia' },
    { code: 'SI', dial: '+386', de: 'Slowenien', en: 'Slovenia' },
    { code: 'SO', dial: '+252', de: 'Somalia', en: 'Somalia' },
    { code: 'ES', dial: '+34', de: 'Spanien', en: 'Spain' },
    { code: 'LK', dial: '+94', de: 'Sri Lanka', en: 'Sri Lanka' },
    { code: 'KN', dial: '+1-869', de: 'St. Kitts und Nevis', en: 'Saint Kitts and Nevis' },
    { code: 'LC', dial: '+1-758', de: 'St. Lucia', en: 'Saint Lucia' },
    { code: 'VC', dial: '+1-784', de: 'St. Vincent und die Grenadinen', en: 'Saint Vincent and the Grenadines' },
    { code: 'ZA', dial: '+27', de: 'Südafrika', en: 'South Africa' },
    { code: 'SD', dial: '+249', de: 'Sudan', en: 'Sudan' },
    { code: 'KR', dial: '+82', de: 'Südkorea', en: 'South Korea' },
    { code: 'SS', dial: '+211', de: 'Südsudan', en: 'South Sudan' },
    { code: 'SR', dial: '+597', de: 'Suriname', en: 'Suriname' },
    { code: 'SY', dial: '+963', de: 'Syrien', en: 'Syria' },
    { code: 'TJ', dial: '+992', de: 'Tadschikistan', en: 'Tajikistan' },
    { code: 'TW', dial: '+886', de: 'Taiwan', en: 'Taiwan' },
    { code: 'TZ', dial: '+255', de: 'Tansania', en: 'Tanzania' },
    { code: 'TH', dial: '+66', de: 'Thailand', en: 'Thailand' },
    { code: 'TL', dial: '+670', de: 'Timor-Leste', en: 'Timor-Leste' },
    { code: 'TG', dial: '+228', de: 'Togo', en: 'Togo' },
    { code: 'TO', dial: '+676', de: 'Tonga', en: 'Tonga' },
    { code: 'TT', dial: '+1-868', de: 'Trinidad und Tobago', en: 'Trinidad and Tobago' },
    { code: 'TD', dial: '+235', de: 'Tschad', en: 'Chad' },
    { code: 'CZ', dial: '+420', de: 'Tschechien', en: 'Czech Republic' },
    { code: 'TN', dial: '+216', de: 'Tunesien', en: 'Tunisia' },
    { code: 'TR', dial: '+90', de: 'Türkei', en: 'Turkey' },
    { code: 'TM', dial: '+993', de: 'Turkmenistan', en: 'Turkmenistan' },
    { code: 'TV', dial: '+688', de: 'Tuvalu', en: 'Tuvalu' },
    { code: 'UG', dial: '+256', de: 'Uganda', en: 'Uganda' },
    { code: 'UA', dial: '+380', de: 'Ukraine', en: 'Ukraine' },
    { code: 'HU', dial: '+36', de: 'Ungarn', en: 'Hungary' },
    { code: 'UY', dial: '+598', de: 'Uruguay', en: 'Uruguay' },
    { code: 'UZ', dial: '+998', de: 'Usbekistan', en: 'Uzbekistan' },
    { code: 'VU', dial: '+678', de: 'Vanuatu', en: 'Vanuatu' },
    { code: 'VA', dial: '+39', de: 'Vatikanstadt', en: 'Vatican City' },
    { code: 'VE', dial: '+58', de: 'Venezuela', en: 'Venezuela' },
    { code: 'AE', dial: '+971', de: 'Vereinigte Arabische Emirate', en: 'United Arab Emirates' },
    { code: 'US', dial: '+1', de: 'Vereinigte Staaten', en: 'United States' },
    { code: 'GB', dial: '+44', de: 'Vereinigtes Königreich', en: 'United Kingdom' },
    { code: 'VN', dial: '+84', de: 'Vietnam', en: 'Vietnam' },
    { code: 'CF', dial: '+236', de: 'Zentralafrikanische Republik', en: 'Central African Republic' },
    { code: 'CY', dial: '+357', de: 'Zypern', en: 'Cyprus' },
    { code: 'ZW', dial: '+263', de: 'Simbabwe', en: 'Zimbabwe' }
  ];

  function countryName(c) { return c[locale] || c.de; }

  // Build sorted lists: favorites first, then alphabetical rest
  var favorites = COUNTRIES.filter(function (c) { return FAVORITE_CODES.indexOf(c.code) !== -1; });
  favorites.sort(function (a, b) { return FAVORITE_CODES.indexOf(a.code) - FAVORITE_CODES.indexOf(b.code); });
  var rest = COUNTRIES.filter(function (c) { return FAVORITE_CODES.indexOf(c.code) === -1; });
  rest.sort(function (a, b) { return countryName(a).localeCompare(countryName(b), locale); });

  // ── Searchable nationality dropdown ──────────────────────────
  var natWrapper = document.querySelector('.nationality-wrapper');
  var natTrigger = document.getElementById('nationality-trigger');
  var natTriggerText = document.getElementById('nationality-trigger-text');
  var natDropdown = document.getElementById('nationality-dropdown');
  var natSearch = document.getElementById('nationality-search');
  var natOptions = document.getElementById('nationality-options');
  var natHidden = document.getElementById('nationalitaet');

  function renderNationalityOptions(filter) {
    natOptions.innerHTML = '';
    var q = (filter || '').toLowerCase();
    var highlighted = 0;

    function addOption(c) {
      var name = countryName(c);
      if (q && name.toLowerCase().indexOf(q) === -1 && c.code.toLowerCase().indexOf(q) === -1) return false;
      var div = document.createElement('div');
      div.className = 'nationality-opt' + (natHidden.value === name ? ' selected' : '');
      div.textContent = name;
      div.dataset.value = name;
      div.dataset.code = c.code;
      div.addEventListener('click', function () { selectNationality(name, c.code); });
      natOptions.appendChild(div);
      highlighted++;
      return true;
    }

    // Favorites
    var anyFav = false;
    for (var i = 0; i < favorites.length; i++) {
      if (addOption(favorites[i])) anyFav = true;
    }

    // Divider
    if (anyFav && !q) {
      var hr = document.createElement('hr');
      hr.className = 'nationality-divider';
      natOptions.appendChild(hr);
    }

    // Rest
    for (var j = 0; j < rest.length; j++) {
      addOption(rest[j]);
    }
  }

  function selectNationality(name, code) {
    natHidden.value = name;
    natTriggerText.textContent = name;
    natWrapper.classList.remove('open');
    natSearch.value = '';
    // Trigger foreign docs visibility
    updateForeignDocs(code);
  }

  if (natTrigger) {
    natTrigger.addEventListener('click', function (e) {
      e.preventDefault();
      var isOpen = natWrapper.classList.toggle('open');
      if (isOpen) {
        renderNationalityOptions('');
        natSearch.focus();
      }
    });
  }

  if (natSearch) {
    natSearch.addEventListener('input', function () {
      renderNationalityOptions(natSearch.value);
    });
    natSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        natWrapper.classList.remove('open');
      }
    });
  }

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (natWrapper && !natWrapper.contains(e.target)) {
      natWrapper.classList.remove('open');
    }
  });

  // ── Phone country code dropdown ──────────────────────────────
  var phoneInput = document.getElementById('telefon');
  if (phoneInput) {
    // Wrap the existing input in a phone group
    var phoneGroup = phoneInput.parentElement;
    var phoneRow = document.createElement('div');
    phoneRow.style.cssText = 'display: flex; gap: 0;';

    var phoneSelect = document.createElement('select');
    phoneSelect.className = 'form-select';
    phoneSelect.id = 'phone-country';
    phoneSelect.style.cssText = 'width: auto; border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: none; flex-shrink: 0; padding-right: 1.5rem;';

    // Build phone options: dial code only, favorites first, then rest
    function addPhoneOpt(c) {
      var opt = document.createElement('option');
      opt.value = c.dial;
      opt.textContent = c.dial;
      opt.dataset.code = c.code;
      phoneSelect.appendChild(opt);
    }
    for (var pi = 0; pi < favorites.length; pi++) addPhoneOpt(favorites[pi]);
    var divOpt = document.createElement('option');
    divOpt.disabled = true;
    divOpt.textContent = '──────────';
    phoneSelect.appendChild(divOpt);
    for (var pj = 0; pj < rest.length; pj++) addPhoneOpt(rest[pj]);

    // Default to CH
    phoneSelect.value = '+41';

    phoneInput.style.cssText = 'border-top-left-radius: 0; border-bottom-left-radius: 0; flex: 1; min-width: 0;';
    phoneInput.placeholder = '79 123 45 67';

    phoneRow.appendChild(phoneSelect);
    phoneRow.appendChild(phoneInput);
    phoneGroup.appendChild(phoneRow);
  }

  // ── Auto-derive Anrede from Geschlecht ───────────────────────
  var geschlechtSelect = document.getElementById('geschlecht');
  var anredeHidden = document.getElementById('anrede');
  if (geschlechtSelect && anredeHidden) {
    geschlechtSelect.addEventListener('change', function () {
      if (geschlechtSelect.value === 'männlich') anredeHidden.value = 'Herr';
      else if (geschlechtSelect.value === 'weiblich') anredeHidden.value = 'Frau';
      else anredeHidden.value = '';
    });
  }

  // ── Foreign docs toggle (basketball) ─────────────────────────
  function updateForeignDocs(countryCode) {
    var foreignDocs = document.querySelectorAll('.bb-doc-foreign');
    var isForeign = countryCode !== 'CH';
    for (var i = 0; i < foreignDocs.length; i++) {
      foreignDocs[i].style.display = isForeign ? '' : 'none';
    }
  }

  // ── VB Referee level toggle ───────────────────────────────
  var vbRefCheck = document.getElementById('vb-ref-check');
  var vbRefLevelGroup = document.getElementById('vb-ref-level-group');
  if (vbRefCheck && vbRefLevelGroup) {
    vbRefCheck.addEventListener('change', function () {
      vbRefLevelGroup.style.display = vbRefCheck.checked ? '' : 'none';
      if (!vbRefCheck.checked) {
        var sel = document.getElementById('vb-ref-level');
        if (sel) sel.selectedIndex = 0;
      }
    });
  }

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
      if (!front.files.length) {
        return showFeedback('error', i18n.t('registrationValidationID'));
      }
    }

    setLoading(true);

    // Build full phone number with country code
    var phoneCode = document.getElementById('phone-country');
    var phoneNum = val('telefon');
    var fullPhone = phoneCode ? (phoneCode.value + ' ' + phoneNum) : phoneNum;

    // Build JSON payload
    var payload = {
      membership_type: type,
      vorname: val('vorname'),
      nachname: val('nachname'),
      email: val('email'),
      telefon_mobil: fullPhone,
      adresse: val('adresse'),
      plz: val('plz'),
      ort: val('ort'),
      geburtsdatum: val('geburtsdatum'),
      nationalitaet: natHidden ? natHidden.value : '',
      geschlecht: val('geschlecht'),
      bemerkungen: val('bemerkungen'),
      turnstile_token: turnstileToken,
    };

    if (type === 'volleyball') {
      payload.anrede = anredeHidden ? anredeHidden.value : '';
      payload.team = val('vb-team');
      payload.beitragskategorie = val('vb-fee');
      payload.ahv_nummer = val('vb-ahv');
      payload.kantonsschule = val('kantonsschule-vb');
      var lizenzVbChecked = [];
      form.querySelectorAll('input[name="lizenz_vb"]:checked').forEach(function (cb) {
        lizenzVbChecked.push(cb.value);
      });
      if (lizenzVbChecked.length) payload.lizenz = lizenzVbChecked.join(', ');
      var refLevel = val('vb-ref-level');
      if (refLevel) payload.schiedsrichter_stufe = refLevel;
    }

    if (type === 'basketball') {
      payload.team = val('bb-team');
      payload.beitragskategorie = val('bb-fee');
      payload.ahv_nummer = val('bb-ahv');
      payload.kantonsschule = val('kantonsschule-bb');
      payload.lizenz = val('bb-lizenz');
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
        // Reset custom UI
        if (natTriggerText) natTriggerText.textContent = '—';
        if (natHidden) natHidden.value = '';
        if (phoneCode) phoneCode.value = '+41';
        vbFields.style.display = 'none';
        bbFields.style.display = 'none';
        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
      })
      .catch(function (err) {
        showFeedback('error', err.message || i18n.t('registrationError'));
        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
      })
      .finally(function () {
        setLoading(false);
      });
  });

  // ── File validation + upload (basketball) ──────────────────
  var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  var MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  function validateFile(file) {
    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      throw new Error(locale === 'de'
        ? 'Ungültiger Dateityp. Erlaubt: JPG, PNG, WebP, PDF.'
        : 'Invalid file type. Allowed: JPG, PNG, WebP, PDF.');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(locale === 'de'
        ? 'Datei zu gross (max. 10 MB).'
        : 'File too large (max 10 MB).');
    }
  }

  function uploadIDFiles(registrationId) {
    var frontFile = document.getElementById('id-front').files[0];
    var backEl = document.getElementById('id-back');
    var backFile = backEl ? backEl.files[0] : null;
    if (!frontFile && !backFile) return Promise.resolve();

    // Validate before uploading
    if (frontFile) validateFile(frontFile);
    if (backFile) validateFile(backFile);

    var uploads = [];
    if (frontFile) uploads.push(uploadSingleFile(frontFile));
    if (backFile) uploads.push(uploadSingleFile(backFile));

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

  // ── PDF pre-fill (basketball docs) ────────────────────────
  // Uses pdf-lib loaded on demand
  var pdfLibLoaded = false;

  function loadPdfLib() {
    if (pdfLibLoaded) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = '/js/pdf-lib.min.js';
      script.onload = function () { pdfLibLoaded = true; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function getFormValues() {
    return {
      vorname: val('vorname'),
      nachname: val('nachname'),
      email: val('email'),
      adresse: val('adresse'),
      plz: val('plz'),
      ort: val('ort'),
      geburtsdatum: val('geburtsdatum'),
      nationalitaet: natHidden ? natHidden.value : '',
      geschlecht: val('geschlecht'),
    };
  }

  function downloadPrefilled(pdfUrl, filename, fillFn) {
    loadPdfLib().then(function () {
      return fetch(pdfUrl).then(function (r) { return r.arrayBuffer(); });
    }).then(function (bytes) {
      return PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    }).then(function (pdfDoc) {
      var formData = getFormValues();
      fillFn(pdfDoc, formData);
      return pdfDoc.save();
    }).then(function (pdfBytes) {
      var blob = new Blob([pdfBytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(function () {
      // Fallback: just open the blank PDF
      window.open(pdfUrl, '_blank');
    });
  }

  // Lizenzantrag pre-fill
  var lizenzLink = document.getElementById('bb-doc-lizenz');
  if (lizenzLink) {
    lizenzLink.addEventListener('click', function (e) {
      e.preventDefault();
      downloadPrefilled('/docs/lizenzantrag-swiss-basketball.pdf', 'lizenzantrag.pdf', function (pdfDoc, d) {
        var pdfForm = pdfDoc.getForm();
        try {
          // Try filling form fields by name (if the PDF has them)
          var fields = pdfForm.getFields();
          for (var fi = 0; fi < fields.length; fi++) {
            var name = fields[fi].getName().toLowerCase();
            if (name.indexOf('name des klubs') !== -1 || name.indexOf('club') !== -1) {
              try { fields[fi].setText('KSC Wiedikon'); } catch(e) {}
            }
            if (name === 'name' || name.indexOf('nachname') !== -1 || name.indexOf('last') !== -1) {
              try { fields[fi].setText(d.nachname); } catch(e) {}
            }
            if (name.indexOf('vorname') !== -1 || name.indexOf('first') !== -1) {
              try { fields[fi].setText(d.vorname); } catch(e) {}
            }
            if (name.indexOf('strasse') !== -1 || name.indexOf('adress') !== -1) {
              try { fields[fi].setText(d.adresse); } catch(e) {}
            }
            if (name.indexOf('e-mail') !== -1 || name.indexOf('email') !== -1) {
              try { fields[fi].setText(d.email); } catch(e) {}
            }
          }
        } catch (ex) { /* PDF has no form fields — download blank */ }
      });
    });
  }

  // Player's Self Declaration pre-fill
  var selfDeclLink = document.getElementById('bb-doc-selfdecl');
  if (selfDeclLink) {
    selfDeclLink.addEventListener('click', function (e) {
      e.preventDefault();
      downloadPrefilled('/docs/player-self-declaration-fiba.pdf', 'player-self-declaration.pdf', function (pdfDoc, d) {
        var pdfForm = pdfDoc.getForm();
        try {
          var fields = pdfForm.getFields();
          for (var fi = 0; fi < fields.length; fi++) {
            var name = fields[fi].getName().toLowerCase();
            if (name.indexOf('last') !== -1) try { fields[fi].setText(d.nachname); } catch(e) {}
            if (name.indexOf('first') !== -1) try { fields[fi].setText(d.vorname); } catch(e) {}
            if (name.indexOf('nationality') !== -1) try { fields[fi].setText(d.nationalitaet); } catch(e) {}
            if (name.indexOf('current club') !== -1) try { fields[fi].setText('KSC Wiedikon'); } catch(e) {}
            if (name.indexOf('season') !== -1) try { fields[fi].setText('2025/2026'); } catch(e) {}
          }
        } catch (ex) {}
      });
    });
  }

  // National Team Declaration pre-fill
  var natDeclLink = document.getElementById('bb-doc-natdecl');
  if (natDeclLink) {
    natDeclLink.addEventListener('click', function (e) {
      e.preventDefault();
      downloadPrefilled('/docs/national-team-declaration-fiba.pdf', 'national-team-declaration.pdf', function (pdfDoc, d) {
        var pdfForm = pdfDoc.getForm();
        try {
          var fields = pdfForm.getFields();
          for (var fi = 0; fi < fields.length; fi++) {
            var name = fields[fi].getName().toLowerCase();
            if (name.indexOf('last') !== -1 || name.indexOf('nachname') !== -1 || name.indexOf('nom') !== -1) {
              try { fields[fi].setText(d.nachname); } catch(e) {}
            }
            if (name.indexOf('first') !== -1 || name.indexOf('vorname') !== -1 || name.indexOf('prénom') !== -1) {
              try { fields[fi].setText(d.vorname); } catch(e) {}
            }
            if (name.indexOf('nationality') !== -1 || name.indexOf('nationalit') !== -1) {
              try { fields[fi].setText(d.nationalitaet); } catch(e) {}
            }
          }
        } catch (ex) {}
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
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
