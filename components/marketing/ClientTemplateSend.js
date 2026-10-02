'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Field, { Select } from '@/components/ui/Field';
import { getMarketing, listMarketingTemplates, sendClientMarketingTemplate } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';

export default function ClientTemplateSend({ clientKey, email, marketing }) {
 const [data, setData] = useState(null);
 const [templates, setTemplates] = useState([]);
 const [id, setId] = useState('');
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);
 const [preview, setPreview] = useState(false);
 useEffect(() => {
  let active = true;
  Promise.all([getMarketing(), listMarketingTemplates()]).then(([overview, list]) => {
   if (active) { setData(overview); setTemplates(list.templates); }
  }).catch(err => { if (active) setError(err.message); });
  return () => { active = false; };
 }, []);
 const template = templates.find(t => t.id === id);
 const eligible = email && marketing?.optIn && !marketing.unsubscribed;
 async function send() {
  if (!await requestConfirmation({ title: 'Send email', message: `Send “${template.subject}” to ${email}?`, confirmLabel: 'Send email' })) return;
  setBusy(true);
  try { await sendClientMarketingTemplate(clientKey, id); showFeedback('Email queued for this client.', 'success'); }
  catch (err) { showError(err); } finally { setBusy(false); }
 }
 return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
  {error && <p role="alert">{error}</p>}
  {!data && !error && <p role="status">Loading templates…</p>}
  {data && <>
   <Field label="Email template"><Select value={id} onChange={e => setId(e.target.value)} disabled={busy}>
    <option value="">Choose a template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
   </Select></Field>
   {templates.length === 0 && <Link href="/dashboard/marketing">Create an email template</Link>}
   {!eligible && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{marketing?.unsubscribed ? 'This client has unsubscribed.' : 'This client needs an email address and marketing consent before sending.'}</p>}
   {!data.available && <p>Sending isn’t switched on yet.</p>}
   {data.available && !data.ready && <Link href="/dashboard/marketing">Set up your sender in Marketing</Link>}
   <div style={{ display: 'flex', gap: 8 }}>
    <Button size="sm" loading={busy} disabled={!template || !eligible || !data.available || !data.ready} onClick={send}>Send email</Button>
    <Button size="sm" variant="secondary" disabled={!template} onClick={() => setPreview(true)}>Preview</Button>
   </div>
  </>}
  {preview && template && <PreviewDialog subject={template.subject} body={template.body} onClose={() => setPreview(false)} />}
 </div>;
}
