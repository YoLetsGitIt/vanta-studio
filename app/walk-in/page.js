'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getStudioPublic, createWalkIn, walkinUploadSign } from '@/lib/api';

const SESSION_TYPES = ['Tattoo', 'Piercing', 'Consultation', 'Touch-up', 'Cover-up', 'Other'];

function detectCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith('Australia/'))             return 'AU';
    if (tz.startsWith('Pacific/Auckland') || tz === 'Pacific/Chatham') return 'NZ';
    const map = {
      'Europe/London': 'GB',    'Europe/Paris': 'FR',     'Europe/Berlin': 'DE',
      'Europe/Vienna': 'AT',    'Europe/Brussels': 'BE',  'Europe/Athens': 'GR',
      'Europe/Dublin': 'IE',    'Europe/Rome': 'IT',      'Europe/Amsterdam': 'NL',
      'Europe/Oslo': 'NO',      'Europe/Warsaw': 'PL',    'Europe/Lisbon': 'PT',
      'Europe/Moscow': 'RU',    'Europe/Madrid': 'ES',    'Europe/Stockholm': 'SE',
      'Europe/Zurich': 'CH',    'Europe/Istanbul': 'TR',  'Europe/Helsinki': 'FI',
      'Europe/Copenhagen': 'DK',
      'Asia/Tokyo': 'JP',       'Asia/Seoul': 'KR',       'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK',   'Asia/Singapore': 'SG',   'Asia/Taipei': 'TW',
      'Asia/Bangkok': 'TH',     'Asia/Jakarta': 'ID',     'Asia/Kolkata': 'IN',
      'Asia/Kuala_Lumpur': 'MY','Asia/Manila': 'PH',      'Asia/Riyadh': 'SA',
      'Asia/Dubai': 'AE',       'Asia/Jerusalem': 'IL',
      'America/Sao_Paulo': 'BR','America/Mexico_City': 'MX',
      'America/Toronto': 'CA',  'America/Vancouver': 'CA','America/Winnipeg': 'CA',
      'America/Edmonton': 'CA', 'America/Halifax': 'CA',  'America/St_Johns': 'CA',
      'Africa/Johannesburg': 'ZA',
    };
    if (map[tz]) return map[tz];
    if (tz.startsWith('America/')) return 'US';
  } catch {}
  return 'US';
}

const COUNTRIES = [
  { id: 'AU', flag: '🇦🇺', name: 'Australia',      dial: '+61'  },
  { id: 'AT', flag: '🇦🇹', name: 'Austria',        dial: '+43'  },
  { id: 'BE', flag: '🇧🇪', name: 'Belgium',        dial: '+32'  },
  { id: 'BR', flag: '🇧🇷', name: 'Brazil',         dial: '+55'  },
  { id: 'CA', flag: '🇨🇦', name: 'Canada',         dial: '+1'   },
  { id: 'CN', flag: '🇨🇳', name: 'China',          dial: '+86'  },
  { id: 'DK', flag: '🇩🇰', name: 'Denmark',        dial: '+45'  },
  { id: 'FI', flag: '🇫🇮', name: 'Finland',        dial: '+358' },
  { id: 'FR', flag: '🇫🇷', name: 'France',         dial: '+33'  },
  { id: 'DE', flag: '🇩🇪', name: 'Germany',        dial: '+49'  },
  { id: 'GR', flag: '🇬🇷', name: 'Greece',         dial: '+30'  },
  { id: 'HK', flag: '🇭🇰', name: 'Hong Kong',      dial: '+852' },
  { id: 'IN', flag: '🇮🇳', name: 'India',          dial: '+91'  },
  { id: 'ID', flag: '🇮🇩', name: 'Indonesia',      dial: '+62'  },
  { id: 'IE', flag: '🇮🇪', name: 'Ireland',        dial: '+353' },
  { id: 'IL', flag: '🇮🇱', name: 'Israel',         dial: '+972' },
  { id: 'IT', flag: '🇮🇹', name: 'Italy',          dial: '+39'  },
  { id: 'JP', flag: '🇯🇵', name: 'Japan',          dial: '+81'  },
  { id: 'KR', flag: '🇰🇷', name: 'South Korea',    dial: '+82'  },
  { id: 'MY', flag: '🇲🇾', name: 'Malaysia',       dial: '+60'  },
  { id: 'MX', flag: '🇲🇽', name: 'Mexico',         dial: '+52'  },
  { id: 'NL', flag: '🇳🇱', name: 'Netherlands',    dial: '+31'  },
  { id: 'NZ', flag: '🇳🇿', name: 'New Zealand',    dial: '+64'  },
  { id: 'NO', flag: '🇳🇴', name: 'Norway',         dial: '+47'  },
  { id: 'PH', flag: '🇵🇭', name: 'Philippines',    dial: '+63'  },
  { id: 'PL', flag: '🇵🇱', name: 'Poland',         dial: '+48'  },
  { id: 'PT', flag: '🇵🇹', name: 'Portugal',       dial: '+351' },
  { id: 'RU', flag: '🇷🇺', name: 'Russia',         dial: '+7'   },
  { id: 'SA', flag: '🇸🇦', name: 'Saudi Arabia',   dial: '+966' },
  { id: 'SG', flag: '🇸🇬', name: 'Singapore',      dial: '+65'  },
  { id: 'ZA', flag: '🇿🇦', name: 'South Africa',   dial: '+27'  },
  { id: 'ES', flag: '🇪🇸', name: 'Spain',          dial: '+34'  },
  { id: 'SE', flag: '🇸🇪', name: 'Sweden',         dial: '+46'  },
  { id: 'CH', flag: '🇨🇭', name: 'Switzerland',    dial: '+41'  },
  { id: 'TW', flag: '🇹🇼', name: 'Taiwan',         dial: '+886' },
  { id: 'TH', flag: '🇹🇭', name: 'Thailand',       dial: '+66'  },
  { id: 'TR', flag: '🇹🇷', name: 'Turkey',         dial: '+90'  },
  { id: 'AE', flag: '🇦🇪', name: 'UAE',            dial: '+971' },
  { id: 'GB', flag: '🇬🇧', name: 'United Kingdom', dial: '+44'  },
  { id: 'US', flag: '🇺🇸', name: 'United States',  dial: '+1'   },
  { id: 'VN', flag: '🇻🇳', name: 'Vietnam',        dial: '+84'  },
];

const PLACEMENTS = [
  'Ankle', 'Arm', 'Back', 'Calf', 'Chest', 'Foot', 'Forearm',
  'Hand', 'Head', 'Hip', 'Knee', 'Neck', 'Ribs', 'Shoulder',
  'Stomach', 'Thigh', 'Wrist', 'Other',
];

function WalkInInner() {
  const params = useSearchParams();
  const studioId = params.get('s');

  const [studio, setStudio]   = useState(null);
  const [studioErr, setStudioErr] = useState('');

  // Auth state
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Form state
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [phoneCode, setPhoneCode]   = useState(() => detectCountry());
  const [phoneNum,  setPhoneNum]    = useState('');
  const [dob, setDob]               = useState('');
  const [artistId, setArtistId]     = useState('');
  const [placements, setPlacements]  = useState([]);
  const [design, setDesign]         = useState('');
  const [notes, setNotes]           = useState('');
  const [photos, setPhotos]         = useState([]); // File objects
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone]             = useState(false);

  // Load studio info
  useEffect(() => {
    if (!studioId) return;
    getStudioPublic(studioId)
      .then(setStudio)
      .catch(e => setStudioErr(e.message));
  }, [studioId]);

  // Check existing session and pre-fill form fields from Supabase user
  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        const u = data.session.user;
        setEmail(u.email ?? '');
        setAuthEmail(u.email ?? '');
        const full = u.user_metadata?.full_name ?? u.user_metadata?.name ?? '';
        const parts = full.trim().split(' ');
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' '));
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (s?.user) {
        const u = s.user;
        setEmail(u.email ?? '');
        setAuthEmail(u.email ?? '');
        const full = u.user_metadata?.full_name ?? u.user_metadata?.name ?? '';
        const parts = full.trim().split(' ');
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' '));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const supabase = getSupabase();
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { full_name: authName } },
        });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files).slice(0, 5);
    setPhotos(files);
    setPhotoPreviews(files.map(f => URL.createObjectURL(f)));
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (placements.length === 0) { setSubmitError('Please select at least one placement.'); return; }
    if (studio.consent_form && !consentAccepted) { setSubmitError('Please agree to the consent form.'); return; }
    setSubmitError('');
    setSubmitting(true);
    try {
      let imagePaths = [];
      if (photos.length > 0) {
        const fileDescs = photos.map(f => ({ mime_type: f.type || 'image/jpeg', byte_size: f.size }));
        const slots = await walkinUploadSign(studioId, fileDescs);
        await Promise.all(slots.map((slot, i) =>
          fetch(slot.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': photos[i].type || 'image/jpeg' },
            body: photos[i],
          })
        ));
        imagePaths = slots.map(s => s.storage_object_path);
      }
      await createWalkIn(studioId, {
        artist_id:        artistId,
        name:             `${firstName} ${lastName}`.trim(),
        email,
        phone: `${COUNTRIES.find(c => c.id === phoneCode)?.dial ?? ''} ${phoneNum}`.trim(),
        dob,
        body_location:    placements.join(', '),
        design_details:   design,
        notes,
        image_paths:      imagePaths,
        consent_accepted: consentAccepted,
      });
      setDone(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!studioId) return <p style={s.msg}>Invalid link — no studio ID.</p>;
  if (studioErr) return <p style={{ ...s.msg, color: '#e86f6f' }}>{studioErr}</p>;
  if (!studio)   return <p style={s.msg}>Loading…</p>;

  if (done) {
    return (
      <div style={s.card}>
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>You're on the list!</h2>
        <p style={s.successSub}>Your walk-in request has been sent to {studio.name}. They'll confirm your spot shortly.</p>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <div style={s.studioHeader}>
        <span style={s.studioLabel}>Walk-in booking</span>
        <h1 style={s.studioName}>{studio.name}</h1>
      </div>

      {!session ? (
        <form onSubmit={handleAuth} style={s.form}>
          <p style={s.authIntro}>
            {authMode === 'login' ? 'Log in to book your walk-in' : 'Create an account to book your walk-in'}
          </p>

          {authMode === 'signup' && (
            <Field label="Full name">
              <input
                style={s.input} type="text" value={authName} required
                onChange={e => setAuthName(e.target.value)} placeholder="Your name"
              />
            </Field>
          )}
          <Field label="Email">
            <input
              style={s.input} type="email" value={authEmail} required
              onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              style={s.input} type="password" value={authPassword} required
              onChange={e => setAuthPassword(e.target.value)}
              placeholder={authMode === 'signup' ? 'Choose a password' : 'Your password'}
            />
          </Field>

          {authError && <p style={s.error}>{authError}</p>}

          <button type="submit" disabled={authLoading} style={s.submitBtn}>
            {authLoading ? '…' : authMode === 'login' ? 'Log in' : 'Create account'}
          </button>

          <button
            type="button"
            style={s.switchLink}
            onClick={() => { setAuthMode(m => m === 'login' ? 'signup' : 'login'); setAuthError(''); }}
          >
            {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="First name">
              <input style={s.input} type="text" value={firstName} required onChange={e => setFirstName(e.target.value)} placeholder="First" />
            </Field>
            <Field label="Last name">
              <input style={s.input} type="text" value={lastName} required onChange={e => setLastName(e.target.value)} placeholder="Last" />
            </Field>
          </div>
          <Field label="Date of birth">
            <input style={{ ...s.input, colorScheme: 'dark' }} type="date" value={dob} onChange={e => setDob(e.target.value)} />
          </Field>
          <Field label="Email">
            <input style={s.input} type="email" value={email} required onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Phone">
            <div style={s.phoneRow}>
              <select
                style={{ ...s.input, ...s.phoneCodeSelect }}
                value={phoneCode}
                onChange={e => setPhoneCode(e.target.value)}
              >
                {COUNTRIES.map(c => (
                  <option key={c.id} value={c.id}>{c.flag} {c.dial}</option>
                ))}
              </select>
              <input
                style={{ ...s.input, flex: 1 }}
                type="tel"
                value={phoneNum}
                required
                onChange={e => setPhoneNum(e.target.value)}
                placeholder="555 0100"
              />
            </div>
          </Field>

          <Field label="Artist (optional)">
            <select style={s.input} value={artistId} onChange={e => setArtistId(e.target.value)}>
              <option value="">No preference — studio will assign</option>
              {studio.artists.map(a => (
                <option key={a.artistId} value={a.artistId}>{a.name}</option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={s.label}>
              Placement
              <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, marginLeft: 6 }}>
                {placements.length}/3
              </span>
            </label>
            <div style={s.chipGrid}>
              {PLACEMENTS.map(p => {
                const active = placements.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      if (active) {
                        setPlacements(prev => prev.filter(x => x !== p));
                      } else if (placements.length < 3) {
                        setPlacements(prev => [...prev, p]);
                      }
                    }}
                    style={{ ...s.placementChip, ...(active ? s.placementChipActive : {}), ...(!active && placements.length >= 3 ? s.placementChipDisabled : {}) }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Design description">
            <textarea style={{ ...s.input, ...s.textarea }} value={design} required onChange={e => setDesign(e.target.value)} placeholder="Describe what you'd like…" />
          </Field>

          <Field label="Additional notes (optional)">
            <textarea style={{ ...s.input, ...s.textarea }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything else the artist should know" />
          </Field>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={s.label}>Reference photos (optional, up to 5)</label>
            <label style={s.uploadLabel}>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoChange} />
              + Add photos
            </label>
            {photoPreviews.length > 0 && (
              <div style={s.photoGrid}>
                {photoPreviews.map((url, i) => (
                  <div key={i} style={s.photoThumb}>
                    <img src={url} alt="" style={s.thumbImg} />
                    <button type="button" style={s.thumbRemove} onClick={() => removePhoto(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {studio.consent_form && (
            <div style={s.consentBox}>
              <p style={s.consentText}>{studio.consent_form}</p>
              <label style={s.consentCheck}>
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={e => setConsentAccepted(e.target.checked)}
                  style={{ accentColor: '#f5ecd9', flexShrink: 0 }}
                />
                <span>I have read and agree to the above</span>
              </label>
            </div>
          )}

          {submitError && <p style={s.error}>{submitError}</p>}

          <button type="submit" disabled={submitting} style={s.submitBtn}>
            {submitting ? 'Submitting…' : 'Request walk-in'}
          </button>

          <button
            type="button"
            style={s.switchLink}
            onClick={() => getSupabase().auth.signOut()}
          >
            Sign out
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

export default function WalkInPage() {
  return (
    <div style={s.page}>
      <Suspense fallback={<p style={s.msg}>Loading…</p>}>
        <WalkInInner />
      </Suspense>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0e0e0e',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '2rem 1rem 4rem',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  studioHeader: {
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    paddingBottom: '1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  studioLabel: {
    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
  },
  studioName: {
    fontSize: '1.5rem', fontWeight: 700, color: '#ffffff',
    margin: 0, letterSpacing: '-0.02em',
  },
  studioAddress: {
    fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)',
  },
  authIntro: {
    fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', margin: 0,
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  label: {
    fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)',
  },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: '0.875rem',
    padding: '0.65rem 0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  phoneRow: {
    display: 'flex', gap: '0.5rem',
  },
  phoneCodeSelect: {
    width: 'auto', flexShrink: 0,
  },
  textarea: {
    minHeight: 90,
    resize: 'vertical',
  },
  submitBtn: {
    background: '#f5ecd9',
    border: 'none',
    borderRadius: 10,
    color: '#0e0e0e',
    fontSize: '0.9rem',
    fontWeight: 700,
    padding: '0.85rem',
    cursor: 'pointer',
    marginTop: '0.25rem',
    fontFamily: 'inherit',
  },
  chipGrid: {
    display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
  },
  placementChip: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.78rem', fontWeight: 500,
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  placementChipActive: {
    background: 'rgba(245,236,217,0.12)',
    border: '1px solid rgba(245,236,217,0.35)',
    color: '#f5ecd9',
  },
  placementChipDisabled: {
    opacity: 0.3,
    cursor: 'default',
  },
  uploadLabel: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '0.5rem 0.85rem', fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.55)', cursor: 'pointer', alignSelf: 'flex-start',
  },
  photoGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' },
  photoThumb: { position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbRemove: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  consentBox: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  consentText: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.65, maxHeight: 160, overflowY: 'auto' },
  consentCheck: { display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' },
  switchLink: {
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '0.75rem', cursor: 'pointer',
    textAlign: 'center', padding: '0.25rem',
    fontFamily: 'inherit',
  },
  error: {
    fontSize: '0.78rem', color: '#e86f6f', margin: 0,
  },
  msg: {
    color: 'rgba(255,255,255,0.35)', fontSize: '0.875rem', padding: '2rem',
  },
  successIcon: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'rgba(76,201,138,0.15)',
    color: '#4cc98a',
    fontSize: '1.4rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  successTitle: {
    fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', margin: 0,
  },
  successSub: {
    fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6,
  },
};
