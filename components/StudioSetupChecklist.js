'use client';

import { useEffect, useState } from 'react';
import { getStudioOnboarding, updateStudioOnboarding } from '@/lib/api';
import styles from './StudioSetupChecklist.module.css';

const STEPS = [
  { id: 'profile', title: 'Studio details and timezone', description: 'Check your name, address and timezone before adding appointments.', href: '/dashboard/settings?tab=studio', action: 'Review studio' },
  { id: 'hours', title: 'Hours and stations', description: 'Set your opening hours and the stations available for bookings.', href: '/dashboard/settings?tab=studio', action: 'Set hours and stations' },
  { id: 'artists', title: 'Your artists', description: 'Help artists join your studio, then approve them in Artists.', href: '/dashboard/artists?onboarding=1', action: 'Add artists' },
  { id: 'bookings', title: 'Bookings and consent', description: 'Review your booking form, consent form, deposits and reminders.', href: '/dashboard/settings?tab=bookings', action: 'Set up bookings' },
  { id: 'payments', title: 'Payments', description: 'Connect Stripe if you want to collect payments through Vanta.', href: '/dashboard/settings?tab=payments', action: 'Set up payments', optional: true },
  { id: 'import', title: 'Clients and upcoming appointments', description: 'Bring across Acuity, Jotform or other CSV exports. Import clients first.', href: '/dashboard/import', action: 'Open importer', optional: true },
];

function CheckIcon({ className }) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 10 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function StudioSetupLinks() {
  return (
    <aside className={styles.shortcuts} aria-label="Studio setup shortcuts">
      <div className={styles.shortcutHeader}>
        <h2>Studio setup</h2>
        <p>Set up your studio and bring your existing records across.</p>
      </div>
      <div className={styles.shortcutGrid}>
        <a className={styles.shortcutLink} href="/dashboard/home#studio-setup" aria-labelledby="account-setup-checklist-title" aria-describedby="account-setup-checklist-description">
          <span className={styles.shortcutIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m4 7 1.5 1.5L8 6m3 1h9M4 12l1.5 1.5L8 11m3 1h9M4 17l1.5 1.5L8 16m3 1h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <span className={styles.shortcutCopy}><strong id="account-setup-checklist-title">Setup checklist</strong><span id="account-setup-checklist-description">Review your studio, artists and booking setup.</span></span>
          <ArrowIcon />
        </a>
        <a className={`${styles.shortcutLink} ${styles.importShortcut}`} href="/dashboard/import" aria-labelledby="account-import-title" aria-describedby="account-import-description">
          <span className={styles.shortcutIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3v11m-4-4 4 4 4-4M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <span className={styles.shortcutCopy}><strong id="account-import-title">Import data</strong><span id="account-import-description">Bring clients and appointments from Acuity, Jotform or a CSV.</span></span>
          <ArrowIcon />
        </a>
      </div>
    </aside>
  );
}

export default function StudioSetupChecklist() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try { setState(await getStudioOnboarding()); }
    catch (err) { setError(err.message || 'Could not load setup progress.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function update(change) {
    setSaving(true);
    setError('');
    try { setState(await updateStudioOnboarding(change)); }
    catch (err) { setError(err.message || 'Could not save setup progress. Please try again.'); }
    finally { setSaving(false); }
  }

  const reviewed = STEPS.filter(step => ['complete', 'skipped'].includes(state?.steps?.[step.id])).length;
  const expanded = state && !state.collapsed;
  const nextStep = STEPS.find(step => !['complete', 'skipped'].includes(state?.steps?.[step.id]));

  return (
    <section id="studio-setup" className={styles.card} aria-labelledby="studio-setup-title" aria-busy={loading || saving}>
      <div className={styles.header}>
        <div className={styles.intro}>
          <h2 id="studio-setup-title">Studio setup checklist</h2>
          <p className={styles.subtitle}>{reviewed === STEPS.length ? 'Your setup reviews are complete. You can revisit any step below.' : 'Get ready for your first booking. Review each step at your own pace.'}</p>
        </div>
        <div className={styles.actions}>
          <a className={styles.primary} href="/dashboard/import">Import data <ArrowIcon /></a>
          {state && <button type="button" className={styles.collapse} aria-expanded={!!expanded} aria-controls="studio-setup-steps" disabled={saving || loading} onClick={() => update({ collapsed: !state.collapsed })}>{expanded ? 'Hide checklist' : 'Show checklist'}<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
        </div>
      </div>
      {state && <div className={styles.progressRow}>
        <div className={styles.progressTrack} role="progressbar" aria-label="Setup reviews" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={reviewed} aria-valuetext={`${reviewed} of ${STEPS.length} steps reviewed`}>
          <span style={{ width: `${reviewed / STEPS.length * 100}%` }} />
        </div>
        <p className={styles.progress} role="status"><strong>{reviewed} of {STEPS.length}</strong> steps reviewed{saving ? ' · Saving…' : ''}</p>
      </div>}
      {loading && <p className={styles.message} role="status">Loading setup progress…</p>}
      {error && <p className={styles.error} role="alert">{error} {!state && <button type="button" disabled={loading} onClick={load}>Try again</button>}</p>}
      {state && (
        <div id="studio-setup-steps" hidden={!expanded}>
          <ul className={styles.steps}>
            {STEPS.map((step, index) => {
              const status = state.steps?.[step.id] || 'pending';
              return (
                <li key={step.id} className={styles.step} data-status={status} data-next={nextStep?.id === step.id || undefined}>
                  <span className={styles.stepNumber} aria-hidden="true">{status === 'complete' ? <CheckIcon /> : String(index + 1).padStart(2, '0')}</span>
                  <div className={styles.stepCopy}>
                    <div className={styles.stepHeader}>
                      <h3 className={styles.stepTitle}>{step.title}</h3>
                      {status === 'skipped' ? <span className={styles.badge}>Skipped</span> : step.optional && <span className={styles.badge}>Optional</span>}
                    </div>
                    <p className={styles.description}>{step.description}</p>
                  </div>
                  <div className={styles.stepActions}>
                    <a href={step.href}>{step.action} <ArrowIcon /></a>
                  </div>
                  <div className={styles.reviewActions}>
                    <label className={styles.reviewControl}>
                      <input className={styles.reviewInput} type="checkbox" aria-label={`Mark ${step.title} as reviewed`} checked={status === 'complete'} disabled={saving || loading} onChange={event => update({ step: step.id, status: event.target.checked ? 'complete' : 'pending' })} />
                      <CheckIcon className={styles.reviewTick} />
                      <span>{status === 'complete' ? 'Reviewed' : 'Mark reviewed'}</span>
                    </label>
                    {step.optional && <button type="button" className={styles.skipButton} aria-pressed={status === 'skipped'} disabled={saving || loading} onClick={() => update({ step: step.id, status: status === 'skipped' ? 'pending' : 'skipped' })}>{status === 'skipped' ? 'Undo skip' : 'Not needed'}</button>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className={styles.footnote}>Mark each step reviewed after checking its settings. You can skip the optional steps.</p>
        </div>
      )}
    </section>
  );
}
