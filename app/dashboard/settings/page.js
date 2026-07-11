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
import { getTheme, setTheme } from '@/lib/theme';

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

function isLightColor(hex) {
  if (!hex || hex[0] !== '#') return false;
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

const ALL_PLACEMENTS = [
  'Ankle','Arm','Back','Calf','Chest','Foot','Forearm',
  'Hand','Head','Hip','Knee','Neck','Ribs','Shoulder',
  'Stomach','Thigh','Wrist','Other',
];

function hexToRgbaStr(hex, alpha) {
  if (!hex || hex[0] !== '#') return `rgba(245,236,217,${alpha})`;
  const h = hex.slice(1).length === 3
    ? hex.slice(1).split('').map(c => c+c).join('')
    : hex.slice(1);
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function WidgetPreview({ bg, accent, studioName }) {
  const light = isLightColor(accent);
  const inp = { height: 38, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 };
  const lbl = { fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 4, display: 'block' };
  const fld = { display: 'flex', flexDirection: 'column' };
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '1.25rem' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 0.85rem' }}>Preview</p>
      <div style={{ background: bg, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Walk-in booking</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{studioName}</span>
        </div>

        {/* First + Last */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <div style={fld}><span style={lbl}>First name</span><div style={inp} /></div>
          <div style={fld}><span style={lbl}>Last name</span><div style={inp} /></div>
        </div>

        <div style={fld}><span style={lbl}>Date of birth</span><div style={inp} /></div>
        <div style={fld}><span style={lbl}>Email</span><div style={inp} /></div>

        {/* Phone */}
        <div style={fld}>
          <span style={lbl}>Phone</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ ...inp, width: 72, flexShrink: 0 }} />
            <div style={{ ...inp, flex: 1 }} />
          </div>
        </div>

        <div style={fld}><span style={lbl}>Artist (optional)</span><div style={inp} /></div>

        {/* Placement chips */}
        <div style={fld}>
          <span style={lbl}>Placement</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {ALL_PLACEMENTS.map((p, i) => (
              <span key={p} style={{
                padding: '0.25rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 500,
                background: i === 0 ? hexToRgbaStr(accent, 0.12) : 'rgba(255,255,255,0.05)',
                border: `1px solid ${i === 0 ? accent : 'rgba(255,255,255,0.1)'}`,
                color: i === 0 ? accent : 'rgba(255,255,255,0.5)',
              }}>{p}</span>
            ))}
          </div>
        </div>

        <div style={fld}><span style={lbl}>Design description</span><div style={{ ...inp, height: 72 }} /></div>
        <div style={fld}><span style={lbl}>Additional notes (optional)</span><div style={{ ...inp, height: 52 }} /></div>

        {/* Photo upload */}
        <div style={fld}>
          <span style={lbl}>Reference photos (optional, up to 5)</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.5rem 0.85rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', alignSelf: 'flex-start' }}>
            + Add photos
          </div>
        </div>

        {/* Button */}
        <div style={{ padding: '0.75rem', background: accent, borderRadius: 9, fontSize: '0.85rem', fontWeight: 700, color: light ? '#0e0e0e' : '#ffffff', textAlign: 'center' }}>
          Request walk-in
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [consentForm, setConsentForm] = useState('');
  const [widgetBgColor, setWidgetBgColor] = useState('#111111');
  const [widgetAccentColor, setWidgetAccentColor] = useState('#f5ecd9');
  const [studioCut, setStudioCut] = useState('0');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [walkInUrl, setWalkInUrl] = useState('');
  const [studioId, setStudioId] = useState('');
  const [theme, setThemeState] = useState('dark');

  useEffect(() => { setThemeState(getTheme()); }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  }

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
        setConsentForm(account.studio?.consent_form ?? '');
        setWidgetBgColor(account.studio?.widget_bg_color || '#111111');
        setWidgetAccentColor(account.studio?.widget_accent_color || '#f5ecd9');
        setStudioCut(String(account.studio?.studio_cut_percent ?? 0));
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

  async function saveProfile() {
    if (!name.trim()) { setProfileError('Studio name is required.'); return; }
    setSaving(true); setProfileError('');
    try {
      const cut = parseFloat(studioCut);
      await updateStudioProfile(name.trim(), address.trim(), consentForm, widgetBgColor, widgetAccentColor, isNaN(cut) ? 0 : cut);
      invalidate('studio-account');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleSaveProfile(e) {
    e.preventDefault();
    saveProfile();
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

      <div style={s.grid}>

        {/* ── Studio ── */}
        <p style={s.groupLabel}>Studio</p>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>Profile</h2>
          <form onSubmit={handleSaveProfile} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Studio Name</label>
              <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Studio name" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Address</label>
              <input style={s.input} value={address} onChange={e => setAddress(e.target.value)} placeholder="Studio address" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Studio cut (%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  style={{ ...s.input, width: 90 }}
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={studioCut}
                  onChange={e => setStudioCut(e.target.value)}
                  placeholder="0"
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {studioCut && !isNaN(parseFloat(studioCut)) && parseFloat(studioCut) > 0
                    ? `Artist keeps ${(100 - parseFloat(studioCut)).toFixed(1)}%`
                    : 'No cut taken'}
                </span>
              </div>
            </div>
            {profileError && <p style={s.errorText}>{profileError}</p>}
            <button type="submit" style={s.saveBtn} disabled={saving}>
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
            </button>
          </form>
        </section>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>Hours</h2>
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
                  <span style={{ color: day.is_closed ? 'var(--text-ghost)' : 'var(--text-muted)', fontSize: '0.75rem' }}>
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

        {/* ── Bookings ── */}
        <p style={{ ...s.groupLabel, marginTop: '0.5rem' }}>Bookings</p>

        <section style={{ ...s.card, gridColumn: '1 / -1' }}>
          <h2 style={s.sectionTitle}>Consent Form</h2>
          <p style={s.sectionDesc}>Clients must read and agree to this before submitting a booking request. Leave blank to disable.</p>
          <textarea
            style={{ ...s.input, minHeight: 100, resize: 'vertical', lineHeight: 1.6 }}
            value={consentForm}
            onChange={e => setConsentForm(e.target.value)}
            placeholder="e.g. By submitting this form you confirm you are 18+ and consent to receive a tattoo…"
          />
          <button onClick={saveProfile} style={s.saveBtn} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
        </section>

        <section style={s.card}>
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

        <section style={s.card}>
          <h2 style={s.sectionTitle}>Walk-in Link</h2>
          <p style={s.sectionDesc}>Share this link or QR code so clients can submit walk-in requests.</p>
          <div style={s.walkInCard}>
            <div style={s.walkInLeft}>
              <span style={s.walkInUrl}>{walkInUrl}</span>
              <button onClick={copyLink} style={s.copyBtn}>{copied ? 'Copied!' : 'Copy link'}</button>
            </div>
            {walkInUrl && (
              <div style={s.qrWrap}>
                <QRCodeSVG value={walkInUrl} size={80} bgColor="transparent" fgColor="#f5ecd9" />
              </div>
            )}
          </div>
        </section>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>Widget Appearance</h2>
          <p style={s.sectionDesc}>Customise the booking widget colours to match your brand.</p>
          <div style={s.colorRow}>
            <div style={s.colorField}>
              <label style={s.label}>Background</label>
              <div style={s.colorInputWrap}>
                <input type="color" value={widgetBgColor} onChange={e => setWidgetBgColor(e.target.value)} style={s.colorSwatch} />
                <input
                  style={{ ...s.input, fontFamily: 'ui-monospace,monospace', fontSize: '0.82rem' }}
                  value={widgetBgColor}
                  onChange={e => setWidgetBgColor(e.target.value)}
                  maxLength={7}
                />
              </div>
            </div>
            <div style={s.colorField}>
              <label style={s.label}>Highlight</label>
              <div style={s.colorInputWrap}>
                <input type="color" value={widgetAccentColor} onChange={e => setWidgetAccentColor(e.target.value)} style={s.colorSwatch} />
                <input
                  style={{ ...s.input, fontFamily: 'ui-monospace,monospace', fontSize: '0.82rem' }}
                  value={widgetAccentColor}
                  onChange={e => setWidgetAccentColor(e.target.value)}
                  maxLength={7}
                />
              </div>
            </div>
          </div>
          <WidgetPreview bg={widgetBgColor} accent={widgetAccentColor} studioName={name || 'Your Studio'} />
          <button onClick={saveProfile} style={s.saveBtn} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save appearance'}
          </button>
        </section>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>Booking Widget</h2>
          <p style={s.sectionDesc}>Paste this into any page on your website to embed the booking form directly — no iframe, no redirects.</p>
          <div style={s.embedCard}>
            <pre style={s.codeBlock}>{embedSnippet}</pre>
            <button onClick={copyEmbed} style={s.copyBtn}>{embedCopied ? 'Copied!' : 'Copy snippet'}</button>
          </div>
        </section>

        {/* ── Account ── */}
        <p style={{ ...s.groupLabel, marginTop: '0.5rem' }}>Account</p>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>Account</h2>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input style={{ ...s.input, ...s.inputReadonly }} value={email} readOnly />
          </div>
          <button onClick={handleSignOut} style={s.signOutBtn}>Sign out</button>
        </section>

        <section style={s.card}>
          <h2 style={s.sectionTitle}>Appearance</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', margin: '0.2rem 0 0' }}>
                {theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              </p>
            </div>
            <button onClick={toggleTheme} style={s.themeToggle} aria-label="Toggle theme">
              <span style={s.themeToggleTrack(theme)}>
                <span style={s.themeToggleThumb(theme)} />
              </span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}

const s = {
  page: { padding: '2rem 2.5rem 4rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '100%', boxSizing: 'border-box' },
  pageTitle: { fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', alignItems: 'start' },
  groupLabel: { gridColumn: '1 / -1', margin: '0 0 -0.25rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-ghost)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  card: { display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '1.25rem' },
  loadingDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--border)', margin: '4rem auto' },
  section: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  sectionTitle: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: 0, paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-faint)' },
  sectionDesc: { fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: { fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' },
  input: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.9rem', color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' },
  inputReadonly: { color: 'var(--text-faint)', cursor: 'default' },
  errorText: { fontSize: '0.8rem', color: '#ff6b6b', margin: 0 },
  saveBtn: { alignSelf: 'flex-start', background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', borderRadius: 8, padding: '0.55rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' },
  // Hours
  hoursGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  hoursRow: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0.75rem', background: 'var(--bg-card)', borderRadius: 8 },
  dayLabel: { fontSize: '0.83rem', color: 'var(--text-dim)', width: 90, flexShrink: 0 },
  closedToggle: { display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', flexShrink: 0 },
  timePair: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' },
  timeSep: { color: 'var(--text-ghost)', fontSize: '0.8rem' },
  timeInput: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.5rem', fontSize: '0.82rem', color: 'var(--text)', outline: 'none', colorScheme: 'auto' },
  // Stations
  stationList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  stationRow: { background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 8, overflow: 'hidden' },
  stationTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.85rem' },
  stationName: { fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-dim)' },
  stationActions: { display: 'flex', gap: '0.5rem' },
  stationToggleBtn: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' },
  stationRemoveBtn: { background: 'transparent', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: 'rgba(255,100,100,0.6)', cursor: 'pointer' },
  unavailPanel: { borderTop: '1px solid var(--border-faint)', padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  unavailAdd: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  dateInput: { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.35rem 0.6rem', fontSize: '0.82rem', color: 'var(--text)', outline: 'none', colorScheme: 'auto' },
  unavailList: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  unavailItem: { display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,180,0,0.08)', border: '1px solid rgba(255,180,0,0.2)', borderRadius: 6, padding: '0.2rem 0.5rem' },
  unavailDate: { fontSize: '0.78rem', color: 'rgba(255,200,60,0.8)' },
  clearBtn: { background: 'none', border: 'none', color: 'rgba(255,200,60,0.5)', cursor: 'pointer', fontSize: '0.7rem', padding: 0 },
  // Walk-in
  walkInCard: { display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '1.25rem' },
  walkInLeft: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 },
  walkInUrl: { fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all' },
  copyBtn: { alignSelf: 'flex-start', background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', borderRadius: 6, padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' },
  qrWrap: { flexShrink: 0, padding: '0.5rem', background: 'var(--bg-card)', borderRadius: 8 },
  // Widget appearance
  colorRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  colorField: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  colorInputWrap: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  colorSwatch: { width: 36, height: 36, padding: 2, background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', flexShrink: 0 },
  // Embed
  embedCard: { display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '1.1rem 1.25rem' },
  codeBlock: { margin: 0, fontFamily: 'ui-monospace,monospace', fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
  // Account
  signOutBtn: { alignSelf: 'flex-start', background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 1rem', fontSize: '0.75rem', color: 'var(--text-faint)', cursor: 'pointer' },
  themeToggle: { background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  themeToggleTrack: (theme) => ({
    display: 'block', width: 44, height: 24, borderRadius: 12, padding: 3,
    background: theme === 'light' ? 'var(--accent)' : 'var(--bg-chip)',
    border: `1px solid var(--border)`,
    transition: 'background 0.2s', boxSizing: 'border-box',
  }),
  themeToggleThumb: (theme) => ({
    display: 'block', width: 16, height: 16, borderRadius: '50%',
    background: theme === 'light' ? 'var(--bg-sidebar)' : 'var(--text-muted)',
    transform: `translateX(${theme === 'light' ? '20px' : '0px'})`,
    transition: 'transform 0.2s, background 0.2s',
  }),
};
