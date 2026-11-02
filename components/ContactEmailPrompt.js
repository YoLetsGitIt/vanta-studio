'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ContactEmailPrompt.module.css';

export function isApplePrivateEmail(email = '') {
  return /@(privaterelay\.appleid\.com|private\.icloud\.com)$/i.test(email.trim());
}

export default function ContactEmailPrompt({ session, backend, onComplete }) {
  const dialog = useRef(null);
  const [status, setStatus] = useState(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = session?.user?.id;
  const account = useRef(id);
  account.current = id;

  async function request(path = '', body) {
    const requestedBy = id;
    const response = await fetch(`${backend}/auth/users/me/contact-email${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
    const result = await response.json();
    if (account.current !== requestedBy) throw new Error('Your account changed. Please try again.');
    if (!response.ok) throw new Error(result.error || 'Unable to update your contact email. Please try again.');
    return result;
  }

  useEffect(() => {
    let active = true;
    setStatus(null); setEmail(''); setCode(''); setError(''); setBusy(false);
    if (!id || !isApplePrivateEmail(session.user.email)) return;
    request().then(result => {
      if (!active || !result.prompt_required) return;
      setStatus(result); setEmail(result.pending_email || '');
    }).catch(() => {}); // A contact preference must never block account access.
    return () => { active = false; };
  }, [id, backend]);

  useEffect(() => {
    if (status?.prompt_required && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [status]);

  function finish(result) {
    dialog.current?.close();
    setStatus(null);
    if (result?.contact_email) window.dispatchEvent(new CustomEvent('vanta:contact-email-updated', { detail: { userId: id, email: result.contact_email } }));
    onComplete?.(result);
  }

  async function skip() {
    if (busy) return;
    setBusy(true);
    try { finish(await request('/skip', {})); }
    catch { finish(null); } // Keeping Apple's relay is always an available choice.
    finally { setBusy(false); }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      if (status.pending_email) finish(await request('/verify', { code }));
      else setStatus(await request('', { email: email.trim() }));
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  if (!status?.prompt_required) return null;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="contact-email-heading" onCancel={event => { event.preventDefault(); skip(); }}>
    <h2 id="contact-email-heading">{status.pending_email ? 'Verify your contact email' : 'Where should we email you?'}</h2>
    <p>Apple keeps your personal email private. You can add a contact email for artists and studios you book with, or keep your Apple private email.</p>
    <p className={styles.hint}>This is optional. It won’t change Apple sign-in or subscribe you to marketing.</p>
    <form onSubmit={submit}>
      {status.pending_email ? <>
        <p>Enter the six-digit code sent to <strong className={styles.address}>{status.pending_email}</strong>.</p>
        <label>Verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} required disabled={busy} /></label>
      </> : <label>Contact email (optional)<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} /></label>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Please wait…' : status.pending_email ? 'Verify and save email' : 'Send verification code'}</button>
    </form>
    {status.pending_email && <button type="button" className={styles.secondary} disabled={busy} onClick={() => { setStatus({ ...status, pending_email: null }); setCode(''); setError(''); }}>Change email or resend code</button>}
    <button type="button" className={styles.secondary} disabled={busy} onClick={skip}>Keep Apple private email</button>
  </dialog>;
}
