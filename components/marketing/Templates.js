'use client';

import { useLanguage } from '@/lib/i18n';

import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Field, { Input, Textarea } from '@/components/ui/Field';
import { listMarketingTemplates, saveMarketingTemplate, deleteMarketingTemplate } from '@/lib/api';
import { showError, showFeedback, requestConfirmation } from '@/lib/feedback';
import PreviewDialog from './PreviewDialog';
import TestSendButton from './TestSendButton';
import Campaigns from './Campaigns';
import styles from './marketing.module.css';

const BLANK = { name: '', subject: '', body: 'Hi {{client_name}},\n\nWrite your message here.\n\nThanks,\n{{studio_name}}' };
const STARTERS = [
  { name: 'Flash day', subject: 'Flash day at {{studio_name}}', body: 'Hi {{client_name}},\n\nWe’re running a flash day soon, with a fresh sheet of designs at set prices. First in, best dressed.\n\nReply to this email if you’d like us to hold a spot for you.\n\nThanks,\n{{studio_name}}' },
  { name: 'We miss you', subject: 'It’s been a while, {{client_name}}', body: 'Hi {{client_name}},\n\nIt’s been a while since your last visit and we’d love to see you again. If you’ve been thinking about your next tattoo or piercing, reply to this email and we’ll find a time.\n\nThanks,\n{{studio_name}}' },
  { name: 'Healed photo request', subject: 'How’s your tattoo healing?', body: 'Hi {{client_name}},\n\nYour tattoo should be well healed by now. We’d love to see how it settled, so reply with a photo if you’re happy to share one.\n\nIf anything needs a touch-up, let us know and we’ll book you in.\n\nThanks,\n{{studio_name}}' },
  { name: 'Piercing check-in', subject: 'Checking in on your piercing', body: 'Hi {{client_name}},\n\nWe’re checking in after your piercing appointment. If you have questions about your aftercare instructions or would like to arrange a follow-up, reply to this email and we’ll help you find a time.\n\nThanks,\n{{studio_name}}' },
  { name: 'Books open', subject: 'Our books are open', body: 'Hi {{client_name}},\n\nOur books are open for new bookings. Spots tend to go quickly, so reply to this email with your idea and we’ll get back to you with times.\n\nThanks,\n{{studio_name}}' },
  { name: 'Last-minute opening', subject: 'A spot just opened up', body: 'Hi {{client_name}},\n\nWe’ve had a cancellation and a spot has opened up this week. If you’d like it, reply to this email and it’s yours.\n\nThanks,\n{{studio_name}}' },
];
const STARTER_GROUPS = [
  { title: 'Promotions', tone: 'promotion', items: [
    ['Flash day', 'Invite clients to a flash event.'],
    ['Books open', 'Announce new availability.'],
    ['Last-minute opening', 'Fill a cancellation.'],
  ] },
  { title: 'Client care', tone: 'care', items: [
    ['We miss you', 'Reconnect with past clients.'],
    ['Healed photo request', 'Ask for a healed photo.'],
    ['Piercing check-in', 'Follow up after a piercing.'],
  ] },
];
const PLACEHOLDERS = [['{{client_name}}', 'Client’s first name'], ['{{studio_name}}', 'Studio name']];
const same = (a, b) => a.name === b.name && a.subject === b.subject && a.body === b.body;

/** Choose a starting point, write the message, then use the separate action panel. */
export default function Templates({ available, ready, preset, onSent, onNeedSetup }) {
  const { t: mt } = useLanguage();
  const [templates, setTemplates] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(BLANK);
  const [baseline, setBaseline] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [step, setStep] = useState('write');
  const [sendTemplate, setSendTemplate] = useState(null);
  const [flowKey, setFlowKey] = useState(0);
  const flowHead = useRef(null);
  const editorHead = useRef(null);
  const focused = useRef('body');
  const fields = { subject: useRef(null), body: useRef(null) };

  async function load() { setLoadError(''); const data = await listMarketingTemplates(); setTemplates(data.templates); return data.templates; }
  useEffect(() => { load().catch(err => setLoadError(err.message || mt('Couldn’t load templates.'))); }, []);

  const hasSavedTemplates = (templates?.length ?? 0) > 0;
  const ExampleGroup = hasSavedTemplates ? 'details' : 'section';
  const examplesHeading = <h3 id="example-template-heading" className={styles.libraryHeading}>{mt("Start from an example")}</h3>;
  const dirty = !same(form, baseline);
  const example = !form.id && STARTERS.some(starter => same(starter, baseline));
  const complete = form.name.trim() && form.subject.trim() && form.body.trim();
  const set = patch => setForm(prev => ({ ...prev, ...patch }));
  function goStep(next) {
    setStep(next);
    requestAnimationFrame(() => { flowHead.current?.focus(); flowHead.current?.scrollIntoView({ block: 'start' }); });
  }

  async function open(next) {
    // Re-selecting the current saved template keeps its draft in place.
    if (!next.id || next.id !== form.id) {
      if (dirty && !await requestConfirmation({ title: mt("Discard changes"), message: mt("You have unsaved changes to this template."), confirmLabel: mt("Discard"), danger: true })) return;
      // Loading an example is a starting point, not an edit made by the user.
      setForm(next); setBaseline(next);
    }
    setEditorOpen(true); setShowChoices(false);
    requestAnimationFrame(() => {
      editorHead.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 1279px)').matches) editorHead.current?.scrollIntoView({ block: 'start' });
    });
  }
  async function save(notify = true) {
    if (busy || !complete) return null;
    setBusy(true);
    try {
      const saved = await saveMarketingTemplate(form);
      setForm(saved); setBaseline(saved);
      setTemplates(prev => [saved, ...(prev || []).filter(t => t.id !== saved.id)]);
      if (notify) showFeedback(mt("Template saved."), 'success');
      return saved;
    }
    catch (err) { showError(err); return null; } finally { setBusy(false); }
  }
  async function remove() {
    if (!await requestConfirmation({ title: mt("Delete template"), message: mt('Delete “{name}”? Emails already queued keep their message.', { name: form.name }), confirmLabel: mt("Delete"), danger: true })) return;
    setBusy(true);
    try { await deleteMarketingTemplate(form.id); setForm(BLANK); setBaseline(BLANK); setEditorOpen(false); goStep('write'); await load(); } catch (err) { showError(err); } finally { setBusy(false); }
  }
  async function use() {
    if (busy || !complete) return;
    const saved = dirty || !form.id ? await save(false) : form;
    if (saved) { setSendTemplate(saved); goStep('clients'); }
  }
  function startAgain() {
    setForm(BLANK); setBaseline(BLANK); setSendTemplate(null); setEditorOpen(false); setShowChoices(false);
    setFlowKey(value => value + 1); goStep('write');
  }
  // Drops the placeholder where the cursor was in whichever of subject or message was used last.
  function insert(token) {
    const key = focused.current, el = fields[key].current, value = form[key];
    const start = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length;
    set({ [key]: value.slice(0, start) + token + value.slice(end) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  }

  return (
    <div className={styles.panel}>
      <h2 className="sr-only" tabIndex={-1} ref={flowHead}>{mt(step === 'write' ? 'Write your template' : 'Choose clients and send')}</h2>
      <ol className={styles.flowSteps} aria-label={mt("Create and send")}>
        <li aria-current={step === 'write' ? 'step' : undefined}><span className={styles.stepNum} aria-hidden="true">{step === 'clients' ? '✓' : '1'}</span>{mt("Write your template")}</li>
        <li aria-current={step === 'clients' ? 'step' : undefined}><span className={styles.stepNum} aria-hidden="true">2</span>{mt("Choose clients and send")}</li>
      </ol>
      {loadError && <div role="alert" className={`${styles.card} ${styles.workspaceError}`}><p>{loadError}</p><Button onClick={() => load().catch(err => setLoadError(err.message))}>{mt("Try again")}</Button></div>}
      <div hidden={step !== 'write'} data-stage={editorOpen ? 'editing' : 'choosing'} className={`${styles.templateWorkspace} ${styles.flowPanel} ${!editorOpen ? styles.templateChooser : ''}`}>
        {editorOpen && <button type="button" className={`${styles.chip} ${styles.mobileChoices}`} aria-expanded={showChoices} onClick={() => setShowChoices(value => !value)}>{mt("Choose a saved template or example")}</button>}
        <nav data-expanded={!editorOpen || showChoices} className={`${styles.card} ${styles.tplNav} ${styles.templateLibrary}`} aria-label={mt("Templates")} data-has-saved={hasSavedTemplates}>
          <div className={styles.libraryIntro}>
            <div className={styles.libraryIntroText}>
              <h2 className={styles.cardTitle}>{mt("Your templates")}</h2>
              <p className={styles.hint}>{mt(hasSavedTemplates ? "Choose one of your saved templates to edit or send." : "Reuse a saved message, or start from an example.")}</p>
            </div>
            <Button fullWidth variant={editorOpen ? 'secondary' : 'primary'} disabled={busy} onClick={() => open(BLANK)}><span aria-hidden="true">＋</span>{mt("New template")}</Button>
          </div>
          <section className={`${styles.libraryGroup} ${styles.savedTemplateGroup}`} aria-labelledby="saved-template-heading">
            <div className={styles.libraryGroupHead}>
              <h3 id="saved-template-heading">{mt("Saved templates")}</h3>
              {templates && <span className={styles.libraryCount}>{templates.length}</span>}
            </div>
            {templates === null ? <p className={styles.muted} role="status">{mt("Loading…")}</p>
              : templates.length === 0 ? <p className={styles.hint}>{mt("None saved yet. Write one, or start from an example below.")}</p> : (
                <ul className={styles.tplList}>
                  {templates.map(t => (
                    <li key={t.id}>
                      <button type="button" disabled={busy} className={styles.tplItem} aria-current={form.id === t.id ? 'true' : undefined} onClick={() => open(t)}>
                        <span className={styles.savedTemplateIcon} aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg></span>
                        <span className={styles.templateChoiceText}>
                          <span className={styles.tplName}>{t.name}</span>
                          <span className={styles.rowSub}>{t.subject}</span>
                          {form.id === t.id && <span className={styles.selectedLabel}>✓ {mt("Selected")}</span>}
                        </span>
                        <span className={styles.savedTemplateArrow} aria-hidden="true">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </section>
          <ExampleGroup className={`${styles.libraryGroup} ${styles.exampleTemplateGroup} ${hasSavedTemplates ? styles.exampleDisclosure : ''}`} aria-labelledby="example-template-heading">
            {hasSavedTemplates ? <summary className={styles.exampleSummary}>{examplesHeading}<span className={styles.disclosureArrow} aria-hidden="true">⌄</span></summary> : examplesHeading}
            <div className={styles.exampleGroups}>
            {STARTER_GROUPS.map(group => (
              <div key={group.title} data-tone={group.tone} className={styles.exampleGroup}>
                <h4 className={styles.exampleHeading}><span className={styles.categoryDot} aria-hidden="true" />{mt(group.title)}</h4>
                <ul className={styles.exampleList}>
                  {group.items.map(([name, description]) => {
                    const starter = STARTERS.find(item => item.name === name);
                    const descriptionId = `example-${name.replaceAll(' ', '-').toLowerCase()}`;
                    return <li key={name}>
                      <button type="button" disabled={busy} aria-label={mt(name)} aria-describedby={descriptionId} aria-current={example && baseline.name === name ? 'true' : undefined} className={styles.exampleItem} onClick={() => open(starter)}>
                        <span className={styles.tplName}>{mt(name)}</span>
                        <span id={descriptionId} className={styles.exampleDescription}>{mt(description)}</span>
                        <span className={styles.exampleArrow} aria-hidden="true">→</span>
                      </button>
                    </li>;
                  })}
                </ul>
              </div>
            ))}
            </div>
          </ExampleGroup>
        </nav>

        {editorOpen && <section className={`${styles.card} ${styles.templateEditor} ${styles.revealEditor}`} aria-label={mt("Template editor")}>
          <div className={styles.editorHead}>
            <div>
              <h2 className={styles.cardTitle} tabIndex={-1} ref={editorHead}>{form.id ? mt("Edit template") : mt("New template")}</h2>
              <p className={styles.desc}>{mt("Write once, personalise for each client.")}</p>
            </div>
            {dirty ? <span className={`${styles.pill} ${styles.statusDirty}`}>{mt("Unsaved changes")}</span>
              : form.id ? <span className={`${styles.pill} ${styles.pillOn}`}>{mt("Saved template")}</span>
                : example && <span className={`${styles.pill} ${styles.pillBusy}`}>{mt("Example")}</span>}
          </div>
          <div className={styles.editorGroup}>
            <h3 className={styles.editorGroupTitle}>{mt("Template details")}</h3>
            <Field label={mt("Template name")} hint={mt("Only you see this.")}><Input disabled={busy} value={form.name} maxLength={200} placeholder={mt("For example, Flash day")} onChange={e => set({ name: e.target.value })} /></Field>
          </div>
          <div className={styles.editorGroup}>
            <div><h3 className={styles.editorGroupTitle}>{mt("Email content")}</h3><p className={styles.desc}>{mt("This is what your clients will receive.")}</p></div>
            <Field label={mt("Subject")}><Input disabled={busy} ref={fields.subject} value={form.subject} maxLength={200} onFocus={() => { focused.current = 'subject'; }} onChange={e => set({ subject: e.target.value })} /></Field>
            <Field label={mt("Message")}><Textarea disabled={busy} ref={fields.body} rows={10} value={form.body} maxLength={50000} onFocus={() => { focused.current = 'body'; }} onChange={e => set({ body: e.target.value })} /></Field>
          </div>
          <div className={`${styles.editorGroup} ${styles.personaliseGroup}`}>
            <div><h3 className={styles.editorGroupTitle}>{mt("Personalisation")}</h3><p className={styles.desc}>{mt("These details are filled in for each client.")}</p></div>
            <div className={styles.chips}>
              {PLACEHOLDERS.map(([token, label]) => <button key={token} type="button" disabled={busy} className={styles.chip} onClick={() => insert(token)}>{mt(label)}</button>)}
            </div>
          </div>
        </section>}

        {editorOpen && <aside className={`${styles.card} ${styles.templateActions} ${styles.revealActions}`} aria-label={mt("Template actions")}>
          <div className={styles.actionGroup}>
            <h2 className={styles.cardTitle}>{mt("Next steps")}</h2>
            <p className={styles.desc}>{mt("Finish your message, then choose who receives it.")}</p>
            <Button fullWidth onClick={use} loading={busy} loadingLabel={mt("Saving…")} disabled={!complete}>{mt("Continue to clients")}<span aria-hidden="true">→</span></Button>
            <p className={styles.hint}>{mt("Your template is saved when you continue. Nothing is sent until you confirm.")}</p>
          </div>
          <div className={styles.actionGroup}>
            <h3 className={styles.editorGroupTitle}>{mt("Check your email")}</h3>
            <Button fullWidth variant="secondary" onClick={() => setPreview(true)} disabled={!form.body.trim()}>{mt("Preview")}</Button>
            <TestSendButton fullWidth available={available} ready={ready} disabled={busy || !form.subject.trim() || !form.body.trim()} message={{ subject: form.subject, body: form.body }} />
            {available && !ready && <p className={styles.hint}>{mt("Set up your sending email first.")} <button type="button" className={styles.link} onClick={onNeedSetup}>{mt("Set it up")}</button></p>}
          </div>
          <div className={styles.actionGroup}>
            <h3 className={styles.editorGroupTitle}>{mt("Save for later")}</h3>
            <Button fullWidth variant="secondary" onClick={() => save()} disabled={!complete || (form.id && !dirty) || busy}>{form.id ? mt("Save changes") : mt("Save template")}</Button>
          </div>
          {form.id && <details className={styles.manageTemplate}>
            <summary>{mt("Manage template")}</summary>
            <div className={styles.manageActions}>
              <Button fullWidth size="sm" variant="ghost" disabled={busy} onClick={() => { setForm({ name: `${form.name} (copy)`, subject: form.subject, body: form.body }); setBaseline(BLANK); }}>{mt("Make a copy")}</Button>
              <Button fullWidth size="sm" variant="ghost" className={styles.deleteTemplate} disabled={busy} onClick={remove}>{mt("Delete")}</Button>
            </div>
          </details>}
        </aside>}
      </div>
      {preview && <PreviewDialog subject={form.subject} body={form.body} onClose={() => setPreview(false)} />}
      {sendTemplate && <div hidden={step !== 'clients'} className={styles.flowPanel}>
        <Campaigns key={flowKey} template={sendTemplate} preset={flowKey === 0 ? preset : undefined} available={available} ready={ready} onSent={onSent} onNeedSetup={onNeedSetup} onEditTemplates={() => goStep('write')} onStartAgain={startAgain} />
      </div>}
    </div>
  );
}
