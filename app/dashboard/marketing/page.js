'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatePanel from '@/components/ui/StatePanel';
import Button from '@/components/ui/Button';
import AutomationCard from '@/components/marketing/AutomationCard';
import Campaigns from '@/components/marketing/Campaigns';
import SenderSettings from '@/components/marketing/SenderSettings';
import { getMarketing } from '@/lib/api';
import styles from '@/components/marketing/marketing.module.css';

const TABS = [['automations', 'Automations'], ['campaigns', 'Campaigns'], ['sender', 'Sender']];
const EVENT_LABELS = { slot_opened: 'Slot opened', session_completed: 'Session completed' };

function Step({ done, n, title, hint, action }) {
  return (
    <li className={`${styles.step} ${done ? styles.stepDone : ''}`}>
      <span className={styles.stepMark} aria-hidden="true">{done ? '✓' : n}</span>
      <span className={styles.stepText}>{title}{hint && !done && <span className={styles.stepHint}>{hint}</span>}
        {done && <span className="sr-only"> (done)</span>}</span>
      {!done && action}
    </li>
  );
}

export default function MarketingPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('automations');

  const load = useCallback(async () => {
    try { setData(await getMarketing()); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error && !data) {
    return <main className={styles.page}><StatePanel tone="error" title="Couldn’t load marketing" description={error} action={<Button onClick={load}>Try again</Button>} /></main>;
  }
  if (!data) {
    return <main className={styles.page}><StatePanel busy title="Loading marketing…" /></main>;
  }

  const { stats, settings, automations, events, available, ready } = data;
  const patchSettings = next => setData(prev => ({ ...prev, settings: next, ready: Boolean(next.reply_to || (next.domain && next.domain_status === 'verified')) }));
  const patchAutomation = saved => setData(prev => ({ ...prev, automations: prev.automations.map(a => a.trigger_type === saved.trigger_type ? saved : a) }));
  const goSender = () => { setTab('sender'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const hasClients = stats.consented_clients > 0;
  const inUse = automations.some(a => a.enabled) || stats.sent_this_month > 0;
  const setupDone = ready && hasClients && inUse;

  return (
    <main className={styles.page}>
      <header>
        <h1 className={styles.title}>Marketing</h1>
        <p className={styles.subtitle}>Email clients who have agreed to hear from you. Only clients you’ve ticked are ever emailed.</p>
      </header>

      {!available && (
        <div className={styles.notice} role="status">
          <span><span className={styles.noticeStrong}>Sending is off for now.</span> You can set everything up, and nothing goes out until it’s switched on.</span>
        </div>
      )}

      {!setupDone && (
        <section className={styles.setup} aria-labelledby="setup-title">
          <h2 className={styles.setupTitle} id="setup-title">Get started in 3 steps</h2>
          <ol className={styles.steps}>
            <Step n="1" done={ready} title="Add a reply-to email" hint="So client replies reach you."
              action={<Button size="sm" onClick={goSender}>Add it</Button>} />
            <Step n="2" done={hasClients} title="Choose who can be emailed" hint="Tick “agreed to marketing emails” on a client."
              action={<Link href="/dashboard/clients" className="studio-button studio-button--secondary studio-button--sm">Go to clients</Link>} />
            <Step n="3" done={inUse} title="Turn on an automation or send a campaign"
              action={<Button size="sm" variant="secondary" onClick={() => setTab('campaigns')}>Send a campaign</Button>} />
          </ol>
        </section>
      )}

      <div className={styles.summary} aria-label="Summary">
        <span className={styles.summaryItem}><span className={`${styles.dot} ${styles.dotBlue}`} />{stats.consented_clients} can be emailed</span>
        <span className={styles.summaryItem}><span className={`${styles.dot} ${styles.dotGreen}`} />{stats.sent_this_month} sent this month</span>
        {stats.unsubscribed > 0 && <span className={styles.summaryItem}><span className={styles.dot} />{stats.unsubscribed} unsubscribed</span>}
        {stats.failed_this_month > 0 && <span className={styles.summaryItem}><span className={`${styles.dot} ${styles.dotRed}`} />{stats.failed_this_month} failed</span>}
      </div>

      <div role="tablist" aria-label="Marketing sections" className={styles.tabs}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={styles.tab} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tab === 'automations' && <>
          <p className={styles.hint} style={{ fontSize: '0.9rem' }}>Automations send emails for you when something happens. They’re off until you turn them on.</p>
          {automations.map(a => <AutomationCard key={a.trigger_type} automation={a} available={available} onSaved={patchAutomation} onNeedSetup={goSender} />)}
          {events.length > 0 && (
            <details className={styles.details}>
              <summary>Recent activity ({events.length})</summary>
              <div className={styles.detailsBody}>
                <ul className={styles.list}>
                  {events.map(e => (
                    <li key={e.id} className={styles.listRow}>
                      <span>{EVENT_LABELS[e.event_type] || e.event_type}{e.client_name ? ` · ${e.client_name}` : ''}
                        <span className={styles.rowSub}>{new Date(e.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                      <span className={styles.muted}>{e.sends > 0 ? `${e.sends} email${e.sends === 1 ? '' : 's'} queued` : 'No emails'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
        </>}
        {tab === 'campaigns' && <Campaigns available={available} ready={ready} onSent={load} onNeedSetup={goSender} />}
        {tab === 'sender' && <SenderSettings settings={settings} available={available} onSaved={patchSettings} />}
      </div>
    </main>
  );
}
