'use client';

// "Show: Artists | Stations" for the schedule. The page provides the value; each
// view puts the switch in its own filter row.
import { createContext, useContext } from 'react';
import { useLanguage } from '@/lib/i18n';
import styles from './ScheduleLensSwitch.module.css';

export const ScheduleLensContext = createContext(null);

export default function ScheduleLensSwitch() {
  const ctx = useContext(ScheduleLensContext);
  const { t } = useLanguage();
  if (!ctx) return null;
  const { lens, setLens } = ctx;
  return (
    <div className={`studio-schedule-lens ${styles.wrap}`} role="group" aria-labelledby="schedule-show-by">
      <span id="schedule-show-by" className={styles.label}>Show</span>
      <div className={styles.switch}>
        <button type="button" aria-pressed={lens === 'artist'} onClick={() => setLens('artist')}>{t('nav_artists')}</button>
        <button type="button" aria-pressed={lens === 'station'} onClick={() => setLens('station')}>{t('stations')}</button>
      </div>
    </div>
  );
}
