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
  const needsSetup = !ready || stats.consented_clients === 0;

  return (
    <main className={styles.page}>
      <header>
        <h1 className={styles.title}>Marketing</h1>
        <p className={styles.subtitle}>Email clients who have agreed to hear from you: fill cancelled slots, thank people after a session, or send a campaign.</p>
      </header>

      {!available && (
        <StatePanel tone="neutral" compact title="Email sending isn’t switched on yet"
          description="You can set everything up now. Nothing is sent until sending is enabled for Vanta." />
      )}
      {needsSetup && (
        <StatePanel tone="neutral" compact title="Finish setting up"
          description={[
            !ready && 'Add a reply-to email in the Sender tab.',
            stats.consented_clients === 0 && 'Mark which clients have agreed to marketing emails on the Clients page. Only they will ever be emailed.',
          ].filter(Boolean).join(' ')}
          action={<Link href="/dashboard/clients" className="studio-button studio-button--secondary studio-button--sm">Go to clients</Link>} />
      )}

      <div className={styles.stats}>
        {[['Opted-in clients', stats.consented_clients], ['Unsubscribed', stats.unsubscribed], ['Sent this month', stats.sent_this_month], ['Failed this month', stats.failed_this_month]].map(([label, value]) => (
          <div key={label} className={styles.stat}><div className={styles.statValue}>{value}</div><div className={styles.statLabel}>{label}</div></div>
        ))}
      </div>

      <div role="tablist" aria-label="Marketing sections" className={styles.tabs}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={styles.tab} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {tab === 'automations' && <>
          {automations.map(a => <AutomationCard key={a.trigger_type} automation={a} available={available} onSaved={patchAutomation} />)}
          <section className={styles.card} aria-labelledby="recent-triggers">
            <h2 className={styles.cardTitle} id="recent-triggers">Recent activity</h2>
            {events.length === 0 ? <p className={styles.muted}>Nothing yet. Cancellations and completed sessions will show up here.</p> : (
              <ul className={styles.list}>
                {events.map(e => (
                  <li key={e.id} className={styles.listRow}>
                    <span>{EVENT_LABELS[e.event_type] || e.event_type}{e.client_name ? ` · ${e.client_name}` : ''}
                      <span className={styles.muted}> {new Date(e.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                    <span className={styles.muted}>{e.sends > 0 ? `${e.sends} email${e.sends === 1 ? '' : 's'} queued` : 'No emails'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>}
        {tab === 'campaigns' && <Campaigns available={available} ready={ready} onSent={load} />}
        {tab === 'sender' && <SenderSettings settings={settings} available={available} onSaved={patchSettings} />}
      </div>
    </main>
  );
}
