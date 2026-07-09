'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { getArtistProfile, getMyStudioAccount } from '@/lib/api';
import { isDemoMode, setDemoMode } from '@/lib/mode';

const NAV = [
  { href: '/dashboard/home',         label: 'Dashboard',    icon: HomeIcon },
  { href: '/dashboard/schedule',     label: 'Schedule',     icon: GridCalIcon },
  { href: '/dashboard/artists',      label: 'Artists',      icon: UsersIcon },
  { href: '/dashboard/clients',      label: 'Clients',      icon: PersonIcon },
  { href: '/dashboard/appointments', label: 'Appointments', icon: CalendarIcon },
  // { href: '/dashboard/analytics',    label: 'Analytics',    icon: ChartIcon },
  { href: '/dashboard/studios',      label: 'Studios',      icon: BuildingIcon, adminOnly: true },
];

const ADMIN_EMAIL = 'matthew.m.kwon@gmail.com';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [artist, setArtist] = useState(null);
  const [studioName, setStudioName] = useState('');
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => { setDemo(isDemoMode()); }, []);

  useEffect(() => {
    async function init() {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/'); return; }
      setUser(session.user);

      // Only studio accounts can access the dashboard
      try {
        const studioAccount = await getMyStudioAccount();
        if (studioAccount.status === 'pending') {
          router.replace('/pending');
          return;
        }
        if (studioAccount.status === 'rejected') {
          router.replace('/pending');
          return;
        }
        setStudioName(studioAccount.studio?.name ?? '');
      } catch {
        // No studio account — boot them out
        await getSupabase().auth.signOut();
        router.replace('/');
        return;
      }

      try {
        const profile = await getArtistProfile(session.user.id);
        setArtist(profile);
      } catch {
        // not an artist — fine, studio-only account
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
      <div style={loadingStyles.wrap}>
        <div style={loadingStyles.dot} />
      </div>
    );
  }

  const displayName = studioName || 'Studio';

  return (
    <div style={s.shell}>
      {/* ── Demo banner ──────────────────────────────────────────────── */}
      {demo && (
        <div style={s.demoBanner}>
          <span style={s.demoBannerText}>DEMO — data is isolated from production</span>
        </div>
      )}

      <div style={s.body}>
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside style={s.sidebar}>
        <div style={s.sidebarTop}>
          <Link href="/dashboard/appointments" style={s.logo}>
            <span style={s.logoMark}>vanta</span>
            <span style={s.logoSub}>studio</span>
          </Link>

          <nav style={s.nav}>
            {NAV.filter(item => !item.adminOnly || user?.email === ADMIN_EMAIL).map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link key={href} href={href} style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
                  <Icon size={16} color={active ? '#f5ecd9' : 'rgba(255,255,255,0.45)'} />
                  <span style={{ color: active ? '#f5ecd9' : 'rgba(255,255,255,0.55)', fontWeight: active ? 600 : 400 }}>
                    {label}
                  </span>
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
            <Link href="/dashboard/settings" style={s.gearBtn} title="Settings">
              <GearIcon size={17} color={pathname.startsWith('/dashboard/settings') ? '#f5ecd9' : 'rgba(255,255,255,0.55)'} />
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main style={s.main}>{children}</main>
      </div>
    </div>
  );
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────

function CalendarIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke={color} strokeWidth="1.2" />
      <path d="M1.5 6h13" stroke={color} strokeWidth="1.2" />
      <path d="M5 1v3M11 1v3" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke={color} strokeWidth="1.2" />
      <path d="M1 13c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 7.5a2.5 2.5 0 1 0 0-5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M13 13c0-1.86-.9-3.5-2.26-4.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5" r="3" stroke={color} strokeWidth="1.2" />
      <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 12l3.5-4 3 2.5L12 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="5" r="1.2" fill={color} />
    </svg>
  );
}

function HomeIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 6.5L8 2l6 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M6 15v-5h4v5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridCalIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke={color} strokeWidth="1.2" />
      <path d="M1.5 6.5h13" stroke={color} strokeWidth="1.2" />
      <path d="M5.5 1.5v2M10.5 1.5v2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4.5 9.5h2M9.5 9.5h2M4.5 12h2M9.5 12h2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function BuildingIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke={color} strokeWidth="1.2" />
      <path d="M5 14V10h6v4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M5 7h1.5M9.5 7H11M5 5h1.5M9.5 5H11" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 6.5h12" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const loadingStyles = {
  wrap: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1017',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
};

const s = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: '#0d1017',
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
    background: '#0b0f16',
    borderRight: '1px solid rgba(255,255,255,0.06)',
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
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  logoSub: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'rgba(245,236,217,0.65)',
    letterSpacing: '0.02em',
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
    background: 'rgba(245,236,217,0.07)',
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
    background: 'rgba(245,236,217,0.12)',
    color: '#f5ecd9',
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
    color: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userEmail: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
};
