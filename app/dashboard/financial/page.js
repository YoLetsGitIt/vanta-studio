'use client';

import Dialog from '@/components/ui/Dialog';

import { useState, useEffect, useRef, useMemo, useId } from 'react';
import { getStudioRevenueStats, getPayoutSummaries, createPayout, deletePayout, getArtistPayoutHistory, getArtistEarningsBreakdown, getReimbursements, reviewReimbursement, getMyStudioAccount, recordStudioBookingPayment } from '@/lib/api';
import CompleteBookingModal from '@/components/CompleteBookingModal';
import { getSupabase } from '@/lib/supabase';
import { toISODate } from '@/lib/format';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useLanguage } from '@/lib/i18n';
import { requestConfirmation, showError } from '@/lib/feedback';
import { getBookingSourceLabel } from '@/lib/bookingType';
import css from './page.module.css';

// This entire page (Financial + Artists & Payouts) is password-protected, but
// only for the initial entry each browser session — unlock state persists in
// sessionStorage so navigating away and back doesn't re-prompt. It re-locks
// on "Lock" or once the browser tab is closed.

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
// Whole dollars, for overview tables where cents are noise.
function fmtWhole(n) {
  if (n == null || n === '') return '—';
  return '$' + Math.round(Number(n)).toLocaleString('en-US');
}
function fmtHours(h) { return h ? Number(h).toFixed(1) + 'h' : '—'; }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinancialPage() {
  const { t } = useLanguage();
  const today = toDateStr(new Date());
  const [startDate,   setStartDate]   = useState(() => dateFromDaysAgo(7));
  const [endDate,     setEndDate]     = useState(today);
  const [activeQuick, setActiveQuick] = useState('1w');
  const [tab,         setTab]         = useState('financial'); // 'financial' | 'artists'
  const [unlocked,    setUnlocked]    = useState(false);
  const [userEmail,   setUserEmail]   = useState('');
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [payouts,      setPayouts]      = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [reviewingReimbursement, setReviewingReimbursement] = useState(null); // id being reviewed
  const [payTarget,    setPayTarget]    = useState(null); // ArtistPayoutSummary being paid
  const [earningsTarget, setEarningsTarget] = useState(null); // { artist_id, artist_name } for earnings breakdown
  const [paymentRequirement, setPaymentRequirement] = useState('studio_only');
  const [isLight,     setIsLight]     = useState(false);
  useEffect(() => {
    const check = () => setIsLight(['light', 'nature'].includes(document.documentElement.getAttribute('data-theme')));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // Restore unlock state from sessionStorage on mount. Also grab the logged-in email.
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('financial_unlocked') === '1') {
      setUnlocked(true);
    }
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setUserEmail(session.user.email);
    });
  }, []);

  function handleUnlock() {
    setUnlocked(true);
    sessionStorage.setItem('financial_unlocked', '1');
  }

  // Load payout summaries + reimbursement requests once unlocked.
  useEffect(() => {
    if (!unlocked) return;
    Promise.all([getPayoutSummaries(), getReimbursements(), getMyStudioAccount()])
      .then(([payoutData, reimbursementData, accountData]) => {
        setPayouts(payoutData.payouts ?? []);
        setReimbursements(reimbursementData.reimbursements ?? []);
        setPaymentRequirement(accountData.studio?.payment_recording_requirement ?? 'studio_only');
      })
      .catch(error => setError(error?.message || 'Financial data could not be loaded.'));
  }, [unlocked]);

  async function handleReviewReimbursement(id, action) {
    setReviewingReimbursement(id);
    try {
      await reviewReimbursement(id, action);
      const [r, p] = await Promise.all([getReimbursements(), getPayoutSummaries()]);
      setReimbursements(r.reimbursements ?? []);
      setPayouts(p.payouts ?? []); // approved claims change outstanding amounts
    } catch (e) {
      showError(e);
    } finally {
      setReviewingReimbursement(null);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    if (!startDate || !endDate || startDate > endDate) return;
    setLoading(true);
    setError('');
    getStudioRevenueStats(startDate, endDate)
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [unlocked, startDate, endDate]);

  function applyQuick(opt) {
    setActiveQuick(opt.label);
    setEndDate(today);
    setStartDate(opt.days === null ? ytdStart() : dateFromDaysAgo(opt.days));
  }
  function onStartChange(e) { setStartDate(e.target.value); setActiveQuick(null); }
  function onEndChange(e)   { setEndDate(e.target.value);   setActiveQuick(null); }

  function handleLock() {
    setUnlocked(false);
    sessionStorage.removeItem('financial_unlocked');
  }

  // One bar per day for ranges up to 31 days, otherwise one per week (weeks start on
  // Monday, like the server's). Days or weeks with no sales still get a bar so the
  // axis covers the whole range.
  const salesChart = useMemo(() => {
    if (!stats || !startDate || !endDate) return { rows: [], daily: false };
    const toUTC = v => { const [y, m, d] = v.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
    const first = toUTC(startDate), last = toUTC(endDate);
    const DAY = 86400000;
    const daily = Array.isArray(stats.daily) && (last - first) / DAY < 31;
    const source = new Map((daily ? stats.daily : stats.weekly ?? []).map(p => [daily ? p.date : p.week_start, p]));
    const step = daily ? DAY : 7 * DAY;
    const startAt = daily ? first : new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * DAY);
    const rows = [];
    for (let at = startAt; at <= last && rows.length < 400; at = new Date(at.getTime() + step)) {
      const p = source.get(at.toISOString().slice(0, 10));
      // Each bar is the money that came in that day (or week): deposits on the day
      // they were paid, and balances on the day the session was completed.
      const gross = p?.gross_sales ?? 0;
      const deposits = p?.deposits_collected ?? 0;
      const onTheDay = Math.max(gross - Math.min(p?.sales_from_deposits ?? 0, gross), 0);
      // A week's label is its first day inside the chosen range.
      const labelDate = at < first ? first : at;
      rows.push({
        week: labelDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        total: deposits + onTheDay,
        deposits,
        onTheDay,
      });
    }
    return { rows, daily };
  }, [stats, startDate, endDate]);
  const weeklyChart = salesChart.rows;

  const s = stats?.summary;

  // On the Financial tab they set the whole page. On Artists & Payouts only Artist
  // performance uses them (payouts are all-time), so they sit beside that table.
  const dateControls = (
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
  );

  if (!unlocked) {
    return (
      <div className="studio-feature-page studio-financial-page" style={st.page}>
        <div className="studio-feature-header" style={st.header}>
          <h1 style={st.title}>{t('revenue_financial')}</h1>
        </div>
        <PasswordGate email={userEmail} onUnlock={handleUnlock} />
      </div>
    );
  }

  return (
    <div className="studio-feature-page studio-financial-page" style={st.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="studio-feature-header" style={st.header}>
        <h1 style={st.title}>{t('revenue_financial')}</h1>
        {tab === 'financial' && dateControls}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="studio-tab-bar" style={st.tabBar}>
        <button aria-pressed={tab === 'financial'} onClick={() => setTab('financial')}
          style={{ ...st.tabBtn, ...(tab === 'financial' ? st.tabActive : {}) }}>
          {t('revenue_financial')}
        </button>
        <button aria-pressed={tab === 'artists'} onClick={() => setTab('artists')}
          style={{ ...st.tabBtn, ...(tab === 'artists' ? st.tabActive : {}) }}>
          Artists & Payouts
        </button>
        <button onClick={handleLock} style={st.lockBtn} title="Lock">
          {t('revenue_lock')}
        </button>
      </div>

      {/* ── Payout panel ───────────────────────────────────────────────────── */}
      {payTarget && (
        <PayoutPanel
          artist={payTarget}
          requirement={paymentRequirement}
          onRecorded={() => {
            // Refresh the counts without closing the panel.
            getPayoutSummaries().then(d => {
              const list = d.payouts ?? [];
              setPayouts(list);
              setPayTarget(pt => (pt && list.find(p => p.artist_id === pt.artist_id)) || pt);
            }).catch(() => {});
          }}
          onClose={() => setPayTarget(null)}
          onViewBookings={() => { setEarningsTarget(payTarget); setPayTarget(null); }}
          onPaid={() => {
            getPayoutSummaries().then(d => setPayouts(d.payouts ?? [])).catch(() => {});
            setPayTarget(null);
          }}
        />
      )}

      {/* ── Earnings breakdown panel ────────────────────────────────────────── */}
      {earningsTarget && (
        <EarningsPanel
          artist={earningsTarget}
          requirement={paymentRequirement}
          onClose={() => setEarningsTarget(null)}
        />
      )}

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="studio-feature-body" style={st.body}>
        {tab === 'financial' && loading && <p role="status" style={st.msg}>{t('loading')}</p>}
        {error && <p role="alert" style={{ ...st.msg, color: 'var(--color-danger)' }}>{error}</p>}

        {tab === 'financial' && !loading && !error && stats && (
          <FinancialContent s={s} weeklyChart={weeklyChart} daily={salesChart.daily} startDate={startDate} endDate={endDate} isLight={isLight} />
        )}

        {/* What needs doing first, then the reporting. Payouts don't wait for the date range. */}
        {tab === 'artists' && (
          <>
            <PayoutsSection payouts={payouts} onPay={setPayTarget} />
            <ReimbursementsSection
              reimbursements={reimbursements}
              reviewingId={reviewingReimbursement}
              onReview={handleReviewReimbursement}
            />
            <ArtistPerformance stats={stats} loading={loading} controls={dateControls} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Financial content ───────────────────────────────────────────────────────

function FinancialContent({ s, weeklyChart, daily, startDate, endDate, isLight }) {
  const { t } = useLanguage();
  const tickColor = isLight ? 'rgba(17,16,8,0.4)' : 'rgba(255,255,255,0.3)';
  const gridColor = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
  const tooltipBg = isLight ? '#ffffff' : '#151b24';
  const tooltipBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
  const tooltipColor = isLight ? '#111008' : '#fff';
  return (
    <>
      <Section title={`Revenue summary · ${rangeLabel(startDate, endDate)}`}>
        {(() => {
          const sessions = s?.completed_sessions ?? 0;
          const showNet = s?.net_sales != null && s.net_sales !== s.gross_sales;
          return (
            <div className="studio-revenue-summary" style={st.summaryPanel}>
              <div style={st.summaryCol}>
                <span style={st.summaryLabel}>{t('revenue_gross_sales')}</span>
                <span style={st.summaryValue}>{fmt(s?.gross_sales)}</span>
                <span style={st.summaryHint}>{sessions ? `From ${sessions} completed ${sessions === 1 ? 'session' : 'sessions'}` : 'No completed sessions in this period'}</span>
                {showNet && <span style={st.summaryHint}>{t('revenue_net_sales')}: {fmt(s?.net_sales)} after refunds and discounts</span>}
              </div>
              <div className="studio-revenue-summary-divider" style={st.summaryDivider} aria-hidden="true" />
              <div style={st.summaryCol}>
                <span style={{ ...st.summaryLabel, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span aria-hidden="true" style={{ ...st.summaryDot, background: 'var(--color-info)' }} />{t('revenue_deposits')}</span>
                <span style={st.summaryValue}>{fmt(s?.deposits_collected)}</span>
                <span style={st.summaryHint}>
                  Every deposit clients paid in this period, on the day they paid it. Most are for appointments still to come, so they’re not in Sales until the session is done.
                </span>
              </div>
            </div>
          );
        })()}
        <p style={st.comingSoon}>Refunds, discounts, taxes, gift cards and tips will appear here once they’re available.</p>
      </Section>

      <Section title={daily ? 'Money received each day' : 'Money received each week'}>
        {weeklyChart.length > 0 ? (
          <div style={st.chartWrap}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyChart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis dataKey="week" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  cursor={{ fill: gridColor }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload;
                    return (
                      <div style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipColor, padding: '0.5rem 0.65rem', minWidth: 170 }}>
                        <div style={{ color: tickColor, marginBottom: 4 }}>{daily ? label : `Week of ${label}`}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: 700 }}><span>Received</span><span>{fmt(row.total)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Deposits</span><span>{fmt(row.deposits)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>Paid on the day</span><span>{fmt(row.onTheDay)}</span></div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="deposits" stackId="sales" fill="var(--color-info)" name="Deposits" />
                <Bar dataKey="onTheDay" stackId="sales" fill="var(--color-success)" radius={[4,4,0,0]} name="Paid on the day" />
              </BarChart>
            </ResponsiveContainer>
            <div style={st.legend}>
              <LegendDot color="var(--color-info)" label="Deposits received" />
              <LegendDot color="var(--color-success)" label="Paid on the day" />
            </div>
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', minHeight: 44, lineHeight: '44px' }}>View chart data</summary>
              <table style={{ width: '100%', textAlign: 'left', fontSize: 14 }}>
                <caption style={{ textAlign: 'left', padding: '8px 0' }}>{daily ? 'Money received each day' : 'Money received each week'}</caption>
                <thead><tr><th scope="col">{daily ? 'Day' : 'Week'}</th><th scope="col">Received</th><th scope="col">Deposits</th><th scope="col">Paid on the day</th></tr></thead>
                <tbody>{weeklyChart.map(row => <tr key={row.week}><th scope="row">{row.week}</th><td>{fmt(row.total)}</td><td>{fmt(row.deposits)}</td><td>{fmt(row.onTheDay)}</td></tr>)}</tbody>
              </table>
            </details>
          </div>
        ) : (
          <p style={st.empty}>{t('revenue_no_sessions')}</p>
        )}
      </Section>
    </>
  );
}

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ email, onUnlock }) {
  const { t } = useLanguage();
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
        <p style={st.gateTitle}>{t('revenue_protected')}</p>
        <p style={st.gateSubtitle}>{t('revenue_password_hint')}</p>
        <form onSubmit={handleSubmit} style={st.gateForm}>
          <input
            ref={inputRef}
            type="password"
            aria-label={t('revenue_password')}
            aria-invalid={wrong}
            aria-describedby={wrong ? 'financial-password-error' : undefined}
            value={value}
            onChange={e => { setValue(e.target.value); setWrong(false); }}
            placeholder={t('revenue_password')}
            style={{ ...st.gateInput, borderColor: wrong ? '#e86f6f' : 'var(--border)' }}
            autoComplete="current-password"
          />
          {wrong && <p id="financial-password-error" role="alert" style={st.gateError}>{t('revenue_wrong_password')}</p>}
          <button type="submit" style={{ ...st.gateBtn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {t(loading ? 'revenue_verifying' : 'revenue_unlock')}
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

function Section({ title, aside, children }) {
  return (
    <section style={st.section}>
      {aside
        ? <div style={st.sectionHead}><h2 style={st.sectionTitle}>{title}</h2>{aside}</div>
        : <h2 style={st.sectionTitle}>{title}</h2>}
      {children}
    </section>
  );
}

// "2026-10-31", "2026-11-07" → "31 Oct – 7 Nov 2026"
function rangeLabel(start, end) {
  const d = v => new Date(`${v}T00:00:00`);
  if (!start || !end) return '';
  const a = d(start), b = d(end);
  const sameYear = a.getFullYear() === b.getFullYear();
  const startText = a.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
  return `${startText} – ${b.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{label}</span>
    </div>
  );
}

// ── Reimbursements section ────────────────────────────────────────────────────

const REIMB_STATUS_STYLE = {
  pending:  { color: 'var(--color-warning)', bg: 'var(--color-warning-surface)', label: 'Pending'  },
  approved: { color: 'var(--color-success)', bg: 'var(--color-success-surface)', label: 'Paid out' },
  rejected: { color: 'var(--color-danger)',  bg: 'var(--color-danger-surface)',  label: 'Rejected' },
};

function ReimbursementsSection({ reimbursements, reviewingId, onReview }) {
  const { t } = useLanguage();
  const [showPast, setShowPast] = useState(false);
  if (!reimbursements?.length) return null;
  const pending = reimbursements.filter(rb => rb.status === 'pending');
  const past = reimbursements.filter(rb => rb.status !== 'pending');
  const rows = showPast ? [...pending, ...past] : pending;
  return (
    <Section title={t('revenue_reimbursements')} aside={pending.length > 0 && <span style={st.sectionMeta}>{pending.length} to review</span>}>
      {rows.length > 0 ? (
        <div style={st.tableCard}>
          <div style={st.tableScroll}>
            <table className={css.compact} style={st.tableFlat}>
              <thead>
                <tr>
                  <th style={st.th}>{t('revenue_artist')}</th>
                  <th style={st.th} className={css.wide}>{t('revenue_requested')}</th>
                  <th style={st.th}>{t('revenue_description')}</th>
                  <th style={{ ...st.th, ...st.num }}>{t('revenue_amount')}</th>
                  <th style={st.th}><span style={st.srOnly}>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((rb, i) => {
                  const sc = REIMB_STATUS_STYLE[rb.status] ?? REIMB_STATUS_STYLE.pending;
                  const busy = reviewingId === rb.id;
                  return (
                    <tr key={rb.id} style={i < rows.length - 1 ? st.tr : undefined}>
                      <td style={st.tdName}>{rb.artist_name}</td>
                      <td style={st.td} className={css.wide}>{new Date(rb.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td style={{ ...st.td, minWidth: 110, whiteSpace: 'normal' }}>{rb.description}</td>
                      <td style={{ ...st.td, ...st.num, color: 'var(--text)', fontWeight: 600 }}>{fmt(rb.amount)}</td>
                      <td style={st.tdActions}>
                        {rb.status === 'pending' ? (
                          <span className={css.actions}>
                            <button type="button" className={css.quiet} onClick={() => onReview(rb.id, 'reject')} disabled={busy} style={{ ...st.quietBtn, opacity: busy ? 0.5 : 1 }}>{t('reject')}</button>
                            <button type="button" onClick={() => onReview(rb.id, 'approve')} disabled={busy} style={{ ...st.payBtn, opacity: busy ? 0.5 : 1 }}>Mark paid</button>
                          </span>
                        ) : (
                          <span style={{ ...st.statusTag, background: sc.bg, color: sc.color }}>{sc.label}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : <p style={st.msg}>Nothing to review.</p>}
      {past.length > 0 && (
        <button type="button" className={css.quiet} aria-expanded={showPast} onClick={() => setShowPast(v => !v)} style={{ ...st.quietBtn, alignSelf: 'flex-start' }}>
          {showPast ? 'Hide past requests' : `Show past requests (${past.length})`}
        </button>
      )}
    </Section>
  );
}

// ── Artist performance ────────────────────────────────────────────────────────

function ArtistPerformance({ stats, loading, controls }) {
  const { t } = useLanguage();
  const artists = stats?.by_artist ?? [];
  const num = { ...st.td, ...st.num };
  return (
    <Section title={t('revenue_artist_perf')} aside={controls}>
      {!stats ? (loading && <p role="status" style={st.msg}>{t('loading')}</p>)
        : artists.length === 0 ? (!loading && <p style={st.msg}>No completed sessions in this period.</p>)
        : (
          // The last results stay in place, dimmed, while a new date range loads.
          <div aria-busy={loading} style={{ ...st.tableCard, opacity: loading ? 0.55 : 1, transition: 'opacity 150ms ease' }}>
            <div style={st.tableScroll}>
              <table style={st.tableFlat}>
                <thead>
                  <tr>
                    <th style={st.th}>{t('revenue_artist')}</th>
                    {[t('revenue_tattoos'), t('revenue_gross_sales'), t('revenue_avg_ticket'), t('revenue_deposits'), t('revenue_hours'), t('revenue_sales_hr')].map(h => <th key={h} style={{ ...st.th, ...st.num }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {artists.map((ar, i) => (
                    <tr key={ar.artist_id} style={i < artists.length - 1 ? st.tr : undefined}>
                      <td style={{ ...st.tdName, whiteSpace: 'nowrap' }}>{ar.artist_name}</td>
                      <td style={num}>{ar.session_count}</td>
                      <td style={{ ...num, color: 'var(--text)', fontWeight: 600 }}>{fmtWhole(ar.gross_sales)}</td>
                      <td style={num}>{fmtWhole(ar.avg_ticket)}</td>
                      <td style={num}>{fmtWhole(ar.deposits_collected)}</td>
                      <td style={num}>{fmtHours(ar.estimated_hours)}</td>
                      <td style={num}>{ar.sales_per_hour > 0 ? fmtWhole(ar.sales_per_hour) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      {artists.some(a => a.estimated_hours > 0) && <p style={st.note}>{t('revenue_hours_note')}</p>}
    </Section>
  );
}

// ── Payouts section ───────────────────────────────────────────────────────────

function PayoutsSection({ payouts, onPay }) {
  const { t } = useLanguage();
  if (!payouts?.length) return null;
  const earned = p => p.artist_payout ?? p.total_earned;
  // One order to scan: ready to pay, then needs review, then settled. Largest first in each.
  const stage = p => (p.outstanding > 0 ? (p.incomplete_recordings > 0 ? 1 : 0) : 2);
  const rows = [...payouts].sort((a, b) => stage(a) - stage(b) || (b.outstanding ?? 0) - (a.outstanding ?? 0));
  const owed = rows.filter(p => p.outstanding > 0);
  const totalOwed = owed.reduce((sum, p) => sum + p.outstanding, 0);
  const num = { ...st.td, ...st.num };
  return (
    <Section title="Payouts" aside={(
      <span style={st.sectionMeta}>
        {owed.length > 0
          ? <><strong style={{ color: 'var(--text)', fontWeight: 650 }}>{fmt(totalOwed)}</strong> owed to {owed.length} artist{owed.length > 1 ? 's' : ''} · all time</>
          : 'Everyone is paid up · all time'}
      </span>
    )}>
      <div style={st.tableCard}>
        <div style={st.tableScroll}>
          <table className={css.compact} style={st.tableFlat}>
            <thead>
              <tr>
                <th style={st.th}>{t('revenue_artist')}</th>
                <th style={{ ...st.th, ...st.num }} className={css.wide}>Earned</th>
                <th style={{ ...st.th, ...st.num }} className={css.wide}>Paid</th>
                <th style={{ ...st.th, ...st.num }}>Owed</th>
                <th style={st.th}><span style={st.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const missing = p.incomplete_recordings > 0;
                const label = p.outstanding > 0 ? (missing ? 'Review' : 'Pay out') : 'History';
                return (
                  <tr key={p.artist_id} className={css.row} style={{ ...(i < rows.length - 1 ? st.tr : {}), cursor: 'pointer' }} onClick={() => onPay(p)}>
                    <td style={{ ...st.tdName, verticalAlign: 'middle' }}>
                      <span style={st.nameLine}>
                        <button type="button" className={css.name} onClick={e => { e.stopPropagation(); onPay(p); }} aria-label={`Open payouts for ${p.artist_name}`} style={st.artistLink}>{p.artist_name}</button>
                        {missing && <span style={st.missingNote}>{p.incomplete_recordings} payment{p.incomplete_recordings > 1 ? 's' : ''} not recorded</span>}
                      </span>
                    </td>
                    <td style={{ ...num, verticalAlign: 'middle' }} className={css.wide}>{fmt(earned(p))}</td>
                    <td style={{ ...num, verticalAlign: 'middle' }} className={css.wide}>{p.total_paid > 0 ? fmt(p.total_paid) : '—'}</td>
                    <td style={{ ...num, verticalAlign: 'middle', fontWeight: 650, color: p.outstanding > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{fmt(p.outstanding)}</td>
                    <td style={{ ...st.tdActions, verticalAlign: 'middle' }}>
                      <button type="button" onClick={e => { e.stopPropagation(); onPay(p); }} aria-label={`${label}: ${p.artist_name}`}
                        style={{ ...st.payBtn, ...st.rowAction, ...(label === 'Pay out' ? {} : st.rowActionQuiet) }}>{label}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

function PayoutPanel({ artist, requirement, onClose, onPaid, onRecorded, onViewBookings }) {
  const { t } = useLanguage();
  const [mode,     setMode]     = useState('full'); // 'full' | 'custom'
  const [custom,   setCustom]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [note,     setNote]     = useState('');
  const [method,   setMethod]   = useState('bank_transfer');
  const [error,    setError]    = useState('');
  const [history,  setHistory]  = useState(null); // null = loading
  const [deleting, setDeleting] = useState(null); // payout id being deleted
  const [openPayout, setOpenPayout] = useState(null); // the history row showing its details
  // Once there's something to review, the list stays open (it shows 'All recorded' when done).
  const [reviewOpen] = useState(artist.incomplete_recordings > 0);
  const locked = artist.incomplete_recordings > 0;

  function loadHistory() {
    getArtistPayoutHistory(artist.artist_id)
      .then(d => setHistory(d.payouts ?? []))
      .catch(() => setHistory([]));
  }

  useEffect(() => { loadHistory(); }, [artist.artist_id]);

  const amount = mode === 'full' ? artist.outstanding : parseFloat(custom || '0');
  const valid  = amount > 0 && amount <= artist.outstanding + 0.001;

  async function handlePay() {
    if (!valid || locked) return;
    setSaving(true);
    setError('');
    try {
      await createPayout(artist.artist_id, amount, note || null, method);
      onPaid();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  async function handleDelete(payoutId) {
    if (!await requestConfirmation({ title: 'Delete payout record?', message: 'This removes the payout record and cannot be undone.', confirmLabel: 'Delete payout', danger: true })) return;
    setDeleting(payoutId);
    try {
      await deletePayout(payoutId);
      onPaid(); // refresh payout summaries table
      loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Dialog title={artist.artist_name} description={artist.outstanding > 0 ? `${fmt(artist.outstanding)} outstanding` : t('revenue_all_paid')} onClose={onClose} dismissDisabled={saving || !!deleting} maxWidth={440} footer={<button type="button" style={st.payBtn} disabled={saving || !!deleting} onClick={onClose}>Close</button>}>
        <div style={st.panelBody}>
          {/* The detail behind the Payouts table's one line per artist. */}
          <div>
            <dl style={st.panelStats}>
              <PanelStat label="Gross sales" value={fmt(artist.total_earned)} />
              {artist.artist_payout != null && artist.artist_payout !== artist.total_earned && <PanelStat label="Artist payout" value={fmt(artist.artist_payout)} />}
              {artist.reimbursed > 0 && <PanelStat label="Reimbursed" value={`+ ${fmt(artist.reimbursed)}`} />}
              <PanelStat label="Paid" value={artist.total_paid > 0 ? fmt(artist.total_paid) : '—'} />
            </dl>
            {artist.earned_studio > 0 && artist.earned_personal > 0 && (
              <p style={st.panelStatNote}>Studio {fmt(artist.earned_studio)} · Personal {fmt(artist.earned_personal)}</p>
            )}
          </div>
          {artist.incomplete_recordings > 0 && (
            <div style={{
              background: 'var(--color-warning-surface)', border: '1px solid var(--color-warning-border)',
              borderRadius: 8, padding: '0.7rem 0.9rem',
              display: 'flex', flexDirection: 'column', gap: '0.6rem',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                  ⚠ {artist.incomplete_recordings} booking{artist.incomplete_recordings > 1 ? 's' : ''} missing required payment recording{artist.incomplete_recordings > 1 ? 's' : ''}
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Record these payments below to unlock this payout.
                </p>
              </div>
            </div>
          )}
          {reviewOpen && (
            <MissingPayments artist={artist} requirement={requirement} onRecorded={onRecorded} />
          )}
          {artist.outstanding > 0 && <>
            {/* Mode toggle */}
            <div style={st.modeRow}>
              <button
                aria-pressed={mode === 'full'}
                onClick={() => setMode('full')}
                style={{ ...st.modeBtn, ...(mode === 'full' ? st.modeBtnActive : {}) }}
              >
                Full amount
              </button>
              <button
                aria-pressed={mode === 'custom'}
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
                  aria-label="Custom payout amount"
                  inputMode="decimal"
                  min="0.01"
                  max={artist.outstanding}
                  step="0.01"
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                  placeholder="0.00"
                  style={st.customInput}
                  autoFocus
                />
              </div>
            )}

            <select aria-label="Payout method" value={method} onChange={e => setMethod(e.target.value)} style={st.noteInput}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>

            <input
              type="text"
              aria-label="Payout note (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Note (optional)"
              style={st.noteInput}
            />

            {error && <p role="alert" style={{ fontSize: '0.78rem', color: 'var(--color-danger)', margin: 0 }}>{error}</p>}

            <button
              onClick={handlePay}
              disabled={!valid || saving || locked}
              aria-describedby={locked ? 'payout-locked-note' : undefined}
              style={{ ...st.confirmBtn, opacity: (!valid || saving || locked) ? 0.45 : 1, cursor: locked ? 'not-allowed' : st.confirmBtn.cursor }}
            >
              {saving ? 'Recording…' : locked ? 'Payout locked' : `Record payout of ${fmt(amount)}`}
            </button>
            {locked && (
              <p id="payout-locked-note" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Unlocks once every booking payment above is recorded.
              </p>
            )}
          </>}

          {/* Payout history */}
          <div>
            <div style={st.historyHead}>
              <p style={st.historyHeading}>{t('revenue_payout_history')}</p>
              <button type="button" className={css.quiet} onClick={onViewBookings} disabled={saving || !!deleting} style={st.quietBtn}>View bookings →</button>
            </div>
            {history === null && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('loading')}</p>}
            {history !== null && history.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-ghost)' }}>{t('revenue_no_payouts')}</p>
            )}
            {history !== null && history.length > 0 && (
              <div style={st.historyList}>
                {[...history].sort((x, y) => new Date(y.paid_at) - new Date(x.paid_at)).map(p => (
                  <PayoutHistoryRow key={p.id} payout={p} open={openPayout === p.id} deleting={deleting === p.id}
                    onToggle={() => setOpenPayout(id => (id === p.id ? null : p.id))} onDelete={() => handleDelete(p.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
    </Dialog>
  );
}

function PanelStat({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={st.panelStatLabel}>{label}</dt>
      <dd style={st.panelStatValue}>{value}</dd>
    </div>
  );
}

// One past payout: its date and amount. Opens to show how it was paid and the bookings it covered.
function PayoutHistoryRow({ payout: p, open, deleting, onToggle, onDelete }) {
  const panelId = useId();
  const bookings = p.bookings ?? [];
  const shortDate = iso => (iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const method = p.payment_method ? ({ cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', online: 'Online', other: 'Other' })[p.payment_method] ?? p.payment_method : 'Method not recorded';
  return (
    <div className={css.historyItem}>
      <button type="button" className={css.historyRow} aria-expanded={open} aria-controls={panelId} onClick={onToggle} style={st.historyRow}>
        <span>{shortDate(p.paid_at)}</span>
        <span style={st.historyAmount}>{fmt(p.amount)}</span>
        <span aria-hidden="true" className={css.chevron} data-open={open || undefined}>›</span>
      </button>
      {open && (
        <div id={panelId} style={st.historyDetail}>
          <p style={st.historyLine}>{method}{p.recorded_by_email ? ` · Recorded by ${p.recorded_by_email}` : ''}</p>
          {p.note && <p style={st.historyLine}>{p.note}</p>}
          {bookings.length > 0 ? (
            <ul style={st.historyBookings} aria-label={`${bookings.length} booking${bookings.length > 1 ? 's' : ''} covered`}>
              {bookings.map(b => (
                <li key={b.booking_id} style={st.historyBooking}>
                  <span style={{ minWidth: 0 }}>{shortDate(b.chosen_time)} · {b.client_name}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(b.artist_cut)}</span>
                </li>
              ))}
            </ul>
          ) : <p style={st.historyLine}>Not linked to specific bookings.</p>}
          <button type="button" className={css.quiet} onClick={onDelete} disabled={deleting} style={{ ...st.quietBtn, alignSelf: 'flex-start', color: 'var(--color-danger)', opacity: deleting ? 0.5 : 1 }}>Delete payout</button>
        </div>
      )}
    </div>
  );
}

// ── Earnings breakdown panel ──────────────────────────────────────────────────

// Bookings missing the payment recording the studio requires, shown inside the payout
// panel so the studio can record them before paying the artist out.
function MissingPayments({ artist, requirement, onRecorded }) {
  const [entries, setEntries] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(null); // entry being recorded
  const [saving, setSaving] = useState(false);

  function load() {
    getArtistEarningsBreakdown(artist.artist_id)
      .then(d => { setEntries(d.entries ?? []); setError(''); })
      .catch(e => { setEntries([]); setError(e.message); });
  }
  useEffect(load, [artist.artist_id]);

  const has = (e, who) => (e.splits ?? []).some(x => x.recorded_by === who);
  const needsStudio = e => requirement !== 'artist_only' && !has(e, 'studio');
  const needsArtist = e => (requirement === 'artist_only' || requirement === 'both') && !has(e, 'artist');
  // Older backends don't send needs_recording; fall back to the rule without the date cut-off.
  const missing = (entries ?? []).filter(e => (e.needs_recording ?? (needsStudio(e) || needsArtist(e))));

  async function save(splits) {
    setSaving(true);
    try {
      await recordStudioBookingPayment(recording.booking_id, splits);
      setRecording(null);
      load();
      onRecorded?.();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'No date';

  return (
    <div style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border-faint)' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>Bookings to review</span>
      </div>
      {entries === null && <p style={{ margin: 0, padding: '0.9rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading bookings…</p>}
      {error && <p role="alert" style={{ margin: 0, padding: '0.9rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}>{error}</p>}
      {entries !== null && !error && missing.length === 0 && (
        <p style={{ margin: 0, padding: '0.9rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>All payments are recorded.</p>
      )}
      {missing.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 280, overflowY: 'auto' }}>
          {missing.map(e => {
            const studioMissing = needsStudio(e);
            const artistMissing = needsArtist(e);
            const what = studioMissing && artistMissing ? 'Studio and artist payments not recorded'
              : studioMissing ? 'Studio payment not recorded'
              : 'Waiting for the artist to record their payment';
            return (
              <li key={e.booking_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.9rem', borderTop: '1px solid var(--border-faint)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', overflowWrap: 'anywhere' }}>{e.client_name || 'Client'}</p>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {fmtDate(e.chosen_time)}{e.gross != null ? ` · ${fmt(e.gross)}` : ''}
                  </p>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: '#f59e3a' }}>{what}</p>
                </div>
                {studioMissing && (
                  <button type="button" onClick={() => setRecording(e)} style={{ ...st.payBtn, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    Record payment
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {recording && (
        <CompleteBookingModal mode="record" saving={saving}
          initialPrice={recording.gross}
          initialSplits={(recording.splits ?? []).filter(x => x.recorded_by === 'artist')}
          onCancel={() => setRecording(null)}
          onConfirm={(_price, splits) => save(splits)} />
      )}
    </div>
  );
}

function EarningsPanel({ artist, requirement, onClose }) {
  const { t } = useLanguage();
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    getArtistEarningsBreakdown(artist.artist_id)
      .then(d => setEntries(d.entries ?? []))
      .catch(() => setEntries([]));
  }, [artist.artist_id]);

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtMethod(m) {
    return ({ cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', online: 'Online' })[m] ?? m;
  }

  function SplitGroup({ label, splits }) {
    if (!splits || splits.length === 0) {
      return (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-ghost)', minWidth: 34 }}>{label}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-ghost)' }}>—</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-ghost)', minWidth: 34 }}>{label}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          {splits.map((s, i) => (
            <span key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {fmtMethod(s.method)} <span style={{ color: 'var(--text-ghost)' }}>{fmt(s.amount)}</span>
            </span>
          ))}
        </span>
      </div>
    );
  }

  function PaymentCell({ entry }) {
    if (entry.splits && entry.splits.length > 0) {
      const showArtist = requirement !== 'studio_only';
      const showStudio = requirement !== 'artist_only';
      const artistSplits = entry.splits.filter(s => s.recorded_by === 'artist');
      const studioSplits = entry.splits.filter(s => s.recorded_by === 'studio');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {showArtist && <SplitGroup label="Artist" splits={artistSplits} />}
          {showStudio && <SplitGroup label="Studio" splits={studioSplits} />}
        </div>
      );
    }
    if (entry.payment_method) {
      return <span style={{ fontSize: '0.82rem' }}>{fmtMethod(entry.payment_method)}</span>;
    }
    return <span style={{ color: 'var(--text-ghost)' }}>—</span>;
  }

  const total = entries ? entries.reduce((s, e) => s + (e.artist_cut ?? 0), 0) : null;

  return (
    <Dialog title={`Earnings breakdown · ${artist.artist_name}`} description={t('revenue_earnings_desc')} onClose={onClose} maxWidth={820} contentStyle={{ padding: 0 }} footer={<button type="button" style={st.payBtn} onClick={onClose}>Close</button>}>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {entries === null && (
            <p style={{ padding: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('loading')}</p>
          )}
          {entries !== null && entries.length === 0 && (
            <p style={{ padding: '1.5rem', fontSize: '0.85rem', color: 'var(--text-ghost)' }}>No completed bookings found.</p>
          )}
          {entries !== null && entries.length > 0 && (
            <>
              <table style={{ ...st.table, borderRadius: 0, border: 'none', borderBottom: '1px solid var(--border-faint)' }}>
                <thead>
                  <tr>
                    {[t('revenue_date'), t('revenue_client'), t('revenue_source'), t('revenue_payment'), t('revenue_gross'), t('revenue_artist_cut'), 'Payout status'].map(h => (
                      <th key={h} style={st.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.booking_id} style={{ ...st.tr, background: e.paid ? 'transparent' : 'rgba(245,158,58,0.05)' }}>
                      <td style={{ ...st.td, whiteSpace: 'nowrap' }}>{fmtDate(e.chosen_time)}</td>
                      <td style={{ ...st.td, color: 'var(--text)', fontWeight: 500 }}>{e.client_name}</td>
                      <td style={st.td}>{getBookingSourceLabel(e.source)}</td>
                      <td style={st.td}><PaymentCell entry={e} /></td>
                      <td style={st.td}>{fmt(e.gross)}</td>
                      <td style={{ ...st.td, fontWeight: 600, color: '#4cc98a' }}>{fmt(e.artist_cut)}</td>
                      <td style={st.td}>
                        {e.paid
                          ? <span style={st.paidBadge}>● Paid out</span>
                          : <span style={st.unpaidBadge}>● Outstanding</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-faint)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('revenue_total_payout')}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4cc98a' }}>{fmt(total)}</span>
              </div>
            </>
          )}
        </div>
    </Dialog>
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

  tabBar: {
    display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap',
    padding: '0 2rem', borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.65rem 0.85rem', background: 'none', border: 'none',
    borderBottom: '2px solid transparent', marginBottom: '-1px',
    fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-dim)',
    cursor: 'pointer', transition: 'color 0.12s',
  },
  tabActive: { color: 'var(--text)', borderBottomColor: 'var(--accent)' },
  lockBtn: {
    marginLeft: 'auto', padding: '0.4rem 0.85rem', borderRadius: 8,
    border: '1px solid var(--border-strong)', background: 'transparent',
    color: 'var(--text-dim)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
  },

  body: {
    flex: 1, overflowY: 'auto', padding: '1.5rem 2rem',
    display: 'flex', flexDirection: 'column', gap: '2.5rem',
  },
  msg: { fontSize: '0.875rem', color: 'var(--text-faint)' },
  section: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem 1rem', flexWrap: 'wrap', minHeight: 36 },
  sectionMeta: { fontSize: '0.875rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },
  sectionTitle: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem' },
  kpiBreakdown: { margin: '0.35rem 0 0', paddingTop: '0.55rem', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  kpiBreakdownRow: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-dim)' },
  kpiHint: { fontSize: '0.8rem', lineHeight: 1.35, color: 'var(--text-dim)' },
  comingSoon: { margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' },
  summaryPanel: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1px minmax(0, 1fr)', gap: '1.75rem', padding: '1.4rem 1.6rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)' },
  summaryCol: { display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 },
  summaryDivider: { background: 'var(--border)' },
  summaryLabel: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)' },
  summaryValue: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 },
  summaryHint: { fontSize: '0.85rem', lineHeight: 1.45, color: 'var(--text-muted)', maxWidth: '42ch' },
  summaryDot: { width: 8, height: 8, borderRadius: 2, flexShrink: 0 },
  kpiCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '1.1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem',
  },
  kpiVal:   { fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.03em' },
  kpiLabel: { fontSize: '0.875rem', color: 'var(--text-dim)', fontWeight: 600 },
  dimBadge: { fontSize: '0.62rem', color: 'var(--text-ghost)', fontWeight: 500, letterSpacing: '0.02em' },
  chartWrap: {
    background: 'var(--bg-card)', border: '1px solid var(--border-faint)',
    borderRadius: 12, padding: '1.25rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  legend: { display: 'flex', gap: '1rem', paddingLeft: '0.25rem' },
  empty:  { fontSize: '0.85rem', color: 'var(--text-ghost)' },
  tableScroll: { overflowX: 'auto' },
  table: {
    width: '100%', borderCollapse: 'collapse',
    background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 10,
  },
  th: {
    padding: '0.6rem 1rem', textAlign: 'left',
    fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border-faint)',
  },
  tableCard: { background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12, overflow: 'hidden' },
  tableFlat: { width: '100%', borderCollapse: 'collapse' },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' },
  statusTag: { fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: 20 },
  nameLine: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.1rem 0.6rem' },
  missingNote: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-warning)' },
  rowAction: { minWidth: 78, textAlign: 'center' },
  rowActionQuiet: { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-dim)' },
  panelStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: '0.75rem', margin: 0 },
  panelStatLabel: { fontSize: '0.8rem', color: 'var(--text-muted)' },
  panelStatValue: { margin: '0.15rem 0 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  panelStatNote: { margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' },
  historyHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' },
  historyHeading: { fontSize: '0.875rem', fontWeight: 650, color: 'var(--text)', margin: 0 },
  historyList: { maxHeight: 360, overflowY: 'auto', overscrollBehavior: 'contain', border: '1px solid var(--border-faint)', borderRadius: 10 },
  historyRow: { display: 'grid', gridTemplateColumns: '1fr auto 14px', alignItems: 'center', gap: '0.75rem', width: '100%', minHeight: 44, padding: '0 0.75rem', background: 'transparent', border: 0, color: 'var(--text-dim)', font: 'inherit', fontSize: '0.875rem', textAlign: 'left', cursor: 'pointer' },
  historyAmount: { color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  historyDetail: { display: 'flex', flexDirection: 'column', gap: '0.45rem', padding: '0 0.75rem 0.75rem' },
  historyLine: { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, overflowWrap: 'anywhere' },
  historyBookings: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  historyBooking: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-dim)' },
  quietBtn: { background: 'transparent', border: 0, padding: 0, color: 'var(--text-muted)', font: 'inherit', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' },
  tr: { borderBottom: '1px solid var(--border-faint)' },
  td: { padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500, verticalAlign: 'top' },
  tdActions: { padding: '0.5rem 1rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' },
  tdName: { padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500, verticalAlign: 'top' },
  note: { fontSize: '0.72rem', color: 'var(--text-ghost)', fontStyle: 'italic' },

  payBtn: {
    padding: '0.3rem 0.75rem', borderRadius: 6,
    border: '1px solid var(--accent-tint-border)', background: 'var(--accent-tint)',
    color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
  },
  artistLink: {
    background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', border: 0,
    cursor: 'pointer', padding: 0,
  },
  paidBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-success)',
    background: 'var(--color-success-surface)', border: '1px solid var(--color-success-border)',
    borderRadius: 6, padding: '0.25rem 0.6rem', whiteSpace: 'nowrap',
  },
  unpaidBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-warning)',
    background: 'var(--color-warning-surface)', border: '1px solid var(--color-warning-border)',
    borderRadius: 6, padding: '0.25rem 0.6rem', whiteSpace: 'nowrap',
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
  panelBody: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  modeRow: { display: 'flex', gap: '0.5rem' },
  modeBtn: {
    flex: 1, padding: '0.5rem', borderRadius: 8,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
  },
  modeBtnActive: {
    background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', color: 'var(--accent)',
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
