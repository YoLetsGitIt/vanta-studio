'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { getArtistProfile } from '@/lib/api';

export default function ArtistsPage() {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (!session) return;
        const profile = await getArtistProfile(session.user.id);
        setArtist(profile);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Artists</h1>
      </div>

      <div style={s.body}>
        {loading && <p style={s.msg}>Loading…</p>}
        {error && <p style={{ ...s.msg, color: '#e86f6f' }}>{error}</p>}
        {!loading && !error && artist && <ArtistCard artist={artist} isSelf />}
      </div>
    </div>
  );
}

function ArtistCard({ artist, isSelf }) {
  const initials = artist.name
    ? artist.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        {artist.profileImage ? (
          <img src={artist.profileImage} alt={artist.name} style={s.avatar} />
        ) : (
          <div style={{ ...s.avatar, ...s.avatarFallback }}>{initials}</div>
        )}
        <div style={s.cardInfo}>
          <div style={s.nameRow}>
            <span style={s.name}>{artist.name}</span>
            {artist.verified && <VerifiedBadge />}
            {isSelf && <span style={s.selfBadge}>You</span>}
          </div>
          <span style={s.email}>{artist.email}</span>
          {artist.instagram && (
            <a
              href={`https://instagram.com/${artist.instagram}`}
              target="_blank"
              rel="noreferrer"
              style={s.instagram}
            >
              @{artist.instagram}
            </a>
          )}
        </div>
      </div>

      {artist.bio && <p style={s.bio}>{artist.bio}</p>}

      {artist.speciality?.length > 0 && (
        <div style={s.tags}>
          {artist.speciality.map(tag => (
            <span key={tag} style={s.tag}>{tag}</span>
          ))}
        </div>
      )}

      <div style={s.stats}>
        <Stat label="Profile Views" value={artist.totalViews?.toLocaleString() ?? '—'} />
        <Stat label="Saved" value={artist.totalSaves?.toLocaleString() ?? '—'} />
        <Stat label="Tattoos" value={artist.tattooCount ?? '—'} />
        <Stat label="Stripe" value={artist.stripeConnected ? 'Connected' : 'Not connected'} />
      </div>

      {artist.studios?.length > 0 && (
        <div style={s.studiosSection}>
          <span style={s.studiosSectionLabel}>Studios</span>
          <div style={s.studiosList}>
            {artist.studios.map(studio => (
              <div key={studio.id} style={s.studioRow}>
                <span style={s.studioName}>{studio.name}</span>
                {studio.addressString && (
                  <span style={s.studioAddress}>{studio.addressString}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={s.stat}>
      <span style={s.statVal}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <span style={s.verifiedBadge} title="Verified artist">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5.5" fill="#4cc98a" fillOpacity="0.2" stroke="#4cc98a" strokeWidth="0.8" />
        <path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="#4cc98a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Verified
    </span>
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
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem 2rem',
  },
  msg: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.35)',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '1.5rem',
    maxWidth: 560,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  cardTop: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  avatarFallback: {
    background: 'rgba(245,236,217,0.12)',
    color: '#f5ecd9',
    fontSize: '1.1rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  name: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  email: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.4)',
  },
  instagram: {
    fontSize: '0.8rem',
    color: 'rgba(245,236,217,0.6)',
  },
  verifiedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.7rem',
    color: '#4cc98a',
    background: 'rgba(76,201,138,0.1)',
    border: '1px solid rgba(76,201,138,0.2)',
    borderRadius: 20,
    padding: '0.15rem 0.5rem',
    fontWeight: 600,
  },
  selfBadge: {
    fontSize: '0.7rem',
    color: 'rgba(245,236,217,0.6)',
    background: 'rgba(245,236,217,0.08)',
    border: '1px solid rgba(245,236,217,0.15)',
    borderRadius: 20,
    padding: '0.15rem 0.5rem',
    fontWeight: 600,
  },
  bio: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
  },
  tag: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.55)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 20,
    padding: '0.2rem 0.6rem',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: '0.75rem',
  },
  statVal: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.35)',
    fontWeight: 500,
  },
  studiosSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: '1.25rem',
  },
  studiosSectionLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  studiosList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  studioRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  studioName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
  },
  studioAddress: {
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.35)',
  },
};
