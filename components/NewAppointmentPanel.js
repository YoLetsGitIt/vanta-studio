'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  getStudioArtists,
  getStations,
  getAvailableStations,
  getStudioHours,
  listStudioBookings,
  createManualBooking,
} from '@/lib/api';
import { invalidatePrefix } from '@/lib/cache';

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hr',   value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr',   value: 120 },
  { label: '2.5 hr', value: 150 },
  { label: '3 hr',   value: 180 },
  { label: '4 hr',   value: 240 },
  { label: '5 hr',   value: 300 },
  { label: '6 hr',   value: 360 },
  { label: '8 hr',   value: 480 },
];

function todayStr() {
  return new Date().toLocaleDateString('en-CA');
}

function formatDob(dob) {
  if (!dob) return null;
  return new Date(dob + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nextHalfHour() {
  const d = new Date();
  d.setMinutes(d.getMinutes() >= 30 ? 60 : 30, 0, 0);
  return d.toTimeString().slice(0, 5);
}

const selectStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 8, padding: '0.6rem 0.85rem',
  fontSize: '0.875rem', color: 'var(--text)', outline: 'none',
  width: '100%', boxSizing: 'border-box', colorScheme: 'auto', cursor: 'pointer',
};

// Converts "HH:MM" (24h) ↔ {h12, minute, ampm} for display
function parse24(val) {
  const [hStr, mStr] = (val || '09:00').split(':');
  const h24 = parseInt(hStr, 10);
  return {
    h12: h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24,
    minute: mStr || '00',
    ampm: h24 >= 12 ? 'PM' : 'AM',
  };
}

function to24(h12, minute, ampm) {
  let h = h12 % 12;
  if (ampm === 'PM') h += 12;
  return String(h).padStart(2, '0') + ':' + minute;
}

function TimeSelect({ value, onChange }) {
  const { h12, minute, ampm } = parse24(value);
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = ['00', '15', '30', '45'];
  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
      <select
        style={{ ...selectStyle, flex: 1 }}
        value={h12}
        onChange={e => onChange(to24(Number(e.target.value), minute, ampm))}
      >
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ color: 'var(--text-ghost)', fontSize: '1rem', flexShrink: 0 }}>:</span>
      <select
        style={{ ...selectStyle, flex: 1 }}
        value={minute}
        onChange={e => onChange(to24(h12, e.target.value, ampm))}
      >
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select
        style={{ ...selectStyle, flex: 1 }}
        value={ampm}
        onChange={e => onChange(to24(h12, minute, e.target.value))}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function NewAppointmentPanel({ open, onClose, onCreated }) {
  // ── Client
  const [clientMode, setClientMode] = useState('search');
  const [clientSearch, setClientSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientDob, setClientDob] = useState('');

  // ── Booking
  const [artistId, setArtistId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMins, setDurationMins] = useState(60);
  const [stationId, setStationId] = useState('');

  // ── Pricing
  const [finalPrice, setFinalPrice] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  // ── Notes
  const [notes, setNotes] = useState('');

  // ── Remote data
  const [artists, setArtists] = useState([]);
  const [allStations, setAllStations] = useState([]);
  const [availableStations, setAvailableStations] = useState(null);
  const [studioHours, setStudioHours] = useState([]);
  const [pastBookings, setPastBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setBookingDate(todayStr());
    setStartTime(nextHalfHour());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getStudioArtists('approved').catch(() => ({ artists: [] })),
      getStations().catch(() => ({ stations: [] })),
      getStudioHours().catch(() => ({ hours: [] })),
      listStudioBookings('').catch(() => ({ bookings: [] })),
    ]).then(([artistsData, stationsData, hoursData, bookingsData]) => {
      if (cancelled) return;
      const a = artistsData.artists ?? [];
      setArtists(a);
      setAllStations((stationsData.stations ?? []).filter(s => s.is_active !== false));
      setStudioHours(hoursData.hours ?? []);
      setPastBookings(bookingsData.bookings ?? []);
      // No auto-selection — user must pick an artist
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload available stations whenever the date changes
  useEffect(() => {
    if (!bookingDate) { setAvailableStations(null); setStationId(''); return; }
    let cancelled = false;
    setStationsLoading(true);
    setStationId('');
    getAvailableStations(bookingDate)
      .then(data => { if (!cancelled) setAvailableStations(data.stations ?? []); })
      .catch(() => { if (!cancelled) setAvailableStations(allStations); })
      .finally(() => { if (!cancelled) setStationsLoading(false); });
    return () => { cancelled = true; };
  }, [bookingDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Past client search
  const pastClients = useMemo(() => {
    const map = new Map();
    for (const b of pastBookings) {
      const key = b.requester_email || b.requester_name;
      if (key && !map.has(key)) {
        map.set(key, {
          name: b.requester_name || '',
          email: b.requester_email || '',
          phone: b.requester_phone || '',
          dob: b.dob || '',
        });
      }
    }
    return Array.from(map.values());
  }, [pastBookings]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase();
    if (!q) return [];
    return pastClients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    ).slice(0, 6);
  }, [clientSearch, pastClients]);

  function pickClient(c) {
    const parts = c.name.trim().split(/\s+/);
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' '));
    setClientEmail(c.email || '');
    setClientPhone(c.phone || '');
    setClientDob(c.dob || '');
    setClientSearch('');
    setShowDropdown(false);
    setSelectedClient(c);
  }

  function clearSelectedClient() {
    setSelectedClient(null);
    setFirstName(''); setLastName(''); setClientEmail(''); setClientPhone(''); setClientDob('');
    setClientSearch('');
  }

  // Studio hours for selected date
  const dayHours = useMemo(() => {
    if (!bookingDate || !studioHours.length) return null;
    const d = new Date(bookingDate + 'T12:00:00');
    const studioDay = (d.getDay() + 6) % 7; // JS Sun=0 → studio Mon=0…Sun=6
    // Query orders by day_of_week ASC, so index is reliable; find is a safe fallback
    return studioHours[studioDay]
      ?? studioHours.find(h => h.day_of_week === studioDay)
      ?? null;
  }, [bookingDate, studioHours]);

  const timeError = useMemo(() => {
    if (!studioHours.length || !dayHours) return null;
    if (dayHours.is_closed) return 'Studio is closed on this day.';
    if (!startTime) return null;
    const [sh, sm] = startTime.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = startMins + durationMins;
    const [oh, om] = dayHours.open_time.split(':').map(Number);
    const [ch, cm] = dayHours.close_time.split(':').map(Number);
    if (startMins < oh * 60 + om) return `Studio opens at ${dayHours.open_time} — start time is too early.`;
    if (endMins > ch * 60 + cm) return `Appointment ends after closing time (${dayHours.close_time}).`;
    return null;
  }, [studioHours, dayHours, startTime, durationMins]);

  const clientName = clientMode === 'search'
    ? (selectedClient?.name || '')
    : [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const canSubmit = !!clientName && !!artistId && !!bookingDate && !!startTime && !timeError;

  function resetForm() {
    setClientMode('search');
    setClientSearch('');
    setSelectedClient(null);
    setFirstName(''); setLastName(''); setClientEmail(''); setClientPhone(''); setClientDob('');
    setArtistId('');
    setBookingDate(todayStr());
    setStartTime(nextHalfHour());
    setDurationMins(60);
    setStationId('');
    setFinalPrice(''); setDepositAmount('');
    setNotes(''); setError('');
    setAvailableStations(null);
  }

  function handleClose() { resetForm(); onClose(); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!clientName) { setError("Client name is required."); return; }
    if (!artistId) { setError('Please select an artist.'); return; }
    if (!bookingDate || !startTime) { setError('Please set a date and start time.'); return; }
    if (timeError) { setError(timeError); return; }
    setSaving(true); setError('');
    try {
      const chosenTime = new Date(`${bookingDate}T${startTime}:00`).toISOString();
      const fp = parseFloat(finalPrice) || 0;
      const da = parseFloat(depositAmount) || 0;
      const body = {
        artist_id: artistId,
        requester_name: clientName,
        chosen_time: chosenTime,
        duration_minutes: durationMins,
        deposit_required: da > 0,
      };
      if (clientEmail.trim()) body.requester_email = clientEmail.trim();
      if (clientPhone.trim()) body.requester_phone = clientPhone.trim();
      if (clientDob.trim()) body.dob = clientDob.trim();
      if (stationId) body.station_id = stationId;
      if (fp > 0) body.estimated_quote = fp;
      if (da > 0) body.deposit_amount = da;
      if (notes.trim()) body.notes = notes.trim();
      await createManualBooking(body);
      invalidatePrefix('bookings:');
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        resetForm();
        onCreated?.();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        onClick={handleClose}
        style={{ ...bd.backdrop, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      <div style={{ ...bd.panel, transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

        <div style={bd.header}>
          <span style={bd.title}>New Appointment</span>
          <button onClick={handleClose} style={bd.closeBtn} aria-label="Close">✕</button>
        </div>

        {loading ? (
          <div style={bd.loadingWrap}><div style={bd.loadingDot} /></div>
        ) : (
          <form onSubmit={handleSubmit} style={bd.form}>

            {/* ── ARTIST ── */}
            {artists.length > 0 && (
              <div style={bd.section}>
                <p style={bd.sectionLabel}>Artist</p>
                <select style={bd.select} value={artistId} onChange={e => setArtistId(e.target.value)} required>
                  <option value="">Select artist…</option>
                  {artists.map(a => (
                    <option key={a.artistId ?? a.artist_id ?? a.id} value={a.artistId ?? a.artist_id ?? a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── CLIENT ── */}
            <div style={bd.section}>
              <p style={bd.sectionLabel}>Client</p>

              <div style={bd.modeTabs}>
                <button
                  type="button"
                  style={{ ...bd.modeTab, ...(clientMode === 'search' ? bd.modeTabActive : {}) }}
                  onClick={() => { setClientMode('search'); setFirstName(''); setLastName(''); setClientEmail(''); setClientPhone(''); }}
                >
                  Search existing
                </button>
                <button
                  type="button"
                  style={{ ...bd.modeTab, ...(clientMode === 'manual' ? bd.modeTabActive : {}) }}
                  onClick={() => { setClientMode('manual'); setSelectedClient(null); }}
                >
                  New client
                </button>
              </div>

              {clientMode === 'search' ? (
                selectedClient ? (
                  <div style={bd.selectedClientCard}>
                    <div style={{ minWidth: 0 }}>
                      <span style={bd.selectedClientName}>{selectedClient.name}</span>
                      <span style={bd.selectedClientSub}>
                        {[selectedClient.email, selectedClient.phone, selectedClient.dob ? formatDob(selectedClient.dob) : null].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <button type="button" style={bd.deselectBtn} onClick={clearSelectedClient} title="Remove">✕</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      style={bd.input}
                      placeholder="Search by name, email or phone…"
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      autoComplete="off"
                    />
                    {showDropdown && filteredClients.length > 0 && (
                      <div style={bd.dropdown}>
                        {filteredClients.map((c, i) => (
                          <button key={i} type="button" style={bd.dropdownItem} onMouseDown={() => pickClient(c)}>
                            <span style={bd.dropdownName}>{c.name}</span>
                            <span style={bd.dropdownSub}>{[c.email, c.phone].filter(Boolean).join(' · ')}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {clientSearch && filteredClients.length === 0 && (
                      <div style={bd.noResults}>
                        No matches —{' '}
                        <button type="button" style={bd.linkBtn} onClick={() => setClientMode('manual')}>
                          enter manually
                        </button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <>
                  <div style={bd.fieldRow}>
                    <div style={bd.field}>
                      <label style={bd.label}>First name</label>
                      <input
                        style={bd.input}
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="First"
                        autoFocus
                      />
                    </div>
                    <div style={bd.field}>
                      <label style={bd.label}>Last name</label>
                      <input
                        style={bd.input}
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="Last"
                      />
                    </div>
                  </div>
                  <div style={bd.field}>
                    <label style={bd.label}>Date of birth</label>
                    <input
                      style={{ ...bd.input, colorScheme: 'dark' }}
                      type="date"
                      value={clientDob}
                      onChange={e => setClientDob(e.target.value)}
                    />
                  </div>
                  <div style={bd.fieldRow}>
                    <div style={bd.field}>
                      <label style={bd.label}>Email</label>
                      <input
                        style={bd.input}
                        type="email"
                        value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div style={bd.field}>
                      <label style={bd.label}>Phone</label>
                      <input
                        style={bd.input}
                        type="tel"
                        value={clientPhone}
                        onChange={e => setClientPhone(e.target.value)}
                        placeholder="+1 555 0100"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── BOOKING DETAILS ── */}
            <div style={bd.section}>
              <p style={bd.sectionLabel}>Booking Details</p>

              <div style={bd.field}>
                <label style={bd.label}>Date</label>
                <input
                  style={bd.input}
                  type="date"
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  required
                />
              </div>

              <div style={bd.field}>
                <label style={bd.label}>Start time</label>
                <TimeSelect value={startTime} onChange={setStartTime} />
              </div>

              <div style={bd.field}>
                <label style={bd.label}>Duration</label>
                <select style={bd.select} value={durationMins} onChange={e => setDurationMins(Number(e.target.value))}>
                  {DURATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {timeError ? (
                <div style={bd.timeWarning}>
                  <span style={bd.timeWarningIcon}>⚠</span>
                  {timeError}
                </div>
              ) : dayHours && !dayHours.is_closed ? (
                <p style={bd.hint}>Studio open {dayHours.open_time} – {dayHours.close_time}</p>
              ) : bookingDate && !studioHours.length ? (
                <p style={bd.hint}>Save studio hours in Settings to enable time validation.</p>
              ) : null}
            </div>

            {/* ── STATION — revealed after date + time + duration are set ── */}
            {bookingDate && startTime && allStations.length > 0 && (
              <div style={{ ...bd.section, opacity: timeError ? 0.35 : 1, pointerEvents: timeError ? 'none' : 'auto' }}>
                <p style={bd.sectionLabel}>Station</p>
                {stationsLoading ? (
                  <p style={bd.hint}>Checking availability…</p>
                ) : (
                  <>
                    <select style={bd.select} value={stationId} onChange={e => setStationId(e.target.value)}>
                      <option value="">No station</option>
                      {(availableStations ?? allStations).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {availableStations !== null && availableStations.length === 0 && (
                      <p style={bd.inlineError}>No stations available on this date.</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── PRICING ── */}
            <div style={bd.section}>
              <p style={bd.sectionLabel}>Pricing</p>
              <div style={bd.fieldRow}>
                <div style={bd.field}>
                  <label style={bd.label}>Final price</label>
                  <div style={bd.prefixWrap}>
                    <span style={bd.prefix}>$</span>
                    <input
                      style={{ ...bd.input, paddingLeft: '1.75rem' }}
                      type="number" min="0" step="0.01"
                      value={finalPrice}
                      onChange={e => setFinalPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div style={bd.field}>
                  <label style={bd.label}>Deposit</label>
                  <div style={bd.prefixWrap}>
                    <span style={bd.prefix}>$</span>
                    <input
                      style={{ ...bd.input, paddingLeft: '1.75rem' }}
                      type="number" min="0" step="0.01"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── NOTES ── */}
            <div style={{ ...bd.section, borderBottom: 'none', marginBottom: 0 }}>
              <p style={bd.sectionLabel}>Notes</p>
              <textarea
                style={{ ...bd.input, minHeight: 72, resize: 'vertical' }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes…"
              />
            </div>

            {error && <p style={bd.errorText}>{error}</p>}

            <button
              type="submit"
              style={{ ...bd.submitBtn, opacity: saving ? 0.6 : 1, background: saved ? '#4cc98a' : bd.submitBtn.background, color: saved ? '#0b0f16' : bd.submitBtn.color }}
              disabled={saving || saved}
            >
              {saved ? 'Appointment created ✓' : saving ? 'Creating…' : 'Create Appointment'}
            </button>

          </form>
        )}
      </div>
    </>
  );
}

const bd = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 40,
    background: 'rgba(0,0,0,0.5)',
    transition: 'opacity 0.2s',
  },
  panel: {
    position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 41,
    width: 460, maxWidth: '100vw',
    background: 'var(--bg-sidebar)',
    borderLeft: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column',
    transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  title: { fontSize: '1rem', fontWeight: 700, color: 'var(--text)' },
  closeBtn: {
    background: 'var(--bg-chip)', border: 'none', borderRadius: 6,
    width: 28, height: 28, color: 'var(--text-muted)',
    fontSize: '0.75rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  loadingWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loadingDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--bg-chip)' },
  form: {
    flex: 1, overflowY: 'auto',
    display: 'flex', flexDirection: 'column', gap: 0,
    padding: '1.25rem 1.5rem 2rem',
  },
  section: {
    display: 'flex', flexDirection: 'column', gap: '0.65rem',
    paddingBottom: '1.25rem',
    marginBottom: '1.25rem',
    borderBottom: '1px solid var(--border-faint)',
  },
  sectionLabel: {
    margin: 0, fontSize: '0.68rem', fontWeight: 700,
    color: 'var(--text-ghost)', letterSpacing: '0.1em', textTransform: 'uppercase',
  },
  modeTabs: {
    display: 'flex',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-faint)',
    borderRadius: 9, padding: 3, gap: 3,
  },
  modeTab: {
    flex: 1, background: 'none', border: 'none', borderRadius: 7,
    padding: '0.45rem 0.75rem',
    fontSize: '0.82rem', fontWeight: 500,
    color: 'var(--text-faint)', cursor: 'pointer',
  },
  modeTabActive: {
    background: 'var(--bg-chip)',
    color: 'var(--text)', fontWeight: 600,
  },
  fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  label: { fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 8, padding: '0.6rem 0.85rem',
    fontSize: '0.875rem', color: 'var(--text)', outline: 'none',
    width: '100%', boxSizing: 'border-box', colorScheme: 'auto',
  },
  select: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 8, padding: '0.6rem 0.85rem',
    fontSize: '0.875rem', color: 'var(--text)', outline: 'none',
    width: '100%', boxSizing: 'border-box', colorScheme: 'auto', cursor: 'pointer',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
    background: 'var(--bg-modal)', border: '1px solid var(--border)',
    borderRadius: 8, overflow: 'hidden', marginTop: 4,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  dropdownItem: {
    display: 'flex', flexDirection: 'column', gap: 2,
    width: '100%', textAlign: 'left', background: 'none', border: 'none',
    padding: '0.65rem 0.85rem', cursor: 'pointer',
    borderBottom: '1px solid var(--border-faint)',
  },
  dropdownName: { fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 },
  dropdownSub: { fontSize: '0.75rem', color: 'var(--text-faint)' },
  noResults: {
    fontSize: '0.8rem', color: 'var(--text-secondary)',
    paddingTop: '0.35rem',
  },
  selectedClientCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '0.65rem 0.85rem',
  },
  selectedClientName: { display: 'block', fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 },
  selectedClientSub: { display: 'block', fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: 2 },
  deselectBtn: {
    background: 'none', border: 'none', flexShrink: 0,
    color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', padding: '0.15rem',
  },
  hint: { margin: 0, fontSize: '0.75rem', color: 'var(--text-ghost)' },
  inlineError: { margin: 0, fontSize: '0.78rem', color: '#ff8c5a' },
  timeWarning: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'rgba(255,140,90,0.1)', border: '1px solid rgba(255,140,90,0.25)',
    borderRadius: 8, padding: '0.6rem 0.85rem',
    fontSize: '0.82rem', color: '#ff8c5a', fontWeight: 500,
  },
  timeWarningIcon: { fontSize: '0.85rem', flexShrink: 0 },
  prefixWrap: { position: 'relative' },
  prefix: {
    position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
    fontSize: '0.875rem', color: 'var(--text-secondary)', pointerEvents: 'none',
  },
  linkBtn: {
    background: 'none', border: 'none',
    color: 'var(--accent)', fontSize: '0.8rem', cursor: 'pointer', padding: 0,
  },
  errorText: { margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#ff6b6b' },
  submitBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 10,
    padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700,
    color: 'var(--bg-sidebar)', cursor: 'pointer', transition: 'opacity 0.15s',
    marginTop: '1.25rem', flexShrink: 0,
  },
};
