import { Signature } from './OverviewArtwork';
import { PreviewHeader, PreviewCard, PreviewRow, Pill } from './StudioPreviewParts';
import styles from './overview-panels.module.css';

export default function ConsentOverview() {
  return <div className={styles.panel} data-theme="dark">
    <PreviewHeader label="CLIENT DETAILS" title="Mia Carter"><Pill tone="success">Consented</Pill></PreviewHeader>
    <PreviewCard title="Tattoo consent">
      <p className={styles.cardIntro}>Your wording, questions and required answers.</p>
      <div className={styles.topics}><span>Health information</span><span>Studio terms</span><span>Client signature</span></div>
    </PreviewCard>
    <PreviewCard title="Consent">
      <PreviewRow label="Consent form"><Pill tone="success">Consented</Pill></PreviewRow>
      <div className={styles.signature}><span>Signed by Mia Carter</span><Signature/></div>
    </PreviewCard>
    <p className={styles.note}>Send a link to sign.<br/>The signed form stays with the client’s record.</p>
  </div>;
}
