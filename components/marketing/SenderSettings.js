'use client';

import { useLanguage } from '@/lib/i18n';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Textarea, Select } from '@/components/ui/Field';
import {
  saveMarketingSettings, getMarketingDomain, addMarketingDomain, verifyMarketingDomain, removeMarketingDomain,
} from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import styles from './marketing.module.css';
import MailboxConnections from './MailboxConnections';

function statusBadge(status, mt) {
  if (status === 'verified') return <span className={`${styles.pill} ${styles.pillOn}`}>{mt('Verified')}</span>;
  if (status === 'failed' || status === 'temporary_failure') return <span className={`${styles.pill} ${styles.pillBad}`}>{mt('Needs attention')}</span>;
  return <span className={`${styles.pill} ${styles.pillBusy}`}>{mt('Waiting for DNS')}</span>;
}

export default function SenderSettings({ settings, available, domainAvailable = available, onSaved, onReload }) {
  const { t: mt } = useLanguage();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [domain, setDomain] = useState(null);
  const [busy, setBusy] = useState('');
  const [connections, setConnections] = useState([]);
  // The mailbox callback lands here with ?mailbox=, so open on that method even before it is saved.
  const [mode, setMode] = useState(() => (['gmail', 'outlook'].includes(settings.sender_provider) || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mailbox')) ? 'mailbox' : 'resend'));
  const mailbox = ['gmail', 'outlook'].includes(form.sender_provider);
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const set = patch => setForm(prev => ({ ...prev, ...patch }));

  useEffect(() => { setForm(settings); }, [settings]);

  // Picking the mailbox method selects the connected account, so there is nothing extra to choose with one account.
  useEffect(() => {
    if (mode === 'mailbox' && !mailbox && connections[0]) set({ sender_provider: connections[0].provider });
  }, [mode, mailbox, connections]);

  function choose(next) {
    setMode(next);
    if (next === 'resend') set({ sender_provider: 'resend' });
    else if (connections[0]) set({ sender_provider: connections[0].provider });
  }

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
      showFeedback(mt("Sender settings saved."), 'success');
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
    const ok = await requestConfirmation({ title: mt("Remove sending domain"), message: mt("Emails will go back to being sent “via Vanta”."), confirmLabel: mt("Remove"), danger: true });
    if (!ok) return;
    await removeMarketingDomain();
    setDomain(null);
    onSaved({ ...settings, domain: '', domain_status: '' });
  });

  const verified = settings.domain_status === 'verified';
  const savedMailbox = ['gmail', 'outlook'].includes(settings.sender_provider);
  const current = savedMailbox ? (settings.mailbox_email || null)
    : verified ? `${settings.from_local || 'hello'}@${settings.domain}`
      : settings.reply_to ? mt('Vanta’s shared address, with replies going to {email}', { email: settings.reply_to }) : null;
  const METHODS = [
    ['mailbox', 'Your Gmail or Outlook', 'Emails come from your own address. Best for small sends, up to 100 a day.'],
    ['resend', 'Your studio domain or Vanta', 'Send from your own domain once verified, or from Vanta’s address with replies going to you. Best for larger sends, with open and click tracking.'],
  ];
  return (
    <>
      <section className={styles.card} aria-labelledby="sender-method">
        <div className={styles.sectionHead}>
          <h2 className={styles.cardTitle} id="sender-method">{mt("How do you want to send?")}</h2>
          <span className={`${styles.pill} ${current ? styles.pillOn : ''}`}>{current ? mt("Ready to send") : mt("Not set up yet")}</span>
        </div>
        {current && <p className={styles.desc}>{mt("Emails currently send from")} <strong>{current}</strong>.</p>}
        <div className={styles.methods} role="radiogroup" aria-labelledby="sender-method">
          {METHODS.map(([id, title, text]) => (
            <button key={id} type="button" role="radio" aria-checked={mode === id} className={styles.method} onClick={() => choose(id)}>
              <span className={styles.methodTitle}>{mt(title)}</span>
              <span className={styles.rowSub}>{mt(text)}</span>
            </button>
          ))}
        </div>
      </section>

      {mode === 'mailbox' && <MailboxConnections onChanged={onReload} onConnections={setConnections} />}

      <section className={styles.card} aria-labelledby="sender-id">
        <div>
          <h2 className={styles.cardTitle} id="sender-id">{mt("Sender details")}</h2>
          <p className={styles.desc}>{mt("What clients see in their inbox, and where their replies go.")}</p>
        </div>
        {mode === 'mailbox' && (connections.length === 0
          ? <p className={styles.hint}>{mt("Connect an account above, then save.")}</p>
          : (
            <Field label={mt("Send from")}><Select value={mailbox ? form.sender_provider : ''} onChange={e => set({ sender_provider: e.target.value })}>
              {connections.map(c => <option key={c.provider} value={c.provider}>{c.provider === 'gmail' ? mt("Gmail") : mt("Outlook")} · {c.email}</option>)}
              {mailbox && !connections.some(c => c.provider === form.sender_provider) && <option value={form.sender_provider}>{form.sender_provider === 'gmail' ? mt("Gmail") : mt("Outlook")} {mt("· reconnect required")}</option>}
            </Select></Field>
          ))}
        <div className={styles.row}>
          <Field label={mt("Sender name")} hint={mt("Defaults to your studio name.")}><Input value={form.from_name} maxLength={100} onChange={e => set({ from_name: e.target.value })} /></Field>
          <Field label={mt("Reply-to email")} required={!mailbox} hint={mailbox ? mt("Optional. Replies go to your connected account when left blank.") : mt("Where client replies land.")}><Input type="email" value={form.reply_to} onChange={e => set({ reply_to: e.target.value })} /></Field>
        </div>
        <Field label={mt("Postal address for the email footer")} hint={mt("Shown at the bottom of every email. Recommended.")}>
          <Textarea rows={2} value={form.footer_address} maxLength={300} onChange={e => set({ footer_address: e.target.value })} />
        </Field>
        {verified && !mailbox && (
          <Field label={mt("Email address prefix")} hint={mt('Emails send from {email}.', { email: `${form.from_local || 'hello'}@${settings.domain}` })}>
            <Input value={form.from_local} placeholder={mt("hello")} maxLength={40} onChange={e => set({ from_local: e.target.value })} />
          </Field>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}><Button onClick={save} loading={saving} loadingLabel={mt("Saving…")} disabled={!dirty}>{mt("Save")}</Button></div>
      </section>

      {mode === 'resend' && <details className={styles.details} open={Boolean(settings.domain) && !verified}>
        <summary><span>{mt("Send from your own domain")} <span className={styles.rowSubInline}>{mt("(optional)")}</span> {settings.domain && statusBadge(settings.domain_status, mt)}</span></summary>
        <div className={styles.detailsBody}>
        <p className={styles.desc}>{mt("With a verified domain, emails send from")} {form.from_local || 'hello'}@{settings.domain || 'yourstudio.com'}{mt(". Add the DNS records at your domain provider to verify ownership. Without verification, emails use your studio name via Vanta, with replies sent to you. To send directly from Gmail or Outlook, connect your account above and choose it as your sending method.")}</p>
        {!settings.domain ? (
          <div className={styles.row}>
            <Field label={mt("Your domain")} hint={mt("For example yourstudio.com")}>
              <Input value={domainInput} placeholder={mt("yourstudio.com")} onChange={e => setDomainInput(e.target.value)} disabled={!domainAvailable} />
            </Field>
            <div style={{ alignSelf: 'end' }}>
              <Button onClick={addDomain} loading={busy === 'add'} disabled={!domainAvailable || !domainInput.trim()}>{mt("Add domain")}</Button>
            </div>
          </div>
        ) : <>
          <p className={styles.desc}><strong>{settings.domain}</strong></p>
          {domain?.records?.length > 0 && !verified && (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead><tr><th>{mt("Type")}</th><th>{mt("Name")}</th><th>{mt("Value")}</th><th>{mt("Status")}</th></tr></thead>
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
            {!verified && <Button onClick={verify} loading={busy === 'verify'}>{mt("Check DNS")}</Button>}
            <Button variant="ghost" onClick={remove} loading={busy === 'remove'}>{mt("Remove domain")}</Button>
          </div>
        </>}
        {!domainAvailable && <p className={styles.hint}>{mt("Domain sending is not available yet.")}</p>}
        </div>
      </details>}
    </>
  );
}
