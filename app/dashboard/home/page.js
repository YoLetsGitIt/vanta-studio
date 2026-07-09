'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getStudioArtists, getStudioSchedule, getMyStudioAccount } from '@/lib/api';
import { getCached, setCached } from '@/lib/cache';

const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false });

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function HomePage() {
  const [artists, setArtists] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walkInUrl, setWalkInUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const today = toISODate(new Date());
      const cacheKey = `home:${today}`;
      const cached = getCached(cacheKey);
      if (cached) { setArtists(cached.artists); setEntries(cached.entries); setLoading(false); }
      try {
        const [artistData, scheduleData, accountData] = await Promise.all([
          getStudioArtists('approved'),
          getStudioSchedule(today),
          cached ? Promise.resolve(null) : getMyStudioAccount(),
        ]);
        const a = artistData.artists ?? [];
        const e = scheduleData.entries ?? [];
        if (!cached) setCached(cacheKey, { artists: a, entries: e });
        setArtists(a);
        setEntries(e);
        if (accountData?.studio_id) {
          setWalkInUrl(`${window.location.origin}/walk-in?s=${accountData.studio_id}`);
        }
      } catch {
        // show empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  // Group bookings by artistId
  const byArtist = {};
  for (const entry of entries) {
    if (!byArtist[entry.artistId]) byArtist[entry.artistId] = [];
    byArtist[entry.artistId].push(entry);
  }

  // Artists who have at least one booking today
  const workingToday = artists
    .filter(a => byArtist[a.artistId])
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Today</h1>
        <p style={s.date}>{today}</p>
      </div>

      <div style={s.body}>
        {loading && <p style={s.msg}>Loading…</p>}

        {/* Walk-in link card */}
        {walkInUrl && (
          <div style={s.walkInCard}>
            <div style={s.walkInLeft}>
              <span style={s.walkInTitle}>Walk-in link</span>
              <span style={s.walkInSub}>Share this link or QR code for on-the-spot bookings</span>
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
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div style={s.walkInQr}>
              <QRCodeSVG value={walkInUrl} size={88} bgColor="transparent" fgColor="#ffffff" level="M" />
            </div>
          </div>
        )}

        {!loading && (
          <div style={s.statRow}>
            <div style={s.statCard}>
              <span style={s.statValue}>{workingToday.length}</span>
              <span style={s.statLabel}>Artists working today</span>
            </div>
            <div style={s.statCard}>
              <span style={s.statValue}>{entries.length}</span>
              <span style={s.statLabel}>Bookings today</span>
            </div>
          </div>
        )}

        {!loading && workingToday.length === 0 && (
          <p style={s.msg}>No artists have bookings today.</p>
        )}

        {!loading && workingToday.map(artist => {
          const bookings = (byArtist[artist.artistId] ?? [])
            .sort((a, b) => new Date(a.chosenTime) - new Date(b.chosenTime));
          const initials = artist.name
            ? artist.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            : '?';

          return (
            <div key={artist.id} style={s.card}>
              <div style={s.cardHeader}>
                {artist.profileImage ? (
                  <img src={artist.profileImage} alt={artist.name} style={s.avatar} />
                ) : (
                  <div style={{ ...s.avatar, ...s.avatarFallback }}>{initials}</div>
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
                    <span style={s.sessionType}>{b.sessionType}</span>
                    {b.durationMins && <span style={s.duration}>{b.durationMins}m</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.01em',
    margin: 0,
  },
  date: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.35)',
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
  msg: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.35)' },
  statRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
  },
  statCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  statValue: {
    fontSize: '2.2rem',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.03em',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 500,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '1rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  avatarFallback: {
    background: 'rgba(245,236,217,0.1)',
    color: '#f5ecd9',
    fontSize: '0.8rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  artistName: {
    fontSize: '0.925rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  bookingCount: {
    fontSize: '0.72rem',
    color: 'rgba(255,255,255,0.3)',
  },
  bookingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    paddingTop: '0.75rem',
  },
  bookingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
  },
  time: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.55)',
    minWidth: 68,
    flexShrink: 0,
  },
  client: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sessionType: {
    fontSize: '0.72rem',
    color: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  duration: {
    fontSize: '0.72rem',
    color: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },

  // Walk-in link card
  walkInCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 12,
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  walkInLeft: {
    display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: 0,
  },
  walkInTitle: {
    fontSize: '0.78rem', fontWeight: 700, color: '#ffffff',
  },
  walkInSub: {
    fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)',
  },
  walkInUrlRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem',
  },
  walkInUrlText: {
    fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  copyBtn: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.7rem', fontWeight: 600,
    padding: '0.2rem 0.6rem', cursor: 'pointer', flexShrink: 0,
  },
  walkInQr: {
    flexShrink: 0,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 6,
  },
};
