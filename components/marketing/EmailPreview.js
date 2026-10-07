'use client';

import { useEffect, useState } from 'react';
import { previewMarketingEmail } from '@/lib/api';
import styles from './marketing.module.css';

/** Renders the email as it will arrive. The last good preview stays up while a newer one loads. */
export default function EmailPreview({ subject, body, clientName, className = '' }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!body.trim()) { setPreview(null); return undefined; }
    let active = true;
    const timer = setTimeout(() => {
      previewMarketingEmail(subject, body, clientName)
        .then(value => { if (active) { setPreview(value); setError(''); } })
        .catch(err => { if (active) setError(err.message); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [subject, body, clientName]);

  if (error) return <p className={styles.error} role="alert">{error}</p>;
  if (!preview) return <p role="status" className={styles.muted}>Loading preview…</p>;
  return (
    <div className={`${styles.mail} ${className}`.trim()}>
      <p className={styles.mailSubject}><span className={styles.mailLabel}>Subject</span>{preview.subject || '(no subject)'}</p>
      <iframe title="Email preview" className={styles.mailBody} sandbox="" srcDoc={preview.html} />
    </div>
  );
}
