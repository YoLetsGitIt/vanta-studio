'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Select } from '@/components/ui/Field';
import AudiencePicker from './AudiencePicker';
import EmailPreview from './EmailPreview';
import TestSendButton from './TestSendButton';
import { listMarketingTemplates, listMarketingRecipients, createMarketingCampaign } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import styles from './marketing.module.css';

function StepHead({ n, done, children }) {
  return (
    <div className={styles.stepHead}>
      <span className={`${styles.stepNum} ${done ? styles.stepNumDone : ''}`} aria-hidden="true">{done ? '✓' : n}</span>
      <h2 className={styles.cardTitle}>{children}{done && <span className="sr-only"> (done)</span>}</h2>
    </div>
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Compose a campaign: pick clients on the left, see the email they will get on the right. */
export default function Campaigns({ active = true, available, ready, preset, onSent, onNeedSetup, onEditTemplates }) {
  const [templates, setTemplates] = useState(null);
  const [templateId, setTemplateId] = useState(preset?.templateId || '');
  const [clients, setClients] = useState(null);
  const [clientsError, setClientsError] = useState('');
  const [selected, setSelected] = useState(() => new Set(preset?.clientIds || []));
  const [sending, setSending] = useState(false);
  const template = templates?.find(t => t.id === templateId);

  useEffect(() => { loadClients(); }, []);
  // Refresh saved templates when returning from the editor without losing selected clients.
  useEffect(() => {
    if (!active) return;
    let current = true;
    listMarketingTemplates().then(data => { if (current) setTemplates(data.templates); }).catch(err => { if (current) showError(err); });
    return () => { current = false; };
  }, [active]);
  // Filtering happens in the picker, so one fetch of everyone who can be emailed is enough.
  async function loadClients() {
    setClientsError('');
    try {
      const list = (await listMarketingRecipients('all')).clients;
      setClients(list);
      // A preset can name clients who have since unsubscribed or withdrawn consent.
      const kept = new Set(list.filter(c => selected.has(c.id)).map(c => c.id));
      const dropped = selected.size - kept.size;
      if (dropped > 0) showFeedback(`${plural(dropped, 'client')} can no longer be emailed and ${dropped === 1 ? 'was' : 'were'} left out.`, 'info');
      setSelected(kept);
    } catch (err) { setClientsError(err.message); }
  }

  async function send() {
    const ok = await requestConfirmation({
      title: 'Send campaign',
      message: `Send “${template.subject}” to ${plural(selected.size, 'client')}? This can’t be undone once emails start going out.`,
      confirmLabel: 'Send',
    });
    if (!ok) return;
    setSending(true);
    try {
      await createMarketingCampaign({ name: template.name, template_id: templateId, segment: { kind: 'selected', client_ids: [...selected] } });
      showFeedback('Campaign queued. Emails go out over the next few minutes.', 'success');
      setSelected(new Set());
      onSent?.();
    } catch (err) { showError(err); }
    finally { setSending(false); }
  }

  const canSend = available && ready && template && selected.size > 0;
  const firstClient = clients?.find(c => selected.has(c.id));
  const blocker = !available ? 'Sending isn’t switched on yet.'
    : !ready ? null
      : selected.size === 0 ? 'Tick at least one client.'
        : !template ? 'Choose a template.' : null;

  return (
    <div className={styles.compose}>
      <section className={styles.card} aria-label="Choose clients">
        <StepHead n="1" done={selected.size > 0}>Choose clients</StepHead>
        <AudiencePicker clients={clients} error={clientsError} onRetry={loadClients} selected={selected} onChange={setSelected} />
      </section>

      <aside className={`${styles.card} ${styles.aside}`} aria-label="Email and send">
        <StepHead n="2" done={Boolean(template)}>Choose the email</StepHead>
        {templates?.length === 0 ? (
          <p className={styles.empty}>You have no templates yet. <button type="button" className={styles.chip} onClick={onEditTemplates}>Write one</button></p>
        ) : (
          <Field label="Template">
            <Select value={templateId} disabled={!templates} onChange={e => setTemplateId(e.target.value)}>
              <option value="">{templates ? 'Choose a template' : 'Loading…'}</option>
              {templates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        )}
        {template && <>
          <EmailPreview subject={template.subject} body={template.body} clientName={firstClient?.name} />
          <p className={styles.hint}>
            {firstClient ? `Shown as ${firstClient.name} will see it.` : 'Shown with a sample name. Tick a client to see theirs.'}{' '}
            <button type="button" className={styles.link} onClick={onEditTemplates}>Edit templates</button>
          </p>
        </>}

        {available && !ready && (
          <p className={styles.hint}>Set up your sending email first. <button type="button" className={styles.chip} onClick={onNeedSetup}>Set it up</button></p>
        )}
        {blocker && <p className={styles.hint}>{blocker}</p>}
        <Button fullWidth onClick={send} loading={sending} loadingLabel="Sending…" disabled={!canSend}>
          {selected.size > 0 ? `Send to ${plural(selected.size, 'client')}` : 'Send campaign'}
        </Button>
        {template && <TestSendButton fullWidth variant="ghost" available={available} ready={ready} message={{ template_id: templateId }} />}
      </aside>
    </div>
  );
}
