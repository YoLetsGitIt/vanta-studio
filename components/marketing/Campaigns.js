'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';
import { listMarketingTemplates, listMarketingRecipients, listMarketingCampaigns, createMarketingCampaign } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import styles from './marketing.module.css';

const SEGMENTS = [
  ['all', 'Everyone who agreed to marketing emails'],
  ['no_visit_days', 'Clients who haven’t had a tattoo in a while'],
  ['completed_within_days', 'Clients who had a tattoo recently'],
  ['new_clients', 'Recently added clients'],
  ['never_visited', 'Clients with no completed tattoo'],
  ['repeat_clients', 'Repeat clients (2+ completed tattoos)'],
  ['upcoming_days', 'Clients with an upcoming appointment'],
];



function StepHead({ n, children }) {
  return <div className={styles.stepHead}><span className={styles.stepNum} aria-hidden="true">{n}</span><h3 className={styles.cardTitle}>{children}</h3></div>;
}

export default function Campaigns({ available, ready, onSent, onNeedSetup }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('all');
  const [days, setDays] = useState(90);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const template = templates.find(t => t.id === templateId);
  const subject = template?.subject || '';
  const body = template?.body || '';
  const [count, setCount] = useState(null);
  const [countError, setCountError] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [campaigns, setCampaigns] = useState(null);

  const needsDays = ['no_visit_days', 'completed_within_days', 'new_clients', 'upcoming_days'].includes(kind);

  useEffect(() => { refresh(); listMarketingTemplates().then(data => setTemplates(data.templates)).catch(showError); }, []);
  async function refresh() {
    try { setCampaigns((await listMarketingCampaigns()).campaigns); } catch (err) { showError(err); }
  }

  useEffect(() => {
    let active = true;
    setCount(null); setRecipients([]); setSelected([]); setCountError('');
    const timer = setTimeout(() => {
      listMarketingRecipients(kind, needsDays ? days : undefined)
        .then(v => { if (active) { setCount(v.clients.length); setRecipients(v.clients); setSelected(v.clients.map(c => c.id)); } })
        .catch(err => { if (active) setCountError(err.message); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, days, needsDays]);

  async function send() {
    const ok = await requestConfirmation({
      title: 'Send campaign',
      message: `Send “${subject}” to ${selected.length} client${selected.length === 1 ? '' : 's'}? This can’t be undone once emails start going out.`,
      confirmLabel: 'Send',
    });
    if (!ok) return;
    setSending(true);
    try {
      await createMarketingCampaign({ name: name.trim() || template.name, template_id: templateId, segment: { kind: 'selected', client_ids: selected } });
      showFeedback('Campaign queued. Emails go out over the next few minutes.', 'success');
      setName('');
      await refresh();
      onSent?.();
    } catch (err) { showError(err); }
    finally { setSending(false); }
  }

  const canSend = available && ready && template && selected.length > 0 && count !== null && !countError;

  return (
    <>
      <section className={styles.card} aria-label="New campaign">
        <StepHead n="1">Who should get it?</StepHead>
        <div className={styles.row}>
          <Field label="Audience">
            <Select value={kind} onChange={e => { setCount(null); setSelected([]); setKind(e.target.value); setDays(e.target.value === 'no_visit_days' ? 90 : 30); }}>
              {SEGMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          {needsDays && (
            <Field label={({ no_visit_days: 'No visit in the last (days)', completed_within_days: 'Tattoo in the last (days)', new_clients: 'Added in the last (days)', upcoming_days: 'Appointment in the next (days)' })[kind]}>
              <Input type="number" min={1} max={3650} value={days} onChange={e => { setCount(null); setSelected([]); setDays(e.target.value); }} />
            </Field>
          )}
        </div>
        <p className={countError ? styles.error : styles.audience} role="status">
          {countError || (count === null ? 'Counting…' : `${selected.length} of ${count} eligible clients selected`)}
        </p>

        {recipients.length > 0 && <>
          <Field label="Find clients"><Input value={search} placeholder="Search name or email" onChange={e => setSearch(e.target.value)} /></Field>
          <div className={styles.actions}>
            <Button size="sm" variant="secondary" onClick={() => setSelected(recipients.map(c => c.id))}>Select all {recipients.length}</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear selection</Button>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {recipients.filter(c => `${c.name} ${c.email}`.toLowerCase().includes(search.toLowerCase())).map(c => (
              <label key={c.id} className={styles.listRow} style={{ justifyContent: 'flex-start', gap: 12 }}>
                <input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))} />
                <span>{c.name}<span className={styles.rowSub}>{c.email}</span></span>
              </label>
            ))}
          </div>
        </>}
        <p className={styles.hint}>Only clients with marketing consent are listed. Unsubscribed clients are excluded.</p>
        <StepHead n="2">Choose a saved template</StepHead>
        <Field label="Email template"><Select value={templateId} onChange={e => setTemplateId(e.target.value)}>
          <option value="">Choose a template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select></Field>
        {templates.length === 0 && <p className={styles.hint}>Create a template in the Templates tab first.</p>}
        {template && <p className={styles.desc}><strong>Subject:</strong> {subject}</p>}
        <Field label="Campaign name" hint="Optional. Defaults to the template name."><Input value={name} maxLength={200} onChange={e => setName(e.target.value)} /></Field>

        <StepHead n="3">Send it</StepHead>
        {!available && <p className={styles.hint}>Sending isn’t switched on yet.</p>}
        {available && !ready && (
          <p className={styles.hint}>Add a reply-to email first. <button type="button" className={styles.chip} onClick={onNeedSetup}>Set it up</button></p>
        )}
        <div className={styles.actions}>
          <Button onClick={send} loading={sending} loadingLabel="Sending…" disabled={!canSend}>Send campaign</Button>
          <Button variant="secondary" onClick={() => setPreview(true)} disabled={!body.trim()}>Preview</Button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="campaign-history">
        <h2 className={styles.cardTitle} id="campaign-history">Past campaigns</h2>
        {campaigns?.some(c => c.unknown > 0) && <p className={styles.hint}>Some send outcomes are unknown. Check your connected mailbox’s Sent folder before resending those messages.</p>}
        {campaigns === null ? <p className={styles.muted} role="status">Loading…</p>
          : campaigns.length === 0 ? <p className={styles.muted}>No campaigns yet.</p> : (
            <ul className={styles.list}>
              {campaigns.map(c => (
                <li key={c.id} className={styles.listRow}>
                  <span>{c.name}
                    <span className={styles.rowSub}>
                      {new Date(c.created_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })} · {c.recipient_count} recipients · {c.delivered} delivered · {c.opened} opened · {c.clicked} clicked
                    </span></span>
                  <span>
                    {c.unknown > 0 && <span className={`${styles.pill} ${styles.pillBad}`} style={{ marginRight: 6 }}>{c.unknown} need review</span>}
                    {c.failed > 0 && <span className={`${styles.pill} ${styles.pillBad}`} style={{ marginRight: 6 }}>{c.failed} failed</span>}
                    <span className={`${styles.pill} ${c.status === 'sent' ? styles.pillOn : styles.pillBusy}`}>{c.status === 'sent' ? 'Sent' : c.status === 'needs_review' ? 'Check Sent mail' : c.status === 'finished_with_errors' ? 'Finished with errors' : `Sending · ${c.queued} left`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
      </section>
      {preview && <PreviewDialog subject={subject} body={body} onClose={() => setPreview(false)} />}
    </>
  );
}
