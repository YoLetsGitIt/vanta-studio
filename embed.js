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
    '.vb-input{width:100%;padding:0.65rem 0.85rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:0.875rem;font-family:inherit;color:#fff;outline:none;transition:border-color .15s;-webkit-appearance:none;appearance:none;color-scheme:dark}',
    '.vb-input:focus{border-color:rgba(255,255,255,0.3)}',
    '.vb-input option{background:#1a1a1a;color:#fff}',
    '.vb-phone-row{display:flex;gap:0.5rem}',
    '.vb-phone-code{flex-shrink:0;width:auto}',
    '.vb-chips{display:flex;flex-wrap:wrap;gap:0.4rem}',
    '.vb-chip{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:20px;color:rgba(255,255,255,0.6);font-size:0.78rem;font-weight:500;padding:0.35rem 0.75rem;cursor:pointer;font-family:inherit}',
    '.vb-chip-on{background:var(--vb-chip-bg,rgba(245,236,217,0.12));border-color:var(--vb-chip-border,rgba(245,236,217,0.35));color:var(--vb-accent,#f5ecd9)}',
    '.vb-chip-off{opacity:.3;cursor:default}',
    '.vb-count{color:rgba(255,255,255,0.2);font-weight:400;margin-left:6px}',
    '.vb-upload-label{display:inline-flex;align-items:center;gap:0.4rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.5rem 0.85rem;font-size:0.82rem;color:rgba(255,255,255,0.55);cursor:pointer;font-family:inherit}',
    '.vb-photo-grid{display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem}',
    '.vb-thumb{position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)}',
    '.vb-thumb img{width:100%;height:100%;object-fit:cover}',
    '.vb-thumb-rm{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.65);border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1}',
    '.vb-consent{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:1rem;display:flex;flex-direction:column;gap:0.85rem}',
    '.vb-consent-text{font-size:0.8rem;color:rgba(255,255,255,0.55);margin:0;line-height:1.65;max-height:160px;overflow-y:auto}',
    '.vb-consent-check{display:flex;align-items:flex-start;gap:0.6rem;font-size:0.8rem;color:rgba(255,255,255,0.7);cursor:pointer}',
    '.vb-btn{width:100%;padding:0.85rem;background:var(--vb-accent,#f5ecd9);color:var(--vb-btn-text,#0e0e0e);border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s}',
    '.vb-btn:hover{opacity:.88}',
    '.vb-btn:disabled{opacity:.5;cursor:default}',
    '.vb-err{font-size:0.78rem;color:#e86f6f}',
    '.vb-ok{display:flex;flex-direction:column;align-items:center;gap:1rem;padding:1rem;text-align:center}',
    '.vb-ok-icon{width:48px;height:48px;border-radius:50%;background:rgba(76,201,138,0.15);color:#4cc98a;font-size:1.4rem;display:flex;align-items:center;justify-content:center}',
    '.vb-ok-title{font-size:1.3rem;font-weight:700;color:#fff;margin:0}',
    '.vb-ok-sub{font-size:0.85rem;color:rgba(255,255,255,0.45);margin:0;line-height:1.6}',
  ].join('');

  function hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return null;
    var h = hex.slice(1);
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return 'rgba('+r+','+g+','+b+','+alpha+')';
  }

  function isLight(hex) {
    if (!hex || hex[0] !== '#') return false;
    var h = hex.slice(1);
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    return (0.299*r + 0.587*g + 0.114*b)/255 > 0.55;
  }

  function applyColors(card, bg, accent) {
    if (bg) card.style.background = bg;
    if (accent) {
      card.style.setProperty('--vb-accent', accent);
      card.style.setProperty('--vb-btn-text', isLight(accent) ? '#0e0e0e' : '#ffffff');
      card.style.setProperty('--vb-chip-bg', hexToRgba(accent, 0.12) || 'rgba(245,236,217,0.12)');
      card.style.setProperty('--vb-chip-border', hexToRgba(accent, 0.35) || 'rgba(245,236,217,0.35)');
    }
  }

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

  function field(labelText, inputEl, extraLabel) {
    var wrap = mk('div', 'vb-field');
    var lbl = mk('label', 'vb-label');
    lbl.appendChild(txt(labelText));
    if (extraLabel) lbl.appendChild(extraLabel);
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
    var selectedFiles = [];
    var photoPreviews = [];

    applyColors(card, studio.widget_bg_color, studio.widget_accent_color);

    // ── Header ────────────────────────────────────────────────────────────────
    var header = mk('div', 'vb-header');
    var eyebrow = mk('span', 'vb-eyebrow');
    eyebrow.textContent = 'Studio booking';
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

    // DOB
    var dobEl = input('date', '', 'bday');
    dobEl.className = 'vb-input';
    form.appendChild(field('Date of birth', dobEl));

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

    // Artist
    var artistEl = null;
    if (artists.length > 0) {
      artistEl = mk('select', 'vb-input');
      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'No preference — studio will assign';
      artistEl.appendChild(blank);
      artists.forEach(function (a) {
        var opt = document.createElement('option');
        opt.value = a.artistId || a.artist_id || '';
        opt.textContent = a.name || '';
        artistEl.appendChild(opt);
      });
      form.appendChild(field('Artist (optional)', artistEl));
    }

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
    designEl.rows = 3;
    designEl.placeholder = "Describe what you'd like…";
    designEl.required = true;
    designEl.style.resize = 'vertical';
    form.appendChild(field('Design description', designEl));

    // Notes
    var notesEl = mk('textarea', 'vb-input');
    notesEl.rows = 2;
    notesEl.placeholder = 'Anything else the artist should know';
    notesEl.style.resize = 'vertical';
    form.appendChild(field('Additional notes (optional)', notesEl));

    // Photo upload
    var photoFieldWrap = mk('div', 'vb-field');
    var photoLabelEl = mk('label', 'vb-label');
    photoLabelEl.textContent = 'Reference photos (optional, up to 5)';
    photoFieldWrap.appendChild(photoLabelEl);
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    var uploadLabel = mk('label', 'vb-upload-label');
    uploadLabel.textContent = '+ Add photos';
    uploadLabel.appendChild(fileInput);
    photoFieldWrap.appendChild(uploadLabel);
    var photoGrid = mk('div', 'vb-photo-grid');
    photoFieldWrap.appendChild(photoGrid);
    form.appendChild(photoFieldWrap);

    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files).slice(0, 5);
      selectedFiles = files;
      photoPreviews.forEach(function (u) { URL.revokeObjectURL(u); });
      photoPreviews = files.map(function (f) { return URL.createObjectURL(f); });
      photoGrid.innerHTML = '';
      files.forEach(function (f, i) {
        var thumb = mk('div', 'vb-thumb');
        var img = document.createElement('img');
        img.src = photoPreviews[i];
        img.alt = '';
        thumb.appendChild(img);
        var rm = mk('button', 'vb-thumb-rm');
        rm.type = 'button';
        rm.textContent = '✕';
        rm.addEventListener('click', function () {
          selectedFiles = selectedFiles.filter(function (_, j) { return j !== i; });
          photoPreviews = photoPreviews.filter(function (_, j) { return j !== i; });
          thumb.parentNode.removeChild(thumb);
        });
        thumb.appendChild(rm);
        photoGrid.appendChild(thumb);
      });
    });

    // Consent form
    var consentCheckEl = null;
    if (studio.consent_form) {
      var consentWrap = mk('div', 'vb-consent');
      var consentText = mk('p', 'vb-consent-text');
      consentText.textContent = studio.consent_form;
      consentWrap.appendChild(consentText);
      var consentLabel = mk('label', 'vb-consent-check');
      consentCheckEl = document.createElement('input');
      consentCheckEl.type = 'checkbox';
      consentCheckEl.style.accentColor = '#f5ecd9';
      consentCheckEl.style.flexShrink = '0';
      var consentSpan = mk('span');
      consentSpan.textContent = 'I have read and agree to the above';
      consentLabel.appendChild(consentCheckEl);
      consentLabel.appendChild(consentSpan);
      consentWrap.appendChild(consentLabel);
      form.appendChild(consentWrap);
    }

    // Error + submit
    var errEl = mk('div', 'vb-err');
    errEl.style.display = 'none';
    form.appendChild(errEl);

    var btn = mk('button', 'vb-btn');
    btn.type = 'submit';
    btn.textContent = 'Request booking';
    form.appendChild(btn);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errEl.style.display = 'none';

      if (placements.length === 0) {
        errEl.textContent = 'Please select at least one placement.';
        errEl.style.display = 'block';
        return;
      }
      if (studio.consent_form && consentCheckEl && !consentCheckEl.checked) {
        errEl.textContent = 'Please agree to the consent form.';
        errEl.style.display = 'block';
        return;
      }

      var countryObj = null;
      for (var i = 0; i < COUNTRIES.length; i++) {
        if (COUNTRIES[i].id === codeEl.value) { countryObj = COUNTRIES[i]; break; }
      }
      var phoneFull = ((countryObj ? countryObj.dial : '') + ' ' + numEl.value.trim()).trim();

      btn.disabled = true;
      btn.textContent = 'Submitting…';

      // Upload photos first (if any), then submit form.
      uploadPhotos(studioId, selectedFiles).then(function (imagePaths) {
        var body = {
          name: (firstEl.value.trim() + ' ' + lastEl.value.trim()).trim(),
          email: emailEl.value.trim(),
          phone: phoneFull,
          dob: dobEl.value,
          body_location: placements.join(', '),
          design_details: designEl.value.trim(),
          notes: notesEl.value.trim(),
          image_paths: imagePaths,
        };
        if (artistEl && artistEl.value) body.artist_id = artistEl.value;

        return fetch(API + '/studios/' + studioId + '/studio-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || 'Something went wrong.');
          });
        });
      })
        .then(function () {
          card.innerHTML = '';
          var ok = mk('div', 'vb-ok');
          var icon = mk('div', 'vb-ok-icon');
          icon.textContent = '✓';
          var okTitle = mk('h2', 'vb-ok-title');
          okTitle.textContent = "You're on the list!";
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
          btn.textContent = 'Request booking';
        });
    });
  }

  function uploadPhotos(studioId, files) {
    if (!files || files.length === 0) return Promise.resolve([]);
    var fileDescs = files.map(function (f) {
      return { mime_type: f.type || 'image/jpeg', byte_size: f.size };
    });
    return fetch(API + '/studios/' + studioId + '/walkin-upload-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: fileDescs }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var slots = data.uploads || [];
        var puts = slots.map(function (slot, i) {
          return fetch(slot.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': files[i].type || 'image/jpeg' },
            body: files[i],
          });
        });
        return Promise.all(puts).then(function () {
          return slots.map(function (s) { return s.storage_object_path; });
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
