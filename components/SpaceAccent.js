import styles from './SpaceAccent.module.css';

// Quiet, non-interactive chrome decoration matching the phone's Space motif.
export default function SpaceAccent({ preview = false }) {
  return <svg className={styles.accent} data-preview={preview || undefined} viewBox="0 0 64 40" fill="none" aria-hidden="true" focusable="false">
    <path d="m44 3 2.2 6.8L53 12l-6.8 2.2L44 21l-2.2-6.8L35 12l6.8-2.2L44 3Z" fill="#a99cff" />
    <path d="m12 5 1.2 3.8L17 10l-3.8 1.2L12 15l-1.2-3.8L7 10l3.8-1.2L12 5Z" fill="#a99cff" opacity=".7" />
    <circle cx="25" cy="27" r="6" fill="#d959d9" />
    <ellipse cx="25" cy="27" rx="12" ry="3.5" transform="rotate(-20 25 27)" stroke="#d959d9" strokeWidth="1.3" />
    <circle cx="56" cy="31" r="3" fill="#59bffa" />
    <circle cx="30" cy="6" r="1" fill="#edf0fa" />
    <circle cx="59" cy="17" r="1" fill="#edf0fa" />
  </svg>;
}
