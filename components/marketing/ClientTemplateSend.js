'use client';

import { useLanguage } from '@/lib/i18n';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Field, { Select } from '@/components/ui/Field';
import { getMarketing, listMarketingTemplates, sendClientMarketingTemplate } from '@/lib/api';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import { detailStyles } from '@/components/ui/DetailParts';

const d = { ...detailStyles, hint: { ...detailStyles.hint, margin: 0 } };

export default function ClientTemplateSend({ clientKey, email, marketing }) {
  const { t: mt } = useLanguage();
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
  if (!await requestConfirmation({ title: mt("Send email"), message: `Send “${template.subject}” to ${email}?`, confirmLabel: mt("Send email") })) return;
  setBusy(true);
  try { await sendClientMarketingTemplate(clientKey, id); showFeedback(mt("Email queued for this client."), 'success'); }
  catch (err) { showError(err); } finally { setBusy(false); }
 }
 return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
  {error && <p role="alert" style={{ ...d.hint, color: 'var(--color-danger)' }}>{error}</p>}
  {!data && !error && <p role="status" style={d.hint}>{mt("Loading email campaigns…")}</p>}
  {data && <>
   <Field label={mt("Email campaign")}><Select value={id} onChange={e => setId(e.target.value)} disabled={busy}>
    <option value="">{mt("Choose an email campaign")}</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
   </Select></Field>
   {templates.length === 0 && <Link href="/dashboard/marketing?tab=templates" style={{ ...d.textLink, alignSelf: 'flex-start' }}>{mt("Create an email campaign")}</Link>}
   {!eligible && <p style={d.hint}>{marketing?.unsubscribed ? mt("This client has unsubscribed.") : mt("This client needs an email address and marketing consent before sending.")}</p>}
   {!data.available && <p style={d.hint}>{mt("Sending isn’t switched on yet.")}</p>}
   {data.available && !data.ready && <Link href="/dashboard/marketing?tab=settings" style={{ ...d.textLink, alignSelf: 'flex-start' }}>{mt("Set up your sending email")}</Link>}
   <div style={{ display: 'flex', gap: 8 }}>
    <Button size="sm" loading={busy} disabled={!template || !eligible || !data.available || !data.ready} onClick={send}>{mt("Send email")}</Button>
    <Button size="sm" variant="secondary" disabled={!template} onClick={() => setPreview(true)}>{mt("Preview")}</Button>
   </div>
  </>}
  {preview && template && <PreviewDialog subject={template.subject} body={template.body} onClose={() => setPreview(false)} />}
 </div>;
}
