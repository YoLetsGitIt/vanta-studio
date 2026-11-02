'use client';

import { useEffect, useState } from 'react';
import styles from './entry-button.module.css';

// The owner's door uses a tattoo needle; the artist's station uses a phone that
// buzzes with an incoming request. Same flash stamp, same ink press.
export default function StudioEntryButton({ onEnter, motion, label = 'Step inside', icon = 'needle' }) {
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (!pressed) return;
    const timer = setTimeout(() => setPressed(false), 700);
    return () => clearTimeout(timer);
  }, [pressed]);

  return <button className={styles.button} data-pressed={pressed} data-animated={motion} data-icon={icon}
    onClick={() => { if (!pressed) { setPressed(true); onEnter(); } }}>
    <span className={styles.ink} aria-hidden="true" />
    <svg className={styles.flash} viewBox="0 0 244 96" fill="none" aria-hidden="true">
      <path className={styles.outline} pathLength="1" d="M28 18H99L122 8L145 18H216L234 36V60L216 78H145L122 88L99 78H28L10 60V36Z" />
      <path className={styles.detail} d="M30 25H81M163 25H214L227 39V57L214 71H163M81 71H30L17 57V39M116 18L122 15L128 18M116 78L122 81L128 78" />
      {icon==='phone' ? <g className={styles.phone}>
        <g className={styles.phoneBody}>
          <path d="M41 24H53A3 3 0 0 1 56 27V67A3 3 0 0 1 53 70H41A3 3 0 0 1 38 67V27A3 3 0 0 1 41 24Z" />
          <path d="M44.5 28H49.5M45 65H49" />
          <path className={styles.phoneScreen} d="M41.5 33H52.5M41.5 38H50M41.5 43H52.5" />
          <circle className={styles.phoneBadge} cx="55" cy="25" r="3.2" />
        </g>
        <path className={styles.buzz} d="M32 38C30 42 30 50 32 54M61 38C63 42 63 50 61 54M28 34C25 41 25 51 28 58M65 34C68 41 68 51 65 58" />
      </g> : <g className={styles.needle}>
        <path d="M47 23V18M43 23H51L54 29V49L50 57H44L40 49V29ZM44 57L47 66L50 57M47 66V73" />
        <path d="M41 34H53M41 38H53M41 42H53M44 27H50M44 30H50" />
        <circle cx="47" cy="16" r="2" />
      </g>}
      <path className={styles.spark} d="M28 40V48M24 44H32M64 53V59M61 56H67" />
      <path className={styles.inkLine} pathLength="1" d="M86 61C113 63 169 63 211 60" />
      <path className={styles.tip} d="M205 56L211 60L207 65" />
    </svg>
    <span className={styles.label}>{label}</span>
  </button>;
}
