'use client';

// An artist's performance, opened from Financial → Artists & Payouts: the key numbers
// against the previous period, the sales trend, where bookings come from, their busiest
// days and their clients. Worked out from their completed bookings, so the date range
// here changes instantly and doesn't affect the page behind.
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Dialog from '@/components/ui/Dialog';
import { SkeletonBar } from '@/components/ui/DetailParts';
import { getArtistEarningsBreakdown } from '@/lib/api';
import { artistPerformance } from '@/lib/artistPerformance.mjs';
import { getBookingSourceLabel } from '@/lib/bookingType';
import { toISODate } from '@/lib/format';
import styles from './ArtistPerformanceModal.module.css';

const RANGES = [
  { label: '1w', days: 7, name: 'Last week' },
  { label: '4w', days: 28, name: 'Last 4 weeks' },
  { label: '12w', days: 84, name: 'Last 12 weeks' },
  { label: '24w', days: 168, name: 'Last 24 weeks' },
  { label: 'YTD', year: true, name: 'Year to date' },
  { label: 'All', all: true, name: 'All time' },
];

const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const moneyAxis = v => '$' + (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v);
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return toISODate(d); }
function niceRange(start, end) {
  const d = v => new Date(`${v}T12:00:00`);
  const a = d(start), b = d(end);
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${a.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })} – ${b.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function Change({ value, compared }) {
  if (!compared) return null;
  if (value == null) return <span className={styles.change}>No earlier data</span>;
  if (value === 0) return <span className={styles.change}>No change</span>;
  return <span className={`${styles.change} ${value > 0 ? styles.up : styles.down}`}><span aria-hidden="true">{value > 0 ? '▲' : '▼'}</span> {Math.abs(value)}%<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{value > 0 ? ' up' : ' down'} on the previous period</span></span>;
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: 12, color: 'var(--text)' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 650 }}>{money(row.sales)}</div>
      <div style={{ color: 'var(--text-muted)' }}>{row.tattoos} {row.tattoos === 1 ? 'tattoo' : 'tattoos'}</div>
    </div>
  );
}

export default function ArtistPerformanceModal({ artist, startDate, endDate, quickLabel, onClose, onViewBookings }) {
  const [entries, setEntries] = useState(null);
  const [failed, setFailed] = useState(false);
  const known = RANGES.some(r => r.label === quickLabel);
  const [range, setRange] = useState({ label: known ? quickLabel : null, start: startDate, end: endDate, compare: true });

  useEffect(() => {
    let live = true;
    getArtistEarningsBreakdown(artist.artist_id)
      .then(d => { if (live) setEntries(d.entries ?? []); })
      .catch(() => { if (live) { setEntries([]); setFailed(true); } });
    return () => { live = false; };
  }, [artist.artist_id]);

  function pick(option) {
    const end = toISODate(new Date());
    if (option.all) {
      const dates = (entries ?? []).filter(e => e.chosen_time).map(e => toISODate(new Date(e.chosen_time))).sort();
      setRange({ label: option.label, start: dates[0] ?? end, end, compare: false });
    } else if (option.year) {
      setRange({ label: option.label, start: `${new Date().getFullYear()}-01-01`, end, compare: true });
    } else {
      setRange({ label: option.label, start: daysAgo(option.days), end, compare: true });
    }
  }

  const data = useMemo(() => (entries ? artistPerformance(entries, range.start, range.end, { compare: range.compare }) : null), [entries, range]);
  const compared = Boolean(data?.previous);
  const hasData = data && data.current.tattoos > 0;
  const topDay = data ? Math.max(1, ...data.weekdays.map(d => d.count)) : 1;
  const topTrend = data?.trend.reduce((best, t) => (t.sales > best.sales ? t : best), { sales: 0, label: '' });
  const kpis = data ? [
    ['Sales', money(data.current.sales), data.change.sales],
    ['Tattoos', data.current.tattoos, data.change.tattoos],
    ['Avg ticket', money(data.current.avgTicket), data.change.avgTicket],
    ['Artist earnings', money(data.current.earnings), data.change.earnings],
  ] : [];

  return (
    <Dialog title={artist.artist_name} description={`Performance · ${niceRange(range.start, range.end)}`} onClose={onClose} maxWidth={680}
      footer={<button type="button" className="studio-button studio-button--secondary" onClick={onClose}>Close</button>}>
      <div className={styles.body}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className={styles.ranges}>
            {RANGES.map(r => <button key={r.label} type="button" className={styles.range} aria-pressed={range.label === r.label} aria-label={r.name} disabled={!entries} onClick={() => pick(r)}>{r.label}</button>)}
          </div>
          <button type="button" className={styles.link} onClick={onViewBookings}>View bookings →</button>
        </div>

        {!data && (
          <div className={styles.skeletons} role="status" aria-label="Loading performance">
            <SkeletonBar h={56} />
            <SkeletonBar h={170} />
            <SkeletonBar h={110} />
          </div>
        )}
        {failed && <p className={styles.empty} role="alert">Performance couldn’t be loaded. Close this and try again.</p>}
        {data && !failed && !hasData && <p className={styles.empty}>No completed sessions in this period.</p>}

        {data && !failed && hasData && <>
          <dl className={styles.kpis}>
            {kpis.map(([label, value, change]) => (
              <div key={label} className={styles.kpi} style={{ position: 'relative' }}>
                <dt className={styles.kpiLabel}>{label}</dt>
                <dd className={styles.kpiValue}>{value}</dd>
                <dd style={{ margin: 0 }}><Change value={change} compared={compared} /></dd>
              </div>
            ))}
          </dl>
          {compared && <p className={styles.compared}>Compared with {niceRange(data.previous.range.start, data.previous.range.end)}</p>}

          <section className={styles.card} aria-label="Sales trend">
            <h3 className={styles.cardHead}>
              Sales by {data.unit}
              {topTrend.sales > 0 && <span className={styles.cardNote}>Best: {topTrend.label} · {money(topTrend.sales)}</span>}
            </h3>
            <div role="img" aria-label={`Sales by ${data.unit}. Highest was ${money(topTrend.sales)} on ${topTrend.label}.`}>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={data.trend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border-faint)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tickFormatter={moneyAxis} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip cursor={{ fill: 'var(--bg-row-hover)' }} content={<TrendTooltip />} isAnimationActive={false} />
                  <Bar dataKey="sales" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className={styles.columns}>
            <section className={styles.card}>
              <h3 className={styles.cardHead}>Where bookings come from</h3>
              <div className={styles.bars}>
                {data.sources.map(s => (
                  <div key={s.source}>
                    <div className={styles.barTop}><span>{getBookingSourceLabel(s.source)}</span><span>{s.count} · {s.share}%</span></div>
                    <div className={styles.track}><div className={styles.fill} style={{ width: `${s.share}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card}>
              <h3 className={styles.cardHead}>
                Busiest days
                {data.busiest && <span className={styles.cardNote}>{data.busiest.label}</span>}
              </h3>
              <div className={styles.week}>
                {data.weekdays.map(d => (
                  <div key={d.label} className={styles.dayCol} title={`${d.label}: ${d.count} ${d.count === 1 ? 'tattoo' : 'tattoos'}, ${money(d.sales)}`}>
                    {d.count > 0 && <span className={styles.dayCount}>{d.count}</span>}
                    <div className={`${styles.dayBar} ${d === data.busiest ? styles.dayBarTop : ''}`} style={{ height: `${(d.count / topDay) * 56}px` }} />
                    <span className={styles.dayLabel}>{d.label.charAt(0)}<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{d.label.slice(1)}</span></span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className={styles.card}>
            <h3 className={styles.cardHead}>
              Clients
              <span className={styles.cardNote}>{data.clients.unique} total · {data.clients.returning} returning</span>
            </h3>
            <ul className={styles.clientList}>
              {data.clients.top.map(c => (
                <li key={c.name} className={styles.clientRow}>
                  <span className={styles.clientName}>{c.name}{c.visits > 1 ? ` · ${c.visits} visits` : ''}</span>
                  <span>{money(c.sales)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>}
      </div>
    </Dialog>
  );
}
