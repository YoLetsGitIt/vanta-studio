'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { completeStudioSignup, getMyStudioAccount } from '@/lib/api';
import SignUpFlow from '@/components/SignUpFlow';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import StatePanel from '@/components/ui/StatePanel';
import styles from './StudioAuth.module.css';
const marketing = (process.env.NEXT_PUBLIC_MARKETING_URL || 'https://vanta.tattoo').replace(/\/$/, '');


export default function StudioAuth({ initialTab = 'signin' }) {
  const [tab, setTab] = useState(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function initialize() {
      const params = new URLSearchParams(window.location.search);
      if (params.get('signup') === 'complete') {
        setTab('signin');
        const sessionId = params.get('session_id');
        try {
          if (!sessionId) throw new Error('Missing Stripe checkout session');
          await completeStudioSignup(sessionId);
          const saved = JSON.parse(window.sessionStorage.getItem('vanta-pending-signup') || 'null');
          if (!saved?.email || !saved?.password) throw new Error('Your studio is ready — sign in with the email and password you chose.');
          const { error: signInError } = await getSupabase().auth.signInWithPassword(saved);
          if (signInError) throw signInError;
          window.sessionStorage.removeItem('vanta-pending-signup');
          // Load a document after auth so static-export navigation cannot expose RSC data.
          window.location.replace('/dashboard/home');
          return;
        } catch (err) {
          setNotice(err.message || 'Payment setup is complete. Please sign in to continue.');
        }
      } else if (params.has('signup')) {
        setTab('signup');
      }
      const { data: { session } } = await getSupabase().auth.getSession();
      if (session) window.location.replace('/dashboard/home');
      else setChecking(false);
    }
    initialize();
  }, []);

  async function handleSignIn(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = getSupabase();
    const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    if (email.trim().toLowerCase() === 'studio@test.com' && signInData.user?.id) {
      sessionStorage.removeItem(`vanta-studio-tour-session:${signInData.user.id}`);
      sessionStorage.setItem(`vanta-studio-tour-start:${signInData.user.id}`, 'true');
    }
    // Verify this is a studio account
    try {
      await getMyStudioAccount();
      window.location.replace(email.trim().toLowerCase() === 'studio@test.com' ? '/dashboard/home?tour=1' : '/dashboard/home');
    } catch {
      // No studio account — sign them out and block access
      await supabase.auth.signOut();
      setError('This account doesn\'t have studio access. Sign up below to apply.');
      setLoading(false);
    }
  }

  if (checking) return <StatePanel title="Loading your studio…" busy />;

  return (
    <div data-theme="dark" className={styles.page}>
      <div className={styles.scene} aria-hidden="true">
        <picture>
          <source media="(max-width: 700px)" srcSet="/studio/walkthrough/portrait/0183.webp" />
          <img src="/studio/walkthrough/landscape/0183.webp" alt="" fetchPriority="high" />
        </picture>
      </div>
      <header className={styles.header}>
        <a className={styles.brand} href={marketing} aria-label="Vanta home">
          vanta<span>.</span><small>STUDIO</small>
        </a>
        <a className={styles.returnLink} href={`${marketing}/studio`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m10 5-7 7 7 7M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to studio
        </a>
      </header>
      <main className={styles.main}>
      <section className={styles.card} aria-label={tab === 'signup' ? 'Create your Vanta account' : 'Sign in to Vanta'}>
        {tab === 'signin' ? (
          <>
            <h1 style={s.authHeading}>Welcome back</h1>
            <p style={s.authSubheading}>Sign in to manage your studio.</p>
            {notice && <p role="status" style={s.noticeBox}>{notice}</p>}
            <form onSubmit={handleSignIn} style={s.form}>
              <Field label="Email" id="signin-email" required>
                <InputWithIcon
                  id="signin-email"
                  icon={<MailIcon size={15} />}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@studio.com"
                />
              </Field>
              <Field label="Password" id="signin-password" required>
                <InputWithIcon
                  id="signin-password"
                  icon={<LockIcon size={15} />}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </Field>
              {error && <p role="alert" style={s.errorBox}>{error}</p>}
              <Button type="submit" loading={loading} loadingLabel="Signing in…" fullWidth>
                Sign in
              </Button>
            </form>
            <p style={s.switchLine}>
              New to Vanta?{' '}
              <button type="button" onClick={() => { setTab('signup'); setError(''); }} className="vanta-link" style={s.switchLink}>
                Create account
              </button>
            </p>
          </>
        ) : (
          <SignUpFlow onSwitchToSignIn={() => { setTab('signin'); setError(''); }} />
        )}
      </section>
      </main>
    </div>
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

const s = {
  authHeading: {
    fontSize: 'clamp(1.65rem, 3vw, 2rem)',
    fontWeight: 500,
    color: 'var(--text)',
    margin: '0 0 0.5rem',
    letterSpacing: '-0.01em',
  },
  authSubheading: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    margin: '0 0 1.5rem',
    lineHeight: 1.5,
  },
  inputIcon: {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-secondary)',
    display: 'flex',
    pointerEvents: 'none',
  },
  switchLine: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: '1.5rem',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontWeight: 600,
    fontSize: 'inherit',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.65rem 0.85rem',
    fontSize: '0.9rem',
    color: 'var(--text)',
    outline: 'none',
    width: '100%',
  },
  errorBox: {
    fontSize: '0.8rem',
    color: 'var(--color-danger)',
    background: 'var(--color-danger-surface)',
    border: '1px solid var(--color-danger-border)',
    borderRadius: 6,
    padding: '0.5rem 0.75rem',
  },
  noticeBox: {
    margin: '0 0 1rem',
    padding: '0.7rem 0.8rem',
    borderRadius: 8,
    fontSize: '0.78rem',
    lineHeight: 1.45,
    color: 'var(--color-success)',
    background: 'var(--color-success-surface)',
    border: '1px solid var(--color-success-border)',
  },
  btn: {
    marginTop: '0.25rem',
    background: 'var(--accent)',
    color: 'var(--accent-contrast)',
    border: 'none',
    borderRadius: 8,
    padding: '0.75rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
};
