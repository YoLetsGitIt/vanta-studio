'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { checkStudioSignupEmail, registerStudio, searchStudios } from '@/lib/api';

// ── Main flow ─────────────────────────────────────────────────────────────────

export default function SignUpFlow({ onSwitchToSignIn, onWideChange }) {
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
      // No user or studio exists yet. Stripe confirms the payment setup first;
      // the backend creates the account only from that successful webhook.
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
      {step === 0 && <IntroStep onNext={() => setStep(1)} onSwitchToSignIn={onSwitchToSignIn} />}

      {step > 0 && (
        <>
          <div style={s.switchRow}>
            <span style={s.switchRowText}>Already have an account?</span>
            <button type="button" onClick={onSwitchToSignIn} className="vanta-link" style={s.switchLink}>Sign in</button>
          </div>
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
                    background: done ? '#4cc98a' : active ? '#d5d0c7' : 'rgba(255,255,255,0.1)',
                    color: done ? '#0a0a0a' : active ? '#0a0a0a' : 'rgba(255,255,255,0.3)',
                  }}>
                    {done ? '✓' : num}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: active ? '#d5d0c7' : 'rgba(255,255,255,0.3)', fontWeight: active ? 600 : 400 }}>
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
    section: 'Bookings',
    icon: <ChecklistIcon />,
    art: <MiniToggles />,
    images: [],
    videos: ['/signup/custom-booking-form.webm', '/signup/booking-widget.webm'],
    title: 'Booking form & widget',
    desc: 'Build the tattoo-specific form your clients need, then share it as a link, QR code, or embed on your own site.',
    detail: [
      'Every field beyond name, date of birth, email, and phone is optional. Turn on artist preference, placement, size, skin tone, reference photos, or allergies individually, and mark any of them as required before a client can submit.',
      'Clients can scan a QR code, follow a link, or use an embed on your site to request a session. Deposits, 7-day and 24-hour email reminders, and a reschedule cutoff you set are all handled for you.',
    ],
  },
  {
    section: 'Bookings',
    icon: <PaletteIcon />,
    art: <MiniSwatches />,
    images: ['/signup/widget-branding-2.png'],
    video: '/signup/widget-branding.webm',
    mediaAspectRatio: '11 / 4',
    title: 'Widget branding',
    desc: 'Add the booking widget to your own website in minutes — match your studio\'s colors, then paste in one line of code. No developer needed.',
    detail: [
      'Copy a single embed snippet — one div and one script tag — onto any website you control, no matter what it\'s built with. No developer needed.',
      'Pick a background and highlight color to match your own site — the preview updates live as you type a hex code, so you see exactly what clients will see before you save anything.',
    ],
  },
  {
    section: 'Bookings',
    icon: <StationIcon />,
    art: <MiniStations />,
    images: [],
    title: 'Station scheduling',
    desc: 'The booking form only ever offers a station that\'s actually free at that date and time — two artists can\'t land on the same chair by accident.',
  },
  {
    section: 'Clients',
    icon: <DocumentIcon />,
    art: <MiniConsent />,
    images: [],
    video: '/signup/consent-builder.webm',
    title: 'Consent builder',
    desc: 'Design your own waiver from headings, checkboxes, and e-signatures — guardian fields appear automatically for clients under 18.',
    detail: [
      'Build your waiver from six field types — headings, paragraphs, checkboxes, text, long text, and yes/no questions — in whatever order makes sense for your studio, with a live preview of the client-facing version as you go.',
      'Require an e-signature, and the form automatically adds a guardian-consent section the moment a client\'s date of birth shows they\'re under 18 — you don\'t have to build that logic yourself.',
    ],
  },
  {
    section: 'Clients',
    icon: <PersonIcon />,
    art: <MiniClients />,
    images: ['/signup/client-records-profile.png'],
    mediaLayout: 'stacked',
    mediaMaxWidth: 330,
    mediaPreviewHeight: 440,
    mediaAnimation: 'scroll',
    title: 'Client records',
    desc: 'Every client\'s consent status, allergies, and full booking history — searchable in seconds.',
    detail: [
      'Every client gets a running profile beyond the basic contact card: consent status against your current template, design preferences, allergy or skin-condition notes, and even a pain-tolerance scale — all searchable by name, email, or phone in one box.',
      'Send a consent link straight from their profile, and it updates the moment they sign.',
    ],
  },
  {
    section: 'Studio',
    icon: <UsersIcon />,
    art: <MiniArtists />,
    images: [],
    media: [
      { type: 'video', src: '/signup/artist-payout-interaction.webm' },
      { type: 'image', src: '/signup/artist-stats-redacted.png', presentation: 'artist-stats' },
    ],
    mediaPresentation: 'artist-focus',
    title: 'Artist management',
    desc: 'See artist performance at a glance, then track exactly what each artist has earned, been paid, and is still owed.',
    detail: [
      'The Artists & Payouts view puts performance and payment status together: tattoos, gross sales, average ticket, deposits, hours, artist payout, paid-out amount, and the outstanding balance.',
      'Every artist profile has its own operating view, with session, completion, upcoming-booking, and revenue stats alongside availability, timetable, and scheduled work.',
    ],
  },
  {
    section: 'Studio',
    icon: <ChartIcon />,
    art: <MiniBarChart />,
    images: ['/signup/analytics-live-overview.png'],
    title: 'Analytics',
    desc: 'Appointment counts, revenue, and a studio-vs-personal split, updated in real time.',
    detail: [
      'Appointment counts broken into completed, confirmed, pending, cancelled, and no-show, plus revenue and a studio-vs-personal booking split — filterable by week, month, or a custom date range.',
      'See new versus returning clients at a glance, and which clients are spending the most with your studio over the period you pick.',
    ],
  },
  {
    section: 'System',
    icon: <GlobeIcon />,
    art: <MiniLanguage />,
    images: [],
    title: 'Multi-language',
    desc: 'The entire dashboard is available in English, Simplified Chinese, and Korean — switch anytime from Settings.',
  },
  {
    section: 'System',
    icon: <UploadIcon />,
    art: <MiniImport />,
    images: [],
    title: 'Migration import',
    desc: 'Already on Square, Acuity, or Fresha? Bring your client history over with built-in column mapping.',
  },
];

// Groups PLAN_FEATURES by their `section` field, preserving first-seen section order —
// grouping in one pass here (rather than a second array literal) keeps section membership
// defined in exactly one place, right next to each feature's own data.
const FEATURE_SECTIONS = PLAN_FEATURES.reduce((sections, feature) => {
  let section = sections.find(s => s.title === feature.section);
  if (!section) {
    section = { title: feature.section, features: [] };
    sections.push(section);
  }
  section.features.push(feature);
  return sections;
}, []);

// Feature groups are switched through compact tabs, keeping the wide sign-up preview to a
// single desktop viewport while still letting studios explore every area of the product.
//
// Cards open their detail modal on click/tap on every device — an earlier hover-to-open
// version on desktop felt like it "disappeared" the moment the cursor moved even slightly,
// since hovering the backdrop (however briefly, mid-move) reads as leaving the card. Click
// is deliberate and doesn't have that problem; the expand icon (bottom-right of the art
// frame, brightening on hover) is what signals the card is clickable in its place.
const INTRO_LAYOUT_CSS = `
.vanta-feature-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.7rem; }
@media (min-width: 760px) { .vanta-feature-grid { grid-template-columns: repeat(4, 1fr); } }
.vanta-feature-grid-enter { animation: vantaFeatureGridIn 0.28s ease-out both; }
.vanta-feature-tabs { display: flex; gap: 0.45rem; overflow-x: auto; padding-bottom: 0.15rem; scrollbar-width: none; }
.vanta-feature-tabs::-webkit-scrollbar { display: none; }
.vanta-feature-tab { flex: 0 0 auto; padding: 0.45rem 0.72rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; background: rgba(255,255,255,0.025); color: rgba(255,255,255,0.45); font-size: 0.72rem; font-weight: 600; box-shadow: none; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
.vanta-feature-tab:hover { background: rgba(255,255,255,0.06); }
.vanta-feature-tab.is-active { border-color: rgba(213,208,199,0.45); background: rgba(213,208,199,0.14); color: #d5d0c7; }
.vanta-feature-card { transition: background 0.15s ease, border-color 0.15s ease; cursor: pointer; }
.vanta-feature-card:not(.vanta-feature-card-static):hover { background: rgba(255,255,255,0.05); border-color: rgba(213,208,199,0.25); }
.vanta-feature-card:hover .vanta-expand-badge { opacity: 1; background: rgba(213,208,199,0.16); color: #d5d0c7; }
.vanta-cta-bar { display: flex; flex-direction: column; gap: 1.1rem; }
.vanta-cta-button { width: 100%; }
.vanta-intro-heading { display: flex; flex-direction: column; gap: 1rem; }
.vanta-intro-access { display: flex; align-items: center; gap: 0.35rem; }
@keyframes vantaFeatureGridIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (min-width: 560px) {
  .vanta-cta-bar { flex-direction: row; align-items: center; justify-content: space-between; gap: 1.75rem; }
  .vanta-cta-button { width: auto; min-width: 210px; flex-shrink: 0; }
  .vanta-intro-heading { flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 2rem; }
  .vanta-intro-access { flex-shrink: 0; padding-top: 0.2rem; }
}
@keyframes vantaModalIn { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.vanta-modal-panel { animation: vantaModalIn 0.18s ease; }
.vanta-modal-video-frame { display: flex; align-items: center; justify-content: center; background: #090c11 !important; }
.vanta-modal-video-frame--consent { padding-left: 3%; box-sizing: border-box; }
.vanta-modal-video { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
.vanta-modal-image--artist-focus { transform: scale(1.4); transform-origin: 60% 35%; }
.vanta-modal-image--artist-stats { transform: scale(1.16); transform-origin: 60% 35%; }
.vanta-modal-scroll-preview { overflow: hidden !important; }
.vanta-modal-scroll-image { animation: vantaClientProfileScroll 7s ease-in-out infinite; }
@keyframes vantaClientProfileScroll { 0%, 18% { transform: translateY(0); } 72%, 88% { transform: translateY(-41.4%); } 100% { transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .vanta-modal-scroll-image { animation: none; } }
`;

function IntroStep({ onNext, onSwitchToSignIn }) {
  const [activeFeature, setActiveFeature] = useState(null);
  const [activeSection, setActiveSection] = useState(FEATURE_SECTIONS[0].title);
  const currentSection = FEATURE_SECTIONS.find(section => section.title === activeSection) ?? FEATURE_SECTIONS[0];

  return (
    <div style={s.introWrap}>
      <style>{INTRO_LAYOUT_CSS}</style>

      <div className="vanta-intro-heading" style={s.introHeading}>
        <div>
          <h3 style={s.introTitle}>Everything your studio needs</h3>
          <p style={s.introSubtitle}>Booking, clients, artists, and payouts — all in one dashboard.</p>
        </div>
        <div className="vanta-intro-access" style={s.introAccess}>
          <span>Already on Vanta?</span>
          <button type="button" onClick={onSwitchToSignIn} className="vanta-link" style={s.switchLink}>Sign in</button>
        </div>
      </div>

      <div style={s.featureSections}>
        <div className="vanta-feature-tabs" role="tablist" aria-label="Vanta Studio features">
          {FEATURE_SECTIONS.map(section => (
            <button key={section.title} type="button" role="tab" aria-selected={activeSection === section.title} className={`vanta-feature-tab${activeSection === section.title ? ' is-active' : ''}`} onClick={() => setActiveSection(section.title)}>
              {section.title}
            </button>
          ))}
        </div>
        <div>
          <div key={currentSection.title} className="vanta-feature-grid vanta-feature-grid-enter">
            {currentSection.features.map(f => {
              const hasDetail = f.images.length > 0 || !!f.video || (f.videos?.length ?? 0) > 0 || (f.media?.length ?? 0) > 0;
              return (
                <div
                  key={f.title}
                  className={hasDetail ? 'vanta-feature-card' : 'vanta-feature-card vanta-feature-card-static'}
                  style={{ ...s.featureGridCard, cursor: hasDetail ? 'pointer' : 'default' }}
                  onClick={hasDetail ? () => setActiveFeature(f) : undefined}
                >
                  <div style={s.featureArtFrame}>
                    {f.art}
                    {hasDetail && (
                      <span className="vanta-expand-badge" style={s.expandBadge}>
                        <ExpandIcon />
                      </span>
                    )}
                  </div>
                  <div style={s.featureCardHeader}>
                    <span style={s.featureCardIcon}>{f.icon}</span>
                    <span style={s.featureCardTitle}>{f.title}</span>
                  </div>
                  <div style={s.featureCardDesc}>{f.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {activeFeature && (
        <FeatureDetailModal feature={activeFeature} onClose={() => setActiveFeature(null)} />
      )}

      <div className="vanta-cta-bar" style={s.ctaBar}>
        <div style={s.ctaInfo}>
          <span style={s.planLabel}>Studio plan</span>
          <div style={s.planPriceRow}>
            <span style={s.planPriceAmount}>$60</span>
            <span style={s.planPriceUnit}>/mo AUD</span>
          </div>
          <p style={s.planPriceDetail}>
            Includes up to 6 artists. Add more for $15/artist per month.
          </p>
        </div>

        <button
          type="button"
          onClick={onNext}
          className="vanta-btn vanta-cta-button"
          style={{ ...s.btn, width: undefined }}
        >
          Start 14-day free trial
        </button>
      </div>
    </div>
  );
}

// Opens on hovering a feature card (desktop) or tapping one (mobile, via onClick) — a
// bigger version of the same art plus the longer `detail` copy. Escape and clicking the
// backdrop both close it; clicking the panel itself doesn't, so it survives incidental
// mouse movement while reading.
function FeatureDetailModal({ feature, onClose }) {
  const useNaturalMedia = feature.mediaLayout === 'stacked';
  const media = feature.media ?? [
    ...feature.images.map(src => ({ type: 'image', src })),
    ...(feature.videos ?? (feature.video ? [feature.video] : [])).map(src => ({ type: 'video', src })),
  ];

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Rendered into document.body via a portal rather than in place: the auth card this
  // would otherwise nest inside has backdrop-filter set (for its glass effect), and per
  // spec that makes the card — not the viewport — the containing block for any
  // position:fixed descendant. Left in place, the "full-screen" backdrop would actually
  // be sized/positioned relative to the card, so a tap meant for the backdrop (e.g. to
  // close the modal) could land outside its real box and hit the page behind it instead.
  return createPortal(
    <div className="vanta-modal-backdrop" style={s.modalBackdrop} onClick={onClose}>
      <div className="vanta-modal-panel" style={{ ...s.modalPanel, ...(feature.mediaPresentation === 'artist-focus' ? { maxWidth: 1100 } : {}) }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <div style={s.featureCardHeader}>
            <span style={s.modalIcon}>{feature.icon}</span>
            <h3 style={s.modalTitle}>{feature.title}</h3>
          </div>
          <button type="button" onClick={onClose} style={s.modalClose} aria-label="Close">✕</button>
        </div>
        <div style={s.modalBody}>
          <div style={{ ...s.modalGallery, gridTemplateColumns: media.length > 1 && !useNaturalMedia ? 'repeat(auto-fit, minmax(240px, 1fr))' : '1fr' }}>
            {media.map(({ type, src, presentation }) => (
              <div
                key={src}
                className={type === 'video'
                  ? `vanta-modal-video-frame${src.includes('consent-builder') ? ' vanta-modal-video-frame--consent' : ''}`
                  : feature.mediaAnimation === 'scroll' ? 'vanta-modal-scroll-preview' : undefined}
                style={{
                  ...s.modalArtFrame,
                  ...(useNaturalMedia ? { aspectRatio: 'auto' } : feature.mediaAspectRatio ? { aspectRatio: feature.mediaAspectRatio } : {}),
                  ...(feature.mediaMaxWidth ? { width: '100%', maxWidth: feature.mediaMaxWidth, marginInline: 'auto' } : {}),
                  ...(feature.mediaPreviewHeight ? { height: feature.mediaPreviewHeight } : {}),
                }}
              >
                {type === 'image' ? (
                  <img
                    src={src}
                    alt=""
                    className={feature.mediaAnimation === 'scroll' ? 'vanta-modal-scroll-image' : (presentation ?? feature.mediaPresentation) === 'artist-focus' ? 'vanta-modal-image--artist-focus' : presentation === 'artist-stats' ? 'vanta-modal-image--artist-stats' : undefined}
                    style={{ ...s.modalGalleryImage, ...(useNaturalMedia ? { height: 'auto' } : {}) }}
                  />
                ) : (
                  <video src={src} className={`vanta-modal-video${(presentation ?? feature.mediaPresentation) === 'artist-focus' ? ' vanta-modal-image--artist-focus' : ''}`} autoPlay loop muted playsInline />
                )}
              </div>
            ))}
          </div>
          {(feature.detail ?? [feature.desc]).map((paragraph, i) => (
            <p key={i} style={s.modalDesc}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Small illustrations backing each feature card — abstract enough to render legibly at
// ~70px tall, but each shaped after the real thing (a week grid, a color picker, toggles,
// a signature line) rather than a generic icon repeated bigger. The modal opened by
// clicking a card uses real screenshots instead; these stay as quick, uniform-height
// glances in the grid.
function MiniSchedule() {
  const filled = new Set([2, 6, 11, 13]);
  return (
    <div style={s.miniGrid}>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} style={{ ...s.miniCell, ...(filled.has(i) ? s.miniCellFilled : {}) }} />
      ))}
    </div>
  );
}

function MiniSwatches() {
  const colors = ['#d5d0c7', '#6fbf8a', '#82aadc', '#e8756f'];
  return (
    <div style={s.miniSwatchRow}>
      {colors.map((c, i) => (
        <span key={c} style={{ ...s.miniSwatch, background: c, ...(i === 0 ? s.miniSwatchActive : {}) }} />
      ))}
    </div>
  );
}

function MiniToggles() {
  const rows = [true, true, false];
  return (
    <div style={s.miniToggleCol}>
      {rows.map((on, i) => (
        <div key={i} style={s.miniToggleRow}>
          <span style={s.miniToggleLabel} />
          <span style={{ ...s.miniToggleTrack, ...(on ? s.miniToggleTrackOn : {}) }}>
            <span style={{ ...s.miniToggleKnob, ...(on ? s.miniToggleKnobOn : {}) }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniConsent() {
  return (
    <div style={s.miniConsentCol}>
      <div style={s.miniLine} />
      <div style={{ ...s.miniLine, width: '65%' }} />
      <div style={s.miniSigLine} />
    </div>
  );
}

function MiniClients() {
  const rows = [{ w: 70, status: 'good' }, { w: 48, status: 'warn' }];
  return (
    <div style={s.miniListCol}>
      {rows.map((r, i) => (
        <div key={i} style={s.miniListRow}>
          <span style={s.miniAvatar} />
          <span style={s.miniBarTrack}><span style={{ ...s.miniBarFill, width: `${r.w}%` }} /></span>
          <span style={r.status === 'good' ? s.miniTagGood : s.miniTagWarn}>{r.status === 'good' ? '✓' : '!'}</span>
        </div>
      ))}
    </div>
  );
}

function MiniArtists() {
  const rows = [{ w: 62, pct: 78 }, { w: 45, pct: 52 }];
  return (
    <div style={s.miniListCol}>
      {rows.map((r, i) => (
        <div key={i} style={s.miniListRow}>
          <span style={s.miniAvatar} />
          <span style={s.miniBarTrack}><span style={{ ...s.miniBarFill, width: `${r.w}%` }} /></span>
          <span style={s.miniPct}>{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function MiniStations() {
  // Two station columns, each a stack of time slots — one slot lit up per column to read as
  // "here's who's using what, when" at a glance, echoing the app's own per-station day view.
  const columns = [[false, true, false, false], [false, false, true, false]];
  return (
    <div style={s.miniStationRow}>
      {columns.map((slots, i) => (
        <div key={i} style={s.miniStationCol}>
          {slots.map((busy, j) => (
            <span key={j} style={{ ...s.miniStationSlot, ...(busy ? s.miniStationSlotBusy : {}) }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MiniBarChart() {
  const bars = [40, 65, 50, 82, 60, 72];
  return (
    <div style={s.miniBarChartRow}>
      {bars.map((h, i) => <span key={i} style={{ ...s.miniChartBar, height: `${h}%` }} />)}
    </div>
  );
}

function MiniLanguage() {
  return (
    <div style={s.miniChipRow}>
      <span style={{ ...s.miniChip, ...s.miniChipActive }}>EN</span>
      <span style={s.miniChip}>中文</span>
      <span style={s.miniChip}>한국어</span>
    </div>
  );
}

function MiniImport() {
  const platforms = ['Square', 'Acuity', 'Fresha'];
  return (
    <div style={s.miniListCol}>
      {platforms.map(p => (
        <div key={p} style={s.miniListRow}>
          <span style={s.miniPillLabel}>{p}</span>
          <span style={s.miniBarTrack}><span style={{ ...s.miniBarFill, width: '100%' }} /></span>
          <span style={s.miniTagGood}>✓</span>
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

function StationIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="5.5" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="2.5" width="5.5" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4.25" cy="6" r="1" fill="currentColor" />
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

function ChecklistIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 4.5h1.5M3 8h1.5M3 11.5h1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6.5 4.5H13M6.5 8H13M6.5 11.5H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// A "maximize" glyph (two corner brackets) — the badge that signals a feature card opens a
// bigger view, sitting on the art frame at a visible-but-quiet opacity so it reads as
// clickable without hover to reveal it (mobile has no hover to rely on).
function ExpandIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M6 2H2v4M10 14h4v-4M2 14l4.5-4.5M14 2 9.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Step 1: Account details ───────────────────────────────────────────────────

function AccountStep({ initial, onBack, onNext }) {
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
      {error && <p style={s.errorBox}>{error}</p>}
      <div style={s.rowBtns}>
        <button type="button" onClick={onBack} className="vanta-back-btn" style={s.backBtn}>Back</button>
        <button type="submit" disabled={checkingEmail} className="vanta-btn" style={{ ...s.btn, flex: 1, opacity: checkingEmail ? 0.6 : 1 }}>{checkingEmail ? 'Checking…' : 'Continue'}</button>
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
    background: '#d5d0c7',
    color: '#0a0a0a',
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
  introHeading: { paddingBottom: '0.15rem' },
  introAccess: {
    fontSize: '0.76rem',
    color: 'rgba(255,255,255,0.42)',
    whiteSpace: 'nowrap',
  },
  featureSections: { display: 'flex', flexDirection: 'column', gap: '1.3rem' },
  featureSectionTitle: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    margin: '0 0 0.55rem',
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
    color: 'rgba(255,255,255,0.4)',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#d5d0c7',
    fontWeight: 600,
    fontSize: '0.78rem',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  featureGridCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.55rem',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
  },
  featureArtFrame: {
    position: 'relative',
    height: 68,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#11161d',
    padding: '0.5rem 0.6rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  expandBadge: {
    position: 'absolute',
    bottom: '0.5rem',
    right: '0.5rem',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.55)',
    color: 'rgba(255,255,255,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  modalGalleryImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    zIndex: 1000,
  },
  modalPanel: {
    position: 'relative',
    width: '100%',
    maxWidth: 760,
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#151b24',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  // Lives outside the scrollable body (rather than position:sticky within it) so it never
  // has to fight the scroll container's stacking/overflow for the "stay put" behavior —
  // it's just a normal flex sibling above the part that scrolls.
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    padding: '1.25rem 1.5rem',
    flexShrink: 0,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  modalBody: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '1.25rem 1.5rem 1.5rem',
  },
  modalClose: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: 0,
  },
  modalGallery: {
    display: 'grid',
    gap: '0.75rem',
    marginBottom: '1.1rem',
  },
  modalArtFrame: {
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#11161d',
    overflow: 'hidden',
    flexShrink: 0,
    aspectRatio: '16 / 10',
  },
  modalIcon: {
    display: 'flex',
    alignItems: 'center',
    color: '#d5d0c7',
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
  },
  modalDesc: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
    margin: '0 0 0.7rem',
  },
  featureCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  featureCardIcon: {
    display: 'flex',
    alignItems: 'center',
    color: '#d5d0c7',
    flexShrink: 0,
  },
  featureCardTitle: {
    fontSize: '0.83rem',
    fontWeight: 600,
    color: '#ffffff',
  },
  featureCardDesc: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.45,
  },
  miniGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gridTemplateRows: 'repeat(3, 1fr)',
    gap: 3,
    width: '100%',
    height: '100%',
  },
  miniCell: { borderRadius: 2, background: 'rgba(255,255,255,0.06)' },
  miniCellFilled: { background: 'rgba(213,208,199,0.55)' },
  miniSwatchRow: { display: 'flex', gap: '0.4rem', alignItems: 'center' },
  miniSwatch: { width: 16, height: 16, borderRadius: '50%', border: '2px solid transparent' },
  miniSwatchActive: { border: '2px solid #ffffff', boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' },
  miniToggleCol: { display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' },
  miniToggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' },
  miniToggleLabel: { flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.12)' },
  miniToggleTrack: {
    width: 18,
    height: 10,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    padding: 1.5,
    flexShrink: 0,
  },
  miniToggleTrackOn: { background: 'rgba(213,208,199,0.4)' },
  miniToggleKnob: { width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', transition: 'transform 0.15s' },
  miniToggleKnobOn: { background: '#d5d0c7', transform: 'translateX(8px)' },
  miniConsentCol: { display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' },
  miniLine: { height: 5, width: '85%', borderRadius: 3, background: 'rgba(255,255,255,0.12)' },
  miniSigLine: { height: 1, width: '70%', background: 'rgba(255,255,255,0.2)', marginTop: '0.2rem' },
  miniListCol: { display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' },
  miniListRow: { display: 'flex', alignItems: 'center', gap: '0.35rem' },
  miniAvatar: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.15)' },
  miniBarTrack: { flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  miniBarFill: { display: 'block', height: '100%', borderRadius: 3, background: 'rgba(213,208,199,0.5)' },
  miniTagGood: { fontSize: '0.55rem', color: '#4cc98a', flexShrink: 0 },
  miniTagWarn: { fontSize: '0.6rem', fontWeight: 700, color: '#e8c56f', flexShrink: 0 },
  miniPct: { fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)', flexShrink: 0, width: 20, textAlign: 'right' },
  miniPillLabel: { fontSize: '0.55rem', color: 'rgba(255,255,255,0.55)', width: 34, flexShrink: 0 },
  miniStationRow: { display: 'flex', gap: 4, width: '100%', height: '100%' },
  miniStationCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 },
  miniStationSlot: { flex: 1, borderRadius: 2, background: 'rgba(255,255,255,0.06)' },
  miniStationSlotBusy: { background: 'rgba(213,208,199,0.55)' },
  miniBarChartRow: { display: 'flex', alignItems: 'flex-end', gap: 3, width: '100%', height: '100%' },
  miniChartBar: { flex: 1, borderRadius: '1px 1px 0 0', background: 'rgba(213,208,199,0.5)' },
  miniChipRow: { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' },
  miniChip: {
    fontSize: '0.55rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 999,
    padding: '0.15rem 0.4rem',
  },
  miniChipActive: {
    color: '#d5d0c7',
    background: 'rgba(213,208,199,0.12)',
    border: '1px solid rgba(213,208,199,0.3)',
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
    background: 'linear-gradient(160deg, rgba(213,208,199,0.09), rgba(255,255,255,0.03))',
    border: '1px solid rgba(213,208,199,0.22)',
    borderRadius: 12,
    padding: '1.1rem 1.25rem',
    boxShadow: '0 0 28px rgba(213,208,199,0.06)',
  },
  ctaInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
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
  planLabel: {
    display: 'block',
    marginBottom: '0.28rem',
    color: 'rgba(255,255,255,0.46)',
    fontSize: '0.67rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  planPriceAmount: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#d5d0c7',
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
  claimedLink: { color: '#d5d0c7' },
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
    background: 'rgba(213,208,199,0.06)',
    border: '1px solid rgba(213,208,199,0.15)',
    borderRadius: 8,
    color: '#d5d0c7',
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
