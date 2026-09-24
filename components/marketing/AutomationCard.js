'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Textarea, Select } from '@/components/ui/Field';
import { saveMarketingAutomation, getMarketingCandidates, triggerMarketingNow } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import styles from './marketing.module.css';

const META = {
  slot_opened: {
    title: 'Fill a cancelled slot',
    desc: 'When a confirmed appointment is cancelled, email clients who have agreed to marketing so someone can take the spot. The person who cancelled is never emailed.',
    candidates: 'Recently cancelled appointments',
    action: 'Email clients about this slot',
  },
  session_completed: {
    title: 'Thank-you offer after a session',
    desc: 'After a session is completed, email that client a thank-you with 10% off their next tattoo. The offer is a message only: nothing is applied at checkout, so honour it when they book.',
    candidates: 'Recently completed sessions',
    action: 'Send thank-you email',
  },
};

const DELAYS = [
  [0, 'Straight away'], [60, 'After 1 hour'], [1440, 'After 1 day'], [4320, 'After 3 days'], [10080, 'After 1 week'],
];

function when(iso) {
  return iso ? new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

export default function AutomationCard({ automation, available, onSaved }) {
  const meta = META[automation.trigger_type];
  const [form, setForm] = useState(automation);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [sending, setSending] = useState('');
  const dirty = JSON.stringify(form) !== JSON.stringify(automation);
  const set = patch => setForm(prev => ({ ...prev, ...patch }));

  async function save() {
    setSaving(true); setError('');
    try {
      const saved = await saveMarketingAutomation(form.trigger_type, {
        enabled: form.enabled, delay_minutes: Number(form.delay_minutes),
        audience: { max_recipients: Number(form.audience.max_recipients) }, subject: form.subject, body: form.body,
      });
      setForm(saved);
      onSaved(saved);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function loadCandidates() {
    try { setCandidates((await getMarketingCandidates(form.trigger_type)).bookings); }
    catch (err) { showError(err); }
  }

  async function sendNow(candidate) {
    const who = candidate.client_name || 'this client';
    const ok = await requestConfirmation({
      title: meta.action,
      message: form.trigger_type === 'slot_opened'
        ? `Email up to ${form.audience.max_recipients} opted-in clients about ${who}'s cancelled slot? Only clients who agreed to marketing emails are contacted.`
        : `Send ${who} the thank-you email? They must have agreed to marketing emails.`,
      confirmLabel: 'Send',
    });
    if (!ok) return;
    setSending(candidate.booking_id);
    try {
      await triggerMarketingNow(candidate.booking_id, form.trigger_type);
      showFeedback('Queued. Emails go out within a minute or two.', 'success');
      await loadCandidates();
    } catch (err) { showError(err); }
    finally { setSending(''); }
  }

  return (
    <section className={styles.card} aria-labelledby={`auto-${form.trigger_type}`}>
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle} id={`auto-${form.trigger_type}`}>{meta.title}</h2>
          <p className={styles.desc}>{meta.desc}</p>
        </div>
        <label className={styles.switch}>
          <input type="checkbox" role="switch" checked={form.enabled} onChange={e => set({ enabled: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
          {form.enabled ? 'Automatic' : 'Off'}
        </label>
      </div>

      <div className={styles.row}>
        <Field label="When to send">
          <Select value={form.delay_minutes} onChange={e => set({ delay_minutes: Number(e.target.value) })}>
            {DELAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        {form.trigger_type === 'slot_opened' && (
          <Field label="Max clients to email" hint="Most recent visitors are emailed first.">
            <Input type="number" min={1} max={200} value={form.audience.max_recipients}
              onChange={e => set({ audience: { max_recipients: e.target.value } })} />
          </Field>
        )}
      </div>
      <Field label="Subject"><Input value={form.subject} maxLength={200} onChange={e => set({ subject: e.target.value })} /></Field>
      <Field label="Message" hint="Placeholders: {{client_name}}  {{studio_name}}  {{slot_date}}  {{session_type}}. Separate paragraphs with a blank line.">
        <Textarea rows={9} value={form.body} maxLength={20000} onChange={e => set({ body: e.target.value })} />
      </Field>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {!available && <p className={styles.hint}>Email sending isn’t switched on yet. Your settings are saved and will apply once it is.</p>}
      <div className={styles.actions}>
        <Button onClick={save} loading={saving} loadingLabel="Saving…" disabled={!dirty}>Save</Button>
        <Button variant="secondary" onClick={() => setPreview(true)}>Preview</Button>
        <Button variant="ghost" onClick={candidates ? () => setCandidates(null) : loadCandidates} disabled={!available}>
          {candidates ? 'Hide recent' : 'Send for a recent booking…'}
        </Button>
      </div>

      {candidates && (
        <div>
          <h3 className={styles.cardTitle}>{meta.candidates}</h3>
          {candidates.length === 0 ? <p className={styles.muted}>Nothing recent.</p> : (
            <ul className={styles.list}>
              {candidates.map(c => (
                <li key={c.booking_id} className={styles.listRow}>
                  <span>{c.client_name || 'Client'} <span className={styles.muted}>{when(c.chosen_time)}{c.emailed > 0 ? ` · already emailed ${c.emailed}` : ''}</span></span>
                  <Button size="sm" variant="secondary" loading={sending === c.booking_id} onClick={() => sendNow(c)}>Send</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {preview && <PreviewDialog subject={form.subject} body={form.body} onClose={() => setPreview(false)} />}
    </section>
  );
}
