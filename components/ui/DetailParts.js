'use client';

import styles from './DetailParts.module.css';

// Shared building blocks for the booking and client detail panels.

const toneColors = tone => ({ bg: `var(--color-${tone}-surface)`, text: `var(--color-${tone})`, border: `var(--color-${tone}-border)` });

export const detailStyles = {
  section: {
    display: 'flex', flexDirection: 'column', gap: '0.7rem',
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem 1.1rem',
  },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' },
  sectionTitle: { margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' },
  fact: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' },
  factBlock: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  factLabel: { fontSize: '0.875rem', color: 'var(--text-muted)', flexShrink: 0 },
  factValue: { fontSize: '0.95rem', color: 'var(--text)', textAlign: 'right', lineHeight: 1.45, overflowWrap: 'anywhere', minWidth: 0 },
  factValueBlock: { fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  factStrong: { fontWeight: 700, fontSize: '1.05rem' },
  subLabel: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dim)' },
  hint: { fontSize: '0.85rem', color: 'var(--text-muted)' },
  textLink: { background: 'none', border: 'none', padding: 0, color: 'var(--color-info)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  smallAction: { background: 'var(--color-info-surface)', border: '1px solid var(--color-info-border)', borderRadius: 20, padding: '0.2rem 0.7rem', color: 'var(--color-info)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  smallActionDone: { background: 'var(--color-success-surface)', borderColor: 'var(--color-success-border)', color: 'var(--color-success)' },
  subCard: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 0.95rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  noteInput: {
    width: '100%', resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '0.65rem 0.8rem', fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.5,
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
};

const d = detailStyles;

export function Pill({ tone, colors, children }) {
  const c = colors ?? (tone ? toneColors(tone) : { bg: 'var(--bg-chip)', text: 'var(--text-dim)', border: 'var(--border-strong)' });
  return <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: 20, background: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{children}</span>;
}

export function Section({ title, aside, children }) {
  return (
    <section style={d.section}>
      <div style={d.sectionHead}>
        <h3 style={d.sectionTitle}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

// One fact per line: label on the left, value on the right. `block` stacks long text under its label.
export function Fact({ label, children, value, block = false, strong = false }) {
  const content = children ?? value;
  if (!content && content !== 0) return null;
  return (
    <div style={block ? d.factBlock : d.fact}>
      <span style={d.factLabel}>{label}</span>
      <span style={{ ...(block ? d.factValueBlock : d.factValue), ...(strong ? d.factStrong : {}) }}>{content}</span>
    </div>
  );
}

/** Compact on/off switch. Give it an aria-label; it is a real checkbox underneath. */
export function Switch({ checked, disabled, onChange, ...props }) {
  return <input {...props} type="checkbox" role="switch" className={styles.switch} checked={checked} disabled={disabled} onChange={e => onChange?.(e.target.checked)} />;
}

export function SkeletonBar({ w = '100%', h = 14 }) {
  return <span className={`skeleton ${styles.bar}`} style={{ width: w, height: h }} aria-hidden="true" />;
}

/** Placeholder that mirrors the real panel layout while its data loads. */
export function DetailSkeleton({ label = 'Loading details…', stats = false, hero = false, cards = 3 }) {
  return (
    <div className={styles.skeletonWrap} role="status" aria-busy="true" aria-label={label}>
      {hero && <div className={styles.card}><SkeletonBar w="35%" h={12} /><SkeletonBar w="70%" h={24} /><SkeletonBar w="55%" h={14} /></div>}
      {stats && (
        <div className={styles.statRow}>
          {[0, 1, 2].map(i => <div key={i} className={styles.card} style={{ padding: '0.8rem 0.9rem', gap: '0.5rem' }}><SkeletonBar w="40%" h={22} /><SkeletonBar w="80%" h={11} /></div>)}
        </div>
      )}
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className={styles.card}>
          <SkeletonBar w="34%" h={16} />
          {[0, 1, 2].map(j => <div key={j} className={styles.line}><SkeletonBar w="26%" h={12} /><SkeletonBar w={`${30 + ((i + j) % 3) * 12}%`} h={12} /></div>)}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
