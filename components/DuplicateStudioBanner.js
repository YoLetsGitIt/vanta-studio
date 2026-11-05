'use client';

import { useEffect, useState } from 'react';
import { acceptDuplicateStudio, dismissDuplicateStudio, getDuplicateStudios } from '@/lib/api';
import { showError } from '@/lib/feedback';

function names(list) {
  if (list.length <= 2) return list.join(' and ');
  return `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`;
}

// Artists sometimes type a studio into the app instead of finding it, which
// makes a second copy. This asks the studio to confirm and fold it in.
export default function DuplicateStudioBanner({ studioName, onAccepted }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    getDuplicateStudios().then(d => setItems(d.duplicates || [])).catch(() => {});
  }, []);

  async function act(item, accept) {
    setBusy(item.studio_id);
    try {
      const next = await (accept ? acceptDuplicateStudio : dismissDuplicateStudio)(item.studio_id);
      setItems(next.duplicates || []);
      if (accept) onAccepted?.();
    } catch (e) { showError(e); }
    finally { setBusy(''); }
  }

  if (!items.length) return null;
  return items.map(item => (
    <section key={item.studio_id} aria-label={`Possible duplicate: ${item.name}`} style={st.card}>
      <div style={{ minWidth: 0 }}>
        <p style={st.title}>{names(item.artists)} {item.artists.length === 1 ? 'lists' : 'list'} “{item.name}” as their studio</p>
        <p style={st.body}>{item.address ? `${item.address}. ` : ''}It looks like {studioName || 'your studio'}. Add them, and they’ll be connected to your studio with their schedule and bookings.</p>
      </div>
      <div style={st.actions}>
        <button type="button" disabled={Boolean(busy)} onClick={() => act(item, false)} style={st.secondary}>Not us</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => act(item, true)} style={st.primary}>{busy === item.studio_id ? 'Adding…' : item.artists.length === 1 ? 'Add artist' : 'Add artists'}</button>
      </div>
    </section>
  ));
}

const st = {
  card: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '1rem 1.25rem', marginBottom: '1rem', borderRadius: 12, border: '1px solid var(--accent-tint-border, var(--border-strong))', background: 'var(--bg-chip)' },
  title: { margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' },
  body: { margin: '0.3rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-muted)' },
  actions: { display: 'flex', gap: '0.5rem', flexShrink: 0 },
  primary: { padding: '0.55rem 1rem', minHeight: 40, borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' },
  secondary: { padding: '0.55rem 1rem', minHeight: 40, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' },
};
