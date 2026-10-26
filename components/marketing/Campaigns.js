'use client';

import { useLanguage } from '@/lib/i18n';

import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import AudiencePicker from './AudiencePicker';
import EmailPreview from './EmailPreview';
import TestSendButton from './TestSendButton';
import { listMarketingRecipients, createMarketingCampaign } from '@/lib/api';
import { requestConfirmation, showFeedback } from '@/lib/feedback';
import styles from './marketing.module.css';

function StepHead({ n, done, children }) {
  const { t: mt } = useLanguage();
  return (
    <div className={styles.stepHead}>
      <span className={`${styles.stepNum} ${done ? styles.stepNumDone : ''}`} aria-hidden="true">{done ? '✓' : n}</span>
      <h2 className={styles.cardTitle}>{children}{done && <span className="sr-only"> {mt("(done)")}</span>}</h2>
    </div>
  );
}

/** The second step of the template flow, retaining clients when returning to edit. */
export default function Campaigns({ template, available, ready, preset, onSent, onNeedSetup, onEditTemplates, onStartAgain }) {
  const { t: mt } = useLanguage();
  const [clients, setClients] = useState(null);
  const [clientsError, setClientsError] = useState('');
  const [selected, setSelected] = useState(() => new Set(preset?.clientIds || []));
  const [sending, setSending] = useState(false);
  const [queued, setQueued] = useState(null);
  const [sendError, setSendError] = useState('');
  const sendLock = useRef(false);

  useEffect(() => { loadClients(); }, []);
  // Filtering happens in the picker, so one fetch of everyone who can be emailed is enough.
  async function loadClients() {
    setClientsError('');
    try {
      const list = (await listMarketingRecipients('all')).clients;
      setClients(list);
      // A preset can name clients who have since unsubscribed or withdrawn consent.
      const kept = new Set(list.filter(c => selected.has(c.id)).map(c => c.id));
      const dropped = selected.size - kept.size;
      if (dropped > 0) showFeedback(mt(dropped === 1 ? '{count} client can no longer be emailed and was left out.' : '{count} clients can no longer be emailed and were left out.', { count: dropped }), 'info');
      setSelected(kept);
    } catch (err) { setClientsError(err.message); }
  }

  async function send() {
    if (!canSend || sendLock.current || queued) return;
    sendLock.current = true;
    const ok = await requestConfirmation({
      title: mt("Send campaign"),
      message: mt(selected.size === 1 ? 'Send “{subject}” to {count} client? This can’t be undone once emails start going out.' : 'Send “{subject}” to {count} clients? This can’t be undone once emails start going out.', { subject: template.subject, count: selected.size }),
      confirmLabel: mt("Send"),
    });
    if (!ok) { sendLock.current = false; return; }
    setSending(true);
    setSendError('');
    try {
      await createMarketingCampaign({ name: template.name, template_id: template.id, segment: { kind: 'selected', client_ids: [...selected] } });
      setQueued({ subject: template.subject, count: selected.size });
      onSent?.();
    } catch (err) { setSendError(err.message); }
    finally { setSending(false); sendLock.current = false; }
  }

  const canSend = available && ready && template && selected.size > 0 && !clientsError && clients !== null;
  const firstClient = clients?.find(c => selected.has(c.id));
  const blocker = !available ? 'Sending isn’t switched on yet.'
    : !ready ? null
      : selected.size === 0 ? 'Tick at least one client.'
        : null;

  if (queued) return (
    <section className={`${styles.card} ${styles.blank}`}>
      <h2 className={styles.cardTitle}>{mt("Emails queued")}</h2>
      <p className={styles.desc} role="status">{mt(queued.count === 1 ? '“{subject}” is queued for {count} client.' : '“{subject}” is queued for {count} clients.', { subject: queued.subject, count: queued.count })}</p>
      <p className={styles.hint}>{mt("Emails go out over the next few minutes. Your template is saved for next time.")}</p>
      <Button onClick={onStartAgain}>{mt("Create another email")}</Button>
    </section>
  );

  return (
    <div className={styles.compose}>
      <section className={styles.card} aria-label={mt("Choose clients")}>
        <StepHead n="2" done={selected.size > 0}>{mt("Choose clients")}</StepHead>
        <fieldset disabled={sending} className={styles.audienceFields}>
          <AudiencePicker clients={clients} error={clientsError} onRetry={loadClients} selected={selected} onChange={setSelected} />
        </fieldset>
      </section>

      <aside className={`${styles.card} ${styles.aside}`} aria-label={mt("Email and send")}>
        <div className={styles.sectionHead}>
          <h2 className={styles.cardTitle}>{mt("Review and send")}</h2>
          <Button size="sm" variant="secondary" disabled={sending} onClick={onEditTemplates}>{mt("Back to template")}</Button>
        </div>
        {template && <>
          <EmailPreview subject={template.subject} body={template.body} clientName={firstClient?.name} clientId={firstClient?.id} />
          <p className={styles.hint}>
            {firstClient ? mt('Shown as {name} will see it.', { name: firstClient.name }) : mt("Shown with sample client details. Tick a client to see theirs.")}{' '}
          </p>
        </>}

        {available && !ready && (
          <p className={styles.hint}>{mt("Set up your sending email first.")} <button type="button" className={styles.chip} onClick={onNeedSetup}>{mt("Set it up")}</button></p>
        )}
        {blocker && <p className={styles.hint}>{mt(blocker)}</p>}
        {sendError && <p className={styles.error} role="alert">{sendError}</p>}
        <Button fullWidth onClick={send} loading={sending} loadingLabel={mt("Sending…")} disabled={!canSend}>
          {selected.size > 0 ? mt(selected.size === 1 ? 'Send to {count} client' : 'Send to {count} clients', { count: selected.size }) : mt("Send campaign")}
        </Button>
        {template && <TestSendButton fullWidth variant="ghost" available={available} ready={ready} disabled={sending} message={{ template_id: template.id }} />}
      </aside>
    </div>
  );
}
