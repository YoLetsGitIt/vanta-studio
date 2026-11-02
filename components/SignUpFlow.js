'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Field from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { checkStudioSignupEmail, registerStudio, searchStudios } from '@/lib/api';

// ── Main flow ─────────────────────────────────────────────────────────────────

export default function SignUpFlow({ onSwitchToSignIn }) {
  const [step, setStep] = useState(1); // 1: account, 2: studio
  const [account, setAccount] = useState({ email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleAccountNext(data) {
    setAccount(data);
    setStep(2);
  }

  async function handleSubmit(newStudio) {
    setError('');
    setLoading(true);
    try {
      const { checkout_url } = await registerStudio({
        email: account.email,
        password: account.password,
        studioName: newStudio.name,
        studioId: newStudio.studioId,
        address: newStudio.address,
        latitude: newStudio.latitude ?? null,
        longitude: newStudio.longitude ?? null,
      });
      // Stripe confirms payment setup before creating the studio account.
      // Existing artist-created listings keep their original studio ID.
      window.sessionStorage.setItem('vanta-pending-signup', JSON.stringify({
        email: account.email,
        password: account.password,
      }));
      window.location.href = checkout_url;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <header style={s.signupHeader}>
        <h1 style={s.signupTitle}>Start your free trial</h1>
        <p style={s.signupSubtitle}>14 days to make Vanta your studio’s own.</p>
        <div style={s.planSummary}>
          <p style={s.planSummaryPrice}>A$30/month after your trial</p>
          <p style={s.trialNote}>Includes up to 6 artists. Additional artists A$5/month each. Card required.</p>
        </div>
      </header>
      <div style={s.switchRow}>
        <span style={s.switchRowText}>Already have an account?</span>
        <button type="button" onClick={onSwitchToSignIn} className="vanta-link" style={s.switchLink}>Sign in</button>
      </div>
      {/* Step indicator */}
      <div style={s.steps} aria-label="Signup progress">
        {['Account', 'Studio'].map((label, i) => {
          const num = i + 1;
          const active = step === num;
          const done = step > num;
          return (
            <div key={label} style={s.stepItem} aria-current={active ? 'step' : undefined}>
              <div style={{
                ...s.stepDot,
                background: active || done ? 'var(--accent)' : 'rgba(238,224,190,0.08)',
                color: active || done ? 'var(--accent-contrast)' : 'var(--text-muted)',
              }}>
                {done ? '✓' : num}
              </div>
              <span style={{ fontSize: '0.75rem', color: active ? 'var(--text)' : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {error && <p role="alert" style={s.errorBox}>{error}</p>}

      {step === 1 && (
        <AccountStep initial={account} onNext={handleAccountNext} />
      )}
      {step === 2 && (
        <StudioStep
          onBack={() => setStep(1)}
          onSubmit={handleSubmit}
          submitting={loading}
        />
      )}
    </div>
  );
}

// ── Step 1: Account details ───────────────────────────────────────────────────

function AccountStep({ initial, onNext }) {
  const [email, setEmail] = useState(initial.email);
  const [password, setPassword] = useState(initial.password);
  const [confirmPassword, setConfirmPassword] = useState(initial.confirmPassword);
  const [error, setError] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function handleEmailBlur() {
    if (email.trim() && !validateEmail(email)) {
      setError('Enter a valid email address, including a domain (for example, studio@example.com).');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const normalizedEmail = email.trim();
    // Browsers consider addresses such as "name@localhost" valid for an email
    // input. Stripe requires a deliverable-looking domain, so catch that before
    // the user reaches billing.
    if (!validateEmail(normalizedEmail)) {
      setError('Enter a valid email address, including a domain (for example, studio@example.com).');
      return;
    }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setCheckingEmail(true);
    try {
      await checkStudioSignupEmail(normalizedEmail);
      onNext({ email: normalizedEmail, password, confirmPassword });
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingEmail(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <Field label="Email">
        <InputWithIcon icon={<MailIcon size={15} />} type="email" value={email} onChange={e => { setEmail(e.target.value); if (error) setError(''); }} onBlur={handleEmailBlur} required pattern="[^\s@]+@[^\s@]+\.[^\s@]+" title="Enter an email address with a valid domain, such as studio@example.com." placeholder="studio@example.com" autoComplete="email" />
      </Field>
      <Field label="Password">
        <InputWithIcon icon={<LockIcon size={15} />} type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Minimum 8 characters" autoComplete="new-password" />
      </Field>
      <Field label="Confirm password">
        <InputWithIcon icon={<LockIcon size={15} />} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Re-enter password" autoComplete="new-password" />
      </Field>
      {error && <p role="alert" style={s.errorBox}>{error}</p>}
      <div style={s.rowBtns}>
        <Button type="submit" loading={checkingEmail} loadingLabel="Checking…" style={{ flex: 1 }}>Continue</Button>
      </div>
    </form>
  );
}

function InputWithIcon({ icon, style, ...props }) {
  return (
    <div style={{ position: 'relative' }}>
      <span aria-hidden="true" style={s.inputIcon}>{icon}</span>
      <input {...props} className="vanta-input" style={{ ...s.input, ...style, paddingLeft: '2.3rem' }} />
    </div>
  );
}

function MailIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 4.5l6 4.5 6-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ── Step 2: Studio search / create ───────────────────────────────────────────

function StudioStep({ onBack, onSubmit, submitting }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [claimed, setClaimed] = useState(null); // existing studio found in search — already signed up
  const [prefill, setPrefill] = useState(null); // studio found off-platform (e.g. Nominatim) — not yet claimed
  const [mode, setMode] = useState('search'); // 'search' | 'create'
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    setSearchError('');
    if (!q.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    try {
      const [backendStudios, externalStudios] = await Promise.all([
        searchStudios(q), searchExternalStudios(q).catch(() => []),
      ]);
      setResults(mergeStudioResults(backendStudios, externalStudios));
    } catch (err) {
      setResults([]); setSearchError(err.message || 'Could not search studios right now. Please try again.');
    } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  function searchAgain() {
    setClaimed(null);
    setQuery('');
    setResults([]);
  }

  function selectResult(studio) {
    // A saved artist workplace is available until it has a management account.
    if (studio.id && studio.signup_available !== true) {
      setClaimed(studio);
    } else {
      setPrefill(studio);
      setMode('create');
    }
  }

  if (mode === 'create') {
    return (
      <CreateStudioForm
        initialName={prefill?.name ?? query}
        initialResolved={(prefill?.addressString ?? prefill?.address_string) ? { address: prefill.addressString ?? prefill.address_string, latitude: prefill.latitude, longitude: prefill.longitude } : null}
        existingStudioId={prefill?.id ?? null}
        onBack={() => { setMode('search'); setPrefill(null); }}
        onSubmit={onSubmit}
        submitting={submitting}
      />
    );
  }

  if (claimed) {
    return <AlreadyClaimedNotice studio={claimed} onBack={searchAgain} />;
  }

  return (
    <div style={s.form}>
      <Field label="Search for your studio" id="signup-studio-search">
        <div style={{ position: 'relative' }}>
          <input
            id="signup-studio-search"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="vanta-input"
            style={s.input}
            placeholder="Studio name or address…"
            autoComplete="off"
          />
          {searching && <span style={s.searchSpinner}>·</span>}

          {/* Public listings can be unclaimed or already managed. */}
          {results.length > 0 && (
            <div style={s.dropdown}>
              {results.map((studio, i) => (
                <button
                  key={studio.id ?? `ext-${i}`}
                  type="button"
                  onClick={() => selectResult(studio)}
                  style={s.dropdownItem}
                >
                  <span style={s.dropdownName}>{studio.name}</span>
                  {(studio.addressString ?? studio.address_string) && (
                    <span style={s.dropdownAddr}>{studio.addressString ?? studio.address_string}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      {searchError && <p role="alert" style={s.errorBox}>{searchError}</p>}
      {/* Add new studio option */}
      {query.trim().length > 0 && results.length === 0 && !searching && !searchError && (
        <button type="button" onClick={() => setMode('create')} className="vanta-btn" style={s.addNewBtn}>
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
          Add "{query}" as a new studio
        </button>
      )}
      {(results.length > 0 || query.trim().length === 0) && (
        <button type="button" onClick={() => setMode('create')} className="vanta-link" style={s.addNewBtnSecondary}>
          My studio isn't listed — add it
        </button>
      )}

      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} className="vanta-back-btn" style={s.backBtn}>Back</button>
      </div>
    </div>
  );
}

// Nominatim-backed fallback so studios that haven't been added to Vanta yet are still
// findable by name — mirrors the backend + MapKit merge the iOS app does in StudioSearchField.
async function searchExternalStudios(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(query + ' tattoo')}`,
    { headers: { 'Accept-Language': 'en' } }
  );
  const data = await res.json();
  return data
    .filter(place => place.name) // skip plain address hits Nominatim couldn't attach a place name to
    .map(place => ({
      id: null,
      name: place.name,
      addressString: buildAddressString(place.address),
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
    }));
}

// Street-level address only (no business name) — built from Nominatim's address components,
// same shape as the iOS app builds from MKPlacemark (subThoroughfare/thoroughfare/locality/state).
function buildAddressString(address) {
  if (!address) return '';
  const parts = [];
  if (address.house_number) parts.push(address.house_number);
  if (address.road) parts.push(address.road);
  const locality = address.suburb ?? address.city ?? address.town ?? address.village;
  if (locality) parts.push(locality);
  if (address.state) parts.push(address.state);
  return parts.join(', ');
}

// Strips unit designators so "4/358 Main St" == "358 Main St" for dedup purposes.
function stripUnit(street) {
  let s = (street ?? '').trim();
  s = s.replace(/^\d+\/(?=\d)/, '');
  s = s.replace(/\s+(suite|ste\.?|unit|apt\.?|apartment|floor|fl\.?|#)\s*\w*/i, '');
  return s.toLowerCase();
}

// Backend results first; append external results not already covered by a backend entry
// (same name + same street-level address).
function mergeStudioResults(backend, external) {
  const merged = [...backend];
  for (const ext of external) {
    const isDuplicate = backend.some(b => {
      const bName = (b.name ?? '').trim().toLowerCase();
      const eName = (ext.name ?? '').trim().toLowerCase();
      if (bName !== eName) return false;
      const bStreet = stripUnit((b.addressString ?? b.address_string ?? '').split(',')[0]);
      const eStreet = stripUnit((ext.addressString ?? '').split(',')[0]);
      return bStreet === eStreet;
    });
    if (!isDuplicate) merged.push(ext);
  }
  return merged;
}

// ── Studio already claimed notice ─────────────────────────────────────────────

function AlreadyClaimedNotice({ studio, onBack }) {
  return (
    <div style={s.form}>
      <div style={s.claimedNotice}>
        <div style={s.selectedName}>{studio.name}</div>
        {(studio.addressString ?? studio.address_string) && (
          <div style={s.selectedAddr}>{studio.addressString ?? studio.address_string}</div>
        )}
        <p style={s.claimedBody}>
          This studio is already signed up with Vanta. If this isn't right, contact{' '}
          <a href="mailto:support@vanta.tattoo" className="vanta-link" style={s.claimedLink}>support@vanta.tattoo</a>{' '}
          right away to dispute it.
        </p>
      </div>
      <button type="button" onClick={onBack} className="vanta-back-btn" style={s.backBtn}>Search again</button>
    </div>
  );
}

// ── Create new studio form ────────────────────────────────────────────────────

function CreateStudioForm({ initialName, initialResolved, existingStudioId, onBack, onSubmit, submitting }) {
  const [name, setName] = useState(initialName ?? '');
  const [addressQuery, setAddressQuery] = useState(initialResolved?.address ?? '');
  const [suggestions, setSuggestions] = useState([]);
  const [resolved, setResolved] = useState(initialResolved ?? null); // { address, latitude, longitude }
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  // Nominatim address autocomplete
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!addressQuery.trim() || resolved) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(addressQuery)}`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setSuggestions(data);
      } catch { setSuggestions([]); }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [addressQuery, resolved]);

  function selectSuggestion(place) {
    setResolved({
      address: place.display_name,
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
    });
    setAddressQuery(place.display_name);
    setSuggestions([]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Studio name is required'); return; }
    if (!resolved) { setError('Please select an address from the suggestions'); return; }
    onSubmit({ studioId: existingStudioId, name: name.trim(), address: resolved.address, latitude: resolved.latitude, longitude: resolved.longitude });
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      {existingStudioId && <p style={s.trialNote}>This studio is already listed. Create its studio account to manage it.</p>}
      <Field label="Studio name">
        <input type="text" value={name} readOnly={!!existingStudioId} onChange={e => setName(e.target.value)} required className="vanta-input" style={s.input} placeholder="e.g. Dark Matter Tattoo" />
      </Field>

      <Field label="Address" id="signup-studio-address">
        <div style={{ position: 'relative' }}>
          <input
            id="signup-studio-address"
            type="text"
            readOnly={!!existingStudioId && !!initialResolved}
            value={addressQuery}
            onChange={e => { setAddressQuery(e.target.value); setResolved(null); }}
            className="vanta-input"
            style={s.input}
            placeholder="Start typing your address…"
            autoComplete="off"
          />
          {suggestions.length > 0 && !resolved && (
            <div style={s.dropdown}>
              {suggestions.map(place => (
                <button
                  key={place.place_id}
                  type="button"
                  onClick={() => selectSuggestion(place)}
                  style={s.dropdownItem}
                >
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textAlign: 'left' }}>
                    {place.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      {resolved && (
        <div style={s.resolvedBadge}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>✓ Location confirmed</span>
          {!(existingStudioId && initialResolved) && <button type="button" onClick={() => { setResolved(null); setAddressQuery(''); }} className="vanta-link" style={s.clearBtn}>
            Change
          </button>}
        </div>
      )}

      {error && <p role="alert" style={s.errorBox}>{error}</p>}

      <p style={s.trialNote}>
        Next, add a card to start your 14-day free trial — you won't be charged until it ends.
      </p>

      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} className="vanta-back-btn" style={s.backBtn}>Back</button>
        <Button type="submit" loading={submitting} loadingLabel="Redirecting to checkout…" style={{ flex: 1 }}>Continue to payment</Button>
      </div>
    </form>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const s = {
  signupHeader: { marginBottom: '1.5rem' },
  signupTitle: { fontSize: 'clamp(1.65rem, 3vw, 2rem)', fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.2, margin: '0 0 0.6rem', color: 'var(--text)' },
  signupSubtitle: { margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-muted)' },
  planSummary: { marginTop: '1.2rem', padding: '0.9rem 1rem', borderLeft: '2px solid var(--accent)', background: 'rgba(238,224,190,0.035)' },
  planSummaryPrice: { margin: '0 0 0.3rem', fontSize: '0.87rem', fontWeight: 600, color: 'var(--text)' },
  steps: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    marginBottom: '1.75rem',
    position: 'relative',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    flex: 1,
    zIndex: 1,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    fontSize: '0.7rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1.1rem' },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '0.65rem 0.85rem',
    fontSize: '0.9rem',
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
  },
  inputIcon: {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    display: 'flex',
    pointerEvents: 'none',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  rowBtns: { display: 'flex', gap: '0.6rem', marginTop: '0.25rem' },
  trialNote: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    margin: 0,
  },
  switchRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '0.35rem',
    marginBottom: '1.1rem',
  },
  switchRowText: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontWeight: 600,
    fontSize: '0.78rem',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  errorBox: {
    fontSize: '0.8rem',
    color: 'var(--color-danger)',
    background: 'rgba(232,111,111,0.08)',
    border: '1px solid rgba(232,111,111,0.2)',
    borderRadius: 6,
    padding: '0.5rem 0.75rem',
    margin: 0,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: '#151b24',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 50,
    maxHeight: 220,
    overflowY: 'auto',
  },
  dropdownItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    width: '100%',
    padding: '0.7rem 0.85rem',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  dropdownName: { fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 },
  dropdownAddr: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  selectedName: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' },
  selectedAddr: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 },
  claimedNotice: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    background: 'rgba(232,111,111,0.06)',
    border: '1px solid rgba(232,111,111,0.2)',
    borderRadius: 8,
    padding: '0.9rem',
  },
  claimedBody: { fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.5, margin: '0.4rem 0 0' },
  claimedLink: { color: 'var(--accent)' },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  addNewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.7rem 0.85rem',
    background: 'rgba(213,208,199,0.06)',
    border: '1px solid rgba(213,208,199,0.15)',
    borderRadius: 8,
    color: 'var(--accent)',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  },
  addNewBtnSecondary: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 0',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  searchSpinner: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    fontSize: '1.5rem',
  },
  resolvedBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(76,201,138,0.07)',
    border: '1px solid rgba(76,201,138,0.2)',
    borderRadius: 8,
    padding: '0.6rem 0.85rem',
  },
};
