'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { registerStudio, searchStudios } from '@/lib/api';

// ── Main flow ─────────────────────────────────────────────────────────────────

export default function SignUpFlow({ onSwitchToSignIn }) {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: account, 2: studio
  const [account, setAccount] = useState({ email: '', password: '', confirmPassword: '' });
  const [studio, setStudio] = useState(null); // { id?, name, address, latitude?, longitude? }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleAccountNext(data) {
    setAccount(data);
    setStep(2);
  }

  async function handleSubmit(selectedStudio) {
    setStudio(selectedStudio);
    setError('');
    setLoading(true);
    try {
      await registerStudio({
        email: account.email,
        password: account.password,
        studioId: selectedStudio.id ?? null,
        studioName: selectedStudio.name,
        address: selectedStudio.address,
        latitude: selectedStudio.latitude ?? null,
        longitude: selectedStudio.longitude ?? null,
      });
      router.replace('/pending');
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Step indicator */}
      <div style={s.steps}>
        {['Account', 'Studio'].map((label, i) => {
          const num = i + 1;
          const active = step === num;
          const done = step > num;
          return (
            <div key={label} style={s.stepItem}>
              <div style={{
                ...s.stepDot,
                background: done ? '#4cc98a' : active ? '#f5ecd9' : 'rgba(255,255,255,0.1)',
                color: done ? '#0d1017' : active ? '#0d1017' : 'rgba(255,255,255,0.3)',
              }}>
                {done ? '✓' : num}
              </div>
              <span style={{ fontSize: '0.75rem', color: active ? '#f5ecd9' : 'rgba(255,255,255,0.3)', fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
            </div>
          );
        })}
        <div style={s.stepLine} />
      </div>

      {error && <p style={s.errorBox}>{error}</p>}

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

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    onNext({ email, password, confirmPassword });
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <Field label="Email">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={s.input} placeholder="studio@example.com" autoComplete="email" />
      </Field>
      <Field label="Password">
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={s.input} placeholder="Minimum 8 characters" autoComplete="new-password" />
      </Field>
      <Field label="Confirm password">
        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={s.input} placeholder="Re-enter password" autoComplete="new-password" />
      </Field>
      {error && <p style={s.errorBox}>{error}</p>}
      <button type="submit" style={s.btn}>Continue</button>
    </form>
  );
}

// ── Step 2: Studio search / create ───────────────────────────────────────────

function StudioStep({ onBack, onSubmit, submitting }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // existing studio
  const [mode, setMode] = useState('search'); // 'search' | 'create'
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const studios = await searchStudios(q);
      setResults(studios);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  function selectExisting(studio) {
    setSelected(studio);
    setQuery(studio.name);
    setResults([]);
  }

  function handleContinueWithSelected() {
    onSubmit({
      id: selected.id,
      name: selected.name,
      address: selected.addressString ?? selected.address_string ?? '',
      latitude: selected.latitude,
      longitude: selected.longitude,
    });
  }

  if (mode === 'create') {
    return (
      <CreateStudioForm
        initialName={query}
        onBack={() => setMode('search')}
        onSubmit={onSubmit}
        submitting={submitting}
      />
    );
  }

  return (
    <div style={s.form}>
      <Field label="Search for your studio">
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); }}
            style={s.input}
            placeholder="Studio name or address…"
            autoComplete="off"
          />
          {searching && <span style={s.searchSpinner}>·</span>}
        </div>

        {/* Results dropdown */}
        {results.length > 0 && !selected && (
          <div style={s.dropdown}>
            {results.map(studio => (
              <button
                key={studio.id}
                type="button"
                onClick={() => selectExisting(studio)}
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
      </Field>

      {/* Selected studio confirmation */}
      {selected && (
        <div style={s.selectedCard}>
          <div>
            <div style={s.selectedName}>{selected.name}</div>
            {(selected.addressString ?? selected.address_string) && (
              <div style={s.selectedAddr}>{selected.addressString ?? selected.address_string}</div>
            )}
          </div>
          <button type="button" onClick={() => { setSelected(null); setQuery(''); }} style={s.clearBtn}>Change</button>
        </div>
      )}

      {/* Add new studio option */}
      {!selected && query.trim().length > 0 && results.length === 0 && !searching && (
        <button type="button" onClick={() => setMode('create')} style={s.addNewBtn}>
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
          Add "{query}" as a new studio
        </button>
      )}
      {!selected && (results.length > 0 || query.trim().length === 0) && (
        <button type="button" onClick={() => setMode('create')} style={s.addNewBtnSecondary}>
          My studio isn't listed — add it
        </button>
      )}

      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} style={s.backBtn}>Back</button>
        <button
          type="button"
          disabled={!selected || submitting}
          onClick={handleContinueWithSelected}
          style={{ ...s.btn, flex: 1, opacity: (!selected || submitting) ? 0.5 : 1 }}
        >
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </div>
  );
}

// ── Create new studio form ────────────────────────────────────────────────────

function CreateStudioForm({ initialName, onBack, onSubmit, submitting }) {
  const [name, setName] = useState(initialName ?? '');
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [resolved, setResolved] = useState(null); // { address, latitude, longitude }
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
    onSubmit({ name: name.trim(), address: resolved.address, latitude: resolved.latitude, longitude: resolved.longitude });
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      <Field label="Studio name">
        <input type="text" value={name} onChange={e => setName(e.target.value)} required style={s.input} placeholder="e.g. Dark Matter Tattoo" />
      </Field>

      <Field label="Address">
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={addressQuery}
            onChange={e => { setAddressQuery(e.target.value); setResolved(null); }}
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
                  <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', textAlign: 'left' }}>
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
          <span style={{ fontSize: '0.8rem', color: '#4cc98a' }}>✓ Location confirmed</span>
          <button type="button" onClick={() => { setResolved(null); setAddressQuery(''); }} style={s.clearBtn}>
            Change
          </button>
        </div>
      )}

      {error && <p style={s.errorBox}>{error}</p>}

      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} style={s.backBtn}>Back</button>
        <button type="submit" disabled={submitting} style={{ ...s.btn, flex: 1, opacity: submitting ? 0.5 : 1 }}>
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </form>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>{label}</label>
      {children}
    </div>
  );
}

const s = {
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
  stepLine: {
    position: 'absolute',
    top: 11,
    left: 22,
    right: 22,
    height: 1,
    background: 'rgba(255,255,255,0.08)',
    zIndex: 0,
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1.1rem' },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '0.65rem 0.85rem',
    fontSize: '0.9rem',
    color: '#ffffff',
    outline: 'none',
    width: '100%',
  },
  btn: {
    background: '#f5ecd9',
    color: '#0d1017',
    border: 'none',
    borderRadius: 8,
    padding: '0.75rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  rowBtns: { display: 'flex', gap: '0.6rem', marginTop: '0.25rem' },
  errorBox: {
    fontSize: '0.8rem',
    color: '#e86f6f',
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
  dropdownName: { fontSize: '0.875rem', color: '#ffffff', fontWeight: 500 },
  dropdownAddr: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' },
  selectedCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    background: 'rgba(76,201,138,0.07)',
    border: '1px solid rgba(76,201,138,0.2)',
    borderRadius: 8,
    padding: '0.75rem',
  },
  selectedName: { fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' },
  selectedAddr: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  addNewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.7rem 0.85rem',
    background: 'rgba(245,236,217,0.06)',
    border: '1px solid rgba(245,236,217,0.15)',
    borderRadius: 8,
    color: '#f5ecd9',
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
    color: 'rgba(255,255,255,0.35)',
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
    color: 'rgba(255,255,255,0.3)',
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
