// Shared status → colour/label maps for booking rows, detail panels and
// approval (artist / studio application) badges.

export const STATUS_COLORS = {
  pending:         { bg: 'rgba(245,158,58,0.12)',  text: '#f59e3a', border: 'rgba(245,158,58,0.25)' },
  awaiting_payment:{ bg: 'rgba(251,146,60,0.12)',  text: '#fb923c', border: 'rgba(251,146,60,0.25)' },
  confirmed:       { bg: 'rgba(76,201,138,0.12)',  text: '#4cc98a', border: 'rgba(76,201,138,0.25)' },
  completed:       { bg: 'rgba(76,201,138,0.1)',   text: '#4cc98a', border: 'rgba(76,201,138,0.2)'  },
  cancelled:       { bg: 'var(--bg-chip)', text: 'var(--text-ghost)', border: 'var(--border-faint)' },
};

const STATUS_FALLBACK = { bg: 'var(--bg-chip)', text: 'var(--text-ghost)', border: 'var(--border-faint)' };

export function statusColors(status) {
  return STATUS_COLORS[status] ?? STATUS_FALLBACK;
}

const STATUS_LABELS = {
  pending:          'Pending',
  awaiting_payment: 'Awaiting Payment',
  confirmed:        'Confirmed',
  completed:        'Completed',
  cancelled:        'Cancelled',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? capitalise(status);
}

export function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// Artist join requests and studio account applications.
export const APPROVAL_STATUS_COLORS = {
  pending:  { bg: 'rgba(245,158,58,0.12)', text: '#f59e3a', border: 'rgba(245,158,58,0.25)' },
  approved: { bg: 'rgba(76,201,138,0.12)', text: '#4cc98a', border: 'rgba(76,201,138,0.25)' },
  rejected: { bg: 'rgba(232,111,111,0.1)', text: '#e86f6f', border: 'rgba(232,111,111,0.2)' },
};
