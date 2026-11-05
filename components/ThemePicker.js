'use client';

import { useLanguage } from '@/lib/i18n';
import styles from './ThemePicker.module.css';

export default function ThemePicker({ value, onChange }) {
  const { t } = useLanguage();
  return <div>
    <p className={styles.hint}>{t('theme_device_hint')}</p>
    <div className={styles.options} role="group" aria-label={t('appearance')}>
      {['dark', 'light', 'nature'].map(theme => (
        <button key={theme} type="button" className={styles.option} aria-pressed={value === theme} onClick={() => onChange(theme)}>
          <span className={styles.preview} data-theme={theme} aria-hidden="true">
            <span className={styles.sidebar} /><span className={styles.card}><i /><i /><b /></span>
          </span>
          <span className={styles.label}>{t(`theme_${theme}`)}<span aria-hidden="true">{value === theme ? '✓' : ''}</span></span>
        </button>
      ))}
    </div>
  </div>;
}
