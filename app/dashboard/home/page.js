'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  getStudioArtists,
  getStudioSchedule,
  getStudioScheduleRange,
  getMyStudioAccount,
  listConsentTemplates,
  generateConsentLink,
  getBatchClientConsentSubmissions,
} from '@/lib/api';
import { initials, toISODate } from '@/lib/format';

const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false });

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [toISODate(mon), toISODate(sun)];
}

export default function HomePage() {
  const [artists, setArtists] = useState([]);
  const [todayEntries, setTodayEntries] = useState([]);
  const [weekEntries, setWeekEntries] = useState([]);
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [submissionsByEmail, setSubmissionsByEmail] = useState({});
  const [loading, setLoading] = useState(true);
  const [walkInUrl, setWalkInUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendingLink, setSendingLink] = useState(null);
  const [sentLink, setSentLink] = useState(null);

  const today = toISODate(new Date());

  useEffect(() => {
    async function load() {
      try {
        const [weekStart, weekEnd] = getWeekRange();
        const [artistData, scheduleData, weekData, accountData, templateData] = await Promise.all([
          getStudioArtists('approved'),
          getStudioSchedule(today),
          getStudioScheduleRange(weekStart, weekEnd),
          getMyStudioAccount(),
          listConsentTemplates(),
        ]);

        const a = artistData.artists ?? [];
        const e = scheduleData.entries ?? [];
        const we = weekData.entries ?? [];
        const templates = templateData.templates ?? [];

        setArtists(a);
        setTodayEntries(e);
        setWeekEntries(we);
        setConsentTemplates(templates);

        if (accountData?.studio_id) {
          setWalkInUrl(`${window.location.origin}/studio-booking?s=${accountData.studio_id}`);
        }

        // Fetch consent submissions for today's unique client emails
        const emails = [...new Set(e.map(x => x.requesterEmail).filter(Boolean))];
        if (emails.length > 0 && templates.length > 0) {
          const subData = await getBatchClientConsentSubmissions(emails);
          const byEmail = {};
          for (const sub of (subData.submissions ?? [])) {
            if (!byEmail[sub.client_email]) byEmail[sub.client_email] = [];
            byEmail[sub.client_email].push(sub);
          }
          setSubmissionsByEmail(byEmail);
        }
      } catch {
        // show empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const firstTemplate = consentTemplates[0];

  function getConsentStatus(email) {
    if (!firstTemplate || !email) return 'unknown';
    const subs = submissionsByEmail[email] ?? [];
    const sub = subs.find(s => s.template_id === firstTemplate.id);
    if (!sub) return 'none';
    if (new Date(sub.submitted_at) < new Date(firstTemplate.updated_at)) return 'outdated';
    return 'current';
  }

  async function handleSendLink(email) {
    setSendingLink(email);
    try {
      await generateConsentLink(email, firstTemplate?.id);
      setSentLink(email);
      setTimeout(() => setSentLink(null), 3000);
    } catch (e) { alert(e.message); }
    finally { setSendingLink(null); }
  }

  // Group today by artist
  const byArtist = {};
  for (const entry of todayEntries) {
    const key = entry.artistId ?? '__unassigned__';
    if (!byArtist[key]) byArtist[key] = [];
    byArtist[key].push(entry);
  }

  const artistsWorkingToday = artists.filter(a => byArtist[a.artistId ?? a.id]);
  const artistsOffToday = artists.filter(a => !byArtist[a.artistId ?? a.id]);

  // Week utilization per artist
  const weekByArtist = {};
  for (const entry of weekEntries) {
    if (!entry.artistId) continue;
    weekByArtist[entry.artistId] = (weekByArtist[entry.artistId] || 0) + 1;
  }
  const maxWeekCount = Math.max(1, ...Object.values(weekByArtist));
  const weekUtilization = [...artists]
    .map(a => ({ artist: a, count: weekByArtist[a.artistId ?? a.id] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // Pending alerts
  const unconfirmedCount = todayEntries.filter(e => e.status === 'requires_confirmation').length;
  const awaitingPaymentCount = todayEntries.filter(e => e.status === 'awaiting_payment').length;

  // Clients today missing consent (deduped by email)
  const consentNeededEntries = todayEntries
    .filter(e => e.requesterEmail && getConsentStatus(e.requesterEmail) !== 'current' && getConsentStatus(e.requesterEmail) !== 'unknown')
    .reduce((acc, e) => {
      if (!acc.some(x => x.requesterEmail === e.requesterEmail)) acc.push(e);
      return acc;
    }, [])
    .sort((a, b) => new Date(a.chosenTime) - new Date(b.chosenTime));

  const hasPending = unconfirmedCount > 0 || awaitingPaymentCount > 0 || consentNeededEntries.length > 0;
  const dateLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Today</h1>
        <p style={s.date}>{dateLabel}</p>
      </div>

      <div style={s.body}>
        {loading && <p style={s.msg}>Loading...</p>}

        {/* Walk-in link */}
        {walkInUrl && (
          <div style={s.walkInCard}>
            <div style={s.walkInLeft}>
              <span style={s.walkInTitle}>Booking link</span>
              <span style={s.walkInSub}>Share with clients for walk-in bookings</span>
              <div style={s.walkInUrlRow}>
                <span style={s.walkInUrlText}>{walkInUrl}</span>
                <button
                  style={s.copyBtn}
                  onClick={() => {
                    navigator.clipboard.writeText(walkInUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div style={s.walkInQr}>
              <QRCodeSVG value={walkInUrl} size={80} bgColor="transparent" fgColor="currentColor" level="M" />
            </div>
          </div>
        )}

        {/* Pending alerts */}
        {!loading && hasPending && (
          <div style={s.alertCard}>
            <span style={s.alertTitle}>Needs attention</span>
            <div style={s.alertChips}>
              {unconfirmedCount > 0 && (
                <span style={{ ...s.chip, background: 'rgba(245,158,58,0.12)', color: '#f59e3a', border: '1px solid rgba(245,158,58,0.25)' }}>
                  {unconfirmedCount} unconfirmed
                </span>
              )}
              {awaitingPaymentCount > 0 && (
                <span style={{ ...s.chip, background: 'rgba(156,163,175,0.12)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {awaitingPaymentCount} awaiting payment
                </span>
              )}
              {consentNeededEntries.length > 0 && (
                <span style={{ ...s.chip, background: 'rgba(232,111,111,0.1)', color: '#e86f6f', border: '1px solid rgba(232,111,111,0.2)' }}>
                  {consentNeededEntries.length} consent needed
                </span>
              )}
            </div>
          </div>
        )}

        {/* Consent needed today */}
        {!loading && consentNeededEntries.length > 0 && (
          <div style={s.card}>
            <span style={s.sectionTitle}>Consent needed today</span>
            <div style={s.consentList}>
              {consentNeededEntries.map(entry => {
                const status = getConsentStatus(entry.requesterEmail);
                const isSending = sendingLink === entry.requesterEmail;
                const isSent = sentLink === entry.requesterEmail;
                return (
                  <div key={entry.requesterEmail} style={s.consentRow}>
                    <span style={s.consentName}>{entry.clientName}</span>
                    <span style={s.consentTime}>{formatTime(entry.chosenTime)}</span>
                    <span style={{
                      ...s.badge,
                      ...(status === 'outdated'
                        ? { background: 'rgba(245,158,58,0.12)', color: '#f59e3a', border: '1px solid rgba(245,158,58,0.25)' }
                        : { background: 'rgba(232,111,111,0.1)', color: '#e86f6f', border: '1px solid rgba(232,111,111,0.2)' }),
                    }}>
                      {status === 'outdated' ? 'OUTDATED' : 'MISSING'}
                    </span>
                    <button
                      style={{ ...s.sendBtn, opacity: isSending ? 0.6 : 1 }}
                      onClick={() => handleSendLink(entry.requesterEmail)}
                      disabled={isSending}
                    >
                      {isSent ? 'Sent ✓' : isSending ? '...' : 'Send link →'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Today's schedule per artist */}
        {!loading && artistsWorkingToday.length === 0 && (
          <p style={s.msg}>No bookings today.</p>
        )}

        {!loading && artistsWorkingToday
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(artist => {
            const bookings = (byArtist[artist.artistId ?? artist.id] ?? [])
              .sort((a, b) => new Date(a.chosenTime) - new Date(b.chosenTime));
            return (
              <div key={artist.id} style={s.card}>
                <div style={s.cardHeader}>
                  {artist.profileImage ? (
                    <img src={artist.profileImage} alt={artist.name} style={s.avatar} />
                  ) : (
                    <div style={{ ...s.avatar, ...s.avatarFallback }}>{initials(artist.name)}</div>
                  )}
                  <div style={s.artistMeta}>
                    <span style={s.artistName}>{artist.name}</span>
                    <span style={s.bookingCount}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div style={s.bookingList}>
                  {bookings.map(b => (
                    <div key={b.bookingId} style={s.bookingRow}>
                      <span style={s.time}>{formatTime(b.chosenTime)}</span>
                      <span style={s.client}>{b.clientName}</span>
                      {b.sessionType && <span style={s.sessionType}>{b.sessionType}</span>}
                      {b.durationMins && <span style={s.duration}>{b.durationMins}m</span>}
                      {b.status === 'requires_confirmation' && (
                        <span style={{ ...s.statusPill, background: 'rgba(245,158,58,0.12)', color: '#f59e3a' }}>unconfirmed</span>
                      )}
                      {b.status === 'awaiting_payment' && (
                        <span style={{ ...s.statusPill, background: 'rgba(156,163,175,0.1)', color: 'var(--text-muted)' }}>unpaid</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

        {/* Artists in / off today */}
        {!loading && artists.length > 0 && (
          <div style={s.twoCol}>
            <div style={s.card}>
              <span style={s.sectionTitle}>In today ({artistsWorkingToday.length})</span>
              {artistsWorkingToday.length === 0 ? (
                <span style={s.empty}>—</span>
              ) : artistsWorkingToday.map(a => (
                <div key={a.id} style={s.artistRow}>
                  {a.profileImage ? (
                    <img src={a.profileImage} alt={a.name} style={s.avatarSm} />
                  ) : (
                    <div style={{ ...s.avatarSm, ...s.avatarFallback }}>{initials(a.name)}</div>
                  )}
                  <span style={s.artistRowName}>{a.name}</span>
                  <span style={s.countBadge}>{(byArtist[a.artistId ?? a.id] ?? []).length}</span>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <span style={s.sectionTitle}>Off today ({artistsOffToday.length})</span>
              {artistsOffToday.length === 0 ? (
                <span style={s.empty}>Everyone's in</span>
              ) : artistsOffToday.map(a => (
                <div key={a.id} style={{ ...s.artistRow, opacity: 0.4 }}>
                  {a.profileImage ? (
                    <img src={a.profileImage} alt={a.name} style={s.avatarSm} />
                  ) : (
                    <div style={{ ...s.avatarSm, ...s.avatarFallback }}>{initials(a.name)}</div>
                  )}
                  <span style={s.artistRowName}>{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Week utilization */}
        {!loading && artists.length > 0 && (
          <div style={s.card}>
            <span style={s.sectionTitle}>This week</span>
            <div style={s.utilList}>
              {weekUtilization.map(({ artist, count }) => (
                <div key={artist.id} style={s.utilRow}>
                  <span style={s.utilName}>{artist.name}</span>
                  <div style={s.utilBarBg}>
                    <div style={{ ...s.utilBarFill, width: count === 0 ? '0%' : `${Math.max(4, (count / maxWeekCount) * 100)}%` }} />
                  </div>
                  <span style={s.utilCount}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
    margin: 0,
  },
  date: {
    fontSize: '0.8rem',
    color: 'var(--text-faint)',
    marginTop: '0.2rem',
    marginBottom: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  msg: { fontSize: '0.875rem', color: 'var(--text-faint)' },

  // Walk-in card
  walkInCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  walkInLeft: { display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: 0 },
  walkInTitle: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' },
  walkInSub: { fontSize: '0.72rem', color: 'var(--text-secondary)' },
  walkInUrlRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' },
  walkInUrlText: {
    fontSize: '0.7rem', color: 'var(--text-muted)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  copyBtn: {
    background: 'var(--bg-chip)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-muted)',
    fontSize: '0.7rem', fontWeight: 600,
    padding: '0.2rem 0.6rem', cursor: 'pointer', flexShrink: 0,
  },
  walkInQr: { flexShrink: 0, background: 'var(--bg-card)', borderRadius: 8, padding: 6 },

  // Alert card
  alertCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    borderRadius: 12,
    padding: '0.85rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    flexWrap: 'wrap',
  },
  alertTitle: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', flexShrink: 0 },
  alertChips: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  chip: {
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.25rem 0.6rem',
    borderRadius: 6,
  },

  // Generic card
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    borderRadius: 12,
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  sectionTitle: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '0.01em',
  },

  // Consent section
  consentList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  consentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
    padding: '0.45rem 0',
    borderTop: '1px solid var(--border-faint)',
  },
  consentName: { fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  consentTime: { fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 },
  badge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '0.15rem 0.45rem',
    borderRadius: 5,
    flexShrink: 0,
  },
  sendBtn: {
    background: 'var(--bg-chip)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 600,
    padding: '0.25rem 0.65rem',
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },

  // Artist booking cards
  cardHeader: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  avatar: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  avatarFallback: {
    background: 'var(--accent-tint)',
    color: 'var(--accent)',
    fontSize: '0.8rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistMeta: { display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  artistName: { fontSize: '0.925rem', fontWeight: 700, color: 'var(--text)' },
  bookingCount: { fontSize: '0.72rem', color: 'var(--text-secondary)' },
  bookingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    borderTop: '1px solid var(--border-faint)',
    paddingTop: '0.75rem',
  },
  bookingRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  time: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: 64, flexShrink: 0 },
  client: { fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-dim)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sessionType: { fontSize: '0.72rem', color: 'var(--text-secondary)', flexShrink: 0 },
  duration: { fontSize: '0.72rem', color: 'var(--text-ghost)', flexShrink: 0 },
  statusPill: { fontSize: '0.65rem', fontWeight: 600, padding: '0.15rem 0.4rem', borderRadius: 5, flexShrink: 0 },

  // In/Off two column
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  artistRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  avatarSm: { width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, fontSize: '0.65rem', fontWeight: 700 },
  artistRowName: { fontSize: '0.82rem', color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  countBadge: {
    fontSize: '0.68rem', fontWeight: 700,
    background: 'var(--bg-chip)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    padding: '0.1rem 0.4rem',
    color: 'var(--text-secondary)',
    flexShrink: 0,
  },
  empty: { fontSize: '0.8rem', color: 'var(--text-faint)' },

  // Week utilization
  utilList: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  utilRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  utilName: { fontSize: '0.82rem', color: 'var(--text)', minWidth: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  utilBarBg: { flex: 1, height: 6, background: 'var(--bg-chip)', borderRadius: 3, overflow: 'hidden' },
  utilBarFill: { height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s ease' },
  utilCount: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 22, textAlign: 'right', flexShrink: 0 },
};
