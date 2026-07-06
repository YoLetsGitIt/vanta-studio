'use client';

import { useState, useEffect, useMemo } from 'react';
import { getSupabase } from '@/lib/supabase';
import { getArtistAnalytics, listBookings } from '@/lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const WEEK_OPTIONS = [4, 8, 12, 24];

export default function AnalyticsPage() {
  const [weeks, setWeeks] = useState(12);
  const [analytics, setAnalytics] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (!session) return;
        const [analyticsData, bookingsData] = await Promise.all([
          getArtistAnalytics(session.user.id, weeks),
          listBookings(''),
        ]);
        setAnalytics(analyticsData);
        setBookings(bookingsData.bookings ?? []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [weeks]);

  const bookingStats = useMemo(() => {
    const counts = {};
    for (const b of bookings) {
      counts[b.status] = (counts[b.status] ?? 0) + 1;
    }
    return {
      total: bookings.length,
      pending: counts.pending ?? 0,
      confirmed: counts.confirmed ?? 0,
      completed: counts.completed ?? 0,
      cancelled: counts.cancelled ?? 0,
      rejected: counts.rejected ?? 0,
      conversionRate: bookings.length > 0
        ? Math.round(((counts.completed ?? 0) / bookings.length) * 100)
        : 0,
    };
  }, [bookings]);

  const chartData = useMemo(() => {
    if (!analytics?.series) return [];
    return analytics.series.map(p => ({
      week: new Date(p.weekStart).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      views: p.tattooSeen,
      contacts: p.contactRequestsReceived,
      posts: p.postsPerWeek,
      conversion: Math.round(p.profileConversionRate * 100),
    }));
  }, [analytics]);

  const totals = useMemo(() => {
    if (!analytics?.series?.length) return null;
    const s = analytics.series;
    return {
      views: s.reduce((a, p) => a + p.tattooSeen, 0),
      contacts: s.reduce((a, p) => a + p.contactRequestsReceived, 0),
      posts: s.reduce((a, p) => a + p.postsPerWeek, 0),
      avgViewsPerPost: s.length > 0
        ? Math.round(s.reduce((a, p) => a + p.viewsPerPost, 0) / s.length)
        : 0,
    };
  }, [analytics]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Analytics</h1>
        <div style={s.weekPicker}>
          {WEEK_OPTIONS.map(w => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              style={{ ...s.weekBtn, ...(weeks === w ? s.weekBtnActive : {}) }}
            >
              {w}w
            </button>
          ))}
        </div>
      </div>

      <div style={s.body}>
        {loading && <p style={s.msg}>Loading…</p>}
        {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}

        {!loading && !error && (
          <>
            {/* Booking funnel */}
            <section style={s.section}>
              <h2 style={s.sectionTitle}>Booking overview</h2>
              <div style={s.statGrid}>
                <StatCard label="Total bookings" value={bookingStats.total} />
                <StatCard label="Pending" value={bookingStats.pending} color="#f59e3a" />
                <StatCard label="Confirmed" value={bookingStats.confirmed} color="#6fa3e8" />
                <StatCard label="Completed" value={bookingStats.completed} color="#4cc98a" />
                <StatCard label="Cancelled" value={bookingStats.cancelled} color="rgba(255,255,255,0.3)" />
                <StatCard label="Conversion" value={`${bookingStats.conversionRate}%`} color="#f5ecd9" />
              </div>
            </section>

            {totals && (
              <>
                {/* Profile reach */}
                <section style={s.section}>
                  <h2 style={s.sectionTitle}>Profile reach · last {weeks}w</h2>
                  <div style={s.statGrid}>
                    <StatCard label="Tattoo views" value={totals.views.toLocaleString()} />
                    <StatCard label="Contact requests" value={totals.contacts.toLocaleString()} />
                    <StatCard label="Posts published" value={totals.posts.toLocaleString()} />
                    <StatCard label="Avg views / post" value={totals.avgViewsPerPost.toLocaleString()} />
                  </div>
                </section>

                {/* Views chart */}
                {chartData.length > 0 && (
                  <section style={s.section}>
                    <h2 style={s.sectionTitle}>Tattoo views per week</h2>
                    <div style={s.chartWrap}>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis
                            dataKey="week"
                            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: '#151b24',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 8,
                              fontSize: 12,
                              color: '#fff',
                            }}
                            labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="views"
                            stroke="#f5ecd9"
                            strokeWidth={2}
                            dot={false}
                            name="Views"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}

                {/* Contacts chart */}
                {chartData.length > 0 && (
                  <section style={s.section}>
                    <h2 style={s.sectionTitle}>Contact requests per week</h2>
                    <div style={s.chartWrap}>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis
                            dataKey="week"
                            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              background: '#151b24',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 8,
                              fontSize: 12,
                              color: '#fff',
                            }}
                            labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                          />
                          <Bar dataKey="contacts" fill="rgba(111,163,232,0.5)" radius={[3, 3, 0, 0]} name="Contacts" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={s.statCard}>
      <span style={{ ...s.statVal, color: color ?? '#ffffff' }}>{value}</span>
      <span style={s.statLabel}>{label}</span>
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
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.01em',
  },
  weekPicker: {
    display: 'flex',
    gap: '0.35rem',
  },
  weekBtn: {
    padding: '0.3rem 0.75rem',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  weekBtnActive: {
    background: 'rgba(245,236,217,0.1)',
    borderColor: 'rgba(245,236,217,0.3)',
    color: '#f5ecd9',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  msg: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.35)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  sectionTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.01em',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '0.75rem',
  },
  statCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  statVal: {
    fontSize: '1.4rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  statLabel: {
    fontSize: '0.72rem',
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 500,
  },
  chartWrap: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '1.25rem 1rem 1rem',
  },
};
