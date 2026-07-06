'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (session) router.replace('/dashboard');
        else setChecking(false);
      });
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.replace('/dashboard');
    }
  }

  if (checking) return null;

  return (
    <div style={styles.page}>
      <div style={styles.noise} />

      <div style={styles.card}>
        <div style={styles.brand}>
          <span style={styles.wordmark}>vanta</span>
          <span style={styles.wordmarkSub}>studio</span>
        </div>

        <p style={styles.subtitle}>Sign in to your studio</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={styles.input}
              placeholder="you@studio.com"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
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
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
    backgroundSize: '256px 256px',
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '2.5rem 2rem',
    backdropFilter: 'blur(12px)',
    position: 'relative',
    zIndex: 1,
  },
  brand: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    marginBottom: '0.5rem',
  },
  wordmark: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.02em',
    fontFamily: 'var(--font-body)',
  },
  wordmarkSub: {
    fontSize: '1.1rem',
    fontWeight: 500,
    color: 'rgba(245,236,217,0.7)',
    letterSpacing: '0.02em',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: '2rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: '0.02em',
  },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '0.65rem 0.85rem',
    fontSize: '0.9rem',
    color: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  error: {
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
    letterSpacing: '0.01em',
    transition: 'opacity 0.15s',
  },
};
