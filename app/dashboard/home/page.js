'use client';

import { useState, useEffect } from 'react';
import {
  getStudioArtists,
  getStudioSchedule,
  getStudioScheduleRange,
  getMyStudioAccount,
  listConsentTemplates,
  generateConsentLink,
  getBatchClientConsentSubmissions,
  getClientConsents,
  listStudioBookings,
} from '@/lib/api';
import { useRouter } from 'next/navigation';
import { initials, toISODate } from '@/lib/format';


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
  const [oldConsents, setOldConsents] = useState({ consents: {}, version: '1' });
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  const [overdueBookings, setOverdueBookings] = useState([]);
  const [paymentRecordingReq, setPaymentRecordingReq] = useState(null);
  const [sendingLink, setSendingLink] = useState(null);
  const [sentLink, setSentLink] = useState(null);
  const router = useRouter();

  const TODAY_SENT_KEY = `consent_sent_${new Date().toISOString().slice(0, 10)}`;
  const [sentToday, setSentToday] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`consent_sent_${new Date().toISOString().slice(0, 10)}`) ?? '[]')); }
    catch { return new Set(); }
  });

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

        const req = accountData.studio?.payment_recording_requirement ?? null;
        setPaymentRecordingReq(req);
        setArtists(a);
        setTodayEntries(e);
        setWeekEntries(we);
        setConsentTemplates(templates);

        // Fetch pending bookings count.
        listStudioBookings('pending').then(d => setPendingCount(d.bookings?.length ?? 0)).catch(() => {});

        // Fetch bookings needing confirmation — across all dates, not just today,
        // so ones scheduled for later in the week don't go unnoticed until overdue.
        listStudioBookings('requires_confirmation').then(d => setUnconfirmedCount(d.bookings?.length ?? 0)).catch(() => {});

        // Fetch overdue confirmed bookings (oldest first so past ones surface first).
        if (req && req !== 'none' && req !== 'artist_only') {
          listStudioBookings('confirmed', '', 'asc').then(d => {
            const now = Date.now();
            const overdue = (d.bookings ?? []).filter(b => {
              const end = new Date(b.chosen_time).getTime() + (b.duration_minutes ?? 60) * 60000;
              return end < now;
            });
            setOverdueBookings(overdue);
          }).catch(() => {});
        }

        // Fetch consent data for today's unique client emails (both systems).
        const emails = [...new Set(e.map(x => x.requesterEmail).filter(Boolean))];
        if (emails.length > 0) {
          const [subData, oldData] = await Promise.allSettled([
            templates.length > 0 ? getBatchClientConsentSubmissions(emails) : Promise.resolve({ submissions: [] }),
            getClientConsents(emails),
          ]);
          if (subData.status === 'fulfilled') {
            const byEmail = {};
            for (const sub of (subData.value.submissions ?? [])) {
              if (!sub.client_email) continue;
              if (!byEmail[sub.client_email]) byEmail[sub.client_email] = [];
              byEmail[sub.client_email].push(sub);
            }
            setSubmissionsByEmail(byEmail);
          }
          if (oldData.status === 'fulfilled') {
            setOldConsents({
              consents: oldData.value.consents ?? {},
              version: oldData.value.current_version ?? '1',
            });
          }
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
    if (!email) return 'unknown';
    // New system (template-based) takes priority.
    if (firstTemplate) {
      const subs = submissionsByEmail[email] ?? [];
      const sub = subs.find(s => s.template_id === firstTemplate.id);
      if (sub) {
        return new Date(sub.submitted_at) < new Date(firstTemplate.updated_at) ? 'outdated' : 'current';
      }
    }
    // Fall back to old version-based system.
    const old = oldConsents.consents[email];
    if (old?.consent_version === oldConsents.version) return 'current';
    if (old) return 'outdated';
    // No templates configured — don't flag anyone.
    if (!firstTemplate) return 'unknown';
    return 'none';
  }

  async function handleSendLink(email) {
    setSendingLink(email);
    try {
      await generateConsentLink(email, firstTemplate?.id);
      setSentLink(email);
      const next = new Set(sentToday);
      next.add(email);
      setSentToday(next);
      localStorage.setItem(TODAY_SENT_KEY, JSON.stringify([...next]));
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

  const awaitingPaymentCount = todayEntries.filter(e => e.status === 'awaiting_payment').length;

  // Clients today missing consent (deduped by email)
  const consentNeededEntries = todayEntries
    .filter(e => e.requesterEmail && getConsentStatus(e.requesterEmail) !== 'current' && getConsentStatus(e.requesterEmail) !== 'unknown')
    .reduce((acc, e) => {
      if (!acc.some(x => x.requesterEmail === e.requesterEmail)) acc.push(e);
      return acc;
    }, [])
    .sort((a, b) => new Date(a.chosenTime) - new Date(b.chosenTime));

  const hasPending = pendingCount > 0 || unconfirmedCount > 0 || awaitingPaymentCount > 0 || consentNeededEntries.length > 0 || overdueBookings.length > 0;
  const dateLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Today</h1>
        <p style={s.date}>{dateLabel}</p>
      </div>

      <div style={s.body}>
        {loading && <p style={s.msg}>Loading...</p>}

        {/* ── NEEDS ATTENTION ───────────────────────────────────── */}
        {!loading && hasPending && (
          <div style={s.section}>
            <span style={s.sectionLabel}>NEEDS ATTENTION</span>
            <div style={s.attentionCard}>

              {pendingCount > 0 && (
                <button style={s.attentionRow} onClick={() => router.push('/dashboard/appointments?status=pending')}>
                  <div style={s.attentionDot('rgba(99,102,241,0.8)')} />
                  <div style={s.attentionBody}>
                    <span style={s.attentionTitle}>{pendingCount} pending booking{pendingCount !== 1 ? 's' : ''}</span>
                    <span style={s.attentionSub}>Awaiting your approval</span>
                  </div>
                  <span style={s.attentionChevron}>→</span>
                </button>
              )}

              {unconfirmedCount > 0 && (
                <button style={s.attentionRow} onClick={() => router.push('/dashboard/appointments?status=requires_confirmation')}>
                  <div style={s.attentionDot('#f59e3a')} />
                  <div style={s.attentionBody}>
                    <span style={s.attentionTitle}>{unconfirmedCount} need{unconfirmedCount === 1 ? 's' : ''} confirmation</span>
                    <span style={s.attentionSub}>Bookings awaiting studio confirmation</span>
                  </div>
                  <span style={s.attentionChevron}>→</span>
                </button>
              )}

              {awaitingPaymentCount > 0 && (
                <div style={{ ...s.attentionRow, cursor: 'default' }}>
                  <div style={s.attentionDot('var(--text-ghost)')} />
                  <div style={s.attentionBody}>
                    <span style={s.attentionTitle}>{awaitingPaymentCount} awaiting payment today</span>
                    <span style={s.attentionSub}>Deposit not yet received</span>
                  </div>
                </div>
              )}

              {overdueBookings.length > 0 && (
                <button style={s.attentionRow} onClick={() => router.push('/dashboard/appointments?status=confirmed')}>
                  <div style={s.attentionDot('rgba(232,111,111,0.9)')} />
                  <div style={s.attentionBody}>
                    <span style={s.attentionTitle}>{overdueBookings.length} not marked complete</span>
                    <span style={s.attentionSub}>
                      {overdueBookings.slice(0, 4).map(b => b.requester_name).join(', ')}
                      {overdueBookings.length > 4 ? ` +${overdueBookings.length - 4} more` : ''}
                    </span>
                  </div>
                  <span style={s.attentionChevron}>→</span>
                </button>
              )}

              {consentNeededEntries.map((entry, i) => {
                const status = getConsentStatus(entry.requesterEmail);
                const isSending = sendingLink === entry.requesterEmail;
                const isSent = sentLink === entry.requesterEmail;
                const wasSentToday = sentToday.has(entry.requesterEmail);
                return (
                  <div key={entry.requesterEmail} style={s.attentionRow}>
                    <div style={s.attentionDot('#e86f6f')} />
                    <div style={s.attentionBody}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={s.attentionTitle}>{entry.clientName}</span>
                        {wasSentToday && (
                          <span style={s.sentTodayBadge}>Consent sent today</span>
                        )}
                      </div>
                      <span style={s.attentionSub}>
                        {formatTime(entry.chosenTime)} · {status === 'outdated' ? 'Outdated consent' : 'Not consented'}
                      </span>
                    </div>
                    <button
                      style={{ ...s.sendBtn, opacity: isSending ? 0.6 : 1 }}
                      onClick={() => handleSendLink(entry.requesterEmail)}
                      disabled={isSending}
                    >
                      {isSent ? 'Sent ✓' : isSending ? '...' : 'Send link'}
                    </button>
                  </div>
                );
              })}

            </div>
          </div>
        )}

        {/* ── TEAM ──────────────────────────────────────────────── */}
        {!loading && artists.length > 0 && (
          <div style={s.section}>
            <span style={s.sectionLabel}>TEAM</span>
            <div style={s.twoCol}>
              <div style={s.card}>
                <span style={s.cardLabel}>In today ({artistsWorkingToday.length})</span>
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
                <span style={s.cardLabel}>Off today ({artistsOffToday.length})</span>
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
          </div>
        )}

        {/* ── THIS WEEK ─────────────────────────────────────────── */}
        {!loading && artists.length > 0 && (
          <div style={s.section}>
            <span style={s.sectionLabel}>THIS WEEK</span>
            <div style={s.card}>
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
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    padding: '1.75rem 2rem 1.25rem',
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  title: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', margin: 0 },
  date: { fontSize: '0.8rem', color: 'var(--text-faint)', marginTop: '0.2rem', marginBottom: 0 },
  body: {
    flex: 1, overflowY: 'auto',
    padding: '1.5rem 2rem 2rem',
    display: 'flex', flexDirection: 'column', gap: '1.75rem',
  },
  msg: { fontSize: '0.875rem', color: 'var(--text-faint)' },

  // Section wrapper
  section: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  sectionLabel: {
    fontSize: '0.68rem', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--text-ghost)',
  },

  // Needs attention card
  attentionCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  attentionRow: {
    display: 'flex', alignItems: 'center', gap: '0.9rem',
    padding: '0.85rem 1.1rem',
    borderBottom: '1px solid var(--border-faint)',
    background: 'none', border: 'none', width: '100%', textAlign: 'left',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-faint)',
  },
  attentionDot: (color) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: color, flexShrink: 0,
  }),
  attentionBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  attentionTitle: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' },
  attentionSub: { fontSize: '0.72rem', color: 'var(--text-ghost)' },
  attentionChevron: { fontSize: '0.85rem', color: 'var(--text-ghost)', flexShrink: 0 },
  sentTodayBadge: {
    fontSize: '0.65rem', fontWeight: 600,
    padding: '0.1rem 0.45rem', borderRadius: 5,
    background: 'rgba(76,201,138,0.1)',
    color: '#4cc98a',
    border: '1px solid rgba(76,201,138,0.2)',
    flexShrink: 0,
  },
  sendBtn: {
    background: 'var(--bg-chip)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-muted)',
    fontSize: '0.72rem', fontWeight: 600,
    padding: '0.3rem 0.7rem',
    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
  },

  // Generic card
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    borderRadius: 12,
    padding: '1rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  cardLabel: {
    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
  },

  // Team two-column
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' },
  artistRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  avatarSm: { width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, fontSize: '0.65rem', fontWeight: 700 },
  artistRowName: { fontSize: '0.82rem', color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  countBadge: {
    fontSize: '0.68rem', fontWeight: 700,
    background: 'var(--bg-chip)', border: '1px solid var(--border)',
    borderRadius: 5, padding: '0.1rem 0.4rem',
    color: 'var(--text-secondary)', flexShrink: 0,
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
