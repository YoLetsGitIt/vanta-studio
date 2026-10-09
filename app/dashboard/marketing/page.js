'use client';

import { useCallback, useEffect, useState } from 'react';
import StatePanel from '@/components/ui/StatePanel';
import Button from '@/components/ui/Button';
import Templates from '@/components/marketing/Templates';
import Campaigns from '@/components/marketing/Campaigns';
import History from '@/components/marketing/History';
import MarketingSettings from '@/components/marketing/Settings';
import { getMarketing } from '@/lib/api';
import styles from '@/components/marketing/marketing.module.css';

const TABS = [['templates', 'Templates'], ['campaigns', 'Send emails'], ['history', 'Sent'], ['settings', 'Settings']];

export default function MarketingPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('templates');
  const [visited, setVisited] = useState(['templates']);

  const selectTab = useCallback(id => {
    setTab(id);
    setVisited(prev => prev.includes(id) ? prev : [...prev, id]);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);
  // Carries a template or a set of clients into the compose screen; a new object remounts it with those chosen.
  const [preset, setPreset] = useState({ key: 0 });

  const load = useCallback(async () => {
    try { setData(await getMarketing()); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const requested = params.has('mailbox') || params.get('tab') === 'sender' ? 'settings' : params.get('tab');
    if (TABS.some(([id]) => id === requested)) selectTab(requested);
  }, [load, selectTab]);

  if (error && !data) {
    return <main className={styles.page}><StatePanel tone="error" title="Couldn’t load marketing" description={error} action={<Button onClick={load}>Try again</Button>} /></main>;
  }
  if (!data) {
    return <main className={styles.page}><StatePanel busy title="Loading marketing…" /></main>;
  }

  const { available, ready } = data;
  const goSettings = () => { selectTab('settings'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const compose = next => { setPreset(prev => ({ ...next, key: prev.key + 1 })); selectTab('campaigns'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <main className={styles.page}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Marketing</h1>
          <p className={styles.subtitle}>Create email templates and send them to your clients.</p>
        </div>
      </header>

      <div role="tablist" aria-label="Marketing sections" className={styles.tabs}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={`${styles.tab} ${id === 'settings' ? styles.settingsTab : ''}`} onClick={() => selectTab(id)}>{label}</button>
        ))}
      </div>

      {TABS.filter(([id]) => visited.includes(id)).map(([id]) => (
        <div key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={tab !== id} className={styles.panel}>
          {id === 'templates' && <Templates available={available} ready={ready} onUse={templateId => compose({ templateId })} />}
          {id === 'campaigns' && <Campaigns key={preset.key} active={tab === id} preset={preset} available={available} ready={ready} onSent={() => { load(); selectTab('history'); }} onNeedSetup={goSettings} onEditTemplates={() => selectTab('templates')} />}
          {id === 'history' && <History active={tab === id} onCompose={() => selectTab('campaigns')} onResend={clientIds => compose({ clientIds })} />}
          {id === 'settings' && <MarketingSettings data={data} onReload={load} onTemplates={() => selectTab('templates')} onHistory={() => selectTab('history')} />}
        </div>
      ))}
    </main>
  );
}
