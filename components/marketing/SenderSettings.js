'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Textarea, Select } from '@/components/ui/Field';
import {
  saveMarketingSettings, getMarketingDomain, addMarketingDomain, verifyMarketingDomain, removeMarketingDomain,
} from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import styles from './marketing.module.css';
import MailboxConnections from './MailboxConnections';

function statusBadge(status) {
  if (status === 'verified') return <span className={`${styles.pill} ${styles.pillOn}`}>Verified</span>;
  if (status === 'failed' || status === 'temporary_failure') return <span className={`${styles.pill} ${styles.pillBad}`}>Needs attention</span>;
  return <span className={`${styles.pill} ${styles.pillBusy}`}>Waiting for DNS</span>;
}

export default function SenderSettings({ settings, available, domainAvailable = available, onSaved, onReload }) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [domain, setDomain] = useState(null);
  const [busy, setBusy] = useState('');
  const [connections, setConnections] = useState([]);
  const mailbox = ['gmail', 'outlook'].includes(form.sender_provider);
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const set = patch => setForm(prev => ({ ...prev, ...patch }));

  useEffect(() => { setForm(settings); }, [settings]);

  useEffect(() => {
    if (!settings.domain || !domainAvailable) return;
    let active = true;
    getMarketingDomain().then(d => { if (active) { setDomain(d); if (d.status !== settings.domain_status) onReload?.(); } }).catch(() => {});
    return () => { active = false; };
  }, [settings.domain, domainAvailable]);

  async function save() {
    setSaving(true); setError('');
    try {
      const res = await saveMarketingSettings(form);
      showFeedback('Sender settings saved.', 'success');
      onSaved(res.settings);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function run(name, fn) {
    setBusy(name);
    try { await fn(); } catch (err) { showError(err); } finally { setBusy(''); }
  }

  const addDomain = () => run('add', async () => {
    const d = await addMarketingDomain(domainInput);
    setDomain(d); setDomainInput('');
    onSaved({ ...settings, domain: d.domain, domain_status: d.status });
  });
  const verify = () => run('verify', async () => {
    const d = await verifyMarketingDomain();
    setDomain(d);
    onSaved({ ...settings, domain: d.domain, domain_status: d.status });
    showFeedback(d.status === 'verified' ? 'Domain verified.' : 'Not verified yet. DNS changes can take a while to spread.', d.status === 'verified' ? 'success' : 'error');
  });
  const remove = () => run('remove', async () => {
    const ok = await requestConfirmation({ title: 'Remove sending domain', message: 'Emails will go back to being sent “via Vanta”.', confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    await removeMarketingDomain();
    setDomain(null);
    onSaved({ ...settings, domain: '', domain_status: '' });
  });

  const verified = settings.domain_status === 'verified';
  return (
    <>
      <MailboxConnections onChanged={onReload} onConnections={setConnections} />
      <section className={styles.card} aria-labelledby="sender-id">
        <div>
          <h2 className={styles.cardTitle} id="sender-id">Who emails come from</h2>
          <p className={styles.desc}>Choose a connected mailbox or send through your studio’s verified domain. Save your sending method before sending.</p>
        </div>
        <Field label="Sending method"><Select value={form.sender_provider || 'resend'} onChange={e => set({ sender_provider: e.target.value })}>
          <option value="resend">Studio domain or Vanta sender</option>
          {connections.map(c => <option key={c.provider} value={c.provider}>{c.provider === 'gmail' ? 'Gmail' : 'Outlook'} · {c.email}</option>)}
          {mailbox && !connections.some(c => c.provider === form.sender_provider) && <option value={form.sender_provider}>{form.sender_provider === 'gmail' ? 'Gmail' : 'Outlook'} · reconnect required</option>}
        </Select></Field>
        {mailbox && <p className={styles.hint}>Emails send from {connections.find(c => c.provider === form.sender_provider)?.email || 'the connected account once reconnected'}.</p>}
        <div className={styles.row}>
          <Field label="Sender name" hint="Defaults to your studio name."><Input value={form.from_name} maxLength={100} onChange={e => set({ from_name: e.target.value })} /></Field>
          <Field label="Reply-to email" required={!mailbox} hint={mailbox ? "Optional. Replies go to your connected account when left blank." : "Where client replies land."}><Input type="email" value={form.reply_to} onChange={e => set({ reply_to: e.target.value })} /></Field>
        </div>
        <Field label="Postal address for the email footer" hint="Shown at the bottom of every email. Recommended.">
          <Textarea rows={2} value={form.footer_address} maxLength={300} onChange={e => set({ footer_address: e.target.value })} />
        </Field>
        {verified && !mailbox && (
          <Field label="Email address prefix" hint={`Emails send from ${form.from_local || 'hello'}@${settings.domain}.`}>
            <Input value={form.from_local} placeholder="hello" maxLength={40} onChange={e => set({ from_local: e.target.value })} />
          </Field>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}><Button onClick={save} loading={saving} loadingLabel="Saving…" disabled={!dirty}>Save</Button></div>
      </section>

      <details className={styles.details} open>
        <summary><span>Send from your studio email {settings.domain && statusBadge(settings.domain_status)}</span></summary>
        <div className={styles.detailsBody}>
        <p className={styles.desc}>With a verified domain, emails send from {form.from_local || 'hello'}@{settings.domain || 'yourstudio.com'}. Add the DNS records at your domain provider to verify ownership. Without verification, emails use your studio name via Vanta, with replies sent to you. To send directly from Gmail or Outlook, connect your account above and choose it as your sending method.</p>
        {!settings.domain ? (
          <div className={styles.row}>
            <Field label="Your domain" hint="For example yourstudio.com">
              <Input value={domainInput} placeholder="yourstudio.com" onChange={e => setDomainInput(e.target.value)} disabled={!domainAvailable} />
            </Field>
            <div style={{ alignSelf: 'end' }}>
              <Button onClick={addDomain} loading={busy === 'add'} disabled={!domainAvailable || !domainInput.trim()}>Add domain</Button>
            </div>
          </div>
        ) : <>
          <p className={styles.desc}><strong>{settings.domain}</strong></p>
          {domain?.records?.length > 0 && !verified && (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead><tr><th>Type</th><th>Name</th><th>Value</th><th>Status</th></tr></thead>
                <tbody>
                  {domain.records.map((r, i) => (
                    <tr key={`${r.name}-${i}`}>
                      <td>{r.type}</td><td className={styles.mono}>{r.name}</td><td className={styles.mono}>{r.priority != null ? `${r.priority} ` : ''}{r.value}</td>
                      <td>{r.status === 'verified' ? '✓' : '…'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className={styles.actions}>
            {!verified && <Button onClick={verify} loading={busy === 'verify'}>Check DNS</Button>}
            <Button variant="ghost" onClick={remove} loading={busy === 'remove'}>Remove domain</Button>
          </div>
        </>}
        {!domainAvailable && <p className={styles.hint}>Domain sending is not available yet.</p>}
        </div>
      </details>
    </>
  );
}
