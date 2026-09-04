'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createManualBooking, generateConsentLink, getStudioSchedule } from '@/lib/api';
import { useStationAvailability } from '@/lib/useStationAvailability';
import { useNewAppointmentData } from '@/lib/useNewAppointmentData';
import { invalidatePrefix } from '@/lib/cache';
import { formatDob } from '@/lib/format';
import { useLanguage } from '@/lib/i18n';
import { requestConfirmation, showError, showFeedback } from '@/lib/feedback';
import { bookingActions } from '@/lib/bookingActions';

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


function nextAppointmentSlot() {
  const d = new Date();
  d.setMinutes(d.getMinutes() >= 30 ? 60 : 30, 0, 0);
  return { date: d.toLocaleDateString('en-CA'), time: d.toTimeString().slice(0, 5) };
}

function getDefaultSizeUnit() {
  if (typeof navigator === 'undefined') return 'cm';
  try {
    const region = new Intl.Locale(navigator.language).region ?? '';
    return ['US', 'LR', 'MM'].includes(region) ? 'in' : 'cm';
  } catch {
    return 'cm';
  }
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

function TimeSelect({ value, onChange, label }) {
  const { h12, minute, ampm } = parse24(value);
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = ['00', '15', '30', '45'];
  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
      <select
        aria-label={`${label} hour`}
        style={{ ...selectStyle, flex: 1 }}
        value={h12}
        onChange={e => onChange(to24(Number(e.target.value), minute, ampm))}
      >
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ color: 'var(--text-ghost)', fontSize: '1rem', flexShrink: 0 }}>:</span>
      <select
        aria-label={`${label} minutes`}
        style={{ ...selectStyle, flex: 1 }}
        value={minute}
        onChange={e => onChange(to24(h12, e.target.value, ampm))}
      >
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select
        aria-label={`${label} AM or PM`}
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

export default function NewAppointmentPanel({ open, onClose, onCreated, initialBookingType = 'personal' }) {
  const { t } = useLanguage();
  const router = useRouter();
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);

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

  // ── Details
  const [size, setSize] = useState('');
  const [sizeUnit, setSizeUnit] = useState(getDefaultSizeUnit);
  const [retouch, setRetouch] = useState(false);

  // ── Pricing
  const [finalPrice, setFinalPrice] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMode, setDepositMode] = useState('none');
  const [showOptional, setShowOptional] = useState(false);
  const [daySchedule, setDaySchedule] = useState([]);
  const [scheduleError, setScheduleError] = useState('');

  // Distinct analytics sources: studio appointment, walk-in, or artist personal.
  const [bookingType, setBookingType] = useState(initialBookingType);

  // ── Notes
  const [notes, setNotes] = useState('');

  // ── Remote data
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { artists, stations: allStations, hours: studioHours, clients: pastClients, stripeConnected, loading, error: loadError, retry } = useNewAppointmentData(open);

  useEffect(() => {
    if (!open) return;
    const slot = nextAppointmentSlot();
    setBookingDate(slot.date);
    setStartTime(slot.time);
    setBookingType(initialBookingType);
  }, [open, initialBookingType]);

  // Clear a saved validation/API error once the user changes the fields that
  // produced it. Current validationError remains derived and updates instantly.
  useEffect(() => {
    if (error) setError('');
  }, [clientMode, selectedClient, firstName, lastName, clientEmail, clientPhone, artistId, bookingDate, startTime, durationMins, stationId, finalPrice, depositAmount, depositMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build ISO timestamp for time-slot overlap check.
  const chosenTimeISO = bookingDate && startTime
    ? new Date(`${bookingDate}T${startTime}:00`).toISOString()
    : '';

  const { stations: availableStations, loading: stationsLoading, error: stationAvailabilityError } = useStationAvailability({
    date: bookingDate,
    startTime: chosenTimeISO,
    durationMins,
    fallback: allStations,
  });

  useEffect(() => {
    if (!open || !bookingDate) { setScheduleError(''); return; }
    let cancelled = false;
    setScheduleError('');
    getStudioSchedule(bookingDate)
      .then(data => { if (!cancelled) setDaySchedule(data.entries ?? []); })
      .catch(() => { if (!cancelled) { setDaySchedule([]); setScheduleError('Live artist availability could not be checked.'); } });
    return () => { cancelled = true; };
  }, [open, bookingDate, artistId, startTime, durationMins]);

  // Reset station selection whenever date/time/duration changes.
  useEffect(() => {
    const options = availableStations ?? [];
    if (options.length > 0 && !options.some(station => station.id === stationId)) setStationId(options[0].id);
    if (options.length === 0) setStationId('');
  }, [availableStations]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredClients = useMemo(() => {
    const q = clientSearch.toLowerCase();
    if (!q) return [];
    return pastClients.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
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
    return studioHours.find(h => h.day_of_week === studioDay)
      ?? studioHours[studioDay]
      ?? null;
  }, [bookingDate, studioHours]);

  const timeError = (() => {
    if (!studioHours.length || !dayHours) return null;
    if (dayHours.is_closed) return t('nap_err_closed');
    if (!startTime) return null;
    const [sh, sm] = startTime.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = startMins + durationMins;
    const [oh, om] = dayHours.open_time.split(':').map(Number);
    const [ch, cm] = dayHours.close_time.split(':').map(Number);
    if (startMins < oh * 60 + om) return `${t('nap_err_opens_at')} ${dayHours.open_time} — ${t('nap_err_too_early')}`;
    if (endMins > ch * 60 + cm) return `${t('nap_err_ends_after')} (${dayHours.close_time}).`;
    return null;
  })();

  const clientName = clientMode === 'search'
    ? (selectedClient?.name || '')
    : [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const emailInvalid = !!clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim());
  const phoneInvalid = !!clientPhone.trim() && clientPhone.replace(/\D/g, '').length < 7;
  const quote = Number(finalPrice || 0);
  const deposit = Number(depositAmount || 0);
  const depositEnabled = depositMode !== 'none';
  const depositInvalid = depositEnabled && (deposit <= 0 || (quote > 0 && deposit > quote));
  const chosenDateTime = bookingDate && startTime ? new Date(`${bookingDate}T${startTime}:00`) : null;
  const dateInPast = chosenDateTime && Number.isFinite(chosenDateTime.getTime()) && chosenDateTime.getTime() < Date.now();
  const artistConflict = useMemo(() => {
    if (!artistId || !chosenDateTime || !durationMins) return null;
    const start = chosenDateTime.getTime();
    const end = start + durationMins * 60000;
    return daySchedule.find(entry => {
      if ((entry.artistId ?? entry.artist_id) !== artistId || !entry.chosenTime) return false;
      const otherStart = new Date(entry.chosenTime).getTime();
      const otherEnd = otherStart + (entry.durationMins ?? 60) * 60000;
      return otherStart < end && otherEnd > start;
    }) ?? null;
  }, [artistId, chosenDateTime?.getTime(), durationMins, daySchedule]); // eslint-disable-line react-hooks/exhaustive-deps
  const validationError = timeError
    || (dateInPast ? 'Choose a time that has not already passed.' : '')
    || (emailInvalid ? 'Enter a valid client email address.' : '')
    || (phoneInvalid ? 'Enter a valid client phone number.' : '')
    || (artistConflict ? 'This artist already has an appointment at that time.' : '')
    || (depositInvalid ? (deposit <= 0 ? 'Enter a deposit amount.' : 'The deposit cannot be greater than the quoted price.') : '');
  const missingRequirement = !clientName ? t('nap_err_client')
    : !artistId ? t('nap_err_artist')
    : !bookingDate || !startTime ? t('nap_err_datetime')
    : !stationId ? 'Select an available station.'
    : '';
  const disabledReason = loadError || validationError || missingRequirement;
  const canSubmit = !disabledReason;
  const essentialsComplete = Boolean(clientName && artistId && bookingDate && startTime && stationId && !timeError && !dateInPast && !artistConflict);
  const dirty = Boolean(selectedClient || firstName || lastName || clientEmail || clientPhone || clientDob || artistId || stationId || size || retouch || finalPrice || depositAmount || depositMode !== 'none' || notes || bookingType !== initialBookingType);
  dirtyRef.current = dirty;
  savingRef.current = saving;

  function resetForm() {
    setClientMode('search');
    setClientSearch('');
    setSelectedClient(null);
    setFirstName(''); setLastName(''); setClientEmail(''); setClientPhone(''); setClientDob('');
    setArtistId('');
    const slot = nextAppointmentSlot();
    setBookingDate(slot.date);
    setStartTime(slot.time);
    setDurationMins(60);
    setStationId('');
    setSize(''); setSizeUnit('cm'); setRetouch(false);
    setFinalPrice(''); setDepositAmount(''); setDepositMode('none'); setShowOptional(false);
    setBookingType(initialBookingType);
    setNotes(''); setError('');
  }

  async function handleClose() {
    if (savingRef.current) return;
    if (dirtyRef.current) {
      const confirmed = await requestConfirmation({
        title: 'Discard this appointment?',
        message: 'The details entered in this appointment will be lost.',
        confirmLabel: 'Discard appointment',
        danger: true,
      });
      if (!confirmed) return;
    }
    resetForm();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') { event.preventDefault(); handleClose(); return; }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    if (disabledReason) { setError(disabledReason); return; }
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
        deposit_required: depositEnabled && da > 0,
      };
      if (retouch) body.session_type = 'retouch';
      if (size.trim()) { body.size = size.trim(); body.size_unit = sizeUnit; }
      if (clientEmail.trim()) body.requester_email = clientEmail.trim();
      if (clientPhone.trim()) body.requester_phone = clientPhone.trim();
      if (clientDob.trim()) body.dob = clientDob.trim();
      if (stationId) body.station_id = stationId;
      if (fp > 0) body.estimated_quote = fp;
      if (depositEnabled && da > 0) body.deposit_amount = da;
      if (depositMode === 'paid') body.deposit_paid = true;
      if (notes.trim()) body.notes = notes.trim();
      body.source = bookingType;
      const createdBooking = await createManualBooking(body);
      invalidatePrefix('bookings:');
      invalidatePrefix('schedule:');
      window.dispatchEvent(new CustomEvent('booking-created'));
      resetForm();
      onCreated?.();
      onClose();
      const bookingId = createdBooking?.id;
      const actions = [{
        label: 'View booking',
        onClick: () => router.push(`/dashboard/appointments?status=confirmed${bookingId ? `&booking=${encodeURIComponent(bookingId)}` : ''}`),
      }];
      if (bookingId && clientEmail.trim() && depositEnabled && depositMode === 'later' && da > 0 && stripeConnected) {
        actions.push({
          label: 'Send deposit link',
          onClick: async () => {
            try {
              await bookingActions.sendSelectionLink(bookingId, { expiresHours: 168, depositRequired: true, depositAmount: da, durationMinutes: durationMins, estimatedQuote: fp || null, artistId });
              showFeedback('Deposit payment link sent.', 'success');
            } catch (sendError) { showError(sendError); }
          },
        });
      }
      if (clientEmail.trim()) {
        actions.push({
          label: 'Send consent form',
          onClick: async () => {
            try {
              await generateConsentLink(clientEmail.trim(), undefined, clientDob.trim() || undefined);
              showFeedback('Consent form sent.', 'success');
            } catch (sendError) { showError(sendError); }
          },
        });
      }
      showFeedback('Appointment created successfully.', 'success', actions);
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
        aria-hidden="true"
        style={{ ...bd.backdrop, opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-hidden={!open} aria-labelledby="new-appointment-title" style={{ ...bd.panel, transform: open ? 'translateX(0)' : 'translateX(100%)', visibility: open ? 'visible' : 'hidden' }}>

        <div style={bd.header}>
          <span id="new-appointment-title" style={bd.title}>{t('nap_title')}</span>
          <button ref={closeButtonRef} type="button" onClick={handleClose} style={bd.closeBtn} aria-label="Close new appointment">✕</button>
        </div>

        {loading ? (
          <div style={bd.loadingWrap} role="status"><div style={bd.loadingDot} /><span style={bd.srOnly}>Loading appointment details</span></div>
        ) : loadError ? (
          <div role="alert" style={bd.loadErrorWrap}>
            <strong>Appointment details couldn&apos;t be loaded</strong>
            <span style={bd.loadErrorText}>{loadError}</span>
            <button type="button" style={bd.retryBtn} onClick={retry}>Try again</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={bd.form}>

            {/* ── BOOKING TYPE ── */}
            <div style={bd.section}>
              <p style={bd.sectionLabel}>{t('nap_booking_type')}</p>
              <div style={bd.typeCards}>
                <button
                  type="button"
                  style={{ ...bd.typeCard, ...(bookingType === 'studio' ? bd.typeCardActive : {}) }}
                  onClick={() => setBookingType('studio')}
                >
                  <strong>Studio appointment</strong><span>Planned and booked by the studio</span>
                </button>
                <button
                  type="button"
                  style={{ ...bd.typeCard, ...(bookingType === 'walkin' ? bd.typeCardActive : {}) }}
                  onClick={() => setBookingType('walkin')}
                >
                  <strong>Walk-in</strong><span>Client arrived without a planned booking</span>
                </button>
                <button
                  type="button"
                  style={{ ...bd.typeCard, ...(bookingType === 'personal' ? bd.typeCardActive : {}) }}
                  onClick={() => setBookingType('personal')}
                >
                  <strong>Personal appointment</strong><span>Client brought in by the artist</span>
                </button>
              </div>
            </div>

            {/* ── ARTIST ── */}
            {artists.length > 0 && (
              <div style={bd.section}>
                <p style={bd.sectionLabel}>{t('bdp_artist')}</p>
                <select style={bd.select} value={artistId} onChange={e => setArtistId(e.target.value)} required>
                  <option value="">{t('nap_select_artist')}</option>
                  {artists.map(a => (
                    <option key={a.artistId ?? a.artist_id ?? a.id} value={a.artistId ?? a.artist_id ?? a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {artists.length === 0 && <p role="alert" style={bd.inlineError}>Add or approve an artist before creating an appointment.</p>}
            {allStations.length === 0 && <p role="alert" style={bd.inlineError}>No active station was found. Reload the studio or add a station in Settings before creating an appointment.</p>}

            {/* ── CLIENT ── */}
            <div style={bd.section}>
              <p style={bd.sectionLabel}>{t('nap_client')}</p>

              <div style={bd.modeTabs}>
                <button
                  type="button"
                  style={{ ...bd.modeTab, ...(clientMode === 'search' ? bd.modeTabActive : {}) }}
                  onClick={() => { setClientMode('search'); setFirstName(''); setLastName(''); setClientEmail(''); setClientPhone(''); }}
                >
                  {t('nap_search_existing')}
                </button>
                <button
                  type="button"
                  style={{ ...bd.modeTab, ...(clientMode === 'manual' ? bd.modeTabActive : {}) }}
                  onClick={() => { setClientMode('manual'); setSelectedClient(null); }}
                >
                  {t('nap_new_client')}
                </button>
              </div>

              {clientMode === 'search' ? (
                selectedClient ? (
                  <div>
                  <div style={bd.selectedClientCard}>
                    <div style={{ minWidth: 0 }}>
                      <span style={bd.selectedClientName}>{selectedClient.name}</span>
                      <span style={bd.selectedClientSub}>
                        {[selectedClient.email, selectedClient.phone, selectedClient.dob ? formatDob(selectedClient.dob) : null].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <button type="button" style={bd.deselectBtn} onClick={clearSelectedClient} title="Remove">✕</button>
                  </div>
                  {(selectedClient.allergies || selectedClient.pain_tolerance || selectedClient.notes) && (
                    <div role="note" style={bd.clientWarning}>
                      <strong>Client context</strong>
                      {selectedClient.allergies && <span>Allergies: {selectedClient.allergies}</span>}
                      {selectedClient.pain_tolerance && <span>Pain tolerance: {selectedClient.pain_tolerance}</span>}
                      {selectedClient.notes && <span>Notes: {selectedClient.notes}</span>}
                    </div>
                  )}
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      style={bd.input}
                      role="combobox"
                      aria-label="Search existing clients"
                      aria-expanded={showDropdown && filteredClients.length > 0}
                      aria-controls="new-appointment-client-results"
                      aria-autocomplete="list"
                      placeholder={t('clients_search')}
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      autoComplete="off"
                    />
                    {showDropdown && filteredClients.length > 0 && (
                      <div id="new-appointment-client-results" role="listbox" style={bd.dropdown}>
                        {filteredClients.map((c, i) => (
                          <button key={c.id ?? c.email ?? `${c.name}-${i}`} role="option" type="button" style={bd.dropdownItem} onMouseDown={() => pickClient(c)}>
                            <span style={bd.dropdownName}>{c.name}</span>
                            <span style={bd.dropdownSub}>{[c.email, c.phone].filter(Boolean).join(' · ')}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {clientSearch && filteredClients.length === 0 && (
                      <div style={bd.noResults}>
                        {t('nap_no_matches')}{' '}
                        <button type="button" style={bd.linkBtn} onClick={() => setClientMode('manual')}>
                          {t('nap_enter_manually')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <>
                  <div style={bd.fieldRow}>
                    <div style={bd.field}>
                      <label style={bd.label}>{t('nap_first_name')}</label>
                      <input
                        style={bd.input}
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder={t('nap_first_name')}
                        autoFocus
                      />
                    </div>
                    <div style={bd.field}>
                      <label style={bd.label}>{t('nap_last_name')}</label>
                      <input
                        style={bd.input}
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder={t('nap_last_name')}
                      />
                    </div>
                  </div>
                  <div style={bd.field}>
                    <label style={bd.label}>{t('clients_dob')}</label>
                    <input
                      style={{ ...bd.input, colorScheme: 'dark' }}
                      type="date"
                      value={clientDob}
                      onChange={e => setClientDob(e.target.value)}
                    />
                  </div>
                  <div style={bd.fieldRow}>
                    <div style={bd.field}>
                      <label style={bd.label}>{t('sched_email')}</label>
                      <input
                        style={bd.input}
                        type="email"
                        aria-invalid={emailInvalid}
                        value={clientEmail}
                        onChange={e => setClientEmail(e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div style={bd.field}>
                      <label style={bd.label}>{t('sched_phone')}</label>
                      <input
                        style={bd.input}
                        type="tel"
                        aria-invalid={phoneInvalid}
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
              <p style={bd.sectionLabel}>{t('nap_booking_details')}</p>

              <div style={bd.field}>
                <label style={bd.label}>{t('sched_date')}</label>
                <input
                  style={bd.input}
                  type="date"
                  min={todayStr()}
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  required
                />
              </div>

              <div style={bd.field}>
                <label style={bd.label}>{t('nap_start_time')}</label>
                <TimeSelect value={startTime} onChange={setStartTime} label={t('nap_start_time')} />
              </div>

              <div style={bd.field}>
                <label style={bd.label}>{t('bdp_duration')}</label>
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
                <p style={bd.hint}>{t('nap_studio_open')} {dayHours.open_time} – {dayHours.close_time}</p>
              ) : bookingDate && !studioHours.length ? (
                <p style={bd.hint}>{t('nap_no_hours_hint')}</p>
              ) : null}
              {artistConflict && <div role="alert" style={bd.timeWarning}><span style={bd.timeWarningIcon}>⚠</span>This artist already has an appointment that overlaps this time.</div>}
              {scheduleError && <p role="status" style={bd.availabilityNotice}>{scheduleError} The server will verify it when you create the appointment.</p>}
            </div>

            {/* ── STATION — revealed after date + time + duration are set ── */}
            {bookingDate && startTime && allStations.length > 0 && (
              <div style={{ ...bd.section, opacity: timeError ? 0.35 : 1, pointerEvents: timeError ? 'none' : 'auto' }}>
                <p style={bd.sectionLabel}>{t('bdp_station')}</p>
                {stationsLoading ? (
                  <p style={bd.hint}>{t('nap_checking')}</p>
                ) : (
                  <>
                    <select style={bd.select} value={stationId} onChange={e => setStationId(e.target.value)}>
                      <option value="">{t('nap_no_station')}</option>
                      {(availableStations ?? allStations).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {stationId && <p style={bd.hint}>The first available station was selected automatically. You can change it.</p>}
                    {availableStations !== null && availableStations.length === 0 && (
                      <p style={bd.inlineError}>{t('nap_no_stations_date')}</p>
                    )}
                    {stationAvailabilityError && <p role="alert" style={bd.inlineError}>Live station availability could not be checked. The booking will be verified when you create it.</p>}
                  </>
                )}
              </div>
            )}

            {essentialsComplete && bookingType === 'walkin' && (
              <button
                type="button"
                style={{ ...bd.optionalToggle, ...(showOptional ? bd.optionalToggleOpen : {}) }}
                onClick={() => setShowOptional(value => !value)}
                aria-expanded={showOptional}
              >
                <span style={bd.optionalToggleCopy}>
                  <span style={bd.optionalToggleTitle}>Optional details</span>
                  <span style={bd.optionalToggleDescription}>Tattoo, pricing, deposit and notes</span>
                </span>
                <span style={bd.optionalToggleAction}>
                  {showOptional ? 'Hide' : 'Show'}
                  <span aria-hidden="true" style={{ ...bd.optionalChevron, transform: showOptional ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
                </span>
              </button>
            )}

            {/* ── DETAILS ── */}
            {essentialsComplete && (bookingType !== 'walkin' || showOptional) && <>
            <div style={bd.section}>
              <p style={bd.sectionLabel}>{t('nap_details')}</p>
              <label style={bd.checkRow}>
                <input type="checkbox" checked={retouch} onChange={e => setRetouch(e.target.checked)} style={bd.checkbox} />
                <span>{t('nap_retouch')}</span>
              </label>
              <div style={bd.field}>
                <label style={bd.label}>{t('bdp_size')}</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    style={{ ...bd.input, flex: 1 }}
                    type="number" min="0" step="0.1"
                    value={size}
                    onChange={e => setSize(e.target.value)}
                    placeholder="e.g. 10"
                  />
                  <div style={bd.unitToggle}>
                    {['cm', 'in'].map(u => (
                      <button
                        key={u} type="button"
                        style={{ ...bd.unitBtn, ...(sizeUnit === u ? bd.unitBtnActive : {}) }}
                        onClick={() => setSizeUnit(u)}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── PRICING ── */}
            <div style={bd.section}>
              <p style={bd.sectionLabel}>{t('nap_pricing')}</p>
              <div style={bd.field}>
                <div style={bd.field}>
                  <label style={bd.label}>Estimated price</label>
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
                  <div style={bd.depositModes}>
                    {[
                      ['none', 'No deposit'],
                      ['later', stripeConnected ? 'Collect later' : 'Due later'],
                      ['paid', 'Already paid'],
                    ].map(([value, label]) => <button key={value} type="button" onClick={() => setDepositMode(value)} style={{ ...bd.depositMode, ...(depositMode === value ? bd.depositModeActive : {}) }}>{label}</button>)}
                  </div>
                  {depositMode !== 'none' && <>
                  <div style={bd.prefixWrap}>
                    <span style={bd.prefix}>$</span>
                    <input
                      style={{ ...bd.input, paddingLeft: '1.75rem' }}
                      type="number" min="0" step="0.01"
                      value={depositAmount}
                      aria-invalid={depositInvalid}
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  {depositMode === 'later' && <span style={bd.hint}>{stripeConnected ? 'This will appear as an unpaid deposit to collect.' : 'Record the external payment when it is received.'}</span>}
                  {depositMode === 'paid' && <span style={bd.hint}>The deposit will be recorded as received now.</span>}
                  {(() => {
                    const da = depositMode === 'later' && stripeConnected ? parseFloat(depositAmount) || 0 : 0;
                    if (da <= 0) return null;
                    const feeCents = Math.round(da * 0.03 * 100) + 50;
                    const total = da + feeCents / 100;
                    return (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-ghost)', marginTop: '0.25rem', display: 'block' }}>
                        {t('nap_fee_client_charged')} ${total.toFixed(2)} ({t('nap_fee_incl')} ${(feeCents / 100).toFixed(2)} {t('nap_fee_suffix')})
                      </span>
                    );
                  })()}
                  </>}
                </div>
              </div>
            </div>

            {/* ── NOTES ── */}
            <div style={{ ...bd.section, borderBottom: 'none', marginBottom: 0 }}>
              <p style={bd.sectionLabel}>{t('bdp_notes')}</p>
              <textarea
                style={{ ...bd.input, minHeight: 72, resize: 'vertical' }}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t('nap_notes_placeholder')}
              />
            </div>
            </>}

            {essentialsComplete && (
              <div style={bd.summary}>
                <span style={bd.sectionLabel}>REVIEW</span>
                <strong style={bd.summaryText}>{[
                  bookingType === 'walkin' ? 'Walk-in' : bookingType === 'studio' ? 'Studio appointment' : 'Personal appointment',
                  artists.find(artist => (artist.artistId ?? artist.artist_id ?? artist.id) === artistId)?.name,
                  chosenDateTime?.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
                  `${durationMins} min`,
                  (availableStations ?? allStations).find(station => station.id === stationId)?.name,
                  quote > 0 ? `$${quote.toFixed(2)}` : null,
                ].filter(Boolean).join(' · ')}</strong>
              </div>
            )}

            {(validationError || error) && <p role="alert" style={bd.errorText}>{error || validationError}</p>}

            <button
              type="submit"
              style={{ ...bd.submitBtn, opacity: canSubmit && !saving ? 1 : 0.4 }}
              disabled={!canSubmit || saving}
              title={!canSubmit ? disabledReason : undefined}
              aria-describedby={!canSubmit ? 'new-appointment-disabled-reason' : undefined}
            >
              {saving ? t('sched_creating') : t('nap_create')}
            </button>
            {!canSubmit && <span id="new-appointment-disabled-reason" style={bd.disabledReason}>{disabledReason}</span>}

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
  srOnly: { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  loadErrorWrap: { margin: '1.5rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', border: '1px solid rgba(224,96,96,0.38)', borderRadius: 10, color: 'var(--text)' },
  loadErrorText: { color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 },
  retryBtn: { alignSelf: 'flex-start', border: 0, borderRadius: 8, padding: '0.55rem 0.8rem', background: 'var(--accent)', color: 'var(--accent-contrast)', fontWeight: 700, cursor: 'pointer' },
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
  typeCards: { display: 'grid', gridTemplateColumns: '1fr', gap: '0.45rem' },
  typeCard: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, width: '100%', padding: '0.72rem 0.8rem', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem' },
  typeCardActive: { borderColor: 'var(--accent)', background: 'var(--accent-tint)', color: 'var(--accent)' },
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
  clientWarning: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: '0.55rem', padding: '0.65rem 0.75rem', borderRadius: 8, border: '1px solid rgba(245,158,58,0.25)', background: 'rgba(245,158,58,0.08)', color: 'var(--text-muted)', fontSize: '0.74rem' },
  deselectBtn: {
    background: 'none', border: 'none', flexShrink: 0,
    color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', padding: '0.15rem',
  },
  hint: { margin: 0, fontSize: '0.75rem', color: 'var(--text-ghost)' },
  inlineError: { margin: 0, fontSize: '0.78rem', color: '#ff8c5a' },
  availabilityNotice: { margin: 0, fontSize: '0.74rem', color: 'var(--text-ghost)', lineHeight: 1.45 },
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
  suffix: {
    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
    fontSize: '0.875rem', color: 'var(--text-secondary)', pointerEvents: 'none',
  },
  checkRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)',
    cursor: 'pointer', marginBottom: '0.85rem',
  },
  checkbox: { width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' },
  linkBtn: {
    background: 'none', border: 'none',
    color: 'var(--accent)', fontSize: '0.8rem', cursor: 'pointer', padding: 0,
  },
  unitToggle: {
    display: 'flex', flexShrink: 0,
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 8, padding: 3, gap: 2,
  },
  unitBtn: {
    background: 'none', border: 'none', borderRadius: 6,
    padding: '0.3rem 0.55rem', fontSize: '0.78rem', fontWeight: 500,
    color: 'var(--text-faint)', cursor: 'pointer',
  },
  unitBtnActive: {
    background: 'var(--bg-chip)', color: 'var(--text)', fontWeight: 600,
  },
  optionalToggle: { width: '100%', margin: '-0.5rem 0 1.25rem', padding: '0.85rem 0.9rem', borderRadius: 10, border: '1px solid var(--border-faint)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', textAlign: 'left' },
  optionalToggleOpen: { background: 'var(--bg-input)', borderColor: 'var(--border)' },
  optionalToggleCopy: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  optionalToggleTitle: { color: 'var(--text)', fontSize: '0.8rem', fontWeight: 650 },
  optionalToggleDescription: { color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 400, lineHeight: 1.35 },
  optionalToggleAction: { display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 },
  optionalChevron: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-chip)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '1rem', lineHeight: 1, transition: 'transform 0.2s ease' },
  depositModes: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 },
  depositMode: { padding: '0.5rem 0.35rem', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer' },
  depositModeActive: { borderColor: 'var(--accent)', background: 'var(--accent-tint)', color: 'var(--accent)', fontWeight: 700 },
  summary: { display: 'flex', flexDirection: 'column', gap: '0.45rem', padding: '0.85rem', borderRadius: 9, border: '1px solid var(--accent-tint-border)', background: 'var(--accent-tint)' },
  summaryText: { color: 'var(--text)', fontSize: '0.8rem', lineHeight: 1.5 },
  errorText: { margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#ff6b6b' },
  disabledReason: { marginTop: '0.45rem', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '0.73rem' },
  submitBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 10,
    padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700,
    color: 'var(--bg-sidebar)', cursor: 'pointer', transition: 'opacity 0.15s',
    marginTop: '1.25rem', flexShrink: 0,
  },
};
