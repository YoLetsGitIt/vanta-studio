'use client';

import { useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Textarea, Select } from '@/components/ui/Field';
import { saveMarketingAutomation, getMarketingCandidates, triggerMarketingNow } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import styles from './marketing.module.css';

const ICONS = {
  slot_opened: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17M12 13.5v4M10 15.5h4" /></svg>,
  session_completed: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.6 12 20 12 20Z" /></svg>,
};

const META = {
  slot_opened: {
    title: 'Fill a cancelled slot',
    tone: 'badgeBlue',
    summary: (a, when) => `Emails up to ${a.audience.max_recipients} opted-in clients ${when} when a confirmed appointment is cancelled.`,
    candidates: 'Recently cancelled appointments',
    action: 'Email clients about this slot',
  },
  session_completed: {
    title: 'Thank-you offer after a session',
    tone: 'badgeGreen',
    summary: (a, when) => `Emails the client ${when} once their session is completed, with 10% off their next tattoo.`,
    candidates: 'Recently completed sessions',
    action: 'Send thank-you email',
  },
};

const DELAYS = [
  [0, 'Straight away', 'straight away'], [60, 'After 1 hour', 'an hour later'], [1440, 'After 1 day', 'a day later'],
  [4320, 'After 3 days', '3 days later'], [10080, 'After 1 week', 'a week later'],
];
const delayWords = minutes => (DELAYS.find(d => d[0] === Number(minutes)) || DELAYS[0])[2];

const TOKENS = [['client_name', 'Client’s name'], ['studio_name', 'Studio name'], ['slot_date', 'Slot date'], ['session_type', 'Session type']];

function when(iso) {
  return iso ? new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

export default function AutomationCard({ automation, available, onSaved, onNeedSetup }) {
  const meta = META[automation.trigger_type];
  const [form, setForm] = useState(automation);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [sending, setSending] = useState('');
  const bodyRef = useRef(null);
  const dirty = JSON.stringify({ ...form, enabled: 0 }) !== JSON.stringify({ ...automation, enabled: 0 });
  const set = patch => setForm(prev => ({ ...prev, ...patch }));
  const payload = enabled => ({
    enabled, delay_minutes: Number(form.delay_minutes),
    audience: { max_recipients: Number(form.audience.max_recipients) }, subject: form.subject, body: form.body,
  });

  async function persist(enabled) {
    const saved = await saveMarketingAutomation(form.trigger_type, payload(enabled));
    setForm(saved);
    onSaved(saved);
    return saved;
  }

  async function toggle(next) {
    const previous = form.enabled;
    set({ enabled: next });
    setToggling(true); setError('');
    try { await persist(next); }
    catch (err) { set({ enabled: previous }); setError(err.message); }
    finally { setToggling(false); }
  }

  async function save() {
    setSaving(true); setError('');
    try { await persist(form.enabled); showFeedback('Saved.', 'success'); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  function insert(token) {
    const el = bodyRef.current;
    const text = `{{${token}}}`;
    if (!el) { set({ body: `${form.body}${text}` }); return; }
    const start = el.selectionStart ?? form.body.length;
    const end = el.selectionEnd ?? start;
    set({ body: form.body.slice(0, start) + text + form.body.slice(end) });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + text.length, start + text.length); });
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

  const needsReplyTo = /reply-to/i.test(error);
  return (
    <section className={`${styles.card} ${styles.auto} ${form.enabled ? styles.autoOn : ''}`} aria-labelledby={`auto-${form.trigger_type}`}>
      <div className={styles.autoHead}>
        <div className={`${styles.badge} ${styles[meta.tone]}`} aria-hidden="true">{ICONS[form.trigger_type]}</div>
        <div className={styles.autoText}>
          <div className={styles.autoName}>
            <h2 className={styles.cardTitle} id={`auto-${form.trigger_type}`}>{meta.title}</h2>
            <span className={`${styles.pill} ${form.enabled ? styles.pillOn : ''}`}>{form.enabled ? 'On' : 'Off'}</span>
          </div>
          <p className={styles.desc}>{meta.summary(form, delayWords(form.delay_minutes))}</p>
        </div>
        <div className={styles.autoControls}>
          <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Close' : 'Edit'}</Button>
          <input type="checkbox" role="switch" className={styles.switch} aria-label={`${meta.title}: ${form.enabled ? 'on' : 'off'}`}
            checked={form.enabled} disabled={toggling} onChange={e => toggle(e.target.checked)} />
        </div>
      </div>

      {error && (
        <p className={styles.autoAlert} role="alert">
          <span>{error}</span>
          {needsReplyTo && <Button size="sm" variant="secondary" onClick={onNeedSetup}>Add reply-to</Button>}
        </p>
      )}

      {open && (
        <div className={styles.autoBody}>
          <Field label="Subject"><Input value={form.subject} maxLength={200} onChange={e => set({ subject: e.target.value })} /></Field>
          <Field label="Message">
            <Textarea ref={bodyRef} rows={8} value={form.body} maxLength={20000} onChange={e => set({ body: e.target.value })} />
          </Field>
          <div className={styles.chips} aria-label="Insert a placeholder">
            <span className={styles.hint}>Insert:</span>
            {TOKENS.map(([token, label]) => <button key={token} type="button" className={styles.chip} onClick={() => insert(token)}>{label}</button>)}
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
          {!available && <p className={styles.hint}>Sending isn’t switched on yet. Your changes are saved and apply once it is.</p>}
          <div className={styles.actions}>
            <Button onClick={save} loading={saving} loadingLabel="Saving…" disabled={!dirty}>Save changes</Button>
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
                      <span>{c.client_name || 'Client'}
                        <span className={styles.rowSub}>{when(c.chosen_time)}{c.emailed > 0 ? ` · already emailed ${c.emailed}` : ''}</span></span>
                      <Button size="sm" variant="secondary" loading={sending === c.booking_id} onClick={() => sendNow(c)}>Send</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {preview && <PreviewDialog subject={form.subject} body={form.body} onClose={() => setPreview(false)} />}
    </section>
  );
}
