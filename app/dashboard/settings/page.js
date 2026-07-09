'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  getMyStudioAccount, updateStudioProfile,
  getStudioHours, updateStudioHours,
  getStations, addStation, removeStation,
  setStationUnavailability, clearStationUnavailability,
} from '@/lib/api';
import { getSupabase } from '@/lib/supabase';
import { invalidate } from '@/lib/cache';
import { setDemoMode } from '@/lib/mode';

const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false });

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function defaultHours() {
  return DAYS.map((_, i) => ({
    day_of_week: i,
    open_time: '09:00',
    close_time: '17:00',
    is_closed: i >= 5,
  }));
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [walkInUrl, setWalkInUrl] = useState('');
  const [studioId, setStudioId] = useState('');

  const [hours, setHours] = useState(defaultHours());
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  const [stations, setStations] = useState([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [expandedStation, setExpandedStation] = useState(null);
  const [unavailDate, setUnavailDate] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [account, { data: { session } }, hoursData, stationsData] = await Promise.all([
          getMyStudioAccount(),
          getSupabase().auth.getSession(),
          getStudioHours().catch(() => ({ hours: [] })),
          getStations().catch(() => ({ stations: [] })),
        ]);
        setName(account.studio?.name ?? '');
        setAddress(account.studio?.address_string ?? '');
        setEmail(session?.user?.email ?? '');
        setStudioId(account.studio_id);
        setWalkInUrl(window.location.origin + '/walk-in?s=' + account.studio_id);
        if (hoursData.hours?.length === 7) setHours(hoursData.hours);
        setStations(stationsData.stations ?? []);
      } catch {
        setProfileError('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!name.trim()) { setProfileError('Studio name is required.'); return; }
    setSaving(true); setProfileError('');
    try {
      await updateStudioProfile(name.trim(), address.trim());
      invalidate('studio-account');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveHours() {
    setHoursSaving(true);
    try {
      await updateStudioHours(hours);
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 2500);
    } catch {
      // silent — hours aren't critical to block on
    } finally {
      setHoursSaving(false);
    }
  }

  function setHourField(dayIndex, field, value) {
    setHours(h => h.map((d, i) => i === dayIndex ? { ...d, [field]: value } : d));
  }

  async function handleAddStation() {
    setStationLoading(true);
    try {
      const station = await addStation();
      setStations(s => [...s, station]);
    } finally {
      setStationLoading(false);
    }
  }

  async function handleRemoveStation(id) {
    setStationLoading(true);
    try {
      await removeStation(id);
      setStations(s => s.filter(st => st.id !== id));
      if (expandedStation === id) setExpandedStation(null);
    } finally {
      setStationLoading(false);
    }
  }

  async function handleSetUnavailable(stationId) {
    if (!unavailDate) return;
    await setStationUnavailability(stationId, unavailDate);
    setUnavailDate('');
  }

  async function handleClearUnavailable(stationId, date) {
    const d = date.split('T')[0];
    await clearStationUnavailability(stationId, d);
    // refresh stations list
    const data = await getStations();
    setStations(data.stations ?? []);
  }

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    setDemoMode(false);
    router.replace('/');
  }

  function copyLink() {
    navigator.clipboard.writeText(walkInUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const embedSnippet = studioId
    ? `<div data-vanta-studio="${studioId}"></div>\n<script src="https://studio.vanta.tattoo/embed.js"><\/script>`
    : '';

  function copyEmbed() {
    navigator.clipboard.writeText(embedSnippet).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    });
  }

  if (loading) return <div style={s.page}><div style={s.loadingDot} /></div>;

  return (
    <div style={s.page}>
      <h1 style={s.pageTitle}>Settings</h1>

      {/* Studio Profile */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Studio Profile</h2>
        <form onSubmit={handleSaveProfile} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Studio Name</label>
            <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Studio name" />
          </div>
          <div style={s.field}>
            <label style={s.label}>Address</label>
            <input style={s.input} value={address} onChange={e => setAddress(e.target.value)} placeholder="Studio address" />
          </div>
          {profileError && <p style={s.errorText}>{profileError}</p>}
          <button type="submit" style={s.saveBtn} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Studio Hours */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Studio Hours</h2>
        <div style={s.hoursGrid}>
          {hours.map((day, i) => (
            <div key={i} style={s.hoursRow}>
              <span style={s.dayLabel}>{DAYS[i]}</span>
              <label style={s.closedToggle}>
                <input
                  type="checkbox"
                  checked={day.is_closed}
                  onChange={e => setHourField(i, 'is_closed', e.target.checked)}
                  style={{ accentColor: '#f5ecd9' }}
                />
                <span style={{ color: day.is_closed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>
                  Closed
                </span>
              </label>
              {!day.is_closed && (
                <div style={s.timePair}>
                  <input
                    type="time"
                    value={day.open_time}
                    onChange={e => setHourField(i, 'open_time', e.target.value)}
                    style={s.timeInput}
                  />
                  <span style={s.timeSep}>–</span>
                  <input
                    type="time"
                    value={day.close_time}
                    onChange={e => setHourField(i, 'close_time', e.target.value)}
                    style={s.timeInput}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={handleSaveHours} style={s.saveBtn} disabled={hoursSaving}>
          {hoursSaving ? 'Saving…' : hoursSaved ? 'Saved!' : 'Save hours'}
        </button>
      </section>

      {/* Stations */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Stations</h2>
        <p style={s.sectionDesc}>Artists are assigned to a free station when a booking is accepted.</p>
        <div style={s.stationList}>
          {stations.map(st => (
            <div key={st.id} style={s.stationRow}>
              <div style={s.stationTop}>
                <span style={s.stationName}>{st.name}</span>
                <div style={s.stationActions}>
                  <button
                    style={s.stationToggleBtn}
                    onClick={() => setExpandedStation(expandedStation === st.id ? null : st.id)}
                  >
                    {expandedStation === st.id ? 'Hide' : 'Unavailability'}
                  </button>
                  <button
                    style={s.stationRemoveBtn}
                    onClick={() => handleRemoveStation(st.id)}
                    disabled={stationLoading}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {expandedStation === st.id && (
                <div style={s.unavailPanel}>
                  <div style={s.unavailAdd}>
                    <input
                      type="date"
                      value={unavailDate}
                      onChange={e => setUnavailDate(e.target.value)}
                      style={s.dateInput}
                    />
                    <button
                      style={s.saveBtn}
                      onClick={() => handleSetUnavailable(st.id)}
                      disabled={!unavailDate}
                    >
                      Mark unavailable
                    </button>
                  </div>
                  {st.unavailability?.length > 0 && (
                    <div style={s.unavailList}>
                      {st.unavailability.map(u => (
                        <div key={u.date} style={s.unavailItem}>
                          <span style={s.unavailDate}>{u.date.split('T')[0]}</span>
                          <button style={s.clearBtn} onClick={() => handleClearUnavailable(st.id, u.date)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={handleAddStation} style={s.saveBtn} disabled={stationLoading}>
          + Add station
        </button>
      </section>

      {/* Walk-in Link */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Walk-in Link</h2>
        <p style={s.sectionDesc}>Share this link or QR code so clients can submit walk-in requests.</p>
        <div style={s.walkInCard}>
          <div style={s.walkInLeft}>
            <span style={s.walkInUrl}>{walkInUrl}</span>
            <button onClick={copyLink} style={s.copyBtn}>{copied ? 'Copied!' : 'Copy link'}</button>
          </div>
          {walkInUrl && (
            <div style={s.qrWrap}>
              <QRCodeSVG value={walkInUrl} size={96} bgColor="transparent" fgColor="#f5ecd9" />
            </div>
          )}
        </div>
      </section>

      {/* Embed widget */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Booking widget</h2>
        <p style={s.sectionDesc}>Paste this into any page on your website to embed the booking form directly — no iframe, no redirects.</p>
        <div style={s.embedCard}>
          <pre style={s.codeBlock}>{embedSnippet}</pre>
          <button onClick={copyEmbed} style={s.copyBtn}>{embedCopied ? 'Copied!' : 'Copy snippet'}</button>
        </div>
        <p style={s.sectionDesc}>Customise the button colour and style with CSS variables on the div — see <span style={{ color: 'rgba(255,255,255,0.5)' }}>studio.vanta.tattoo/embed.js</span> for details.</p>
      </section>

      {/* Account */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Account</h2>
        <div style={s.field}>
          <label style={s.label}>Email</label>
          <input style={{ ...s.input, ...s.inputReadonly }} value={email} readOnly />
        </div>
        <button onClick={handleSignOut} style={s.signOutBtn}>Sign out</button>
      </section>
    </div>
  );
}

const s = {
  page: { padding: '2rem 2.5rem', maxWidth: 580, display: 'flex', flexDirection: 'column', gap: '2.5rem' },
  pageTitle: { fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' },
  loadingDot: { width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', margin: '4rem auto' },
  section: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  sectionTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#ffffff', margin: 0, paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  sectionDesc: { fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: { fontSize: '0.8rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)' },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: '#ffffff', outline: 'none', width: '100%', boxSizing: 'border-box' },
  inputReadonly: { color: 'rgba(255,255,255,0.35)', cursor: 'default' },
  errorText: { fontSize: '0.8rem', color: '#ff6b6b', margin: 0 },
  saveBtn: { alignSelf: 'flex-start', background: 'rgba(245,236,217,0.1)', border: '1px solid rgba(245,236,217,0.18)', borderRadius: 8, padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: '#f5ecd9', cursor: 'pointer' },
  // Hours
  hoursGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  hoursRow: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8 },
  dayLabel: { fontSize: '0.83rem', color: 'rgba(255,255,255,0.7)', width: 90, flexShrink: 0 },
  closedToggle: { display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', flexShrink: 0 },
  timePair: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' },
  timeSep: { color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' },
  timeInput: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '0.3rem 0.5rem', fontSize: '0.82rem', color: '#ffffff', outline: 'none', colorScheme: 'dark' },
  // Stations
  stationList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  stationRow: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'hidden' },
  stationTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem' },
  stationName: { fontSize: '0.87rem', fontWeight: 500, color: 'rgba(255,255,255,0.8)' },
  stationActions: { display: 'flex', gap: '0.5rem' },
  stationToggleBtn: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' },
  stationRemoveBtn: { background: 'transparent', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: 'rgba(255,100,100,0.6)', cursor: 'pointer' },
  unavailPanel: { borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  unavailAdd: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  dateInput: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '0.35rem 0.6rem', fontSize: '0.82rem', color: '#ffffff', outline: 'none', colorScheme: 'dark' },
  unavailList: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  unavailItem: { display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)', borderRadius: 6, padding: '0.2rem 0.5rem' },
  unavailDate: { fontSize: '0.78rem', color: 'rgba(255,200,60,0.8)' },
  clearBtn: { background: 'none', border: 'none', color: 'rgba(255,200,60,0.5)', cursor: 'pointer', fontSize: '0.7rem', padding: 0 },
  // Walk-in
  walkInCard: { display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1.25rem' },
  walkInLeft: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 },
  walkInUrl: { fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', wordBreak: 'break-all' },
  copyBtn: { alignSelf: 'flex-start', background: 'rgba(245,236,217,0.08)', border: '1px solid rgba(245,236,217,0.15)', borderRadius: 6, padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: 600, color: '#f5ecd9', cursor: 'pointer' },
  qrWrap: { flexShrink: 0, padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 },
  // Embed
  embedCard: { display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1.1rem 1.25rem' },
  codeBlock: { margin: 0, fontFamily: 'ui-monospace,monospace', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
  // Account
  signOutBtn: { alignSelf: 'flex-start', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '0.4rem 1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' },
};
