'use client';

// The client's private page to send their weekly availability, from the studio's email
// (?b=<booking>&t=<token>). Shows the studio's quote and session length when it sent
// them; once sent, the studio (or artist) replies with times to choose from.
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import WeeklyAvailabilityGrid from '@/components/WeeklyAvailabilityGrid';
import { getAvailabilityRequest, submitAvailability } from '@/lib/api';

const money = n => `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const length = mins => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return [h ? `${h} hr${h === 1 ? '' : 's'}` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
};

function Inner() {
  const params = useSearchParams();
  const bookingId = params.get('b') ?? '';
  const token = params.get('t') ?? '';
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [availability, setAvailability] = useState([]);
  const [earliestDate, setEarliestDate] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!bookingId || !token) { setLoadError('This link isn’t complete. Open it again from your email.'); return; }
    getAvailabilityRequest(bookingId, token)
      .then(data => {
        setInfo(data);
        setAvailability(Array.isArray(data.availability_windows) ? data.availability_windows : []);
        setEarliestDate(data.earliest_date ? String(data.earliest_date).slice(0, 10) : '');
      })
      .catch(e => setLoadError(e.message));
  }, [bookingId, token]);

  async function send(e) {
    e.preventDefault();
    if (availability.length === 0) { setError('Mark at least one time that suits you.'); return; }
    setSending(true); setError('');
    try {
      await submitAvailability(bookingId, token, { availability_windows: availability, earliest_date: earliestDate });
      setSent(true);
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  }

  if (loadError) return <div style={s.card}><p style={s.title}>This link doesn’t work</p><p style={s.sub}>{loadError}</p></div>;
  if (!info) return <p style={s.msg}>Loading…</p>;

  const first = (info.client_name || '').trim().split(' ')[0];
  const header = (
    <div style={s.header}>
      {info.studio_logo && <img src={info.studio_logo} alt={`${info.studio_name} logo`} style={s.logo} />}
      <span style={s.label}>Your booking request</span>
      <h1 style={s.studio}>{info.studio_name}</h1>
    </div>
  );

  if (sent) {
    return (
      <div style={s.card}>
        {header}
        <div style={s.successIcon} aria-hidden="true">✓</div>
        <h2 style={s.title}>Thanks{first ? `, ${first}` : ''}!</h2>
        <p style={s.sub}>{info.studio_name} has your availability. You’ll get an email with times to choose from.</p>
      </div>
    );
  }
  if (info.status === 'closed') {
    return (
      <div style={s.card}>
        {header}
        <h2 style={s.title}>You’re all set</h2>
        <p style={s.sub}>{info.studio_name} has already sent you times, or this request is closed. Check your email for the latest from the studio.</p>
      </div>
    );
  }

  return (
    <div style={s.card}>
      {header}
      <p style={s.intro}>
        Hi{first ? ` ${first}` : ''}, which days and times usually suit you? {info.studio_name} will send you times to choose from.
      </p>
      {(info.estimated_quote || info.duration_minutes) && (
        <dl style={s.quote}>
          {info.estimated_quote ? <div style={s.quoteRow}><dt>Quote</dt><dd style={s.quoteValue}>{money(info.estimated_quote)}</dd></div> : null}
          {info.duration_minutes ? <div style={s.quoteRow}><dt>Session length</dt><dd style={s.quoteValue}>{length(info.duration_minutes)}</dd></div> : null}
        </dl>
      )}
      {info.status === 'received' && <p style={s.note}>You’ve already sent your availability. You can change it below.</p>}
      <form onSubmit={send} style={s.form}>
        <label style={s.field}>
          <span style={s.fieldLabel}>Earliest date you can come in <span style={s.optional}>(optional)</span></span>
          <input type="date" style={s.input} value={earliestDate} min={new Date().toLocaleDateString('en-CA')} onChange={e => setEarliestDate(e.target.value)} />
        </label>
        <div style={s.field}>
          <span style={s.fieldLabel}>Times that usually suit you</span>
          <p style={s.hint}>Press and drag down a day to mark the times that work, and tap a block to remove it.</p>
          <WeeklyAvailabilityGrid value={availability} onChange={v => { setAvailability(v); setError(''); }} hours={info.hours} />
        </div>
        {error && <p role="alert" style={s.error}>{error}</p>}
        <Button type="submit" size="lg" fullWidth loading={sending} loadingLabel="Sending…">
          {info.status === 'received' ? 'Update my availability' : 'Send my availability'}
        </Button>
      </form>
    </div>
  );
}

export default function AvailabilityRequestPage() {
  return (
    <div style={s.page} data-theme="light">
      <Suspense fallback={<p style={s.msg}>Loading…</p>}>
        <Inner />
      </Suspense>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem 4rem', fontFamily: 'var(--font-body, system-ui, sans-serif)' },
  card: { width: '100%', maxWidth: 520, background: 'rgba(var(--ink-rgb), 0.03)', border: '1px solid rgba(var(--ink-rgb), 0.08)', borderRadius: 16, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxSizing: 'border-box' },
  header: { display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(var(--ink-rgb), 0.06)' },
  logo: { maxHeight: 64, maxWidth: 220, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: '0.5rem' },
  label: { fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' },
  studio: { fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' },
  intro: { margin: 0, fontSize: '0.95rem', lineHeight: 1.55, color: 'rgba(var(--ink-rgb), 0.85)' },
  quote: { margin: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem', padding: '0.85rem 1rem', borderRadius: 12, background: 'rgba(var(--ink-rgb), 0.04)', border: '1px solid rgba(var(--ink-rgb), 0.08)' },
  quoteRow: { display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' },
  quoteValue: { margin: 0, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' },
  note: { margin: 0, fontSize: '0.85rem', color: 'var(--color-success)' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.45rem' },
  fieldLabel: { fontSize: '0.8rem', fontWeight: 600, color: 'rgba(var(--ink-rgb), 0.8)' },
  optional: { fontWeight: 400, color: 'var(--text-muted)' },
  hint: { margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 },
  input: { background: 'rgba(var(--ink-rgb), 0.05)', border: '1px solid rgba(var(--ink-rgb), 0.1)', borderRadius: 8, color: 'var(--text)', fontSize: '16px', minHeight: 44, padding: '0.65rem 0.85rem', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', colorScheme: 'dark' },
  error: { margin: 0, fontSize: '0.85rem', color: 'var(--color-danger)' },
  msg: { color: 'var(--text-muted)', fontSize: '0.875rem', padding: '2rem' },
  successIcon: { width: 48, height: 48, borderRadius: '50%', background: 'rgba(76,201,138,0.15)', color: 'var(--color-success)', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  sub: { fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 },
};
