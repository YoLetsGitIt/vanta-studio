'use client';

import { useEffect, useState } from 'react';
import { dismissDuplicateClients, getDuplicateClients, mergeDuplicateClients } from '@/lib/api';
import { showError } from '@/lib/feedback';

// Clients sharing a phone number. Certain matches are merged automatically, so what
// reaches here needs a person to decide: a parent and child can share a phone.
function keepFirst(pair) {
  if (pair.a.has_account !== pair.b.has_account) return pair.a.has_account ? [pair.a, pair.b] : [pair.b, pair.a];
  return pair.a.booking_count >= pair.b.booking_count ? [pair.a, pair.b] : [pair.b, pair.a];
}

function plural(count) {
  return `${count} ${count === 1 ? 'booking' : 'bookings'}`;
}

function Person({ client }) {
  return (
    <div style={st.person}>
      <span style={st.name}>{client.name}</span>
      <span style={st.detail}>{client.email || 'No email'} · {plural(client.booking_count)}{client.has_account ? ' · Vanta account' : ''}</span>
    </div>
  );
}

export default function DuplicateClientsReview({ onMerged }) {
  const [pairs, setPairs] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    getDuplicateClients().then(d => setPairs(d.pairs || [])).catch(() => {});
  }, []);

  async function act(key, action, merged) {
    setBusy(key);
    try {
      await action();
      const next = await getDuplicateClients();
      setPairs(next.pairs || []);
      if (merged) onMerged?.();
    } catch (e) { showError(e); }
    finally { setBusy(''); }
  }

  if (!pairs.length) return null;
  return (
    <section aria-label="Possible duplicate clients" style={st.card}>
      <div style={st.head}>
        <div style={{ minWidth: 0 }}>
          <p style={st.title}>{pairs.length === 1 ? '1 possible duplicate client' : `${pairs.length} possible duplicate clients`}</p>
          <p style={st.body}>These clients share a phone number. Merge them if they’re one person.</p>
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} style={st.secondary}>{open ? 'Hide' : 'Review'}</button>
      </div>
      {open && (
        <ul style={st.list}>
          {pairs.map(pair => {
            const [keep, merge] = keepFirst(pair);
            const key = `${pair.a.id}:${pair.b.id}`;
            const bothAccounts = pair.a.has_account && pair.b.has_account;
            return (
              <li key={key} style={st.row}>
                <div style={st.people}>
                  <Person client={keep} />
                  <Person client={merge} />
                  <span style={st.detail}>{keep.phone}</span>
                </div>
                <div style={st.actions}>
                  <button type="button" disabled={Boolean(busy)} onClick={() => act(key, () => dismissDuplicateClients(pair.a.id, pair.b.id))} style={st.secondary}>Different people</button>
                  <button type="button" disabled={Boolean(busy) || bothAccounts} title={bothAccounts ? 'Each has their own Vanta account' : undefined}
                    onClick={() => act(key, () => mergeDuplicateClients(keep.id, merge.id), true)} style={{ ...st.primary, opacity: bothAccounts ? 0.5 : 1 }}>
                    {busy === key ? 'Saving…' : `Merge into ${keep.name}`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const st = {
  card: { padding: '1rem 1.25rem', marginBottom: '1rem', borderRadius: 12, border: '1px solid var(--accent-tint-border, var(--border-strong))', background: 'var(--bg-chip)' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' },
  body: { margin: '0.3rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-muted)' },
  list: { listStyle: 'none', margin: '0.85rem 0 0', padding: 0, display: 'grid', gap: '0.6rem' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '0.75rem 0.85rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-modal)' },
  people: { display: 'grid', gap: '0.35rem', minWidth: 0, flex: '1 1 240px' },
  person: { display: 'grid', minWidth: 0 },
  name: { fontSize: '0.875rem', fontWeight: 650, color: 'var(--text)', overflowWrap: 'anywhere' },
  detail: { fontSize: '0.8rem', color: 'var(--text-muted)', overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' },
  actions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  primary: { padding: '0.55rem 1rem', minHeight: 40, borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' },
  secondary: { padding: '0.55rem 1rem', minHeight: 40, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' },
};
