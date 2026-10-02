'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Textarea, Select } from '@/components/ui/Field';
import { listMarketingTemplates, saveMarketingTemplate, deleteMarketingTemplate } from '@/lib/api';
import { showError, showFeedback, requestConfirmation } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import styles from './marketing.module.css';

const empty = { name: '', subject: '', body: 'Hi {{client_name}},\n\nWrite your message here.\n\nThanks,\n{{studio_name}}' };
export default function Templates() {
 const [templates, setTemplates] = useState([]);
 const [form, setForm] = useState(empty);
 const [busy, setBusy] = useState(false);
 const [preview, setPreview] = useState(false);
 const [loaded, setLoaded] = useState(false);
 async function load() { const data = await listMarketingTemplates(); setTemplates(data.templates); setLoaded(true); }
 useEffect(() => { load().catch(showError); }, []);
 async function save() {
  setBusy(true);
  try { const saved = await saveMarketingTemplate(form); setForm(saved); await load(); showFeedback('Template saved.', 'success'); }
  catch (err) { showError(err); } finally { setBusy(false); }
 }
 async function remove() {
  if (!await requestConfirmation({ title: 'Delete template', message: `Delete “${form.name}”? Previously queued emails keep their message.`, confirmLabel: 'Delete', danger: true })) return;
  setBusy(true);
  try { await deleteMarketingTemplate(form.id); setForm(empty); await load(); } catch (err) { showError(err); } finally { setBusy(false); }
 }
 const set = patch => setForm(prev => ({ ...prev, ...patch }));
 return <section className={styles.card}>
  <h2 className={styles.cardTitle}>Email templates</h2>
  <p className={styles.desc}>Save messages to reuse in campaigns or send from a client’s profile.</p>
  <Field label="Saved template"><Select disabled={!loaded || busy} value={form.id || ''} onChange={e => setForm(templates.find(t => t.id === e.target.value) || empty)}>
   <option value="">Create a new template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
  </Select></Field>
  <Field label="Template name"><Input value={form.name} maxLength={200} onChange={e => set({ name: e.target.value })} /></Field>
  <Field label="Subject"><Input value={form.subject} maxLength={200} onChange={e => set({ subject: e.target.value })} /></Field>
  <Field label="Message" hint="Use {{client_name}} and {{studio_name}} to personalise each email."><Textarea rows={10} value={form.body} maxLength={50000} onChange={e => set({ body: e.target.value })} /></Field>
  <div className={styles.actions}>
   <Button onClick={save} loading={busy} disabled={!form.name.trim() || !form.subject.trim() || !form.body.trim()}>Save template</Button>
   <Button variant="secondary" onClick={() => setPreview(true)} disabled={!form.body.trim()}>Preview</Button>
   {form.id && <><Button variant="secondary" disabled={busy} onClick={() => setForm({ ...form, id: undefined, name: `${form.name} (copy)` })}>Make a copy</Button><Button variant="ghost" disabled={busy} onClick={remove}>Delete</Button></>}
  </div>
  {preview && <PreviewDialog subject={form.subject} body={form.body} onClose={() => setPreview(false)} />}
 </section>;
}
