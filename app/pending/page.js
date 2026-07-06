'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { getMyStudioAccount } from '@/lib/api';

export default function PendingPage() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) { setLoading(false); return; }
      try {
        const data = await getMyStudioAccount();
        setAccount(data);
        // If approved, redirect to dashboard
        if (data.status === 'approved') {
          window.location.href = '/dashboard';
        }
      } catch {
        // ignore — account might not exist yet
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    window.location.href = '/';
  }

  return (
    <div style={s.page}>
      <div style={s.noise} />
      <div style={s.card}>
        <div style={s.brand}>
          <span style={s.wordmark}>vanta</span>
          <span style={s.wordmarkSub}>studio</span>
        </div>

        {loading ? (
          <p style={s.muted}>Loading…</p>
        ) : account?.status === 'rejected' ? (
          <RejectedState account={account} onSignOut={handleSignOut} />
        ) : (
          <PendingState account={account} onSignOut={handleSignOut} />
        )}
      </div>
    </div>
  );
}

function PendingState({ account, onSignOut }) {
  return (
    <>
      <div style={s.iconWrap}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="17" stroke="rgba(245,236,217,0.3)" strokeWidth="1.5" />
          <path d="M18 10v9l5 3" stroke="#f5ecd9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 style={s.heading}>Application submitted</h1>
      <p style={s.body}>
        Your studio <strong style={{ color: '#fff' }}>{account?.studio?.name ?? 'application'}</strong> is
        under review. We'll be in touch once it's approved — this usually takes less than 24 hours.
      </p>
      <div style={s.infoRow}>
        <span style={s.infoLabel}>Status</span>
        <span style={s.badge}>Pending review</span>
      </div>
      <button onClick={onSignOut} style={s.signOutBtn}>Sign out</button>
    </>
  );
}

function RejectedState({ account, onSignOut }) {
  return (
    <>
      <div style={s.iconWrap}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="17" stroke="rgba(232,111,111,0.4)" strokeWidth="1.5" />
          <path d="M12 12l12 12M24 12L12 24" stroke="#e86f6f" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <h1 style={{ ...s.heading, color: '#e86f6f' }}>Application not approved</h1>
      <p style={s.body}>
        Unfortunately your studio application was not approved at this time.
      </p>
      {account?.rejection_reason && (
        <div style={s.rejectionReason}>
          <span style={s.infoLabel}>Reason</span>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{account.rejection_reason}</p>
        </div>
      )}
      <p style={{ ...s.body, fontSize: '0.8rem' }}>
        If you believe this is an error, please contact us.
      </p>
      <button onClick={onSignOut} style={s.signOutBtn}>Sign out</button>
    </>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(ellipse 1400px 900px at 50% -100px, rgba(245,236,217,0.04) 0%, transparent 60%), #0d1017',
    padding: '1.5rem',
    position: 'relative',
    overflow: 'hidden',
  },
  noise: {
    position: 'absolute',
    inset: 0,
    opacity: 0.025,
    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
    backgroundSize: '256px 256px',
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '2.25rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    position: 'relative',
    zIndex: 1,
  },
  brand: { display: 'flex', alignItems: 'baseline', gap: '0.4rem' },
  wordmark: { fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' },
  wordmarkSub: { fontSize: '0.9rem', fontWeight: 500, color: 'rgba(245,236,217,0.7)', letterSpacing: '0.02em' },
  iconWrap: { display: 'flex', justifyContent: 'center' },
  heading: { fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0, textAlign: 'center' },
  body: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: 0, textAlign: 'center' },
  muted: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.3)' },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8,
    padding: '0.75rem',
  },
  rejectionReason: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    background: 'rgba(232,111,111,0.06)',
    border: '1px solid rgba(232,111,111,0.15)',
    borderRadius: 8,
    padding: '0.75rem',
  },
  infoLabel: { fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  badge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#f59e3a',
    background: 'rgba(245,158,58,0.12)',
    border: '1px solid rgba(245,158,58,0.25)',
    borderRadius: 20,
    padding: '0.2rem 0.6rem',
  },
  signOutBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '0.6rem',
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    width: '100%',
  },
};
