'use client';

// The Bookings page on a phone held upright: a compact title with the sort beside it, a
// search field, status tabs, then bookings grouped by day in inset lists (like iOS
// Settings) with the time on the left, the client and details in the middle, and the
// status and price beside. Desktop keeps its own layout (app/dashboard/appointments).
// Sizes are in rem so the whole list grows with the phone's text size.
import styles from './BookingsPhoneList.module.css';
import StatePanel from '@/components/ui/StatePanel';
import { statusColors, statusLabel, capitalise } from '@/lib/status';
import { getBookingStyle } from '@/lib/bookingType';
import { hasArtist } from '@/lib/format';
import { useSideScroll } from '@/lib/useSideScroll';

export { usePhoneLayout } from '@/lib/usePhoneLayout';

const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// "Today", "Tomorrow", "Yesterday", or "Wed 26 Nov" (with the year when it isn't this year).
function dayLabel(d) {
  const today = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const part = opts => d.toLocaleDateString('en-AU', opts);
  return [part({ weekday: 'short' }), part({ day: 'numeric' }), part({ month: 'short' }), d.getFullYear() !== today.getFullYear() ? d.getFullYear() : null].filter(Boolean).join(' ');
}

// Bookings in the server's order, in runs by day: their time, or when they were
// requested for those without a time yet.
function groupByDay(bookings) {
  const groups = [];
  for (const b of bookings) {
    const at = b.chosen_time || b.proposed_time_primary;
    const when = at ? new Date(at) : b.created_at ? new Date(b.created_at) : null;
    const key = when ? `${at ? 'at' : 'req'}:${dayKey(when)}` : 'none';
    const label = !when ? 'No date' : at ? dayLabel(when) : `Requested ${dayLabel(when).replace(/^(Today|Tomorrow|Yesterday)$/, m => m.toLowerCase())}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(b);
    else groups.push({ key, label, items: [b] });
  }
  return groups;
}

function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}

function SortIcon({ desc }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {desc ? <path d="M12 5v14M6 13l6 6 6-6" /> : <path d="M12 19V5M6 11l6-6 6 6" />}
    </svg>
  );
}

export default function BookingsPhoneList({
  t, title, filters, activeFilter, onFilter, subFilters, activeSub, onSub,
  sortDir, onSort, search, onSearch, loading, error, bookings, selectedId, onSelect,
  labelFor, nextCursor, onLoadMore, loadingMore,
}) {
  const groups = groupByDay(bookings);
  const tabRow = useSideScroll();
  const chipRow = useSideScroll();
  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          <button type="button" className={styles.sort} onClick={onSort} aria-label={`Sort: ${t(sortDir === 'desc' ? 'sort_newest' : 'sort_oldest')}`}>
            <SortIcon desc={sortDir === 'desc'} />
            <span>{sortDir === 'desc' ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
        <label className={styles.search}>
          <SearchIcon />
          <input type="search" placeholder={t('appt_search')} aria-label={t('appt_search')} value={search} onChange={e => onSearch(e.target.value)} enterKeyHint="search" />
        </label>
        <div ref={tabRow} className={styles.tabs} role="tablist" aria-label="Booking status">
          {filters.map(f => {
            const on = activeFilter === f.value;
            return (
              <button key={f.value} type="button" role="tab" aria-selected={on} aria-pressed={on} className={styles.tab} onClick={() => onFilter(f.value)}>
                {f.label ?? t(f.tKey)}
              </button>
            );
          })}
        </div>
      </div>

      {subFilters && (
        <div ref={chipRow} className={styles.chips} role="group" aria-label="Show">
          {subFilters.map(f => (
            <button key={f.value} type="button" aria-pressed={activeSub === f.value} className={styles.chip} onClick={() => onSub(f.value)}>{f.label}</button>
          ))}
        </div>
      )}

      <div className={styles.body}>
        {loading && (
          <div className={styles.group} aria-hidden="true">
            <div className={`${styles.card} ${styles.skeleton}`}>
              {[0, 1, 2].map(i => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
            </div>
          </div>
        )}
        {error && <StatePanel title={error} tone="error" compact />}
        {!loading && !error && bookings.length === 0 && <StatePanel title={t(search ? 'appt_no_results' : 'appt_none')} compact />}
        {!loading && groups.map(group => (
          <section key={group.key} className={styles.group} aria-label={group.label}>
            <h2 className={styles.groupLabel}>{group.label}</h2>
            <div className={styles.card}>
              {group.items.map(b => <Row key={b.id} b={b} t={t} tab={activeFilter} selected={selectedId === b.id} onSelect={() => onSelect(b.id)} label={labelFor(b)} />)}
            </div>
          </section>
        ))}
        {nextCursor && !loading && (
          <button type="button" className={styles.more} onClick={onLoadMore} disabled={loadingMore}>{t(loadingMore ? 'loading' : 'load_more')}</button>
        )}
      </div>
    </div>
  );
}

function Row({ b, t, tab, selected, onSelect, label }) {
  const displayStatus = b.status === 'completed' && b.outcome === 'no_show' ? 'no_show' : b.status;
  const sc = statusColors(displayStatus);
  const at = b.chosen_time || b.proposed_time_primary;
  // Without an appointment time yet, the time it was requested (in grey).
  const d = at ? new Date(at) : b.created_at ? new Date(b.created_at) : null;
  const [time, meridiem] = d ? d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().split(' ') : [null, null];
  // In a tab of one status the status goes without saying; labels like "Record payment" still show.
  const statusText = label ?? (tab === b.status ? null : statusLabel(displayStatus));
  const details = [
    b.session_type ? capitalise(b.session_type.replace(/_/g, ' ')) : null,
    b.body_location || null,
    hasArtist(b.artist_id) ? b.artist_name : t('bdp_artist_unspecified'),
  ].filter(Boolean).join(' · ');
  const price = b.estimated_quote > 0 ? `$${Number(b.estimated_quote).toLocaleString()}` : null;
  const source = getBookingStyle(b.source).tag;
  return (
    <button type="button" className={`studio-booking-row ${styles.row}`} data-phone-row data-booking-id={b.id} aria-expanded={selected} data-selected={selected || undefined} onClick={onSelect}>
      <span className={styles.when}>
        {d && <><span className={`${styles.time} ${at ? '' : styles.requestedTime}`}>{time}</span><span className={styles.meridiem}>{meridiem}</span></>}
      </span>
      <span className={styles.main}>
        <span className={styles.name}>{b.requester_name || 'Client'}</span>
        {details && <span className={styles.details}>{details}</span>}
        <span className={styles.status}>
          <span className={styles.statusLabel} style={{ color: sc.text }}>
            <span className={styles.dot} style={{ background: sc.text }} aria-hidden="true" />
            {statusText}
          </span>
          {source && <span className={styles.source}>{statusText ? '· ' : ''}{source}</span>}
        </span>
      </span>
      <span className={styles.end}>
        {price && <span className={styles.price}>{price}</span>}
        <svg className={styles.chevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </span>
    </button>
  );
}
