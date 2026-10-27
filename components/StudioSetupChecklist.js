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

export function StudioSetupLinks() {
  return (
    <aside className={styles.shortcuts} aria-label="Studio setup shortcuts">
      <div><strong>Studio setup</strong><p>Finish your checklist or bring across existing clients and bookings.</p></div>
      <div className={styles.actions}>
        <a className={styles.secondary} href="/dashboard/home#studio-setup">Setup checklist</a>
        <a className={styles.primary} href="/dashboard/import">Import data <span aria-hidden="true">↗</span></a>
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

  return (
    <section id="studio-setup" className={styles.card} aria-labelledby="studio-setup-title" aria-busy={loading || saving}>
      <div className={styles.header}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>GET STARTED</span>
          <h2 id="studio-setup-title">Studio setup checklist</h2>
          {state && <p className={styles.progress} role="status">{reviewed} of {STEPS.length} steps reviewed{saving ? ' · Saving…' : ''}</p>}
        </div>
        <div className={styles.actions}>
          <a className={styles.primary} href="/dashboard/import">Import data <span aria-hidden="true">↗</span></a>
          {state && <button type="button" className={styles.secondary} aria-expanded={!!expanded} aria-controls="studio-setup-steps" disabled={saving || loading} onClick={() => update({ collapsed: !state.collapsed })}>{expanded ? 'Hide checklist' : 'Show checklist'}</button>}
        </div>
      </div>
      {loading && <p className={styles.message} role="status">Loading setup progress…</p>}
      {error && <p className={styles.error} role="alert">{error} {!state && <button type="button" disabled={loading} onClick={load}>Try again</button>}</p>}
      {state && (
        <div id="studio-setup-steps" hidden={!expanded}>
          <p className={styles.message}>Work through these at your own pace. Mark each step once you&apos;ve reviewed it.</p>
          <ul className={styles.steps}>
            {STEPS.map(step => {
              const status = state.steps?.[step.id] || 'pending';
              return (
                <li key={step.id} className={`${styles.step} ${status !== 'pending' ? styles.reviewed : ''}`}>
                  <label className={styles.check}>
                    <input type="checkbox" aria-label={`Mark ${step.title} as reviewed`} checked={status === 'complete'} disabled={saving || loading} onChange={event => update({ step: step.id, status: event.target.checked ? 'complete' : 'pending' })} />
                    <span className={styles.stepTitle}>{step.title}{step.optional && <small>Optional</small>}</span>
                  </label>
                  <p className={styles.description}>{step.description}</p>
                  <div className={styles.stepActions}>
                    <a href={step.href}>{step.action} <span aria-hidden="true">→</span></a>
                    {step.optional && <button type="button" aria-pressed={status === 'skipped'} disabled={saving || loading} onClick={() => update({ step: step.id, status: status === 'skipped' ? 'pending' : 'skipped' })}>{status === 'skipped' ? 'Undo skip' : 'Not needed'}</button>}
                    {status === 'skipped' && <span className={styles.skipped}>Skipped</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
