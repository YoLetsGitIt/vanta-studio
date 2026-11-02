import { Pill } from '@/components/ui/DetailParts';
import styles from './overview-panels.module.css';

export { Pill };
export function PreviewHeader({ title, label, children }) {
  return <header className={styles.header}><div><span className={styles.eyebrow}>{label}</span><h3>{title}</h3></div>{children&&<div className={styles.badges}>{children}</div>}</header>;
}
export function PreviewCard({ title, children }) {
  return <section className={styles.card}><h4>{title}</h4>{children}</section>;
}
export function PreviewRow({ label, children }) {
  return <div className={styles.row}><span>{label}</span><div>{children}</div></div>;
}
