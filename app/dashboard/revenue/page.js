'use client';

import { useState, useEffect } from 'react';
import { getStudioRevenueStats } from '@/lib/api';
import { toISODate } from '@/lib/format';
import {
  Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';
import { getBookingSourceLabel } from '@/lib/bookingType';

// Financial figures and Artists & Payouts moved to /dashboard/financial
// (a separate, password-protected nav tab). This page only shows the
// unrestricted appointment/customer overview.

const QUICK_OPTIONS = [
  { label: '1w',  days: 7 },
  { label: '4w',  days: 28 },
  { label: '8w',  days: 56 },
  { label: '12w', days: 84 },
  { label: '24w', days: 168 },
  { label: 'YTD', days: null },
];

const toDateStr = toISODate;
function dateFromDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d); }
function ytdStart() { return new Date().getFullYear() + '-01-01'; }

function fmt(n) {
  if (n == null || n === '') return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const { t } = useLanguage();
  const today = toDateStr(new Date());
  const [startDate,   setStartDate]   = useState(() => dateFromDaysAgo(7));
  const [endDate,     setEndDate]     = useState(today);
  const [activeQuick, setActiveQuick] = useState('1w');
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (!startDate || !endDate || startDate > endDate) return;
    setLoading(true);
    setError('');
    getStudioRevenueStats(startDate, endDate)
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  function applyQuick(opt) {
    setActiveQuick(opt.label);
    setEndDate(today);
    setStartDate(opt.days === null ? ytdStart() : dateFromDaysAgo(opt.days));
  }
  function onStartChange(e) { setStartDate(e.target.value); setActiveQuick(null); }
  function onEndChange(e)   { setEndDate(e.target.value);   setActiveQuick(null); }

  const a = stats?.appointments;
  const c = stats?.customers;

  return (
    <div style={st.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={st.header}>
        <h1 style={st.title}>{t('nav_analytics')}</h1>
        <div style={st.controls}>
          <div style={st.quickPicker}>
            {QUICK_OPTIONS.map(opt => (
              <button key={opt.label} onMouseDown={e => e.preventDefault()} onClick={() => applyQuick(opt)}
                style={{ ...st.weekBtn, ...(activeQuick === opt.label ? st.weekBtnActive : {}) }}>
                {opt.label}
              </button>
            ))}
          </div>
          <div style={st.dateSep} />
          <div style={st.dateRange}>
            <input type="date" value={startDate} max={endDate} onChange={onStartChange} style={st.dateInput} />
            <span style={st.dateArrow}>→</span>
            <input type="date" value={endDate} min={startDate} max={today} onChange={onEndChange} style={st.dateInput} />
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={st.body}>
        {loading && <p style={st.msg}>{t('loading')}</p>}
        {error   && <p style={{ ...st.msg, color: '#e86f6f' }}>{error}</p>}

        {!loading && !error && stats && (
          <>
            <Section title={t('revenue_appt_metrics')}>
              <div style={st.kpiGrid}>
                <KpiCard label={t('revenue_total_appts')}    value={a?.total ?? 0} />
                <KpiCard label={t('status_completed')}             value={a?.completed ?? 0} color="#4cc98a" />
                <KpiCard label={t('revenue_upcoming')}  value={a?.confirmed ?? 0} color="#6fa3e8" />
                <KpiCard label={t('status_pending')}               value={a?.pending ?? 0}   color="#f59e3a" />
                <KpiCard label={t('status_cancelled')}             value={a?.cancelled ?? 0} color="#a0a0a0" />
                <KpiCard label="No-shows"              value={a?.no_shows ?? 0}  color="#e86f6f" />
                <KpiCard label={t('revenue_avg_value')} value={fmt(a?.avg_value)} accent />
                <KpiCard label={t('revenue_appt_revenue')}   value={fmt(a?.revenue)} />
              </div>
              {a?.by_source?.length > 0 && (
                <SourceBreakdown data={a.by_source} />
              )}
            </Section>

            <Section title={t('revenue_customer_insights')}>
              <div style={st.kpiGrid}>
                <KpiCard label={t('revenue_new_clients')}       value={c?.new_clients ?? 0}       color="#4cc98a" />
                <KpiCard label={t('revenue_returning_clients')} value={c?.returning_clients ?? 0} color="#6fa3e8" />
              </div>
              {c?.top_clients?.length > 0 && (
                <>
                  <p style={st.sectionSub}>{t('revenue_top_clients')}</p>
                  <div style={st.tableScroll}>
                    <table style={st.table}>
                      <thead>
                        <tr>{[t('revenue_client'), t('revenue_visits'), t('revenue_last_visit'), t('revenue_spend'), t('revenue_avg_spend')].map(h => <th key={h} style={st.th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {c.top_clients.map((cl, i) => (
                          <tr key={cl.email || i} style={st.tr}>
                            <td style={st.td}>
                              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{cl.name || '—'}</span>
                              <span style={st.emailSub}>{cl.email}</span>
                            </td>
                            <td style={st.td}>{cl.total_visits}</td>
                            <td style={st.td}>{formatDate(cl.last_visit)}</td>
                            <td style={{ ...st.td, color: 'var(--accent)' }}>{fmt(cl.lifetime_spend)}</td>
                            <td style={st.td}>{fmt(cl.avg_spend)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

const SOURCE_COLORS = { App: '#d5d0c7', Studio: '#bdb8af', 'Walk-in': '#a7a29a', Personal: '#918d86', Imported: '#77746f' };

function SourceBreakdown({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  // Group legacy aliases by display label while keeping walk-ins distinct.
  const grouped = new Map();
  for (const d of data) {
    const name = getBookingSourceLabel(d.source);
    grouped.set(name, (grouped.get(name) ?? 0) + d.count);
  }
  const chartData = Array.from(grouped, ([name, value]) => ({
    name,
    value,
    color: SOURCE_COLORS[name] ?? '#918d86',
  }));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
      <div style={{ width: 160, height: 160, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} (${Math.round(value / total * 100)}%)`, name]}
              contentStyle={{ background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.78rem' }}
              itemStyle={{ color: 'var(--text)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {chartData.map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', minWidth: 60 }}>{d.name}</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{d.value}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-ghost)' }}>{Math.round(d.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={st.section}>
      <h2 style={st.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function KpiCard({ label, value, accent, dim, color }) {
  return (
    <div style={st.kpiCard}>
      <span style={{ ...st.kpiVal, color: accent ? 'var(--accent)' : dim ? 'var(--text-ghost)' : (color ?? 'var(--text)') }}>
        {value}
      </span>
      <span style={st.kpiLabel}>{label}</span>
      {dim && <span style={st.dimBadge}>coming soon</span>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = {
  page:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:  {
    padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-faint)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0, gap: '1rem', flexWrap: 'wrap',
  },
  title:   { fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' },
  controls: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  quickPicker: { display: 'flex', gap: '0.35rem' },
  dateSep: { width: 1, height: 18, background: 'var(--border)' },
  dateRange: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  dateInput: {
    background: 'var(--bg-chip)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text-dim)', fontSize: '0.78rem',
    padding: '0.3rem 0.5rem', outline: 'none', colorScheme: 'auto',
  },
  dateArrow: { fontSize: '0.75rem', color: 'var(--text-ghost)' },
  weekBtn: {
    padding: '0.3rem 0.65rem', borderRadius: 20,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
  },
  weekBtnActive: { background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', color: 'var(--accent)' },

  body: {
    flex: 1, overflowY: 'auto', padding: '1.5rem 2rem',
    display: 'flex', flexDirection: 'column', gap: '2.5rem',
  },
  msg: { fontSize: '0.875rem', color: 'var(--text-faint)' },
  section: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  sectionTitle: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.01em' },
  sectionSub: { fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.25rem' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: '0.75rem' },
  kpiCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border-faint)',
    borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem',
  },
  kpiVal:   { fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em' },
  kpiLabel: { fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 500 },
  dimBadge: { fontSize: '0.62rem', color: 'var(--text-ghost)', fontWeight: 500, letterSpacing: '0.02em' },
  tableScroll: { overflowX: 'auto' },
  table: {
    width: '100%', borderCollapse: 'collapse',
    background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 10,
  },
  th: {
    padding: '0.6rem 1rem', textAlign: 'left',
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)',
    letterSpacing: '0.02em', textTransform: 'uppercase',
    borderBottom: '1px solid var(--border-faint)',
  },
  tr: { borderBottom: '1px solid var(--border-faint)' },
  td: { padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500, verticalAlign: 'top' },
  emailSub: { display: 'block', fontSize: '0.72rem', color: 'var(--text-ghost)', marginTop: '0.15rem' },
};
