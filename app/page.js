'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { completeStudioSignup, getMyStudioAccount } from '@/lib/api';
import SignUpFlow from '@/components/SignUpFlow';


export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [wide, setWide] = useState(false); // sign-up's intro step has enough content to earn a wider card

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
          router.replace('/dashboard');
          return;
        } catch (err) {
          setNotice(err.message || 'Payment setup is complete. Please sign in to continue.');
        }
      } else if (params.has('signup')) {
        setTab('signup');
      }
      const { data: { session } } = await getSupabase().auth.getSession();
      if (session) router.replace('/dashboard');
      else setChecking(false);
    }
    initialize();
  }, [router]);

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
      router.replace(email.trim().toLowerCase() === 'studio@test.com' ? '/dashboard?tour=1' : '/dashboard');
    } catch {
      // No studio account — sign them out and block access
      await supabase.auth.signOut();
      setError('This account doesn\'t have studio access. Sign up below to apply.');
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <div className={`vanta-page${tab === 'signup' ? ' vanta-page--signup' : ''}`} style={s.page}>
      <div style={s.noise} />
      <style>{GLOBAL_CSS}</style>

      <div className={`vanta-card${tab === 'signup' ? ' vanta-card--signup' : ''}`} style={{ ...s.card, maxWidth: wide ? 960 : 420 }}>
        <div style={s.brand}>
          <span style={s.wordmark}>vanta</span>
          <span style={s.wordmarkSub}>studio</span>
        </div>

        {tab === 'signin' ? (
          <>
            <h1 style={s.authHeading}>Welcome back</h1>
            <p style={s.authSubheading}>Sign in to manage your studio.</p>
            {notice && <p style={s.noticeBox}>{notice}</p>}
            <form onSubmit={handleSignIn} style={s.form}>
              <Field label="Email">
                <InputWithIcon
                  icon={<MailIcon size={15} />}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@studio.com"
                />
              </Field>
              <Field label="Password">
                <InputWithIcon
                  icon={<LockIcon size={15} />}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </Field>
              {error && <p style={s.errorBox}>{error}</p>}
              <button type="submit" disabled={loading} className="vanta-btn" style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <p style={s.switchLine}>
              New to Vanta?{' '}
              <button type="button" onClick={() => { setTab('signup'); setError(''); }} className="vanta-link" style={s.switchLink}>
                Create account
              </button>
            </p>
          </>
        ) : (
          <SignUpFlow onSwitchToSignIn={() => { setTab('signin'); setError(''); setWide(false); }} onWideChange={setWide} />
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

// Shared across the sign-in form here and SignUpFlow's own forms — one plain <style> tag on
// the page applies to the whole document, so these classes work in both without duplicating
// the rules. Kept to properties inline styles don't already set (box-shadow, filter,
// transform) since an inline style always wins over a stylesheet rule for the same property.
const GLOBAL_CSS = `
.vanta-input { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.vanta-input:focus { outline: none; border-color: rgba(213,208,199,0.34); box-shadow: 0 0 0 2px rgba(213,208,199,0.06); }
.vanta-btn { transition: filter 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease; }
.vanta-btn:hover:not(:disabled) { filter: brightness(1.08); }
.vanta-btn:active:not(:disabled) { transform: translateY(1px); filter: brightness(0.97); }
.vanta-back-btn { transition: background 0.15s ease, border-color 0.15s ease; }
.vanta-back-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.18); }
.vanta-link { transition: opacity 0.15s ease; }
.vanta-link:hover { opacity: 0.75; }
.vanta-card::before {
  content: '';
  position: absolute;
  top: 0; left: 20%; right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(213,208,199,0.5), transparent);
}
.vanta-card--signup { transform-origin: 50% 58%; animation: vanta-signup-card-in 1.05s cubic-bezier(0.16, 1, 0.3, 1) both; }
.vanta-card--signup > * { animation: vanta-signup-content-in 0.72s cubic-bezier(0.16, 1, 0.3, 1) 0.32s both; }
.vanta-card--signup > :nth-child(3) { animation-delay: 0.44s; }
@keyframes vanta-signup-card-in { 0% { opacity: 0; transform: perspective(900px) translateY(90px) rotateX(14deg) scale(0.86); filter: blur(12px); } 62% { opacity: 1; transform: perspective(900px) translateY(-8px) rotateX(-1.5deg) scale(1.018); filter: blur(0); } 100% { opacity: 1; transform: perspective(900px) translateY(0) rotateX(0) scale(1); filter: blur(0); } }
@keyframes vanta-signup-content-in { from { opacity: 0; transform: translateY(24px); filter: blur(6px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
@media (prefers-reduced-motion: reduce) { .vanta-card--signup, .vanta-card--signup > * { animation: none; } }
`;

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base)',
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
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    boxShadow: 'var(--shadow-card)',
    borderRadius: 16,
    padding: '2.25rem 2rem',
    backdropFilter: 'blur(12px)',
    position: 'relative',
    zIndex: 1,
    transition: 'max-width 0.25s ease',
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
    color: 'rgba(213,208,199,0.7)',
    letterSpacing: '0.02em',
  },
  authHeading: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#ffffff',
    margin: '0 0 0.35rem',
    letterSpacing: '-0.01em',
  },
  authSubheading: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.45)',
    margin: '0 0 1.5rem',
    lineHeight: 1.5,
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
  switchLine: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: '1.5rem',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    color: '#d5d0c7',
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
  noticeBox: {
    margin: '0 0 1rem',
    padding: '0.7rem 0.8rem',
    borderRadius: 8,
    fontSize: '0.78rem',
    lineHeight: 1.45,
    color: '#8bdcb4',
    background: 'rgba(76,201,138,0.08)',
    border: '1px solid rgba(76,201,138,0.22)',
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
