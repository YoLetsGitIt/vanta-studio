'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getMyStudioAccount, demoLogin } from '@/lib/api';
import { isDemoMode, setDemoMode } from '@/lib/mode';
import SignUpFlow from '@/components/SignUpFlow';


export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [demoMode, setDemoModeState] = useState(false);

  useEffect(() => {
    setDemoModeState(isDemoMode());
    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (session) router.replace('/dashboard');
        else setChecking(false);
      });
  }, [router]);

  async function handleEnterDemo() {
    setLoading(true);
    setError('');
    try {
      const session = await demoLogin();
      await getSupabase().auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      setDemoMode(true);
      setDemoModeState(true);
      router.replace('/dashboard');
    } catch {
      setError('Demo unavailable. Please try again later.');
      setLoading(false);
    }
  }

  function handleExitDemo() {
    setDemoMode(false);
    setDemoModeState(false);
    setEmail('');
    setPassword('');
    setError('');
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    // Verify this is a studio account
    try {
      const account = await getMyStudioAccount();
      if (account.status === 'pending') {
        router.replace('/pending');
      } else if (account.status === 'approved') {
        router.replace('/dashboard');
      } else {
        // rejected
        router.replace('/pending');
      }
    } catch {
      // No studio account — sign them out and block access
      await supabase.auth.signOut();
      setError('This account doesn\'t have studio access. Sign up below to apply.');
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div style={s.page}>
      <div style={s.noise} />

      <div style={s.card}>
        <div style={s.brand}>
          <span style={s.wordmark}>vanta</span>
          <span style={s.wordmarkSub}>studio</span>
          {demoMode && (
            <span style={s.demoBadge}>DEMO</span>
          )}
        </div>

        {demoMode && (
          <div style={s.demoBar}>
            <span style={s.demoBarText}>Demo mode — data is isolated from production</span>
            <button onClick={handleExitDemo} style={s.demoBarExit}>Exit</button>
          </div>
        )}

        {/* Tab switcher */}
        <div style={s.tabs}>
          <button
            onClick={() => { setTab('signin'); setError(''); }}
            style={{ ...s.tab, ...(tab === 'signin' ? s.tabActive : {}) }}
          >
            Sign in
          </button>
          <button
            onClick={() => { setTab('signup'); setError(''); }}
            style={{ ...s.tab, ...(tab === 'signup' ? s.tabActive : {}) }}
          >
            Create account
          </button>
        </div>

        {tab === 'signin' ? (
          <form onSubmit={handleSignIn} style={s.form}>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={s.input}
                placeholder="you@studio.com"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={s.input}
                placeholder="••••••••"
              />
            </Field>
            {error && <p style={s.errorBox}>{error}</p>}
            <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            {!demoMode && (
              <button type="button" onClick={handleEnterDemo} style={s.demoBtn}>
                Enter demo
              </button>
            )}
          </form>
        ) : (
          <SignUpFlow onSwitchToSignIn={() => setTab('signin')} />
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>{label}</label>
      {children}
    </div>
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
    maxWidth: 420,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '2.25rem 2rem',
    backdropFilter: 'blur(12px)',
    position: 'relative',
    zIndex: 1,
  },
  brand: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    marginBottom: '1.5rem',
  },
  wordmark: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  wordmarkSub: {
    fontSize: '1.1rem',
    fontWeight: 500,
    color: 'rgba(245,236,217,0.7)',
    letterSpacing: '0.02em',
  },
  tabs: {
    display: 'flex',
    gap: '0',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: '3px',
    marginBottom: '1.75rem',
  },
  tab: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.83rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    fontWeight: 600,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },
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
  errorBox: {
    fontSize: '0.8rem',
    color: '#e86f6f',
    background: 'rgba(232,111,111,0.08)',
    border: '1px solid rgba(232,111,111,0.2)',
    borderRadius: 6,
    padding: '0.5rem 0.75rem',
  },
  btn: {
    marginTop: '0.25rem',
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
  demoBtn: {
    marginTop: '0.5rem',
    background: 'transparent',
    border: '1px solid rgba(255,200,60,0.25)',
    borderRadius: 8,
    padding: '0.6rem',
    fontSize: '0.83rem',
    fontWeight: 500,
    color: 'rgba(255,200,60,0.7)',
    cursor: 'pointer',
    width: '100%',
  },
  demoBadge: {
    marginLeft: '0.5rem',
    fontSize: '0.6rem',
    fontWeight: 700,
    color: '#ffc83c',
    background: 'rgba(255,200,60,0.12)',
    border: '1px solid rgba(255,200,60,0.3)',
    borderRadius: 4,
    padding: '2px 6px',
    letterSpacing: '0.06em',
    alignSelf: 'center',
  },
  demoBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255,200,60,0.07)',
    border: '1px solid rgba(255,200,60,0.2)',
    borderRadius: 8,
    padding: '0.5rem 0.75rem',
    marginBottom: '1rem',
  },
  demoBarText: {
    fontSize: '0.75rem',
    color: 'rgba(255,200,60,0.8)',
  },
  demoBarExit: {
    background: 'transparent',
    border: 'none',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'rgba(255,200,60,0.7)',
    cursor: 'pointer',
    padding: 0,
  },
};
