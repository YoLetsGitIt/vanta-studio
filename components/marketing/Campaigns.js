'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Textarea, Select } from '@/components/ui/Field';
import { getMarketingAudience, listMarketingCampaigns, createMarketingCampaign } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import styles from './marketing.module.css';

const SEGMENTS = [
  ['all', 'All clients who agreed to marketing emails'],
  ['no_visit_days', 'Haven’t had a tattoo in a while'],
  ['completed_within_days', 'Had a tattoo recently'],
];

const STARTER = 'Hi {{client_name}},\n\nWrite your message here.\n\nThanks,\n{{studio_name}}';

export default function Campaigns({ available, ready, onSent }) {
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
      <section className={styles.card} aria-labelledby="campaign-new">
        <div>
          <h2 className={styles.cardTitle} id="campaign-new">New campaign</h2>
          <p className={styles.desc}>Send a one-off email to clients who agreed to marketing emails. Everyone gets an unsubscribe link automatically.</p>
        </div>
        <div className={styles.row}>
          <Field label="Campaign name" hint="Only you see this."><Input value={name} maxLength={200} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Who should receive it?">
            <Select value={kind} onChange={e => setKind(e.target.value)}>
              {SEGMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          {needsDays && (
            <Field label={kind === 'no_visit_days' ? 'No visit in the last (days)' : 'Visited within the last (days)'}>
              <Input type="number" min={1} max={3650} value={days} onChange={e => setDays(e.target.value)} />
            </Field>
          )}
        </div>
        <p className={countError ? styles.error : styles.muted} role="status">
          {countError || (count === null ? 'Counting…' : `${count} client${count === 1 ? '' : 's'} will receive this.`)}
        </p>
        <Field label="Subject"><Input value={subject} maxLength={200} onChange={e => setSubject(e.target.value)} /></Field>
        <Field label="Message" hint="Placeholders: {{client_name}}  {{studio_name}}. Separate paragraphs with a blank line.">
          <Textarea rows={10} value={body} maxLength={50000} onChange={e => setBody(e.target.value)} />
        </Field>
        {!available && <p className={styles.hint}>Email sending isn’t switched on yet.</p>}
        {available && !ready && <p className={styles.hint}>Add a reply-to email in the Sender tab before sending.</p>}
        <div className={styles.actions}>
          <Button onClick={send} loading={sending} loadingLabel="Sending…" disabled={!canSend}>Send campaign</Button>
          <Button variant="secondary" onClick={() => setPreview(true)} disabled={!body.trim()}>Preview</Button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="campaign-history">
        <h2 className={styles.cardTitle} id="campaign-history">Past campaigns</h2>
        {campaigns === null ? <p className={styles.muted} role="status">Loading…</p>
          : campaigns.length === 0 ? <p className={styles.muted}>No campaigns yet.</p> : (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead><tr><th>Campaign</th><th>Status</th><th>Recipients</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th>Failed</th></tr></thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id}>
                      <td>{c.name}<div className={styles.muted}>{new Date(c.created_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}</div></td>
                      <td><span className={`${styles.badge} ${c.status === 'sent' ? styles.badgeOk : styles.badgeWarn}`}>{c.status === 'sent' ? 'Sent' : `Sending (${c.queued} left)`}</span></td>
                      <td>{c.recipient_count}</td><td>{c.delivered}</td><td>{c.opened}</td><td>{c.clicked}</td><td>{c.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
      {preview && <PreviewDialog subject={subject} body={body} onClose={() => setPreview(false)} />}
    </>
  );
}
