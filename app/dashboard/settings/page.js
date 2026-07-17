'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  getMyStudioAccount, updateStudioProfile,
  getStudioHours, updateStudioHours,
  getStations, addStation, removeStation,
  setStationUnavailability, clearStationUnavailability,
  listConsentTemplates, createConsentTemplate, updateConsentTemplate, deleteConsentTemplate,
  importStudioData, getStudioArtists,
} from '@/lib/api';
import { getSupabase } from '@/lib/supabase';
import { invalidate, invalidatePrefix } from '@/lib/cache';
import { setDemoMode } from '@/lib/mode';
import { getTheme, setTheme } from '@/lib/theme';
import { parseCSV } from '@/lib/csv';
import {
  CLIENT_FIELDS, APPOINTMENT_FIELDS, PRESETS,
  suggestMapping, suggestKind,
  normalizeEmail, normalizePhone, parsePrice,
  parseDateTime, parseDOB, normalizeStatus, parseDurationMinutes,
} from '@/lib/importPresets';

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

const IMPORT_CHUNK = 200;
const UNASSIGNED = '';

function previewColumns(kind) {
  if (kind === 'clients') {
    return [
      { key: 'name',  label: 'Name',   render: p => p.name },
      { key: 'email', label: 'Email',  render: p => p.email || '—' },
      { key: 'phone', label: 'Phone',  render: p => p.phone || '—' },
      { key: 'dob',   label: 'DOB',    render: p => p.dob || '—' },
      { key: 'notes', label: 'Notes',  render: p => p.notes || '—' },
    ];
  }
  return [
    { key: 'client', label: 'Client', render: p => p.client_name || p.client_email || p.client_phone },
    { key: 'when',   label: 'When',   render: p => p.chosen_time ? new Date(p.chosen_time).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—' },
    { key: 'status', label: 'Status', render: p => p.status },
    { key: 'price',  label: 'Price',  render: p => p.price != null ? `$${p.price}` : '—' },
    { key: 'design', label: 'Service', render: p => p.design_details || '—' },
  ];
}

function ImportSection() {
  const [step, setStep] = useState('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [kind, setKind] = useState('clients');
  const [preset, setPreset] = useState('generic');
  const [dayFirst, setDayFirst] = useState(true);
  const [mapping, setMapping] = useState({});
  const [artists, setArtists] = useState([]);
  const [artistMap, setArtistMap] = useState({});
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    getStudioArtists('approved')
      .then(d => setArtists(d.artists ?? []))
      .catch(() => {});
  }, []);

  const fields = kind === 'clients' ? CLIENT_FIELDS : APPOINTMENT_FIELDS;

  const artistNames = useMemo(() => {
    if (kind !== 'appointments' || !mapping.artist_name) return [];
    return [...new Set(rows.map(r => (r[mapping.artist_name] ?? '').trim()).filter(Boolean))];
  }, [kind, mapping.artist_name, rows]);

  useEffect(() => {
    if (artistNames.length === 0) return;
    setArtistMap(prev => {
      const next = { ...prev };
      for (const raw of artistNames) {
        if (next[raw] !== undefined) continue;
        const lower = raw.toLowerCase();
        const exact = artists.find(a => a.name?.toLowerCase() === lower);
        const partial = exact ?? artists.find(a =>
          a.name && (lower.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(lower)));
        next[raw] = partial?.artistId ?? UNASSIGNED;
      }
      return next;
    });
  }, [artistNames, artists]);

  const prepared = useMemo(() => {
    if (step !== 'preview') return [];
    const get = (r, k) => (mapping[k] ? (r[mapping[k]] ?? '').trim() : '');
    return rows.map((r, idx) => {
      const errs = [];
      if (kind === 'clients') {
        const name = get(r, 'name') || [get(r, 'first_name'), get(r, 'last_name')].filter(Boolean).join(' ');
        const email = normalizeEmail(get(r, 'email'));
        const phone = normalizePhone(get(r, 'phone'));
        if (!name) errs.push('missing name');
        if (email && !/^\S+@\S+\.\S+$/.test(email)) errs.push('invalid email');
        if (!email && !phone) errs.push('needs email or phone');
        return { line: idx + 2, errors: errs, payload: { name, email, phone, dob: parseDOB(get(r, 'dob'), dayFirst), notes: get(r, 'notes') } };
      }
      const name = get(r, 'client_name') || [get(r, 'client_first_name'), get(r, 'client_last_name')].filter(Boolean).join(' ');
      const email = normalizeEmail(get(r, 'client_email'));
      const phone = normalizePhone(get(r, 'client_phone'));
      const chosen = parseDateTime({ datetime: get(r, 'datetime'), date: get(r, 'date'), time: get(r, 'time') }, dayFirst);
      if (!name && !email && !phone) errs.push('needs client name, email or phone');
      if (email && !/^\S+@\S+\.\S+$/.test(email)) errs.push('invalid email');
      if (!chosen) errs.push('unparseable date/time');
      const artistName = get(r, 'artist_name');
      return {
        line: idx + 2, errors: errs,
        payload: {
          client_name: name, client_email: email, client_phone: phone,
          artist_id: artistName ? (artistMap[artistName] ?? UNASSIGNED) : UNASSIGNED,
          chosen_time: chosen ?? '', duration_minutes: parseDurationMinutes(get(r, 'duration_minutes')),
          design_details: get(r, 'design_details'), body_location: get(r, 'body_location'),
          notes: get(r, 'notes'), price: parsePrice(get(r, 'price')),
          status: normalizeStatus(get(r, 'status'), chosen),
        },
      };
    });
  }, [step, rows, mapping, kind, dayFirst, artistMap]);

  const validRows = prepared.filter(p => p.errors.length === 0);
  const invalidRows = prepared.filter(p => p.errors.length > 0);

  function handleFile(file) {
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const { headers: h, rows: r } = parseCSV(String(reader.result));
      if (h.length === 0 || r.length === 0) { setError('Could not read any rows from that file.'); return; }
      const guessedKind = suggestKind(h);
      setFileName(file.name);
      setHeaders(h);
      setRows(r);
      setKind(guessedKind);
      setMapping(suggestMapping(h, guessedKind, 'generic'));
      setPreset('generic');
      setStep('map');
    };
    reader.readAsText(file);
  }

  function applyPreset(p, k = kind) {
    setPreset(p);
    setDayFirst(PRESETS[p]?.dayFirst ?? true);
    setMapping(suggestMapping(headers, k, p));
  }

  async function runImport() {
    setStep('importing');
    setError('');
    setProgress(0);
    const total = { imported: 0, linked: 0, skipped: 0, errors: [] };
    try {
      for (let i = 0; i < validRows.length; i += IMPORT_CHUNK) {
        const chunk = validRows.slice(i, i + IMPORT_CHUNK).map(p => p.payload);
        const payload = kind === 'clients' ? { clients: chunk } : { appointments: chunk };
        const res = await importStudioData(payload);
        const section = kind === 'clients' ? res.clients : res.appointments;
        total.imported += section?.imported ?? 0;
        total.linked += section?.linked ?? 0;
        total.skipped += section?.skipped ?? 0;
        for (const e of res.errors ?? []) total.errors.push({ ...e, line: validRows[i + e.index]?.line });
        setProgress(Math.min(i + IMPORT_CHUNK, validRows.length));
      }
      invalidatePrefix('clients:');
      invalidatePrefix('home:');
      setResult(total);
      setStep('done');
    } catch (e) {
      setError(e.message);
      setStep('preview');
    }
  }

  function reset() {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setArtistMap({});
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {error && <div style={imp.error}>{error}</div>}

      {step === 'upload' && (
        <div
          style={imp.dropZone}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
          onClick={() => fileRef.current?.click()}
        >
          <span style={imp.dropTitle}>Drop a CSV file here, or click to browse</span>
          <span style={imp.dropSub}>Exports from Square Appointments, Acuity, Fresha or any spreadsheet saved as CSV.</span>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
        </div>
      )}

      {step === 'map' && (
        <>
          <div style={imp.subCard}>
            <div style={imp.subCardTitle}>{fileName} · {rows.length} row{rows.length !== 1 ? 's' : ''}</div>
            <div style={imp.controlRow}>
              <div style={imp.control}>
                <label style={imp.ctrlLabel}>This file contains</label>
                <div style={imp.segmented}>
                  {['clients', 'appointments'].map(k => (
                    <button key={k} style={{ ...imp.segBtn, ...(kind === k ? imp.segBtnActive : {}) }}
                      onClick={() => { setKind(k); setMapping(suggestMapping(headers, k, preset)); }}>
                      {k === 'clients' ? 'Clients' : 'Appointments'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={imp.control}>
                <label style={imp.ctrlLabel}>Source</label>
                <select style={imp.select} value={preset} onChange={e => applyPreset(e.target.value)}>
                  {Object.entries(PRESETS).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
                </select>
              </div>
              <div style={imp.control}>
                <label style={imp.ctrlLabel}>Date format</label>
                <div style={imp.segmented}>
                  <button style={{ ...imp.segBtn, ...(dayFirst ? imp.segBtnActive : {}) }} onClick={() => setDayFirst(true)}>DD/MM/YYYY</button>
                  <button style={{ ...imp.segBtn, ...(!dayFirst ? imp.segBtnActive : {}) }} onClick={() => setDayFirst(false)}>MM/DD/YYYY</button>
                </div>
              </div>
            </div>
          </div>

          <div style={imp.subCard}>
            <div style={imp.subCardTitle}>Map columns</div>
            <div style={imp.mapGrid}>
              {fields.map(f => (
                <div key={f.key} style={imp.mapRow}>
                  <span style={imp.mapField}>{f.label}{f.hint && <span style={imp.mapHint}> — {f.hint}</span>}</span>
                  <select style={imp.select} value={mapping[f.key] ?? ''}
                    onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value || undefined }))}>
                    <option value="">— not imported —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {kind === 'appointments' && artistNames.length > 0 && (
            <div style={imp.subCard}>
              <div style={imp.subCardTitle}>Match artists</div>
              <p style={imp.subCardDesc}>Match names found in the file to artists in your studio. Unmatched appointments import as unassigned.</p>
              <div style={imp.mapGrid}>
                {artistNames.map(raw => (
                  <div key={raw} style={imp.mapRow}>
                    <span style={imp.mapField}>{raw}</span>
                    <select style={imp.select} value={artistMap[raw] ?? UNASSIGNED}
                      onChange={e => setArtistMap(m => ({ ...m, [raw]: e.target.value }))}>
                      <option value={UNASSIGNED}>Leave unassigned</option>
                      {artists.map(a => <option key={a.artistId} value={a.artistId}>{a.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={imp.btnRow}>
            <button style={imp.btnGhost} onClick={reset}>Start over</button>
            <button style={imp.btnPrimary} onClick={() => setStep('preview')}>Preview import</button>
          </div>
        </>
      )}

      {step === 'preview' && (
        <>
          <div style={imp.statRow}>
            <div style={imp.statCard}>
              <span style={imp.statValue}>{validRows.length}</span>
              <span style={imp.statLabel}>Rows ready to import</span>
            </div>
            <div style={imp.statCard}>
              <span style={{ ...imp.statValue, color: invalidRows.length ? '#e86f6f' : 'var(--text)' }}>{invalidRows.length}</span>
              <span style={imp.statLabel}>Rows with problems (skipped)</span>
            </div>
          </div>

          {invalidRows.length > 0 && (
            <div style={imp.subCard}>
              <div style={imp.subCardTitle}>Problems</div>
              <div style={imp.problemList}>
                {invalidRows.slice(0, 20).map(p => (
                  <div key={p.line} style={imp.problemRow}>
                    <span style={imp.problemLine}>Line {p.line}</span>
                    <span style={imp.problemReason}>{p.errors.join(', ')}</span>
                  </div>
                ))}
                {invalidRows.length > 20 && <span style={imp.subCardDesc}>…and {invalidRows.length - 20} more</span>}
              </div>
            </div>
          )}

          <div style={imp.subCard}>
            <div style={imp.subCardTitle}>Preview</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={imp.table}>
                <thead><tr>{previewColumns(kind).map(c => <th key={c.key} style={imp.th}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {validRows.slice(0, 50).map(p => (
                    <tr key={p.line}>{previewColumns(kind).map(c => <td key={c.key} style={imp.td}>{c.render(p.payload)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            {validRows.length > 50 && <span style={imp.subCardDesc}>Showing first 50 of {validRows.length}</span>}
          </div>

          <div style={imp.btnRow}>
            <button style={imp.btnGhost} onClick={() => setStep('map')}>Back</button>
            <button style={{ ...imp.btnPrimary, ...(validRows.length === 0 ? imp.btnDisabled : {}) }}
              disabled={validRows.length === 0} onClick={runImport}>
              Import {validRows.length} row{validRows.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}

      {step === 'importing' && (
        <div style={imp.subCard}>
          <div style={imp.subCardTitle}>Importing…</div>
          <div style={imp.progressTrack}>
            <div style={{ ...imp.progressFill, width: `${Math.round((progress / Math.max(validRows.length, 1)) * 100)}%` }} />
          </div>
          <span style={imp.subCardDesc}>{Math.min(progress, validRows.length)} / {validRows.length} rows</span>
        </div>
      )}

      {step === 'done' && result && (
        <>
          <div style={imp.statRow}>
            <div style={imp.statCard}><span style={{ ...imp.statValue, color: '#4cc98a' }}>{result.imported}</span><span style={imp.statLabel}>Imported</span></div>
            <div style={imp.statCard}><span style={imp.statValue}>{result.linked}</span><span style={imp.statLabel}>Linked to existing app users</span></div>
            <div style={imp.statCard}><span style={imp.statValue}>{result.skipped}</span><span style={imp.statLabel}>Skipped (already imported)</span></div>
          </div>
          {result.errors.length > 0 && (
            <div style={imp.subCard}>
              <div style={imp.subCardTitle}>Rows the server could not import</div>
              <div style={imp.problemList}>
                {result.errors.slice(0, 20).map((e, i) => (
                  <div key={i} style={imp.problemRow}>
                    <span style={imp.problemLine}>{e.line ? `Line ${e.line}` : `Row ${e.index + 1}`}</span>
                    <span style={imp.problemReason}>{e.reason}</span>
                  </div>
                ))}
                {result.errors.length > 20 && <span style={imp.subCardDesc}>…and {result.errors.length - 20} more</span>}
              </div>
            </div>
          )}
          <div style={imp.btnRow}>
            <button style={imp.btnPrimary} onClick={reset}>Import another file</button>
          </div>
        </>
      )}
    </div>
  );
}

const imp = {
  error: { background: 'rgba(232,111,111,0.08)', border: '1px solid rgba(232,111,111,0.35)', borderRadius: 10, padding: '0.7rem 1rem', color: '#e86f6f', fontSize: '0.82rem' },
  dropZone: { border: '1.5px dashed var(--border)', borderRadius: 12, padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'var(--bg-base)' },
  dropTitle: { fontSize: '0.925rem', fontWeight: 600, color: 'var(--text)' },
  dropSub: { fontSize: '0.75rem', color: 'var(--text-faint)' },
  subCard: { background: 'var(--bg-base)', border: '1px solid var(--border-faint)', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  subCardTitle: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' },
  subCardDesc: { fontSize: '0.72rem', color: 'var(--text-faint)', margin: 0 },
  controlRow: { display: 'flex', gap: '1.25rem', flexWrap: 'wrap' },
  control: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  ctrlLabel: { fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' },
  segmented: { display: 'flex', gap: 3, background: 'var(--bg-chip)', borderRadius: 7, padding: 3 },
  segBtn: { background: 'transparent', border: 'none', borderRadius: 5, padding: '0.28rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' },
  segBtnActive: { background: 'var(--bg-card)', color: 'var(--text)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' },
  select: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: '0.78rem', padding: '0.32rem 0.55rem', minWidth: 170 },
  mapGrid: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  mapRow: { display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' },
  mapField: { fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 500 },
  mapHint: { fontSize: '0.7rem', color: 'var(--text-ghost)', fontWeight: 400 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' },
  statCard: { background: 'var(--bg-base)', border: '1px solid var(--border-faint)', borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  statValue: { fontSize: '2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 },
  statLabel: { fontSize: '0.72rem', color: 'var(--text-faint)', fontWeight: 500 },
  problemList: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  problemRow: { display: 'flex', gap: '0.75rem', alignItems: 'baseline' },
  problemLine: { fontSize: '0.75rem', fontWeight: 600, color: '#e86f6f', minWidth: 64, flexShrink: 0 },
  problemReason: { fontSize: '0.78rem', color: 'var(--text-secondary)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0.3rem 0.55rem', borderBottom: '1px solid var(--border-faint)', whiteSpace: 'nowrap' },
  td: { fontSize: '0.78rem', color: 'var(--text-dim)', padding: '0.3rem 0.55rem', borderBottom: '1px solid var(--border-faint)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  btnRow: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' },
  btnGhost: { background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, padding: '0.45rem 0.9rem', cursor: 'pointer' },
  btnPrimary: { background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'var(--accent-contrast, #111)', fontSize: '0.8rem', fontWeight: 700, padding: '0.45rem 1rem', cursor: 'pointer' },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  progressTrack: { height: 7, background: 'var(--bg-chip)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent)', transition: 'width 0.2s' },
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [aftercareInstructions, setAftercareInstructions] = useState('');
  const [widgetBgColor, setWidgetBgColor] = useState('#111111');
  const [widgetAccentColor, setWidgetAccentColor] = useState('#f5ecd9');
  const [timezone, setTimezone] = useState('Australia/Sydney');
  const [walkinCut, setWalkinCut] = useState('0');
  const [personalCut, setPersonalCut] = useState('0');
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
        const [account, { data: { session } }, hoursData, stationsData, templateData] = await Promise.all([
          getMyStudioAccount(),
          getSupabase().auth.getSession(),
          getStudioHours().catch(() => ({ hours: [] })),
          getStations().catch(() => ({ stations: [] })),
          listConsentTemplates().catch(() => ({ templates: [] })),
        ]);
        setName(account.studio?.name ?? '');
        setAddress(account.studio?.address_string ?? '');
        setAftercareInstructions(account.studio?.aftercare_instructions ?? '');
        setWidgetBgColor(account.studio?.widget_bg_color || '#111111');
        setWidgetAccentColor(account.studio?.widget_accent_color || '#f5ecd9');
        setTimezone(account.studio?.timezone || 'Australia/Sydney');
        setWalkinCut(String(account.studio?.walkin_cut_percent ?? account.studio?.studio_cut_percent ?? 0));
        setPersonalCut(String(account.studio?.personal_cut_percent ?? account.studio?.studio_cut_percent ?? 0));
        setEmail(session?.user?.email ?? '');
        setStudioId(account.studio_id);
        setWalkInUrl(window.location.origin + '/studio-booking?s=' + account.studio_id);
        if (hoursData.hours?.length === 7) setHours(hoursData.hours);
        setStations(stationsData.stations ?? []);
        setConsentTemplates(templateData.templates ?? []);
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
      await updateStudioProfile(name.trim(), address.trim(), widgetBgColor, widgetAccentColor, isNaN(wc) ? 0 : wc, isNaN(pc) ? 0 : pc, aftercareInstructions, timezone);
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
                      value={value}
                      onChange={e => set(e.target.value)}
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

        {/* ── Data ── */}
        <p style={{ ...s.groupLabel, marginTop: '0.5rem' }}>Data</p>

        <section style={{ ...s.card, gridColumn: '1 / -1' }}>
          <h2 style={s.sectionTitle}>Import data</h2>
          <p style={s.sectionDesc}>Bring clients and appointment history over from another booking system or spreadsheet.</p>
          <ImportSection />
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
