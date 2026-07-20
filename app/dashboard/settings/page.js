'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  getMyStudioAccount, updateStudioProfile,
  getStudioHours, updateStudioHours,
  getStations, addStation, removeStation,
  setStationUnavailability, clearStationUnavailability,
  listConsentTemplates, createConsentTemplate, updateConsentTemplate, deleteConsentTemplate,
  getStripeStatus, startStripeOnboarding, disconnectStripe,
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

function AddressAutocomplete({ value, onChange, onSelect, inputStyle }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const mapkitRef = useRef(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.mapkit && mapkitRef.current) return;
    if (window.mapkit) { initMapKit(window.mapkit); return; }

    const script = document.createElement('script');
    script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onerror = () => console.error('[MapKit] Failed to load MapKit JS script');
    script.onload = () => initMapKit(window.mapkit);
    document.head.appendChild(script);
  }, []);

  function initMapKit(mk) {
    if (!mk || mapkitRef.current) return;
    mapkitRef.current = mk;
    mk.init({
      authorizationCallback: (done) => {
        fetch(`${BACKEND}/api/mapkit-token`)
          .then(r => { if (!r.ok) throw new Error(`token endpoint ${r.status}`); return r.json(); })
          .then(d => { done(d.token); })
          .catch(() => { done(''); });
      },
    });
    try {
      searchRef.current = new mk.Search({ language: 'en-GB', getsUserLocation: false });
    } catch (e) {
      console.error('[MapKit] Search init error:', e);
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInput(e) {
    const q = e.target.value;
    onChange(q);
    clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => runAutocomplete(q), 300);
  }

  function runAutocomplete(q) {
    if (!searchRef.current) return;
    searchRef.current.autocomplete(q, (err, data) => {
      if (err) { setSuggestions([]); setOpen(false); return; }
      if (!data?.results?.length) { setSuggestions([]); setOpen(false); return; }
      setSuggestions(data.results.slice(0, 5));
      setOpen(true);
    });
  }

  function handleSelect(result) {
    setOpen(false);
    setSuggestions([]);
    const label = result.displayLines?.join(', ') ?? result.completionDescription ?? '';
    onChange(label);
    if (!searchRef.current) { onSelect(label, null, null); return; }
    searchRef.current.search(result, (err, data) => {
      if (!err && data?.places?.length) {
        const place = data.places[0];
        const addr = place.formattedAddress ?? label;
        onSelect(addr, place.coordinate?.latitude ?? null, place.coordinate?.longitude ?? null);
      } else {
        onSelect(label, null, null);
      }
    });
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        style={inputStyle}
        value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Search address"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
          background: 'color-mix(in srgb, var(--bg-base) 88%, white 12%)',
          border: '1px solid var(--border-faint)',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => handleSelect(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.55rem 0.9rem',
                background: 'none', border: 'none',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-faint)' : 'none',
                cursor: 'pointer', color: 'var(--text)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 500, display: 'block', lineHeight: 1.3 }}>
                {s.displayLines?.[0] ?? s.completionDescription}
              </span>
              {s.displayLines?.[1] && (
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>
                  {s.displayLines[1]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
          <span style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>Studio booking</span>
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
          Request booking
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
  const [addressLat, setAddressLat] = useState(null);
  const [addressLng, setAddressLng] = useState(null);
  const [email, setEmail] = useState('');
  const [aftercareInstructions, setAftercareInstructions] = useState('');
  const [widgetBgColor, setWidgetBgColor] = useState('#111111');
  const [widgetAccentColor, setWidgetAccentColor] = useState('#f5ecd9');
  const [timezone, setTimezone] = useState('Australia/Sydney');
  const [walkinCut, setWalkinCut] = useState('0');
  const [personalCut, setPersonalCut] = useState('0');
  const [paymentRecordingReq, setPaymentRecordingReq] = useState('studio_only');
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

  // ── Consent templates ──────────────────────────────────────────────────────
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [templateBuilderOpen, setTemplateBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null = new
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('consent');
  const [templateRequiresSig, setTemplateRequiresSig] = useState(true);
  const [templateRequiresGuardian, setTemplateRequiresGuardian] = useState(false);
  const [templateFields, setTemplateFields] = useState([]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState('');

  const [stripeStatus, setStripeStatus] = useState(null); // null = loading
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeError, setStripeError] = useState('');

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
        const [account, { data: { session } }, hoursData, stationsData, templateData, stripeData] = await Promise.all([
          getMyStudioAccount(),
          getSupabase().auth.getSession(),
          getStudioHours().catch(() => ({ hours: [] })),
          getStations().catch(() => ({ stations: [] })),
          listConsentTemplates().catch(() => ({ templates: [] })),
          getStripeStatus().catch(() => null),
        ]);
        setName(account.studio?.name ?? '');
        const addr = account.studio?.addressString ?? '';
        setAddress(addr);
        if (account.studio?.latitude != null) setAddressLat(account.studio.latitude);
        if (account.studio?.longitude != null) setAddressLng(account.studio.longitude);
        setAftercareInstructions(account.studio?.aftercare_instructions ?? '');
        setWidgetBgColor(account.studio?.widget_bg_color || '#111111');
        setWidgetAccentColor(account.studio?.widget_accent_color || '#f5ecd9');
        setTimezone(account.studio?.timezone || 'Australia/Sydney');
        setWalkinCut(String(account.studio?.walkin_cut_percent ?? account.studio?.studio_cut_percent ?? 0));
        setPersonalCut(String(account.studio?.personal_cut_percent ?? account.studio?.studio_cut_percent ?? 0));
        setPaymentRecordingReq(account.studio?.payment_recording_requirement ?? 'studio_only');
        setEmail(session?.user?.email ?? '');
        setStudioId(account.studio_id);
        setWalkInUrl(window.location.origin + '/studio-booking?s=' + account.studio_id);
        if (hoursData.hours?.length === 7) setHours(hoursData.hours);
        setStations(stationsData.stations ?? []);
        setConsentTemplates(templateData.templates ?? []);
        setStripeStatus(stripeData ?? { connected: false, charges_enabled: false });

        // Handle return from Stripe onboarding.
        const params = new URLSearchParams(window.location.search);
        const stripeParam = params.get('stripe');
        if (stripeParam === 'return' || stripeParam === 'refresh') {
          params.delete('stripe');
          const newSearch = params.toString();
          window.history.replaceState({}, '', window.location.pathname + (newSearch ? '?' + newSearch : ''));
          if (stripeParam === 'refresh') {
            // Account link expired — re-trigger onboarding automatically.
            setStripeConnecting(true);
            try {
              const returnTo = window.location.href;
              const result = await startStripeOnboarding(returnTo);
              window.location.href = result.onboarding_url;
            } catch (e) {
              setStripeError(e.message);
              setStripeConnecting(false);
            }
          } else {
            // Returned from completed onboarding — re-fetch Stripe status.
            getStripeStatus().then(setStripeStatus).catch(() => {});
          }
        }
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
      const wc = parseFloat(walkinCut);
      const pc = parseFloat(personalCut);
      await updateStudioProfile(name.trim(), address.trim(), widgetBgColor, widgetAccentColor, isNaN(wc) ? 0 : wc, isNaN(pc) ? 0 : pc, aftercareInstructions, timezone, addressLat, addressLng, paymentRecordingReq);
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

  async function refreshStations() {
    const data = await getStations();
    setStations(data.stations ?? []);
  }

  async function handleAddStation() {
    setStationLoading(true);
    try {
      const station = await addStation();
      setStations(s => [...s, station]);
    } catch (e) {
      alert(e.message);
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
    } catch (e) {
      alert(e.message);
    } finally {
      setStationLoading(false);
    }
  }

  async function handleSetUnavailable(stationId) {
    if (!unavailDate) return;
    try {
      await setStationUnavailability(stationId, unavailDate);
      setUnavailDate('');
      await refreshStations();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleClearUnavailable(stationId, date) {
    try {
      await clearStationUnavailability(stationId, date.split('T')[0]);
      await refreshStations();
    } catch (e) {
      alert(e.message);
    }
  }

  // ── Consent template helpers ──────────────────────────────────────────────

  function openNewTemplate() {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateType('consent');
    setTemplateRequiresSig(true);
    setTemplateRequiresGuardian(false);
    setTemplateFields([]);
    setTemplateError('');
    setTemplateBuilderOpen(true);
  }

  function openEditTemplate(t) {
    setEditingTemplate(t);
    setTemplateName(t.name);
    setTemplateType(t.type);
    setTemplateRequiresSig(t.requires_signature);
    setTemplateRequiresGuardian(t.requires_minor_guardian);
    setTemplateFields(t.fields ?? []);
    setTemplateError('');
    setTemplateBuilderOpen(true);
  }

  function addField(type) {
    setTemplateFields(prev => [...prev, { id: `f_${Date.now()}`, type, label: '', required: false }]);
  }

  function updateField(id, changes) {
    setTemplateFields(prev => prev.map(f => f.id === id ? { ...f, ...changes } : f));
  }

  function removeField(id) {
    setTemplateFields(prev => prev.filter(f => f.id !== id));
  }

  function moveField(id, dir) {
    setTemplateFields(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  async function saveTemplate() {
    if (!templateName.trim()) { setTemplateError('Template name is required.'); return; }
    setTemplateSaving(true);
    setTemplateError('');
    try {
      const payload = {
        name: templateName.trim(),
        type: templateType,
        requires_signature: templateRequiresSig,
        requires_minor_guardian: templateRequiresGuardian,
        fields: templateFields,
      };
      if (editingTemplate) {
        const updated = await updateConsentTemplate(editingTemplate.id, payload);
        setConsentTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t));
      } else {
        const created = await createConsentTemplate(payload);
        setConsentTemplates(prev => [...prev, created]);
      }
      setTemplateBuilderOpen(false);
    } catch (e) {
      setTemplateError(e.message);
    } finally {
      setTemplateSaving(false);
    }
  }

  async function toggleTemplateActive(t) {
    try {
      const updated = await updateConsentTemplate(t.id, { is_active: !t.is_active });
      setConsentTemplates(prev => prev.map(x => x.id === t.id ? updated : x));
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDeleteTemplate(t) {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    try {
      await deleteConsentTemplate(t.id);
      setConsentTemplates(prev => prev.filter(x => x.id !== t.id));
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleStripeConnect() {
    setStripeConnecting(true);
    setStripeError('');
    try {
      const returnTo = window.location.href.split('?')[0];
      const result = await startStripeOnboarding(returnTo);
      window.location.href = result.onboarding_url;
    } catch (e) {
      setStripeError(e.message);
      setStripeConnecting(false);
    }
  }

  async function handleStripeDisconnect() {
    if (!confirm('Disconnect Stripe? Deposits will no longer be collected for new bookings.')) return;
    setStripeError('');
    try {
      await disconnectStripe();
      setStripeStatus({ connected: false, charges_enabled: false, details_submitted: false, payouts_enabled: false });
    } catch (e) {
      setStripeError(e.message);
    }
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
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onSelect={(addr, lat, lng) => { setAddress(addr); setAddressLat(lat); setAddressLng(lng); }}
                inputStyle={s.input}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Timezone</label>
              <select style={s.input} value={timezone} onChange={e => setTimezone(e.target.value)}>
                <optgroup label="Australia">
                  <option value="Australia/Sydney">Sydney / Melbourne (AEST/AEDT)</option>
                  <option value="Australia/Brisbane">Brisbane (AEST, no DST)</option>
                  <option value="Australia/Adelaide">Adelaide (ACST/ACDT)</option>
                  <option value="Australia/Perth">Perth (AWST)</option>
                  <option value="Australia/Darwin">Darwin (ACST, no DST)</option>
                  <option value="Australia/Hobart">Hobart (AEST/AEDT)</option>
                </optgroup>
                <optgroup label="New Zealand">
                  <option value="Pacific/Auckland">Auckland (NZST/NZDT)</option>
                </optgroup>
                <optgroup label="Asia">
                  <option value="Asia/Singapore">Singapore (SGT)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Seoul">Seoul (KST)</option>
                  <option value="Asia/Bangkok">Bangkok (ICT)</option>
                  <option value="Asia/Dubai">Dubai (GST)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Paris / Berlin (CET/CEST)</option>
                  <option value="Europe/Helsinki">Helsinki (EET/EEST)</option>
                </optgroup>
                <optgroup label="Americas">
                  <option value="America/New_York">New York (EST/EDT)</option>
                  <option value="America/Chicago">Chicago (CST/CDT)</option>
                  <option value="America/Denver">Denver (MST/MDT)</option>
                  <option value="America/Los_Angeles">Los Angeles (PST/PDT)</option>
                  <option value="America/Toronto">Toronto (EST/EDT)</option>
                  <option value="America/Vancouver">Vancouver (PST/PDT)</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="UTC">UTC</option>
                </optgroup>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Studio commission (%)</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
                The studio&apos;s cut of a completed booking. Studio and personal commissions can differ.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[
                  { label: 'Studio', value: walkinCut, set: setWalkinCut, hint: 'Studio-sourced clients' },
                  { label: 'Personal', value: personalCut, set: setPersonalCut, hint: 'App, manual & imported bookings' },
                ].map(({ label, value, set, hint }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ width: 68, fontSize: '0.82rem', color: 'var(--text)', fontWeight: 500 }}>{label}</span>
                    <input
                      style={{ ...s.input, width: 90 }}
                      type="number" min="0" max="100" step="0.5"
                      inputMode="decimal"
                      value={value}
                      onChange={e => set(e.target.value)}
                      onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                      placeholder="0"
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {value && !isNaN(parseFloat(value)) && parseFloat(value) > 0
                        ? `Artist keeps ${(100 - parseFloat(value)).toFixed(1)}% · ${hint}`
                        : `No cut · ${hint}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Payment recording requirement</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>
                Which parties must record payment before a payout can be processed.
              </p>
              <select
                style={{ ...s.input, cursor: 'pointer', colorScheme: 'auto' }}
                value={paymentRecordingReq}
                onChange={e => setPaymentRecordingReq(e.target.value)}
              >
                <option value="studio_only">Studio only</option>
                <option value="artist_only">Artist only</option>
                <option value="both">Both artist and studio</option>
              </select>
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

        {/* ── Payments ── */}
        <p style={{ ...s.groupLabel, marginTop: '1.25rem' }}>Payments</p>

        <section style={{ ...s.card, gridColumn: '1 / -1' }}>
          <h2 style={s.sectionTitle}>Stripe Connect</h2>
          <p style={s.sectionDesc}>
            Connect your Stripe account to collect deposits from clients when sending selection links.
            Payments go directly to your Stripe account minus the platform fee.
          </p>

          {stripeStatus === null ? (
            <div style={s.loadingDot} />
          ) : stripeStatus.connected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={s.stripeStatusRow}>
                <div style={s.stripeStatusDot(stripeStatus.charges_enabled)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '0.87rem', fontWeight: 600, color: 'var(--text)' }}>
                    {stripeStatus.charges_enabled ? 'Active' : 'Onboarding incomplete'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {stripeStatus.charges_enabled
                      ? 'Deposits can be collected from clients.'
                      : 'Finish Stripe onboarding to start accepting payments.'}
                  </span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                  {!stripeStatus.charges_enabled && (
                    <button style={s.saveBtn} onClick={handleStripeConnect} disabled={stripeConnecting}>
                      {stripeConnecting ? 'Redirecting…' : 'Continue setup'}
                    </button>
                  )}
                  <button style={s.stripeDisconnectBtn} onClick={handleStripeDisconnect}>
                    Disconnect
                  </button>
                </div>
              </div>
              {stripeError && <p style={s.errorText}>{stripeError}</p>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button style={s.stripeConnectBtn} onClick={handleStripeConnect} disabled={stripeConnecting}>
                {stripeConnecting ? 'Redirecting to Stripe…' : 'Connect Stripe account'}
              </button>
              {stripeError && <p style={s.errorText}>{stripeError}</p>}
            </div>
          )}
        </section>

        {/* ── Bookings ── */}
        <p style={{ ...s.groupLabel, marginTop: '1.25rem' }}>Bookings</p>

        <section style={{ ...s.card, gridColumn: '1 / -1' }}>
          <h2 style={s.sectionTitle}>Aftercare Instructions</h2>
          <p style={s.sectionDesc}>Aftercare guidance that gets attached to every completed booking. Clients can see this on their booking record after their session.</p>
          <textarea
            style={{ ...s.input, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
            value={aftercareInstructions}
            onChange={e => setAftercareInstructions(e.target.value)}
            placeholder="e.g. Keep the area clean and moisturised for the first 2 weeks. Avoid direct sunlight…"
          />
          <button onClick={saveProfile} style={s.saveBtn} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
        </section>

        <section style={{ ...s.card, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={s.sectionTitle}>Consent Form Templates</h2>
              <p style={s.sectionDesc}>Create consent forms, waivers, and health questionnaires with custom fields, e-signatures, and minor / guardian support.</p>
            </div>
            <button onClick={openNewTemplate} style={s.addTemplateBtn}>+ New form</button>
          </div>

          {consentTemplates.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-ghost)', fontStyle: 'italic' }}>No forms yet. Click "+ New form" to create one.</p>
          )}

          {consentTemplates.map(t => (
            <div key={t.id} style={s.templateRow}>
              <div style={s.templateRowLeft}>
                <span style={{ ...s.formTypeBadge, ...(s.formTypeBadgeColors[t.type] ?? {}) }}>
                  {t.type === 'health' ? 'Health' : t.type === 'waiver' ? 'Waiver' : 'Consent'}
                </span>
                <span style={s.templateName}>{t.name}</span>
                {t.requires_minor_guardian && <span style={s.guardianBadge}>Guardian</span>}
                {!t.is_active && <span style={s.inactiveBadge}>Inactive</span>}
                <span style={s.templateFieldCount}>{(t.fields ?? []).length} field{(t.fields ?? []).length !== 1 ? 's' : ''}</span>
              </div>
              <div style={s.templateRowActions}>
                <button style={s.templateActionBtn} onClick={() => openEditTemplate(t)}>Edit</button>
                <button style={s.templateActionBtn} onClick={() => toggleTemplateActive(t)}>
                  {t.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button style={{ ...s.templateActionBtn, color: '#e86f6f' }} onClick={() => handleDeleteTemplate(t)}>Delete</button>
              </div>
            </div>
          ))}
        </section>

        {/* ── Template builder modal ── */}
        {templateBuilderOpen && (
          <div style={s.modalOverlay} onClick={e => e.target === e.currentTarget && setTemplateBuilderOpen(false)}>
            <div style={s.templateModal}>
              <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
                {editingTemplate ? 'Edit form' : 'New consent form'}
              </h2>

              <div style={s.field}>
                <label style={s.label}>Form name <span style={{ color: '#e86f6f' }}>*</span></label>
                <input style={s.input} type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Tattoo Consent" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={s.field}>
                  <label style={s.label}>Type</label>
                  <select style={s.input} value={templateType} onChange={e => setTemplateType(e.target.value)}>
                    <option value="consent">Consent</option>
                    <option value="waiver">Waiver</option>
                    <option value="health">Health questionnaire</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={s.toggleRow}>
                  <input type="checkbox" checked={templateRequiresSig} onChange={e => setTemplateRequiresSig(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>Require client signature</span>
                </label>
                <label style={s.toggleRow}>
                  <input type="checkbox" checked={templateRequiresGuardian} onChange={e => setTemplateRequiresGuardian(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>Require parent / guardian consent for minors (under 18)</span>
                </label>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fields ({templateFields.length})</span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[['heading','Heading'],['paragraph','Paragraph'],['checkbox','Checkbox'],['text','Text'],['textarea','Textarea'],['yesno','Yes/No']].map(([type, label]) => (
                      <button key={type} style={s.addFieldBtn} onClick={() => addField(type)}>+ {label}</button>
                    ))}
                  </div>
                </div>

                {templateFields.length === 0 && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-ghost)', fontStyle: 'italic' }}>No fields yet. Add fields using the buttons above.</p>
                )}

                {templateFields.map((f, idx) => (
                  <div key={f.id} style={s.fieldEditorRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <span style={s.fieldTypeBadge}>{f.type}</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                        <button style={s.fieldMoveBtn} onClick={() => moveField(f.id, -1)} disabled={idx === 0}>↑</button>
                        <button style={s.fieldMoveBtn} onClick={() => moveField(f.id, 1)} disabled={idx === templateFields.length - 1}>↓</button>
                        <button style={{ ...s.fieldMoveBtn, color: '#e86f6f' }} onClick={() => removeField(f.id)}>✕</button>
                      </div>
                    </div>
                    {['heading','paragraph','checkbox'].includes(f.type) ? (
                      <textarea
                        style={{ ...s.input, minHeight: f.type === 'paragraph' ? 72 : 38, resize: 'vertical', fontSize: '0.82rem' }}
                        value={f.label}
                        onChange={e => updateField(f.id, { label: e.target.value })}
                        placeholder={f.type === 'heading' ? 'Section heading…' : f.type === 'paragraph' ? 'Paragraph text…' : 'Checkbox label (e.g. I agree to…)'}
                      />
                    ) : (
                      <input style={{ ...s.input, fontSize: '0.82rem' }} type="text" value={f.label}
                        onChange={e => updateField(f.id, { label: e.target.value })}
                        placeholder="Field label…" />
                    )}
                    {!['heading','paragraph'].includes(f.type) && (
                      <label style={{ ...s.toggleRow, marginTop: '0.3rem' }}>
                        <input type="checkbox" checked={!!f.required} onChange={e => updateField(f.id, { required: e.target.checked })}
                          style={{ accentColor: 'var(--accent)' }} />
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-ghost)' }}>Required</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>

              {templateError && <p style={{ fontSize: '0.8rem', color: '#e86f6f', margin: 0 }}>{templateError}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button style={s.cancelBtn} onClick={() => setTemplateBuilderOpen(false)}>Cancel</button>
                <button style={{ ...s.saveBtn, flex: 2 }} onClick={saveTemplate} disabled={templateSaving}>
                  {templateSaving ? 'Saving…' : 'Save form'}
                </button>
              </div>
            </div>
          </div>
        )}

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
          <h2 style={s.sectionTitle}>Studio Booking Link</h2>
          <p style={s.sectionDesc}>Share this link or QR code so clients can submit booking requests.</p>
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

        <section style={{ ...s.card, gridColumn: '1 / -1' }}>
          <h2 style={s.sectionTitle}>Booking Widget</h2>
          <p style={s.sectionDesc}>Embed the booking form on your website. Customise the colours to match your brand.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
              <div style={s.embedCard}>
                <label style={s.label}>Embed snippet</label>
                <pre style={s.codeBlock}>{embedSnippet}</pre>
                <button onClick={copyEmbed} style={s.copyBtn}>{embedCopied ? 'Copied!' : 'Copy snippet'}</button>
              </div>
              <button onClick={saveProfile} style={s.saveBtn} disabled={saving}>
                {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
              </button>
            </div>
            <WidgetPreview bg={widgetBgColor} accent={widgetAccentColor} studioName={name || 'Your Studio'} />
          </div>
        </section>

        {/* ── Account ── */}
        <p style={{ ...s.groupLabel, marginTop: '1.25rem' }}>Account</p>

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
      <div style={{ height: '2rem' }} />
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
  sectionTitle: { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 0.25rem' },
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
  hoursRow: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 0.75rem', background: 'var(--bg-base)', borderRadius: 8 },
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
  walkInCard: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
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
  embedCard: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  codeBlock: { margin: 0, fontFamily: 'ui-monospace,monospace', fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--bg-base)', border: '1px solid var(--border-faint)', borderRadius: 8, padding: '0.75rem 1rem' },
  // Consent templates
  addTemplateBtn: { background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 },
  templateRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 8, padding: '0.65rem 0.9rem', gap: '0.75rem' },
  templateRowLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1, minWidth: 0 },
  templateRowActions: { display: 'flex', gap: '0.4rem', flexShrink: 0 },
  templateName: { fontSize: '0.87rem', fontWeight: 500, color: 'var(--text-dim)' },
  templateFieldCount: { fontSize: '0.72rem', color: 'var(--text-ghost)' },
  guardianBadge: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.12rem 0.45rem', borderRadius: 4, background: 'rgba(245,236,217,0.08)', color: 'var(--text-muted)' },
  inactiveBadge: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.12rem 0.45rem', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: 'var(--text-ghost)' },
  formTypeBadge: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.12rem 0.45rem', borderRadius: 4 },
  formTypeBadgeColors: {
    consent: { background: 'rgba(245,236,217,0.1)', color: 'var(--accent)' },
    waiver:  { background: 'rgba(232,111,111,0.12)', color: '#e86f6f' },
    health:  { background: 'rgba(76,201,138,0.12)', color: '#4cc98a' },
  },
  templateActionBtn: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' },
  // Template builder modal
  modalOverlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' },
  templateModal: { background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '1rem' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
  addFieldBtn: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.55rem', fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' },
  fieldEditorRow: { background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 8, padding: '0.65rem 0.75rem', marginBottom: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  fieldTypeBadge: { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.1rem 0.45rem', borderRadius: 4, background: 'var(--bg-chip)', color: 'var(--text-ghost)' },
  fieldMoveBtn: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.1rem 0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' },
  cancelBtn: { flex: 1, background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' },
  // Stripe
  stripeConnectBtn: { alignSelf: 'flex-start', background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '0.65rem 1.4rem', fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-contrast, #111)', cursor: 'pointer' },
  stripeDisconnectBtn: { alignSelf: 'flex-start', background: 'transparent', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 6, padding: '0.35rem 0.85rem', fontSize: '0.78rem', color: 'rgba(255,100,100,0.65)', cursor: 'pointer' },
  stripeStatusRow: { display: 'flex', alignItems: 'center', gap: '0.85rem', background: 'var(--bg-base)', border: '1px solid var(--border-faint)', borderRadius: 10, padding: '0.9rem 1rem' },
  stripeStatusDot: (active) => ({ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: active ? '#4cc98a' : 'rgba(255,180,0,0.8)', boxShadow: active ? '0 0 6px rgba(76,201,138,0.5)' : '0 0 6px rgba(255,180,0,0.4)' }),
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
