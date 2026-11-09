import styles from './BrandLoader.module.css';

// Full-screen loader for client forms. Matches the loader on vanta.tattoo
// (website components/BrandLoader.js), which shows first for short links.
export default function BrandLoader({ label = 'Loading' }) {
  return (
    <div className={styles.screen} role="status" aria-label={label}>
      <span className={styles.wordmark} style={{ fontSize: 34, letterSpacing: -2 }} aria-hidden="true">
        vanta<span className={`${styles.dot} ${styles.pulse}`}>.</span>
      </span>
      <span className={styles.track} aria-hidden="true"><span className={styles.bar} /></span>
    </div>
  );
}
