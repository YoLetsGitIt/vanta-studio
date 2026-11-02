'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import styles from './ConsentPage.module.css';

export default function ConsentSocialSignIn({ studioId, returnPath = '/consent', disabled, onBusyChange }) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (!url.searchParams.has('error') && !fragment.has('error') && !fragment.has('error_description')) return;
    setError('Sign-in was not completed. Please try again or continue with email.');
    for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  }, []);

  async function signIn(provider) {
    if (pending || disabled) return;
    setError('');
    setPending(provider);
    onBusyChange(true);
    const label = provider === 'apple' ? 'Apple' : 'Google';
    try {
      const redirectTo = new URL(returnPath, window.location.origin);
      redirectTo.searchParams.set('s', studioId);
      const { data, error: authError } = await getSupabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo.href, skipBrowserRedirect: true },
      });
      if (authError || !data?.url) throw new Error();

      // Native sign-in can be enabled before a provider's web credentials exist.
      // Keep the email form available when the authorization endpoint rejects it.
      const response = await fetch(data.url, {
        redirect: 'manual',
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      });
      if (response.type !== 'opaqueredirect' && !(response.ok || response.status >= 300 && response.status < 400)) {
        throw new Error();
      }
      window.location.assign(data.url);
    } catch {
      setError(`${label} sign-in is temporarily unavailable. Please continue with email or try again later.`);
      setPending(null);
      onBusyChange(false);
    }
  }

  return (
    <div className={styles.socialSection}>
      <div className={styles.socialButtons} role="group" aria-label="Continue with a connected account" aria-busy={Boolean(pending)}>
        {['apple', 'google'].map(provider => (
          <button key={provider} className={styles.socialButton} type="button" disabled={disabled || Boolean(pending)} onClick={() => signIn(provider)}>
            {provider === 'apple' ? <AppleIcon /> : <GoogleIcon />}
            {pending === provider ? 'Connecting…' : `Continue with ${provider === 'apple' ? 'Apple' : 'Google'}`}
          </button>
        ))}
      </div>
      <p className={styles.socialTerms}>
        By continuing with Apple or Google, you agree to the{' '}
        <a href="https://www.vanta.tattoo/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a> and{' '}
        <a href="https://www.vanta.tattoo/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
      </p>
      {error && <p role="alert" className={styles.socialError}>{error}</p>}
      <div className={styles.authDivider}><span>or continue with email</span></div>
    </div>
  );
}

function AppleIcon() {
  return <svg width="20" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.1 12.4c0-2 1.6-3 1.7-3.1-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.8-2.8-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.6 2.3 2.8 2.2 1.1 0 1.6-.7 3-.7s1.9.7 3.1.7c1.3 0 2-1.1 2.7-2.2.9-1.3 1.2-2.6 1.2-2.7-.1 0-3-1.1-3-3.8ZM15 6.3c.6-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3Z"/></svg>;
}

function GoogleIcon() {
  return <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.1Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.8-3.6-11.4-8.4H5.7v5.3A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.4a12 12 0 0 1 0-7.7v-5.3H5.7a20 20 0 0 0 0 18.3l6.9-5.3Z"/><path fill="#EA4335" d="M24 11.3c3 0 5.6 1 7.7 3l5.8-5.8A19.5 19.5 0 0 0 24 3a20.4 20.4 0 0 0-18.3 11.4l6.9 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"/></svg>;
}
