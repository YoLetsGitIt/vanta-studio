'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { completeStudioSignup, getMyStudioAccount } from '@/lib/api';
import SignUpFlow from '@/components/SignUpFlow';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import StatePanel from '@/components/ui/StatePanel';


export default function HomePage({ mode = 'signin' }) {
  const [tab, setTab] = useState(mode);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [wide, setWide] = useState(false); // sign-up's intro step has enough content to earn a wider card

  useEffect(() => {
    async function initialize() {
      if (mode === 'reset') {
        // The reset email lands here with the recovery session in the URL hash.
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const { data: { session } } = await getSupabase().auth.getSession();
        if (!session || hash.get('error')) {
          setTab('forgot');
          setError('This reset link has expired or was already used. Send yourself a new one.');
        }
        window.history.replaceState(null, '', window.location.pathname);
        setChecking(false);
        return;
      }
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

  async function handleForgot(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    const address = email.trim();
    const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (resetError) { setError(resetError.message); return; }
    setNotice(`If ${address} has a Vanta account, a reset link is on its way. Open it on this computer or phone to choose a new password.`);
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    const { error: updateError } = await getSupabase().auth.updateUser({ password: newPassword });
    if (updateError) { setError(updateError.message); setLoading(false); return; }
    window.location.replace('/dashboard/home');
  }

  function showSignIn() { setTab('signin'); setError(''); setNotice(''); }

  if (checking) return <StatePanel title="Loading your studio…" busy />;

  return (
    <div data-theme={tab === 'signup' ? 'dark' : undefined} className={`vanta-page${tab === 'signup' ? ' vanta-page--signup' : ''}`} style={s.page}>
      <div style={s.noise} />
      <style>{GLOBAL_CSS}</style>

      <div className={`vanta-card${tab === 'signup' ? ' vanta-card--signup' : ''}`} style={{ ...s.card, maxWidth: wide ? 960 : 420 }}>
        <div style={s.brand}>
          <span style={s.wordmark}>vanta</span>
          <span style={s.wordmarkSub}>studio</span>
        </div>

        {tab === 'forgot' ? (
          <>
            <h1 style={s.authHeading}>Reset your password</h1>
            <p style={s.authSubheading}>Enter your studio email and we'll send you a link to choose a new password.</p>
            {notice && <p role="status" style={s.noticeBox}>{notice}</p>}
            <form onSubmit={handleForgot} style={s.form}>
              <Field label="Email" id="forgot-email" required>
                <InputWithIcon id="forgot-email" icon={<MailIcon size={15} />} type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@studio.com" />
              </Field>
              {error && <p role="alert" style={s.errorBox}>{error}</p>}
              <Button type="submit" loading={loading} loadingLabel="Sending…" fullWidth>
                Send reset link
              </Button>
            </form>
            <p style={s.switchLine}>
              <button type="button" onClick={showSignIn} className="vanta-link" style={s.switchLink}>Back to sign in</button>
            </p>
          </>
        ) : tab === 'reset' ? (
          <>
            <h1 style={s.authHeading}>Choose a new password</h1>
            <p style={s.authSubheading}>You'll use it to sign in to Vanta Studio and the Vanta app.</p>
            <form onSubmit={handleReset} style={s.form}>
              <Field label="New password" id="reset-password" required>
                <InputWithIcon id="reset-password" icon={<LockIcon size={15} />} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" placeholder="Minimum 8 characters" />
              </Field>
              <Field label="Confirm password" id="reset-confirm" required>
                <InputWithIcon id="reset-confirm" icon={<LockIcon size={15} />} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" placeholder="Re-enter password" />
              </Field>
              {error && <p role="alert" style={s.errorBox}>{error}</p>}
              <Button type="submit" loading={loading} loadingLabel="Saving…" fullWidth>
                Save and sign in
              </Button>
            </form>
          </>
        ) : tab === 'signin' ? (
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
              <button type="button" onClick={() => { setTab('forgot'); setError(''); setNotice(''); }} className="vanta-link" style={s.forgotLink}>
                Forgot password?
              </button>
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
          <SignUpFlow onSwitchToSignIn={() => { setTab('signin'); setError(''); setWide(false); }} onWideChange={setWide} />
        )}
      </div>
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
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  wordmarkSub: {
    fontSize: '1.1rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
  },
  authHeading: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: 'var(--text)',
    margin: '0 0 0.35rem',
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: '-0.5rem',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '0.25rem 0',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
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
