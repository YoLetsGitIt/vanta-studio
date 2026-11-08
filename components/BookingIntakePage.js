'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Field from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import ClientAuthGate from '@/components/ClientAuthGate';
import ClientAccountActions from '@/components/ClientAccountActions';
import DateOfBirthInput from '@/components/ui/DateOfBirthInput';
import { ensureClientProfile, subscribeClientSession } from '@/lib/client-account';
import { getSupabase } from '@/lib/supabase';
import WeeklyAvailabilityGrid from '@/components/WeeklyAvailabilityGrid';
import PhotoIdField from '@/components/PhotoIdField';
import { uploadPhotoIdAnswers, signStudioPhotoId } from '@/lib/photoId';
import { getStudioPublic, createWalkIn, createGuestStudioBooking, createWalkInBooking, getWalkInFormConfigPublic, getStudioHoursPublic, walkinUploadSign, signatureUploadSign, getStudioConsentTemplates, getFormConfigPublic } from '@/lib/api';

import { COUNTRIES, detectCountry } from '@/lib/phoneCountries';
import { formTheme } from '@/lib/formTheme';

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
        setFullName(details.name);
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
  const [fullName, setFullName]     = useState('');
  // Walk-ins give first and last name separately; everything else uses one name field.
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const clientName = walkIn ? `${firstName.trim()} ${lastName.trim()}`.trim() : fullName.trim();
  const [phoneCode, setPhoneCode]   = useState(() => detectCountry());
  const [phoneNum,  setPhoneNum]    = useState('');
  const [smsOptIn, setSMSOptIn] = useState(false);
  const [dob, setDob]               = useState('');
  const [skinTone, setSkinTone]     = useState('');

  const [artistId, setArtistId]     = useState('');
  const [placements, setPlacements]  = useState([]);
  const [design, setDesign]         = useState('');
  const [size, setSize]             = useState('');
  const [sizeUnit, setSizeUnit]     = useState('cm');
  const [colorStyle, setColorStyle] = useState('');
  const [appointmentType, setAppointmentType] = useState('tattoo');
  const isPiercing = appointmentType === 'piercing';
  const [retouch, setRetouch]       = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergyDetails, setAllergyDetails] = useState('');
  const [notes, setNotes]           = useState('');
  // When the studio's form asks for it (kept on the client's record).
  const [address, setAddress]       = useState('');
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
  const [, setValidityTick] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone]             = useState(false);
  const bookingPhone = phoneNum.trim().startsWith('+') ? phoneNum.trim() : `${COUNTRIES.find(c => c.id === phoneCode)?.dial ?? ''} ${phoneNum}`.trim();

  const availabilityForArtist = !walkIn && studio?.booking_management === 'artist' && Boolean(artistId);
  // field(key) returns {enabled, required} from the loaded config, defaulting to enabled/not-required
  function field(key) {
    if (walkIn) {
      // Walk-ins always choose their artist; extras are only what the studio switched on.
      if (key === 'artist_id') return { enabled: true, required: true };
      return formConfig?.[key] ?? { enabled: false, required: false };
    }
    // At an "Artists confirm" studio, choosing an artist sends the request straight to
    // them, so the client gives their availability now for the artist to send times.
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
      onStyle?.(studioData?.form_style ?? null);
      setFormConfig(configData.fields ?? {});
      setConsentTemplates(consentData.templates ?? []);
    }).catch(e => setStudioErr(e.message));
  }, [studioId]);

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
  function missingRequirement(bookingEmail = guest ? guestEmail.trim() : session?.user?.email?.trim() || '') {
    if (walkIn && !firstName.trim()) return 'Please provide your first name.';
    if (walkIn && !lastName.trim()) return 'Please provide your last name.';
    if (!clientName) return 'Please provide your full name.';
    if (guest && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingEmail)) return 'Please provide a valid email address.';
    if (!phoneNum.trim()) return 'Please provide your phone number.';
    if (!dob) return 'Please provide your date of birth.';
    if (walkIn && !artistId) return 'Please choose your artist.';
    if (field('body_location').enabled && placements.length === 0) return 'Please select at least one placement.';
    if (field('availability_windows').enabled && field('availability_windows').required && availability.length === 0) {
      return 'Please add at least one time you’re available.';
    }

    // Validate consent form templates — only enforce required ones
    for (const t of consentTemplates) {
      const required = t.is_required ?? true;
      if (!required) continue;
      const ts = templateState[t.id] ?? {};
      for (const f of (t.fields ?? [])) {
        if (f.required && ['text', 'textarea', 'yesno', 'photo_id'].includes(f.type)) {
          if (!ts.answers?.[f.id]) {
            return `Please complete all required fields in "${t.name}".`;
          }
        }
        if (f.required && f.type === 'checkbox' && !ts.answers?.[f.id]) {
          return `Please check all required boxes in "${t.name}".`;
        }
      }
      if (!ts.answers?.__agreed__) {
        return `Please confirm you have read and agreed to "${t.name}".`;
      }
      if (t.requires_signature && !ts.sigBlob) {
        return `Please sign "${t.name}".`;
      }
      if (isMinor) {
        if (!guardianName.trim()) return 'Please provide the guardian\'s name.';
        if (!ts.guardianSigBlob) return `Guardian signature required for "${t.name}".`;
      }
    }
    const form = formRef.current;
    if (form && !form.checkValidity()) return 'Please fill in everything marked *.';
    return '';
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
    if (missing) { setSubmitError(missing); return; }

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

      await (walkIn ? createWalkInBooking : guest ? createGuestStudioBooking : createWalkIn)(studioId, {
        artist_id:            artistId,
        name:                 clientName,
        email: bookingEmail,
        phone: bookingPhone,
        sms_reminder_opt_in: smsOptIn,
        dob,
        skin_tone:            isPiercing ? '' : skinTone,

        session_type:         isPiercing ? 'piercing' : retouch ? 'retouch' : '',
        body_location:        placements.join(', '),
        design_details:       design,
        size:                 !isPiercing && size.trim() ? `${size.trim()}${sizeUnit}` : '',
        color:                isPiercing ? '' : colorStyle,
        notes,
        allergies:            hasAllergies ? (allergyDetails.trim() || 'Yes') : '',
        ...(formConfig?.address?.enabled ? { address: address.trim() } : {}),
        availability_windows: field('availability_windows').enabled
          ? [...availability].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
          : [],
        earliest_date:        field('availability_windows').enabled ? earliestDate : '',
        image_paths:          imagePaths,
        consent_accepted:     consentSubmissions.length > 0,
        consent_submissions:  consentSubmissions,
      });
      // Match consent: remember reviewed details for the next visit.
      if (!guest) getSupabase().auth.updateUser({ data: { full_name: fullName.trim(), name: fullName.trim(), dob, phone: bookingPhone } }).catch(() => {});
      if (walkIn) setBookedArtist(studio.artists.find(a => a.artistId === artistId)?.name || '');
      setDone(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!studioId) return <p style={s.msg}>Invalid link — no studio ID.</p>;
  if (studioErr) return <p role="alert" style={{ ...s.msg, color: 'var(--color-danger)' }}>{studioErr}</p>;
  if (!studio || formConfig === null) return <p style={s.msg}>Loading…</p>;
  const blocker = studio && !done ? missingRequirement() : '';

  if (!walkIn && session === undefined) return <p style={s.msg}>Checking your account…</p>;
  if (!session && !guest) return <ClientAuthGate studioId={studioId} studioName={studio.name} logoUrl={studio.logo_url} purpose="booking" onGuest={() => setGuestChosen(true)} />;
  if (!guest && accountError) return <div style={s.card}><p role="alert" style={s.error}>{accountError}</p><Button onClick={() => setAccountRetry(value => value + 1)}>Try again</Button></div>;
  if (!guest && !accountReady) return <p style={s.msg}>Loading your details…</p>;

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
            {walkIn ? (
              <div style={s.nameRow}>
                <Field label="First name">
                  <input style={s.input} type="text" value={firstName} required autoComplete="given-name" onChange={e => setFirstName(e.target.value)} placeholder="First name" />
                </Field>
                <Field label="Last name">
                  <input style={s.input} type="text" value={lastName} required autoComplete="family-name" onChange={e => setLastName(e.target.value)} placeholder="Last name" />
                </Field>
              </div>
            ) : (
              <Field label="Full name">
                <input style={s.input} type="text" value={fullName} required autoComplete="name" onChange={e => setFullName(e.target.value)} placeholder="Your name" />
              </Field>
            )}
            <Field label="Date of birth" required>
              <DateOfBirthInput style={s.input} value={dob} onChange={setDob} />
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
              <Field label={<>Address{field('address').required ? null : <Optional />}</>}>
                <input style={s.input} value={address} required={field('address').required} onChange={e => setAddress(e.target.value)} maxLength={300} autoComplete="street-address" placeholder="Street, suburb, state, postcode" />
              </Field>
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
              <ArtistChoice artists={studio.artists} value={artistId} onChange={setArtistId} />
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

            {field('body_location').enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
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
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                    {['cm', 'in'].map(u => (
                      <button
                        key={u} type="button" aria-pressed={sizeUnit === u}
                        onClick={() => setSizeUnit(u)}
                        style={{
                          padding: '0.55rem 0.75rem', border: 'none', cursor: 'pointer',
                          fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
                          background: sizeUnit === u ? 'rgba(255,255,255,0.15)' : 'transparent',
                          color: sizeUnit === u ? '#fff' : 'rgba(255,255,255,0.4)',
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
                        border: `1px solid ${active ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 8,
                        background: active ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.05)',
                        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
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

          {/* ── Weekly availability ── */}
          {field('availability_windows').enabled && (
            <Section title="Your availability">
              <Field label={<>Earliest date you can come in<Optional /></>}>
                <input
                  type="date" style={s.input} value={earliestDate}
                  min={new Date().toLocaleDateString('en-CA')}
                  onChange={e => setEarliestDate(e.target.value)}
                />
              </Field>
              <p style={s.sectionHint}>
                {availabilityForArtist ? 'Required, so your artist can send you times' : field('availability_windows').required ? 'Required' : 'Optional'} — which hours usually suit you each week?
                Press and drag down a day to mark the times that work, and tap a block to remove it.
              </p>
              <WeeklyAvailabilityGrid value={availability} onChange={setAvailability} hours={studioHours} />
            </Section>
          )}

          {/* ── Reference photos ── */}
          {field('image_paths').enabled && (
            <Section title="Reference photos">
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
                  <Section key={t.id} title={t.name}>

                    {(t.fields ?? []).map(field => (
                      <ConsentFormField
                        key={field.id}
                        field={field}
                        value={ts.answers?.[field.id] ?? ''}
                        onChange={v => setTemplateAnswer(t.id, field.id, v)}
                      />
                    ))}

                    {/* Always-required agreement checkbox */}
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
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
                          <div>
                            <label style={s.label}>Guardian signature <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                            <SignaturePad label="Guardian signature" onCapture={blob => setTemplateGuardianSigBlob(t.id, blob)} />
                          </div>
                        </div>
                      </div>
                    )}

                    {t.requires_signature && (
                      <div>
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
            {!walkIn && <label style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
              <input type="checkbox" checked={smsOptIn} onChange={e => setSMSOptIn(e.target.checked)} />
              Send me one SMS reminder before this appointment. Optional; I can stop SMS reminders using the link in the message.
            </label>}
            {submitError && <p role="alert" style={s.error}>{submitError}</p>}
            <Button type="submit" loading={submitting} loadingLabel="Submitting…" fullWidth disabled={!!blocker} aria-describedby={blocker ? 'booking-blocker' : undefined}>{walkIn ? 'Book me in' : 'Request booking'}</Button>
            {blocker && !submitError && <p id="booking-blocker" style={s.blocker}>{blocker}</p>}
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
                  border: `1px solid ${value === opt ? 'var(--cf-accent)' : 'rgba(255,255,255,0.12)'}`,
                  background: value === opt ? 'var(--cf-accent-soft)' : 'rgba(255,255,255,0.04)',
                  color: value === opt ? 'var(--cf-accent)' : 'rgba(255,255,255,0.5)',
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
    if (hasDrawn) canvasRef.current.toBlob(blob => onCapture(blob), 'image/png');
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

// Walk-ins pick their artist from tappable cards rather than a dropdown: on some
// iPhones the dropdown picker didn't keep the choice, and cards are quicker at a
// front desk. Built on radio buttons, so keyboards and screen readers work too.
function ArtistChoice({ artists, value, onChange }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
      <legend style={{ ...s.label, padding: 0, marginBottom: '0.45rem' }}>Artist <span aria-hidden="true">*</span></legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))', gap: '0.5rem' }}>
        {artists.map(a => {
          const on = value === a.artistId;
          const initials = (a.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
          return (
            <label key={a.artistId} className="walkin-artist-card" style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: 52, padding: '0.55rem 0.7rem', borderRadius: 10, cursor: 'pointer',
              background: on ? 'var(--cf-accent-soft)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${on ? 'var(--cf-accent)' : 'rgba(255,255,255,0.1)'}`,
              WebkitTapHighlightColor: 'transparent',
            }}>
              <input type="radio" name="walkin-artist" value={a.artistId} checked={on} required onChange={() => onChange(a.artistId)}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, margin: 0 }} />
              {a.profileImage
                ? <img src={a.profileImage} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}>{initials}</span>}
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', overflowWrap: 'anywhere' }}>{a.name}</span>
                {a.studioType === 'guest' && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Guest artist</span>}
              </span>
              <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${on ? 'var(--cf-accent)' : 'rgba(255,255,255,0.3)'}`, background: on ? 'var(--cf-accent)' : 'transparent', boxShadow: on ? 'inset 0 0 0 3px #1a1a1a' : 'none' }} />
            </label>
          );
        })}
      </div>
      {artists.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>No artists are available right now. Please ask at the front desk.</p>}
    </fieldset>
  );
}

function Optional() {
  return <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>;
}

function Section({ title, children, first = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.9rem',
      borderTop: first ? 'none' : '1px solid rgba(255,255,255,0.06)',
      paddingTop: first ? 0 : '1.5rem',
    }}>
      <span style={s.sectionTitle}>{title}</span>
      {children}
    </div>
  );
}

export default function BookingIntakePage({ mode = 'booking' }) {
  // The studio's form colours, once its details load.
  const [style, setStyle] = useState(null);
  return (
    <div style={{ ...s.page, ...formTheme(style, { card: 'rgba(255,255,255,0.03)', page: '#0e0e0e', accent: '#d5d0c7' }) }}>
      <Suspense fallback={<p style={s.msg}>Loading…</p>}>
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
    border: '1px solid rgba(255,255,255,0.08)',
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
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  studioLabel: {
    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
  },
  studioName: {
    fontSize: '1.5rem', fontWeight: 700, color: '#ffffff',
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
    borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem',
  },
  label: {
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
  },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#ffffff',
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
    WebkitAppearance: 'none', appearance: 'none', colorScheme: 'dark',
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
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
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
  photoThumb: { position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbRemove: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  nameRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.9rem' },
  blocker: { margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' },
  sigWrap: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  sigCanvas: { width: '100%', height: 140, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', display: 'block', touchAction: 'none', cursor: 'crosshair' },
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
    fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', margin: 0,
  },
  successSub: {
    fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6,
  },
};
