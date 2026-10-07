'use client';

import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Textarea } from '@/components/ui/Field';
import { listMarketingTemplates, saveMarketingTemplate, deleteMarketingTemplate } from '@/lib/api';
import { showError, showFeedback, requestConfirmation } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import TestSendButton from './TestSendButton';
import styles from './marketing.module.css';

const BLANK = { name: '', subject: '', body: 'Hi {{client_name}},\n\nWrite your message here.\n\nThanks,\n{{studio_name}}' };
const STARTERS = [
  { name: 'Flash day', subject: 'Flash day at {{studio_name}}', body: 'Hi {{client_name}},\n\nWe’re running a flash day soon, with a fresh sheet of designs at set prices. First in, best dressed.\n\nReply to this email if you’d like us to hold a spot for you.\n\nThanks,\n{{studio_name}}' },
  { name: 'We miss you', subject: 'It’s been a while, {{client_name}}', body: 'Hi {{client_name}},\n\nIt’s been a while since your last visit and we’d love to see you again. If you’ve been thinking about your next piece, reply to this email and we’ll find a time.\n\nThanks,\n{{studio_name}}' },
  { name: 'Healed photo request', subject: 'How’s your tattoo healing?', body: 'Hi {{client_name}},\n\nYour tattoo should be well healed by now. We’d love to see how it settled, so reply with a photo if you’re happy to share one.\n\nIf anything needs a touch-up, let us know and we’ll book you in.\n\nThanks,\n{{studio_name}}' },
  { name: 'Books open', subject: 'Our books are open', body: 'Hi {{client_name}},\n\nOur books are open for new bookings. Spots tend to go quickly, so reply to this email with your idea and we’ll get back to you with times.\n\nThanks,\n{{studio_name}}' },
  { name: 'Last-minute opening', subject: 'A spot just opened up', body: 'Hi {{client_name}},\n\nWe’ve had a cancellation and a spot has opened up this week. If you’d like it, reply to this email and it’s yours.\n\nThanks,\n{{studio_name}}' },
];
const PLACEHOLDERS = [['{{client_name}}', 'Client’s first name'], ['{{studio_name}}', 'Studio name']];
const same = (a, b) => a.name === b.name && a.subject === b.subject && a.body === b.body;

/** Saved messages on the left, the editor for the chosen one on the right. */
export default function Templates({ available, ready, onUse }) {
  const [templates, setTemplates] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [baseline, setBaseline] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const focused = useRef('body');
  const fields = { subject: useRef(null), body: useRef(null) };

  async function load() { const data = await listMarketingTemplates(); setTemplates(data.templates); return data.templates; }
  useEffect(() => { load().catch(err => { showError(err); setTemplates([]); }); }, []);

  const dirty = !same(form, baseline);
  const complete = form.name.trim() && form.subject.trim() && form.body.trim();
  const set = patch => setForm(prev => ({ ...prev, ...patch }));

  async function open(next) {
    if (dirty && !await requestConfirmation({ title: 'Discard changes', message: 'You have unsaved changes to this template.', confirmLabel: 'Discard', danger: true })) return;
    setForm(next); setBaseline(next.id ? next : BLANK);
  }
  async function save() {
    setBusy(true);
    try { const saved = await saveMarketingTemplate(form); setForm(saved); setBaseline(saved); await load(); showFeedback('Template saved.', 'success'); return saved; }
    catch (err) { showError(err); return null; } finally { setBusy(false); }
  }
  async function remove() {
    if (!await requestConfirmation({ title: 'Delete template', message: `Delete “${form.name}”? Emails already queued keep their message.`, confirmLabel: 'Delete', danger: true })) return;
    setBusy(true);
    try { await deleteMarketingTemplate(form.id); setForm(BLANK); setBaseline(BLANK); await load(); } catch (err) { showError(err); } finally { setBusy(false); }
  }
  async function use() {
    const saved = dirty || !form.id ? await save() : form;
    if (saved) onUse(saved.id);
  }
  // Drops the placeholder where the cursor was in whichever of subject or message was used last.
  function insert(token) {
    const key = focused.current, el = fields[key].current, value = form[key];
    const start = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length;
    set({ [key]: value.slice(0, start) + token + value.slice(end) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  }

  return (
    <div className={styles.split}>
      <nav className={`${styles.card} ${styles.tplNav}`} aria-label="Templates">
        <div className={styles.sectionHead}>
          <h2 className={styles.cardTitle}>Your templates</h2>
          <Button size="sm" variant="secondary" onClick={() => open(BLANK)}>New</Button>
        </div>
        {templates === null ? <p className={styles.muted} role="status">Loading…</p>
          : templates.length === 0 ? <p className={styles.hint}>None saved yet. Write one, or start from an example below.</p> : (
            <ul className={styles.tplList}>
              {templates.map(t => (
                <li key={t.id}>
                  <button type="button" className={styles.tplItem} aria-current={form.id === t.id ? 'true' : undefined} onClick={() => open(t)}>
                    <span className={styles.tplName}>{t.name}</span>
                    <span className={styles.rowSub}>{t.subject}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        <h3 className={styles.groupLabel}>Start from an example</h3>
        <div className={styles.chips}>
          {STARTERS.map(s => <button key={s.name} type="button" className={styles.chip} onClick={() => open(s)}>{s.name}</button>)}
        </div>
      </nav>

      <section className={styles.card} aria-label="Template editor">
        <div className={styles.sectionHead}>
          <h2 className={styles.cardTitle}>{form.id ? 'Edit template' : 'New template'}</h2>
          {dirty && <span className={styles.pill}>Unsaved changes</span>}
        </div>
        <Field label="Template name" hint="Only you see this."><Input value={form.name} maxLength={200} placeholder="For example, Flash day" onChange={e => set({ name: e.target.value })} /></Field>
        <Field label="Subject"><Input ref={fields.subject} value={form.subject} maxLength={200} onFocus={() => { focused.current = 'subject'; }} onChange={e => set({ subject: e.target.value })} /></Field>
        <Field label="Message"><Textarea ref={fields.body} rows={12} value={form.body} maxLength={50000} onFocus={() => { focused.current = 'body'; }} onChange={e => set({ body: e.target.value })} /></Field>
        <div className={styles.chips}>
          <span className={styles.hint}>Personalise with</span>
          {PLACEHOLDERS.map(([token, label]) => <button key={token} type="button" className={styles.chip} onClick={() => insert(token)}>{label}</button>)}
        </div>
        <div className={styles.actions}>
          <Button onClick={save} loading={busy} disabled={!complete || !dirty}>{form.id ? 'Save changes' : 'Save template'}</Button>
          <Button variant="secondary" disabled={!complete || busy} onClick={use}>Use in an email</Button>
          <Button variant="secondary" onClick={() => setPreview(true)} disabled={!form.body.trim()}>Preview</Button>
          <TestSendButton available={available} ready={ready} disabled={!form.subject.trim() || !form.body.trim()} message={{ subject: form.subject, body: form.body }} />
        </div>
        {form.id && (
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setForm({ name: `${form.name} (copy)`, subject: form.subject, body: form.body }); setBaseline(BLANK); }}>Make a copy</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={remove}>Delete</Button>
          </div>
        )}
        {preview && <PreviewDialog subject={form.subject} body={form.body} onClose={() => setPreview(false)} />}
      </section>
    </div>
  );
}
