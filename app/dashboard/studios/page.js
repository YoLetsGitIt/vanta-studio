'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminListStudioAccounts, adminApproveStudio, adminRejectStudio } from '@/lib/api';

const STATUS_FILTERS = [
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '',         label: 'All' },
];

const STATUS_COLORS = {
  pending:  { bg: 'rgba(245,158,58,0.12)',  text: '#f59e3a', border: 'rgba(245,158,58,0.25)' },
  approved: { bg: 'rgba(76,201,138,0.12)',  text: '#4cc98a', border: 'rgba(76,201,138,0.25)' },
  rejected: { bg: 'rgba(232,111,111,0.1)',  text: '#e86f6f', border: 'rgba(232,111,111,0.2)' },
};

export default function StudiosAdminPage() {
  const [filter, setFilter] = useState('pending');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminListStudioAccounts(filter);
      setAccounts(data.accounts ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id) {
    setActionLoading(id);
    try { await adminApproveStudio(id); await load(); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(null); }
  }

  async function handleReject(id) {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    setActionLoading(id);
    try { await adminRejectStudio(id, reason); await load(); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(null); }
  }

  const pendingCount = accounts.filter(a => a.status === 'pending').length;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>
            Studios
            {filter === 'pending' && pendingCount > 0 && (
              <span style={s.countBadge}>{pendingCount}</span>
            )}
          </h1>
          <p style={s.subtitle}>Review and approve studio account applications</p>
        </div>
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

      <div style={s.body}>
        {loading && <p style={s.msg}>Loading…</p>}
        {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
        {!loading && !error && accounts.length === 0 && (
          <p style={s.msg}>No {filter || ''} studio accounts.</p>
        )}
        {!loading && accounts.map(acct => (
          <AccountCard
            key={acct.id}
            account={acct}
            onApprove={() => handleApprove(acct.id)}
            onReject={() => handleReject(acct.id)}
            actionLoading={actionLoading === acct.id}
          />
        ))}
      </div>
    </div>
  );
}

function AccountCard({ account, onApprove, onReject, actionLoading }) {
  const sc = STATUS_COLORS[account.status] ?? STATUS_COLORS.pending;
  const studio = account.studio;
  const createdAt = new Date(account.created_at).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <div style={s.studioAvatar}>
          {(studio?.name ?? 'S')[0].toUpperCase()}
        </div>
        <div style={s.cardInfo}>
          <div style={s.cardNameRow}>
            <span style={s.studioName}>{studio?.name ?? 'Unknown studio'}</span>
            <span style={{ ...s.statusBadge, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
              {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
            </span>
          </div>
          {studio?.address_string && (
            <span style={s.studioAddr}>{studio.address_string}</span>
          )}
          <span style={s.cardMeta}>Applied {createdAt}</span>
        </div>
      </div>

      {account.rejection_reason && (
        <div style={s.rejectionNote}>
          <span style={s.rejectionLabel}>Rejection reason:</span> {account.rejection_reason}
        </div>
      )}

      {account.status === 'pending' && (
        <div style={s.actions}>
          <button
            onClick={onApprove}
            disabled={actionLoading}
            style={{ ...s.actionBtn, ...s.approveBtn, opacity: actionLoading ? 0.5 : 1 }}
          >
            {actionLoading ? '…' : 'Approve'}
          </button>
          <button
            onClick={onReject}
            disabled={actionLoading}
            style={{ ...s.actionBtn, ...s.rejectBtn, opacity: actionLoading ? 0.5 : 1 }}
          >
            {actionLoading ? '…' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  );
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
    borderBottom: '1px solid var(--border-faint)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
  },
  countBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#0d1017',
    background: '#f59e3a',
    borderRadius: 20,
    padding: '0.15rem 0.5rem',
  },
  subtitle: { fontSize: '0.8rem', color: 'var(--text-faint)', margin: 0 },
  filters: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  filterBtn: {
    padding: '0.3rem 0.85rem',
    borderRadius: 20,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  filterActive: {
    background: 'var(--accent-tint)',
    borderColor: 'var(--accent-tint-border)',
    color: 'var(--accent)',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  msg: { fontSize: '0.875rem', color: 'var(--text-faint)' },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    borderRadius: 12,
    padding: '1.1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  cardTop: { display: 'flex', gap: '0.85rem', alignItems: 'flex-start' },
  studioAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'var(--accent-tint)',
    color: 'var(--accent)',
    fontSize: '1rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 },
  cardNameRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' },
  studioName: { fontSize: '0.925rem', fontWeight: 700, color: 'var(--text)' },
  studioAddr: { fontSize: '0.78rem', color: 'var(--text-muted)' },
  cardMeta: { fontSize: '0.72rem', color: 'var(--text-ghost)', marginTop: 2 },
  statusBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    padding: '0.15rem 0.5rem',
    borderRadius: 20,
    letterSpacing: '0.02em',
  },
  rejectionNote: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    background: 'rgba(232,111,111,0.06)',
    border: '1px solid rgba(232,111,111,0.12)',
    borderRadius: 7,
    padding: '0.55rem 0.75rem',
  },
  rejectionLabel: { fontWeight: 600, color: '#e86f6f' },
  actions: { display: 'flex', gap: '0.5rem' },
  actionBtn: {
    padding: '0.45rem 1rem',
    borderRadius: 7,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid',
  },
  approveBtn: {
    background: 'rgba(76,201,138,0.12)',
    borderColor: 'rgba(76,201,138,0.3)',
    color: '#4cc98a',
  },
  rejectBtn: {
    background: 'rgba(232,111,111,0.1)',
    borderColor: 'rgba(232,111,111,0.25)',
    color: '#e86f6f',
  },
};
