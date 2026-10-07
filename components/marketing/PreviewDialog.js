'use client';

import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import EmailPreview from './EmailPreview';
import styles from './marketing.module.css';

export default function PreviewDialog({ subject, body, onClose }) {
  return (
    <Dialog title="Email preview" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <p className={styles.hint}>Shown with a sample client name.</p>
      <EmailPreview subject={subject} body={body} className={styles.mailTall} />
    </Dialog>
  );
}
