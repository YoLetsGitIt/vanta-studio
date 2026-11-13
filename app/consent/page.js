'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import BrandLoader from '@/components/BrandLoader';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getStudioPublic, getStudioConsentTemplates } from '@/lib/api';
import { formTheme, formThemeMode } from '@/lib/formTheme';
import { signatureBlob, penColour } from '@/lib/signature';
import DateOfBirthInput from '@/components/ui/DateOfBirthInput';
import ClientAccountActions from '@/components/ClientAccountActions';
import ClientAuthGate from '@/components/ClientAuthGate';
import PhotoIdField from '@/components/PhotoIdField';
import { uploadPhotoIdAnswers, signStudioPhotoId } from '@/lib/photoId';

// The studio's reusable consent QR code lands here (/consent?s=<studioId>). Unlike the
// emailed single-use link on vanta.tattoo, the client must sign in or create an account
// first, so the submission is tied to a verified email.
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

async function signatureUploadSign(studioId, files) {
  const res = await fetch(`${BACKEND}/studios/${studioId}/signature-upload-sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to get upload URL');
  return data.uploads;
}

// Same profile-creation call the vanta-website /bookings sign-up makes, so a QR
// sign-up gets a real Vanta app account. Idempotent on the backend.
async function createProfile(session, name) {
  try {
    await fetch(`${BACKEND}/auth/users/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: name || 'User', accountType: 'user', termsAcceptedVersion: '1.0' }),
    });
  } catch {}
}

async function submitStudioConsent(studioId, accessToken, signerName, dob, phone, marketing, submissions) {
  const res = await fetch(`${BACKEND}/studios/${studioId}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ signer_name: signerName, dob, phone, marketing_email: !!marketing.email, marketing_sms: !!marketing.sms, submissions }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to submit consent');
  return data;
}

function ConsentForm({ onStyle }) {
  const searchParams = useSearchParams();
  const studioId = searchParams.get('s');

  const [session, setSession]     = useState(undefined); // undefined = still checking
  const [dob, setDob]             = useState('');
  const [signerName, setSignerName] = useState('');
  const [phone, setPhone]         = useState('');
  const [info, setInfo]           = useState(null);
  const [loadErr, setLoadErr]     = useState('');
  const [templateState, setTemplateState] = useState({});
  const [guardianName, setGuardianName]           = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Parent');
  const [guardianEmail, setGuardianEmail]         = useState('');
  const [guardianPhone, setGuardianPhone]         = useState('');
  const [guardianSigBlobs, setGuardianSigBlobs]   = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [marketingSMS, setMarketingSMS] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Derive name / phone / DOB from the signed-in account: the Vanta profile first,
  // then whatever was entered at sign-up. `known` stays null until that's resolved.
  const [known, setKnown] = useState(null);
  const accountUser = useRef(null);
  useEffect(() => {
    if (!session) { setKnown(null); return; }
    let cancelled = false;
    (async () => {
      const m = session.user?.user_metadata ?? {};
      let profile = null;
      try {
        let res = await fetch(`${BACKEND}/auth/users/me`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.status === 404) {
          await createProfile(session, m.full_name || m.name || '');
          res = await fetch(`${BACKEND}/auth/users/me`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        }
        if (res.ok) profile = await res.json();
      } catch {}
      const k = {
        name: [profile?.name, m.full_name, m.name].find(value => value?.trim() && value.trim() !== 'User')?.trim() || '',
        phone: profile?.phone?.trim() || m.phone?.trim() || '',
        dob: m.dob?.trim() || '',
      };
      if (cancelled) return;
      if (accountUser.current !== session.user.id) {
        setSignerName(k.name);
        setPhone(k.phone);
        setDob(k.dob);
        accountUser.current = session.user.id;
      }
      setKnown(k);
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!studioId) { setLoadErr('This consent link is missing its studio.'); return; }
    Promise.all([getStudioPublic(studioId), getStudioConsentTemplates(studioId, true)])
      .then(([studio, tpl]) => {
        onStyle?.(studio.form_style ?? studio.consent_style ?? null);
        setInfo({ studio_id: studioId, studio_name: studio.name, logo_url: studio.logo_url ?? '', templates: tpl.templates ?? [] });
      })
      .catch(() => setLoadErr('This consent link is invalid.'));
  }, [studioId]);

  function setAnswer(templateId, fieldId, value) {
    setTemplateState(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], answers: { ...(prev[templateId]?.answers ?? {}), [fieldId]: value } },
    }));
  }

  function setSigBlob(templateId, blob) {
    setTemplateState(prev => ({ ...prev, [templateId]: { ...prev[templateId], sigBlob: blob } }));
  }

  function setGuardianSigBlob(templateId, blob) {
    setGuardianSigBlobs(prev => ({ ...prev, [templateId]: blob }));
  }

  const isMinor = (() => {
    if (!dob) return false;
    const birth = new Date(dob + 'T12:00:00');
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    return birth > cutoff;
  })();

  async function handleSubmit(e) {
    e.preventDefault();
    const templates = info?.templates ?? [];
    if (!signerName.trim()) { setSubmitErr('Please enter your full name.'); return; }
    if (!dob) { setSubmitErr('Please enter your date of birth.'); return; }
    if (phone.replace(/\D/g, '').length < 7) { setSubmitErr('Please enter a valid phone number.'); return; }

    for (const t of templates) {
      const ts = templateState[t.id] ?? {};
      for (const field of (t.fields ?? [])) {
        if (field.required && !ts.answers?.[field.id]) {
          setSubmitErr(`Please fill in: ${field.label}`);
          return;
        }
      }
      if (!ts.answers?.__agreed__) {
        setSubmitErr(`Please confirm you have read and agreed to "${t.name}".`);
        return;
      }
      if (t.requires_signature && !ts.sigBlob) {
        setSubmitErr(`Signature required for "${t.name}".`);
        return;
      }
      if (isMinor && t.requires_minor_guardian) {
        if (!guardianName.trim()) { setSubmitErr('Please provide the guardian\'s name.'); return; }
        if (!guardianSigBlobs[t.id]) { setSubmitErr(`Guardian signature required for "${t.name}".`); return; }
      }
    }

    setSubmitting(true);
    setSubmitErr('');
    try {
      async function uploadSig(blob) {
        const [slot] = await signatureUploadSign(info.studio_id, [{ mime_type: 'image/png', byte_size: blob.size }]);
        const resp = await fetch(slot.upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob });
        if (!resp.ok) throw new Error('Signature upload failed — please try again.');
        return slot.storage_object_path;
      }

      const submissions = [];
      for (const t of templates) {
        const ts = templateState[t.id] ?? {};
        let clientSigPath = '';
        let guardianSigPath = '';
        const needsGuardian = isMinor && t.requires_minor_guardian;
        if (t.requires_signature && ts.sigBlob) clientSigPath = await uploadSig(ts.sigBlob);
        if (needsGuardian && guardianSigBlobs[t.id]) guardianSigPath = await uploadSig(guardianSigBlobs[t.id]);
        submissions.push({
          template_id:            t.id,
          answers:                await uploadPhotoIdAnswers(ts.answers ?? {}, file => signStudioPhotoId(BACKEND, info.studio_id, file)),
          is_minor:               isMinor,
          client_signature_path:  clientSigPath,
          guardian_name:          needsGuardian ? guardianName : '',
          guardian_relationship:  needsGuardian ? guardianRelationship : '',
          guardian_email:         needsGuardian ? guardianEmail : '',
          guardian_phone:         needsGuardian ? guardianPhone : '',
          guardian_signature_path: guardianSigPath,
        });
      }

      await submitStudioConsent(studioId, session.access_token, signerName.trim(), dob, phone.trim(), { email: marketingEmail, sms: marketingSMS }, submissions);
      // Remember their details on the account so they aren't asked again.
      getSupabase().auth.updateUser({ data: { full_name: signerName.trim(), name: signerName.trim(), dob, phone: phone.trim() } }).catch(() => {});
      setDone(true);
    } catch (e) {
      setSubmitErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadErr) {
    return (
      <div style={s.card}>
        <div style={s.statusIcon}>✕</div>
        <h2 style={s.heading}>Link unavailable</h2>
        <p style={s.muted}>{loadErr}</p>
        <p style={s.hint}>Ask your studio for their consent QR code again.</p>
      </div>
    );
  }

  if (!info || session === undefined || (session && !known)) {
    return <BrandLoader />;
  }

  if (!session) {
    return <ClientAuthGate collectMarketing studioId={studioId} studioName={info.studio_name} logoUrl={info.logo_url} />;
  }

  if (done) {
    return (
      <div style={s.card}>
        <div style={{ ...s.statusIcon, color: 'var(--color-success)' }}>✓</div>
        <h2 style={s.heading}>Consent recorded</h2>
        <p style={s.muted}>
          Your consent has been recorded for <strong style={{ color: 'var(--text)' }}>{info.studio_name}</strong>. You can close this page.
        </p>
      </div>
    );
  }

  const templates = info.templates ?? [];

  return (
    <div style={s.card}>
      {info.logo_url && <img src={info.logo_url} alt={`${info.studio_name} logo`} style={{ maxHeight: 56, maxWidth: 200, objectFit: 'contain', display: 'block', marginBottom: '0.6rem' }} />}
      <p style={s.studioTag}>{info.studio_name}</p>
      <h2 style={s.heading}>Consent form</h2>

      <form onSubmit={handleSubmit} style={s.form}>
        <ClientAccountActions email={session.user?.email} />
        <div style={s.detailsSection}>
          <p style={s.templateTitle}>Your details</p>
          <p style={{ ...s.hint, margin: '0.25rem 0 0.85rem' }}>Review your details and update anything that has changed.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <label htmlFor="consent-name" style={{ ...s.label, marginBottom: '0.3rem' }}>Full name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input id="consent-name" style={s.input} type="text" required autoComplete="name" value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <p style={{ ...s.label, marginBottom: '0.3rem' }}>Date of birth <span style={{ color: 'var(--color-danger)' }}>*</span></p>
              <DateOfBirthInput style={s.input} value={dob} onChange={setDob} />
            </div>
            <div>
              <label htmlFor="consent-email" style={{ ...s.label, marginBottom: '0.3rem' }}>Email</label>
              <input id="consent-email" style={s.input} type="email" readOnly autoComplete="email" value={session.user?.email || ''} />{/@privaterelay\.appleid\.com$/i.test(session.user?.email || '') && <span style={{ display: 'block', marginTop: 6, color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.5 }}>Your private Apple email. Messages are forwarded to your inbox.</span>}
            </div>
            <div>
              <label htmlFor="consent-phone" style={{ ...s.label, marginBottom: '0.3rem' }}>Phone number <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input id="consent-phone" style={s.input} type="tel" required autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Your phone number" />
            </div>
          </div>
        </div>

        {templates.length === 0 && (
          <p style={s.muted}>
            By submitting you confirm that you have read and agree to the studio&apos;s consent policy and consent to receive the agreed studio services.
          </p>
        )}

        {templates.map(t => {
          const ts = templateState[t.id] ?? {};
          return (
            <div key={t.id} style={s.templateBox}>
              <div style={s.templateHeader}>
                <span style={s.templateTitle}>{t.name}</span>
                <span style={{ ...s.typeBadge, ...(typeBadgeColor[t.type] ?? typeBadgeColor.consent) }}>
                  {t.type === 'health' ? 'Health' : t.type === 'waiver' ? 'Waiver' : 'Consent'}
                </span>
              </div>

              <div style={s.fieldStack}>
                {(t.fields ?? []).map(field => (
                  <ConsentFormField
                    key={field.id}
                    field={field}
                    value={ts.answers?.[field.id] ?? ''}
                    onChange={v => setAnswer(t.id, field.id, v)}
                  />
                ))}
              </div>

              {/* Always-required agreement checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '1rem' }}>
                <input
                  type="checkbox"
                  checked={!!ts.answers?.__agreed__}
                  onChange={e => setAnswer(t.id, '__agreed__', e.target.checked ? 'true' : '')}
                  style={{ accentColor: 'var(--cf-accent)', flexShrink: 0, width: 16, height: 16, minWidth: 'auto' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'rgba(var(--ink-rgb), 0.7)', lineHeight: 1.5 }}>
                  I have read and agreed to the above <span style={{ color: 'var(--color-danger)' }}>*</span>
                </span>
              </label>

              {t.requires_signature && (
                <div style={{ marginTop: '1.25rem' }}>
                  <p style={{ ...s.label, marginBottom: '0.4rem' }}>
                    {isMinor && t.requires_minor_guardian ? 'Client signature' : 'Signature'} <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </p>
                  <p style={{ ...s.hint, margin: '0 0 0.5rem' }}>By signing, I agree that my electronic signature is legally binding and I consent to sign this form electronically.</p>
                  <SignaturePad onCapture={blob => setSigBlob(t.id, blob)} />
                </div>
              )}

              {isMinor && t.requires_minor_guardian && (
                <div style={s.guardianBox}>
                  <p style={s.guardianTitle}>Parent / Guardian Consent Required</p>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(var(--ink-rgb), 0.55)', margin: '0 0 0.75rem', lineHeight: 1.55 }}>
                    The client is under 18. A parent or legal guardian must provide their details and sign below.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <p style={{ ...s.label, marginBottom: '0.3rem' }}>Guardian name <span style={{ color: 'var(--color-danger)' }}>*</span></p>
                        <input style={s.input} type="text" value={guardianName} onChange={e => setGuardianName(e.target.value)} placeholder="Full name" />
                      </div>
                      <div>
                        <p style={{ ...s.label, marginBottom: '0.3rem' }}>Relationship</p>
                        <select style={s.input} value={guardianRelationship} onChange={e => setGuardianRelationship(e.target.value)}>
                          <option>Parent</option>
                          <option>Legal Guardian</option>
                          <option>Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <p style={{ ...s.label, marginBottom: '0.3rem' }}>Guardian email</p>
                      <input style={s.input} type="email" value={guardianEmail} onChange={e => setGuardianEmail(e.target.value)} placeholder="guardian@example.com" />
                    </div>
                    <div>
                      <p style={{ ...s.label, marginBottom: '0.3rem' }}>Guardian phone</p>
                      <input style={s.input} type="tel" value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="Phone number" />
                    </div>
                    <div>
                      <p style={{ ...s.label, marginBottom: '0.4rem' }}>Guardian signature <span style={{ color: 'var(--color-danger)' }}>*</span></p>
                      <SignaturePad onCapture={blob => setGuardianSigBlob(t.id, blob)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <fieldset style={{ border: 'none', padding: 0, display: 'grid', gap: 12 }}>
          <legend style={{ ...s.label, marginBottom: 12 }}>Stay in touch (optional)</legend>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'rgba(var(--ink-rgb), 0.7)', fontSize: '0.8rem', lineHeight: 1.6 }}>
            <input type="checkbox" checked={marketingEmail} onChange={event => setMarketingEmail(event.target.checked)} />
            Send me offers and updates from {info.studio_name} by email.
          </label>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'rgba(var(--ink-rgb), 0.7)', fontSize: '0.8rem', lineHeight: 1.6 }}>
            <input type="checkbox" checked={marketingSMS} onChange={event => setMarketingSMS(event.target.checked)} />
            Send me offers and updates from {info.studio_name} by text.
          </label>
        </fieldset>

        {submitErr && <p style={s.error}>{submitErr}</p>}

        <button type="submit" disabled={submitting} style={{ ...s.btn, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Submitting…' : 'Submit consent'}
        </button>

      </form>
    </div>
  );
}



const typeBadgeColor = {
  health:  { background: 'rgba(99,102,241,0.15)', color: 'var(--color-info)' },
  waiver:  { background: 'rgba(245,158,58,0.15)', color: 'var(--color-warning)' },
  consent: { background: 'rgba(76,201,138,0.15)', color: 'var(--color-success)' },
};

function ConsentFormField({ field, value, onChange }) {
  switch (field.type) {
    case 'photo_id':
      return <PhotoIdField label={field.label} required={field.required} value={value} onChange={onChange} labelStyle={s.label} accent="var(--cf-accent)" />;
    case 'heading':
      return <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{field.label}</p>;
    case 'paragraph':
      return (
        <p style={{ fontSize: '0.83rem', color: 'rgba(var(--ink-rgb), 0.7)', margin: 0, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
          {field.label}
        </p>
      );
    case 'checkbox':
      return (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked ? 'true' : '')}
            style={{
              flexShrink: 0, marginTop: 3,
              width: 18, height: 18, minWidth: 'auto',
              padding: 0, border: 'none', background: 'none', borderRadius: 0,
              accentColor: 'var(--cf-accent)', cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '0.83rem', color: 'rgba(var(--ink-rgb), 0.8)', lineHeight: 1.6 }}>
            {field.label}{field.required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
          </span>
        </label>
      );
    case 'yesno':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={s.label}>
            {field.label}{field.required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['Yes', 'No'].map(opt => (
              <button key={opt} type="button" onClick={() => onChange(opt)}
                style={{
                  padding: '0.4rem 1.1rem', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${value === opt ? 'var(--cf-accent)' : 'rgba(var(--ink-rgb), 0.12)'}`,
                  background: value === opt ? 'var(--cf-accent-soft)' : 'rgba(var(--ink-rgb), 0.04)',
                  color: value === opt ? 'var(--cf-accent)' : 'rgba(var(--ink-rgb), 0.45)',
                  fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
                }}>{opt}</button>
            ))}
          </div>
        </div>
      );
    case 'textarea':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={s.label}>
            {field.label}{field.required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
          </span>
          <textarea
            style={{ ...s.input, minHeight: 72, resize: 'vertical' }}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Your answer…"
          />
        </div>
      );
    default:
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={s.label}>
            {field.label}{field.required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
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
    ctx.strokeStyle = penColour(canvasRef.current);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasDrawn(true);
  }

  function endDraw() {
    if (!drawing) return;
    setDrawing(false);
    if (hasDrawn) {
      const version = ++captureVersion.current;
      signatureBlob(canvasRef.current, blob => {
        if (version === captureVersion.current) onCapture(blob);
      });
    }
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
        aria-label="Draw your signature"
        width={440}
        height={140}
        style={{ ...s.sigCanvas, display: 'block' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <div style={s.sigFooter}>
        <span style={{ fontSize: '0.72rem', color: 'rgba(var(--ink-rgb), 0.3)' }}>Draw your signature above</span>
        <button type="button" onClick={clear} style={s.sigClear}>Clear</button>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  useEffect(() => {
    // globals.css sets overflow:hidden on both html and body for the main site
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'auto';
    body.style.overflow = 'auto';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const [style, setStyle] = useState(null);
  return (
    <div data-theme={formThemeMode(style)} style={{ ...s.page, ...consentTheme(style) }}>
      <Suspense fallback={<BrandLoader />}>
        <ConsentForm onStyle={setStyle} />
      </Suspense>
    </div>
  );
}

// The studio's form colours, with the consent page's own light look as the default.
function consentTheme(style) {
  return formTheme(style, { card: '#ffffff', page: '#f6f5f2' });
}

const s = {
  page: {
    minHeight: '100dvh',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    background: 'var(--cf-page)',
    padding: '2.5rem 1rem 4rem',
    fontFamily: 'var(--font-body), system-ui, -apple-system, sans-serif',
  },
  card: {
    background: 'var(--cf-card)',
    border: '1px solid rgba(var(--ink-rgb), 0.08)',
    borderRadius: 16,
    padding: '2rem 1.75rem',
    width: '100%', maxWidth: 540,
    display: 'flex', flexDirection: 'column', gap: '0.65rem',
  },
  statusIcon: {
    fontSize: '2rem', textAlign: 'center', marginBottom: '0.25rem',
  },
  studioTag: {
    margin: 0,
    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--cf-accent)',
  },
  heading: {
    margin: 0,
    fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)',
    letterSpacing: '-0.01em',
  },
  muted: {
    margin: 0,
    fontSize: '0.855rem', color: 'rgba(var(--ink-rgb), 0.5)', lineHeight: 1.6,
  },
  hint: {
    margin: 0,
    fontSize: '0.78rem', color: 'rgba(var(--ink-rgb), 0.3)',
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem',
  },
  label: {
    fontSize: '0.77rem', fontWeight: 600, color: 'rgba(var(--ink-rgb), 0.45)',
    margin: 0,
  },
  input: {
    background: 'rgba(var(--ink-rgb), 0.06)',
    border: '1px solid rgba(var(--ink-rgb), 0.12)',
    borderRadius: 8, padding: '0.65rem 0.85rem',
    fontSize: '0.9rem', color: 'var(--text)', outline: 'none',
    width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  // Sections of the one consent card: the client's details, then each studio form,
  // split by a divider rather than boxed separately.
  templateBox: {
    borderTop: '1px solid rgba(var(--ink-rgb), 0.08)',
    paddingTop: '1.5rem',
    display: 'flex', flexDirection: 'column',
  },
  detailsSection: {
    display: 'flex', flexDirection: 'column',
  },
  templateHeader: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
  },
  templateTitle: {
    fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)',
  },
  typeBadge: {
    fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', padding: '0.18rem 0.5rem',
    borderRadius: 5,
  },
  fieldStack: {
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },
  sigWrap: {
    background: 'rgba(var(--ink-rgb), 0.04)',
    border: '1px solid rgba(var(--ink-rgb), 0.1)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  sigCanvas: {
    display: 'block',
    width: '100%',
    height: 130,
    cursor: 'crosshair',
    touchAction: 'none',
  },
  sigFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.4rem 0.75rem',
    borderTop: '1px solid rgba(var(--ink-rgb), 0.06)',
  },
  sigClear: {
    background: 'none', border: 'none', padding: '0.2rem 0.4rem',
    fontSize: '0.72rem', color: 'rgba(var(--ink-rgb), 0.35)',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  guardianBox: {
    marginTop: '1.25rem',
    padding: '1rem',
    background: 'rgba(245,158,58,0.06)',
    border: '1px solid rgba(245,158,58,0.18)',
    borderRadius: 10,
  },
  guardianTitle: {
    margin: '0 0 0.4rem',
    fontSize: '0.88rem', fontWeight: 700,
    color: 'var(--color-warning)',
  },
  btn: {
    background: 'var(--cf-accent)', border: 'none', borderRadius: 10,
    padding: '0.8rem', fontSize: '0.92rem', fontWeight: 700,
    color: 'var(--cf-accent-text)', cursor: 'pointer', transition: 'opacity 0.15s',
  },
  error: {
    margin: 0, fontSize: '0.8rem', color: 'var(--color-danger)',
  },
  expiry: {
    margin: 0, fontSize: '0.7rem', color: 'rgba(var(--ink-rgb), 0.2)', textAlign: 'center',
  },
};
