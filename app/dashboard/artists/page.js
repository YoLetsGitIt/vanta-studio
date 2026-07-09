'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStudioArtists, approveStudioArtist, rejectStudioArtist, getStudioArtistStats } from '@/lib/api';
import { getCached, setCached, invalidatePrefix } from '@/lib/cache';

const STATUS_COLORS = {
  pending:  { bg: 'rgba(245,158,58,0.12)',  text: '#f59e3a', border: 'rgba(245,158,58,0.25)' },
  approved: { bg: 'rgba(76,201,138,0.12)',  text: '#4cc98a', border: 'rgba(76,201,138,0.25)' },
  rejected: { bg: 'rgba(232,111,111,0.1)',  text: '#e86f6f', border: 'rgba(232,111,111,0.2)' },
};

export default function ArtistsPage() {
  return (
    <Suspense fallback={<p style={{ padding: '2rem', fontSize: '0.875rem', color: 'rgba(255,255,255,0.35)' }}>Loading…</p>}>
      <ArtistsInner />
    </Suspense>
  );
}

function ArtistsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get('id');

  const [showPending, setShowPending] = useState(false);
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

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

  async function handleReject(id) {
    const reason = prompt('Reason for rejection (optional):') ?? '';
    setActionLoading(id);
    try { await rejectStudioArtist(id, reason); await load(true); }
    catch (e) { alert(e.message); }
    finally { setActionLoading(null); }
  }

  const allArtists = [...approved, ...pending];
  const selectedArtist = selectedId ? allArtists.find(a => a.id === selectedId) : null;

  if (selectedArtist) {
    return (
      <ArtistDetail
        artist={selectedArtist}
        onBack={() => router.push('/dashboard/artists')}
        onApprove={() => handleApprove(selectedArtist.id)}
        onReject={() => handleReject(selectedArtist.id)}
        actionLoading={actionLoading === selectedArtist.id}
      />
    );
  }

  const artists = showPending ? pending : approved;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>{showPending ? 'Pending Review' : 'My Artists'}</h1>
          <p style={s.subtitle}>
            {showPending ? 'Artists requesting to join your studio' : 'Approved artists at your studio'}
          </p>
        </div>
        <button
          onClick={() => setShowPending(v => !v)}
          style={{ ...s.pendingBtn, ...(showPending ? s.pendingBtnActive : {}) }}
        >
          {showPending ? '← Back to my artists' : (
            <>
              Pending review
              {pending.length > 0 && <span style={s.pendingCount}>{pending.length}</span>}
            </>
          )}
        </button>
      </div>

      <div style={s.body}>
        {loading && <p style={s.msg}>Loading…</p>}
        {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
        {!loading && !error && artists.length === 0 && (
          <p style={s.msg}>No {showPending ? 'pending' : 'approved'} artists.</p>
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
  const sc = STATUS_COLORS[artist.status] ?? STATUS_COLORS.approved;
  const initials = artist.name
    ? artist.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div style={s.card} onClick={onClick}>
      <div style={s.cardRow}>
        {artist.profileImage ? (
          <img src={artist.profileImage} alt={artist.name} style={s.avatar} />
        ) : (
          <div style={{ ...s.avatar, ...s.avatarFallback }}>{initials}</div>
        )}

        <div style={s.cardInfo}>
          <div style={s.nameRow}>
            <span style={s.name}>{artist.name || 'Unnamed artist'}</span>
            {artist.studioType === 'guest' && <span style={s.guestBadge}>Guest</span>}
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
              {actionLoading ? '…' : 'Approve'}
            </button>
            <button
              onClick={onReject}
              disabled={actionLoading}
              style={{ ...s.actionBtn, ...s.rejectBtn, opacity: actionLoading ? 0.5 : 1 }}
            >
              {actionLoading ? '…' : 'Reject'}
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
  const sc = STATUS_COLORS[artist.status] ?? STATUS_COLORS.approved;
  const initials = artist.name
    ? artist.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const [stats, setStats] = useState(null);
  useEffect(() => {
    getStudioArtistStats(artist.id).then(setStats).catch(() => {});
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
            <div style={{ ...s.detailAvatar, ...s.detailAvatarFallback }}>{initials}</div>
          )}
          <div style={s.detailMeta}>
            <div style={s.detailNameRow}>
              <span style={s.detailName}>{artist.name || 'Unnamed artist'}</span>
              {artist.studioType === 'guest' && <span style={s.guestBadge}>Guest</span>}
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
          <StatCard label="Total sessions" value={stats ? stats.totalBookings : '—'} />
          <StatCard label="Completed" value={stats ? stats.completed : '—'} />
          <StatCard label="Upcoming" value={stats ? stats.upcoming : '—'} />
          <StatCard label="Revenue" value={stats ? `$${Math.round(stats.totalRevenue).toLocaleString()}` : '—'} />
        </div>

        {artist.bio && (
          <div style={s.detailSection}>
            <span style={s.sectionLabel}>Bio</span>
            <p style={s.bio}>{artist.bio}</p>
          </div>
        )}

        {artist.speciality?.length > 0 && (
          <div style={s.detailSection}>
            <span style={s.sectionLabel}>Specialities</span>
            <div style={s.tags}>
              {artist.speciality.map(tag => (
                <span key={tag} style={s.tag}>{tag}</span>
              ))}
            </div>
          </div>
        )}

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
              {actionLoading ? '…' : 'Approve'}
            </button>
            <button
              onClick={onReject}
              disabled={actionLoading}
              style={{ ...s.detailActionBtn, ...s.rejectBtn, opacity: actionLoading ? 0.5 : 1 }}
            >
              {actionLoading ? '…' : 'Reject'}
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
    color: '#ffffff',
    letterSpacing: '-0.01em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: 0,
  },
  subtitle: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', margin: 0 },
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
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.6)',
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
  msg: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.35)' },

  // List row
  card: {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.07)',
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
    background: 'rgba(245,236,217,0.08)',
    color: 'rgba(245,236,217,0.7)',
    fontSize: '0.85rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' },
  name: { fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' },
  metaRow: { display: 'flex', alignItems: 'center', gap: '0.35rem' },
  email: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' },
  dot: { fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' },
  instagram: { fontSize: '0.75rem', color: 'rgba(245,236,217,0.45)' },
  chevron: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.2)',
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
    color: 'rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 20,
    padding: '0.12rem 0.45rem',
  },
  rejectionNote: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.4)',
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
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
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
    background: 'rgba(245,236,217,0.08)',
    color: 'rgba(245,236,217,0.7)',
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
    color: '#ffffff',
    letterSpacing: '-0.01em',
  },
  detailEmail: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.4)',
  },
  detailInstagram: {
    fontSize: '0.85rem',
    color: 'rgba(245,236,217,0.5)',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  bio: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.65,
    margin: 0,
  },
  tags: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  tag: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.45)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
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
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '0.85rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 500,
  },
};
