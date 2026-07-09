(function () {
  'use strict';

  var API = 'https://inkspire-backend-xa2a.onrender.com';

  var CSS = [
    '.vb{font-family:system-ui,-apple-system,sans-serif;max-width:480px;width:100%;box-sizing:border-box}',
    '.vb *{box-sizing:border-box}',
    '.vb-field{margin-bottom:14px}',
    '.vb-label{display:block;font-size:13px;font-weight:500;margin-bottom:5px;color:var(--vb-label,#555)}',
    '.vb-input{width:100%;padding:10px 12px;border:1.5px solid var(--vb-border,#ddd);border-radius:var(--vb-radius,8px);font-size:15px;font-family:inherit;background:var(--vb-input-bg,#fff);color:var(--vb-text,#111);outline:none;transition:border-color .15s}',
    '.vb-input:focus{border-color:var(--vb-accent,#111)}',
    '.vb-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.vb-btn{width:100%;padding:12px;background:var(--vb-accent,#111);color:var(--vb-btn-text,#fff);border:none;border-radius:var(--vb-radius,8px);font-size:15px;font-weight:600;cursor:pointer;transition:opacity .15s;font-family:inherit}',
    '.vb-btn:hover{opacity:.85}',
    '.vb-btn:disabled{opacity:.5;cursor:default}',
    '.vb-success{padding:20px;border-radius:var(--vb-radius,8px);background:var(--vb-success-bg,#f0fdf4);color:var(--vb-success-text,#166534);font-size:15px;text-align:center}',
    '.vb-error{margin-top:8px;font-size:13px;color:var(--vb-error,#dc2626)}',
  ].join('');

  function injectStyles() {
    if (document.getElementById('vanta-embed-css')) return;
    var s = document.createElement('style');
    s.id = 'vanta-embed-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function render(container, studioId) {
    var uid = 'vb-' + studioId.slice(0, 8);

    container.innerHTML = [
      '<div class="vb">',
        '<form id="', uid, '">',
          '<div class="vb-field">',
            '<label class="vb-label">Name *</label>',
            '<input class="vb-input" name="name" required placeholder="Your name" autocomplete="name" />',
          '</div>',
          '<div class="vb-row">',
            '<div class="vb-field">',
              '<label class="vb-label">Email</label>',
              '<input class="vb-input" name="email" type="email" placeholder="you@example.com" autocomplete="email" />',
            '</div>',
            '<div class="vb-field">',
              '<label class="vb-label">Phone</label>',
              '<input class="vb-input" name="phone" type="tel" placeholder="+1 555 000 0000" autocomplete="tel" />',
            '</div>',
          '</div>',
          '<div class="vb-field">',
            '<label class="vb-label">Tell us about your idea</label>',
            '<textarea class="vb-input" name="notes" rows="4" placeholder="Design, placement, size, reference images…" style="resize:vertical"></textarea>',
          '</div>',
          '<button type="submit" class="vb-btn">Send booking request</button>',
          '<div class="vb-error" id="', uid, '-err" style="display:none"></div>',
        '</form>',
        '<div class="vb-success" id="', uid, '-ok" style="display:none">',
          '✓ Request sent! The studio will be in touch soon.',
        '</div>',
      '</div>',
    ].join('');

    var form = document.getElementById(uid);
    var errEl = document.getElementById(uid + '-err');
    var okEl = document.getElementById(uid + '-ok');
    var btn = form.querySelector('.vb-btn');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements['name'].value.trim();
      if (!name) return;

      btn.disabled = true;
      btn.textContent = 'Sending…';
      errEl.style.display = 'none';

      fetch(API + '/studios/' + studioId + '/walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: form.elements['email'].value.trim(),
          phone: form.elements['phone'].value.trim(),
          notes: form.elements['notes'].value.trim(),
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || 'Something went wrong.');
          });
        })
        .then(function () {
          form.style.display = 'none';
          okEl.style.display = 'block';
        })
        .catch(function (err) {
          errEl.textContent = err.message;
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Send booking request';
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
