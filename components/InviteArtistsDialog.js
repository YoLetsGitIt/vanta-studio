'use client';

import { useEffect, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import { cancelArtistInvite, getArtistInvites, inviteArtist, resetArtistInviteLink } from '@/lib/api';

// Invite artists to the studio: share the studio code (typed into the app), or
// email an invite. Artists who join are connected straight away.
export default function InviteArtistsDialog({ studioName, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    getArtistInvites().then(setData).catch(e => setError(e.message));
  }, []);

  async function run(name, work) {
    setBusy(name); setError(''); setNotice(null);
    try { await work(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  function copy(text, key) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(current => (current === key ? '' : current)), 1800);
    });
  }

  async function send(event) {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    await run('send', async () => {
      setData(await inviteArtist(value));
      setEmail('');
      setNotice({ at: 'email', text: `Invite sent to ${value}.` });
    });
  }

  const code = data?.code || '';
  const pending = data?.pending || [];
  const name = studioName || 'your studio';
  const message = code && `Join ${name} on Vanta: in the Vanta app, tap Edit profile, then Join with a studio code, and enter ${code}. Get the app at vanta.tattoo`;

  return (
    <Dialog title="Invite artists" description={`Artists who join are connected to ${name} straight away. No approval needed.`} onClose={onClose} maxWidth={520}>
      {error && <p role="alert" style={st.error}>{error}</p>}

      <section style={st.section}>
        <h3 style={st.label}>Studio code</h3>
        <p style={st.help}>Artists enter it in the Vanta app: Edit profile, then Join with a studio code.</p>
        <div style={st.codeRow}>
          <div aria-label="Studio code" style={st.code}>{code || '···-···'}</div>
          <div style={st.codeActions}>
            <button type="button" disabled={!code} onClick={() => copy(code, 'code')} style={st.primary}>{copied === 'code' ? 'Copied' : 'Copy code'}</button>
            <button type="button" disabled={!code} onClick={() => copy(message, 'message')} style={st.secondary}>{copied === 'message' ? 'Copied' : 'Copy message'}</button>
          </div>
        </div>
        <button type="button" disabled={!code || Boolean(busy)} style={st.textButton}
          onClick={() => window.confirm('Get a new studio code? The current code will stop working. Artists already connected stay connected.') && run('reset', async () => { setData(await resetArtistInviteLink()); setNotice({ at: 'code', text: 'New studio code created. The old code no longer works.' }); })}>
          {busy === 'reset' ? 'Changing…' : 'Get a new code'}
        </button>
        {notice?.at === 'code' && <p role="status" style={st.notice}>{notice.text}</p>}
      </section>

      <section style={st.section}>
        <h3 style={st.label}>Invite by email</h3>
        <p style={st.help}>We’ll email them the code. If they don’t have Vanta yet, they’re connected automatically when they sign up as an artist with this email.</p>
        <form onSubmit={send} style={st.linkRow}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="artist@email.com" aria-label="Artist email" autoComplete="off" style={st.linkInput} />
          <button type="submit" disabled={!email.trim() || Boolean(busy)} style={st.primary}>{busy === 'send' ? 'Sending…' : 'Send'}</button>
        </form>
        {notice?.at === 'email' && <p role="status" style={st.notice}>{notice.text}</p>}
      </section>

      {pending.length > 0 && (
        <section style={st.section}>
          <h3 style={st.label}>Waiting to join ({pending.length})</h3>
          <ul style={st.list}>
            {pending.map(invite => (
              <li key={invite.id} style={st.item}>
                <div style={{ minWidth: 0 }}>
                  <div style={st.who}>{invite.email}</div>
                  <div style={st.meta}>{invite.send_error ? 'Email not sent: send them the studio code yourself' : `Sent ${new Date(invite.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}</div>
                </div>
                <button type="button" disabled={Boolean(busy)} onClick={() => run(invite.id, async () => setData(await cancelArtistInvite(invite.id)))} style={st.small}>Cancel</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Dialog>
  );
}

const st = {
  section: { marginTop: '1.25rem' },
  label: { margin: '0 0 0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  help: { margin: '0 0 0.75rem', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-muted)' },
  linkRow: { display: 'flex', gap: '0.5rem' },
  codeRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', padding: '0.85rem 1rem', borderRadius: 10, border: '1px solid var(--border-strong)' },
  code: { fontSize: '1.9rem', fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', userSelect: 'all' },
  secondary: { padding: '0.65rem 1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' },
  codeActions: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  linkInput: { flex: 1, minWidth: 0, padding: '0.65rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--bg-input, transparent)', color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'inherit' },
  primary: { padding: '0.65rem 1.1rem', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' },
  textButton: { marginTop: '0.5rem', padding: '0.4rem 0', minHeight: 32, border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline' },
  notice: { margin: '0.6rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' },
  error: { margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-danger)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid var(--border-faint)' },
  who: { fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  meta: { fontSize: '0.75rem', color: 'var(--text-ghost)', marginTop: 2 },
  small: { padding: '0.4rem 0.7rem', minHeight: 32, borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' },
};
