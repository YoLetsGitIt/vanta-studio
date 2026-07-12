'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { getArtistProfile, getMyStudioAccount } from '@/lib/api';
import { isDemoMode, setDemoMode } from '@/lib/mode';
import { initTheme } from '@/lib/theme';
import NewAppointmentPanel from '@/components/NewAppointmentPanel';

const NAV = [
  { href: '/dashboard/home',         label: 'Dashboard',    icon: HomeIcon },
  { href: '/dashboard/schedule',     label: 'Schedule',     icon: GridCalIcon },
  { href: '/dashboard/artists',      label: 'Artists',      icon: UsersIcon },
  { href: '/dashboard/clients',      label: 'Clients',      icon: PersonIcon },
  { href: '/dashboard/appointments', label: 'Bookings',     icon: CalendarIcon },
  { href: '/dashboard/revenue',      label: 'Analytics',    icon: RevenueIcon },
  // { href: '/dashboard/analytics',    label: 'Analytics',    icon: ChartIcon },
  { href: '/dashboard/studios',      label: 'Studios',      icon: BuildingIcon, adminOnly: true },
];

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [artist, setArtist] = useState(null);
  const [studioName, setStudioName] = useState('');
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [appointmentPanelOpen, setAppointmentPanelOpen] = useState(false);

  useEffect(() => { setDemo(isDemoMode()); initTheme(); }, []);

  useEffect(() => {
    async function init() {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/'); return; }
      setUser(session.user);

      try {
        const studioAccount = await getMyStudioAccount();
        if (studioAccount.status === 'pending') { router.replace('/pending'); return; }
        if (studioAccount.status === 'rejected') { router.replace('/pending'); return; }
        setStudioName(studioAccount.studio?.name ?? '');
      } catch {
        await getSupabase().auth.signOut();
        router.replace('/');
        return;
      }

      try {
        const profile = await getArtistProfile(session.user.id);
        setArtist(profile);
      } catch {
        // not an artist — fine
      }
      setReady(true);
    }
    init();
  }, [router]);

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    setDemoMode(false);
    router.replace('/');
  }

  if (!ready) {
    return (
      <div style={s.loadingWrap}>
        <div style={s.loadingDot} />
      </div>
    );
  }

  const displayName = studioName || 'Studio';

  return (
    <div style={s.shell}>
      {demo && (
        <div style={s.demoBanner}>
          <span style={s.demoBannerText}>DEMO — data is isolated from production</span>
        </div>
      )}

      <div style={s.body}>
        <aside style={s.sidebar}>
          <div style={s.sidebarTop}>
            <Link href="/dashboard/appointments" style={s.logo}>
              <span style={s.logoMark}>vanta</span>
              <span style={s.logoSub}>studio</span>
            </Link>

            <button onClick={() => setAppointmentPanelOpen(true)} style={s.newApptBtn}>
              <PlusIcon size={13} />
              New Appointment
            </button>

            <nav style={s.nav}>
              {NAV.filter(item => !item.adminOnly || user?.email === ADMIN_EMAIL).map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      ...s.navItem,
                      ...(active ? s.navActive : {}),
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    <Icon size={16} />
                    <span style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
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
        onClose={() => setAppointmentPanelOpen(false)}
        onCreated={() => {}}
      />
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

function BuildingIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 14V10h6v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5 7h1.5M9.5 7H11M5 5h1.5M9.5 5H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.2" />
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
  demoBanner: {
    flexShrink: 0,
    height: 32,
    background: 'rgba(255,200,60,0.1)',
    borderBottom: '1px solid rgba(255,200,60,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBannerText: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#ffc83c',
    letterSpacing: '0.04em',
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
};
