'use client';

import { useLanguage } from '@/lib/i18n';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { connectMarketingMailbox, disconnectMarketingMailbox, getMarketingMailboxes } from '@/lib/api';
import { requestConfirmation, showFeedback } from '@/lib/feedback';
import styles from './marketing.module.css';

export default function MailboxConnections({ onChanged, onConnections }) {
  const { t: mt } = useLanguage();
 const [data, setData] = useState(null);
 const [busy, setBusy] = useState('');
 const [error, setError] = useState('');
 async function load() {
  const next = await getMarketingMailboxes(); setData(next); onConnections(next.connections); setError('');
 }
 useEffect(() => {
  let active = true;
  getMarketingMailboxes().then(next => { if (active) { setData(next); onConnections(next.connections); } }).catch(err => { if (active) setError(err.message); });
  const result = new URLSearchParams(window.location.search).get('mailbox');
  if (result) {
   showFeedback(result === 'connected' ? 'Mailbox connected. Choose it as your sending method and save.' : result === 'cancelled' ? 'Mailbox connection cancelled.' : 'The mailbox could not be connected. Try again and approve email sending.', result === 'connected' ? 'success' : 'error');
   const url = new URL(window.location.href); url.searchParams.delete('mailbox'); window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return () => { active = false; };
 }, []);
 async function connect(provider) {
  setBusy(provider); setError('');
  try { const result = await connectMarketingMailbox(provider); window.location.assign(result.url); }
  catch (err) { setError(err.message); setBusy(''); }
 }
 async function disconnect(provider, email) {
  if (!await requestConfirmation({ title: mt("Disconnect mailbox"), message: mt('Stop sending from {email}? Queued emails using this connection will stop. Choose another sending method or reconnect before sending again.', { email }), confirmLabel: mt("Disconnect"), danger: true })) return;
  setBusy(provider); setError('');
  try { await disconnectMarketingMailbox(provider); await load(); onChanged(); showFeedback(mt("Mailbox disconnected."), 'success'); }
  catch (err) { setError(err.message); } finally { setBusy(''); }
 }
 return <section className={styles.card} aria-labelledby="mailbox-connections">
  <h2 className={styles.cardTitle} id="mailbox-connections">{mt("Connect an email account")}</h2>
  <p className={styles.desc}>{mt("Send from your Gmail, Google Workspace, Outlook, or Microsoft 365 account. Sign in with your email provider and approve sending.")}</p>
  <p className={styles.hint}>{mt("Connected mailboxes send up to 100 emails per 24 hours through Vanta; remaining emails wait in the queue. Your provider’s limits also apply. A verified studio domain is better suited to larger campaigns. Connected mailboxes show submission status rather than delivery, open, or click statistics.")}</p>
  {error && <p className={styles.error} role="alert">{error}</p>}
  {!data && !error && <p role="status">{mt("Loading email connections…")}</p>}
  {data && ['gmail', 'outlook'].map(provider => {
   const connection = data.connections.find(c => c.provider === provider);
   const label = provider === 'gmail' ? mt("Gmail") : mt("Outlook");
   return <div key={provider} className={styles.listRow}>
    <span><strong>{label}</strong><span className={styles.rowSub}>{connection?.email || (data.providers[provider] ? mt("No account connected") : mt("Connection is not available yet"))}</span></span>
    <div className={styles.actions}>
     <Button size="sm" variant="secondary" disabled={!data.providers[provider] || Boolean(busy)} loading={busy === provider} onClick={() => connect(provider)}>{connection ? mt("Reconnect") : mt('Connect {provider}', { provider: label })}</Button>
     {connection && <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => disconnect(provider, connection.email)}>{mt("Disconnect")}</Button>}
    </div>
   </div>;
  })}
 </section>;
}
