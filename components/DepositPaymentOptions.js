'use client';

// Settings → Payments: how clients pay deposits. Either through Vanta (card, Apple
// Pay or from their bank, into the studio's Stripe account) or straight to the
// studio (its own PayID or bank details). Clients see one or the other, never both,
// so every client pays the same total however they pay. With Vanta payments on,
// the studio's own details are kept but not shown to clients.
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { getDepositMethods, updateDepositMethods } from '@/lib/api';
import { showFeedback } from '@/lib/feedback';

const DETAILS = ['payid', 'payid_name', 'bank_account_name', 'bank_bsb', 'bank_account_number'];
const SWITCHES = ['payid_enabled', 'bank_enabled', 'card_enabled'];
const EMPTY = { payid: '', payid_name: '', bank_account_name: '', bank_bsb: '', bank_account_number: '', payid_enabled: true, bank_enabled: true, card_enabled: true };

export default function DepositPaymentOptions({ styles: s, stripe }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDepositMethods()
      .then(data => { const next = fromServer(data); setForm(next); setSaved(next); })
      .catch(e => { setForm({ ...EMPTY }); setSaved({ ...EMPTY }); setError(e.message); });
  }, []);

  if (!form) {
    return (
      <section style={s.card}>
        <h2 style={s.sectionTitle}>Deposit payment options</h2>
        <div style={s.loadingDot} />
      </section>
    );
  }

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  const flip = key => () => setForm(f => ({ ...f, [key]: !f[key] }));
  const dirty = [...DETAILS, ...SWITCHES].some(k => (form[k] ?? '') !== (saved[k] ?? ''));

  const stripeActive = !!(stripe.status?.connected && stripe.status?.charges_enabled);
  const on = {
    card: stripeActive && saved.card_enabled,
    payid: saved.payid_enabled && !!saved.payid,
    bank: saved.bank_enabled && !!(saved.bank_account_name && saved.bank_bsb && saved.bank_account_number),
  };
  // Through Vanta, the studio's own details aren't offered to clients.
  const methods = on.card ? [] : [on.payid && 'PayID', on.bank && 'bank transfer'].filter(Boolean);
  const vantaOn = stripeActive && form.card_enabled;

  async function save(e) {
    e?.preventDefault();
    if (form.payid_enabled && !form.payid.trim()) { setError('Enter your PayID, or switch PayID off.'); return; }
    if (form.bank_enabled && !(form.bank_account_name.trim() && form.bank_bsb.trim() && form.bank_account_number.trim())) {
      setError('Enter the account name, BSB and account number, or switch bank transfer off.'); return;
    }
    setSaving(true);
    setError('');
    try {
      const next = fromServer(await updateDepositMethods(form));
      setForm(next);
      setSaved(next);
      showFeedback('Payment options saved', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={s.card} aria-labelledby="deposit-options-title">
      <h2 id="deposit-options-title" style={s.sectionTitle}>Deposit payment options</h2>
      <p style={s.sectionDesc}>
        Choose how clients pay deposits: through Vanta, or straight to you with your own PayID or bank details. Clients see one or the other, so every client pays the same total however they pay.
      </p>
      <p role="status" style={{ ...o.summary, ...(on.card || methods.length ? {} : o.summaryWarn) }}>
        {on.card
          ? 'Clients pay deposits through Vanta.'
          : methods.length
            ? `Clients pay you directly by ${methods.join(' or ')}.`
            : 'No way to pay is switched on yet, so you can’t ask for deposits.'}
      </p>

      <form onSubmit={save} style={o.list}>
        {/* Through Vanta, into the studio's Stripe account */}
        <div style={o.method}>
          <div style={o.methodHead}>
            <div style={o.methodText}>
              <span style={o.methodName}>Vanta payments</span>
              <span style={o.methodHint}>Clients pay online through Vanta and the booking is confirmed automatically. You get the whole deposit.</span>
            </div>
            {stripeActive && (
              <Switch label="Vanta payments" checked={form.card_enabled} onChange={flip('card_enabled')} disabled={saving} s={s} />
            )}
          </div>
          {/* The Vanta booking fee: the client pays it to Vanta, the studio keeps the full deposit. */}
          <div style={o.feeBox} aria-label="What clients pay through Vanta">
            <div style={o.feeRow}><span>Deposit you ask for</span><span style={o.feeNum}>$100.00</span></div>
            <div style={o.feeRow}><span>Vanta booking fee, paid by the client (3% + 50c)</span><span style={o.feeNum}>+ $3.50</span></div>
            <div style={{ ...o.feeRow, ...o.feeTotal }}><span>Client pays</span><span style={o.feeNum}>$103.50</span></div>
            <div style={{ ...o.feeRow, ...o.feeYou }}><span>You receive in Stripe</span><span style={{ ...o.feeNum, color: "var(--color-success)" }}>$100.00</span></div>
            <p style={o.feeNote}>Clients pay Vanta a booking fee for booking through Vanta. It’s the same however they pay, they see it with the total before paying, and nothing comes out of your deposit.</p>
          </div>
          {stripe.status === null ? (
            <div style={s.loadingDot} />
          ) : !stripe.status?.connected ? (
            <div style={o.stripeRow}>
              <Button size="sm" onClick={stripe.connect} loading={stripe.connecting} loadingLabel="Opening Stripe…">Connect Stripe</Button>
              <span style={o.methodHint}>You’ll set it up on Stripe, then come back here.</span>
            </div>
          ) : (
            <div style={o.stripeRow}>
              <span style={o.stripeStatus}>
                <span aria-hidden="true" style={{ ...o.dot, background: stripeActive ? 'var(--color-success)' : 'var(--color-warning)' }} />
                {stripeActive ? 'Stripe connected' : 'Stripe setup isn’t finished'}
              </span>
              {!stripeActive && <Button size="sm" onClick={stripe.connect} loading={stripe.connecting} loadingLabel="Opening Stripe…">Finish setup</Button>}
              <Button size="sm" variant="ghost" className="studio-danger-ghost" onClick={stripe.disconnect}>Disconnect</Button>
            </div>
          )}
          {stripe.error && <p role="alert" style={s.errorText}>{stripe.error}</p>}
        </div>

        {vantaOn && (
          <p role="note" style={o.directNote}>
            Your own PayID and bank details below aren’t shown to clients while Vanta payments are on. They’re kept, and clients see them instead if you switch Vanta payments off.
          </p>
        )}

        {/* PayID */}
        <div style={o.method}>
          <div style={o.methodHead}>
            <div style={o.methodText}>
              <span style={o.methodName}>PayID</span>
              <span style={o.methodHint}>You mark it received once the money arrives.</span>
            </div>
            <Switch label="PayID" checked={form.payid_enabled} onChange={flip('payid_enabled')} disabled={saving} s={s} />
          </div>
          {form.payid_enabled ? (
            <div style={o.fields}>
              <label style={o.field}>
                <span style={s.label}>PayID</span>
                <input style={s.input} value={form.payid} onChange={set('payid')} placeholder="Email, mobile or ABN" autoComplete="off" maxLength={140} disabled={saving} />
              </label>
              <label style={o.field}>
                <span style={s.label}>Name shown to clients <span style={o.optional}>(optional)</span></span>
                <input style={s.input} value={form.payid_name} onChange={set('payid_name')} placeholder="e.g. Ink Studio Pty Ltd" autoComplete="off" maxLength={140} disabled={saving} />
              </label>
            </div>
          ) : form.payid && <p style={o.offNote}>Off. {form.payid} is kept for when you switch it back on.</p>}
        </div>

        {/* Bank transfer */}
        <div style={o.method}>
          <div style={o.methodHead}>
            <div style={o.methodText}>
              <span style={o.methodName}>Bank transfer</span>
              <span style={o.methodHint}>You mark it received once the money arrives.</span>
            </div>
            <Switch label="Bank transfer" checked={form.bank_enabled} onChange={flip('bank_enabled')} disabled={saving} s={s} />
          </div>
          {form.bank_enabled ? (
            <div style={o.fields}>
              <label style={{ ...o.field, flexBasis: '100%' }}>
                <span style={s.label}>Account name</span>
                <input style={s.input} value={form.bank_account_name} onChange={set('bank_account_name')} placeholder="e.g. Ink Studio Pty Ltd" autoComplete="off" maxLength={140} disabled={saving} />
              </label>
              <label style={o.field}>
                <span style={s.label}>BSB</span>
                <input style={s.input} value={form.bank_bsb} onChange={set('bank_bsb')} placeholder="000-000" inputMode="numeric" autoComplete="off" maxLength={7} disabled={saving} />
              </label>
              <label style={o.field}>
                <span style={s.label}>Account number</span>
                <input style={s.input} value={form.bank_account_number} onChange={set('bank_account_number')} placeholder="12345678" inputMode="numeric" autoComplete="off" maxLength={14} disabled={saving} />
              </label>
            </div>
          ) : form.bank_account_number && <p style={o.offNote}>Off. Your bank details are kept for when you switch it back on.</p>}
        </div>

        {error && <p role="alert" style={s.errorText}>{error}</p>}
        <div style={o.footer}>
          <Button type="submit" loading={saving} loadingLabel="Saving…" disabled={!dirty}>Save payment options</Button>
          {dirty && !saving && <span style={o.methodHint}>Unsaved changes</span>}
        </div>
      </form>
    </section>
  );
}

// A method with no details shows as off, whatever its saved switch says.
function fromServer(data) {
  const d = { ...EMPTY, ...data };
  return {
    ...d,
    payid_enabled: d.payid_enabled !== false && !!d.payid,
    bank_enabled: d.bank_enabled !== false && !!(d.bank_account_name && d.bank_bsb && d.bank_account_number),
    card_enabled: d.card_enabled !== false,
  };
}

function Switch({ label, checked, onChange, disabled, s }) {
  return (
    <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={onChange} disabled={disabled} style={s.switchBtn}>
      <span aria-hidden="true" style={{ ...s.switchTrack, background: checked ? 'var(--switch-on)' : 'var(--switch-off)' }}>
        <span style={{ ...s.switchThumb, transform: checked ? 'translateX(16px)' : 'none' }} />
      </span>
    </button>
  );
}

const o = {
  summary: { margin: 0, fontSize: '0.9rem', color: 'var(--text)' },
  summaryWarn: { color: 'var(--color-warning)' },
  list: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' },
  method: { display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.9rem 1rem', borderRadius: 12, border: '1px solid var(--border-faint)', background: 'var(--bg-base)' },
  methodHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' },
  methodText: { display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 },
  methodName: { fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' },
  methodHint: { fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  fields: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  field: { flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  optional: { fontWeight: 400, color: 'var(--text-secondary)' },
  offNote: { margin: 0, fontSize: '0.82rem', color: 'var(--text-ghost)' },
  directNote: { margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  stripeRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' },
  stripeStatus: { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', fontWeight: 500, color: 'var(--text)', marginRight: 'auto' },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  feeBox: { display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem 0.85rem', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-faint)', maxWidth: 440 },
  feeRow: { display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' },
  feeNum: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text)' },
  feeTotal: { paddingTop: '0.35rem', borderTop: '1px solid var(--border-faint)', fontWeight: 600, color: 'var(--text)' },
  feeYou: { fontWeight: 700, color: 'var(--color-success)' },
  feeNote: { margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 },
  footer: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' },
};
