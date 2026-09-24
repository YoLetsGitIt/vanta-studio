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
    <div className="studio-feature-page studio-revenue-page" style={st.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="studio-feature-header" style={st.header}>
        <h1 style={st.title}>{t('nav_analytics')}</h1>
        <div className="studio-report-controls" style={st.controls}>
          <div style={st.quickPicker}>
            {QUICK_OPTIONS.map(opt => (
              <button key={opt.label} aria-pressed={activeQuick === opt.label} aria-label={opt.days === null ? 'Year to date' : `Last ${opt.days / 7} weeks`} onClick={() => applyQuick(opt)}
                style={{ ...st.weekBtn, ...(activeQuick === opt.label ? st.weekBtnActive : {}) }}>
                {opt.label}
              </button>
            ))}
          </div>
          <div style={st.dateSep} />
          <div className="studio-date-range" style={st.dateRange}>
            <input type="date" aria-label="Start date" value={startDate} max={endDate} onChange={onStartChange} style={st.dateInput} />
            <span style={st.dateArrow}>→</span>
            <input type="date" aria-label="End date" value={endDate} min={startDate} max={today} onChange={onEndChange} style={st.dateInput} />
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="studio-feature-body" style={st.body}>
        {loading && <p role="status" style={st.msg}>{t('loading')}</p>}
        {error   && <p role="alert" style={{ ...st.msg, color: 'var(--status-rejected)' }}>{error}</p>}

        {!loading && !error && stats && (
          <>
            <Section title={t('revenue_appt_metrics')}>
              <div className="studio-kpi-grid" style={st.kpiGrid}>
                <KpiCard label={t('revenue_total_appts')}    value={a?.total ?? 0} />
                <KpiCard label={t('status_completed')}       value={a?.completed ?? 0} tone="success" />
                <KpiCard label={t('revenue_upcoming')}       value={a?.confirmed ?? 0} tone="info" />
                <KpiCard label={t('status_pending')}         value={a?.pending ?? 0}   tone="warning" />
                <KpiCard label={t('status_cancelled')}       value={a?.cancelled ?? 0} />
                <KpiCard label="No-shows"                     value={a?.no_shows ?? 0}  tone="danger" />
                <KpiCard label={t('revenue_avg_value')}      value={fmt(a?.avg_value)} tone="info" />
                <KpiCard label={t('revenue_appt_revenue')}   value={fmt(a?.revenue)}   tone="success" />
              </div>
              {a?.by_source?.length > 0 && (
                <SourceBreakdown data={a.by_source} />
              )}
            </Section>

            <Section title={t('revenue_customer_insights')}>
              <div className="studio-kpi-grid" style={st.kpiGrid}>
                <KpiCard label={t('revenue_new_clients')}       value={c?.new_clients ?? 0}       tone="success" />
                <KpiCard label={t('revenue_returning_clients')} value={c?.returning_clients ?? 0} tone="info" />
              </div>
              {c?.top_clients?.length > 0 && (
                <>
                  <p style={st.sectionSub}>{t('revenue_top_clients')}</p>
                  <div style={st.tableScroll}>
                    <table aria-label={t('revenue_top_clients')} style={st.table}>
                      <thead>
                        <tr>{[t('revenue_client'), t('revenue_visits'), t('revenue_last_visit'), t('revenue_spend'), t('revenue_avg_spend')].map(h => <th key={h} scope="col" style={st.th}>{h}</th>)}</tr>
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

function KpiCard({ label, value, tone = 'neutral' }) {
  const toned = tone !== 'neutral';
  return (
    <div style={{
      ...st.kpiCard,
      ...(toned ? { background: `var(--color-${tone}-surface)`, borderColor: `var(--color-${tone}-border)` } : {}),
      borderLeft: `4px solid ${toned ? `var(--color-${tone})` : 'var(--text-ghost)'}`,
    }}>
      <span style={st.kpiLabel}>{label}</span>
      <span style={{ ...st.kpiVal, color: toned ? `var(--color-${tone})` : 'var(--text)' }}>{value}</span>
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
  title:   { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' },
  controls: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  quickPicker: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  dateSep: { width: 1, height: 18, background: 'var(--border)' },
  dateRange: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  dateInput: {
    background: 'var(--bg-chip)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text)', fontSize: '0.875rem',
    padding: '0.4rem 0.6rem', outline: 'none', colorScheme: 'auto',
  },
  dateArrow: { fontSize: '0.75rem', color: 'var(--text-ghost)' },
  weekBtn: {
    padding: '0.4rem 0.8rem', borderRadius: 20,
    border: '1px solid var(--border-strong)', background: 'transparent',
    color: 'var(--text-dim)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
  },
  weekBtnActive: { background: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--accent-contrast)', fontWeight: 700 },

  body: {
    flex: 1, overflowY: 'auto', padding: '1.5rem 2rem',
    display: 'flex', flexDirection: 'column', gap: '2.5rem',
  },
  msg: { fontSize: '0.875rem', color: 'var(--text-faint)' },
  section: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  sectionTitle: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' },
  sectionSub: { fontSize: '0.95rem', color: 'var(--text)', fontWeight: 700, marginTop: '0.5rem' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem' },
  kpiCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '1.1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  kpiVal:   { fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.03em' },
  kpiLabel: { fontSize: '0.875rem', color: 'var(--text-dim)', fontWeight: 600 },
  dimBadge: { fontSize: '0.62rem', color: 'var(--text-ghost)', fontWeight: 500, letterSpacing: '0.02em' },
  tableScroll: { overflowX: 'auto' },
  table: {
    width: '100%', borderCollapse: 'collapse',
    background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 10,
  },
  th: {
    padding: '0.6rem 1rem', textAlign: 'left',
    fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border-faint)',
  },
  tr: { borderBottom: '1px solid var(--border-faint)' },
  td: { padding: '0.85rem 1rem', fontSize: '0.95rem', color: 'var(--text-dim)', fontWeight: 500, verticalAlign: 'top' },
  emailSub: { display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' },
};
