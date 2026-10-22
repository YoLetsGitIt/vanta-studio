'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { ensureClientProfile } from '@/lib/client-account';
import ConsentSocialSignIn from '@/app/consent/ConsentSocialSignIn';
import styles from '@/app/consent/ConsentPage.module.css';

function DateOfBirthInput({ value, onChange }) {
  return (
    <div className={styles.dateField}>
      <input
        className={styles.dateInput}
        style={s.input}
        type="date"
        aria-label="Date of birth"
        autoComplete="bday"
        required
        value={value}
        data-empty={!value}
        max={new Date().toISOString().slice(0, 10)}
        onChange={e => onChange(e.target.value)}
      />
      {!value && <span className={styles.datePlaceholder} aria-hidden="true">Date of birth</span>}
    </div>
  );
}

export default function ClientAuthGate({ studioId, studioName, logoUrl, purpose = 'consent', collectMarketing = false }) {
  const [mode, setMode]       = useState('signup');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]     = useState('');
  const [dob, setDob]       = useState('');
  const [phone, setPhone]   = useState('');
  const [agreed, setAgreed]   = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [notice, setNotice]   = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr(''); setNotice('');
    if (mode === 'signup' && !agreed) { setErr('You must agree to the Terms of Use and Privacy Policy.'); return; }
    setBusy(true);
    const supabase = getSupabase();
    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Covers a returning client whose app profile was never created.
        await ensureClientProfile(data.session);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href, data: { full_name: name.trim(), name: name.trim(), dob, phone: phone.trim(), ...(collectMarketing ? { marketing_email: marketing, marketing_sms: marketing } : {}) } } });
        if (error) throw error;
        if (data.session) await ensureClientProfile(data.session, name.trim());
        else setNotice('Check your email to confirm your account, then return to this page to continue.');
      }
    } catch (e2) {
      setErr(e2.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={s.card}>
      {logoUrl && <img src={logoUrl} alt={`${studioName} logo`} style={{ maxHeight: 56, maxWidth: 200, objectFit: 'contain', alignSelf: 'flex-start' }} />}
      <p style={s.studioTag}>{studioName}</p>
      <h2 style={s.heading}>{mode === 'signup' ? 'Create an account' : 'Sign in'}</h2>
      <p style={s.muted}>
        {studioName} needs you to {mode === 'signup' ? 'create a Vanta account' : 'sign in'} before {purpose === 'booking' ? 'requesting a booking' : 'completing their consent form'}.
      </p>
      <ConsentSocialSignIn returnPath={purpose === 'booking' ? '/studio-booking' : '/consent'} studioId={studioId} disabled={busy} onBusyChange={setBusy} />
      <form onSubmit={submit} style={s.form}>
        {mode === 'signup' && (
          <>
            <input style={s.input} type="text" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            <DateOfBirthInput value={dob} onChange={setDob} />
            <input style={s.input} type="tel" required autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
          </>
        )}
        <input style={s.input} type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input style={s.input} type="password" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
        {mode === 'signup' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.8rem', lineHeight: '18px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ flexShrink: 0, margin: '1px 0 0', width: 16, height: 16, minWidth: 'auto', accentColor: '#f5ecd9' }} />
            <span>
              I agree to the{' '}
              <a href="https://www.vanta.tattoo/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#f5ecd9' }}>Terms of Use</a>
              {' '}and{' '}
              <a href="https://www.vanta.tattoo/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#f5ecd9' }}>Privacy Policy</a>{' '}
              <span style={{ color: '#e86f6f' }}>*</span>
            </span>
          </label>
        )}
        {mode === 'signup' && collectMarketing && <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.8rem', lineHeight: '18px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
          <input type="checkbox" checked={marketing} onChange={event => setMarketing(event.target.checked)} style={{ flexShrink: 0, margin: '1px 0 0', width: 16, height: 16, minWidth: 'auto', accentColor: '#f5ecd9' }} />
          <span>Send me offers and updates from {studioName} by email &amp; text.</span>
        </label>}
        {err && <p role="alert" style={s.error}>{err}</p>}
        {notice && <p style={s.hint}>{notice}</p>}
        <button type="submit" disabled={busy} style={{ ...s.btn, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account & continue' : 'Sign in & continue'}
        </button>
        <button type="button" disabled={busy} onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setErr(''); setNotice(''); }}
          style={{ background: 'none', border: 'none', color: '#f5ecd9', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit' }}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  );
}

const s = {
  card: {
    background: '#1a2026',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '2rem 1.75rem',
    width: '100%', maxWidth: 540,
    display: 'flex', flexDirection: 'column', gap: '0.65rem',
  },
  studioTag: {
    margin: 0,
    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#f5ecd9',
  },
  heading: {
    margin: 0,
    fontSize: '1.4rem', fontWeight: 700, color: '#fff',
    letterSpacing: '-0.01em',
  },
  muted: {
    margin: 0,
    fontSize: '0.855rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
  },
  hint: {
    margin: 0,
    fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)',
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem',
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '0.65rem 0.85rem',
    fontSize: '0.9rem', color: '#fff', outline: 'none',
    width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  btn: {
    background: '#f5ecd9', border: 'none', borderRadius: 10,
    padding: '0.8rem', fontSize: '0.92rem', fontWeight: 700,
    color: '#11151b', cursor: 'pointer', transition: 'opacity 0.15s',
  },
  error: {
    margin: 0, fontSize: '0.8rem', color: '#e86f6f',
  },
};
