'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { getMyStudioAccount, startBillingCheckout, openBillingPortal } from '@/lib/api';
import { initTheme } from '@/lib/theme';
import { useLanguage, LanguageProvider } from '@/lib/i18n';
import NewAppointmentPanel from '@/components/NewAppointmentPanel';
import FeedbackHost from '@/components/FeedbackHost';

const NAV = [
  { href: '/dashboard/home',         tKey: 'nav_dashboard', icon: HomeIcon },
  { href: '/dashboard/schedule',     tKey: 'nav_schedule',  icon: GridCalIcon },
  { href: '/dashboard/artists',      tKey: 'nav_artists',   icon: UsersIcon },
  { href: '/dashboard/clients',      tKey: 'nav_clients',   icon: PersonIcon },
  { href: '/dashboard/appointments', tKey: 'nav_bookings',  icon: CalendarIcon },
  { href: '/dashboard/analytics',    tKey: 'nav_analytics', icon: ChartIcon },
  { href: '/dashboard/financial',    tKey: 'revenue_financial', icon: RevenueIcon },
];

const TOUR_STEPS = [
  {
    title: 'Welcome to Vanta Studio.',
    body: 'We’ll take a quick tour of how your studio works in Vanta and the important flows—from bookings and artists to payments and settings.',
    action: 'Start tutorial',
  },
  ...NAV.map(({ href, tKey }, index) => ({
    title: ['Your daily overview', 'Studio schedule', 'Your artists', 'Client records', 'Bookings', 'Analytics', 'Financials'][index],
    body: [
      'See what needs attention today, who is working, and how the week is filling up.',
      'See every artist, station, and appointment in one calendar—without double-booking a chair.',
      'Approve artists, manage availability, review their performance, and record payouts.',
      'Keep client details, consent status, preferences, and booking history together.',
      'Review incoming requests, confirm appointments, and keep deposits and follow-ups on track.',
      'Understand appointment performance, returning clients, and studio growth at a glance.',
      'Track revenue, payments, and how earnings are split across your studio.',
    ][index],
    target: 'nav', targetIndex: index, href, tKey,
  })),
  { title: 'Settings: Studio', body: 'Set your studio name, address, hours, branding, and the details clients see first.', target: 'settings', settingsTab: 'studio', href: '/dashboard/settings?tab=studio' },
  { title: 'Settings: Bookings', body: 'Build your booking form, share your booking link or widget, set deposits, reminders, and client consent.', target: 'settings', settingsTab: 'bookings', href: '/dashboard/settings?tab=bookings' },
  { title: 'Settings: Payments', body: 'Connect Stripe, choose how payments are handled, and control payouts across your studio.', target: 'settings', settingsTab: 'payments', href: '/dashboard/settings?tab=payments' },
  { title: 'Settings: Account', body: 'Manage your subscription, billing details, and the account preferences that keep your studio running.', target: 'settings', settingsTab: 'account', href: '/dashboard/settings?tab=account' },
];

// Mirrors the backend's subscriptionInactive() (internal/handlers/studio.go) exactly —
// subscription_status is kept live by Stripe's customer.subscription.updated/deleted
// webhooks, so this checks that directly rather than comparing trial_ends_at to now.
// No reminder is shown ahead of time; this only ever renders once the dashboard is
// actually locked.
function subscriptionInactive(studio) {
  return studio?.subscription_status !== 'trialing' && studio?.subscription_status !== 'active';
}

// These are deliberately customer-friendly descriptions of Stripe's subscription
// states. The raw subscription status remains the source of truth; we don't expose
// provider error details such as card-decline codes in the dashboard.
const BILLING_ISSUES = {
  past_due: {
    heading: 'Your latest payment failed',
    message: 'Update your payment method to restore access to your dashboard.',
    action: 'Update payment method',
    recovery: 'portal',
  },
  unpaid: {
    heading: 'Your subscription payment is overdue',
    message: 'Stripe was unable to collect payment. Update your payment method to restore access.',
    action: 'Update payment method',
    recovery: 'portal',
  },
  incomplete: {
    heading: 'Your billing setup is incomplete',
    message: 'Add a payment method to finish setting up your subscription and continue using your dashboard.',
    action: 'Finish billing setup',
    recovery: 'checkout',
  },
  incomplete_expired: {
    heading: 'Your billing setup expired',
    message: 'Your initial billing setup was not completed in time. Start it again to restore access.',
    action: 'Restart billing setup',
    recovery: 'checkout',
  },
  canceled: {
    heading: 'Your subscription has ended',
    message: 'Start a new subscription to regain access to your dashboard.',
    action: 'Restart subscription',
    recovery: 'checkout',
  },
  paused: {
    heading: 'Your subscription is paused',
    message: 'Update your billing to restore access to your dashboard.',
    action: 'Update billing',
    recovery: 'portal',
  },
};

function getBillingIssue(subscriptionStatus) {
  return BILLING_ISSUES[subscriptionStatus] ?? {
    heading: "There's an issue with your billing",
    message: 'Your subscription needs attention before you can keep using your dashboard.',
    action: 'Update billing',
    recovery: 'checkout',
  };
}

export default function DashboardLayout({ children }) {
  return (
    <LanguageProvider>
      <FeedbackHost />
      <DashboardShell>{children}</DashboardShell>
    </LanguageProvider>
  );
}

function DashboardShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [studioName, setStudioName] = useState('');
  const [billingBlocked, setBillingBlocked] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [ready, setReady] = useState(false);
  const [appointmentPanelOpen, setAppointmentPanelOpen] = useState(false);
  const [appointmentType, setAppointmentType] = useState('walkin');
  const [tourStep, setTourStep] = useState(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    function openAppointment(event) {
      setAppointmentType(event.detail?.bookingType ?? 'walkin');
      setAppointmentPanelOpen(true);
    }
    window.addEventListener('vanta:open-new-appointment', openAppointment);
    return () => window.removeEventListener('vanta:open-new-appointment', openAppointment);
  }, []);

  useEffect(() => { initTheme(); }, []);

  useEffect(() => {
    const settingsTab = TOUR_STEPS[tourStep]?.settingsTab;
    if (settingsTab) document.body.dataset.vantaTourSettingsTab = settingsTab;
    else delete document.body.dataset.vantaTourSettingsTab;
    if (tourStep !== null) document.body.dataset.vantaTourActive = 'true';
    else delete document.body.dataset.vantaTourActive;
    return () => {
      delete document.body.dataset.vantaTourSettingsTab;
      delete document.body.dataset.vantaTourActive;
    };
  }, [tourStep]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    async function init() {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/'); return; }
      setUser(session.user);

      let studioAccount;
      try {
        studioAccount = await getMyStudioAccount();
      } catch {
        await getSupabase().auth.signOut();
        router.replace('/');
        return;
      }

      setStudioName(studioAccount.studio?.name ?? '');
      setSubscriptionStatus(studioAccount.studio?.subscription_status ?? '');

      setBillingBlocked(subscriptionInactive(studioAccount.studio));
      const tourKey = `vanta-studio-tour:${session.user.id}`;
      const sessionTourKey = `vanta-studio-tour-session:${session.user.id}`;
      const requestedTourKey = `vanta-studio-tour-start:${session.user.id}`;
      const alwaysShowTour = session.user.email?.trim().toLowerCase() === 'studio@test.com';
      // The test account starts the tour on each new login, not on every dashboard
      // route transition or component remount within the same signed-in session.
      const requestedByRoute = new URLSearchParams(window.location.search).get('tour') === '1';
      const explicitlyRequested = sessionStorage.getItem(requestedTourKey) === 'true' || requestedByRoute;
      const showTestTourThisSession = alwaysShowTour && (explicitlyRequested || !sessionStorage.getItem(sessionTourKey));
      if (showTestTourThisSession) sessionStorage.setItem(sessionTourKey, 'shown');
      sessionStorage.removeItem(requestedTourKey);
      if (requestedByRoute) window.history.replaceState({}, '', '/dashboard/home');
      if (showTestTourThisSession || !localStorage.getItem(tourKey)) setTourStep(0);
      setReady(true);
    }
    init();
  }, [router]);

  async function handleSignOut() {
    if (user?.id) {
      sessionStorage.removeItem(`vanta-studio-tour-session:${user.id}`);
      sessionStorage.removeItem(`vanta-studio-tour-start:${user.id}`);
    }
    await getSupabase().auth.signOut();
    router.replace('/');
  }

  if (!ready) {
    return (
      <div style={s.loadingWrap}>
        <div style={s.loadingDot} />
      </div>
    );
  }

  if (billingBlocked) {
    return <BillingInactiveBlock studioName={studioName} subscriptionStatus={subscriptionStatus} onSignOut={handleSignOut} />;
  }

  const displayName = studioName || 'Studio';

  function finishTour() {
    if (user?.id) localStorage.setItem(`vanta-studio-tour:${user.id}`, 'complete');
    setTourStep(null);
  }

  function moveTour(nextStep) {
    const next = TOUR_STEPS[nextStep];
    if (next?.href) router.push(next.href);
    setTourStep(nextStep);
  }

  return (
    <div style={s.shell}>
      <style>{TOUR_HIGHLIGHT_CSS}</style>
      <div style={s.body}>
        <aside style={s.sidebar}>
          <div style={s.sidebarTop}>
            <Link href="/dashboard/appointments" style={s.logo}>
              <span style={s.logoMark}>vanta</span>
              <span style={s.logoSub}>studio</span>
            </Link>

            <button onClick={() => { setAppointmentType('walkin'); setAppointmentPanelOpen(true); }} style={s.newApptBtn}>
              <PlusIcon size={13} />
              {t('new_appointment')}
            </button>

            <nav style={s.nav}>
              {NAV.map(({ href, tKey, icon: Icon }, index) => {
                const active = pathname.startsWith(href);
                const highlighted = TOUR_STEPS[tourStep]?.target === 'nav' && TOUR_STEPS[tourStep]?.targetIndex === index;
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      ...s.navItem,
                      ...(active ? s.navActive : {}),
                      ...(highlighted ? s.tourHighlight : {}),
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    <Icon size={16} />
                    <span style={{ fontWeight: active ? 600 : 400 }}>{t(tKey)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div style={s.sidebarBottom}>
            <div style={s.userRow}>
              <div style={s.avatar}>{displayName[0].toUpperCase()}</div>
              <div style={s.userInfo}>
                <span style={s.userName}>{displayName}</span>
                <span style={s.userEmail}>{user?.email}</span>
              </div>
              <Link
                href="/dashboard/settings"
                style={{
                  ...s.gearBtn,
                  ...(TOUR_STEPS[tourStep]?.target === 'settings' && !TOUR_STEPS[tourStep]?.settingsTab ? s.tourHighlight : {}),
                  color: pathname.startsWith('/dashboard/settings') ? 'var(--accent)' : 'var(--text-muted)',
                }}
                title="Settings"
              >
                <GearIcon size={17} />
              </Link>
            </div>
          </div>
        </aside>

        <main style={s.main}>{children}</main>
      </div>

      <NewAppointmentPanel
        open={appointmentPanelOpen}
        initialBookingType={appointmentType}
        onClose={() => setAppointmentPanelOpen(false)}
        onCreated={() => {}}
      />

      {tourStep !== null && (
        <DashboardTour
          step={tourStep}
          onBack={() => moveTour(Math.max(0, tourStep - 1))}
          onNext={() => tourStep === TOUR_STEPS.length - 1 ? finishTour() : moveTour(tourStep + 1)}
          onSkip={finishTour}
        />
      )}
    </div>
  );
}

const TOUR_HIGHLIGHT_CSS = `
body[data-vanta-tour-settings-tab="studio"] [data-tour-settings-tab="studio"],
body[data-vanta-tour-settings-tab="bookings"] [data-tour-settings-tab="bookings"],
body[data-vanta-tour-settings-tab="payments"] [data-tour-settings-tab="payments"],
body[data-vanta-tour-settings-tab="account"] [data-tour-settings-tab="account"] {
  position: relative !important;
  z-index: 101 !important;
  box-shadow: 0 0 0 1px var(--accent-active-border), 0 12px 30px rgba(0,0,0,0.28) !important;
}
`;

function DashboardTour({ step, onBack, onNext, onSkip }) {
  const item = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  return (
    <div style={s.tourLayer} role="dialog" aria-modal="true" aria-label="Dashboard tour">
      <div style={s.tourShade} />
      <div style={s.tourCard}>
        <span style={s.tourProgress}>{step === 0 ? 'WELCOME' : `${String(step).padStart(2, '0')} / ${String(TOUR_STEPS.length - 1).padStart(2, '0')}`}</span>
        <h2 style={s.tourTitle}>{item.title}</h2>
        <p style={s.tourBody}>{item.body}</p>
        <div style={s.tourActions}>
          <button type="button" onClick={onSkip} style={s.tourSkip}>Skip tour</button>
          <div style={s.tourNavActions}>
            {step > 0 && <button type="button" onClick={onBack} style={s.tourBack}>Back</button>}
            <button type="button" onClick={onNext} style={s.tourNext}>{isLast ? 'Finish' : item.action ?? 'Next'} <span>→</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BillingInactiveBlock({ studioName, subscriptionStatus, onSignOut }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const issue = getBillingIssue(subscriptionStatus);

  async function handleUpdateBilling() {
    setLoading(true);
    setError('');
    try {
      if (issue.recovery === 'portal') {
        const { portal_url } = await openBillingPortal();
        window.location.href = portal_url;
      } else {
        const { checkout_url } = await startBillingCheckout();
        window.location.href = checkout_url;
      }
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div style={s.blockPage}>
      <div style={s.blockCard}>
        <div style={s.brand}>
          <span style={s.logoMark}>vanta</span>
          <span style={s.logoSub}>studio</span>
        </div>
        <h1 style={s.blockHeading}>{issue.heading}</h1>
        <p style={s.blockBody}>
          {(studioName || 'Your studio')}: {issue.message} Nothing else has changed; your data is exactly as you left it.
        </p>
        {error && <p style={s.blockError}>{error}</p>}
        <button onClick={handleUpdateBilling} disabled={loading} style={{ ...s.blockBtn, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Starting checkout…' : issue.action}
        </button>
        <button onClick={onSignOut} style={s.blockSignOutBtn}>Sign out</button>
      </div>
    </div>
  );
}

// ── Icons — all use currentColor so parent CSS color drives the stroke ────────

function PlusIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 7.5a2.5 2.5 0 1 0 0-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M13 13c0-1.86-.9-3.5-2.26-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 12l3.5-4 3 2.5L12 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function HomeIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 6.5L8 2l6 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M6 15v-5h4v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridCalIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5.5 1.5v2M10.5 1.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4.5 9.5h2M9.5 9.5h2M4.5 12h2M9.5 12h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function RevenueIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 5v1M8 10v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6 7.5c0-.83.67-1.5 1.5-1.5h1a1.5 1.5 0 0 1 0 3h-1a1.5 1.5 0 0 0 0 3h1c.83 0 1.5-.67 1.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ImportIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5v8M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11v2a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 14 13v-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  loadingWrap: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base)',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--border)',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg-base)',
  },
  blockPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base)',
    padding: '1.5rem',
  },
  blockCard: {
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    textAlign: 'center',
    alignItems: 'center',
  },
  blockHeading: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  blockBody: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
    margin: 0,
  },
  blockError: {
    fontSize: '0.8rem',
    color: '#e86f6f',
    margin: 0,
  },
  blockBtn: {
    background: 'var(--accent)',
    color: 'var(--bg-sidebar)',
    border: 'none',
    borderRadius: 8,
    padding: '0.75rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
  blockSignOutBtn: {
    background: 'none',
    border: 'none',
    fontSize: '0.8rem',
    color: 'var(--text-ghost)',
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border-faint)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '1.5rem 0',
  },
  sidebarTop: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  logo: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.35rem',
    padding: '0 1.25rem',
  },
  logoMark: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  logoSub: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--accent)',
    opacity: 0.65,
    letterSpacing: '0.02em',
  },
  newApptBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0 0.75rem',
    padding: '0.6rem 0.85rem',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 8,
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--bg-sidebar)',
    cursor: 'pointer',
    letterSpacing: '-0.01em',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '0 0.75rem',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.55rem 0.65rem',
    borderRadius: 8,
    fontSize: '0.875rem',
    transition: 'background 0.12s',
    textDecoration: 'none',
  },
  navActive: {
    background: 'var(--nav-active-bg)',
  },
  tourHighlight: {
    position: 'relative', zIndex: 101,
    background: 'var(--accent-tint)', boxShadow: '0 0 0 1px var(--accent-active-border), 0 12px 30px rgba(0,0,0,0.24)',
  },
  sidebarBottom: {
    padding: '0 1rem',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
  },
  gearBtn: {
    marginLeft: 'auto',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.25rem',
    borderRadius: 6,
    textDecoration: 'none',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'var(--accent-tint)',
    color: 'var(--accent)',
    fontSize: '0.8rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  userName: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-dim)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userEmail: {
    fontSize: '0.7rem',
    color: 'var(--text-ghost)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-base)',
  },
  tourLayer: { position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' },
  tourShade: { position: 'absolute', inset: 0, background: 'rgba(7,9,13,0.72)', backdropFilter: 'blur(2px)' },
  tourCard: {
    position: 'absolute', zIndex: 102, pointerEvents: 'auto', left: 244, top: '50%', transform: 'translateY(-50%)',
    width: 440, padding: '1.8rem', borderRadius: 16, background: 'var(--bg-modal)', border: '1px solid var(--accent-tint-border)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', gap: '0.9rem',
  },
  tourProgress: { fontSize: '0.67rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em' },
  tourTitle: { margin: 0, fontSize: '1.28rem', letterSpacing: '-0.025em', color: 'var(--text)' },
  tourBody: { margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.58 },
  tourActions: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem' },
  tourNavActions: { display: 'flex', gap: '0.5rem' },
  tourSkip: { border: 0, background: 'transparent', padding: 0, color: 'var(--text-ghost)', fontSize: '0.76rem', cursor: 'pointer' },
  tourBack: { border: '1px solid var(--border)', borderRadius: 7, padding: '0.5rem 0.7rem', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.76rem', cursor: 'pointer' },
  tourNext: { border: 0, borderRadius: 7, padding: '0.5rem 0.75rem', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: '0.45rem', alignItems: 'center' },
};
