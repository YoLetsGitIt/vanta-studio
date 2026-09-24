'use client';

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
