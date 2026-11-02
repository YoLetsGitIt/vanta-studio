import { PreviewHeader, PreviewCard } from './StudioPreviewParts';
import styles from './overview-panels.module.css';

export default function FormOverview() {
  return <div className={styles.panel} data-theme="dark">
    <PreviewHeader label="SETTINGS" title="Booking widget" />
    <section className={styles.colours} aria-label="Example website colour settings">
      <div><span>Background</span><div className={styles.colourValue}><i style={{background:'#121212'}}/>#121212</div></div>
      <div><span>Highlight</span><div className={styles.colourValue}><i style={{background:'#d5d0c7'}}/>#D5D0C7</div></div>
    </section>
    <PreviewCard title="Form fields">
      <div className={styles.fieldRow}><span>Design description</span><small>Required</small><span className={styles.enabled}>✓ Enabled</span></div>
      <div className={styles.fieldRow}><span>Placement</span><small>Optional</small><span className={styles.enabled}>✓ Enabled</span></div>
      <div className={styles.fieldRow}><span>Reference photos</span><small>Optional</small><span className={styles.enabled}>✓ Enabled</span></div>
    </PreviewCard>
    <section className={styles.linkCard}><div><h4>Booking link</h4><p>Instagram bio · Website · QR code</p></div><span aria-hidden="true">↗</span></section>
    <p className={styles.note}>Your colours, your fields, your required answers.</p>
  </div>;
}
