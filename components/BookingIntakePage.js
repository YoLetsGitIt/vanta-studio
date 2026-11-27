'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Field from '@/components/ui/Field';
import AddressFields, { EMPTY_ADDRESS, addressPayload, addressProblem } from '@/components/forms/AddressFields';
import Button from '@/components/ui/Button';
import BrandLoader from '@/components/BrandLoader';
import ClientAuthGate from '@/components/ClientAuthGate';
import ClientAccountActions from '@/components/ClientAccountActions';
import DateOfBirthInput from '@/components/ui/DateOfBirthInput';
import { ensureClientProfile, subscribeClientSession } from '@/lib/client-account';
import { getSupabase } from '@/lib/supabase';
import WeeklyAvailabilityGrid from '@/components/WeeklyAvailabilityGrid';
import InstantTimePicker from '@/components/InstantTimePicker';
import { formatMoney, formatWhen, paymentReturn, returnURL } from '@/lib/booking-instant.mjs';
import { depositCharge, money, payWays, BOOKING_FEE_NOTE, BOOKING_FEE_COVERED_NOTE } from '@/lib/booking-fee.mjs';
import PhotoIdField from '@/components/PhotoIdField';
import { uploadPhotoIdAnswers, signStudioPhotoId } from '@/lib/photoId';
import { getStudioPublic, createWalkIn, createGuestStudioBooking, createWalkInBooking, getWalkInFormConfigPublic, getStudioHoursPublic, walkinUploadSign, signatureUploadSign, getStudioConsentTemplates, getFormConfigPublic } from '@/lib/api';

import { COUNTRIES, detectCountry } from '@/lib/phoneCountries';
import { formTheme, formThemeMode } from '@/lib/formTheme';
import { signatureBlob } from '@/lib/signature';

const PIERCING_PLACEMENTS = ['Earlobe', 'Helix', 'Tragus', 'Conch', 'Daith', 'Rook', 'Industrial', 'Nostril', 'Septum', 'Eyebrow', 'Lip', 'Tongue', 'Navel', 'Nipple', 'Other'];

const PLACEMENTS = [
  'Ankle', 'Arm', 'Back', 'Calf', 'Chest', 'Foot', 'Forearm',
  'Hand', 'Head', 'Hip', 'Knee', 'Neck', 'Ribs', 'Shoulder',
  'Stomach', 'Thigh', 'Wrist', 'Other',
];

// One intake form, two entry points:
//   mode="booking" — studio booking link: guest or sign-in, request reviewed by the studio.
//   mode="walkin"  — walk-in link / QR: guest only, choose an artist, booked in straight away.
function IntakeInner({ mode, onStyle }) {
  const walkIn = mode === 'walkin';
  const params = useSearchParams();
  const studioId = params.get('s');
  const [studioHours, setStudioHours] = useState(null);
  const [bookedArtist, setBookedArtist] = useState('');

  const [studio, setStudio]   = useState(null);
  const [studioErr, setStudioErr] = useState('');
  const [formConfig, setFormConfig] = useState(null); // null = loading
  const [session, setSession] = useState(undefined);
  // Guests book without an account; a signed-in session always takes precedence.
  // Guest mode lives in the URL (?guest=1) so the browser Back button returns to the sign-in choice.
  const guestChosen = walkIn || params.get('guest') === '1';
  const pushedGuest = useRef(false);
  const setGuestChosen = on => {
    const url = new URL(window.location.href);
    if (on) url.searchParams.set('guest', '1'); else url.searchParams.delete('guest');
    window.history.pushState(null, '', url);
    pushedGuest.current = on;
  };
  // Back to the sign-in choice: a real history step when we added one, so the
  // browser and on-page Back buttons behave the same.
  const leaveGuest = () => {
    if (pushedGuest.current) { pushedGuest.current = false; window.history.back(); return; }
    const url = new URL(window.location.href);
    url.searchParams.delete('guest');
    window.history.replaceState(null, '', url);
  };
  // Walk-ins are always guests, even if someone is signed in on the studio's device.
  const guest = walkIn || (guestChosen && !session);
  const [guestEmail, setGuestEmail] = useState('');
  const [accountReady, setAccountReady] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountRetry, setAccountRetry] = useState(0);
  const accountUser = useRef(null);

  useEffect(() => subscribeClientSession(setSession, () => {
    setSession(null);
  }), []);

  useEffect(() => {
    setAccountReady(false);
    setAccountError('');
    if (!session) return;
    let cancelled = false;
    ensureClientProfile(session).then(profile => {
      if (cancelled) return;
      const metadata = session.user?.user_metadata ?? {};
      if (accountUser.current !== session.user.id) {
        const details = {
          name: [profile.name, metadata.full_name, metadata.name].find(value => value?.trim() && value.trim() !== 'User')?.trim() || '',
          dob: metadata.dob?.trim() || '',
          phone: profile.phone?.trim() || metadata.phone?.trim() || '',
        };
        // Account names are one string: first word is the first name, the rest the last name.
        const [first = '', ...rest] = details.name.split(/\s+/).filter(Boolean);
        setFirstName(first);
        setLastName(rest.join(' '));
        setDob(details.dob);
        const country = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find(country => details.phone.startsWith(country.dial));
        setPhoneCode(country?.id || detectCountry());
        setPhoneNum(country ? details.phone.slice(country.dial.length).trim() : details.phone);
        accountUser.current = session.user.id;
      }
      setAccountReady(true);
    }).catch(error => { if (!cancelled) setAccountError(error.message); });
    return () => { cancelled = true; };
  }, [session, accountRetry]);

  // Form state
  // Every booking asks for first and last name separately; they're joined into one name when sent.
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const clientName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const [phoneCode, setPhoneCode]   = useState(() => detectCountry());
  const [phoneNum,  setPhoneNum]    = useState('');
  // Ticked unless the client unticks it, like the booking link.
  const [smsOptIn, setSMSOptIn] = useState(true);
  // "Send me offers and updates": never pre-ticked (Australian spam rules need the client to opt in).
  const [offersOptIn, setOffersOptIn] = useState(false);
  const [dob, setDob]               = useState('');
  const [skinTone, setSkinTone]     = useState('');

  const [artistId, setArtistId]     = useState('');
  const [placements, setPlacements]  = useState([]);
  const [design, setDesign]         = useState('');
  const [size, setSize]             = useState('');
  const [sizeUnit, setSizeUnit]     = useState('cm');
  const [colorStyle, setColorStyle] = useState('');
  // With Colour: which colours, sent as "Color (deep red, gold)" like the booking link.
  const [colorDetails, setColorDetails] = useState('');
  const [appointmentType, setAppointmentType] = useState('tattoo');
  const isPiercing = appointmentType === 'piercing';
  const [retouch, setRetouch]       = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergyDetails, setAllergyDetails] = useState('');
  const [notes, setNotes]           = useState('');
  // When the studio's form asks for it (kept on the client's record).
  const [address, setAddress]       = useState(EMPTY_ADDRESS);
  // Weekly availability: [{ day_of_week, start_time, end_time }]
  const [availability, setAvailability] = useState([]);
  const [earliestDate, setEarliestDate] = useState('');
  const photoInputRef = useRef(null);
  const [photos, setPhotos]         = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  // Consent template system
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [templateState, setTemplateState] = useState({});
  // Guardian info (shared across minor-flagged templates)
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Parent');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);
  const missingTarget = useRef('');
  const [, setValidityTick] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone]             = useState(false);

  // Instant booking: the chosen artist's open times, booked by paying the deposit.
  const [instantInfo, setInstantInfo] = useState(null);
  const [instantType, setInstantType] = useState('');
  const [instantStart, setInstantStart] = useState('');
  const [payment, setPayment] = useState(() => {
    if (typeof window === 'undefined') return null;
    const back = paymentReturn(new URLSearchParams(window.location.search));
    return back ? { ...back, state: 'checking' } : null;
  });
  const instantMode = !walkIn && Boolean(artistId) && Boolean(instantInfo?.available) && instantInfo?.studio?.id === studioId;
  const instantChoice = instantMode ? instantInfo.types.find(t => t.id === instantType) : null;
  const bookingPhone = phoneNum.trim().startsWith('+') ? phoneNum.trim() : `${COUNTRIES.find(c => c.id === phoneCode)?.dial ?? ''} ${phoneNum}`.trim();

  const availabilityForArtist = !walkIn && studio?.booking_management === 'artist' && Boolean(artistId);
  // field(key) returns {enabled, required} from the loaded config, defaulting to enabled/not-required
  function field(key) {
    if (walkIn) {
      // Walk-ins always choose their artist; extras are only what the studio switched on.
      if (key === 'artist_id') return { enabled: true, required: true };
      // Walk-in forms don't ask for size, even if an older setting turned it on.
      if (key === 'size') return { enabled: false, required: false };
      return formConfig?.[key] ?? { enabled: false, required: false };
    }
    // At an "Artists confirm" studio, choosing an artist sends the request straight to
    // them, so the client gives their availability now for the artist to send times.
    // Booking an open time instantly replaces weekly availability.
    if (key === 'availability_windows' && instantMode) return { enabled: false, required: false };
    if (key === 'availability_windows' && availabilityForArtist) return { enabled: true, required: true };
    // Weekly availability is newer than the other fields, so it stays off unless the studio turned it on.
    return formConfig?.[key] ?? { enabled: key !== 'availability_windows', required: false };
  }

  // Load studio, form config, and consent templates in parallel
  useEffect(() => {
    if (!studioId) return;
    Promise.all([
      getStudioPublic(studioId),
      (walkIn ? getWalkInFormConfigPublic(studioId) : getFormConfigPublic(studioId)).catch(() => ({ fields: {} })),
      // Walk-ins sign every studio consent form; online requests use the one chosen for the booking widget.
      getStudioConsentTemplates(studioId, walkIn).catch(() => ({ templates: [] })),
      getStudioHoursPublic(studioId).catch(() => ({ hours: [] })),
    ]).then(([studioData, configData, consentData, hoursData]) => {
      setStudioHours(hoursData.hours ?? []);
      setStudio(studioData);
      // ?a=<artist> picks the artist, e.g. from the artist's own booking page.
      const preset = params.get('a');
      if (!walkIn && preset && studioData?.artists?.some(a => a.artistId === preset)) setArtistId(preset);
      onStyle?.(studioData?.form_style ?? null);
      setFormConfig(configData.fields ?? {});
      setConsentTemplates(consentData.templates ?? []);
    }).catch(e => setStudioErr(e.message));
  }, [studioId]);

  // Whether the chosen artist can be booked straight into an open time here.
  useEffect(() => {
    setInstantInfo(null);
    setInstantType('');
    setInstantStart('');
    if (walkIn || !artistId) return;
    const controller = new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/artists/${artistId}/instant-booking`, { signal: controller.signal, cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(setInstantInfo)
      .catch(() => {});
    return () => controller.abort();
  }, [artistId, walkIn]);

  // Back from payment: confirm the booking, or give the time back if they cancelled.
  useEffect(() => {
    if (!payment || payment.state !== 'checking') return;
    let live = true;
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const { booking, token, result } = payment;
    if (result === 'cancelled') {
      fetch(`${backend}/bookings/${booking}/instant-release`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        .catch(() => {})
        .finally(() => { if (live) setPayment(p => ({ ...p, state: 'released' })); });
      return () => { live = false; };
    }
    let tries = 0;
    async function check() {
      const res = await fetch(`${backend}/bookings/${booking}/instant-status?t=${encodeURIComponent(token)}`, { cache: 'no-store' }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (!live) return;
      // processing: paid from their bank; booked once the money arrives (an email says so).
      if (data?.state === 'booked' || data?.state === 'closed' || data?.state === 'processing') { setPayment(p => ({ ...p, ...data })); return; }
      if (++tries >= 15) { setPayment(p => ({ ...p, ...(data || {}), state: 'waiting' })); return; }
      setTimeout(check, 2000);
    }
    check();
    return () => { live = false; };
  }, [payment]);

  function handlePhotoChange(e) {
    const files = Array.from(e.target.files).slice(0, 5);
    setPhotos(files);
    setPhotoPreviews(files.map(f => URL.createObjectURL(f)));
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  // True if DOB indicates the client is under 18
  const isMinor = (() => {
    if (!dob) return false;
    const birth = new Date(dob + 'T12:00:00');
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    return birth > cutoff;
  })();

  function setTemplateAnswer(templateId, fieldId, value) {
    setTemplateState(prev => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        answers: { ...(prev[templateId]?.answers ?? {}), [fieldId]: value },
      },
    }));
  }

  function setTemplateSigBlob(templateId, blob) {
    setTemplateState(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], sigBlob: blob },
    }));
  }

  function setTemplateGuardianSigBlob(templateId, blob) {
    setTemplateState(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], guardianSigBlob: blob },
    }));
  }

  function setTemplateAccepted(templateId, val) {
    setTemplateState(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], accepted: val },
    }));
  }

  // The first required thing still missing from the booking or consent forms, or ''.
  // Drives both the disabled submit button and the message on submit.
  // The first thing still needed before the booking can be sent, or ''. missingTarget
  // remembers where it is on the page (a CSS selector), so the button can take the client there.
  function missingRequirement(bookingEmail = guest ? guestEmail.trim() : session?.user?.email?.trim() || '') {
    const miss = (message, target) => { missingTarget.current = target; return message; };
    missingTarget.current = '';
    if (!firstName.trim()) return miss('Please provide your first name.', 'input[autocomplete="given-name"]');
    if (!lastName.trim()) return miss('Please provide your last name.', 'input[autocomplete="family-name"]');
    if (guest && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingEmail)) return miss('Please provide a valid email address.', 'input[type="email"]');
    if (!phoneNum.trim()) return miss('Please provide your phone number.', '#booking-phone');
    if (!dob) return miss('Please provide your date of birth.', '[data-need="dob"]');
    if (walkIn && !artistId) return miss('Please choose your artist.', '[data-need="artist"]');
    if (instantMode && !instantChoice) return miss('Please choose your appointment.', '[data-need="time"]');
    if (instantMode && !instantStart) return miss('Please choose a time.', '[data-need="time"]');
    if (formConfig?.address?.enabled && field('address').enabled) {
      const problem = addressProblem(address, field('address').required);
      if (problem) return miss(`Address: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`, '[data-need="address"]');
    }
    if (field('body_location').enabled && placements.length === 0) return miss('Please select at least one placement.', '[data-need="placement"]');
    if (field('availability_windows').enabled && field('availability_windows').required && availability.length === 0) {
      return miss('Please add at least one time you’re available.', '[data-need="availability"]');
    }
    if (field('image_paths').enabled && field('image_paths').required && photoPreviews.length === 0) {
      return miss('Please add at least one reference photo.', '[data-need="photos"]');
    }

    // Validate consent form templates — only enforce required ones
    for (const t of consentTemplates) {
      const required = t.is_required ?? true;
      if (!required) continue;
      const ts = templateState[t.id] ?? {};
      for (const f of (t.fields ?? [])) {
        if (f.required && ['text', 'textarea', 'yesno', 'photo_id'].includes(f.type)) {
          if (!ts.answers?.[f.id]) {
            return miss(`Please complete all required fields in "${t.name}".`, `[data-need="form-${t.id}"]`);
          }
        }
        if (f.required && f.type === 'checkbox' && !ts.answers?.[f.id]) {
          return miss(`Please check all required boxes in "${t.name}".`, `[data-need="form-${t.id}"]`);
        }
      }
      if (!ts.answers?.__agreed__) {
        return miss(`Please confirm you have read and agreed to "${t.name}".`, `[data-need="agree-${t.id}"]`);
      }
      if (t.requires_signature && !ts.sigBlob) {
        return miss(`Please sign "${t.name}".`, `[data-need="sign-${t.id}"]`);
      }
      if (isMinor) {
        if (!guardianName.trim()) return miss('Please provide the guardian\'s name.', `#guardian-name-${t.id}`);
        if (!ts.guardianSigBlob) return miss(`Guardian signature required for "${t.name}".`, `[data-need="guardian-sign-${t.id}"]`);
      }
    }
    const form = formRef.current;
    if (form && !form.checkValidity()) return miss('Please fill in everything marked *.', ':invalid');
    return '';
  }

  // Scrolls to what's still needed, focuses it and briefly highlights it.
  function showMissing() {
    const form = formRef.current;
    if (!form) return;
    const selector = missingTarget.current;
    let el = null;
    try { el = selector ? form.querySelector(selector) : null; } catch { el = null; }
    el = el || form.querySelector(':invalid');
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    const focusable = el.matches('input, select, textarea, button') ? el : el.querySelector('input, select, textarea, button');
    focusable?.focus({ preventScroll: true });
    el.classList.remove('bk-needs');
    void el.offsetWidth; // restart the highlight if it's already showing
    el.classList.add('bk-needs');
    window.setTimeout(() => el.classList.remove('bk-needs'), 1800);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    let bookingEmail = guestEmail.trim();
    if (!guest) {
      const { data: { session: currentSession } } = await getSupabase().auth.getSession();
      if (!currentSession || currentSession.user.id !== session?.user.id) {
        setSession(currentSession ?? null);
        setSubmitError('Please sign in again before requesting your booking.');
        return;
      }
      bookingEmail = currentSession.user.email?.trim() || '';
      if (!bookingEmail) { setSubmitError('Please sign in with an account that has an email address.'); return; }
    }
    const missing = missingRequirement(bookingEmail);
    if (missing) { showMissing(); return; }

    setSubmitError('');
    setSubmitting(true);
    try {
      // Upload reference photos → public walkin-images bucket
      let imagePaths = [];
      if (photos.length > 0) {
        const fileDescs = photos.map(f => ({ mime_type: f.type || 'image/jpeg', byte_size: f.size }));
        const slots = await walkinUploadSign(studioId, fileDescs);
        const uploads = await Promise.all(slots.map((slot, i) =>
          fetch(slot.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': photos[i].type || 'image/jpeg' },
            body: photos[i],
          })
        ));
        if (uploads.some(r => !r.ok)) throw new Error('Photo upload failed — please try again or remove the photos.');
        imagePaths = slots.map(s => s.storage_object_path);
      }

      // Upload signature PNG → private consent-signatures bucket
      async function uploadSignature(blob, label) {
        const [slot] = await signatureUploadSign(studioId, [{ mime_type: 'image/png', byte_size: blob.size }]);
        const resp = await fetch(slot.upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob });
        if (!resp.ok) throw new Error(`${label} upload failed — please try again.`);
        return slot.storage_object_path;
      }

      // Upload per-template signatures and build submissions
      const consentSubmissions = [];
      for (const t of consentTemplates) {
        const ts = templateState[t.id] ?? {};
        let clientSigPath = '';
        let guardianSigPath = '';

        if (t.requires_signature && ts.sigBlob) {
          clientSigPath = await uploadSignature(ts.sigBlob, `Signature for "${t.name}"`);
        }
        if (isMinor && ts.guardianSigBlob) {
          guardianSigPath = await uploadSignature(ts.guardianSigBlob, `Guardian signature for "${t.name}"`);
        }

        consentSubmissions.push({
          template_id:            t.id,
          answers:                await uploadPhotoIdAnswers(ts.answers ?? {}, file => signStudioPhotoId(process.env.NEXT_PUBLIC_BACKEND_URL, studioId, file)),
          is_minor:               isMinor,
          signer_name:            clientName,
          client_signature_path:  clientSigPath,
          guardian_name:          isMinor ? guardianName : '',
          guardian_relationship:  isMinor ? guardianRelationship : '',
          guardian_email:         isMinor ? guardianEmail : '',
          guardian_phone:         isMinor ? guardianPhone : '',
          guardian_signature_path: guardianSigPath,
        });
      }

      const created = await (walkIn ? createWalkInBooking : guest ? createGuestStudioBooking : createWalkIn)(studioId, {
        artist_id:            artistId,
        name:                 clientName,
        email: bookingEmail,
        phone: bookingPhone,
        sms_reminder_opt_in: smsOptIn,
        marketing_opt_in: offersOptIn,
        dob,
        skin_tone:            isPiercing ? '' : skinTone,

        session_type:         isPiercing ? 'piercing' : retouch ? 'retouch' : '',
        body_location:        placements.join(', '),
        design_details:       design,
        size:                 !isPiercing && size.trim() ? `${size.trim()}${sizeUnit}` : '',
        color:                isPiercing ? '' : colorStyle === 'Color' && colorDetails.trim() ? `Color (${colorDetails.trim()})` : colorStyle,
        notes,
        allergies:            hasAllergies ? (allergyDetails.trim() || 'Yes') : '',
        ...(formConfig?.address?.enabled ? { address_parts: addressPayload(address) } : {}),
        availability_windows: field('availability_windows').enabled
          ? [...availability].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
          : [],
        earliest_date:        field('availability_windows').enabled ? earliestDate : '',
        image_paths:          imagePaths,
        consent_accepted:     consentSubmissions.length > 0,
        consent_submissions:  consentSubmissions,
        ...(instantMode ? { instant: { appointment_type_id: instantType, start_time: instantStart, return_url: returnURL(window.location.href) } } : {}),
      });
      if (instantMode && created?.instant?.checkout_url) {
        // The time is held: pay the deposit to lock it in.
        if (!guest) getSupabase().auth.updateUser({ data: { full_name: clientName, name: clientName, dob, phone: bookingPhone } }).catch(() => {});
        window.location.assign(created.instant.checkout_url);
        return;
      }
      // Match consent: remember reviewed details for the next visit.
      if (!guest) getSupabase().auth.updateUser({ data: { full_name: clientName, name: clientName, dob, phone: bookingPhone } }).catch(() => {});
      if (walkIn) setBookedArtist(studio.artists.find(a => a.artistId === artistId)?.name || '');
      setDone(true);
    } catch (err) {
      if (instantMode && err.status === 409) setInstantStart('');
      setSubmitError(err.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  }

  function bookAgain() {
    window.location.assign(returnURL(window.location.href));
  }

  if (!studioId) return <p style={s.msg}>Invalid link — no studio ID.</p>;
  if (studioErr) return <p role="alert" style={{ ...s.msg, color: 'var(--color-danger)' }}>{studioErr}</p>;
  if (!studio || formConfig === null) return <BrandLoader />;
  const blocker = studio && !done ? missingRequirement() : '';

  if (payment) {
    const zone = instantInfo?.timezone || studio.timezone;
    return (
      <div style={s.card} aria-live="polite">
        {payment.state === 'checking' && <><h2 style={s.successTitle}>{payment.result === 'paid' ? 'Confirming your booking…' : 'One moment…'}</h2><p style={s.successSub}>This only takes a few seconds.</p></>}
        {payment.state === 'booked' && <>
          <div style={s.successIcon}>✓</div>
          <h2 style={s.successTitle}>You’re booked in</h2>
          <p style={s.successSub}>{payment.chosen_time && zone ? `${formatWhen(payment.chosen_time, zone)} at ${studio.name}. ` : ''}Your deposit is paid and a confirmation is on its way to your email.</p>
        </>}
        {payment.state === 'waiting' && <>
          <div style={s.successIcon}>✓</div>
          <h2 style={s.successTitle}>Payment received</h2>
          <p style={s.successSub}>We’re confirming your booking now. You’ll get an email as soon as it’s done.</p>
        </>}
        {payment.state === 'processing' && <>
          <div style={s.successIcon}>✓</div>
          <h2 style={s.successTitle}>Your bank payment is on its way</h2>
          <p style={s.successSub}>{payment.chosen_time && zone ? `${formatWhen(payment.chosen_time, zone)} at ${studio.name} is held for you. ` : 'Your time is held for you. '}Bank payments can take a little while to arrive. You’ll get an email as soon as it has and you’re booked in.</p>
        </>}
        {payment.state === 'closed' && <>
          <h2 style={s.successTitle}>This time is no longer held</h2>
          <p style={s.successSub}>The hold ran out before payment finished, so you haven’t been charged for it. Pick a time again to book.</p>
          <Button onClick={bookAgain}>Pick a time</Button>
        </>}
        {payment.state === 'released' && <>
          <h2 style={s.successTitle}>Payment cancelled</h2>
          <p style={s.successSub}>You haven’t been charged and the time wasn’t booked. You can pick a time again whenever you’re ready.</p>
          <Button onClick={bookAgain}>Book again</Button>
        </>}
      </div>
    );
  }

  if (!walkIn && session === undefined) return <BrandLoader />;
  if (!session && !guest) return <ClientAuthGate studioId={studioId} studioName={studio.name} logoUrl={studio.logo_url} purpose="booking" onGuest={() => setGuestChosen(true)} />;
  if (!guest && accountError) return <div style={s.card}><p role="alert" style={s.error}>{accountError}</p><Button onClick={() => setAccountRetry(value => value + 1)}>Try again</Button></div>;
  if (!guest && !accountReady) return <BrandLoader />;

  if (done && walkIn) {
    return (
      <div style={s.card}>
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>You're booked in!</h2>
        <p style={s.successSub}>{bookedArtist ? `${bookedArtist} will be with you shortly.` : 'Your artist will be with you shortly.'} Take a seat and let the front desk know you're here.</p>
        {/* Studios often leave this on a shared iPad: start fresh for the next client. */}
        <Button variant="secondary" onClick={() => window.location.reload()}>Start a new walk-in</Button>
      </div>
    );
  }

  if (done) {
    return (
      <div style={s.card}>
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>You're on the list!</h2>
        <p style={s.successSub}>Your booking request has been sent to {studio.name}. They'll confirm your spot shortly.</p>
      </div>
    );
  }

  return (
    <div style={s.card}>
      {guest && !walkIn && (
        <button type="button" onClick={leaveGuest} style={s.backBtn} aria-label="Back to sign-in options">
          <span aria-hidden="true" style={{ fontSize: '1.1rem', lineHeight: 1 }}>←</span> Back
        </button>
      )}
      <div style={s.studioHeader}>
        {studio.logo_url && <img src={studio.logo_url} alt={`${studio.name} logo`} style={{ maxHeight: 64, maxWidth: 220, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: '0.5rem' }} />}
        <span style={s.studioLabel}>{walkIn ? 'Walk-in' : 'Studio booking'}</span>
        <h1 style={s.studioName}>{studio.name}</h1>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} onInput={() => setValidityTick(n => n + 1)} onChange={() => setValidityTick(n => n + 1)} style={s.form}>
          {!guest && <ClientAccountActions email={session.user.email} />}

          <Section title="Your details" first>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>{walkIn ? `${studio.name} uses these details to contact you about your appointment.` : guest ? `You’re booking as a guest, no account needed. ${studio.name} uses these details to contact you about your booking.` : 'Review your details and update anything that has changed.'}</p>
            <div style={s.nameRow}>
              <Field label="First name">
                <input style={s.input} type="text" value={firstName} required autoComplete="given-name" onChange={e => setFirstName(e.target.value)} placeholder="First name" />
              </Field>
              <Field label="Last name">
                <input style={s.input} type="text" value={lastName} required autoComplete="family-name" onChange={e => setLastName(e.target.value)} placeholder="Last name" />
              </Field>
            </div>
            <Field label="Date of birth" required>
              <div data-need="dob"><DateOfBirthInput style={s.input} value={dob} onChange={setDob} /></div>
            </Field>
            <Field label="Email">
              {guest
                ? <input style={s.input} type="email" value={guestEmail} required autoComplete="email" inputMode="email" autoCapitalize="none" onChange={e => setGuestEmail(e.target.value)} placeholder="you@example.com" />
                : <><input style={s.input} type="email" value={session.user.email || ''} required readOnly autoComplete="email" placeholder="you@example.com" />{/@privaterelay\.appleid\.com$/i.test(session.user?.email || '') && <span style={{ display: 'block', marginTop: 6, color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>Your private Apple email. Messages are forwarded to your inbox.</span>}</>}
            </Field>
            <Field label="Phone" id="booking-phone" required>
              <div style={s.phoneRow}>
                <select
                  aria-label="Phone country code"
                  style={{ ...s.input, ...s.select, ...s.phoneCodeSelect }}
                  value={phoneCode}
                  onChange={e => setPhoneCode(e.target.value)}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.id} value={c.id}>{c.flag} {c.dial}</option>
                  ))}
                </select>
                <input
                  style={{ ...s.input, flex: 1 }}
                  id="booking-phone"
                  type="tel"
                  value={phoneNum}
                  required
                  onChange={e => setPhoneNum(e.target.value)}
                  placeholder="555 0100"
                />
              </div>
            </Field>
            {formConfig?.address?.enabled && field('address').enabled && (
              <div data-need="address"><AddressFields value={address} onChange={setAddress} required={field('address').required}
                inputStyle={s.input} classes={{ field: 'studio-field', label: 'studio-field-label' }}
                legendExtra={field('address').required ? null : <Optional />} /></div>
            )}
          </Section>

          {/* ── Your tattoo ── */}
          <Section title="Your appointment">
            {!walkIn && <Field label="Appointment type">
              <select style={{ ...s.input, ...s.select }} value={appointmentType} onChange={e => { setAppointmentType(e.target.value); setPlacements([]); }}>
                <option value="tattoo">Tattoo</option>
                <option value="piercing">Piercing</option>
              </select>
            </Field>}
            {walkIn && (
              <div data-need="artist"><ArtistChoice artists={studio.artists} value={artistId} onChange={setArtistId} /></div>
            )}
            {!walkIn && field('artist_id').enabled && (
              <Field label={<>{'Artist preference'}{field('artist_id').required ? null : <Optional />}</>}>
                <select style={{ ...s.input, ...s.select }} value={artistId} required={field('artist_id').required} onChange={e => setArtistId(e.target.value)}>
                  <option value="">{walkIn ? 'Choose your artist' : 'No preference — studio will assign'}</option>
                  {studio.artists.map(a => (
                    <option key={a.artistId} value={a.artistId}>
                      {a.name}{a.studioType === 'guest' ? ' (Guest)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {instantMode && (
              <p style={{ ...s.sectionHint, marginTop: '-0.25rem' }}>
                {studio.artists.find(a => a.artistId === artistId)?.name || 'This artist'} can be booked straight away: pick a time below and pay the deposit to lock it in.
              </p>
            )}

            {field('body_location').enabled && (
              <div data-need="placement" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={s.label}>
                  Placement{field('body_location').required ? <Required /> : null}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                    {placements.length}/3
                  </span>
                </label>
                <div style={s.chipGrid}>
                  {(isPiercing ? PIERCING_PLACEMENTS : PLACEMENTS).map(p => {
                    const active = placements.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={active}
                        disabled={!active && placements.length >= 3}
                        onClick={() => {
                          if (active) {
                            setPlacements(prev => prev.filter(x => x !== p));
                          } else if (placements.length < 3) {
                            setPlacements(prev => [...prev, p]);
                          }
                        }}
                        style={{ ...s.placementChip, ...(active ? s.placementChipActive : {}), ...(!active && placements.length >= 3 ? s.placementChipDisabled : {}) }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {field('design_details').enabled && (
              <Field label={<>{isPiercing ? 'Piercing details' : 'Design description'}{field('design_details').required ? null : <Optional />}</>}>
                <textarea style={{ ...s.input, ...s.textarea }} value={design} required={field('design_details').required} onChange={e => setDesign(e.target.value)} placeholder="Describe what you'd like…" />
              </Field>
            )}

            {!isPiercing && field('skin_tone').enabled && (
              <Field label={<>Skin tone{field('skin_tone').required ? null : <Optional />}</>}>
                <select style={{ ...s.input, ...s.select }} value={skinTone} required={field('skin_tone').required} onChange={e => setSkinTone(e.target.value)}>
                  <option value="">Select skin tone…</option>
                  {['Very light', 'Light', 'Medium', 'Olive', 'Brown', 'Dark'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            )}

            {!isPiercing && field('size').enabled && (
              <Field id="booking-size" required={field('size').required} label={<>Size{!field('size').required && <Optional />}</>}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    style={{ ...s.input, flex: 1 }}
                    type="number" min="0" step="0.1"
                    id="booking-size"
                    inputMode="decimal"
                    value={size}
                    required={field('size').required}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setSize(v); }}
                    onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                    placeholder="e.g. 10"
                  />
                  <div style={{ display: 'flex', background: 'rgba(var(--ink-rgb), 0.06)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(var(--ink-rgb), 0.1)', flexShrink: 0 }}>
                    {['cm', 'in'].map(u => (
                      <button
                        key={u} type="button" aria-pressed={sizeUnit === u}
                        onClick={() => setSizeUnit(u)}
                        style={{
                          padding: '0.55rem 0.75rem', border: 'none', cursor: 'pointer',
                          fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
                          background: sizeUnit === u ? 'rgba(var(--ink-rgb), 0.15)' : 'transparent',
                          color: sizeUnit === u ? 'var(--text)' : 'rgba(var(--ink-rgb), 0.4)',
                        }}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            )}

            {!isPiercing && field('retouch').enabled && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={retouch} onChange={e => setRetouch(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--cf-accent)', cursor: 'pointer' }} />
                This is a touch-up / retouch
              </label>
            )}

            {!isPiercing && !walkIn && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={s.label}>Colour</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[['Black & Grey', 'Black & grey'], ['Color', 'Colour']].map(([opt, label]) => {
                  const active = colorStyle === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setColorStyle(active ? '' : opt)}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0',
                        border: `1px solid ${active ? 'rgba(var(--ink-rgb), 0.45)' : 'rgba(var(--ink-rgb), 0.1)'}`,
                        borderRadius: 8,
                        background: active ? 'rgba(var(--ink-rgb), 0.13)' : 'rgba(var(--ink-rgb), 0.05)',
                        color: active ? 'var(--text)' : 'rgba(var(--ink-rgb), 0.55)',
                        fontSize: '0.85rem',
                        fontWeight: active ? 600 : 500,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {colorStyle === 'Color' && (
                <input style={{ ...s.input, marginTop: '0.3rem' }} type="text" aria-label="Which colours?" maxLength={200}
                  value={colorDetails} onChange={e => setColorDetails(e.target.value)} placeholder="Which colours? e.g. deep red, gold highlights" />
              )}
            </div>

            }

            {field('notes').enabled && (
              <Field label={<>Additional notes{field('notes').required ? null : <Optional />}</>}>
                <textarea style={{ ...s.input, ...s.textarea }} value={notes} required={field('notes').required} onChange={e => setNotes(e.target.value)} placeholder="Anything else the artist should know" />
              </Field>
            )}

            {field('allergies').enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasAllergies} onChange={e => { setHasAllergies(e.target.checked); if (!e.target.checked) setAllergyDetails(''); }} style={{ width: 16, height: 16, accentColor: 'var(--cf-accent)', cursor: 'pointer' }} />
                  I have allergies or sensitivities{field('allergies').required ? '' : ' (optional)'}
                </label>
                {hasAllergies && (
                  <textarea
                    style={{ ...s.input, ...s.textarea }}
                    aria-label="Allergies or sensitivities" value={allergyDetails}
                    required={field('allergies').required}
                    onChange={e => setAllergyDetails(e.target.value)}
                    placeholder="Please describe your allergies or sensitivities…"
                  />
                )}
              </div>
            )}
          </Section>

          {/* ── Instant booking: one of the artist's open times ── */}
          {instantMode && (
            <Section title="Pick a time" need="time">
              <InstantTimePicker backend={process.env.NEXT_PUBLIC_BACKEND_URL} artistId={artistId} info={instantInfo}
                typeId={instantType} onType={setInstantType} start={instantStart} onStart={setInstantStart} />
            </Section>
          )}

          {/* ── Weekly availability ── */}
          {field('availability_windows').enabled && (
            <Section title="Your availability" need="availability">
              <Field label={<>Earliest date you can come in<Optional /></>}>
                <input
                  type="date" className="cf-date" style={s.input} value={earliestDate}
                  min={new Date().toLocaleDateString('en-CA')}
                  onChange={e => setEarliestDate(e.target.value)}
                />
              </Field>
              <p style={s.sectionHint}>
                Which hours usually suit you each week?{' '}
                {availabilityForArtist ? 'Required, so your artist can send you times.' : field('availability_windows').required ? 'Required.' : 'Optional.'}
              </p>
              <WeeklyAvailabilityGrid value={availability} onChange={setAvailability} hours={studioHours} />
            </Section>
          )}

          {/* ── Reference photos ── */}
          {field('image_paths').enabled && (
            <Section title="Reference photos" need="photos">
              <p style={s.sectionHint}>{field('image_paths').required ? 'Required — up to 5 images' : 'Optional — up to 5 images'}</p>
              <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={handlePhotoChange} />
              <Button variant="secondary" onClick={() => photoInputRef.current?.click()}>+ Add photos</Button>
              {photoPreviews.length > 0 && (
                <div style={s.photoGrid}>
                  {photoPreviews.map((url, i) => (
                    <div key={i} style={s.photoThumb}>
                      <img src={url} alt="" style={s.thumbImg} />
                      <button type="button" aria-label={`Remove reference photo ${i + 1}`} style={s.thumbRemove} onClick={() => removePhoto(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ── Consent forms ── */}
          {consentTemplates.map(t => {
                const ts = templateState[t.id] ?? {};
                return (
                  <Section key={t.id} title={walkIn ? null : t.name} need={`form-${t.id}`}>

                    {(t.fields ?? []).map(field => (
                      <ConsentFormField
                        key={field.id}
                        field={field}
                        value={ts.answers?.[field.id] ?? ''}
                        onChange={v => setTemplateAnswer(t.id, field.id, v)}
                      />
                    ))}

                    {/* Always-required agreement checkbox */}
                    <label data-need={`agree-${t.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!ts.answers?.__agreed__}
                        onChange={e => setTemplateAnswer(t.id, '__agreed__', e.target.checked ? 'true' : '')}
                        style={{ accentColor: 'var(--cf-accent)', flexShrink: 0, marginTop: 2 }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                        I have read and agreed to the above <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </span>
                    </label>

                    {isMinor && (
                      <div style={s.guardianBox}>
                        <p style={s.guardianTitle}>Parent / Guardian Consent Required</p>
                        <p style={{ ...s.consentText, marginBottom: '0.75rem' }}>
                          The client is under 18. A parent or legal guardian must provide their details and sign below.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label htmlFor={`guardian-name-${t.id}`} style={s.label}>Guardian name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                              <input id={`guardian-name-${t.id}`} style={s.input} type="text" value={guardianName} required
                                onChange={e => setGuardianName(e.target.value)} placeholder="Full name" />
                            </div>
                            <div>
                              <label htmlFor={`guardian-relationship-${t.id}`} style={s.label}>Relationship</label>
                              <select id={`guardian-relationship-${t.id}`} style={{ ...s.input, ...s.select }} value={guardianRelationship} onChange={e => setGuardianRelationship(e.target.value)}>
                                <option>Parent</option>
                                <option>Legal Guardian</option>
                                <option>Other</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label htmlFor={`guardian-email-${t.id}`} style={s.label}>Guardian email</label>
                            <input id={`guardian-email-${t.id}`} style={s.input} type="email" value={guardianEmail}
                              onChange={e => setGuardianEmail(e.target.value)} placeholder="guardian@example.com" />
                          </div>
                          <div>
                            <label htmlFor={`guardian-phone-${t.id}`} style={s.label}>Guardian phone</label>
                            <input id={`guardian-phone-${t.id}`} style={s.input} type="tel" value={guardianPhone}
                              onChange={e => setGuardianPhone(e.target.value)} placeholder="Phone number" />
                          </div>
                          <div data-need={`guardian-sign-${t.id}`}>
                            <label style={s.label}>Guardian signature <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <SignaturePad label="Guardian signature" onCapture={blob => setTemplateGuardianSigBlob(t.id, blob)} />
                          </div>
                        </div>
                      </div>
                    )}

                    {t.requires_signature && (
                      <div data-need={`sign-${t.id}`}>
                        <label style={s.label}>{isMinor ? 'Client signature' : 'Signature'} <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.4rem', lineHeight: 1.5 }}>By signing, I agree that my electronic signature is legally binding and I consent to sign this form electronically.</p>
                        <SignaturePad onCapture={blob => setTemplateSigBlob(t.id, blob)} />
                      </div>
                    )}
                  </Section>
                );
              })}

          {/* ── Submit ── */}
          <div style={s.submitSection}>
            {!walkIn && <label style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.6, marginBottom: 24, color: 'var(--text)' }}>
              <input type="checkbox" checked={smsOptIn} onChange={e => setSMSOptIn(e.target.checked)} />
              Send me one SMS reminder before this appointment. Optional; I can stop SMS reminders using the link in the message.
            </label>}
            {!walkIn && <label style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.6, marginTop: -12, marginBottom: 24, color: 'var(--text)' }}>
              <input type="checkbox" checked={offersOptIn} onChange={e => setOffersOptIn(e.target.checked)} />
              Send me offers and updates from {studio.name} by email and text. Optional; I can unsubscribe at any time.
            </label>}
            {submitError && <p role="alert" style={s.error}>{submitError}</p>}
            {/* What's still missing sits right above the button; tapping either goes to it. */}
            {blocker && !submitError && (
              <div id="booking-blocker" role="status" style={s.blocker}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: 'none', marginTop: 1 }}>
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 4.75v3.75M8 11h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontWeight: 650 }}>Still needed</strong>
                  {blocker}
                </span>
                <button type="button" onClick={showMissing} style={s.blockerGo}>Show me</button>
              </div>
            )}
            <Button type="submit" loading={submitting} loadingLabel="Submitting…" fullWidth aria-describedby={blocker ? 'booking-blocker' : undefined}
              onClick={blocker ? e => { e.preventDefault(); showMissing(); } : undefined}
              style={blocker ? { opacity: 0.55 } : undefined}>{walkIn ? 'Book me in' : instantMode ? (instantChoice && instantStart ? `Pay ${money(depositCharge(instantChoice.deposit).total)}` : 'Book and pay deposit') : 'Request booking'}</Button>
            {instantMode && instantChoice && instantStart && <p style={{ ...s.sectionHint, marginTop: 10, textAlign: 'center' }}>{formatWhen(instantStart, instantInfo.timezone)}. Your time is held for 30 minutes while you pay. {instantInfo.fee_absorbed
              ? <>{formatMoney(instantChoice.deposit)} deposit in total. {BOOKING_FEE_COVERED_NOTE} {payWays(false)}</>
              : <>{formatMoney(instantChoice.deposit)} deposit + {money(depositCharge(instantChoice.deposit).fee)} Vanta booking fee = {money(depositCharge(instantChoice.deposit).total)} in total. {BOOKING_FEE_NOTE} {payWays(false)}</>}</p>}
          </div>

        </form>
    </div>
  );
}

// Renders a single field from a consent template
function ConsentFormField({ field, value, onChange }) {
  const labelStyle = {
    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
    display: 'flex', gap: '0.25rem', alignItems: 'center',
  };
  switch (field.type) {
    case 'heading':
      return <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--cf-accent)', margin: 0 }}>{field.label}</p>;
    case 'paragraph':
      return <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.65, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{field.label}</p>;
    case 'checkbox':
      return (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked ? 'true' : '')}
            style={{ accentColor: 'var(--cf-accent)', flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            {field.label}{field.required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
          </span>
        </label>
      );
    case 'photo_id':
      return <PhotoIdField label={field.label} required={field.required} value={value} onChange={onChange} labelStyle={labelStyle} />;
    case 'yesno':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={labelStyle}>
            {field.label}{field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['Yes', 'No'].map(opt => (
              <button key={opt} type="button" aria-pressed={value === opt}
                onClick={() => onChange(opt)}
                style={{
                  padding: '0.45rem 1.2rem', borderRadius: 8,
                  border: `1px solid ${value === opt ? 'var(--cf-accent)' : 'rgba(var(--ink-rgb), 0.12)'}`,
                  background: value === opt ? 'var(--cf-accent-soft)' : 'rgba(var(--ink-rgb), 0.04)',
                  color: value === opt ? 'var(--cf-accent)' : 'rgba(var(--ink-rgb), 0.5)',
                  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{opt}</button>
            ))}
          </div>
        </div>
      );
    case 'textarea':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={labelStyle}>
            {field.label}{field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
          </span>
          <textarea aria-label={field.label} required={field.required} style={{ ...s.input, minHeight: 70, resize: 'vertical' }}
            value={value} onChange={e => onChange(e.target.value)} placeholder="Your answer…" />
        </div>
      );
    default: // 'text'
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={labelStyle}>
            {field.label}{field.required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
          </span>
          <input type="text" aria-label={field.label} required={field.required} style={s.input} value={value} onChange={e => onChange(e.target.value)} placeholder="Your answer…" />
        </div>
      );
  }
}

function SignaturePad({ onCapture, label = 'Client signature' }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
  }

  function startDraw(e) {
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    // The signature is drawn in the studio's highlight colour (canvas can't read CSS variables).
    ctx.strokeStyle = getComputedStyle(canvasRef.current).getPropertyValue('--cf-accent').trim() || '#d5d0c7';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasDrawn(true);
  }

  function endDraw() {
    if (!drawing) return;
    setDrawing(false);
    if (hasDrawn) signatureBlob(canvasRef.current, blob => onCapture(blob));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onCapture(null);
  }

  return (
    <div style={s.sigWrap}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${label}: draw using a pointer or touch`}
        width={440}
        height={140}
        style={s.sigCanvas}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <div style={s.sigFooter}>
        <span style={s.sigHint}>Draw your signature above</span>
        <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={clear} style={s.sigClear}>Clear</button>
      </div>
    </div>
  );
}

function Required() {
  return <span aria-hidden="true" style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>;
}

// Walk-ins pick their artist from a custom dropdown, not a native <select>: on some
// iPhones the native picker didn't keep the choice. Tapping the field opens the list;
// choosing an artist closes it.
function ArtistChoice({ artists: all, value, onChange }) {
  const [open, setOpen] = useState(false);
  // Artists who aren't working here today stay listed (clients look for them by name)
  // but can't be chosen, and sit below the ones who are in.
  const away = a => a.workingToday === false;
  const artists = [...all.filter(a => !away(a)), ...all.filter(away)];
  const noneIn = artists.length > 0 && artists.every(away);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const selected = artists.find(a => a.artistId === value);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const onDown = e => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function choose(id) {
    onChange(id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0 }}>
      <span id="walkin-artist-label" style={s.label}>Artist <span aria-hidden="true">*</span></span>
      <button
        ref={triggerRef}
        type="button"
        className="walkin-artist-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="walkin-artist-label walkin-artist-value"
        disabled={artists.length === 0}
        onClick={() => setOpen(o => !o)}
        style={{
          ...s.input, display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: 48, textAlign: 'left', cursor: 'pointer',
          border: open ? '1px solid var(--cf-accent)' : s.input.border, fontFamily: 'inherit', width: '100%', WebkitTapHighlightColor: 'transparent',
        }}
      >
        {selected && <ArtistAvatar artist={selected} size={26} />}
        <span id="walkin-artist-value" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected ? 'var(--text)' : 'var(--text-muted)' }}>
          {selected ? selected.name : 'Choose your artist'}
        </span>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0, opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }}>
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div ref={listRef} role="listbox" aria-labelledby="walkin-artist-label" style={{
          display: 'flex', flexDirection: 'column', padding: '0.3rem', borderRadius: 10, maxHeight: 320, overflowY: 'auto',
          background: 'var(--bg-modal)', border: '1px solid rgba(var(--ink-rgb), 0.12)', boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
        }}>
          {artists.map(a => {
            const on = value === a.artistId;
            const out = away(a);
            return (
              <button
                key={a.artistId}
                type="button"
                role="option"
                aria-selected={on}
                aria-disabled={out || undefined}
                disabled={out}
                className="walkin-artist-option"
                onClick={() => { if (!out) choose(a.artistId); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: 48, padding: '0.45rem 0.6rem', borderRadius: 8,
                  border: 0, cursor: out ? 'not-allowed' : 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--text)',
                  background: on ? 'var(--cf-accent-soft)' : 'transparent', WebkitTapHighlightColor: 'transparent', opacity: out ? 0.5 : 1,
                }}
              >
                <ArtistAvatar artist={a} size={32} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{a.name}</span>
                  {(out || a.studioType === 'guest') && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{[out && 'Not in today', a.studioType === 'guest' && 'Guest artist'].filter(Boolean).join(' · ')}</span>}
                </span>
                {on && (
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, color: 'var(--cf-accent)' }}>
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
      {artists.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No artists are available right now. Please ask at the front desk.</p>}
      {noneIn && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>None of our artists are in today. Please ask at the front desk.</p>}
    </div>
  );
}

function ArtistAvatar({ artist, size }) {
  if (artist.profileImage) {
    return <img src={artist.profileImage} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  const initials = (artist.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(var(--ink-rgb), 0.08)', color: 'rgba(var(--ink-rgb), 0.75)' }}>{initials}</span>
  );
}

function Optional() {
  return <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>;
}

function Section({ title, children, first = false, need }) {
  return (
    <div data-need={need} style={{
      display: 'flex', flexDirection: 'column', gap: '0.9rem',
      borderTop: first ? 'none' : '1px solid rgba(var(--ink-rgb), 0.06)',
      paddingTop: first ? 0 : '1.5rem',
    }}>
      {title && <span style={s.sectionTitle}>{title}</span>}
      {children}
    </div>
  );
}

export default function BookingIntakePage({ mode = 'booking' }) {
  // The studio's form colours, once its details load.
  const [style, setStyle] = useState(null);
  return (
    <div data-theme={formThemeMode(style)} style={{ ...s.page, ...formTheme(style, { card: '#ffffff', page: '#f6f5f2' }) }}>
      <Suspense fallback={<BrandLoader />}>
        <IntakeInner mode={mode} onStyle={setStyle} />
      </Suspense>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--cf-page)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '2rem 1rem 4rem',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: 'var(--cf-card)',
    border: '1px solid rgba(var(--ink-rgb), 0.08)',
    borderRadius: 16,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    minHeight: 44, margin: '-0.75rem 0 -0.75rem -0.6rem', padding: '0 0.6rem',
    background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer',
    color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit',
  },
  studioHeader: {
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    paddingBottom: '1.25rem',
    borderBottom: '1px solid rgba(var(--ink-rgb), 0.06)',
  },
  studioLabel: {
    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
  },
  studioName: {
    fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)',
    margin: 0, letterSpacing: '-0.02em',
  },
  studioAddress: {
    fontSize: '0.78rem', color: 'var(--text-muted)',
  },
  authIntro: {
    fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0,
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '1.5rem',
  },
  sectionTitle: {
    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
  },
  sectionHint: {
    fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0,
  },
  submitSection: {
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    borderTop: '1px solid rgba(var(--ink-rgb), 0.06)', paddingTop: '1.5rem',
  },
  label: {
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
  },
  input: {
    background: 'rgba(var(--ink-rgb), 0.05)',
    border: '1px solid rgba(var(--ink-rgb), 0.1)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: '0.875rem',
    minHeight: 44,
    padding: '0.65rem 0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  phoneRow: {
    display: 'flex', gap: '0.5rem',
  },
  phoneCodeSelect: {
    width: 'auto', flexShrink: 0,
  },
  // Dropdowns drop Safari's native look (on iPhone it ignores the field's height and
  // colours and draws a small grey control) and use the same box plus a chevron.
  select: {
    WebkitAppearance: 'none', appearance: 'none', colorScheme: 'inherit',
    paddingRight: '2rem', cursor: 'pointer',
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.85rem center',
  },
  textarea: {
    minHeight: 90,
    resize: 'vertical',
  },

  chipGrid: {
    display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
  },
  placementChip: {
    background: 'rgba(var(--ink-rgb), 0.05)',
    border: '1px solid rgba(var(--ink-rgb), 0.1)',
    borderRadius: 20,
    color: 'var(--text-dim)',
    fontSize: '0.78rem', fontWeight: 500,
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  placementChipActive: {
    background: 'var(--cf-accent-soft)',
    border: '1px solid var(--cf-accent-line)',
    color: 'var(--cf-accent)',
  },
  placementChipDisabled: {
    opacity: 0.3,
    cursor: 'default',
  },

  photoGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' },
  photoThumb: { position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(var(--ink-rgb), 0.1)' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbRemove: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  nameRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.9rem' },
  blocker: {
    display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.75rem 0.85rem', borderRadius: 12,
    background: 'var(--color-warning-surface)', border: '1px solid var(--color-warning-border)', color: 'var(--color-warning)',
    fontSize: '0.85rem', lineHeight: 1.45,
  },
  blockerGo: {
    flex: 'none', alignSelf: 'center', background: 'none', border: 'none', padding: '0.25rem 0', cursor: 'pointer', boxShadow: 'none',
    font: 'inherit', fontWeight: 650, color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3,
  },
  sigWrap: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  sigCanvas: { width: '100%', height: 140, borderRadius: 8, background: 'rgba(var(--ink-rgb), 0.04)', border: '1px solid rgba(var(--ink-rgb), 0.12)', display: 'block', touchAction: 'none', cursor: 'crosshair' },
  sigFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sigHint: { fontSize: '0.7rem', color: 'var(--text-muted)' },
  sigClear: { background: 'none', border: 'none', fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.15rem 0', fontFamily: 'inherit' },
  consentText: { fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.65, maxHeight: 160, overflowY: 'auto' },
  consentCheck: { display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--text-dim)', cursor: 'pointer' },
  formTypeBadge: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: 4 },
  formTypeBadgeColors: {
    consent: { background: 'var(--cf-accent-soft)', color: 'var(--cf-accent)' },
    waiver:  { background: 'rgba(232,111,111,0.12)', color: 'var(--color-danger)' },
    health:  { background: 'rgba(76,201,138,0.12)', color: 'var(--color-success)' },
  },
  guardianBox: {
    background: 'var(--cf-accent-soft)', border: '1px solid var(--cf-accent-line)',
    borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem',
  },
  guardianTitle: { fontSize: '0.8rem', fontWeight: 700, color: 'var(--cf-accent)', margin: 0 },
  switchLink: {
    background: 'none', border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem', cursor: 'pointer',
    textAlign: 'center', padding: '0.25rem',
    fontFamily: 'inherit',
  },
  error: {
    fontSize: '0.78rem', color: 'var(--color-danger)', margin: 0,
  },
  msg: {
    color: 'var(--text-muted)', fontSize: '0.875rem', padding: '2rem',
  },
  successIcon: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'rgba(76,201,138,0.15)',
    color: 'var(--color-success)',
    fontSize: '1.4rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  successTitle: {
    fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', margin: 0,
  },
  successSub: {
    fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6,
  },
};
