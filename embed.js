(function () {
  'use strict';

  var API = 'https://inkspire-backend-xa2a.onrender.com';

  var COUNTRIES = [
    { id: 'AU', flag: '🇦🇺', dial: '+61'  },
    { id: 'AT', flag: '🇦🇹', dial: '+43'  },
    { id: 'BE', flag: '🇧🇪', dial: '+32'  },
    { id: 'BR', flag: '🇧🇷', dial: '+55'  },
    { id: 'CA', flag: '🇨🇦', dial: '+1'   },
    { id: 'CN', flag: '🇨🇳', dial: '+86'  },
    { id: 'DK', flag: '🇩🇰', dial: '+45'  },
    { id: 'FI', flag: '🇫🇮', dial: '+358' },
    { id: 'FR', flag: '🇫🇷', dial: '+33'  },
    { id: 'DE', flag: '🇩🇪', dial: '+49'  },
    { id: 'GR', flag: '🇬🇷', dial: '+30'  },
    { id: 'HK', flag: '🇭🇰', dial: '+852' },
    { id: 'IN', flag: '🇮🇳', dial: '+91'  },
    { id: 'ID', flag: '🇮🇩', dial: '+62'  },
    { id: 'IE', flag: '🇮🇪', dial: '+353' },
    { id: 'IL', flag: '🇮🇱', dial: '+972' },
    { id: 'IT', flag: '🇮🇹', dial: '+39'  },
    { id: 'JP', flag: '🇯🇵', dial: '+81'  },
    { id: 'KR', flag: '🇰🇷', dial: '+82'  },
    { id: 'MY', flag: '🇲🇾', dial: '+60'  },
    { id: 'MX', flag: '🇲🇽', dial: '+52'  },
    { id: 'NL', flag: '🇳🇱', dial: '+31'  },
    { id: 'NZ', flag: '🇳🇿', dial: '+64'  },
    { id: 'NO', flag: '🇳🇴', dial: '+47'  },
    { id: 'PH', flag: '🇵🇭', dial: '+63'  },
    { id: 'PL', flag: '🇵🇱', dial: '+48'  },
    { id: 'PT', flag: '🇵🇹', dial: '+351' },
    { id: 'RU', flag: '🇷🇺', dial: '+7'   },
    { id: 'SA', flag: '🇸🇦', dial: '+966' },
    { id: 'SG', flag: '🇸🇬', dial: '+65'  },
    { id: 'ZA', flag: '🇿🇦', dial: '+27'  },
    { id: 'ES', flag: '🇪🇸', dial: '+34'  },
    { id: 'SE', flag: '🇸🇪', dial: '+46'  },
    { id: 'CH', flag: '🇨🇭', dial: '+41'  },
    { id: 'TW', flag: '🇹🇼', dial: '+886' },
    { id: 'TH', flag: '🇹🇭', dial: '+66'  },
    { id: 'TR', flag: '🇹🇷', dial: '+90'  },
    { id: 'AE', flag: '🇦🇪', dial: '+971' },
    { id: 'GB', flag: '🇬🇧', dial: '+44'  },
    { id: 'US', flag: '🇺🇸', dial: '+1'   },
    { id: 'VN', flag: '🇻🇳', dial: '+84'  },
  ];

  var SESSION_TYPES = ['Tattoo', 'Piercing', 'Consultation', 'Touch-up', 'Cover-up', 'Other'];

  var PLACEMENTS = [
    'Ankle', 'Arm', 'Back', 'Calf', 'Chest', 'Foot', 'Forearm',
    'Hand', 'Head', 'Hip', 'Knee', 'Neck', 'Ribs', 'Shoulder',
    'Stomach', 'Thigh', 'Wrist', 'Other',
  ];

  function detectCountry() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz.indexOf('Australia/') === 0) return 'AU';
      if (tz === 'Pacific/Auckland' || tz === 'Pacific/Chatham') return 'NZ';
      var map = {
        'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
        'Europe/Vienna': 'AT', 'Europe/Brussels': 'BE', 'Europe/Athens': 'GR',
        'Europe/Dublin': 'IE', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL',
        'Europe/Oslo': 'NO', 'Europe/Warsaw': 'PL', 'Europe/Lisbon': 'PT',
        'Europe/Moscow': 'RU', 'Europe/Madrid': 'ES', 'Europe/Stockholm': 'SE',
        'Europe/Zurich': 'CH', 'Europe/Istanbul': 'TR', 'Europe/Helsinki': 'FI',
        'Europe/Copenhagen': 'DK',
        'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
        'Asia/Hong_Kong': 'HK', 'Asia/Singapore': 'SG', 'Asia/Taipei': 'TW',
        'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID', 'Asia/Kolkata': 'IN',
        'Asia/Kuala_Lumpur': 'MY', 'Asia/Manila': 'PH', 'Asia/Riyadh': 'SA',
        'Asia/Dubai': 'AE', 'Asia/Jerusalem': 'IL',
        'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
        'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Winnipeg': 'CA',
        'America/Edmonton': 'CA', 'America/Halifax': 'CA', 'America/St_Johns': 'CA',
        'Africa/Johannesburg': 'ZA',
      };
      if (map[tz]) return map[tz];
      if (tz.indexOf('America/') === 0) return 'US';
    } catch (e) {}
    return 'US';
  }

  var CSS = [
    '.vb{font-family:system-ui,-apple-system,sans-serif;max-width:480px;width:100%;box-sizing:border-box}',
    '.vb *{box-sizing:border-box}',
    '.vb-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:2rem;display:flex;flex-direction:column;gap:1.5rem}',
    '.vb-header{padding-bottom:1.25rem;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;gap:0.25rem}',
    '.vb-eyebrow{font-size:0.7rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.3)}',
    '.vb-title{font-size:1.5rem;font-weight:700;color:#fff;margin:0;letter-spacing:-0.02em}',
    '.vb-form{display:flex;flex-direction:column;gap:1rem}',
    '.vb-field{display:flex;flex-direction:column;gap:0.3rem}',
    '.vb-row{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem}',
    '.vb-label{font-size:0.72rem;font-weight:600;color:rgba(255,255,255,0.45)}',
    '.vb-input{width:100%;padding:0.65rem 0.85rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:0.875rem;font-family:inherit;color:#fff;outline:none;transition:border-color .15s;-webkit-appearance:none;appearance:none}',
    '.vb-input:focus{border-color:rgba(255,255,255,0.3)}',
    '.vb-input option{background:#1a1a1a;color:#fff}',
    '.vb-phone-row{display:flex;gap:0.5rem}',
    '.vb-phone-code{flex-shrink:0;width:auto}',
    '.vb-chips{display:flex;flex-wrap:wrap;gap:0.4rem}',
    '.vb-chip{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:20px;color:rgba(255,255,255,0.6);font-size:0.78rem;font-weight:500;padding:0.35rem 0.75rem;cursor:pointer;font-family:inherit}',
    '.vb-chip-on{background:rgba(245,236,217,0.12);border-color:rgba(245,236,217,0.35);color:#f5ecd9}',
    '.vb-chip-off{opacity:.3;cursor:default}',
    '.vb-count{color:rgba(255,255,255,0.2);font-weight:400;margin-left:6px}',
    '.vb-btn{width:100%;padding:0.85rem;background:#f5ecd9;color:#0e0e0e;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s}',
    '.vb-btn:hover{opacity:.88}',
    '.vb-btn:disabled{opacity:.5;cursor:default}',
    '.vb-err{font-size:0.78rem;color:#e86f6f}',
    '.vb-ok{display:flex;flex-direction:column;align-items:center;gap:1rem;padding:1rem;text-align:center}',
    '.vb-ok-icon{width:48px;height:48px;border-radius:50%;background:rgba(76,201,138,0.15);color:#4cc98a;font-size:1.4rem;display:flex;align-items:center;justify-content:center}',
    '.vb-ok-title{font-size:1.3rem;font-weight:700;color:#fff;margin:0}',
    '.vb-ok-sub{font-size:0.85rem;color:rgba(255,255,255,0.45);margin:0;line-height:1.6}',
  ].join('');

  function injectStyles() {
    if (document.getElementById('vanta-embed-css')) return;
    var s = document.createElement('style');
    s.id = 'vanta-embed-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function mk(tag, className) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function txt(str) { return document.createTextNode(str); }

  function field(labelText, inputEl) {
    var wrap = mk('div', 'vb-field');
    var lbl = mk('label', 'vb-label');
    lbl.appendChild(txt(labelText));
    wrap.appendChild(lbl);
    wrap.appendChild(inputEl);
    return wrap;
  }

  function input(type, placeholder, autocomplete) {
    var el = mk('input', 'vb-input');
    el.type = type || 'text';
    el.placeholder = placeholder || '';
    if (autocomplete) el.autocomplete = autocomplete;
    return el;
  }

  function render(container, studioId) {
    var defaultCountry = detectCountry();

    var wrapper = mk('div', 'vb');
    var card = mk('div', 'vb-card');
    wrapper.appendChild(card);
    container.innerHTML = '';
    container.appendChild(wrapper);

    var loadingEl = mk('p', 'vb-label');
    loadingEl.textContent = 'Loading…';
    card.appendChild(loadingEl);

    fetch(API + '/studios/' + studioId + '/public')
      .then(function (r) { return r.json(); })
      .then(function (studio) {
        card.removeChild(loadingEl);
        buildForm(card, studioId, studio, defaultCountry);
      })
      .catch(function () {
        loadingEl.textContent = 'Unable to load booking form.';
        loadingEl.style.color = '#e86f6f';
      });
  }

  function buildForm(card, studioId, studio, defaultCountry) {
    var artists = studio.artists || [];
    var placements = [];

    // ── Header ────────────────────────────────────────────────────────────────
    var header = mk('div', 'vb-header');
    var eyebrow = mk('span', 'vb-eyebrow');
    eyebrow.textContent = 'Walk-in booking';
    var title = mk('h2', 'vb-title');
    title.textContent = studio.name || 'Book a session';
    header.appendChild(eyebrow);
    header.appendChild(title);
    card.appendChild(header);

    // ── Form ──────────────────────────────────────────────────────────────────
    var form = mk('form', 'vb-form');
    card.appendChild(form);

    // Name row
    var nameRow = mk('div', 'vb-row');
    var firstEl = input('text', 'First', 'given-name');
    firstEl.required = true;
    var lastEl = input('text', 'Last', 'family-name');
    lastEl.required = true;
    nameRow.appendChild(field('First name', firstEl));
    nameRow.appendChild(field('Last name', lastEl));
    form.appendChild(nameRow);

    // Email
    var emailEl = input('email', 'you@example.com', 'email');
    emailEl.required = true;
    form.appendChild(field('Email', emailEl));

    // Phone
    var codeEl = mk('select', 'vb-input vb-phone-code');
    COUNTRIES.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.flag + ' ' + c.dial;
      if (c.id === defaultCountry) opt.selected = true;
      codeEl.appendChild(opt);
    });
    var numEl = input('tel', '555 0100', 'tel');
    numEl.required = true;
    numEl.style.flex = '1';
    var phoneRow = mk('div', 'vb-phone-row');
    phoneRow.appendChild(codeEl);
    phoneRow.appendChild(numEl);
    form.appendChild(field('Phone', phoneRow));

    // Artist (only if studio has artists listed)
    var artistEl = null;
    if (artists.length > 0) {
      artistEl = mk('select', 'vb-input');
      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Select an artist…';
      artistEl.appendChild(blank);
      artists.forEach(function (a) {
        var opt = document.createElement('option');
        opt.value = a.artistId || a.artist_id || '';
        opt.textContent = a.name || '';
        artistEl.appendChild(opt);
      });
      form.appendChild(field('Artist', artistEl));
    }

    // Session type
    var sessionEl = mk('select', 'vb-input');
    sessionEl.required = true;
    var sessionBlank = document.createElement('option');
    sessionBlank.value = '';
    sessionBlank.textContent = 'Select…';
    sessionEl.appendChild(sessionBlank);
    SESSION_TYPES.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      sessionEl.appendChild(opt);
    });
    form.appendChild(field('Session type', sessionEl));

    // Placement chips
    var countSpan = mk('span', 'vb-count');
    countSpan.textContent = '0/3';
    var placeLabelWrap = mk('div', 'vb-field');
    var placeLabelEl = mk('label', 'vb-label');
    placeLabelEl.appendChild(txt('Placement'));
    placeLabelEl.appendChild(countSpan);
    var chipsDiv = mk('div', 'vb-chips');
    var chipMap = {};
    PLACEMENTS.forEach(function (p) {
      var chip = mk('button', 'vb-chip');
      chip.type = 'button';
      chip.textContent = p;
      chip.addEventListener('click', function () {
        var idx = placements.indexOf(p);
        if (idx >= 0) {
          placements.splice(idx, 1);
          chip.className = 'vb-chip';
        } else if (placements.length < 3) {
          placements.push(p);
          chip.className = 'vb-chip vb-chip-on';
        }
        countSpan.textContent = placements.length + '/3';
        PLACEMENTS.forEach(function (pp) {
          var c = chipMap[pp];
          var active = placements.indexOf(pp) >= 0;
          if (!active && placements.length >= 3) {
            c.className = 'vb-chip vb-chip-off';
          } else if (!active) {
            c.className = 'vb-chip';
          }
        });
      });
      chipMap[p] = chip;
      chipsDiv.appendChild(chip);
    });
    placeLabelWrap.appendChild(placeLabelEl);
    placeLabelWrap.appendChild(chipsDiv);
    form.appendChild(placeLabelWrap);

    // Design description
    var designEl = mk('textarea', 'vb-input');
    designEl.name = 'design';
    designEl.rows = 3;
    designEl.placeholder = "Describe what you'd like…";
    designEl.required = true;
    designEl.style.resize = 'vertical';
    form.appendChild(field('Design description', designEl));

    // Notes
    var notesEl = mk('textarea', 'vb-input');
    notesEl.name = 'notes';
    notesEl.rows = 2;
    notesEl.placeholder = 'Anything else the artist should know';
    notesEl.style.resize = 'vertical';
    form.appendChild(field('Additional notes (optional)', notesEl));

    // Error + submit
    var errEl = mk('div', 'vb-err');
    errEl.style.display = 'none';
    form.appendChild(errEl);

    var btn = mk('button', 'vb-btn');
    btn.type = 'submit';
    btn.textContent = 'Request walk-in';
    form.appendChild(btn);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errEl.style.display = 'none';

      if (placements.length === 0) {
        errEl.textContent = 'Please select at least one placement.';
        errEl.style.display = 'block';
        return;
      }

      var countryObj = null;
      for (var i = 0; i < COUNTRIES.length; i++) {
        if (COUNTRIES[i].id === codeEl.value) { countryObj = COUNTRIES[i]; break; }
      }
      var phoneFull = ((countryObj ? countryObj.dial : '') + ' ' + numEl.value.trim()).trim();

      var body = {
        name: (firstEl.value.trim() + ' ' + lastEl.value.trim()).trim(),
        email: emailEl.value.trim(),
        phone: phoneFull,
        session_type: sessionEl.value,
        body_location: placements.join(', '),
        design_details: designEl.value.trim(),
        notes: notesEl.value.trim(),
      };
      if (artistEl && artistEl.value) body.artist_id = artistEl.value;

      btn.disabled = true;
      btn.textContent = 'Submitting…';

      fetch(API + '/studios/' + studioId + '/walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || 'Something went wrong.');
          });
        })
        .then(function () {
          card.innerHTML = '';
          var ok = mk('div', 'vb-ok');
          var icon = mk('div', 'vb-ok-icon');
          icon.textContent = '✓';
          var okTitle = mk('h2', 'vb-ok-title');
          okTitle.textContent = "You’re on the list!";
          var okSub = mk('p', 'vb-ok-sub');
          okSub.textContent = 'Your request has been sent to ' + (studio.name || 'the studio') + '. They’ll be in touch soon.';
          ok.appendChild(icon);
          ok.appendChild(okTitle);
          ok.appendChild(okSub);
          card.appendChild(ok);
        })
        .catch(function (err) {
          errEl.textContent = err.message;
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Request walk-in';
        });
    });
  }

  function init() {
    injectStyles();
    var containers = document.querySelectorAll('[data-vanta-studio]');
    for (var i = 0; i < containers.length; i++) {
      var studioId = containers[i].getAttribute('data-vanta-studio');
      if (studioId) render(containers[i], studioId);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
