'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { getStudioPublic, getStudioConsentTemplates } from '@/lib/api';

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

function ConsentForm() {
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

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Derive name / phone / DOB from the signed-in account: the Vanta profile first,
  // then whatever was entered at sign-up. `known` stays null until that's resolved.
  const [known, setKnown] = useState(null);
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
      const profName = profile?.name && profile.name !== 'User' ? profile.name : '';
      const k = {
        name:  profName || m.full_name || m.name || '',
        phone: profile?.phone || m.phone || '',
        dob:   m.dob || '',
      };
      if (cancelled) return;
      setSignerName(v => v || k.name);
      setPhone(v => v || k.phone);
      setDob(v => v || k.dob);
      setKnown(k);
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!studioId) { setLoadErr('This consent link is missing its studio.'); return; }
    Promise.all([getStudioPublic(studioId), getStudioConsentTemplates(studioId, true)])
      .then(([studio, tpl]) => setInfo({ studio_id: studioId, studio_name: studio.name, templates: tpl.templates ?? [] }))
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
          answers:                ts.answers ?? {},
          is_minor:               isMinor,
          client_signature_path:  clientSigPath,
          guardian_name:          needsGuardian ? guardianName : '',
          guardian_relationship:  needsGuardian ? guardianRelationship : '',
          guardian_email:         needsGuardian ? guardianEmail : '',
          guardian_phone:         needsGuardian ? guardianPhone : '',
          guardian_signature_path: guardianSigPath,
        });
      }

      await submitStudioConsent(studioId, session.access_token, signerName.trim(), dob, phone.trim(), { email: session.user?.user_metadata?.marketing_email, sms: session.user?.user_metadata?.marketing_sms }, submissions);
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
    return <div style={s.card}><div style={s.spinner} /></div>;
  }

  if (!session) {
    return <AuthGate studioName={info.studio_name} />;
  }

  if (done) {
    return (
      <div style={s.card}>
        <div style={{ ...s.statusIcon, color: '#4cc98a' }}>✓</div>
        <h2 style={s.heading}>Consent recorded</h2>
        <p style={s.muted}>
          Your consent has been recorded for <strong style={{ color: '#fff' }}>{info.studio_name}</strong>. You can close this page.
        </p>
      </div>
    );
  }

  const templates = info.templates ?? [];

  // Name / DOB / phone come from the account; only ask for whatever it's missing.
  const missingName  = !known.name;
  const missingDob   = !known.dob;
  const missingPhone = !known.phone;
  const needsDetails = missingName || missingDob || missingPhone;

  return (
    <div style={{ width: '100%', maxWidth: 540 }}>
      <p style={{ ...s.studioTag, marginBottom: '0.75rem' }}>{info.studio_name}</p>

      <form onSubmit={handleSubmit} style={s.form}>
        {needsDetails && (
          <div style={s.templateBox}>
            <p style={s.templateTitle}>Your details</p>
            <p style={{ ...s.hint, margin: '0.25rem 0 0.85rem' }}>Signed in as {session.user?.email}. We need a few more details for your client record.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {missingName && (
                <div>
                  <p style={{ ...s.label, marginBottom: '0.3rem' }}>Full name <span style={{ color: '#e86f6f' }}>*</span></p>
                  <input style={s.input} type="text" required autoComplete="name" value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Your name" />
                </div>
              )}
              {missingDob && (
                <div>
                  <p style={{ ...s.label, marginBottom: '0.3rem' }}>Date of birth <span style={{ color: '#e86f6f' }}>*</span></p>
                  <input style={s.input} type="date" required value={dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setDob(e.target.value)} />
                </div>
              )}
              {missingPhone && (
                <div>
                  <p style={{ ...s.label, marginBottom: '0.3rem' }}>Phone number <span style={{ color: '#e86f6f' }}>*</span></p>
                  <input style={s.input} type="tel" required autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Your phone number" />
                </div>
              )}
            </div>
          </div>
        )}

        {templates.length === 0 && (
          <p style={s.muted}>
            By submitting you confirm that you have read and agree to the studio&apos;s consent policy and consent to receive tattoo services.
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

              {t.requires_signature && (
                <div style={{ marginTop: '1.25rem' }}>
                  <p style={{ ...s.label, marginBottom: '0.4rem' }}>
                    {isMinor && t.requires_minor_guardian ? 'Client signature' : 'Signature'} <span style={{ color: '#e86f6f' }}>*</span>
                  </p>
                  <SignaturePad onCapture={blob => setSigBlob(t.id, blob)} />
                </div>
              )}

              {isMinor && t.requires_minor_guardian && (
                <div style={s.guardianBox}>
                  <p style={s.guardianTitle}>Parent / Guardian Consent Required</p>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', margin: '0 0 0.75rem', lineHeight: 1.55 }}>
                    The client is under 18. A parent or legal guardian must provide their details and sign below.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <p style={{ ...s.label, marginBottom: '0.3rem' }}>Guardian name <span style={{ color: '#e86f6f' }}>*</span></p>
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
                      <p style={{ ...s.label, marginBottom: '0.4rem' }}>Guardian signature <span style={{ color: '#e86f6f' }}>*</span></p>
                      <SignaturePad onCapture={blob => setGuardianSigBlob(t.id, blob)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {submitErr && <p style={s.error}>{submitErr}</p>}

        <button type="submit" disabled={submitting} style={{ ...s.btn, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Submitting…' : 'Submit consent'}
        </button>

      </form>
    </div>
  );
}

function AuthGate({ studioName }) {
  const [mode, setMode]       = useState('signup');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]     = useState('');
  const [dob, setDob]       = useState('');
  const [phone, setPhone]   = useState('');
  const [agreed, setAgreed]   = useState(false);
  const [mkt, setMkt]       = useState(false);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [notice, setNotice]   = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr(''); setNotice('');
    if (mode === 'signup' && !agreed) { setErr('You must agree to the Terms of Use and Privacy Policy.'); return; }
    setBusy(true);
    const supabase = getSupabase();
    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Covers a returning client whose app profile was never created.
        await createProfile(data.session, '');
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim(), name: name.trim(), dob, phone: phone.trim(), marketing_email: mkt, marketing_sms: mkt } } });
        if (error) throw error;
        if (data.session) await createProfile(data.session, name.trim());
        else setNotice('Check your email to confirm your account, then scan the QR code again.');
      }
    } catch (e2) {
      setErr(e2.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={s.card}>
      <p style={s.studioTag}>{studioName}</p>
      <h2 style={s.heading}>{mode === 'signup' ? 'Create an account' : 'Sign in'}</h2>
      <p style={s.muted}>
        {studioName} needs you to {mode === 'signup' ? 'create a Vanta account' : 'sign in'} before completing their consent form.
      </p>
      <form onSubmit={submit} style={s.form}>
        {mode === 'signup' && (
          <>
            <input style={s.input} type="text" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            <div>
              <p style={{ ...s.label, marginBottom: '0.3rem' }}>Date of birth</p>
              <input style={s.input} type="date" required value={dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setDob(e.target.value)} />
            </div>
            <input style={s.input} type="tel" required autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
          </>
        )}
        <input style={s.input} type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input style={s.input} type="password" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
        {mode === 'signup' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, minWidth: 'auto', accentColor: '#f5ecd9' }} />
            <span>
              I agree to the{' '}
              <a href="https://www.vanta.tattoo/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#f5ecd9' }}>Terms of Use</a>
              {' '}and{' '}
              <a href="https://www.vanta.tattoo/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#f5ecd9' }}>Privacy Policy</a>
            </span>
          </label>
        )}
        {mode === 'signup' && (
          <>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
              <input type="checkbox" checked={mkt} onChange={e => setMkt(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16, minWidth: 'auto', accentColor: '#f5ecd9' }} />
              <span>
                Send me offers and updates from {studioName} by email and text. Msg &amp; data rates may apply. Reply STOP to opt out.
              </span>
            </label>
          </>
        )}
        {err && <p style={s.error}>{err}</p>}
        {notice && <p style={s.hint}>{notice}</p>}
        <button type="submit" disabled={busy} style={{ ...s.btn, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account & continue' : 'Sign in & continue'}
        </button>
        <button type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setErr(''); setNotice(''); }}
          style={{ background: 'none', border: 'none', color: '#f5ecd9', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit' }}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  );
}

const typeBadgeColor = {
  health:  { background: 'rgba(99,102,241,0.15)', color: '#818cf8' },
  waiver:  { background: 'rgba(245,158,58,0.15)', color: '#f59e3a' },
  consent: { background: 'rgba(76,201,138,0.15)', color: '#4cc98a' },
};

function ConsentFormField({ field, value, onChange }) {
  switch (field.type) {
    case 'heading':
      return <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f5f5f5', margin: 0 }}>{field.label}</p>;
    case 'paragraph':
      return (
        <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
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
              accentColor: '#f5ecd9', cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
            {field.label}{field.required && <span style={{ color: '#e86f6f', marginLeft: 2 }}>*</span>}
          </span>
        </label>
      );
    case 'yesno':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={s.label}>
            {field.label}{field.required && <span style={{ color: '#e86f6f', marginLeft: 2 }}>*</span>}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['Yes', 'No'].map(opt => (
              <button key={opt} type="button" onClick={() => onChange(opt)}
                style={{
                  padding: '0.4rem 1.1rem', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${value === opt ? '#f5ecd9' : 'rgba(255,255,255,0.12)'}`,
                  background: value === opt ? 'rgba(245,236,217,0.1)' : 'rgba(255,255,255,0.04)',
                  color: value === opt ? '#f5ecd9' : 'rgba(255,255,255,0.45)',
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
            {field.label}{field.required && <span style={{ color: '#e86f6f', marginLeft: 2 }}>*</span>}
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
            {field.label}{field.required && <span style={{ color: '#e86f6f', marginLeft: 2 }}>*</span>}
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
    ctx.strokeStyle = '#ffffff';
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
        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Draw your signature above</span>
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

  return (
    <div style={s.page}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <Suspense fallback={<div style={s.card}><div style={s.spinner} /></div>}>
        <ConsentForm />
      </Suspense>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100dvh',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    background: '#11151b',
    padding: '2.5rem 1rem 4rem',
    fontFamily: 'var(--font-body), system-ui, -apple-system, sans-serif',
  },
  card: {
    background: '#1a2026',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '2rem 1.75rem',
    width: '100%', maxWidth: 540,
    display: 'flex', flexDirection: 'column', gap: '0.65rem',
  },
  statusIcon: {
    fontSize: '2rem', textAlign: 'center', marginBottom: '0.25rem',
  },
  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#f5ecd9',
    animation: 'spin 0.8s linear infinite',
    margin: '2rem auto',
  },
  studioTag: {
    margin: 0,
    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#f5ecd9',
  },
  heading: {
    margin: 0,
    fontSize: '1.4rem', fontWeight: 700, color: '#fff',
    letterSpacing: '-0.01em',
  },
  muted: {
    margin: 0,
    fontSize: '0.855rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
  },
  hint: {
    margin: 0,
    fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)',
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem',
  },
  label: {
    fontSize: '0.77rem', fontWeight: 600, color: 'rgba(255,255,255,0.45)',
    margin: 0,
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '0.65rem 0.85rem',
    fontSize: '0.9rem', color: '#fff', outline: 'none',
    width: '100%', minWidth: 0, boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  templateBox: {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '1.25rem 1.25rem 1.5rem',
    display: 'flex', flexDirection: 'column',
  },
  templateHeader: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
  },
  templateTitle: {
    fontSize: '0.92rem', fontWeight: 700, color: '#fff',
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
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
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
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  sigClear: {
    background: 'none', border: 'none', padding: '0.2rem 0.4rem',
    fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)',
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
    color: '#f59e3a',
  },
  btn: {
    background: '#f5ecd9', border: 'none', borderRadius: 10,
    padding: '0.8rem', fontSize: '0.92rem', fontWeight: 700,
    color: '#11151b', cursor: 'pointer', transition: 'opacity 0.15s',
  },
  error: {
    margin: 0, fontSize: '0.8rem', color: '#e86f6f',
  },
  expiry: {
    margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center',
  },
};
