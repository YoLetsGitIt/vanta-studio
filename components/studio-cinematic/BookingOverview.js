import { PreviewHeader, PreviewCard, PreviewRow, Pill } from './StudioPreviewParts';
import styles from './overview-panels.module.css';

export default function BookingOverview() {
  return <div className={styles.panel} data-theme="dark">
    <PreviewHeader label="BOOKING DETAILS" title="Mia Carter"><Pill tone="success">Confirmed</Pill><Pill>Studio</Pill></PreviewHeader>
    <section className={styles.appointment} aria-label="Example confirmed appointment"><span>Appointment</span><strong>9 Oct · 1:00 pm</strong><p>2 hrs · Alex Morgan</p><div>Fine-line botanical · Forearm</div></section>
    <PreviewCard title="Payment">
      <PreviewRow label="Quoted price"><strong>$350</strong></PreviewRow>
      <div className={styles.deposit}><PreviewRow label="Deposit"><Pill tone="success">Confirmed</Pill></PreviewRow><strong>$100.00</strong><span>Paid by client</span></div>
    </PreviewCard>
    <p className={styles.note}>Client suggests times. Artist selects.<br/>The deposit confirms the booking.</p>
  </div>;
}
