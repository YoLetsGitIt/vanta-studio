'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';
import AudiencePicker from './AudiencePicker';
import { listMarketingTemplates, listMarketingRecipients, listMarketingCampaigns, createMarketingCampaign } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import styles from './marketing.module.css';

function StepHead({ n, children }) {
  return <div className={styles.stepHead}><span className={styles.stepNum} aria-hidden="true">{n}</span><h3 className={styles.cardTitle}>{children}</h3></div>;
}

export default function Campaigns({ available, ready, onSent, onNeedSetup }) {
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [clients, setClients] = useState(null);
  const [clientsError, setClientsError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const template = templates.find(t => t.id === templateId);
  const subject = template?.subject || '';
  const body = template?.body || '';
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [campaigns, setCampaigns] = useState(null);

  useEffect(() => { refresh(); loadClients(); listMarketingTemplates().then(data => setTemplates(data.templates)).catch(showError); }, []);
  async function refresh() {
    try { setCampaigns((await listMarketingCampaigns()).campaigns); } catch (err) { showError(err); }
  }
  // Filtering happens in the picker, so one fetch of everyone who can be emailed is enough.
  async function loadClients() {
    setClientsError('');
    try {
      const list = (await listMarketingRecipients('all')).clients;
      setClients(list);
      setSelected(prev => new Set(list.filter(c => prev.has(c.id)).map(c => c.id)));
    } catch (err) { setClientsError(err.message); }
  }

  async function send() {
    const ok = await requestConfirmation({
      title: 'Send campaign',
      message: `Send “${subject}” to ${selected.size} client${selected.size === 1 ? '' : 's'}? This can’t be undone once emails start going out.`,
      confirmLabel: 'Send',
    });
    if (!ok) return;
    setSending(true);
    try {
      await createMarketingCampaign({ name: name.trim() || template.name, template_id: templateId, segment: { kind: 'selected', client_ids: [...selected] } });
      showFeedback('Campaign queued. Emails go out over the next few minutes.', 'success');
      setName('');
      setSelected(new Set());
      await refresh();
      onSent?.();
    } catch (err) { showError(err); }
    finally { setSending(false); }
  }

  const canSend = available && ready && template && selected.size > 0;

  return (
    <>
      <section className={styles.card} aria-label="New campaign">
        <StepHead n="1">Who should get it?</StepHead>
        <p className={styles.hint}>Tick the clients to email. Filters only narrow the list, so your ticks stay put while you change them. Only clients with marketing consent are listed, and unsubscribed clients are left out.</p>
        <AudiencePicker clients={clients} error={clientsError} onRetry={loadClients} selected={selected} onChange={setSelected} />

        <StepHead n="2">Choose a saved template</StepHead>
        <Field label="Email template"><Select value={templateId} onChange={e => setTemplateId(e.target.value)}>
          <option value="">Choose a template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select></Field>
        {templates.length === 0 && <p className={styles.hint}>Create a template in the Templates tab first.</p>}
        {template && <p className={styles.desc}><strong>Subject:</strong> {subject}</p>}
        <Field label="Campaign name" hint="Optional. Defaults to the template name."><Input value={name} maxLength={200} onChange={e => setName(e.target.value)} /></Field>

        <StepHead n="3">Send it</StepHead>
        {!available && <p className={styles.hint}>Sending isn’t switched on yet.</p>}
        {available && ready && selected.size === 0 && <p className={styles.hint}>Tick at least one client in step 1.</p>}
        {available && ready && selected.size > 0 && !template && <p className={styles.hint}>Choose a template in step 2.</p>}
        {available && !ready && (
          <p className={styles.hint}>Add a reply-to email first. <button type="button" className={styles.chip} onClick={onNeedSetup}>Set it up</button></p>
        )}
        <div className={styles.actions}>
          <Button onClick={send} loading={sending} loadingLabel="Sending…" disabled={!canSend}>{selected.size > 0 ? `Send to ${selected.size} client${selected.size === 1 ? '' : 's'}` : 'Send campaign'}</Button>
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
