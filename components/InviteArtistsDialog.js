'use client';

import { useEffect, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import { cancelArtistInvite, getArtistInvites, inviteArtist, resetArtistInviteLink } from '@/lib/api';

const looksLikeEmail = value => value.includes('@');

// Invite artists to the studio: share one link, or send an invite to an email
// or mobile number. Artists who accept are connected straight away.
export default function InviteArtistsDialog({ studioName, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getArtistInvites().then(setData).catch(e => setError(e.message));
  }, []);

  async function run(name, work) {
    setBusy(name); setError(''); setNotice('');
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
    const value = contact.trim();
    if (!value) return;
    await run('send', async () => {
      const next = await inviteArtist(looksLikeEmail(value) ? { email: value } : { phone: value });
      setData(next);
      setContact('');
      const sent = next.pending?.[0];
      setNotice(sent?.send_error ? `Invite saved. ${sent.send_error}.` : `Invite sent to ${value}.`);
    });
  }

  const link = data?.link_url || '';
  const pending = data?.pending || [];
  const name = studioName || 'your studio';

  return (
    <Dialog title="Invite artists" description={`Artists who accept are connected to ${name} straight away. No approval needed.`} onClose={onClose} maxWidth={520}>
      {error && <p role="alert" style={st.error}>{error}</p>}

      <section style={st.section}>
        <h3 style={st.label}>Invite link</h3>
        <p style={st.help}>Send this link to your artists by text, email or group chat. They sign in to their Vanta artist account and tap Join.</p>
        <div style={st.linkRow}>
          <input readOnly value={link || 'Loading…'} aria-label="Invite link" style={st.linkInput} onFocus={e => e.target.select()} />
          <button type="button" disabled={!link} onClick={() => copy(link, 'link')} style={st.primary}>{copied === 'link' ? 'Copied' : 'Copy'}</button>
        </div>
        <button type="button" disabled={!link || Boolean(busy)} style={st.textButton}
          onClick={() => window.confirm('Reset the invite link? The current link will stop working.') && run('reset', async () => { setData(await resetArtistInviteLink()); setNotice('New invite link created. The old link no longer works.'); })}>
          {busy === 'reset' ? 'Resetting…' : 'Reset link'}
        </button>
      </section>

      <section style={st.section}>
        <h3 style={st.label}>Invite by email or mobile</h3>
        <p style={st.help}>We’ll send them the link. If they don’t have Vanta yet, they’re connected automatically when they sign up as an artist with this email or number.</p>
        <form onSubmit={send} style={st.linkRow}>
          <input value={contact} onChange={e => setContact(e.target.value)} placeholder="artist@email.com or 0412 345 678" aria-label="Artist email or mobile number" autoComplete="off" style={st.linkInput} />
          <button type="submit" disabled={!contact.trim() || Boolean(busy)} style={st.primary}>{busy === 'send' ? 'Sending…' : 'Send'}</button>
        </form>
        {notice && <p role="status" style={st.notice}>{notice}</p>}
      </section>

      {pending.length > 0 && (
        <section style={st.section}>
          <h3 style={st.label}>Waiting to join ({pending.length})</h3>
          <ul style={st.list}>
            {pending.map(invite => {
              const who = invite.email || invite.phone;
              const url = link ? link.replace(/[^/]+$/, invite.code) : '';
              return (
                <li key={invite.id} style={st.item}>
                  <div style={{ minWidth: 0 }}>
                    <div style={st.who}>{who}</div>
                    <div style={st.meta}>{invite.send_error ? 'Not sent: copy the link and send it yourself' : `Sent ${new Date(invite.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    {url && <button type="button" onClick={() => copy(url, invite.id)} style={st.small}>{copied === invite.id ? 'Copied' : 'Copy link'}</button>}
                    <button type="button" disabled={Boolean(busy)} onClick={() => run(invite.id, async () => setData(await cancelArtistInvite(invite.id)))} style={st.small}>Cancel</button>
                  </div>
                </li>
              );
            })}
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
