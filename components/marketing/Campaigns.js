'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Textarea, Select } from '@/components/ui/Field';
import { getMarketingAudience, listMarketingCampaigns, createMarketingCampaign } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import styles from './marketing.module.css';

const SEGMENTS = [
  ['all', 'Everyone who agreed to marketing emails'],
  ['no_visit_days', 'Clients who haven’t had a tattoo in a while'],
  ['completed_within_days', 'Clients who had a tattoo recently'],
];

const STARTER = 'Hi {{client_name}},\n\nWrite your message here.\n\nThanks,\n{{studio_name}}';

function StepHead({ n, children }) {
  return <div className={styles.stepHead}><span className={styles.stepNum} aria-hidden="true">{n}</span><h3 className={styles.cardTitle}>{children}</h3></div>;
}

export default function Campaigns({ available, ready, onSent, onNeedSetup }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('all');
  const [days, setDays] = useState(90);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(STARTER);
  const [count, setCount] = useState(null);
  const [countError, setCountError] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [campaigns, setCampaigns] = useState(null);

  const needsDays = kind !== 'all';

  useEffect(() => { refresh(); }, []);
  async function refresh() {
    try { setCampaigns((await listMarketingCampaigns()).campaigns); } catch (err) { showError(err); }
  }

  useEffect(() => {
    let active = true;
    setCount(null); setCountError('');
    const timer = setTimeout(() => {
      getMarketingAudience(kind, needsDays ? days : undefined)
        .then(v => { if (active) setCount(v.count); })
        .catch(err => { if (active) setCountError(err.message); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, days, needsDays]);

  async function send() {
    const ok = await requestConfirmation({
      title: 'Send campaign',
      message: `Send “${subject}” to ${count} client${count === 1 ? '' : 's'}? This can’t be undone once emails start going out.`,
      confirmLabel: 'Send',
    });
    if (!ok) return;
    setSending(true);
    try {
      await createMarketingCampaign({ name, subject, body, segment: { kind, days: needsDays ? Number(days) : 0 } });
      showFeedback('Campaign queued. Emails go out over the next few minutes.', 'success');
      setName(''); setSubject(''); setBody(STARTER);
      await refresh();
      onSent?.();
    } catch (err) { showError(err); }
    finally { setSending(false); }
  }

  const canSend = available && ready && name.trim() && subject.trim() && body.trim() && count > 0;

  return (
    <>
      <section className={styles.card} aria-label="New campaign">
        <StepHead n="1">Who should get it?</StepHead>
        <div className={styles.row}>
          <Field label="Audience">
            <Select value={kind} onChange={e => setKind(e.target.value)}>
              {SEGMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          {needsDays && (
            <Field label={kind === 'no_visit_days' ? 'No visit in the last (days)' : 'Visited in the last (days)'}>
              <Input type="number" min={1} max={3650} value={days} onChange={e => setDays(e.target.value)} />
            </Field>
          )}
        </div>
        <p className={countError ? styles.error : styles.audience} role="status">
          {countError || (count === null ? 'Counting…' : `${count} client${count === 1 ? '' : 's'} will receive this`)}
        </p>

        <StepHead n="2">What should it say?</StepHead>
        <Field label="Subject"><Input value={subject} maxLength={200} onChange={e => setSubject(e.target.value)} /></Field>
        <Field label="Message" hint="Use {{client_name}} and {{studio_name}} to personalise. Leave a blank line between paragraphs.">
          <Textarea rows={8} value={body} maxLength={50000} onChange={e => setBody(e.target.value)} />
        </Field>
        <Field label="Campaign name" hint="Just for you, so you can find it later."><Input value={name} maxLength={200} onChange={e => setName(e.target.value)} /></Field>

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
                    {c.failed > 0 && <span className={`${styles.pill} ${styles.pillBad}`} style={{ marginRight: 6 }}>{c.failed} failed</span>}
                    <span className={`${styles.pill} ${c.status === 'sent' ? styles.pillOn : styles.pillBusy}`}>{c.status === 'sent' ? 'Sent' : `Sending · ${c.queued} left`}</span>
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
