'use client';

// Settings → Payments: clients pay deposits through Stripe only, by card or from their
// bank account (PayTo), into the studio's Stripe account. The studio also chooses who
// pays the Vanta booking fee. (A PayID or bank account saved before is never shown.)
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { getDepositMethods, updateDepositMethods } from '@/lib/api';
import { showFeedback } from '@/lib/feedback';

export default function DepositPaymentOptions({ styles: s, stripe }) {
  const [payer, setPayer] = useState(null);
  const [savedPayer, setSavedPayer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDepositMethods()
      .then(data => { const next = feePayer(data); setPayer(next); setSavedPayer(next); })
      .catch(e => { setPayer('client'); setSavedPayer('client'); setError(e.message); });
  }, []);

  if (!payer) {
    return (
      <section style={s.card}>
        <h2 style={s.sectionTitle}>Deposit payments</h2>
        <div style={s.loadingDot} />
      </section>
    );
  }

  const stripeActive = !!(stripe.status?.connected && stripe.status?.charges_enabled);
  const dirty = payer !== savedPayer;

  async function save(e) {
    e?.preventDefault();
    setSaving(true);
    setError('');
    try {
      const next = feePayer(await updateDepositMethods({ booking_fee_payer: payer, fee_payer_only: true }));
      setPayer(next);
      setSavedPayer(next);
      showFeedback('Payment settings saved', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={s.card} aria-labelledby="deposit-options-title">
      <h2 id="deposit-options-title" style={s.sectionTitle}>Deposit payments</h2>
      <p style={s.sectionDesc}>
        Clients pay deposits through Stripe, by card or straight from their bank account with PayTo. The money goes to your Stripe account and the booking is confirmed automatically.
      </p>
      <p role="status" style={{ ...o.summary, ...(stripeActive ? {} : o.summaryWarn) }}>
        {stripe.status === null
          ? 'Checking Stripe…'
          : stripeActive
            ? 'Clients can pay deposits by card or PayTo.'
            : 'Connect Stripe to ask clients for deposits.'}
      </p>

      <form onSubmit={save} style={o.list}>
        <div style={o.method}>
          <div style={o.methodHead}>
            <div style={o.methodText}>
              <span style={o.methodName}>Stripe</span>
              <span style={o.methodHint}>Card, Apple Pay and Google Pay, or PayTo from the client’s bank.</span>
            </div>
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

          {/* Who pays the Vanta booking fee (3% + 50c): the client on top of the deposit, or
              the studio out of it. */}
          <div style={o.payerBlock}>
            <span style={o.payerLabel} id="fee-payer-label">Who pays the Vanta booking fee</span>
            <div role="radiogroup" aria-labelledby="fee-payer-label" style={o.segment}>
              {[['client', 'The client'], ['business', 'The studio']].map(([value, label]) => {
                const active = payer === value;
                return (
                  <button key={value} type="button" role="radio" aria-checked={active} disabled={saving}
                    onClick={() => setPayer(value)}
                    style={{ ...o.segmentOption, ...(active ? o.segmentActive : {}) }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {payer === 'business' ? (
            <div style={o.feeBox} aria-label="What clients pay">
              <div style={o.feeRow}><span>Deposit you ask for</span><span style={o.feeNum}>$100.00</span></div>
              <div style={{ ...o.feeRow, ...o.feeTotal }}><span>Client pays</span><span style={o.feeNum}>$100.00</span></div>
              <div style={o.feeRow}><span>Vanta booking fee, paid by you (3% + 50c)</span><span style={o.feeNum}>− $3.50</span></div>
              <div style={{ ...o.feeRow, ...o.feeYou }}><span>You receive in Stripe</span><span style={{ ...o.feeNum, color: "var(--color-success)" }}>$96.50</span></div>
              <p style={o.feeNote}>You cover the Vanta booking fee, so clients pay only the deposit. It comes out of each deposit, the same however the client pays.</p>
            </div>
          ) : (
            <div style={o.feeBox} aria-label="What clients pay">
              <div style={o.feeRow}><span>Deposit you ask for</span><span style={o.feeNum}>$100.00</span></div>
              <div style={o.feeRow}><span>Vanta booking fee, paid by the client (3% + 50c)</span><span style={o.feeNum}>+ $3.50</span></div>
              <div style={{ ...o.feeRow, ...o.feeTotal }}><span>Client pays</span><span style={o.feeNum}>$103.50</span></div>
              <div style={{ ...o.feeRow, ...o.feeYou }}><span>You receive in Stripe</span><span style={{ ...o.feeNum, color: "var(--color-success)" }}>$100.00</span></div>
              <p style={o.feeNote}>Clients pay Vanta a booking fee for booking through Vanta. It’s the same however they pay, they see it with the total before paying, and nothing comes out of your deposit.</p>
            </div>
          )}
        </div>

        {error && <p role="alert" style={s.errorText}>{error}</p>}
        {dirty && (
          <div style={o.footer}>
            <Button type="submit" loading={saving} loadingLabel="Saving…">Save</Button>
            {!saving && <span style={o.methodHint}>Unsaved changes</span>}
          </div>
        )}
      </form>
    </section>
  );
}

function feePayer(data) {
  return data?.booking_fee_payer === 'business' ? 'business' : 'client';
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
  payerBlock: { display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: 440 },
  payerLabel: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' },
  segment: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-faint)' },
  segmentOption: { minHeight: 36, borderRadius: 7, border: '1px solid transparent', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' },
  segmentActive: { background: 'var(--bg-base)', border: '1px solid var(--border-faint)', color: 'var(--text)', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' },
};
