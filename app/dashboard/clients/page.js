'use client';

import { useState, useEffect, useMemo } from 'react';
import { listBookings } from '@/lib/api';
import { getCached, setCached } from '@/lib/cache';

export default function ClientsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const key = 'bookings:';
      const cached = getCached(key);
      if (cached) { setBookings(cached); setLoading(false); return; }
      try {
        const data = await listBookings('');
        const b = data.bookings ?? [];
        setCached(key, b);
        setBookings(b);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const clients = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      const key = b.requester_email || b.requester_name;
      if (!map.has(key)) {
        map.set(key, {
          name: b.requester_name,
          email: b.requester_email,
          phone: b.requester_phone,
          bookings: [],
          lastBooking: null,
        });
      }
      const client = map.get(key);
      client.bookings.push(b);
      const date = b.chosen_time || b.proposed_time_primary || b.created_at;
      if (date && (!client.lastBooking || new Date(date) > new Date(client.lastBooking))) {
        client.lastBooking = date;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (!a.lastBooking) return 1;
      if (!b.lastBooking) return -1;
      return new Date(b.lastBooking) - new Date(a.lastBooking);
    });
  }, [bookings]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q),
    );
  }, [clients, search]);

  const selectedClient = selected ? filtered.find(c => (c.email || c.name) === selected) : null;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Clients</h1>
        <div style={s.searchWrap}>
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={s.searchInput}
          />
        </div>
      </div>

      <div style={s.layout}>
        <div style={s.list}>
          {loading && <p style={s.msg}>Loading…</p>}
          {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p style={s.msg}>No clients found.</p>
          )}
          {filtered.map(client => {
            const key = client.email || client.name;
            const active = selected === key;
            const completedCount = client.bookings.filter(b => b.status === 'completed').length;
            return (
              <div
                key={key}
                onClick={() => setSelected(prev => prev === key ? null : key)}
                style={{ ...s.row, background: active ? 'rgba(255,255,255,0.04)' : undefined, borderColor: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)' }}
              >
                <div style={s.clientAvatar}>
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div style={s.clientInfo}>
                  <span style={s.clientName}>{client.name}</span>
                  <span style={s.clientMeta}>
                    {client.email || client.phone || '—'}
                  </span>
                </div>
                <div style={s.clientStats}>
                  <span style={s.sessionCount}>{client.bookings.length} session{client.bookings.length !== 1 ? 's' : ''}</span>
                  {client.lastBooking && (
                    <span style={s.lastSeen}>
                      {new Date(client.lastBooking).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedClient && (
          <ClientDetail client={selectedClient} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}

function ClientDetail({ client, onClose }) {
  const sorted = [...client.bookings].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );

  const STATUS_COLORS = {
    pending:   '#f59e3a',
    proposed:  '#6fa3e8',
    confirmed: '#4cc98a',
    completed: 'rgba(255,255,255,0.4)',
    cancelled: 'rgba(255,255,255,0.2)',
    rejected:  '#e86f6f',
  };

  return (
    <aside style={s.panel}>
      <div style={s.panelHeader}>
        <span style={s.panelTitle}>{client.name}</span>
        <button onClick={onClose} style={s.closeBtn}>✕</button>
      </div>
      <div style={s.panelBody}>
        {client.email && <Field label="Email">{client.email}</Field>}
        {client.phone && <Field label="Phone">{client.phone}</Field>}
        <Field label="Total sessions">{client.bookings.length}</Field>
        <Field label="Completed">{client.bookings.filter(b => b.status === 'completed').length}</Field>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          <span style={s.sectionLabel}>Booking history</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem' }}>
            {sorted.map(b => (
              <div key={b.id} style={s.historyRow}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>
                    {capitalise(b.session_type.replace(/_/g, ' '))} · {b.body_location}
                  </span>
                  <span style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.35)' }}>
                    {new Date(b.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: STATUS_COLORS[b.status] ?? '#fff' }}>
                  {capitalise(b.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>{children}</span>
    </div>
  );
}

function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

const s = {
  page: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '1.75rem 2rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.01em',
  },
  searchWrap: {
    maxWidth: 360,
  },
  searchInput: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '0.55rem 0.85rem',
    fontSize: '0.85rem',
    color: '#ffffff',
    outline: 'none',
  },
  layout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    position: 'relative',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  msg: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.35)',
    padding: '0.5rem 0',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.85rem 1rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s',
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.875rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clientInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0,
  },
  clientName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#ffffff',
  },
  clientMeta: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clientStats: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.2rem',
    flexShrink: 0,
  },
  sessionCount: {
    fontSize: '0.78rem',
    color: 'rgba(245,236,217,0.6)',
    fontWeight: 600,
  },
  lastSeen: {
    fontSize: '0.72rem',
    color: 'rgba(255,255,255,0.25)',
  },
  panel: {
    width: 300,
    flexShrink: 0,
    background: '#0f151e',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 1.25rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  panelBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  historyRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
};
