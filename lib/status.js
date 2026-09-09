// Shared status → colour/label maps for booking rows, detail panels and
// approval (artist / studio application) badges.

const semanticStatus = tone => ({
  bg: `var(--color-${tone}-surface)`,
  text: `var(--color-${tone})`,
  border: `var(--color-${tone}-border)`,
});
const neutralStatus = { bg: 'var(--bg-chip)', text: 'var(--text-muted)', border: 'var(--border)' };

export const STATUS_COLORS = {
  pending: semanticStatus('warning'),
  awaiting_payment: semanticStatus('warning'),
  awaiting_deposit: semanticStatus('warning'),
  requires_confirmation: semanticStatus('info'),
  confirmed: semanticStatus('success'),
  completed: semanticStatus('success'),
  cancelled: neutralStatus,
  deposit_expired: semanticStatus('danger'),
};

const STATUS_FALLBACK = neutralStatus;

export function statusColors(status) {
  return STATUS_COLORS[status] ?? STATUS_FALLBACK;
}

const STATUS_LABELS = {
  pending:               'Pending',
  awaiting_payment:      'Awaiting Payment',
  awaiting_deposit:      'Awaiting Deposit',
  requires_confirmation: 'Needs Confirmation',
  confirmed:             'Confirmed',
  completed:             'Completed',
  cancelled:             'Cancelled',
  deposit_expired:       'Deposit Expired',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? capitalise(status);
}

export function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// Artist join requests and studio account applications.
export const APPROVAL_STATUS_COLORS = {
  pending: semanticStatus('warning'),
  approved: semanticStatus('success'),
  rejected: semanticStatus('danger'),
  removed: neutralStatus,
};
