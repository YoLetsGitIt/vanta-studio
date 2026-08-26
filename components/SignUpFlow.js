'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { registerStudio, searchStudios } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';

// ── Main flow ─────────────────────────────────────────────────────────────────

export default function SignUpFlow({ onSwitchToSignIn, onWideChange }) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0: intro, 1: account, 2: studio
  const [account, setAccount] = useState({ email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // The intro step has enough content (preview + feature grid) to earn a wider card;
  // Account/Studio stay narrow, so tell the parent page which width to render.
  useEffect(() => {
    onWideChange?.(step === 0);
    return () => onWideChange?.(false);
  }, [step, onWideChange]);

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
        address: newStudio.address,
        latitude: newStudio.latitude ?? null,
        longitude: newStudio.longitude ?? null,
      });
      // No review needed — sign in, then hand off to Stripe Checkout to collect the
      // card and start the 14-day trial. The account stays pending until Stripe confirms.
      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (signInError) { router.replace('/'); return; }
      window.location.href = checkout_url;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={s.switchRow}>
        <span style={s.switchRowText}>Already have an account?</span>
        <button type="button" onClick={onSwitchToSignIn} style={s.switchLink}>Sign in</button>
      </div>

      {step === 0 && <IntroStep onNext={() => setStep(1)} />}

      {step > 0 && (
        <>
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
            <AccountStep initial={account} onBack={() => setStep(0)} onNext={handleAccountNext} />
          )}
          {step === 2 && (
            <StudioStep
              onBack={() => setStep(1)}
              onSubmit={handleSubmit}
              submitting={loading}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Step 0: What you get ──────────────────────────────────────────────────────

const PLAN_FEATURES = [
  {
    key: 'schedule',
    icon: <WidgetIcon />,
    title: 'Booking widget',
    desc: 'A shareable link clients use to request a session, with deposits, 7-day/24-hour reminders, and a reschedule cutoff you control.',
  },
  {
    key: 'clients',
    icon: <PersonIcon />,
    title: 'Client records',
    desc: 'Consent status, allergies, and full booking history per client — plus CSV import from your old system.',
  },
  {
    key: 'artists',
    icon: <UsersIcon />,
    title: 'Artist management',
    desc: 'Approve artists, assign stations, and set separate walk-in vs. personal commission splits — payouts track automatically.',
  },
  {
    key: 'analytics',
    icon: <ChartIcon />,
    title: 'Analytics',
    desc: 'Gross and net sales, sales-per-hour by artist, and payout/reimbursement tracking — always current.',
  },
];

// The feature tabs drive everything below them (the sliding highlight, the preview panel,
// and the description text) via a single activeIndex, auto-advancing on a timer unless the
// visitor clicks a tab directly — clicking restarts the timer so it never fights them. Below
// ~480px viewport width the tab labels drop to icon-only so four tabs still fit in a row.
const INTRO_LAYOUT_CSS = `
@media (max-width: 480px) { .vanta-tab-label { display: none; } }
.vanta-cta-bar { display: flex; flex-direction: column; gap: 1rem; }
.vanta-cta-action { display: flex; flex-direction: column; gap: 0.6rem; }
@media (min-width: 560px) {
  .vanta-cta-bar { flex-direction: row; align-items: center; }
  .vanta-cta-price { flex-shrink: 0; width: 230px; }
  .vanta-cta-action { flex: 1; }
}
`;

const PREVIEW_CYCLE_MS = 3400;

function IntroStep({ onNext }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = PLAN_FEATURES[activeIndex];

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveIndex(i => (i + 1) % PLAN_FEATURES.length);
    }, PREVIEW_CYCLE_MS);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  return (
    <div style={s.introWrap}>
      <style>{INTRO_LAYOUT_CSS}</style>

      <FeatureTabs features={PLAN_FEATURES} activeIndex={activeIndex} onSelect={setActiveIndex} />

      <div style={s.explanationArea}>
        <DashboardPreview tab={active.key} />
        <div key={active.key} className="vanta-preview-panel">
          <h3 style={s.introTitle}>{active.title}</h3>
          <p style={s.introSubtitle}>{active.desc}</p>
        </div>
      </div>

      <div className="vanta-cta-bar" style={s.ctaBar}>
        <div className="vanta-cta-price" style={s.planPriceCard}>
          <span style={s.trialPill}>14-day free trial</span>
          <div style={s.planPriceRow}>
            <span style={s.planPriceAmount}>$60</span>
            <span style={s.planPriceUnit}>/mo AUD</span>
          </div>
          <p style={s.planPriceDetail}>Covers up to 6 artists, then $15/artist beyond that.</p>
        </div>

        <div className="vanta-cta-action">
          <p style={s.trialNote}>
            You won't be charged until the trial ends, and you can cancel anytime from Settings.
          </p>
          <button type="button" onClick={onNext} style={s.btn}>Get started</button>
        </div>
      </div>
    </div>
  );
}

// A segmented control whose highlight slides (via transform, not re-layout) to sit behind
// whichever feature is active — driven either by a click here or by IntroStep's auto-advance.
function FeatureTabs({ features, activeIndex, onSelect }) {
  return (
    <div style={s.tabsRow}>
      <div
        style={{
          ...s.tabsHighlight,
          width: `${100 / features.length}%`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {features.map((f, i) => (
        <button
          key={f.title}
          type="button"
          onClick={() => onSelect(i)}
          style={{ ...s.tabItem, ...(activeIndex === i ? s.tabItemActive : {}) }}
        >
          <span style={s.tabIcon}>{f.icon}</span>
          <span className="vanta-tab-label" style={s.tabLabel}>{f.title}</span>
        </button>
      ))}
    </div>
  );
}

// Stylized preview of the studio dashboard — an illustration, not a literal screenshot, so
// it needs no signed-in account or seeded data to render truthfully. Purely reflects
// whichever feature tab is active; the progress bar in the chrome row mirrors the same
// auto-advance timer IntroStep drives the tabs with.
const PREVIEW_NAV = [
  { key: 'schedule', icon: HomeIcon },
  { key: 'schedule', icon: GridCalIcon },
  { key: 'artists', icon: UsersIcon },
  { key: 'clients', icon: PersonIcon },
  { key: 'analytics', icon: ChartIcon },
];

const PREVIEW_KEYFRAMES = `
@keyframes vantaPreviewProgress { from { width: 0%; } to { width: 100%; } }
@keyframes vantaPreviewFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.vanta-preview-progress { animation: vantaPreviewProgress ${PREVIEW_CYCLE_MS}ms linear; }
.vanta-preview-panel { animation: vantaPreviewFade 320ms ease; }
`;

function DashboardPreview({ tab }) {
  return (
    <div style={s.previewFrame}>
      <style>{PREVIEW_KEYFRAMES}</style>
      <div style={s.previewChrome}>
        <span style={{ ...s.previewDot, background: '#e8756f' }} />
        <span style={{ ...s.previewDot, background: '#e8c56f' }} />
        <span style={{ ...s.previewDot, background: '#6fbf8a' }} />
        <div style={s.previewProgressTrack}>
          <div key={tab} className="vanta-preview-progress" style={s.previewProgressFill} />
        </div>
      </div>
      <div style={s.previewBody}>
        <div style={s.previewSidebar}>
          {PREVIEW_NAV.map(({ key, icon: Icon }, i) => (
            <div key={i} style={{ ...s.previewSidebarIcon, ...(tab === key ? s.previewSidebarIconActive : {}) }}>
              <Icon size={11} />
            </div>
          ))}
        </div>
        <div style={s.previewMain}>
          <div key={tab} className="vanta-preview-panel" style={{ height: '100%' }}>
            {tab === 'schedule' && <SchedulePanel />}
            {tab === 'artists' && <ArtistsPanel />}
            {tab === 'clients' && <ClientsPanel />}
            {tab === 'analytics' && <AnalyticsPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

// A week view with a few colored appointment blocks of varying day/duration — reads as a
// real schedule rather than a uniform grid of identical cells.
function SchedulePanel() {
  const events = [
    { col: 0, row: 0, span: 2, color: 'rgba(245,236,217,0.6)' },
    { col: 1, row: 2, span: 1, color: 'rgba(111,191,138,0.55)' },
    { col: 2, row: 0, span: 3, color: 'rgba(245,236,217,0.6)' },
    { col: 3, row: 1, span: 2, color: 'rgba(130,170,220,0.55)' },
    { col: 4, row: 0, span: 1, color: 'rgba(111,191,138,0.55)' },
    { col: 4, row: 2, span: 2, color: 'rgba(245,236,217,0.6)' },
  ];
  return (
    <div style={s.scheduleGrid}>
      <div style={s.scheduleBg}>
        {Array.from({ length: 25 }).map((_, i) => <div key={i} style={s.scheduleBgCell} />)}
      </div>
      {events.map((e, i) => (
        <div
          key={i}
          style={{
            ...s.scheduleEvent,
            left: `${e.col * 20 + 1}%`,
            top: `${e.row * 20 + 2}%`,
            height: `${e.span * 20 - 4}%`,
            background: e.color,
          }}
        />
      ))}
    </div>
  );
}

// Each row: avatar, name bar, station badge, commission %  — a dimmed row stands in for an
// artist who's toggled off "accepting bookings".
function ArtistsPanel() {
  const rows = [
    { name: 62, station: 'St. 1', pct: 78, active: true },
    { name: 45, station: 'St. 2', pct: 52, active: true },
    { name: 70, station: 'St. 3', pct: 90, active: false },
  ];
  return (
    <div style={s.previewList}>
      {rows.map((r, i) => (
        <div key={i} style={{ ...s.previewListRow, opacity: r.active ? 1 : 0.4 }}>
          <span style={s.previewAvatar} />
          <span style={s.previewBarTrack}><span style={{ ...s.previewBarFill, width: `${r.name}%` }} /></span>
          <span style={s.previewStationTag}>{r.station}</span>
          <span style={s.previewListTag}>{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

// Each row: avatar, name bar, then one of three consent/allergy states — showing the range
// of statuses the real client list badges (consented / outdated / allergy note).
function ClientsPanel() {
  const rows = [
    { name: 65, status: 'good' },
    { name: 88, status: 'warn' },
    { name: 42, status: 'allergy' },
  ];
  return (
    <div style={s.previewList}>
      {rows.map((r, i) => (
        <div key={i} style={s.previewListRow}>
          <span style={s.previewAvatar} />
          <span style={s.previewBarTrack}><span style={{ ...s.previewBarFill, width: `${r.name}%` }} /></span>
          {r.status === 'good' && <span style={s.previewListTagGood}>✓</span>}
          {r.status === 'warn' && <span style={s.previewListTagWarn}>!</span>}
          {r.status === 'allergy' && <span style={s.previewListTagAllergy}>⚠</span>}
        </div>
      ))}
    </div>
  );
}

// KPI chips (gross / net / payouts) above a bar chart — mirrors the real financial page's
// top row plus its per-artist sales breakdown.
function AnalyticsPanel() {
  const bars = [35, 55, 40, 72, 50, 85, 60];
  return (
    <div style={s.analyticsWrap}>
      <div style={s.analyticsKpiRow}>
        <div style={s.analyticsKpi}>
          <span style={s.analyticsKpiValue}>$12.4k</span>
          <span style={s.analyticsKpiLabel}>Gross</span>
        </div>
        <div style={s.analyticsKpi}>
          <span style={s.analyticsKpiValue}>$9.1k</span>
          <span style={s.analyticsKpiLabel}>Net</span>
        </div>
        <div style={s.analyticsKpi}>
          <span style={s.analyticsKpiValue}>$3.2k</span>
          <span style={s.analyticsKpiLabel}>Payouts</span>
        </div>
      </div>
      <div style={{ ...s.previewBarChart, flex: 1 }}>
        {bars.map((h, i) => <span key={i} style={{ ...s.previewChartBar, height: `${h}%` }} />)}
      </div>
    </div>
  );
}

function WidgetIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 5.5h13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 8.5h5M4 10.8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 7.5a2.5 2.5 0 1 0 0-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M13 13c0-1.86-.9-3.5-2.26-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 12l3.5-4 3 2.5L12 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function HomeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 6.5L8 2l6 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M6 15v-5h4v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridCalIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 1.5v2M10.5 1.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4.5 9.5h2M9.5 9.5h2M4.5 12h2M9.5 12h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ── Step 1: Account details ───────────────────────────────────────────────────

function AccountStep({ initial, onBack, onNext }) {
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
      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} style={s.backBtn}>Back</button>
        <button type="submit" style={{ ...s.btn, flex: 1 }}>Continue</button>
      </div>
    </form>
  );
}

// ── Step 2: Studio search / create ───────────────────────────────────────────

function StudioStep({ onBack, onSubmit, submitting }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [claimed, setClaimed] = useState(null); // existing studio found in search — already signed up
  const [prefill, setPrefill] = useState(null); // studio found off-platform (e.g. Nominatim) — not yet claimed
  const [mode, setMode] = useState('search'); // 'search' | 'create'
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const [backendStudios, externalStudios] = await Promise.all([
      searchStudios(q).catch(() => []),
      searchExternalStudios(q).catch(() => []),
    ]);
    setResults(mergeStudioResults(backendStudios, externalStudios));
    setSearching(false);
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
    // Backend results have an id — that studio is already signed up with Vanta.
    // External (Nominatim) results don't — carry them into the create form as a prefill.
    if (studio.id) {
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
        initialResolved={prefill ? { address: prefill.addressString, latitude: prefill.latitude, longitude: prefill.longitude } : null}
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
      <Field label="Search for your studio">
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={s.input}
            placeholder="Studio name or address…"
            autoComplete="off"
          />
          {searching && <span style={s.searchSpinner}>·</span>}

          {/* Results dropdown — backend hits are already registered; others are found nearby and prefill the create form */}
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

      {/* Add new studio option */}
      {query.trim().length > 0 && results.length === 0 && !searching && (
        <button type="button" onClick={() => setMode('create')} style={s.addNewBtn}>
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
          Add "{query}" as a new studio
        </button>
      )}
      {(results.length > 0 || query.trim().length === 0) && (
        <button type="button" onClick={() => setMode('create')} style={s.addNewBtnSecondary}>
          My studio isn't listed — add it
        </button>
      )}

      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} style={s.backBtn}>Back</button>
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
          <a href="mailto:support@vanta.tattoo" style={s.claimedLink}>support@vanta.tattoo</a>{' '}
          right away to dispute it.
        </p>
      </div>
      <button type="button" onClick={onBack} style={s.backBtn}>Search again</button>
    </div>
  );
}

// ── Create new studio form ────────────────────────────────────────────────────

function CreateStudioForm({ initialName, initialResolved, onBack, onSubmit, submitting }) {
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

      <p style={s.trialNote}>
        Next, add a card to start your 14-day free trial — you won't be charged until it ends.
      </p>

      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} style={s.backBtn}>Back</button>
        <button type="submit" disabled={submitting} style={{ ...s.btn, flex: 1, opacity: submitting ? 0.5 : 1 }}>
          {submitting ? 'Redirecting to checkout…' : 'Continue to payment'}
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
  trialNote: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 1.5,
    margin: 0,
  },
  introWrap: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  switchRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '0.35rem',
    marginBottom: '1.1rem',
  },
  switchRowText: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.4)',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#f5ecd9',
    fontWeight: 600,
    fontSize: '0.78rem',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  tabsRow: {
    position: 'relative',
    display: 'flex',
    gap: 2,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 4,
  },
  tabsHighlight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 7,
    background: 'rgba(245,236,217,0.12)',
    border: '1px solid rgba(245,236,217,0.28)',
    transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  tabItem: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.65rem 0.4rem',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  tabItemActive: { color: '#f5ecd9' },
  tabIcon: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  tabLabel: { fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' },
  explanationArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },
  introTitle: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#ffffff',
    margin: '0 0 0.35rem',
    letterSpacing: '-0.01em',
  },
  introSubtitle: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.55)',
    margin: 0,
    lineHeight: 1.6,
    maxWidth: 520,
  },
  ctaBar: {
    paddingTop: '1.25rem',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  planPriceCard: {
    background: 'linear-gradient(160deg, rgba(245,236,217,0.09), rgba(255,255,255,0.03))',
    border: '1px solid rgba(245,236,217,0.22)',
    borderRadius: 10,
    padding: '1rem 1.1rem',
    boxShadow: '0 0 28px rgba(245,236,217,0.06)',
  },
  trialPill: {
    display: 'inline-block',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    color: '#4cc98a',
    background: 'rgba(76,201,138,0.12)',
    borderRadius: 999,
    padding: '0.2rem 0.55rem',
    marginBottom: '0.55rem',
  },
  planPriceRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.3rem',
  },
  planPriceAmount: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#f5ecd9',
  },
  planPriceUnit: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.5)',
  },
  planPriceDetail: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.55)',
    margin: '0.35rem 0 0',
  },
  previewFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#11161d',
    boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
  },
  previewChrome: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '0.55rem 0.7rem',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  previewDot: { width: 7, height: 7, borderRadius: '50%' },
  previewProgressTrack: {
    marginLeft: 'auto',
    width: 56,
    height: 3,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  previewProgressFill: {
    display: 'block',
    height: '100%',
    width: '0%',
    background: 'rgba(245,236,217,0.65)',
  },
  previewBody: { display: 'flex', height: 210 },
  previewSidebar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 0.45rem',
    background: 'rgba(255,255,255,0.02)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
  },
  previewSidebarIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 5,
    color: 'rgba(255,255,255,0.3)',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  previewSidebarIconActive: {
    background: 'rgba(245,236,217,0.14)',
    color: '#f5ecd9',
  },
  previewMain: { flex: 1, padding: '0.65rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  scheduleGrid: { position: 'relative', height: '100%' },
  scheduleBg: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gridTemplateRows: 'repeat(5, 1fr)',
    gap: '3px',
  },
  scheduleBgCell: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 2,
  },
  scheduleEvent: {
    position: 'absolute',
    width: '18%',
    borderRadius: 3,
  },
  previewList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
  },
  previewListRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  },
  previewAvatar: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    flexShrink: 0,
    background: 'rgba(255,255,255,0.12)',
  },
  previewBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  previewBarFill: {
    display: 'block',
    height: '100%',
    borderRadius: 3,
    background: 'rgba(245,236,217,0.5)',
  },
  previewListTag: {
    fontSize: '0.55rem',
    color: 'rgba(255,255,255,0.35)',
    flexShrink: 0,
    width: 24,
    textAlign: 'right',
  },
  previewListTagGood: {
    fontSize: '0.6rem',
    color: '#4cc98a',
    flexShrink: 0,
    width: 24,
    textAlign: 'right',
  },
  previewListTagWarn: {
    fontSize: '0.6rem',
    fontWeight: 700,
    color: '#e8c56f',
    flexShrink: 0,
    width: 24,
    textAlign: 'right',
  },
  previewListTagAllergy: {
    fontSize: '0.6rem',
    color: '#e8756f',
    flexShrink: 0,
    width: 24,
    textAlign: 'right',
  },
  previewStationTag: {
    fontSize: '0.5rem',
    color: 'rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    padding: '0.1rem 0.35rem',
    flexShrink: 0,
  },
  previewBarChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '5px',
    height: '100%',
  },
  previewChartBar: {
    flex: 1,
    borderRadius: '2px 2px 0 0',
    background: 'rgba(245,236,217,0.5)',
  },
  analyticsWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    height: '100%',
  },
  analyticsKpiRow: {
    display: 'flex',
    gap: '0.6rem',
  },
  analyticsKpi: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  analyticsKpiValue: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  analyticsKpiLabel: {
    fontSize: '0.45rem',
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
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
  selectedName: { fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' },
  selectedAddr: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  claimedNotice: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    background: 'rgba(232,111,111,0.06)',
    border: '1px solid rgba(232,111,111,0.2)',
    borderRadius: 8,
    padding: '0.9rem',
  },
  claimedBody: { fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: '0.4rem 0 0' },
  claimedLink: { color: '#f5ecd9' },
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
