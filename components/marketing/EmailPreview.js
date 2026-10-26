'use client';

import { useLanguage } from '@/lib/i18n';

import { useEffect, useState } from 'react';
import { previewMarketingEmail } from '@/lib/api';
import styles from './marketing.module.css';

/** Renders the email as it will arrive. The last good preview stays up while a newer one loads. */
export default function EmailPreview({ subject, body, clientName, clientId, className = '' }) {
  const { t: mt } = useLanguage();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { setPreview(null); setError(''); }, [clientId, clientName]);

  useEffect(() => {
    if (!body.trim()) { setPreview(null); return undefined; }
    let active = true;
    const timer = setTimeout(() => {
      previewMarketingEmail(subject, body, clientName, clientId)
        .then(value => { if (active) { setPreview(value); setError(''); } })
        .catch(err => { if (active) setError(err.message); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [subject, body, clientName, clientId]);

  if (error) return <p className={styles.error} role="alert">{error}</p>;
  if (!preview) return <p role="status" className={styles.muted}>{mt("Loading preview…")}</p>;
  return (
    <div className={`${styles.mail} ${className}`.trim()}>
      <p className={styles.mailSubject}><span className={styles.mailLabel}>{mt("Subject")}</span>{preview.subject || '(no subject)'}</p>
      <iframe title={mt("Email preview")} className={styles.mailBody} sandbox="" srcDoc={preview.html} />
    </div>
  );
}
