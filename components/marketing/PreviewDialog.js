'use client';

import { useEffect, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { previewMarketingEmail } from '@/lib/api';
import styles from './marketing.module.css';

export default function PreviewDialog({ subject, body, onClose }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    previewMarketingEmail(subject, body)
      .then(value => { if (active) setPreview(value); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [subject, body]);

  return (
    <Dialog title="Email preview" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!preview && !error && <p role="status" className={styles.muted}>Loading preview…</p>}
      {preview && <>
        <p className={styles.desc}><strong>Subject:</strong> {preview.subject}</p>
        <p className={styles.hint}>Shown with a sample client name and appointment time.</p>
        <iframe title="Email preview" className={styles.preview} sandbox="" srcDoc={preview.html} />
      </>}
    </Dialog>
  );
}
