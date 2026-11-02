'use client';

// Settings → Payments: PayID and bank transfer details for deposits. Any one of
// Stripe, PayID or bank transfer is enough to send deposit links; clients see
// every option that's set up.
import { useEffect, useState } from 'react';
import { getDepositMethods, updateDepositMethods } from '@/lib/api';

const EMPTY = { payid: '', payid_name: '', bank_account_name: '', bank_bsb: '', bank_account_number: '' };

export default function DepositPaymentOptions({ styles: s, stripeReady = false }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    getDepositMethods()
      .then(data => { const next = { ...EMPTY, ...data }; setForm(next); setSaved(next); })
      .catch(e => { setForm({ ...EMPTY }); setSaved({ ...EMPTY }); setError(e.message); });
  }, []);

  if (!form) {
    return (
      <section style={{ ...s.card, gridColumn: '1 / -1' }}>
        <h2 style={s.sectionTitle}>Deposit payment options</h2>
        <div style={s.loadingDot} />
      </section>
    );
  }

  const set = key => e => { setForm(f => ({ ...f, [key]: e.target.value })); setJustSaved(false); };
  const dirty = Object.keys(EMPTY).some(k => (form[k] ?? '') !== (saved[k] ?? ''));
  const hasPayID = !!saved.payid;
  const hasBank = !!(saved.bank_account_name && saved.bank_bsb && saved.bank_account_number);
  const methods = [stripeReady && 'card (Stripe)', hasPayID && 'PayID', hasBank && 'bank transfer'].filter(Boolean);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const next = { ...EMPTY, ...(await updateDepositMethods(form)) };
      setForm(next);
      setSaved(next);
      setJustSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ ...s.card, gridColumn: '1 / -1' }} aria-labelledby="deposit-options-title">
      <h2 id="deposit-options-title" style={s.sectionTitle}>Deposit payment options</h2>
      <p style={s.sectionDesc}>
        Let clients pay deposits by PayID or bank transfer. You only need one way to be paid — Stripe, PayID or bank transfer —
        to send deposit links. The deposit email shows every option you set up, with a booking reference.
      </p>
      <p style={{ ...s.sectionDesc, color: methods.length ? 'var(--text)' : 'var(--color-warning, #e0a84f)' }}>
        {methods.length
          ? `Clients can pay by ${methods.length > 1 ? `${methods.slice(0, -1).join(', ')} or ${methods.at(-1)}` : methods[0]}.`
          : 'No deposit payment options yet — add one to send deposit links.'}
      </p>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <fieldset style={o.group} disabled={saving}>
          <legend style={o.legend}>PayID</legend>
          <div style={o.row}>
            <label style={o.field}>
              <span style={s.label}>PayID</span>
              <input style={s.input} value={form.payid} onChange={set('payid')} placeholder="Email, mobile or ABN" autoComplete="off" maxLength={140} />
            </label>
            <label style={o.field}>
              <span style={s.label}>Name shown to clients <span style={o.optional}>(optional)</span></span>
              <input style={s.input} value={form.payid_name} onChange={set('payid_name')} placeholder="e.g. Ink Studio Pty Ltd" autoComplete="off" maxLength={140} />
            </label>
          </div>
        </fieldset>

        <fieldset style={o.group} disabled={saving}>
          <legend style={o.legend}>Bank transfer</legend>
          <div style={o.row}>
            <label style={{ ...o.field, flexBasis: '100%' }}>
              <span style={s.label}>Account name</span>
              <input style={s.input} value={form.bank_account_name} onChange={set('bank_account_name')} placeholder="e.g. Ink Studio Pty Ltd" autoComplete="off" maxLength={140} />
            </label>
            <label style={o.field}>
              <span style={s.label}>BSB</span>
              <input style={s.input} value={form.bank_bsb} onChange={set('bank_bsb')} placeholder="000-000" inputMode="numeric" autoComplete="off" maxLength={7} />
            </label>
            <label style={o.field}>
              <span style={s.label}>Account number</span>
              <input style={s.input} value={form.bank_account_number} onChange={set('bank_account_number')} placeholder="12345678" inputMode="numeric" autoComplete="off" maxLength={14} />
            </label>
          </div>
        </fieldset>

        <p style={{ ...s.sectionDesc, fontSize: '0.8rem' }}>Leave a section empty to stop offering it. Mark PayID and bank deposits as received on the booking once the money arrives.</p>
        {error && <p role="alert" style={s.errorText}>{error}</p>}
        <button type="submit" style={{ ...s.saveBtn, opacity: dirty || saving ? 1 : 0.6 }} disabled={saving || !dirty}>
          {saving ? 'Saving…' : justSaved && !dirty ? 'Saved' : 'Save payment options'}
        </button>
      </form>
    </section>
  );
}

const o = {
  group: { border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  legend: { fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', padding: 0, marginBottom: '0.6rem' },
  row: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  field: { flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  optional: { fontWeight: 400, color: 'var(--text-secondary)' },
};
