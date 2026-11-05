'use client';

// "Needs action" list in the sidebar (and the phone "More" menu). Each item opens the
// page where it is handled: bookings open in the Bookings panel.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getDashboardAttention } from '@/lib/api';
import { normalizeBookingSource } from '@/lib/bookingType';
import styles from './SidebarNeedsAction.module.css';

const INACTIVE = ['completed', 'cancelled', 'rejected', 'declined', 'timed_out', 'no_show'];

function needsDeposit(b) {
  const scheduled = Number.isFinite(b.chosen_time ? new Date(b.chosen_time).getTime() : NaN);
  const required = b.deposit_required === true && Number(b.deposit_amount) > 0;
  const paid = Boolean(b.deposit_paid_at || b.deposit_confirmed_at);
  return scheduled && required && !paid && !INACTIVE.includes(b.status);
}

function isOverdue(b, now) {
  if (b.status !== 'confirmed' || !b.chosen_time) return false;
  if (normalizeBookingSource(b.source) === 'import') return false; // history from another system
  const end = new Date(b.chosen_time).getTime() + (b.proposed_duration_minutes ?? b.duration_minutes ?? 60) * 60000;
  return Number.isFinite(end) && end < now;
}

function when(b) {
  const t = b.chosen_time ?? b.proposed_time_primary;
  if (!t) return 'Date to be arranged';
  const d = new Date(t);
  return `${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
}

const bookingHref = b => `/dashboard/appointments?booking=${encodeURIComponent(b.id)}`;

// paymentRecording: the studio's payment_recording_requirement. Past sessions only need
// an outcome when the studio records payments.
export default function SidebarNeedsAction({ paymentRecording, onNavigate }) {
  const pathname = usePathname();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({});

  useEffect(() => {
    let live = true;
    const load = () => getDashboardAttention().then(d => { if (live) setData(d); }).catch(() => {});
    load();
    // Refresh when the studio comes back to the tab or changes something.
    const events = ['focus', 'booking-deposit-cancelled', 'booking-deposit-received', 'vanta:attention-changed'];
    events.forEach(e => window.addEventListener(e, load));
    return () => { live = false; events.forEach(e => window.removeEventListener(e, load)); };
  }, [pathname]);

  if (!data) return null;
  const bookings = data.bookings ?? [];
  const now = Date.now();
  const recordsOutcomes = paymentRecording && paymentRecording !== 'none' && paymentRecording !== 'artist_only';
  const groups = [
    { key: 'pending', title: 'Pending requests', tone: 'warning', items: bookings.filter(b => b.status === 'pending').map(b => ({ id: b.id, title: b.requester_name ?? 'Client', sub: when(b), href: bookingHref(b) })) },
    { key: 'confirm', title: 'To confirm', tone: 'info', items: bookings.filter(b => b.status === 'requires_confirmation').map(b => ({ id: b.id, title: b.requester_name ?? 'Client', sub: when(b), href: bookingHref(b) })) },
    { key: 'deposit', title: 'Unpaid deposits', tone: 'danger', items: bookings.filter(needsDeposit).map(b => ({ id: b.id, title: b.requester_name ?? 'Client', sub: when(b), href: bookingHref(b) })) },
    { key: 'overdue', title: 'Past sessions to finish', tone: 'warning', items: recordsOutcomes ? bookings.filter(b => isOverdue(b, now)).sort((a, b) => new Date(a.chosen_time) - new Date(b.chosen_time)).map(b => ({ id: b.id, title: b.requester_name ?? 'Client', sub: when(b), href: bookingHref(b) })) : [] },
    { key: 'artists', title: 'Artist requests', tone: 'info', items: (data.pending_artists ?? []).map(a => ({ id: a.id, title: a.name ?? 'Artist', sub: a.email || 'Wants to join', href: '/dashboard/artists' })) },
    { key: 'reimburse', title: 'Reimbursements', tone: 'warning', items: (data.pending_reimbursements ?? []).map(r => ({ id: r.id, title: r.artist_name ?? 'Artist', sub: `$${Number(r.amount ?? 0).toFixed(2)}${r.description ? ` · ${r.description}` : ''}`, href: '/dashboard/financial' })) },
  ].filter(g => g.items.length);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className={styles.wrap} aria-labelledby="needs-action-title">
      <h2 id="needs-action-title" className={styles.title}>
        Needs action {total > 0 && <span className={styles.total}>{total}</span>}
      </h2>
      {total === 0 && <p className={styles.empty}>You’re all caught up.</p>}
      {groups.map(g => {
        const expanded = Boolean(open[g.key]);
        return (
          <div key={g.key} className={styles.group}>
            <button type="button" className={styles.groupHead} aria-expanded={expanded} onClick={() => setOpen(o => ({ ...o, [g.key]: !expanded }))}>
              <span className={`${styles.marker} ${styles[g.tone]}`} aria-hidden="true" />
              <span className={styles.groupTitle}>{g.title}</span>
              <span className={styles.count}>{g.items.length}</span>
              <span className={styles.chevron} aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
            </button>
            {expanded && (
              <ul className={styles.list}>
                {g.items.map(item => (
                  <li key={item.id}>
                    <Link href={item.href} className={styles.item} onClick={onNavigate}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.itemSub}>{item.sub}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
