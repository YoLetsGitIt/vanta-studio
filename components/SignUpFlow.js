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
        <button type="button" onClick={onSwitchToSignIn} className="vanta-link" style={s.switchLink}>Sign in</button>
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
    key: 'branding',
    icon: <PaletteIcon />,
    title: 'Widget branding',
    desc: 'Match the booking widget to your studio with custom colors, live-previewed, then drop a one-line embed snippet into your own site.',
  },
  {
    key: 'clients',
    icon: <PersonIcon />,
    title: 'Client records',
    desc: 'Consent status, allergies, and full booking history per client — plus CSV import from your old system.',
  },
  {
    key: 'consent',
    icon: <DocumentIcon />,
    title: 'Consent builder',
    desc: 'Build your own consent and waiver forms from headings, checkboxes, and e-signature fields — guardian fields appear automatically for minors.',
  },
  {
    key: 'import',
    icon: <UploadIcon />,
    title: 'Migration import',
    desc: 'Bring your history over from Square, Acuity, or Fresha with built-in column mapping, not just a blank CSV template.',
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
  {
    key: 'billing',
    icon: <CardIcon />,
    title: 'Self-serve billing',
    desc: 'Manage your own Vanta subscription — update the card on file, see your next payment, or cancel — separate from client payments entirely.',
  },
  {
    key: 'language',
    icon: <GlobeIcon />,
    title: 'Multi-language',
    desc: 'The full dashboard ships translated into English and Korean, with more languages to come as the studio base grows.',
  },
  {
    key: 'push',
    icon: <BellIcon />,
    title: 'Push alerts',
    desc: 'New bookings and payments reach your phone the moment they happen, so you never have to keep the dashboard open to stay on top of things.',
  },
];

// The feature tabs drive everything below them (the sliding highlight, the preview panel,
// and the description text) via a single activeIndex, auto-advancing on a timer unless the
// visitor clicks a tab directly — clicking restarts the timer so it never fights them. Below
// ~480px viewport width the tab labels drop to icon-only so more tabs fit before scrolling
// kicks in. `.vanta-tabs-scroll` hides its native scrollbar since the row's own arrow
// buttons (shown only when there's more to scroll to) are the intended affordance.
const INTRO_LAYOUT_CSS = `
@media (max-width: 480px) { .vanta-tab-label { display: none; } }
.vanta-tabs-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.vanta-tabs-scroll::-webkit-scrollbar { display: none; }
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
          <button type="button" onClick={onNext} className="vanta-btn" style={s.btn}>Get started</button>
        </div>
      </div>
    </div>
  );
}

// A segmented control whose highlight slides to sit behind whichever feature is active —
// driven either by a click here or by IntroStep's auto-advance. With enough tabs to overflow
// the card width, the row scrolls horizontally (native touch/trackpad scroll, plus arrow
// buttons that only appear when there's more to scroll to); the active tab auto-scrolls into
// view so auto-advance never leaves it hidden off-screen. The highlight's position is
// measured from the actual DOM rather than computed as a fixed fraction, since tabs are
// sized to their own content instead of stretched to equal widths.
function FeatureTabs({ features, activeIndex, onSelect }) {
  const tabRefs = useRef([]);
  const scrollRef = useRef(null);
  const [highlight, setHighlight] = useState({ left: 0, width: 0 });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = tabRefs.current[activeIndex];
    if (el) setHighlight({ left: el.offsetLeft, width: el.offsetWidth });
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeIndex, features]);

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener('resize', updateScrollButtons);
    return () => window.removeEventListener('resize', updateScrollButtons);
  }, [updateScrollButtons, features]);

  function scrollByAmount(dir) {
    scrollRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });
  }

  return (
    <div style={s.tabsOuter}>
      {canScrollLeft && (
        <button type="button" onClick={() => scrollByAmount(-1)} style={{ ...s.tabsArrow, left: -4 }} aria-label="Scroll tabs left">
          <ChevronIcon direction="left" />
        </button>
      )}
      <div ref={scrollRef} className="vanta-tabs-scroll" style={s.tabsScroll} onScroll={updateScrollButtons}>
        <div style={s.tabsRow}>
          <div style={{ ...s.tabsHighlight, left: highlight.left, width: highlight.width }} />
          {features.map((f, i) => (
            <button
              key={f.title}
              ref={el => { tabRefs.current[i] = el; }}
              type="button"
              onClick={() => onSelect(i)}
              style={{ ...s.tabItem, ...(activeIndex === i ? s.tabItemActive : {}) }}
            >
              <span style={s.tabIcon}>{f.icon}</span>
              <span className="vanta-tab-label" style={s.tabLabel}>{f.title}</span>
            </button>
          ))}
        </div>
      </div>
      {canScrollRight && (
        <button type="button" onClick={() => scrollByAmount(1)} style={{ ...s.tabsArrow, right: -4 }} aria-label="Scroll tabs right">
          <ChevronIcon direction="right" />
        </button>
      )}
    </div>
  );
}

function ChevronIcon({ direction = 'right', size = 12 }) {
  const d = direction === 'left' ? 'M10 4l-4 4 4 4' : 'M6 4l4 4-4 4';
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Stylized preview of the studio dashboard — an illustration, not a literal screenshot, so
// it needs no signed-in account or seeded data to render truthfully. Purely reflects
// whichever feature tab is active; the progress bar in the chrome row mirrors the same
// auto-advance timer IntroStep drives the tabs with.
const PREVIEW_NAV = [
  { keys: ['schedule'], icon: HomeIcon },
  { keys: ['schedule'], icon: GridCalIcon },
  { keys: ['artists'], icon: UsersIcon },
  { keys: ['clients', 'consent', 'import'], icon: PersonIcon },
  { keys: ['analytics', 'billing'], icon: ChartIcon },
  { keys: ['branding', 'language'], icon: GearIcon },
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
          {PREVIEW_NAV.map(({ keys, icon: Icon }, i) => (
            <div key={i} style={{ ...s.previewSidebarIcon, ...(keys.includes(tab) ? s.previewSidebarIconActive : {}) }}>
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
            {tab === 'branding' && <BrandingPanel />}
            {tab === 'consent' && <ConsentBuilderPanel />}
            {tab === 'import' && <ImportPanel />}
            {tab === 'billing' && <BillingPanel />}
            {tab === 'language' && <LanguagePanel />}
            {tab === 'push' && <PushPanel />}
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

// A color swatch row (one selected) above a faux code snippet — the two halves of widget
// branding: pick your colors, then embed the result.
function BrandingPanel() {
  const colors = ['#f5ecd9', '#6fbf8a', '#82aadc', '#e8756f', '#e8c56f'];
  return (
    <div style={s.brandingWrap}>
      <div style={s.brandingSwatchRow}>
        {colors.map((c, i) => (
          <span key={c} style={{ ...s.brandingSwatch, background: c, ...(i === 0 ? s.brandingSwatchActive : {}) }} />
        ))}
      </div>
      <div style={s.brandingCodeBlock}>
        <div style={{ ...s.brandingCodeLine, width: '55%' }} />
        <div style={{ ...s.brandingCodeLine, width: '80%' }} />
        <div style={{ ...s.brandingCodeLine, width: '65%' }} />
      </div>
    </div>
  );
}

// A few form-field rows (heading + two checkboxes) ending in a signature line — the shape of
// the actual consent builder rather than an abstract document icon.
function ConsentBuilderPanel() {
  return (
    <div style={s.consentWrap}>
      <div style={s.consentFieldRow}>
        <span style={s.consentFieldIcon}>H</span>
        <span style={s.previewBarTrack}><span style={{ ...s.previewBarFill, width: '58%' }} /></span>
      </div>
      <div style={s.consentFieldRow}>
        <span style={s.consentCheckbox} />
        <span style={s.previewBarTrack}><span style={{ ...s.previewBarFill, width: '75%' }} /></span>
      </div>
      <div style={s.consentFieldRow}>
        <span style={s.consentCheckbox} />
        <span style={s.previewBarTrack}><span style={{ ...s.previewBarFill, width: '48%' }} /></span>
      </div>
      <div style={s.consentSignatureLine} />
    </div>
  );
}

// Three named source platforms migrating in at different completion — reads as a real
// migration in progress rather than a generic "upload a file" icon.
function ImportPanel() {
  const platforms = [
    { name: 'Square', pct: 100 },
    { name: 'Acuity', pct: 100 },
    { name: 'Fresha', pct: 82 },
  ];
  return (
    <div style={s.previewList}>
      {platforms.map(p => (
        <div key={p.name} style={s.previewListRow}>
          <span style={s.importPlatformTag}>{p.name}</span>
          <span style={s.previewBarTrack}><span style={{ ...s.previewBarFill, width: `${p.pct}%` }} /></span>
          <span style={s.previewListTagGood}>{p.pct === 100 ? '✓' : `${p.pct}%`}</span>
        </div>
      ))}
    </div>
  );
}

// Card on file + an "Active" status alongside the next-payment KPI — the studio's OWN
// subscription, deliberately styled like AnalyticsPanel's KPI row to read as "also billing,
// but not the client-facing kind".
function BillingPanel() {
  return (
    <div style={s.billingWrap}>
      <div style={s.billingCardRow}>
        <span style={s.billingCardBadge}>VISA</span>
        <span style={s.billingCardNumber}>•••• 4242</span>
        <span style={s.previewListTagGood}>Active</span>
      </div>
      <div style={s.analyticsKpiRow}>
        <div style={s.analyticsKpi}>
          <span style={s.analyticsKpiValue}>$60</span>
          <span style={s.analyticsKpiLabel}>Next payment</span>
        </div>
        <div style={s.analyticsKpi}>
          <span style={s.analyticsKpiValue}>Sep 12</span>
          <span style={s.analyticsKpiLabel}>Renews</span>
        </div>
      </div>
    </div>
  );
}

// EN/KO chips above a few real translated dashboard labels — showing actual Korean glyphs
// makes the claim concrete instead of a generic "globe" gesture.
function LanguagePanel() {
  const rows = [['Dashboard', '대시보드'], ['Clients', '고객'], ['Schedule', '일정']];
  return (
    <div style={s.languageWrap}>
      <div style={s.languageChipRow}>
        <span style={{ ...s.languageChip, ...s.languageChipActive }}>EN</span>
        <span style={s.languageChip}>한국어</span>
      </div>
      <div style={s.previewList}>
        {rows.map(([en, ko]) => (
          <div key={en} style={s.languageRow}>
            <span style={s.languageEn}>{en}</span>
            <span style={s.languageArrow}>→</span>
            <span style={s.languageKo}>{ko}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Two stacked phone-style notification banners — concrete examples (a booking, a payment)
// rather than an abstract bell.
function PushPanel() {
  const notifs = [
    { title: 'New booking request', body: 'Sarah requested Sat 2:00pm' },
    { title: 'Payment received', body: '$120 deposit — Jordan' },
  ];
  return (
    <div style={s.pushWrap}>
      {notifs.map(n => (
        <div key={n.title} style={s.pushBanner}>
          <span style={s.pushDot} />
          <div>
            <div style={s.pushTitle}>{n.title}</div>
            <div style={s.pushBody}>{n.body}</div>
          </div>
        </div>
      ))}
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

function PaletteIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13c.8 0 1.3-.6 1-1.3-.2-.5.1-1 .6-1H10c1.9 0 3-1 3-2.7C13 4.8 10.8 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="5.2" cy="6.5" r="0.9" fill="currentColor" />
      <circle cx="8" cy="4.5" r="0.9" fill="currentColor" />
      <circle cx="10.8" cy="6.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

function DocumentIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M4 1.5h5.5L12 4v10a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 14V2a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M6 7.5h4M6 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9.5 1.5V4h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function UploadIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 10.5V2.5M5 5.5 8 2.5l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 11v1.5A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 8h13M8 1.5c1.7 1.8 2.7 4 2.7 6.5S9.7 12.7 8 14.5c-1.7-1.8-2.7-4-2.7-6.5S6.3 3.3 8 1.5Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function BellIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M4 6.5a4 4 0 1 1 8 0c0 3 1 4 1 4H3s1-1 1-4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.3 3.7l-1.1 1.1M4.8 11.2l-1.1 1.1M12.3 12.3l-1.1-1.1M4.8 4.8 3.7 3.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
        <InputWithIcon icon={<MailIcon size={15} />} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="studio@example.com" autoComplete="email" />
      </Field>
      <Field label="Password">
        <InputWithIcon icon={<LockIcon size={15} />} type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Minimum 8 characters" autoComplete="new-password" />
      </Field>
      <Field label="Confirm password">
        <InputWithIcon icon={<LockIcon size={15} />} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Re-enter password" autoComplete="new-password" />
      </Field>
      {error && <p style={s.errorBox}>{error}</p>}
      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} className="vanta-back-btn" style={s.backBtn}>Back</button>
        <button type="submit" className="vanta-btn" style={{ ...s.btn, flex: 1 }}>Continue</button>
      </div>
    </form>
  );
}

function InputWithIcon({ icon, style, ...props }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={s.inputIcon}>{icon}</span>
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
            className="vanta-input"
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
        <input type="text" value={name} onChange={e => setName(e.target.value)} required className="vanta-input" style={s.input} placeholder="e.g. Dark Matter Tattoo" />
      </Field>

      <Field label="Address">
        <div style={{ position: 'relative' }}>
          <input
            type="text"
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
          <button type="button" onClick={() => { setResolved(null); setAddressQuery(''); }} className="vanta-link" style={s.clearBtn}>
            Change
          </button>
        </div>
      )}

      {error && <p style={s.errorBox}>{error}</p>}

      <p style={s.trialNote}>
        Next, add a card to start your 14-day free trial — you won't be charged until it ends.
      </p>

      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} className="vanta-back-btn" style={s.backBtn}>Back</button>
        <button type="submit" disabled={submitting} className="vanta-btn" style={{ ...s.btn, flex: 1, opacity: submitting ? 0.5 : 1 }}>
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
  inputIcon: {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'rgba(255,255,255,0.3)',
    display: 'flex',
    pointerEvents: 'none',
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
  tabsOuter: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  tabsScroll: {
    overflowX: 'auto',
    flex: 1,
  },
  tabsArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#151b24',
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    padding: 0,
  },
  tabsRow: {
    position: 'relative',
    display: 'flex',
    gap: 2,
    width: 'max-content',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 4,
  },
  tabsHighlight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 7,
    background: 'rgba(245,236,217,0.12)',
    border: '1px solid rgba(245,236,217,0.28)',
    transition: 'left 0.35s ease, width 0.35s ease',
  },
  tabItem: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.65rem 0.8rem',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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
  brandingWrap: { display: 'flex', flexDirection: 'column', gap: '0.7rem', height: '100%', justifyContent: 'center' },
  brandingSwatchRow: { display: 'flex', gap: '0.5rem' },
  brandingSwatch: { width: 22, height: 22, borderRadius: '50%', border: '2px solid transparent' },
  brandingSwatchActive: { border: '2px solid #ffffff', boxShadow: '0 0 0 2px rgba(0,0,0,0.4)' },
  brandingCodeBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: '0.6rem 0.7rem',
  },
  brandingCodeLine: { height: 6, borderRadius: 3, background: 'rgba(111,191,138,0.4)' },
  consentWrap: { display: 'flex', flexDirection: 'column', gap: '0.55rem', height: '100%', justifyContent: 'center' },
  consentFieldRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  consentFieldIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: 4,
    fontSize: '0.6rem',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 0,
  },
  consentCheckbox: {
    width: 12,
    height: 12,
    borderRadius: 3,
    border: '1.5px solid rgba(245,236,217,0.5)',
    flexShrink: 0,
  },
  consentSignatureLine: {
    marginTop: '0.2rem',
    height: 1,
    background: 'rgba(255,255,255,0.15)',
    position: 'relative',
  },
  importPlatformTag: {
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
    width: 46,
    flexShrink: 0,
  },
  billingWrap: { display: 'flex', flexDirection: 'column', gap: '0.8rem', height: '100%', justifyContent: 'center' },
  billingCardRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  billingCardBadge: {
    fontSize: '0.55rem',
    fontWeight: 700,
    color: '#0d1017',
    background: '#f5ecd9',
    borderRadius: 4,
    padding: '0.15rem 0.35rem',
    flexShrink: 0,
  },
  billingCardNumber: { fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', flex: 1 },
  languageWrap: { display: 'flex', flexDirection: 'column', gap: '0.7rem', height: '100%', justifyContent: 'center' },
  languageChipRow: { display: 'flex', gap: '0.4rem' },
  languageChip: {
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 999,
    padding: '0.2rem 0.6rem',
  },
  languageChipActive: {
    color: '#f5ecd9',
    background: 'rgba(245,236,217,0.12)',
    border: '1px solid rgba(245,236,217,0.3)',
  },
  languageRow: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem' },
  languageEn: { color: 'rgba(255,255,255,0.55)', width: 58, flexShrink: 0 },
  languageArrow: { color: 'rgba(255,255,255,0.25)', flexShrink: 0 },
  languageKo: { color: '#f5ecd9', fontWeight: 500 },
  pushWrap: { display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%', justifyContent: 'center' },
  pushBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '0.5rem 0.65rem',
  },
  pushDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#82aadc',
    flexShrink: 0,
    marginTop: 3,
  },
  pushTitle: { fontSize: '0.7rem', fontWeight: 600, color: '#ffffff' },
  pushBody: { fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', marginTop: 1 },
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
