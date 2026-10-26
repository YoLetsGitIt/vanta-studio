'use client';

import { useLanguage } from '@/lib/i18n';

import { useCallback, useEffect, useState } from 'react';
import StatePanel from '@/components/ui/StatePanel';
import Button from '@/components/ui/Button';
import Templates from '@/components/marketing/Templates';
import MarketingSettings from '@/components/marketing/Settings';
import History from '@/components/marketing/History';
import { getMarketing } from '@/lib/api';
import styles from '@/components/marketing/marketing.module.css';

const SECTIONS = ['templates', 'history', 'settings'];
const SECTION_COPY = {
  templates: ['Create and send', 'Write a template and choose your clients.'],
  history: ['Sent emails', 'See past emails and their delivery status.'],
  settings: ['Settings', 'Manage your sending email and connections.'],
};

function SectionIcon({ section }) {
  return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {section === 'templates' && <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 7 9 6 9-6" /></>}
    {section === 'history' && <><path d="m21 3-7 18-4-7-7-4Z" /><path d="m10 14 5-5" /></>}
    {section === 'settings' && <><path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>;
}

export default function MarketingPage() {
  const { t: mt } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('templates');
  const [visited, setVisited] = useState(['templates']);
  const selectTab = useCallback((id, focusPanel = true) => {
    setTab(id);
    setVisited(prev => prev.includes(id) ? prev : [...prev, id]);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    if (focusPanel) requestAnimationFrame(() => {
      const panel = document.getElementById(`panel-${id}`);
      panel?.closest('main')?.scrollIntoView({ block: 'start' });
      panel?.focus({ preventScroll: true });
    });
  }, []);
  // Resending from history starts a fresh flow with those clients selected.
  const [preset, setPreset] = useState({ key: 0 });

  const load = useCallback(async () => {
    try { setData(await getMarketing()); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const legacyTab = params.get('tab');
    const requested = params.has('mailbox') || legacyTab === 'sender' ? 'settings'
      : legacyTab === 'campaigns' ? 'templates' : legacyTab;
    if (SECTIONS.includes(requested)) selectTab(requested);
  }, [load, selectTab]);

  if (error && !data) {
    return <main className={styles.page}><StatePanel tone="error" title={mt("Couldn’t load marketing")} description={error} action={<Button onClick={load}>{mt("Try again")}</Button>} /></main>;
  }
  if (!data) {
    return <main className={styles.page}><StatePanel busy title={mt("Loading marketing…")} /></main>;
  }

  const { available, ready } = data;
  const goSettings = () => selectTab('settings');
  const compose = clientIds => { setPreset(prev => ({ clientIds, key: prev.key + 1 })); selectTab('templates'); };
  function navigateTabs(event, id) {
    const index = SECTIONS.indexOf(id);
    const next = { ArrowRight: (index + 1) % SECTIONS.length, ArrowLeft: (index + SECTIONS.length - 1) % SECTIONS.length, Home: 0, End: SECTIONS.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTab(SECTIONS[next], false);
    document.getElementById(`tab-${SECTIONS[next]}`)?.focus();
  }

  return (
    <main data-marketing-view={tab} className={`${styles.page} ${styles.workspacePage}`}>
      <header className={`${styles.pageHead} ${styles.marketingHead}`}>
        <h1 className={styles.title}>{mt("Marketing")}</h1>
        <p className={styles.subtitle}>{mt("Create email templates and send them to your clients.")}</p>
      </header>

      <div role="tablist" aria-label={mt('Marketing sections')} className={styles.sectionTabs}>
        {SECTIONS.map(id => <button key={id} type="button" role="tab" id={`tab-${id}`} aria-labelledby={`tab-${id}-title`} aria-selected={tab === id} aria-controls={`panel-${id}`} aria-describedby={`tab-${id}-description`} tabIndex={tab === id ? 0 : -1} className={styles.sectionTab} onClick={() => selectTab(id, false)} onKeyDown={event => navigateTabs(event, id)}>
          <span className={styles.sectionTabIcon}><SectionIcon section={id} /></span>
          <span className={styles.sectionTabText}>
            <span id={`tab-${id}-title`} className={styles.sectionTabTitle}>{mt(SECTION_COPY[id][0])}</span>
            <span id={`tab-${id}-description`} className={styles.sectionTabDescription}>{mt(SECTION_COPY[id][1])}</span>
          </span>
          <span className={styles.sectionTabSelected} aria-hidden="true">✓</span>
        </button>)}
      </div>

      {SECTIONS.map(id => (
        <section key={id} id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} tabIndex={0} hidden={tab !== id} className={styles.panel}>
          {visited.includes(id) && <>
            {id === 'templates' && <Templates key={preset.key} preset={preset} available={available} ready={ready} onSent={load} onNeedSetup={goSettings} />}
            {id === 'history' && <>
              <div><h2 className={styles.cardTitle}>{mt('Sent emails')}</h2><p className={styles.desc}>{mt(SECTION_COPY.history[1])}</p></div>
              <History active={tab === id} onCompose={() => selectTab('templates')} onResend={compose} />
            </>}
            {id === 'settings' && <MarketingSettings data={data} onReload={load} onTemplates={() => selectTab('templates')} onHistory={() => selectTab('history')} />}
          </>}
        </section>
      ))}
    </main>
  );
}
