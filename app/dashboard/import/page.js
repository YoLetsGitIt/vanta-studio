'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { parseCSV } from '@/lib/csv';
import { useLanguage } from '@/lib/i18n';
import {
  CLIENT_FIELDS,
  APPOINTMENT_FIELDS,
  PRESETS,
  suggestMapping,
  suggestKind,
  normalizeEmail,
  normalizePhone,
  parsePrice,
  parseDateTime,
  parseDOB,
  normalizeStatus,
  parseDurationMinutes,
} from '@/lib/importPresets';
import { importStudioData, getStudioArtists } from '@/lib/api';
import { invalidatePrefix } from '@/lib/cache';

const CHUNK_SIZE = 200;
const UNASSIGNED = '';

export default function ImportPage() {
  const { t } = useLanguage();
  const [step, setStep] = useState('upload'); // upload | map | preview | importing | done
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

  // ── Step 1: upload ──────────────────────────────────────────────────────────

  function handleFile(file) {
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const { headers: h, rows: r } = parseCSV(String(reader.result));
      if (h.length === 0 || r.length === 0) {
        setError('Could not read any rows from that file.');
        return;
      }
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

  // ── Distinct artist names (appointments) ────────────────────────────────────

  const artistNames = useMemo(() => {
    if (kind !== 'appointments' || !mapping.artist_name) return [];
    return [...new Set(rows.map(r => (r[mapping.artist_name] ?? '').trim()).filter(Boolean))];
  }, [kind, mapping.artist_name, rows]);

  // Auto-match artist names when the column or artist list changes.
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

  // ── Step 3: build + validate normalized rows ────────────────────────────────

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
        return {
          line: idx + 2,
          errors: errs,
          payload: { name, email, phone, dob: parseDOB(get(r, 'dob'), dayFirst), notes: get(r, 'notes') },
        };
      }

      const name = get(r, 'client_name') || [get(r, 'client_first_name'), get(r, 'client_last_name')].filter(Boolean).join(' ');
      const email = normalizeEmail(get(r, 'client_email'));
      const phone = normalizePhone(get(r, 'client_phone'));
      const chosen = parseDateTime(
        { datetime: get(r, 'datetime'), date: get(r, 'date'), time: get(r, 'time') },
        dayFirst,
      );
      if (!name && !email && !phone) errs.push('needs client name, email or phone');
      if (email && !/^\S+@\S+\.\S+$/.test(email)) errs.push('invalid email');
      if (!chosen) errs.push('unparseable date/time');
      const artistName = get(r, 'artist_name');
      return {
        line: idx + 2,
        errors: errs,
        payload: {
          client_name: name,
          client_email: email,
          client_phone: phone,
          artist_id: artistName ? (artistMap[artistName] ?? UNASSIGNED) : UNASSIGNED,
          chosen_time: chosen ?? '',
          duration_minutes: parseDurationMinutes(get(r, 'duration_minutes')),
          design_details: get(r, 'design_details'),
          body_location: get(r, 'body_location'),
          notes: get(r, 'notes'),
          price: parsePrice(get(r, 'price')),
          status: normalizeStatus(get(r, 'status'), chosen),
        },
      };
    });
  }, [step, rows, mapping, kind, dayFirst, artistMap]);

  const validRows = prepared.filter(p => p.errors.length === 0);
  const invalidRows = prepared.filter(p => p.errors.length > 0);

  // ── Step 4: import ──────────────────────────────────────────────────────────

  async function runImport() {
    setStep('importing');
    setError('');
    setProgress(0);
    const total = { imported: 0, linked: 0, skipped: 0, errors: [] };
    try {
      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + CHUNK_SIZE).map(p => p.payload);
        const payload = kind === 'clients' ? { clients: chunk } : { appointments: chunk };
        const res = await importStudioData(payload);
        const section = kind === 'clients' ? res.clients : res.appointments;
        total.imported += section?.imported ?? 0;
        total.linked += section?.linked ?? 0;
        total.skipped += section?.skipped ?? 0;
        for (const e of res.errors ?? []) {
          total.errors.push({ ...e, line: validRows[i + e.index]?.line });
        }
        setProgress(Math.min(i + CHUNK_SIZE, validRows.length));
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>{t('import_title')}</h1>
        <p style={s.sub}>{t('import_desc')}</p>
      </div>

      <div style={s.body}>
        {error && <div style={s.error}>{error}</div>}

        {step === 'upload' && (
          <div
            style={s.dropZone}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
          >
            <span style={s.dropTitle}>{t('import_drop')}</span>
            <span style={s.dropSub}>
              Exports from Square Appointments, Acuity, Fresha or any spreadsheet saved as CSV.
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        {step === 'map' && (
          <>
            <div style={s.card}>
              <div style={s.cardTitle}>{fileName} · {rows.length} row{rows.length !== 1 ? 's' : ''}</div>
              <div style={s.controlRow}>
                <div style={s.control}>
                  <label style={s.label}>This file contains</label>
                  <div style={s.segmented}>
                    {['clients', 'appointments'].map(k => (
                      <button
                        key={k}
                        style={{ ...s.segBtn, ...(kind === k ? s.segBtnActive : {}) }}
                        onClick={() => { setKind(k); setMapping(suggestMapping(headers, k, preset)); }}
                      >
                        {k === 'clients' ? 'Clients' : 'Appointments'}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={s.control}>
                  <label style={s.label}>{t('import_source')}</label>
                  <select style={s.select} value={preset} onChange={e => applyPreset(e.target.value)}>
                    {Object.entries(PRESETS).map(([key, p]) => (
                      <option key={key} value={key}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div style={s.control}>
                  <label style={s.label}>{t('import_date_format')}</label>
                  <div style={s.segmented}>
                    <button style={{ ...s.segBtn, ...(dayFirst ? s.segBtnActive : {}) }} onClick={() => setDayFirst(true)}>DD/MM/YYYY</button>
                    <button style={{ ...s.segBtn, ...(!dayFirst ? s.segBtnActive : {}) }} onClick={() => setDayFirst(false)}>MM/DD/YYYY</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>{t('import_map_cols')}</div>
              <div style={s.mapGrid}>
                {fields.map(f => (
                  <div key={f.key} style={s.mapRow}>
                    <span style={s.mapField}>
                      {f.label}
                      {f.hint && <span style={s.mapHint}> — {f.hint}</span>}
                    </span>
                    <select
                      style={s.select}
                      value={mapping[f.key] ?? ''}
                      onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value || undefined }))}
                    >
                      <option value="">— not imported —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {kind === 'appointments' && artistNames.length > 0 && (
              <div style={s.card}>
                <div style={s.cardTitle}>{t('import_match_artists')}</div>
                <p style={s.cardSub}>Match names found in the file to artists in your studio. Unmatched appointments import as unassigned.</p>
                <div style={s.mapGrid}>
                  {artistNames.map(raw => (
                    <div key={raw} style={s.mapRow}>
                      <span style={s.mapField}>{raw}</span>
                      <select
                        style={s.select}
                        value={artistMap[raw] ?? UNASSIGNED}
                        onChange={e => setArtistMap(m => ({ ...m, [raw]: e.target.value }))}
                      >
                        <option value={UNASSIGNED}>{t('import_unassigned')}</option>
                        {artists.map(a => <option key={a.artistId} value={a.artistId}>{a.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={s.btnRow}>
              <button style={s.btnGhost} onClick={reset}>{t('import_start_over')}</button>
              <button style={s.btnPrimary} onClick={() => setStep('preview')}>{t('import_preview')}</button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div style={s.statRow}>
              <div style={s.statCard}>
                <span style={s.statValue}>{validRows.length}</span>
                <span style={s.statLabel}>{t('import_rows_ready')}</span>
              </div>
              <div style={s.statCard}>
                <span style={{ ...s.statValue, color: invalidRows.length ? '#e86f6f' : 'var(--text)' }}>{invalidRows.length}</span>
                <span style={s.statLabel}>{t('import_rows_problems')}</span>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <div style={s.card}>
                <div style={s.cardTitle}>Problems</div>
                <div style={s.problemList}>
                  {invalidRows.slice(0, 20).map(p => (
                    <div key={p.line} style={s.problemRow}>
                      <span style={s.problemLine}>Line {p.line}</span>
                      <span style={s.problemReason}>{p.errors.join(', ')}</span>
                    </div>
                  ))}
                  {invalidRows.length > 20 && <span style={s.cardSub}>…and {invalidRows.length - 20} more</span>}
                </div>
              </div>
            )}

            <div style={s.card}>
              <div style={s.cardTitle}>Preview</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {previewColumns(kind).map(c => <th key={c.key} style={s.th}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 50).map(p => (
                      <tr key={p.line}>
                        {previewColumns(kind).map(c => (
                          <td key={c.key} style={s.td}>{c.render(p.payload)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validRows.length > 50 && <span style={s.cardSub}>Showing first 50 of {validRows.length}</span>}
            </div>

            <div style={s.btnRow}>
              <button style={s.btnGhost} onClick={() => setStep('map')}>{t('back')}</button>
              <button
                style={{ ...s.btnPrimary, ...(validRows.length === 0 ? s.btnDisabled : {}) }}
                disabled={validRows.length === 0}
                onClick={runImport}
              >
                {t('import_import_btn')} {validRows.length} row{validRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {step === 'importing' && (
          <div style={s.card}>
            <div style={s.cardTitle}>{t('import_importing')}</div>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${Math.round((progress / Math.max(validRows.length, 1)) * 100)}%` }} />
            </div>
            <span style={s.cardSub}>{Math.min(progress, validRows.length)} / {validRows.length} rows</span>
          </div>
        )}

        {step === 'done' && result && (
          <>
            <div style={s.statRow}>
              <div style={s.statCard}>
                <span style={{ ...s.statValue, color: '#4cc98a' }}>{result.imported}</span>
                <span style={s.statLabel}>{t('import_imported')}</span>
              </div>
              <div style={s.statCard}>
                <span style={s.statValue}>{result.linked}</span>
                <span style={s.statLabel}>{t('import_linked')}</span>
              </div>
              <div style={s.statCard}>
                <span style={s.statValue}>{result.skipped}</span>
                <span style={s.statLabel}>{t('import_skipped')}</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div style={s.card}>
                <div style={s.cardTitle}>Rows the server could not import</div>
                <div style={s.problemList}>
                  {result.errors.slice(0, 20).map((e, i) => (
                    <div key={i} style={s.problemRow}>
                      <span style={s.problemLine}>{e.line ? `Line ${e.line}` : `Row ${e.index + 1}`}</span>
                      <span style={s.problemReason}>{e.reason}</span>
                    </div>
                  ))}
                  {result.errors.length > 20 && <span style={s.cardSub}>…and {result.errors.length - 20} more</span>}
                </div>
              </div>
            )}

            <div style={s.btnRow}>
              <button style={s.btnPrimary} onClick={reset}>Import another file</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function previewColumns(kind) {
  if (kind === 'clients') {
    return [
      { key: 'name',  label: 'Name',  render: p => p.name },
      { key: 'email', label: 'Email', render: p => p.email || '—' },
      { key: 'phone', label: 'Phone', render: p => p.phone || '—' },
      { key: 'dob',   label: 'DOB',   render: p => p.dob || '—' },
      { key: 'notes', label: 'Notes', render: p => p.notes || '—' },
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

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '1.75rem 2rem 1.25rem', borderBottom: '1px solid var(--border-faint)', flexShrink: 0 },
  title: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', margin: 0 },
  sub: { fontSize: '0.8rem', color: 'var(--text-faint)', marginTop: '0.2rem', marginBottom: 0 },
  body: { flex: 1, overflowY: 'auto', padding: '1.25rem 2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },

  error: {
    background: 'rgba(232,111,111,0.08)', border: '1px solid rgba(232,111,111,0.35)',
    borderRadius: 10, padding: '0.7rem 1rem', color: '#e86f6f', fontSize: '0.82rem',
  },

  dropZone: {
    border: '1.5px dashed var(--border)', borderRadius: 12, padding: '3.5rem 2rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
    cursor: 'pointer', background: 'var(--bg-card)',
  },
  dropTitle: { fontSize: '0.925rem', fontWeight: 600, color: 'var(--text)' },
  dropSub: { fontSize: '0.75rem', color: 'var(--text-faint)' },

  card: {
    background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12,
    padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  cardTitle: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' },
  cardSub: { fontSize: '0.72rem', color: 'var(--text-faint)', margin: 0 },

  controlRow: { display: 'flex', gap: '1.5rem', flexWrap: 'wrap' },
  control: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  label: { fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' },
  segmented: { display: 'flex', gap: 4, background: 'var(--bg-chip)', borderRadius: 8, padding: 3 },
  segBtn: {
    background: 'transparent', border: 'none', borderRadius: 6, padding: '0.3rem 0.7rem',
    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer',
  },
  segBtnActive: { background: 'var(--bg-card)', color: 'var(--text)', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' },
  select: {
    background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text)', fontSize: '0.78rem', padding: '0.35rem 0.6rem', minWidth: 180,
  },

  mapGrid: { display: 'flex', flexDirection: 'column', gap: '0.45rem' },
  mapRow: { display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' },
  mapField: { fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 500 },
  mapHint: { fontSize: '0.7rem', color: 'var(--text-ghost)', fontWeight: 400 },

  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' },
  statCard: {
    background: 'var(--bg-card)', border: '1px solid var(--border-faint)', borderRadius: 12,
    padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem',
  },
  statValue: { fontSize: '2.2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 },
  statLabel: { fontSize: '0.75rem', color: 'var(--text-faint)', fontWeight: 500 },

  problemList: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  problemRow: { display: 'flex', gap: '0.85rem', alignItems: 'baseline' },
  problemLine: { fontSize: '0.75rem', fontWeight: 600, color: '#e86f6f', minWidth: 64, flexShrink: 0 },
  problemReason: { fontSize: '0.78rem', color: 'var(--text-secondary)' },

  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)',
    padding: '0.35rem 0.6rem', borderBottom: '1px solid var(--border-faint)', whiteSpace: 'nowrap',
  },
  td: {
    fontSize: '0.78rem', color: 'var(--text-dim)', padding: '0.35rem 0.6rem',
    borderBottom: '1px solid var(--border-faint)', maxWidth: 220,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  btnRow: { display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingBottom: '1rem' },
  btnGhost: {
    background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, padding: '0.5rem 1rem', cursor: 'pointer',
  },
  btnPrimary: {
    background: 'var(--accent)', border: 'none', borderRadius: 8,
    color: 'var(--accent-contrast, #111)', fontSize: '0.8rem', fontWeight: 700, padding: '0.5rem 1.1rem', cursor: 'pointer',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },

  progressTrack: { height: 8, background: 'var(--bg-chip)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent)', transition: 'width 0.2s' },
};
