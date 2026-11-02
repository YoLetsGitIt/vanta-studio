'use client';

import { useEffect, useState } from 'react';
import { getStudioOnboarding, updateStudioOnboarding } from '@/lib/api';
import styles from './StudioSetupChecklist.module.css';

const STEPS = [
  { id: 'profile', title: 'Studio details', href: '/dashboard/settings?tab=studio', action: 'Review studio' },
  { id: 'hours', title: 'Hours & stations', href: '/dashboard/settings?tab=studio', action: 'Set hours and stations' },
  { id: 'artists', title: 'Artists', href: '/dashboard/artists?onboarding=1', action: 'Add artists' },
  { id: 'bookings', title: 'Bookings & consent', href: '/dashboard/settings?tab=bookings', action: 'Set up bookings' },
  { id: 'payments', title: 'Payments', href: '/dashboard/settings?tab=payments', action: 'Set up payments', optional: true },
  { id: 'import', title: 'Import clients', href: '/dashboard/import', action: 'Open importer', optional: true },
];

function CheckIcon({ className }) {
  return <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path pathLength="1" d="m5 10 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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
  const [animatedStep, setAnimatedStep] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try { setState(await getStudioOnboarding()); }
    catch (err) { setError(err.message || 'Could not load setup progress.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function update(change) {
    setAnimatedStep(null);
    setSaving(true);
    setError('');
    try {
      const saved = await updateStudioOnboarding(change);
      setState(saved);
      if (change.status === 'complete' && saved.steps?.[change.step] === 'complete') setAnimatedStep(change.step);
    }
    catch (err) { setError(err.message || 'Could not save setup progress. Please try again.'); }
    finally { setSaving(false); }
  }

  const done = STEPS.filter(step => ['complete', 'skipped'].includes(state?.steps?.[step.id])).length;
  const expanded = state && !state.collapsed;

  return (
    <section id="studio-setup" className={styles.card} aria-labelledby="studio-setup-title" aria-busy={loading || saving}>
      <div className={styles.compactHeader}>
        <h2 id="studio-setup-title">Studio setup</h2>
        {state && <p className={styles.progress} role="status">{done} of {STEPS.length} done{saving ? ' · Saving…' : ''}</p>}
        {state && <button type="button" className={styles.collapse} aria-label={expanded ? 'Hide checklist' : 'Show checklist'} aria-expanded={!!expanded} aria-controls="studio-setup-steps" disabled={saving || loading} onClick={() => update({ collapsed: !state.collapsed })}>{expanded ? 'Hide' : 'Show'}<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
      </div>
      {loading && <p className={styles.message} role="status">Loading setup progress…</p>}
      {error && <p className={styles.error} role="alert">{error} {!state && <button type="button" disabled={loading} onClick={load}>Try again</button>}</p>}
      {state && (
        <div id="studio-setup-steps" hidden={!expanded}>
          <ul className={styles.compactSteps}>
            {STEPS.map(step => {
              const status = state.steps?.[step.id] || 'pending';
              return (
                <li key={step.id} className={styles.compactStep} data-status={status}>
                  <button
                    type="button"
                    className={styles.completionButton}
                    data-animate={animatedStep === step.id || undefined}
                    onAnimationEnd={event => {
                      if (event.target.tagName.toLowerCase() === 'path') setAnimatedStep(current => current === step.id ? null : current);
                    }}
                    aria-label={`Complete ${step.title}`}
                    aria-pressed={status === 'complete'}
                    title={status === 'complete' ? 'Completed. Click to undo.' : `Complete ${step.title}`}
                    aria-disabled={saving || loading}
                    onClick={() => {
                      if (!saving && !loading) update({ step: step.id, status: status === 'complete' ? 'pending' : 'complete' });
                    }}
                  >
                    <span className={styles.completionMark} aria-hidden="true">{status === 'complete' && <CheckIcon />}</span>
                  </button>
                  <a className={styles.stepLink} href={step.href} aria-label={`${step.title}: ${step.action}`}>
                    <h3 className={styles.linkedTitle}>{step.title}</h3>
                    {status === 'skipped' ? <span className={styles.optional}>Skipped</span> : step.optional && <span className={styles.optional}>Optional</span>}
                    <ArrowIcon />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
