'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatePanel from '@/components/ui/StatePanel';
import Button from '@/components/ui/Button';
import Templates from '@/components/marketing/Templates';
import Campaigns from '@/components/marketing/Campaigns';
import History from '@/components/marketing/History';
import SenderSettings from '@/components/marketing/SenderSettings';
import { getMarketing } from '@/lib/api';
import styles from '@/components/marketing/marketing.module.css';

const TABS = [['campaigns', 'Send emails'], ['history', 'Sent'], ['templates', 'Templates'], ['sender', 'Sender']];


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
  const [tab, setTab] = useState('campaigns');
  // Carries a template or a set of clients into the compose screen; a new object remounts it with those chosen.
  const [preset, setPreset] = useState({ key: 0 });

  const load = useCallback(async () => {
    try { setData(await getMarketing()); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); if (new URLSearchParams(window.location.search).has('mailbox')) setTab('sender'); }, [load]);

  if (error && !data) {
    return <main className={styles.page}><StatePanel tone="error" title="Couldn’t load marketing" description={error} action={<Button onClick={load}>Try again</Button>} /></main>;
  }
  if (!data) {
    return <main className={styles.page}><StatePanel busy title="Loading marketing…" /></main>;
  }

  const { stats, settings, available, ready } = data;
  const patchSettings = () => load();
  const goSender = () => { setTab('sender'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const compose = next => { setPreset(prev => ({ ...next, key: prev.key + 1 })); setTab('campaigns'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const hasClients = stats.consented_clients > 0;
  const inUse = stats.sent_this_month > 0;
  const steps = [
    { done: ready, title: 'Set up your sending email', hint: 'So client replies reach you.', action: <Button size="sm" onClick={goSender}>Add it</Button> },
    { done: hasClients, title: 'Choose who can be emailed', hint: 'Tick “agreed to marketing emails” on a client.', action: <Link href="/dashboard/clients" className="studio-button studio-button--secondary studio-button--sm">Go to clients</Link> },
    { done: inUse, title: 'Save a template and send an email', action: <Button size="sm" variant="secondary" onClick={() => setTab('templates')}>Write a template</Button> },
  ];
  const left = steps.filter(step => !step.done);

  return (
    <main className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Marketing</h1>
          <p className={styles.subtitle}>Email clients who’ve agreed to hear from you. Nobody else is ever contacted.</p>
        </div>
        <ul className={styles.stats} aria-label="Summary">
          <li><strong>{stats.consented_clients}</strong> can be emailed</li>
          <li><strong>{stats.sent_this_month}</strong> sent this month</li>
          {stats.unsubscribed > 0 && <li><strong>{stats.unsubscribed}</strong> unsubscribed</li>}
          {stats.failed_this_month > 0 && (
            <li><button type="button" className={styles.statBad} onClick={() => setTab('history')}><strong>{stats.failed_this_month}</strong> failed this month</button></li>
          )}
        </ul>
      </header>

      {!available && (
        <div className={styles.notice} role="status">
          <span><span className={styles.noticeStrong}>Sending is off for now.</span> You can set everything up, and nothing goes out until it’s switched on.</span>
        </div>
      )}

      {left.length === 1 && (
        <div className={`${styles.setup} ${styles.setupSlim}`} role="status">
          <span className={styles.stepText}><strong>One step left:</strong> {left[0].title.charAt(0).toLowerCase() + left[0].title.slice(1)}.</span>
          {left[0].action}
        </div>
      )}
      {left.length > 1 && (
        <section className={styles.setup} aria-labelledby="setup-title">
          <h2 className={styles.setupTitle} id="setup-title">Get started in 3 steps</h2>
          <ol className={styles.steps}>
            {steps.map((step, i) => <Step key={step.title} n={i + 1} {...step} />)}
          </ol>
        </section>
      )}

      <div role="tablist" aria-label="Marketing sections" className={styles.tabs}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={styles.tab} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className={styles.panel}>
        {tab === 'campaigns' && <Campaigns key={preset.key} preset={preset} available={available} ready={ready} onSent={() => { load(); setTab('history'); }} onNeedSetup={goSender} onEditTemplates={() => setTab('templates')} />}
        {tab === 'history' && <History onCompose={() => setTab('campaigns')} onResend={clientIds => compose({ clientIds })} />}
        {tab === 'templates' && <Templates available={available} ready={ready} onUse={templateId => compose({ templateId })} />}
        {tab === 'sender' && <SenderSettings settings={settings} available={available} domainAvailable={data.domain_available ?? available} onSaved={patchSettings} onReload={load} />}
      </div>
    </main>
  );
}
