'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { getStudioRevenueStats, getPayoutSummaries, createPayout, getArtistPayoutHistory } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';


const QUICK_OPTIONS = [
  { label: '1w',  days: 7 },
  { label: '4w',  days: 28 },
  { label: '8w',  days: 56 },
  { label: '12w', days: 84 },
  { label: '24w', days: 168 },
  { label: 'YTD', days: null },
];

// Local date, not toISOString() — UTC would roll "today" back a day in AU timezones.
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateFromDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d); }
function ytdStart() { return new Date().getFullYear() + '-01-01'; }

function fmt(n) {
  if (n == null || n === '') return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtHours(h) { return h ? Number(h).toFixed(1) + 'h' : '—'; }
function formatSource(s) { return ({ app: 'App', walkin: 'Walk-in', personal: 'Manual' })[s] ?? s; }
function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const today = toDateStr(new Date());
  const [startDate,   setStartDate]   = useState(() => dateFromDaysAgo(7));
  const [endDate,     setEndDate]     = useState(today);
  const [activeQuick, setActiveQuick] = useState('1w');
  const [tab,         setTab]         = useState('overview'); // 'overview' | 'financial'
  const [unlocked,    setUnlocked]    = useState(false);
  const [userEmail,   setUserEmail]   = useState('');
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [payouts,     setPayouts]     = useState([]);
  const [payTarget,   setPayTarget]   = useState(null); // ArtistPayoutSummary being paid
  const [isLight,     setIsLight]     = useState(false);
  useEffect(() => {
    const check = () => setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Restore unlock state from sessionStorage on mount. Also grab the logged-in email.
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('revenue_unlocked') === '1') {
      setUnlocked(true);
    }
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setUserEmail(session.user.email);
    });
  }, []);

  // Load payout summaries once unlocked.
  useEffect(() => {
    if (!unlocked) return;
    getPayoutSummaries().then(d => setPayouts(d.payouts ?? [])).catch(() => {});
  }, [unlocked]);

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

  function exportCSV() {
    if (!stats?.weekly?.length) return;
    const rows = [
      ['Week Start', 'Gross Sales', 'Deposits Collected'],
      ...stats.weekly.map(w => [w.week_start, w.gross_sales ?? 0, w.deposits_collected ?? 0]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `revenue-${startDate}-to-${endDate}.csv`;
    a.click();
  }

  function handleUnlock() {
    setUnlocked(true);
    sessionStorage.setItem('revenue_unlocked', '1');
  }
  function handleLock() {
    setUnlocked(false);
    sessionStorage.removeItem('revenue_unlocked');
  }

  const weeklyChart = useMemo(() => {
    if (!stats?.weekly?.length) return [];
    return stats.weekly.map(w => ({
      week: new Date(w.week_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      gross: w.gross_sales,
      deposits: w.deposits_collected,
    }));
  }, [stats]);

  const s = stats?.summary;
  const a = stats?.appointments;
  const c = stats?.customers;

  return (
    <div style={st.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={st.header}>
        <h1 style={st.title}>Analytics</h1>
        <div style={st.controls}>
          <div style={st.quickPicker}>
            {QUICK_OPTIONS.map(opt => (
              <button key={opt.label} onClick={() => applyQuick(opt)}
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
          <div style={st.dateSep} />
          <button onClick={exportCSV} disabled={!stats?.weekly?.length} style={st.exportBtn} title="Export weekly stats as CSV">
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div style={st.tabBar}>
        <button onClick={() => setTab('overview')}
          style={{ ...st.tabBtn, ...(tab === 'overview' ? st.tabActive : {}) }}>
          Overview
        </button>
        <button onClick={() => setTab('financial')}
          style={{ ...st.tabBtn, ...(tab === 'financial' ? st.tabActive : {}) }}>
          <LockIcon locked={!unlocked} />
          Financial
        </button>
        {tab === 'financial' && unlocked && (
          <button onClick={handleLock} style={st.lockBtn} title="Lock financial tab">
            Lock
          </button>
        )}
      </div>

      {/* ── Payout panel ───────────────────────────────────────────────────── */}
      {payTarget && (
        <PayoutPanel
          artist={payTarget}
          onClose={() => setPayTarget(null)}
          onPaid={() => {
            getPayoutSummaries().then(d => setPayouts(d.payouts ?? [])).catch(() => {});
            setPayTarget(null);
          }}
        />
      )}

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={st.body}>
        {loading && <p style={st.msg}>Loading…</p>}
        {error   && <p style={{ ...st.msg, color: '#e86f6f' }}>{error}</p>}

        {!loading && !error && stats && (
          <>
            {/* ── Overview tab ──────────────────────────────────────────── */}
            {tab === 'overview' && (
              <>
                <Section title="Appointment metrics">
                  <div style={st.kpiGrid}>
                    <KpiCard label="Total appointments"    value={a?.total ?? 0} />
                    <KpiCard label="Completed"             value={a?.completed ?? 0} color="#4cc98a" />
                    <KpiCard label="Confirmed / upcoming"  value={a?.confirmed ?? 0} color="#6fa3e8" />
                    <KpiCard label="Pending"               value={a?.pending ?? 0}   color="#f59e3a" />
                    <KpiCard label="Cancelled"             value={a?.cancelled ?? 0} color={isLight ? 'rgba(17,16,8,0.35)' : 'rgba(255,255,255,0.3)'} />
                    <KpiCard label="No-shows"              value={a?.no_shows ?? 0}  color="#e86f6f" />
                    <KpiCard label="Avg appointment value" value={fmt(a?.avg_value)} accent />
                    <KpiCard label="Appointment revenue"   value={fmt(a?.revenue)} />
                  </div>
                  {a?.by_source?.length > 0 && (
                    <SourceBreakdown data={a.by_source} />
                  )}
                </Section>

                <Section title="Customer insights">
                  <div style={st.kpiGrid}>
                    <KpiCard label="New clients"       value={c?.new_clients ?? 0}       color="#4cc98a" />
                    <KpiCard label="Returning clients" value={c?.returning_clients ?? 0} color="#6fa3e8" />
                  </div>
                  {c?.top_clients?.length > 0 && (
                    <>
                      <p style={st.sectionSub}>Top clients by spend in period</p>
                      <div style={st.tableScroll}>
                        <table style={st.table}>
                          <thead>
                            <tr>{['Client','Visits','Last visit','Spend','Avg spend'].map(h => <th key={h} style={st.th}>{h}</th>)}</tr>
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

            {/* ── Financial tab ─────────────────────────────────────────── */}
            {tab === 'financial' && (
              unlocked
                ? <>
                    <FinancialContent s={s} weeklyChart={weeklyChart} byArtist={stats.by_artist} startDate={startDate} endDate={endDate} isLight={isLight} />
                    <PayoutsSection payouts={payouts} onPay={setPayTarget} />
                  </>
                : <PasswordGate email={userEmail} onUnlock={handleUnlock} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Financial content (shown when unlocked) ───────────────────────────────────

function FinancialContent({ s, weeklyChart, byArtist, startDate, endDate, isLight }) {
  const tickColor = isLight ? 'rgba(17,16,8,0.4)' : 'rgba(255,255,255,0.3)';
  const gridColor = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
  const tooltipBg = isLight ? '#f5f2ec' : '#151b24';
  const tooltipBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
  const tooltipColor = isLight ? '#111008' : '#fff';
  return (
    <>
      <Section title={`Revenue summary · ${startDate} – ${endDate}`}>
        <div style={st.kpiGrid}>
          <KpiCard label="Gross sales"           value={fmt(s?.gross_sales)}       accent />
          <KpiCard label="Net sales"             value={fmt(s?.net_sales)}          />
          <KpiCard label="Deposits collected"    value={fmt(s?.deposits_collected)} />
          <KpiCard label="Remaining balances"    value={fmt(s?.remaining_balances)} />
          <KpiCard label="Completed sessions"    value={s?.completed_sessions ?? 0} />
          <KpiCard label="Refunds"               value="—" dim />
          <KpiCard label="Discounts given"       value="—" dim />
          <KpiCard label="Taxes collected"       value="—" dim />
          <KpiCard label="Gift card sales"       value="—" dim />
          <KpiCard label="Gift card redemptions" value="—" dim />
          <KpiCard label="Tips"                  value="—" dim />
        </div>
      </Section>

      <Section title="Weekly gross sales">
        {weeklyChart.length > 0 ? (
          <div style={st.chartWrap}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyChart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis dataKey="week" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  formatter={(value, name) => [fmt(value), name === 'gross' ? 'Gross sales' : 'Deposits']}
                  contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor }}
                  labelStyle={{ color: tickColor }}
                />
                <Bar dataKey="gross"    fill="rgba(245,236,217,0.55)" radius={[3,3,0,0]} name="Gross sales" />
                <Bar dataKey="deposits" fill="rgba(111,163,232,0.4)"  radius={[3,3,0,0]} name="Deposits" />
              </BarChart>
            </ResponsiveContainer>
            <div style={st.legend}>
              <LegendDot color="rgba(245,236,217,0.8)" label="Gross sales" />
              <LegendDot color="rgba(111,163,232,0.8)" label="Deposits" />
            </div>
          </div>
        ) : (
          <p style={st.empty}>No completed sessions in this period.</p>
        )}
      </Section>

      {byArtist?.length > 0 && (
        <Section title="Artist performance">
          <div style={st.tableScroll}>
            <table style={st.table}>
              <thead>
                <tr>{['Artist','Tattoos','Revenue','Avg ticket','Deposits','Hours','Sales / hr'].map(h => <th key={h} style={st.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {byArtist.map(ar => (
                  <tr key={ar.artist_id} style={st.tr}>
                    <td style={{ ...st.td, color: 'var(--text)', fontWeight: 500 }}>{ar.artist_name}</td>
                    <td style={st.td}>{ar.session_count}</td>
                    <td style={{ ...st.td, color: 'var(--accent)' }}>{fmt(ar.gross_sales)}</td>
                    <td style={st.td}>{fmt(ar.avg_ticket)}</td>
                    <td style={st.td}>{fmt(ar.deposits_collected)}</td>
                    <td style={st.td}>{fmtHours(ar.estimated_hours)}</td>
                    <td style={st.td}>{ar.sales_per_hour > 0 ? fmt(ar.sales_per_hour) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {byArtist.some(a => a.estimated_hours > 0) && (
            <p style={st.note}>Hours are estimated from proposed session duration.</p>
          )}
        </Section>
      )}
    </>
  );
}

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ email, onUnlock }) {
  const [value,   setValue]   = useState('');
  const [shake,   setShake]   = useState(false);
  const [wrong,   setWrong]   = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password: value });
    setLoading(false);
    if (!error) {
      onUnlock();
    } else {
      setWrong(true);
      setShake(true);
      setValue('');
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div style={st.gateWrap}>
      <div style={{ ...st.gateBox, animation: shake ? 'shake 0.45s ease' : 'none' }}>
        <div style={st.gateIcon}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p style={st.gateTitle}>Financial data is protected</p>
        <p style={st.gateSubtitle}>Enter the password to view revenue &amp; artist performance.</p>
        <form onSubmit={handleSubmit} style={st.gateForm}>
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={e => { setValue(e.target.value); setWrong(false); }}
            placeholder="Password"
            style={{ ...st.gateInput, borderColor: wrong ? '#e86f6f' : 'var(--border)' }}
            autoComplete="off"
          />
          {wrong && <p style={st.gateError}>Incorrect password</p>}
          <button type="submit" style={{ ...st.gateBtn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? 'Verifying…' : 'Unlock'}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-5px); }
          80%      { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

const SOURCE_COLORS = { app: '#6fa3e8', walkin: '#4cc98a', personal: '#f59e3a' };

function SourceBreakdown({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map(d => ({
    name: formatSource(d.source),
    value: d.count,
    color: SOURCE_COLORS[d.source] ?? '#a78bfa',
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

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{label}</span>
    </div>
  );
}

function LockIcon({ locked }) {
  return locked ? (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Payouts section ───────────────────────────────────────────────────────────

function PayoutsSection({ payouts, onPay }) {
  if (!payouts?.length) return null;
  const hasCut = payouts.some(p => p.artist_payout != null && p.artist_payout !== p.total_earned);
  const headers = hasCut
    ? ['Artist', 'Gross', 'Artist payout', 'Paid out', 'Outstanding', '']
    : ['Artist', 'Earned', 'Paid out', 'Outstanding', ''];
  return (
    <Section title="Artist payouts · all-time">
      <div style={st.tableScroll}>
        <table style={st.table}>
          <thead>
            <tr>{headers.map(h => <th key={h} style={st.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {payouts.map(p => (
              <tr key={p.artist_id} style={st.tr}>
                <td style={{ ...st.td, color: 'var(--text)', fontWeight: 500 }}>{p.artist_name}</td>
                <td style={st.td}>{fmt(p.total_earned)}</td>
                {hasCut && (
                  <td style={{ ...st.td, fontWeight: 600, color: '#4cc98a' }}>{fmt(p.artist_payout)}</td>
                )}
                <td style={st.td}>{fmt(p.total_paid)}</td>
                <td style={{
                  ...st.td,
                  color: p.outstanding > 0 ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 600,
                }}>
                  {fmt(p.outstanding)}
                </td>
                <td style={{ ...st.td, textAlign: 'right' }}>
                  {p.outstanding > 0 && (
                    <button onClick={() => onPay(p)} style={st.payBtn}>Pay out</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Payout panel (modal) ──────────────────────────────────────────────────────

function PayoutPanel({ artist, onClose, onPaid }) {
  const [mode,     setMode]     = useState('full'); // 'full' | 'custom'
  const [custom,   setCustom]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [note,     setNote]     = useState('');
  const [error,    setError]    = useState('');
  const [history,  setHistory]  = useState(null); // null = loading

  useEffect(() => {
    getArtistPayoutHistory(artist.artist_id)
      .then(d => setHistory(d.payouts ?? []))
      .catch(() => setHistory([]));
  }, [artist.artist_id]);

  const amount = mode === 'full' ? artist.outstanding : parseFloat(custom || '0');
  const valid  = amount > 0 && amount <= artist.outstanding + 0.001;

  async function handlePay() {
    if (!valid) return;
    setSaving(true);
    setError('');
    try {
      await createPayout(artist.artist_id, amount, note || null);
      onPaid();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  function fmtShortDate(iso) {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div style={st.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...st.panel, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={st.panelHeader}>
          <div>
            <p style={st.panelTitle}>Pay out · {artist.artist_name}</p>
            <p style={st.panelSub}>Outstanding: {fmt(artist.outstanding)}</p>
          </div>
          <button onClick={onClose} style={st.closeBtn}>✕</button>
        </div>

        <div style={st.panelBody}>
          {artist.outstanding > 0 && <>
            {/* Mode toggle */}
            <div style={st.modeRow}>
              <button
                onClick={() => setMode('full')}
                style={{ ...st.modeBtn, ...(mode === 'full' ? st.modeBtnActive : {}) }}
              >
                Full amount
              </button>
              <button
                onClick={() => setMode('custom')}
                style={{ ...st.modeBtn, ...(mode === 'custom' ? st.modeBtnActive : {}) }}
              >
                Custom amount
              </button>
            </div>

            {mode === 'full' ? (
              <div style={st.fullAmt}>{fmt(artist.outstanding)}</div>
            ) : (
              <div style={st.customRow}>
                <span style={st.currencySign}>$</span>
                <input
                  type="number"
                  min="0.01"
                  max={artist.outstanding}
                  step="0.01"
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  placeholder="0.00"
                  style={st.customInput}
                  autoFocus
                />
              </div>
            )}

            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note (optional)"
              style={st.noteInput}
            />

            {error && <p style={{ fontSize: '0.78rem', color: '#e86f6f', margin: 0 }}>{error}</p>}

            <button
              onClick={handlePay}
              disabled={!valid || saving}
              style={{ ...st.confirmBtn, opacity: (!valid || saving) ? 0.45 : 1 }}
            >
              {saving ? 'Recording…' : `Record payout of ${fmt(amount)}`}
            </button>
          </>}

          {/* Payout history */}
          <div style={{ marginTop: artist.outstanding > 0 ? '1.5rem' : 0 }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-ghost)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>
              Payout history
            </p>
            {history === null && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading…</p>}
            {history !== null && history.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-ghost)' }}>No payouts recorded yet.</p>
            )}
            {history !== null && history.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {history.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0.65rem', background: 'var(--bg-chip)', borderRadius: 7, border: '1px solid var(--border-faint)' }}>
                    <div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{fmt(p.amount)}</span>
                      {p.note && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{p.note}</span>}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{fmtShortDate(p.paid_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
  weekBtnActive: { background: 'var(--accent-tint)', borderColor: 'var(--accent-tint-border)', color: 'var(--accent)' },
  exportBtn: {
    padding: '0.3rem 0.75rem', borderRadius: 20,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  tabBar: {
    display: 'flex', alignItems: 'center', gap: '0.25rem',
    padding: '0 2rem', borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.65rem 0.85rem', background: 'none', border: 'none',
    borderBottom: '2px solid transparent', marginBottom: '-1px',
    fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)',
    cursor: 'pointer', transition: 'color 0.12s',
  },
  tabActive: { color: 'var(--text)', borderBottomColor: 'var(--accent)' },
  lockBtn: {
    marginLeft: 'auto', padding: '0.3rem 0.7rem', borderRadius: 6,
    border: '1px solid var(--border-faint)', background: 'transparent',
    color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer',
  },

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
  chartWrap: {
    background: 'var(--bg-card)', border: '1px solid var(--border-faint)',
    borderRadius: 12, padding: '1.25rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  legend: { display: 'flex', gap: '1rem', paddingLeft: '0.25rem' },
  empty:  { fontSize: '0.85rem', color: 'var(--text-ghost)' },
  sourceRow: { display: 'flex', gap: '0.6rem', flexWrap: 'wrap' },
  sourceChip: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'var(--bg-chip)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '0.4rem 0.75rem',
  },
  sourceCount: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' },
  sourceLabel: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 },
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
  note: { fontSize: '0.72rem', color: 'var(--text-ghost)', fontStyle: 'italic' },

  payBtn: {
    padding: '0.3rem 0.75rem', borderRadius: 6,
    border: '1px solid var(--accent-tint-border)', background: 'var(--accent-tint)',
    color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  panel: {
    background: 'var(--bg-modal)', border: '1px solid var(--border)',
    borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-faint)',
  },
  panelTitle: { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  panelSub:   { fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-faint)',
    fontSize: '1rem', cursor: 'pointer', padding: '0.1rem 0.25rem', lineHeight: 1,
  },
  panelBody: { padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  modeRow: { display: 'flex', gap: '0.5rem' },
  modeBtn: {
    flex: 1, padding: '0.5rem', borderRadius: 8,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
  },
  modeBtnActive: {
    background: 'var(--accent-tint)', borderColor: 'var(--accent-tint-border)', color: 'var(--accent)',
  },
  fullAmt: {
    fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.03em',
    textAlign: 'center', padding: '0.5rem 0',
  },
  customRow: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    background: 'var(--bg-chip)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '0.6rem 0.75rem',
  },
  currencySign: { fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 600 },
  customInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em',
  },
  noteInput: {
    width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-input)',
    color: 'var(--text-dim)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
  },
  confirmBtn: {
    padding: '0.7rem', borderRadius: 8, border: 'none',
    background: 'var(--accent-tint)', color: 'var(--accent)',
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em',
  },

  gateWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem' },
  gateBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 16, padding: '2.5rem 2rem', width: '100%', maxWidth: 340,
  },
  gateIcon:     { marginBottom: '0.25rem' },
  gateTitle:    { fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', textAlign: 'center' },
  gateSubtitle: { fontSize: '0.8rem', color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.5 },
  gateForm:  { display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', marginTop: '0.5rem' },
  gateInput: {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-input)',
    color: 'var(--text)', fontSize: '0.875rem', outline: 'none',
    boxSizing: 'border-box',
  },
  gateError: { fontSize: '0.75rem', color: '#e86f6f', textAlign: 'center', margin: 0 },
  gateBtn: {
    padding: '0.65rem', borderRadius: 8, border: 'none',
    background: 'var(--accent-tint)', color: 'var(--accent)',
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em',
  },
};
