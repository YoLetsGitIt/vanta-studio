'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getStudioPublic, createWalkIn, walkinUploadSign, signatureUploadSign, getStudioConsentTemplates, getFormConfigPublic } from '@/lib/api';


function detectCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith('Australia/'))             return 'AU';
    if (tz.startsWith('Pacific/Auckland') || tz === 'Pacific/Chatham') return 'NZ';
    const map = {
      'Europe/London': 'GB',    'Europe/Paris': 'FR',     'Europe/Berlin': 'DE',
      'Europe/Vienna': 'AT',    'Europe/Brussels': 'BE',  'Europe/Athens': 'GR',
      'Europe/Dublin': 'IE',    'Europe/Rome': 'IT',      'Europe/Amsterdam': 'NL',
      'Europe/Oslo': 'NO',      'Europe/Warsaw': 'PL',    'Europe/Lisbon': 'PT',
      'Europe/Moscow': 'RU',    'Europe/Madrid': 'ES',    'Europe/Stockholm': 'SE',
      'Europe/Zurich': 'CH',    'Europe/Istanbul': 'TR',  'Europe/Helsinki': 'FI',
      'Europe/Copenhagen': 'DK',
      'Asia/Tokyo': 'JP',       'Asia/Seoul': 'KR',       'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK',   'Asia/Singapore': 'SG',   'Asia/Taipei': 'TW',
      'Asia/Bangkok': 'TH',     'Asia/Jakarta': 'ID',     'Asia/Kolkata': 'IN',
      'Asia/Kuala_Lumpur': 'MY','Asia/Manila': 'PH',      'Asia/Riyadh': 'SA',
      'Asia/Dubai': 'AE',       'Asia/Jerusalem': 'IL',
      'America/Sao_Paulo': 'BR','America/Mexico_City': 'MX',
      'America/Toronto': 'CA',  'America/Vancouver': 'CA','America/Winnipeg': 'CA',
      'America/Edmonton': 'CA', 'America/Halifax': 'CA',  'America/St_Johns': 'CA',
      'Africa/Johannesburg': 'ZA',
    };
    if (map[tz]) return map[tz];
    if (tz.startsWith('America/')) return 'US';
  } catch {}
  return 'US';
}

const COUNTRIES = [
  { id: 'AU', flag: '🇦🇺', name: 'Australia',      dial: '+61'  },
  { id: 'AT', flag: '🇦🇹', name: 'Austria',        dial: '+43'  },
  { id: 'BE', flag: '🇧🇪', name: 'Belgium',        dial: '+32'  },
  { id: 'BR', flag: '🇧🇷', name: 'Brazil',         dial: '+55'  },
  { id: 'CA', flag: '🇨🇦', name: 'Canada',         dial: '+1'   },
  { id: 'CN', flag: '🇨🇳', name: 'China',          dial: '+86'  },
  { id: 'DK', flag: '🇩🇰', name: 'Denmark',        dial: '+45'  },
  { id: 'FI', flag: '🇫🇮', name: 'Finland',        dial: '+358' },
  { id: 'FR', flag: '🇫🇷', name: 'France',         dial: '+33'  },
  { id: 'DE', flag: '🇩🇪', name: 'Germany',        dial: '+49'  },
  { id: 'GR', flag: '🇬🇷', name: 'Greece',         dial: '+30'  },
  { id: 'HK', flag: '🇭🇰', name: 'Hong Kong',      dial: '+852' },
  { id: 'IN', flag: '🇮🇳', name: 'India',          dial: '+91'  },
  { id: 'ID', flag: '🇮🇩', name: 'Indonesia',      dial: '+62'  },
  { id: 'IE', flag: '🇮🇪', name: 'Ireland',        dial: '+353' },
  { id: 'IL', flag: '🇮🇱', name: 'Israel',         dial: '+972' },
  { id: 'IT', flag: '🇮🇹', name: 'Italy',          dial: '+39'  },
  { id: 'JP', flag: '🇯🇵', name: 'Japan',          dial: '+81'  },
  { id: 'KR', flag: '🇰🇷', name: 'South Korea',    dial: '+82'  },
  { id: 'MY', flag: '🇲🇾', name: 'Malaysia',       dial: '+60'  },
  { id: 'MX', flag: '🇲🇽', name: 'Mexico',         dial: '+52'  },
  { id: 'NL', flag: '🇳🇱', name: 'Netherlands',    dial: '+31'  },
  { id: 'NZ', flag: '🇳🇿', name: 'New Zealand',    dial: '+64'  },
  { id: 'NO', flag: '🇳🇴', name: 'Norway',         dial: '+47'  },
  { id: 'PH', flag: '🇵🇭', name: 'Philippines',    dial: '+63'  },
  { id: 'PL', flag: '🇵🇱', name: 'Poland',         dial: '+48'  },
  { id: 'PT', flag: '🇵🇹', name: 'Portugal',       dial: '+351' },
  { id: 'RU', flag: '🇷🇺', name: 'Russia',         dial: '+7'   },
  { id: 'SA', flag: '🇸🇦', name: 'Saudi Arabia',   dial: '+966' },
  { id: 'SG', flag: '🇸🇬', name: 'Singapore',      dial: '+65'  },
  { id: 'ZA', flag: '🇿🇦', name: 'South Africa',   dial: '+27'  },
  { id: 'ES', flag: '🇪🇸', name: 'Spain',          dial: '+34'  },
  { id: 'SE', flag: '🇸🇪', name: 'Sweden',         dial: '+46'  },
  { id: 'CH', flag: '🇨🇭', name: 'Switzerland',    dial: '+41'  },
  { id: 'TW', flag: '🇹🇼', name: 'Taiwan',         dial: '+886' },
  { id: 'TH', flag: '🇹🇭', name: 'Thailand',       dial: '+66'  },
  { id: 'TR', flag: '🇹🇷', name: 'Turkey',         dial: '+90'  },
  { id: 'AE', flag: '🇦🇪', name: 'UAE',            dial: '+971' },
  { id: 'GB', flag: '🇬🇧', name: 'United Kingdom', dial: '+44'  },
  { id: 'US', flag: '🇺🇸', name: 'United States',  dial: '+1'   },
  { id: 'VN', flag: '🇻🇳', name: 'Vietnam',        dial: '+84'  },
];

const PLACEMENTS = [
  'Ankle', 'Arm', 'Back', 'Calf', 'Chest', 'Foot', 'Forearm',
  'Hand', 'Head', 'Hip', 'Knee', 'Neck', 'Ribs', 'Shoulder',
  'Stomach', 'Thigh', 'Wrist', 'Other',
];

function WalkInInner() {
  const params = useSearchParams();
  const studioId = params.get('s');

  const [studio, setStudio]   = useState(null);
  const [studioErr, setStudioErr] = useState('');
  const [formConfig, setFormConfig] = useState(null); // null = loading

  // Form state
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [phoneCode, setPhoneCode]   = useState(() => detectCountry());
  const [phoneNum,  setPhoneNum]    = useState('');
  const [dob, setDob]               = useState('');
  const [skinTone, setSkinTone]     = useState('');

  const [artistId, setArtistId]     = useState('');
  const [placements, setPlacements]  = useState([]);
  const [design, setDesign]         = useState('');
  const [size, setSize]             = useState('');
  const [sizeUnit, setSizeUnit]     = useState('cm');
  const [colorStyle, setColorStyle] = useState('');
  const [retouch, setRetouch]       = useState(false);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergyDetails, setAllergyDetails] = useState('');
  const [notes, setNotes]           = useState('');
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
  const [submitError, setSubmitError] = useState('');
  const [done, setDone]             = useState(false);

  // field(key) returns {enabled, required} from the loaded config, defaulting to enabled/not-required
  function field(key) {
    return formConfig?.[key] ?? { enabled: true, required: false };
  }

  // Load studio, form config, and consent templates in parallel
  useEffect(() => {
    if (!studioId) return;
    Promise.all([
      getStudioPublic(studioId),
      getFormConfigPublic(studioId).catch(() => ({ fields: {} })),
      getStudioConsentTemplates(studioId).catch(() => ({ templates: [] })),
    ]).then(([studioData, configData, consentData]) => {
      setStudio(studioData);
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setSubmitError('Please provide your first and last name.'); return; }
    if (!email.trim()) { setSubmitError('Please provide your email address.'); return; }
    if (!phoneNum.trim()) { setSubmitError('Please provide your phone number.'); return; }
    if (field('body_location').enabled && placements.length === 0) { setSubmitError('Please select at least one placement.'); return; }

    // Validate consent form templates — only enforce required ones
    for (const t of consentTemplates) {
      const required = t.is_required ?? true;
      if (!required) continue;
      const ts = templateState[t.id] ?? {};
      for (const f of (t.fields ?? [])) {
        if (f.required && ['text', 'textarea', 'yesno'].includes(f.type)) {
          if (!ts.answers?.[f.id]) {
            setSubmitError(`Please complete all required fields in "${t.name}".`);
            return;
          }
        }
        if (f.required && f.type === 'checkbox' && !ts.answers?.[f.id]) {
          setSubmitError(`Please check all required boxes in "${t.name}".`);
          return;
        }
      }
      if (!ts.answers?.__agreed__) {
        setSubmitError(`Please confirm you have read and agreed to "${t.name}".`);
        return;
      }
      if (t.requires_signature && !ts.sigBlob) {
        setSubmitError(`Please sign "${t.name}".`);
        return;
      }
      if (isMinor) {
        if (!guardianName.trim()) { setSubmitError('Please provide the guardian\'s name.'); return; }
        if (!ts.guardianSigBlob) { setSubmitError(`Guardian signature required for "${t.name}".`); return; }
      }
    }

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
          answers:                ts.answers ?? {},
          is_minor:               isMinor,
          signer_name:            `${firstName} ${lastName}`.trim(),
          client_signature_path:  clientSigPath,
          guardian_name:          isMinor ? guardianName : '',
          guardian_relationship:  isMinor ? guardianRelationship : '',
          guardian_email:         isMinor ? guardianEmail : '',
          guardian_phone:         isMinor ? guardianPhone : '',
          guardian_signature_path: guardianSigPath,
        });
      }

      await createWalkIn(studioId, {
        artist_id:            artistId,
        name:                 `${firstName} ${lastName}`.trim(),
        email,
        phone: `${COUNTRIES.find(c => c.id === phoneCode)?.dial ?? ''} ${phoneNum}`.trim(),
        dob,
        skin_tone:            skinTone,

        session_type:         retouch ? 'retouch' : '',
        body_location:        placements.join(', '),
        design_details:       design,
        size:                 size.trim() ? `${size.trim()}${sizeUnit}` : '',
        color:                colorStyle,
        notes,
        allergies:            hasAllergies ? (allergyDetails.trim() || 'Yes') : '',
        image_paths:          imagePaths,
        consent_accepted:     consentSubmissions.length > 0,
        consent_submissions:  consentSubmissions,
      });
      setDone(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!studioId) return <p style={s.msg}>Invalid link — no studio ID.</p>;
  if (studioErr) return <p style={{ ...s.msg, color: '#e86f6f' }}>{studioErr}</p>;
  if (!studio || formConfig === null) return <p style={s.msg}>Loading…</p>;

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
      <div style={s.studioHeader}>
        <span style={s.studioLabel}>Studio booking</span>
        <h1 style={s.studioName}>{studio.name}</h1>
      </div>

      <form onSubmit={handleSubmit} style={s.form}>

          {/* ── About you ── */}
          <Section title="About you" first>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Field label={<>First name<Required /></>}>
                <input style={s.input} type="text" value={firstName} required onChange={e => setFirstName(e.target.value)} placeholder="First" />
              </Field>
              <Field label={<>Last name<Required /></>}>
                <input style={s.input} type="text" value={lastName} required onChange={e => setLastName(e.target.value)} placeholder="Last" />
              </Field>
            </div>
            <Field label={<>Date of birth<Required /></>}>
              <input style={{ ...s.input, colorScheme: 'dark' }} type="date" value={dob} required onChange={e => setDob(e.target.value)} />
            </Field>
            <Field label={<>Email<Required /></>}>
              <input style={s.input} type="email" value={email} required onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Field label={<>Phone<Required /></>}>
              <div style={s.phoneRow}>
                <select
                  style={{ ...s.input, ...s.phoneCodeSelect }}
                  value={phoneCode}
                  onChange={e => setPhoneCode(e.target.value)}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.id} value={c.id}>{c.flag} {c.dial}</option>
                  ))}
                </select>
                <input
                  style={{ ...s.input, flex: 1 }}
                  type="tel"
                  value={phoneNum}
                  required
                  onChange={e => setPhoneNum(e.target.value)}
                  placeholder="555 0100"
                />
              </div>
            </Field>
          </Section>

          {/* ── Your tattoo ── */}
          <Section title="Your tattoo">
            {field('artist_id').enabled && (
              <Field label={<>Artist preference{field('artist_id').required ? <Required /> : <Optional />}</>}>
                <select style={s.input} value={artistId} required={field('artist_id').required} onChange={e => setArtistId(e.target.value)}>
                  <option value="">No preference — studio will assign</option>
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
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, marginLeft: 6 }}>
                    {placements.length}/3
                  </span>
                </label>
                <div style={s.chipGrid}>
                  {PLACEMENTS.map(p => {
                    const active = placements.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
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
              <Field label={<>Design description{field('design_details').required ? <Required /> : <Optional />}</>}>
                <textarea style={{ ...s.input, ...s.textarea }} value={design} required={field('design_details').required} onChange={e => setDesign(e.target.value)} placeholder="Describe what you'd like…" />
              </Field>
            )}

            {field('skin_tone').enabled && (
              <Field label={<>Skin tone{field('skin_tone').required ? <Required /> : <Optional />}</>}>
                <select style={s.input} value={skinTone} required={field('skin_tone').required} onChange={e => setSkinTone(e.target.value)}>
                  <option value="">Select skin tone…</option>
                  {['Very light', 'Light', 'Medium', 'Olive', 'Brown', 'Dark'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            )}

            {field('size').enabled && (
              <Field label={<>Size{field('size').required ? <Required /> : <Optional />}</>}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    style={{ ...s.input, flex: 1 }}
                    type="number" min="0" step="0.1"
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
                        key={u} type="button"
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

            {field('retouch').enabled && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                <input type="checkbox" checked={retouch} onChange={e => setRetouch(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#f5ecd9', cursor: 'pointer' }} />
                This is a touch-up / retouch
              </label>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={s.label}>Colour</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['Black', 'Grey', 'Color'].map(opt => {
                  const active = colorStyle === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
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
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {field('notes').enabled && (
              <Field label={<>Additional notes{field('notes').required ? <Required /> : <Optional />}</>}>
                <textarea style={{ ...s.input, ...s.textarea }} value={notes} required={field('notes').required} onChange={e => setNotes(e.target.value)} placeholder="Anything else the artist should know" />
              </Field>
            )}

            {field('allergies').enabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hasAllergies} onChange={e => { setHasAllergies(e.target.checked); if (!e.target.checked) setAllergyDetails(''); }} style={{ width: 16, height: 16, accentColor: '#f5ecd9', cursor: 'pointer' }} />
                  I have allergies or sensitivities{field('allergies').required ? '' : ' (optional)'}
                </label>
                {hasAllergies && (
                  <textarea
                    style={{ ...s.input, ...s.textarea }}
                    value={allergyDetails}
                    required={field('allergies').required}
                    onChange={e => setAllergyDetails(e.target.value)}
                    placeholder="Please describe your allergies or sensitivities…"
                  />
                )}
              </div>
            )}
          </Section>

          {/* ── Reference photos ── */}
          {field('image_paths').enabled && (
            <Section title="Reference photos">
              <p style={s.sectionHint}>{field('image_paths').required ? 'Required — up to 5 images' : 'Optional — up to 5 images'}</p>
              <label style={s.uploadLabel}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoChange} />
                + Add photos
              </label>
              {photoPreviews.length > 0 && (
                <div style={s.photoGrid}>
                  {photoPreviews.map((url, i) => (
                    <div key={i} style={s.photoThumb}>
                      <img src={url} alt="" style={s.thumbImg} />
                      <button type="button" style={s.thumbRemove} onClick={() => removePhoto(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ── Consent forms ── */}
          {consentTemplates.length > 0 && (
            <Section title="Consent forms">
              {consentTemplates.map(t => {
                const ts = templateState[t.id] ?? {};
                return (
                  <div key={t.id} style={s.consentBox}>
                    <span style={s.consentFormTitle}>{t.name}</span>

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
                        style={{ accentColor: '#f5ecd9', flexShrink: 0, marginTop: 2 }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                        I have read and agreed to the above <span style={{ color: '#e86f6f' }}>*</span>
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
                              <label style={s.label}>Guardian name <span style={{ color: '#e86f6f' }}>*</span></label>
                              <input style={s.input} type="text" value={guardianName} required
                                onChange={e => setGuardianName(e.target.value)} placeholder="Full name" />
                            </div>
                            <div>
                              <label style={s.label}>Relationship</label>
                              <select style={s.input} value={guardianRelationship} onChange={e => setGuardianRelationship(e.target.value)}>
                                <option>Parent</option>
                                <option>Legal Guardian</option>
                                <option>Other</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label style={s.label}>Guardian email</label>
                            <input style={s.input} type="email" value={guardianEmail}
                              onChange={e => setGuardianEmail(e.target.value)} placeholder="guardian@example.com" />
                          </div>
                          <div>
                            <label style={s.label}>Guardian phone</label>
                            <input style={s.input} type="tel" value={guardianPhone}
                              onChange={e => setGuardianPhone(e.target.value)} placeholder="Phone number" />
                          </div>
                          <div>
                            <label style={s.label}>Guardian signature <span style={{ color: '#e86f6f' }}>*</span></label>
                            <SignaturePad onCapture={blob => setTemplateGuardianSigBlob(t.id, blob)} />
                          </div>
                        </div>
                      </div>
                    )}

                    {t.requires_signature && (
                      <div>
                        <label style={s.label}>{isMinor ? 'Client signature' : 'Signature'} <span style={{ color: '#e86f6f' }}>*</span></label>
                        <SignaturePad onCapture={blob => setTemplateSigBlob(t.id, blob)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>
          )}

          {/* ── Submit ── */}
          <div style={s.submitSection}>
            {submitError && <p style={s.error}>{submitError}</p>}
            <button type="submit" disabled={submitting} style={s.submitBtn}>
              {submitting ? 'Submitting…' : 'Request booking'}
            </button>
          </div>

        </form>
    </div>
  );
}

// Renders a single field from a consent template
function ConsentFormField({ field, value, onChange }) {
  const labelStyle = {
    fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)',
    display: 'flex', gap: '0.25rem', alignItems: 'center',
  };
  switch (field.type) {
    case 'heading':
      return <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f5ecd9', margin: 0 }}>{field.label}</p>;
    case 'paragraph':
      return <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.65, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{field.label}</p>;
    case 'checkbox':
      return (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked ? 'true' : '')}
            style={{ accentColor: '#f5ecd9', flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            {field.label}{field.required && <span style={{ color: '#e86f6f', marginLeft: 2 }}>*</span>}
          </span>
        </label>
      );
    case 'yesno':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={labelStyle}>
            {field.label}{field.required && <span style={{ color: '#e86f6f' }}>*</span>}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['Yes', 'No'].map(opt => (
              <button key={opt} type="button"
                onClick={() => onChange(opt)}
                style={{
                  padding: '0.45rem 1.2rem', borderRadius: 8,
                  border: `1px solid ${value === opt ? '#f5ecd9' : 'rgba(255,255,255,0.12)'}`,
                  background: value === opt ? 'rgba(245,236,217,0.12)' : 'rgba(255,255,255,0.04)',
                  color: value === opt ? '#f5ecd9' : 'rgba(255,255,255,0.5)',
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
            {field.label}{field.required && <span style={{ color: '#e86f6f' }}>*</span>}
          </span>
          <textarea style={{ ...s.input, minHeight: 70, resize: 'vertical' }}
            value={value} onChange={e => onChange(e.target.value)} placeholder="Your answer…" />
        </div>
      );
    default: // 'text'
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={labelStyle}>
            {field.label}{field.required && <span style={{ color: '#e86f6f' }}>*</span>}
          </span>
          <input type="text" style={s.input} value={value} onChange={e => onChange(e.target.value)} placeholder="Your answer…" />
        </div>
      );
  }
}

function SignaturePad({ onCapture }) {
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
    ctx.strokeStyle = '#f5ecd9';
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
        width={440}
        height={140}
        style={s.sigCanvas}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <div style={s.sigFooter}>
        <span style={s.sigHint}>Draw your signature above</span>
        <button type="button" onClick={clear} style={s.sigClear}>Clear</button>
      </div>
    </div>
  );
}

function Required() {
  return <span style={{ color: '#e86f6f', marginLeft: 3 }}>*</span>;
}

function Optional() {
  return <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>;
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

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <span style={s.label}>{label}</span>
      {children}
    </div>
  );
}

export default function WalkInPage() {
  return (
    <div style={s.page}>
      <Suspense fallback={<p style={s.msg}>Loading…</p>}>
        <WalkInInner />
      </Suspense>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0e0e0e',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '2rem 1rem 4rem',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  studioHeader: {
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    paddingBottom: '1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  studioLabel: {
    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
  },
  studioName: {
    fontSize: '1.5rem', fontWeight: 700, color: '#ffffff',
    margin: 0, letterSpacing: '-0.02em',
  },
  studioAddress: {
    fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)',
  },
  authIntro: {
    fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', margin: 0,
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '1.5rem',
  },
  sectionTitle: {
    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)',
  },
  sectionHint: {
    fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', margin: 0,
  },
  submitSection: {
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem',
  },
  label: {
    fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)',
  },
  input: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: '0.875rem',
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
  textarea: {
    minHeight: 90,
    resize: 'vertical',
  },
  submitBtn: {
    background: '#f5ecd9',
    border: 'none',
    borderRadius: 10,
    color: '#0e0e0e',
    fontSize: '0.9rem',
    fontWeight: 700,
    padding: '0.85rem',
    cursor: 'pointer',
    marginTop: '0.25rem',
    fontFamily: 'inherit',
  },
  chipGrid: {
    display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
  },
  placementChip: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.78rem', fontWeight: 500,
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  placementChipActive: {
    background: 'rgba(245,236,217,0.12)',
    border: '1px solid rgba(245,236,217,0.35)',
    color: '#f5ecd9',
  },
  placementChipDisabled: {
    opacity: 0.3,
    cursor: 'default',
  },
  uploadLabel: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '0.5rem 0.85rem', fontSize: '0.82rem',
    color: 'rgba(255,255,255,0.55)', cursor: 'pointer', alignSelf: 'flex-start',
  },
  photoGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' },
  photoThumb: { position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbRemove: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  consentBox: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  sigWrap: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  sigCanvas: { width: '100%', height: 140, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', display: 'block', touchAction: 'none', cursor: 'crosshair' },
  sigFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sigHint: { fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' },
  sigClear: { background: 'none', border: 'none', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: '0.15rem 0', fontFamily: 'inherit' },
  consentText: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.65, maxHeight: 160, overflowY: 'auto' },
  consentCheck: { display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' },
  consentFormTitle: { fontSize: '0.9rem', fontWeight: 700, color: '#f5ecd9' },
  formTypeBadge: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: 4 },
  formTypeBadgeColors: {
    consent: { background: 'rgba(245,236,217,0.1)', color: '#f5ecd9' },
    waiver:  { background: 'rgba(232,111,111,0.12)', color: '#e86f6f' },
    health:  { background: 'rgba(76,201,138,0.12)', color: '#4cc98a' },
  },
  guardianBox: {
    background: 'rgba(245,236,217,0.04)', border: '1px solid rgba(245,236,217,0.12)',
    borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem',
  },
  guardianTitle: { fontSize: '0.8rem', fontWeight: 700, color: '#f5ecd9', margin: 0 },
  switchLink: {
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '0.75rem', cursor: 'pointer',
    textAlign: 'center', padding: '0.25rem',
    fontFamily: 'inherit',
  },
  error: {
    fontSize: '0.78rem', color: '#e86f6f', margin: 0,
  },
  msg: {
    color: 'rgba(255,255,255,0.35)', fontSize: '0.875rem', padding: '2rem',
  },
  successIcon: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'rgba(76,201,138,0.15)',
    color: '#4cc98a',
    fontSize: '1.4rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  successTitle: {
    fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', margin: 0,
  },
  successSub: {
    fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6,
  },
};
