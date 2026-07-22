'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStudioArtists, approveStudioArtist, rejectStudioArtist, getStudioArtistStats, getStudioScheduleRange, getArtistWorkSchedule, updateArtistWorkSchedule } from '@/lib/api';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';
import { APPROVAL_STATUS_COLORS } from '@/lib/status';
import { initials } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';

function fmtHHMM(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export default function ArtistsPage() {
  return (
    <Suspense fallback={<p style={{ padding: '2rem', fontSize: '0.875rem', color: 'var(--text-faint)' }}>Loading…</p>}>
      <ArtistsInner />
    </Suspense>
  );
}

function ArtistsInner() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('id');

  const [showPending, setShowPending] = useState(false);
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectTarget,  setRejectTarget]  = useState(null); // id to reject

  const load = useCallback(async (bust = false) => {
    if (bust) invalidatePrefix('artists:');
    const cachedApproved = getCached('artists:approved');
    const cachedPending  = getCached('artists:pending');
    if (cachedApproved && cachedPending) {
      setApproved(cachedApproved);
      setPending(cachedPending);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [approvedData, pendingData] = await Promise.all([
        getStudioArtists('approved'),
        getStudioArtists('pending'),
      ]);
      const a = approvedData.artists ?? [];
      const p = pendingData.artists ?? [];
      setCached('artists:approved', a);
      setCached('artists:pending', p);
      setApproved(a);
      setPending(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(id) {
    setActionLoading(id);
    try { await approveStudioArtist(id); await load(true); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(null); }
  }

  function handleReject(id) {
    setRejectTarget(id);
  }

  async function confirmReject(reason) {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget);
    try { await rejectStudioArtist(rejectTarget, reason); setRejectTarget(null); await load(true); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(null); }
  }

  const allArtists = [...approved, ...pending];
  const selectedArtist = selectedId ? allArtists.find(a => a.id === selectedId) : null;

  if (selectedArtist) {
    return (
      <>
        {rejectTarget && (
          <ArtistRejectModal
            saving={!!actionLoading}
            onConfirm={confirmReject}
            onCancel={() => setRejectTarget(null)}
          />
        )}
        <ArtistDetail
          artist={selectedArtist}
          onBack={() => router.push('/dashboard/artists')}
          onApprove={() => handleApprove(selectedArtist.id)}
          onReject={() => handleReject(selectedArtist.id)}
          actionLoading={actionLoading === selectedArtist.id}
        />
      </>
    );
  }

  const artists = showPending ? pending : approved;

  return (
    <div style={s.page}>
      {rejectTarget && (
        <ArtistRejectModal
          saving={!!actionLoading}
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>{t(showPending ? 'artists_pending_review' : 'artists_my_artists')}</h1>
          <p style={s.subtitle}>
            {t(showPending ? 'artists_pending_desc' : 'artists_approved_desc')}
          </p>
        </div>
        <button
          onClick={() => setShowPending(v => !v)}
          style={{ ...s.pendingBtn, ...(showPending ? s.pendingBtnActive : {}) }}
        >
          {showPending ? t('artists_back') : (
            <>
              {t('artists_pending_review')}
              {pending.length > 0 && <span style={s.pendingCount}>{pending.length}</span>}
            </>
          )}
        </button>
      </div>

      <div style={s.body}>
        {loading && <p style={s.msg}>{t('loading')}</p>}
        {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
        {!loading && !error && artists.length === 0 && (
          <p style={s.msg}>{t(showPending ? 'artists_none_pending' : 'artists_none_approved')}</p>
        )}
        {!loading && artists.map(artist => (
          <ArtistRow
            key={artist.id}
            artist={artist}
            onClick={() => router.push(`/dashboard/artists?id=${artist.id}`)}
            onApprove={e => { e.stopPropagation(); handleApprove(artist.id); }}
            onReject={e => { e.stopPropagation(); handleReject(artist.id); }}
            actionLoading={actionLoading === artist.id}
          />
        ))}
      </div>
    </div>
  );
}

function ArtistRow({ artist, onClick, onApprove, onReject, actionLoading }) {
  const { t } = useLanguage();
  const sc = APPROVAL_STATUS_COLORS[artist.status] ?? APPROVAL_STATUS_COLORS.approved;
  const artistInitials = initials(artist.name);

  return (
    <div style={s.card} onClick={onClick}>
      <div style={s.cardRow}>
        {artist.profileImage ? (
          <img src={artist.profileImage} alt={artist.name} style={s.avatar} />
        ) : (
          <div style={{ ...s.avatar, ...s.avatarFallback }}>{artistInitials}</div>
        )}

        <div style={s.cardInfo}>
          <div style={s.nameRow}>
            <span style={s.name}>{artist.name || t('artists_unnamed')}</span>
            {artist.studioType === 'guest' && <span style={s.guestBadge}>{t('artists_guest')}</span>}
            {artist.status !== 'approved' && (
              <span style={{ ...s.statusBadge, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                {artist.status.charAt(0).toUpperCase() + artist.status.slice(1)}
              </span>
            )}
          </div>
          <div style={s.metaRow}>
            <span style={s.email}>{artist.email}</span>
            {artist.instagram && <><span style={s.dot}>·</span><span style={s.instagram}>@{artist.instagram}</span></>}
          </div>
        </div>

        {artist.status === 'pending' ? (
          <div style={s.actions}>
            <button
              onClick={onApprove}
              disabled={actionLoading}
              style={{ ...s.actionBtn, ...s.approveBtn, opacity: actionLoading ? 0.5 : 1 }}
            >
              {actionLoading ? '…' : t('approve')}
            </button>
            <button
              onClick={onReject}
              disabled={actionLoading}
              style={{ ...s.actionBtn, ...s.rejectBtn, opacity: actionLoading ? 0.5 : 1 }}
            >
              {actionLoading ? '…' : t('reject')}
            </button>
          </div>
        ) : (
          <span style={s.chevron}>›</span>
        )}
      </div>

      {artist.rejectionReason && (
        <div style={s.rejectionNote}>
          <span style={s.rejectionLabel}>Rejection reason:</span> {artist.rejectionReason}
        </div>
      )}
    </div>
  );
}

function ArtistDetail({ artist, onBack, onApprove, onReject, actionLoading }) {
  const { t } = useLanguage();
  const sc = APPROVAL_STATUS_COLORS[artist.status] ?? APPROVAL_STATUS_COLORS.approved;
  const artistInitials = initials(artist.name);

  const [stats,        setStats]        = useState(null);
  const [schedule,     setSchedule]     = useState(null); // null = loading
  const [workSchedule, setWorkSchedule] = useState(null); // null = loading
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleEdits,   setScheduleEdits]   = useState({}); // { dow: { start, end, on } }
  const [scheduleSaving,  setScheduleSaving]  = useState(false);
  const [scheduleError,   setScheduleError]   = useState('');

  // Day labels and their Sunday-indexed dow values
  const SCHED_DAYS = [
    { label: 'Mon', dow: 1 }, { label: 'Tue', dow: 2 }, { label: 'Wed', dow: 3 },
    { label: 'Thu', dow: 4 }, { label: 'Fri', dow: 5 }, { label: 'Sat', dow: 6 },
    { label: 'Sun', dow: 0 },
  ];

  function openScheduleEdit() {
    const edits = {};
    SCHED_DAYS.forEach(({ dow }) => {
      const day = (workSchedule || []).find(d => d.day_of_week === dow);
      edits[dow] = day
        ? { on: true, start: day.start_time.slice(0, 5), end: day.end_time.slice(0, 5) }
        : { on: false, start: '10:00', end: '18:00' };
    });
    setScheduleEdits(edits);
    setScheduleError('');
    setEditingSchedule(true);
  }

  async function saveSchedule() {
    setScheduleSaving(true);
    setScheduleError('');
    try {
      const days = SCHED_DAYS.map(({ dow }) => {
        const e = scheduleEdits[dow];
        return e.on
          ? { day_of_week: dow, start_time: e.start, end_time: e.end }
          : { day_of_week: dow, start_time: '', end_time: '' };
      });
      const data = await updateArtistWorkSchedule(artist.artistId, days);
      setWorkSchedule(data.schedule ?? []);
      setEditingSchedule(false);
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduleSaving(false);
    }
  }

  useEffect(() => {
    getStudioArtistStats(artist.id).then(setStats).catch(() => {});
    getArtistWorkSchedule(artist.artistId)
      .then(d => setWorkSchedule(d.schedule ?? []))
      .catch(() => setWorkSchedule([]));
  }, [artist.id]);

  useEffect(() => {
    const today = new Date();
    const end   = new Date(today); end.setDate(end.getDate() + 13);
    function toISO(d) {
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    getStudioScheduleRange(toISO(today), toISO(end))
      .then(d => {
        const entries = (d.entries ?? []).filter(e => e.artistId === artist.artistId);
        setSchedule(entries);
      })
      .catch(() => setSchedule([]));
  }, [artist.id]);

  return (
    <div style={s.page}>
      <div style={s.detailHeader}>
        <button onClick={onBack} style={s.backBtn}>← Artists</button>
      </div>

      <div style={s.detailBody}>
        <div style={s.detailHero}>
          {artist.profileImage ? (
            <img src={artist.profileImage} alt={artist.name} style={s.detailAvatar} />
          ) : (
            <div style={{ ...s.detailAvatar, ...s.detailAvatarFallback }}>{artistInitials}</div>
          )}
          <div style={s.detailMeta}>
            <div style={s.detailNameRow}>
              <span style={s.detailName}>{artist.name || t('artists_unnamed')}</span>
              {artist.studioType === 'guest' && <span style={s.guestBadge}>{t('artists_guest')}</span>}
              {artist.status !== 'approved' && (
                <span style={{ ...s.statusBadge, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                  {artist.status.charAt(0).toUpperCase() + artist.status.slice(1)}
                </span>
              )}
            </div>
            <span style={s.detailEmail}>{artist.email}</span>
            {artist.instagram && <span style={s.detailInstagram}>@{artist.instagram}</span>}
          </div>
        </div>

        <div style={s.statsGrid}>
          <StatCard label={t('artists_total_sessions')} value={stats ? stats.totalBookings : '—'} />
          <StatCard label={t('status_completed')} value={stats ? stats.completed : '—'} />
          <StatCard label={t('artists_upcoming_stat')} value={stats ? stats.upcoming : '—'} />
          <StatCard label={t('artists_revenue')} value={stats ? `$${Math.round(stats.totalRevenue).toLocaleString()}` : '—'} />
        </div>

        {artist.bio && (
          <div style={s.detailSection}>
            <span style={s.sectionLabel}>{t('artists_bio')}</span>
            <p style={s.bio}>{artist.bio}</p>
          </div>
        )}

        {artist.speciality?.length > 0 && (
          <div style={s.detailSection}>
            <span style={s.sectionLabel}>{t('artists_specialities')}</span>
            <div style={s.tags}>
              {artist.speciality.map(tag => (
                <span key={tag} style={s.tag}>{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Work timetable */}
        <div style={s.detailSection}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={s.sectionLabel}>{t('artists_timetable')}</span>
            {!editingSchedule && workSchedule !== null && (
              <button onClick={openScheduleEdit} style={s.editSchedBtn}>{t('edit')}</button>
            )}
          </div>

          {workSchedule === null && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-ghost)', margin: '0.4rem 0 0' }}>{t('loading')}</p>
          )}

          {/* Read-only view */}
          {!editingSchedule && workSchedule !== null && (
            workSchedule.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-ghost)', margin: '0.4rem 0 0' }}>{t('artists_no_timetable')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
                {SCHED_DAYS.map(({ label, dow }) => {
                  const day = workSchedule.find(d => d.day_of_week === dow);
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: day ? 'var(--text)' : 'var(--text-ghost)', width: 28 }}>{label}</span>
                      {day ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {fmtHHMM(day.start_time)} – {fmtHHMM(day.end_time)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-ghost)' }}>{t('artists_off')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Edit mode */}
          {editingSchedule && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
              {SCHED_DAYS.map(({ label, dow }) => {
                const e = scheduleEdits[dow] || { on: false, start: '10:00', end: '18:00' };
                return (
                  <div key={dow} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', width: 52 }}>
                      <input
                        type="checkbox"
                        checked={e.on}
                        onChange={ev => setScheduleEdits(prev => ({ ...prev, [dow]: { ...prev[dow], on: ev.target.checked } }))}
                        style={{ accentColor: 'var(--accent)', width: 13, height: 13 }}
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: e.on ? 'var(--text)' : 'var(--text-ghost)' }}>{label}</span>
                    </label>
                    {e.on ? (
                      <>
                        <input
                          type="time"
                          value={e.start}
                          onChange={ev => setScheduleEdits(prev => ({ ...prev, [dow]: { ...prev[dow], start: ev.target.value } }))}
                          style={s.schedTimeInput}
                        />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>–</span>
                        <input
                          type="time"
                          value={e.end}
                          onChange={ev => setScheduleEdits(prev => ({ ...prev, [dow]: { ...prev[dow], end: ev.target.value } }))}
                          style={s.schedTimeInput}
                        />
                      </>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-ghost)' }}>{t('artists_off')}</span>
                    )}
                  </div>
                );
              })}
              {scheduleError && <p style={{ fontSize: '0.75rem', color: 'var(--error)', margin: 0 }}>{scheduleError}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button onClick={saveSchedule} disabled={scheduleSaving} style={s.schedSaveBtn}>
                  {t(scheduleSaving ? 'saving' : 'save')}
                </button>
                <button onClick={() => setEditingSchedule(false)} style={s.schedCancelBtn}>{t('cancel')}</button>
              </div>
            </div>
          )}
        </div>

        {/* Upcoming schedule */}
        <div style={s.detailSection}>
          <span style={s.sectionLabel}>{t('artists_upcoming')}</span>
          {schedule === null && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-ghost)', margin: '0.4rem 0 0' }}>{t('loading')}</p>
          )}
          {schedule !== null && schedule.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-ghost)', margin: '0.4rem 0 0' }}>{t('artists_no_bookings')}</p>
          )}
          {schedule !== null && schedule.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              {schedule.map(e => (
                <div key={e.bookingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'var(--bg-chip)', border: '1px solid var(--border-faint)', borderRadius: 7 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{e.clientName}</span>
                    {e.sessionType && <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>{e.sessionType}</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                      {new Date(e.chosenTime).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-ghost)' }}>
                      {new Date(e.chosenTime).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      {e.stationName ? ` · ${e.stationName}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {artist.rejectionReason && (
          <div style={{ ...s.rejectionNote, marginTop: '0.5rem' }}>
            <span style={s.rejectionLabel}>Rejection reason:</span> {artist.rejectionReason}
          </div>
        )}

        {artist.status === 'pending' && (
          <div style={s.detailActions}>
            <button
              onClick={onApprove}
              disabled={actionLoading}
              style={{ ...s.detailActionBtn, ...s.approveBtn, opacity: actionLoading ? 0.5 : 1 }}
            >
              {actionLoading ? '…' : t('approve')}
            </button>
            <button
              onClick={onReject}
              disabled={actionLoading}
              style={{ ...s.detailActionBtn, ...s.rejectBtn, opacity: actionLoading ? 0.5 : 1 }}
            >
              {actionLoading ? '…' : t('reject')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={s.statCard}>
      <span style={s.statValue}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

function ArtistRejectModal({ onConfirm, onCancel, saving }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 400 }}>
        <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{t('artists_reject')}</h2>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          {t('artists_reason')} <span style={{ color: 'var(--text-ghost)', fontWeight: 400 }}>{t('optional')}</span>
        </label>
        <textarea
          rows={4}
          placeholder="e.g. Not a good fit for the studio at this time…"
          value={reason}
          onChange={e => setReason(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: 'var(--bg-input)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.9rem', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, marginBottom: '1.25rem' }}
        />
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} disabled={saving} style={{ flex: 1, padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
            {t('back')}
          </button>
          <button onClick={() => onConfirm(reason.trim())} disabled={saving} style={{ flex: 2, padding: '0.7rem', borderRadius: 8, border: 'none', background: saving ? 'var(--bg-chip)' : 'rgba(232,111,111,0.85)', color: saving ? 'var(--text-ghost)' : '#fff', cursor: saving ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 700 }}>
            {saving ? t('saving') : t('artists_reject')}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  editSchedBtn: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600,
    padding: '0.2rem 0.6rem', cursor: 'pointer', fontFamily: 'inherit',
  },
  schedTimeInput: {
    background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', fontSize: '0.78rem',
    padding: '0.2rem 0.4rem', colorScheme: 'dark', fontFamily: 'inherit',
  },
  schedSaveBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 7,
    color: '#0e0e0e', fontSize: '0.8rem', fontWeight: 700,
    padding: '0.4rem 0.9rem', cursor: 'pointer', fontFamily: 'inherit',
  },
  schedCancelBtn: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 7,
    color: 'var(--text-muted)', fontSize: '0.8rem',
    padding: '0.4rem 0.9rem', cursor: 'pointer', fontFamily: 'inherit',
  },
  page: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '1.75rem 2rem 1.25rem',
    borderBottom: '1px solid var(--border-faint)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
  },
  subtitle: { fontSize: '0.8rem', color: 'var(--text-faint)', margin: 0 },
  pendingBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.45rem 1rem',
    borderRadius: 20,
    border: '1px solid rgba(245,158,58,0.3)',
    background: 'rgba(245,158,58,0.08)',
    color: '#f59e3a',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  pendingBtnActive: {
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-chip)',
    color: 'var(--text-muted)',
  },
  pendingCount: {
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#0d1017',
    background: '#f59e3a',
    borderRadius: 20,
    padding: '0.1rem 0.45rem',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  msg: { fontSize: '0.875rem', color: 'var(--text-faint)' },

  // List row
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    borderRadius: 10,
    padding: '0.85rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    cursor: 'pointer',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  avatarFallback: {
    background: 'var(--accent-tint)',
    color: 'var(--accent)',
    fontSize: '0.85rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' },
  name: { fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' },
  metaRow: { display: 'flex', alignItems: 'center', gap: '0.35rem' },
  email: { fontSize: '0.75rem', color: 'var(--text-faint)' },
  dot: { fontSize: '0.65rem', color: 'var(--text-ghost)' },
  instagram: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  chevron: {
    fontSize: '1.1rem',
    color: 'var(--text-ghost)',
    flexShrink: 0,
    lineHeight: 1,
  },
  actions: { display: 'flex', gap: '0.4rem', flexShrink: 0 },
  actionBtn: {
    padding: '0.38rem 0.85rem',
    borderRadius: 7,
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid',
    whiteSpace: 'nowrap',
  },

  // Shared badges
  statusBadge: {
    fontSize: '0.68rem',
    fontWeight: 600,
    padding: '0.12rem 0.45rem',
    borderRadius: 20,
    letterSpacing: '0.02em',
  },
  guestBadge: {
    fontSize: '0.68rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    background: 'var(--bg-chip)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '0.12rem 0.45rem',
  },
  rejectionNote: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    background: 'rgba(232,111,111,0.05)',
    border: '1px solid rgba(232,111,111,0.1)',
    borderRadius: 6,
    padding: '0.45rem 0.7rem',
  },
  rejectionLabel: { fontWeight: 600, color: '#e86f6f' },
  approveBtn: {
    background: 'rgba(76,201,138,0.1)',
    borderColor: 'rgba(76,201,138,0.25)',
    color: '#4cc98a',
  },
  rejectBtn: {
    background: 'rgba(232,111,111,0.08)',
    borderColor: 'rgba(232,111,111,0.2)',
    color: '#e86f6f',
  },

  // Detail view
  detailHeader: {
    padding: '1.25rem 2rem 1rem',
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
  },
  detailBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    maxWidth: 560,
  },
  detailHero: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1.25rem',
  },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  detailAvatarFallback: {
    background: 'var(--accent-tint)',
    color: 'var(--accent)',
    fontSize: '1.5rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    paddingTop: '0.25rem',
  },
  detailNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  detailName: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
  },
  detailEmail: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  detailInstagram: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  bio: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    lineHeight: 1.65,
    margin: 0,
  },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  tag: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    background: 'var(--bg-chip)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '0.2rem 0.6rem',
  },
  detailActions: {
    display: 'flex',
    gap: '0.6rem',
  },
  detailActionBtn: {
    padding: '0.6rem 1.5rem',
    borderRadius: 8,
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid',
  },

  // Stats grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.6rem',
  },
  statCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    borderRadius: 10,
    padding: '0.85rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
};
