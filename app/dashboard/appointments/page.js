'use client';

import { useState, useEffect, useCallback } from 'react';
import { listBookings, proposeBooking, acceptBooking, rejectBooking, recordOutcome } from '@/lib/api';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'proposed', label: 'Proposed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS = {
  pending:   { bg: 'rgba(245,158,58,0.12)',  text: '#f59e3a', border: 'rgba(245,158,58,0.25)' },
  proposed:  { bg: 'rgba(111,163,232,0.12)', text: '#6fa3e8', border: 'rgba(111,163,232,0.25)' },
  confirmed: { bg: 'rgba(76,201,138,0.12)',  text: '#4cc98a', border: 'rgba(76,201,138,0.25)' },
  completed: { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.1)' },
  cancelled: { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.3)', border: 'rgba(255,255,255,0.07)' },
  rejected:  { bg: 'rgba(232,111,111,0.1)',  text: '#e86f6f', border: 'rgba(232,111,111,0.2)' },
};

export default function AppointmentsPage() {
  const [filter, setFilter] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listBookings(filter);
      setBookings(data.bookings ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleAccept(id) {
    setActionLoading(true);
    try { await acceptBooking(id); await load(); setSelected(null); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleReject(id) {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    setActionLoading(true);
    try { await rejectBooking(id, reason); await load(); setSelected(null); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleComplete(id) {
    setActionLoading(true);
    try { await recordOutcome(id, 'completed'); await load(); setSelected(null); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(false); }
  }

  const selectedBooking = selected ? bookings.find(b => b.id === selected) : null;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Appointments</h1>
        <div style={s.filters}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{ ...s.filterBtn, ...(filter === f.value ? s.filterActive : {}) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={s.body}>
        {loading && <p style={s.msg}>Loading…</p>}
        {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
        {!loading && !error && bookings.length === 0 && (
          <p style={s.msg}>No appointments found.</p>
        )}
        {!loading && bookings.map(b => (
          <BookingRow
            key={b.id}
            booking={b}
            selected={selected === b.id}
            onSelect={() => setSelected(prev => prev === b.id ? null : b.id)}
          />
        ))}
      </div>

      {/* Detail Panel */}
      {selectedBooking && (
        <DetailPanel
          booking={selectedBooking}
          onClose={() => setSelected(null)}
          onAccept={() => handleAccept(selectedBooking.id)}
          onReject={() => handleReject(selectedBooking.id)}
          onComplete={() => handleComplete(selectedBooking.id)}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}

function BookingRow({ booking: b, selected, onSelect }) {
  const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.pending;
  const date = b.proposed_time_primary
    ? new Date(b.proposed_time_primary).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : b.chosen_time
    ? new Date(b.chosen_time).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div
      onClick={onSelect}
      style={{
        ...s.row,
        background: selected ? 'rgba(255,255,255,0.04)' : undefined,
        borderColor: selected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
      }}
    >
      <div style={s.rowLeft}>
        <span style={s.clientName}>{b.requester_name}</span>
        <span style={s.rowMeta}>
          {capitalise(b.session_type.replace(/_/g, ' '))} · {b.body_location}
        </span>
      </div>
      <div style={s.rowRight}>
        <span style={{ ...s.statusBadge, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
          {capitalise(b.status)}
        </span>
        <span style={s.dateText}>{date}</span>
      </div>
    </div>
  );
}

function DetailPanel({ booking: b, onClose, onAccept, onReject, onComplete, actionLoading }) {
  const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.pending;
  return (
    <aside style={s.panel}>
      <div style={s.panelHeader}>
        <span style={s.panelTitle}>{b.requester_name}</span>
        <button onClick={onClose} style={s.closeBtn}>✕</button>
      </div>

      <div style={s.panelBody}>
        <Field label="Status">
          <span style={{ ...s.statusBadge, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
            {capitalise(b.status)}
          </span>
        </Field>
        <Field label="Session">{capitalise(b.session_type.replace(/_/g, ' '))}</Field>
        <Field label="Placement">{b.body_location}</Field>
        {b.color && <Field label="Style">{b.color}</Field>}
        <Field label="Design">{b.design_details}</Field>
        {b.requester_email && <Field label="Email">{b.requester_email}</Field>}
        {b.requester_phone && <Field label="Phone">{b.requester_phone}</Field>}
        {b.estimated_quote && <Field label="Quote">${b.estimated_quote}</Field>}
        {b.proposed_duration_minutes && (
          <Field label="Duration">{Math.round(b.proposed_duration_minutes / 60 * 10) / 10} hrs</Field>
        )}
        {b.additional_notes && <Field label="Notes">{b.additional_notes}</Field>}
        {b.proposed_time_primary && (
          <Field label="Proposed">
            {new Date(b.proposed_time_primary).toLocaleString('en-AU', {
              dateStyle: 'medium', timeStyle: 'short',
            })}
          </Field>
        )}
        {b.chosen_time && (
          <Field label="Confirmed">
            {new Date(b.chosen_time).toLocaleString('en-AU', {
              dateStyle: 'medium', timeStyle: 'short',
            })}
          </Field>
        )}
      </div>

      {/* Actions */}
      <div style={s.actions}>
        {b.status === 'pending' && (
          <>
            <ActionBtn onClick={onAccept} disabled={actionLoading} variant="success">Accept</ActionBtn>
            <ActionBtn onClick={onReject} disabled={actionLoading} variant="danger">Reject</ActionBtn>
          </>
        )}
        {b.status === 'confirmed' && (
          <ActionBtn onClick={onComplete} disabled={actionLoading} variant="success">Mark Complete</ActionBtn>
        )}
      </div>
    </aside>
  );
}

function Field({ label, children }) {
  return (
    <div style={s.field}>
      <span style={s.fieldLabel}>{label}</span>
      <span style={s.fieldVal}>{children}</span>
    </div>
  );
}

function ActionBtn({ onClick, disabled, variant, children }) {
  const colors = {
    success: { bg: 'rgba(76,201,138,0.12)', border: 'rgba(76,201,138,0.3)', text: '#4cc98a' },
    danger:  { bg: 'rgba(232,111,111,0.1)',  border: 'rgba(232,111,111,0.25)', text: '#e86f6f' },
  };
  const c = colors[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '0.55rem',
        borderRadius: 7,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.text,
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
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
    position: 'relative',
  },
  header: {
    padding: '1.75rem 2rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.01em',
  },
  filters: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '0.3rem 0.85rem',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  filterActive: {
    background: 'rgba(245,236,217,0.1)',
    borderColor: 'rgba(245,236,217,0.3)',
    color: '#f5ecd9',
  },
  body: {
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
    padding: '1rem 0',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.9rem 1.1rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s',
    gap: '1rem',
  },
  rowLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    minWidth: 0,
  },
  clientName: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#ffffff',
  },
  rowMeta: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.4)',
  },
  rowRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.3rem',
    flexShrink: 0,
  },
  statusBadge: {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.2rem 0.55rem',
    borderRadius: 20,
    letterSpacing: '0.02em',
  },
  dateText: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.35)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    background: '#0f151e',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10,
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
    padding: '0.25rem',
  },
  panelBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  fieldLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  fieldVal: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    padding: '1rem 1.25rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
};
