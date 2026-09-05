'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { getStudioArtists, approveStudioArtist, rejectStudioArtist, setArtistLastDay, setArtistAcceptingBookings, getStudioArtistStats, getStudioScheduleRange, getArtistWorkSchedule, updateArtistWorkSchedule, getMyStudioAccount } from '@/lib/api';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';
import { APPROVAL_STATUS_COLORS } from '@/lib/status';
import { initials } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase';
import { showError } from '@/lib/feedback';

const APP_STORE_URL = 'https://apps.apple.com/au/app/vanta-find-your-next-tattoo/id6760996738';

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
  const onboardingRequested = params.get('onboarding') === '1';

  const [showPending, setShowPending] = useState(() => params.get('pending') === '1');
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [showPast, setShowPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectTarget,  setRejectTarget]  = useState(null);
  const [removeTarget,  setRemoveTarget]  = useState(null);
  const [artistGuideOpen, setArtistGuideOpen] = useState(false);
  const [studioName, setStudioName] = useState('Your studio');
  const [studioNameCopied, setStudioNameCopied] = useState(false);

  const load = useCallback(async (bust = false) => {
    if (bust) invalidatePrefix('artists:');
    const cachedApproved = getCached('artists:approved');
    const cachedPending  = getCached('artists:pending');
    const cachedRemoved  = getCached('artists:removed');
    if (cachedApproved && cachedPending && cachedRemoved) {
      setApproved(cachedApproved);
      setPending(cachedPending);
      setRemoved(cachedRemoved);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [approvedData, pendingData, removedData] = await Promise.all([
        getStudioArtists('approved'),
        getStudioArtists('pending'),
        getStudioArtists('removed'),
      ]);
      const a = approvedData.artists ?? [];
      const p = pendingData.artists ?? [];
      const r = removedData.artists ?? [];
      setCached('artists:approved', a);
      setCached('artists:pending', p);
      setCached('artists:removed', r);
      setApproved(a);
      setPending(p);
      setRemoved(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    async function prepareArtistGuide() {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.user) return;
      const userId = session.user.id;
      const tourFinished = localStorage.getItem(`vanta-studio-tour:${userId}`) === 'complete';
      const guideKey = `vanta-studio-artist-guide:${userId}`;
      const forceOpen = onboardingRequested;
      const alwaysShowGuide = session.user.email?.trim().toLowerCase() === 'studio@test.com';
      const mainTourActive = document.body.dataset.vantaTourActive === 'true';
      if (!mainTourActive && ((tourFinished && (!localStorage.getItem(guideKey) || alwaysShowGuide)) || forceOpen)) setArtistGuideOpen(true);
      getMyStudioAccount().then(data => {
        if (active) setStudioName(data.studio?.name || 'Your studio');
      }).catch(() => {});
    }
    prepareArtistGuide();
    return () => { active = false; };
  }, [onboardingRequested]);

  function dismissArtistGuide() {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (session?.user) localStorage.setItem(`vanta-studio-artist-guide:${session.user.id}`, 'complete');
    });
    setArtistGuideOpen(false);
    if (onboardingRequested) router.replace('/dashboard/artists');
  }

  async function handleApprove(id) {
    setActionLoading(id);
    try { await approveStudioArtist(id); await load(true); }
    catch (e) { showError(e); }
    finally { setActionLoading(null); }
  }

  function handleReject(id) {
    setRejectTarget(id);
  }

  async function confirmReject(reason) {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget);
    try { await rejectStudioArtist(rejectTarget, reason); setRejectTarget(null); await load(true); }
    catch (e) { showError(e); }
    finally { setActionLoading(null); }
  }

  async function handleToggleAccepting(id, currentValue) {
    setActionLoading(id);
    try { await setArtistAcceptingBookings(id, !currentValue); await load(true); }
    catch (e) { showError(e); }
    finally { setActionLoading(null); }
  }

  function handleRemove(id, endDate) {
    setRemoveTarget({ id, endDate });
  }

  async function confirmRemove(lastDay) {
    if (!removeTarget) return;
    setActionLoading(removeTarget.id);
    try {
      await setArtistLastDay(removeTarget.id, lastDay ?? null);
      setRemoveTarget(null);
      await load(true);
      router.push('/dashboard/artists');
    }
    catch (e) { showError(e); }
    finally { setActionLoading(null); }
  }

  const allArtists = [...approved, ...pending, ...removed];
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
        {removeTarget && (
          <ArtistRemoveModal
            saving={!!actionLoading}
            existingEndDate={removeTarget.endDate}
            onConfirm={confirmRemove}
            onCancel={() => setRemoveTarget(null)}
          />
        )}
        <ArtistDetail
          artist={selectedArtist}
          onBack={() => router.push('/dashboard/artists')}
          onApprove={() => handleApprove(selectedArtist.id)}
          onReject={() => handleReject(selectedArtist.id)}
          onToggleAccepting={() => handleToggleAccepting(selectedArtist.id, selectedArtist.acceptingBookings)}
          onRemove={() => handleRemove(selectedArtist.id, selectedArtist.endDate)}
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
      {removeTarget && (
        <ArtistRemoveModal
          saving={!!actionLoading}
          existingEndDate={removeTarget.endDate}
          onConfirm={confirmRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
      {artistGuideOpen && (
        <ArtistOnboardingGuide
          studioName={studioName}
          copied={studioNameCopied}
          onCopy={() => navigator.clipboard?.writeText(studioName).then(() => {
            setStudioNameCopied(true);
            setTimeout(() => setStudioNameCopied(false), 1800);
          })}
          onSkip={dismissArtistGuide}
          onViewRequests={() => { dismissArtistGuide(); router.push('/dashboard/artists?pending=1'); }}
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
          onMouseDown={e => e.preventDefault()}
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
            onRemove={e => { e.stopPropagation(); handleRemove(artist.id, artist.endDate); }}
            actionLoading={actionLoading === artist.id}
          />
        ))}
        {!loading && !showPending && removed.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => setShowPast(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0', color: 'var(--text-ghost)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              <span style={{ display: 'inline-block', transform: showPast ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', lineHeight: 1 }}>›</span>
              Past artists ({removed.length})
            </button>
            {showPast && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {removed.map(artist => (
                  <ArtistRow
                    key={artist.id}
                    artist={artist}
                    onClick={() => router.push(`/dashboard/artists?id=${artist.id}`)}
                    actionLoading={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ArtistOnboardingGuide({ studioName, copied, onCopy, onSkip, onViewRequests }) {
  const [step, setStep] = useState(0);
  const steps = [
    { kicker: 'STEP 1 OF 5', title: 'Let’s add your first artist.', body: 'Ask your artist to download the Vanta app. They’ll connect to your studio from their own phone.', action: 'They have the app' },
    { kicker: 'STEP 2 OF 5', title: 'They create their artist profile.', body: 'They complete their artist profile first, then add your studio from their profile settings.', action: 'Next' },
    { kicker: 'STEP 3 OF 5', title: 'They open Add studio.', body: 'In the Vanta app, they go to Profile → Edit profile → Studios, then tap Add studio.', action: 'Next' },
    { kicker: 'STEP 4 OF 5', title: 'They select your studio and save.', body: 'They search for your studio, choose the matching result, tap Add studio to profile, then Save changes in Edit profile.', action: 'Next' },
    { kicker: 'STEP 5 OF 5', title: 'You approve their request.', body: 'That save creates a Pending review request here in Vanta Studio. Approve it to add them to your schedule and booking flow.', action: 'View pending requests' },
  ];
  const current = steps[step];
  const isDownload = step === 0;

  return (
    <div style={s.artistGuideOverlay} role="dialog" aria-modal="true" aria-label="Add your first artist">
      <div style={s.artistGuideCard}>
        <button type="button" style={s.artistGuideClose} onClick={onSkip} aria-label="Skip artist setup">×</button>
        <section style={s.artistGuideContent}>
          <span style={s.artistGuideEyebrow}>{current.kicker}</span>
          <h2 style={s.artistGuideTitle}>{current.title}</h2>
          <p style={s.artistGuideText}>{current.body}</p>

          {isDownload ? (
            <div style={s.downloadCard}>
              <div style={s.qrBox}><QRCodeSVG value={APP_STORE_URL} size={126} bgColor="#d5d0c7" fgColor="#080808" marginSize={2} /></div>
              <div>
                <strong style={s.downloadTitle}>Download Vanta for iPhone</strong>
                <p style={s.downloadText}>Have your artist scan this QR code, then open the app and create an Artist account.</p>
                <a href={APP_STORE_URL} target="_blank" rel="noreferrer" style={s.appStoreLink}>Open the App Store <span>↗</span></a>
              </div>
            </div>
          ) : (
            <div style={s.guideStudioName}>
              <span>YOUR STUDIO NAME</span>
              <strong>{studioName}</strong>
              <button type="button" style={s.copyStudioName} onClick={onCopy}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          )}

          <div style={s.artistGuideActions}>
            <button type="button" style={s.artistGuideSecondary} onClick={onSkip}>Skip for now</button>
            <button type="button" style={s.artistGuidePrimary} onClick={() => step === steps.length - 1 ? onViewRequests() : setStep(step + 1)}>{current.action} <span>→</span></button>
          </div>
          <div style={s.guideProgress}>
            {steps.map((item, index) => <button key={item.kicker} type="button" aria-label={`Go to ${item.kicker}`} onClick={() => setStep(index)} style={{ ...s.guideProgressDot, ...(index === step ? s.guideProgressDotActive : {}) }} />)}
          </div>
        </section>
        <ArtistAppScreen step={step} />
      </div>
    </div>
  );
}

function ArtistAppScreen({ step }) {
  const screens = [
    { src: '/onboarding/artist-app-welcome.png', alt: 'Vanta app welcome screen' },
    { src: '/onboarding/artist-app-welcome.png', alt: 'Vanta app welcome screen' },
    { src: '/onboarding/artist-add-studio.png', alt: 'Vanta app Add Studio screen' },
    { src: '/onboarding/artist-studio-search.png', alt: 'Vanta app showing studio search results' },
  ];
  if (step === 4) {
    return (
      <aside style={s.approvalPreview}>
        <span style={s.appPreviewLabel}>ON THE ARTISTS PAGE</span>
        <div style={s.pendingReviewLocation}>
          <span style={s.pendingReviewLocationTitle}>My artists</span>
          <span style={s.pendingReviewLocationArrow}>←</span>
          <span style={s.pendingReviewLocationButton}>Pending review</span>
        </div>
        <div style={s.approvalPreviewIcon}>✓</div>
        <strong style={s.approvalPreviewTitle}>Approve from Pending review</strong>
        <span style={s.approvalPreviewText}>It’s the button in the top-right of the Artists page.</span>
      </aside>
    );
  }
  const { src, alt } = screens[step];

  return (
    <aside style={s.appPreview}>
      <span style={s.appPreviewLabel}>REAL VANTA APP SCREEN</span>
      <div style={s.mobileCaptureFrame}>
        <img key={src} src={src} alt={alt} style={{ ...s.mobileCapture, transform: step === 3 ? 'translateY(-160px)' : 'translateY(-1px)' }} />
      </div>
    </aside>
  );
}

function ArtistRow({ artist, onClick, onApprove, onReject, onRemove, actionLoading }) {
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
            {!artist.acceptingBookings && (
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-ghost)', background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 20, padding: '0.12rem 0.5rem', whiteSpace: 'nowrap' }}>
                Paused
              </span>
            )}
            {artist.endDate && (
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#f59e3a', background: 'rgba(245,158,58,0.1)', border: '1px solid rgba(245,158,58,0.25)', borderRadius: 20, padding: '0.12rem 0.5rem', whiteSpace: 'nowrap' }}>
                Last day {new Date(artist.endDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
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
        ) : artist.status === 'approved' ? (
          <span style={s.chevron}>›</span>
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

function ArtistDetail({ artist, onBack, onApprove, onReject, onRemove, onToggleAccepting, actionLoading }) {
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
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>

          {/* Left column */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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

          {/* Right column — settings (approved only) */}
          {artist.status === 'approved' && (
            <div style={{ width: 220, flexShrink: 0, position: 'sticky', top: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-faint)' }}>
                <span style={s.sectionLabel}>Settings</span>
              </div>
              {/* Accepting bookings toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-faint)' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Accepting bookings</span>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.7rem', color: 'var(--text-ghost)', lineHeight: 1.4 }}>
                    {artist.acceptingBookings ? 'Clients can book' : 'Hidden from booking'}
                  </p>
                </div>
                <button
                  onClick={onToggleAccepting}
                  disabled={actionLoading}
                  style={{
                    flexShrink: 0,
                    width: 44, height: 24, borderRadius: 12, border: '1px solid var(--switch-edge)', cursor: actionLoading ? 'default' : 'pointer',
                    background: artist.acceptingBookings ? 'var(--switch-on)' : 'var(--switch-off)',
                    position: 'relative', transition: 'background 0.2s', opacity: actionLoading ? 0.5 : 1,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: artist.acceptingBookings ? 22 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: 'var(--switch-thumb)', boxShadow: '0 1px 3px rgba(0,0,0,0.65)',
                    transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
              </div>
              {/* Last day */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem' }}>
                <div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>Last day</span>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.7rem', color: artist.endDate ? '#f59e3a' : 'var(--text-ghost)', lineHeight: 1.4 }}>
                    {artist.endDate
                      ? new Date(artist.endDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Not scheduled'}
                  </p>
                </div>
                <button
                  onClick={onRemove}
                  disabled={actionLoading}
                  style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.3rem 0.65rem', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: actionLoading ? 'default' : 'pointer', opacity: actionLoading ? 0.5 : 1, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
                >
                  {actionLoading ? '…' : artist.endDate ? 'Change' : 'Set'}
                </button>
              </div>
            </div>
          )}

        </div>
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

function ArtistRemoveModal({ onConfirm, onCancel, saving, existingEndDate }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDate = (() => {
    if (existingEndDate) return existingEndDate;
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  })();
  const [lastDay, setLastDay] = useState(defaultDate);
  const isToday = lastDay === todayStr;
  const isChanging = !!existingEndDate;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 400 }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
          {isChanging ? 'Change last day' : "Set artist's last day"}
        </h2>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Clients won't be able to book on or after their last day. The artist stays listed until then.
        </p>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          Last day
        </label>
        <input
          type="date"
          min={todayStr}
          value={lastDay}
          onChange={e => setLastDay(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-input)', border: `1px solid ${isToday ? 'rgba(232,111,111,0.5)' : 'var(--border-strong)'}`, borderRadius: 8, padding: '0.65rem 0.85rem', fontSize: '0.9rem', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', colorScheme: 'dark', marginBottom: isToday ? '0.5rem' : '1.25rem' }}
        />
        {isToday && (
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.78rem', color: '#e86f6f', lineHeight: 1.4 }}>
            Setting today will remove this artist from your studio immediately.
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} disabled={saving} style={{ flex: 1, padding: '0.7rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(lastDay)}
            disabled={saving}
            style={{
              flex: 2, padding: '0.7rem', borderRadius: 8, border: 'none',
              background: saving ? 'var(--bg-chip)' : isToday ? 'rgba(232,111,111,0.85)' : 'var(--accent)',
              color: saving ? 'var(--text-ghost)' : isToday ? '#fff' : '#0a0a0a',
              cursor: saving ? 'default' : 'pointer', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving…' : isToday ? 'Remove from studio' : isChanging ? 'Update last day' : 'Set last day'}
          </button>
        </div>
        {isChanging && (
          <button
            type="button"
            onClick={() => onConfirm(null)}
            disabled={saving}
            style={{
              width: '100%', marginTop: '0.75rem', padding: '0.65rem', borderRadius: 8,
              border: '1px solid var(--border-strong)', background: 'transparent',
              color: 'var(--text-muted)', cursor: saving ? 'default' : 'pointer',
              fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
              opacity: saving ? 0.5 : 1,
            }}
          >
            Remove last day
          </button>
        )}
      </div>
    </div>
  );
}

const s = {
  artistGuideOverlay: { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '1.25rem', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(9px)' },
  artistGuideCard: { width: 'min(100%, 1000px)', minHeight: 570, maxHeight: 'calc(100vh - 2.5rem)', overflow: 'auto', position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(270px, 0.9fr)', gap: '2.5rem', padding: '2.5rem', borderRadius: 20, background: 'var(--bg-modal)', border: '1px solid var(--accent-tint-border)', boxShadow: '0 32px 110px rgba(0,0,0,0.54)' },
  artistGuideClose: { position: 'absolute', top: 16, right: 17, width: 34, height: 34, border: '1px solid var(--border)', borderRadius: '50%', background: 'transparent', color: 'var(--text-muted)', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer' },
  artistGuideContent: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', minWidth: 0 },
  artistGuideEyebrow: { fontSize: '0.66rem', letterSpacing: '0.13em', fontWeight: 700, color: 'var(--accent)' },
  artistGuideTitle: { margin: '0.55rem 0 0', maxWidth: 490, fontSize: '2rem', lineHeight: 1.06, letterSpacing: '-0.045em', color: 'var(--text)' },
  artistGuideText: { margin: '0.85rem 0 1.5rem', maxWidth: 470, fontSize: '0.91rem', lineHeight: 1.6, color: 'var(--text-muted)' },
  downloadCard: { width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: 12, border: '1px solid var(--accent-tint-border)', background: 'var(--accent-tint)' },
  qrBox: { flexShrink: 0, display: 'grid', placeItems: 'center', padding: 9, borderRadius: 8, background: '#ffffff' },
  downloadTitle: { display: 'block', color: 'var(--text)', fontSize: '0.85rem' },
  downloadText: { margin: '0.32rem 0 0.6rem', color: 'var(--text-ghost)', fontSize: '0.74rem', lineHeight: 1.45 },
  appStoreLink: { color: 'var(--accent)', fontSize: '0.73rem', fontWeight: 700, textDecoration: 'none' },
  guideStudioName: { width: '100%', maxWidth: 480, display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.25rem 0.75rem', alignItems: 'center', padding: '0.9rem 1rem', borderRadius: 10, border: '1px solid var(--accent-tint-border)', background: 'var(--accent-tint)' },
  copyStudioName: { gridColumn: 2, gridRow: '1 / span 2', border: '1px solid var(--accent-tint-border)', borderRadius: 6, padding: '0.35rem 0.55rem', background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' },
  artistGuideActions: { display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '1.55rem' },
  artistGuidePrimary: { border: 0, borderRadius: 8, padding: '0.75rem 0.9rem', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem' },
  artistGuideSecondary: { border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' },
  guideProgress: { display: 'flex', gap: '0.38rem', marginTop: '1.25rem' },
  guideProgressDot: { width: 7, height: 7, padding: 0, border: 0, borderRadius: 10, background: 'rgba(255,255,255,0.18)', cursor: 'pointer' },
  guideProgressDotActive: { width: 20, background: 'var(--accent)' },
  appPreview: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0.2rem 0' },
  appPreviewLabel: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.13em', color: 'var(--text-ghost)' },
  mobileCaptureFrame: { width: 254, maxHeight: 468, overflow: 'hidden', borderRadius: 25, border: '3px solid #383d47', background: '#080b10', boxShadow: '0 20px 50px rgba(0,0,0,0.36)' },
  mobileCapture: { display: 'block', width: '100%', height: 'auto', transform: 'translateY(-1px)', transition: 'opacity 0.22s ease' },
  approvalPreview: { alignSelf: 'center', width: 254, minHeight: 310, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.8rem', padding: '2rem', borderRadius: 18, border: '1px solid var(--accent-tint-border)', background: 'var(--accent-tint)', textAlign: 'center' },
  approvalPreviewIcon: { width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'rgba(76,201,138,0.14)', border: '1px solid rgba(76,201,138,0.35)', color: '#58d79b', fontWeight: 800 },
  approvalPreviewTitle: { color: 'var(--text)', fontSize: '1rem' },
  approvalPreviewText: { color: 'var(--text-ghost)', fontSize: '0.75rem', lineHeight: 1.55 },
  pendingReviewLocation: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem', padding: '0.7rem', borderRadius: 9, background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text)' },
  pendingReviewLocationTitle: { fontSize: '0.66rem', fontWeight: 700 },
  pendingReviewLocationArrow: { marginLeft: 'auto', color: 'var(--accent)', fontSize: '1rem' },
  pendingReviewLocationButton: { padding: '0.42rem 0.48rem', borderRadius: 6, border: '1px solid var(--accent-active-border)', background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: '0.58rem', fontWeight: 700 },
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
    color: '#0a0a0a',
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
  removeBtn: {
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
