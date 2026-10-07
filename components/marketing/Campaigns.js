'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Select } from '@/components/ui/Field';
import AudiencePicker from './AudiencePicker';
import EmailPreview from './EmailPreview';
import TestSendButton from './TestSendButton';
import { listMarketingTemplates, listMarketingRecipients, createMarketingCampaign } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import styles from './marketing.module.css';

function StepHead({ n, children }) {
  return <div className={styles.stepHead}><span className={styles.stepNum} aria-hidden="true">{n}</span><h2 className={styles.cardTitle}>{children}</h2></div>;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Compose a campaign: pick clients on the left, see the email they will get on the right. */
export default function Campaigns({ available, ready, preset, onSent, onNeedSetup, onEditTemplates }) {
  const [name, setName] = useState('');
  const [templates, setTemplates] = useState(null);
  const [templateId, setTemplateId] = useState(preset?.templateId || '');
  const [clients, setClients] = useState(null);
  const [clientsError, setClientsError] = useState('');
  const [selected, setSelected] = useState(() => new Set(preset?.clientIds || []));
  const [sending, setSending] = useState(false);
  const template = templates?.find(t => t.id === templateId);

  useEffect(() => { loadClients(); listMarketingTemplates().then(data => setTemplates(data.templates)).catch(showError); }, []);
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
      await createMarketingCampaign({ name: name.trim() || template.name, template_id: templateId, segment: { kind: 'selected', client_ids: [...selected] } });
      showFeedback('Campaign queued. Emails go out over the next few minutes.', 'success');
      setName('');
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
        <StepHead n="1">Who should get it?</StepHead>
        <p className={styles.hint}>Tick the clients to email. Filters only narrow the list, so your ticks stay put while you change them. Only clients with marketing consent are listed, and unsubscribed clients are left out.</p>
        <AudiencePicker clients={clients} error={clientsError} onRetry={loadClients} selected={selected} onChange={setSelected} />
      </section>

      <aside className={`${styles.card} ${styles.aside}`} aria-label="Email and send">
        <StepHead n="2">What are you sending?</StepHead>
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
          <Field label="Campaign name" hint="Only you see this. Defaults to the template name.">
            <Input value={name} maxLength={200} placeholder={template.name} onChange={e => setName(e.target.value)} />
          </Field>
        </>}

        <StepHead n="3">Send it</StepHead>
        {available && !ready && (
          <p className={styles.hint}>Set up your sending email first. <button type="button" className={styles.chip} onClick={onNeedSetup}>Set it up</button></p>
        )}
        {blocker && <p className={styles.hint}>{blocker}</p>}
        <Button fullWidth onClick={send} loading={sending} loadingLabel="Sending…" disabled={!canSend}>
          {selected.size > 0 ? `Send to ${plural(selected.size, 'client')}` : 'Send campaign'}
        </Button>
        <TestSendButton fullWidth available={available} ready={ready} disabled={!template} message={{ template_id: templateId }} />
      </aside>
    </div>
  );
}
