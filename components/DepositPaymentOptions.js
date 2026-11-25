'use client';

// Settings → Payments: clients pay deposits through Stripe only, by card or from their
// bank account with PayTo, into the studio's Stripe account. The studio chooses who pays
// the Vanta booking fee and can try any deposit to see what each side pays.
// (A PayID or bank account saved before is never shown to clients.)
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { getDepositMethods, updateDepositMethods } from '@/lib/api';
import { bookingFee, money } from '@/lib/booking-fee.mjs';
import { showFeedback } from '@/lib/feedback';

const EXAMPLE_DEPOSIT = '100';

export default function DepositPaymentOptions({ styles: s, stripe }) {
  const [payer, setPayer] = useState(null);
  const [savedPayer, setSavedPayer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [example, setExample] = useState(EXAMPLE_DEPOSIT);

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

  // The example deposit: what the client pays and what reaches the studio's Stripe.
  const deposit = Math.max(0, Math.min(100000, Number(example) || 0));
  const fee = bookingFee(deposit);
  const studioPays = payer === 'business';
  const feeTaken = studioPays ? Math.min(fee, deposit) : fee; // never more than the deposit
  const clientPays = studioPays ? deposit : Math.round((deposit + fee) * 100) / 100;
  const youReceive = studioPays ? Math.round((deposit - feeTaken) * 100) / 100 : deposit;

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
      <div style={o.head}>
        <div style={o.headText}>
          <h2 id="deposit-options-title" style={s.sectionTitle}>Deposit payments</h2>
          <p style={{ ...s.sectionDesc, margin: 0 }}>
            Clients pay deposits online through Stripe. The money goes into your Stripe account and the booking is confirmed for you.
          </p>
        </div>
        <StripeBadge status={stripe.status} active={stripeActive} />
      </div>

      {/* Stripe connection */}
      {stripe.status !== null && !stripeActive && (
        <div style={o.connect} role="status">
          <div style={o.connectText}>
            <span style={o.connectTitle}>{stripe.status?.connected ? 'Finish setting up Stripe' : 'Connect Stripe to take deposits'}</span>
            <span style={o.hint}>{stripe.status?.connected ? 'Stripe needs a few more details before clients can pay you.' : 'Until Stripe is connected you can’t ask clients for a deposit. You’ll set it up on Stripe, then come back here.'}</span>
          </div>
          <Button size="sm" onClick={stripe.connect} loading={stripe.connecting} loadingLabel="Opening Stripe…">
            {stripe.status?.connected ? 'Finish setup' : 'Connect Stripe'}
          </Button>
        </div>
      )}
      {stripe.error && <p role="alert" style={s.errorText}>{stripe.error}</p>}

      {/* How clients can pay */}
      <div style={o.block}>
        <h3 style={o.blockTitle}>How clients can pay</h3>
        <ul style={o.ways}>
          <li style={o.way}>
            <span aria-hidden="true" style={o.wayIcon}><CardIcon /></span>
            <span style={o.wayText}>
              <span style={o.wayName}>Card</span>
              <span style={o.hint}>Visa, Mastercard, Amex, Apple Pay and Google Pay. Booked as soon as the payment goes through.</span>
            </span>
          </li>
          <li style={o.way}>
            <span aria-hidden="true" style={o.wayIcon}><BankIcon /></span>
            <span style={o.wayText}>
              <span style={o.wayName}>PayTo <span style={o.tag}>from their bank account</span></span>
              <span style={o.hint}>Pays straight from their bank account, no card needed. PayTo is built into Australian banks, so the client approves the payment in their own banking app.</span>
              <ol style={o.steps}>
                <li>At checkout they choose PayTo and enter their BSB and account number, or their PayID.</li>
                <li>Their bank asks them to approve the payment in the banking app.</li>
                <li>The booking is confirmed once the money arrives.</li>
              </ol>
            </span>
          </li>
        </ul>
        <p style={o.note}>Clients pay the same total either way. Deposits can’t be paid by cash, PayID or bank transfer to you.</p>
      </div>

      {/* The Vanta booking fee, with a deposit to try */}
      <form onSubmit={save} style={o.block}>
        <h3 style={o.blockTitle} id="fee-payer-label">Who pays the Vanta booking fee</h3>
        <p style={{ ...o.hint, margin: 0 }}>3% of the deposit plus 50c, for booking through Vanta. It’s the same however the client pays.</p>
        <div role="radiogroup" aria-labelledby="fee-payer-label" style={o.segment}>
          {[['client', 'The client', 'Added on top of the deposit'], ['business', 'The studio', 'Taken out of the deposit']].map(([value, label, sub]) => {
            const active = payer === value;
            return (
              <button key={value} type="button" role="radio" aria-checked={active} disabled={saving}
                onClick={() => setPayer(value)}
                style={{ ...o.segmentOption, ...(active ? o.segmentActive : {}) }}>
                <span style={o.segmentLabel}>{label}</span>
                <span style={o.segmentSub}>{sub}</span>
              </button>
            );
          })}
        </div>

        <div style={o.calc} aria-live="polite">
          <label style={o.calcRow} htmlFor="fee-example-deposit">
            <span>Deposit</span>
            <span className="studio-quote-money" style={o.amountInput}>
              <span aria-hidden="true" style={o.currency}>$</span>
              <input id="fee-example-deposit" style={o.input} inputMode="decimal" value={example}
                onChange={e => { const v = e.target.value.replace(/[^\d.]/g, ''); if (/^\d{0,6}(\.\d{0,2})?$/.test(v)) setExample(v); }}
                onBlur={() => { if (!example) setExample(EXAMPLE_DEPOSIT); }}
                aria-describedby="fee-example-note" />
            </span>
          </label>
          <div style={o.calcRow}>
            <span>Vanta booking fee</span>
            <span style={o.num}>{studioPays ? `− ${money(feeTaken)}` : `+ ${money(fee)}`}</span>
          </div>
          <div style={{ ...o.calcRow, ...o.calcTotal }}>
            <span>Client pays</span>
            <span style={o.num}>{money(clientPays)}</span>
          </div>
          <div style={{ ...o.calcRow, ...o.calcYou }}>
            <span>You receive in Stripe</span>
            <span style={o.num}>{money(youReceive)}</span>
          </div>
          <p id="fee-example-note" style={o.calcNote}>
            {studioPays
              ? 'Clients pay only the deposit. The booking fee comes out of it before it reaches you.'
              : 'Clients see the booking fee and the total before they pay. Your deposit arrives in full.'}
            {' '}Try any amount: it’s only an example.
          </p>
        </div>

        {error && <p role="alert" style={s.errorText}>{error}</p>}
        {dirty && (
          <div style={o.footer}>
            <Button type="submit" loading={saving} loadingLabel="Saving…">Save</Button>
            {!saving && <span style={o.hint}>Unsaved change</span>}
          </div>
        )}
      </form>

      {stripe.status?.connected && (
        <div style={o.disconnect}>
          <Button size="sm" variant="ghost" className="studio-danger-ghost" onClick={stripe.disconnect}>Disconnect Stripe</Button>
        </div>
      )}
    </section>
  );
}

function StripeBadge({ status, active }) {
  if (status === null) return <span style={o.badge}>Checking Stripe…</span>;
  const label = active ? 'Stripe connected' : status?.connected ? 'Stripe setup unfinished' : 'Stripe not connected';
  const tone = active ? 'var(--color-success)' : 'var(--color-warning)';
  return (
    <span style={o.badge}>
      <span aria-hidden="true" style={{ ...o.dot, background: tone }} />
      {label}
    </span>
  );
}

function CardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" />
    </svg>
  );
}

function BankIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 4l9 5.5M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18" />
    </svg>
  );
}

function feePayer(data) {
  return data?.booking_fee_payer === 'business' ? 'business' : 'client';
}

const o = {
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' },
  headText: { display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0, flex: '1 1 320px', maxWidth: 620 },
  badge: { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.35rem 0.7rem', borderRadius: 999, border: '1px solid var(--border-faint)', background: 'var(--bg-base)', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  connect: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '0.9rem 1rem', borderRadius: 12, border: '1px solid var(--color-warning)', background: 'var(--bg-base)' },
  connectText: { display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, flex: '1 1 280px' },
  connectTitle: { fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' },
  block: { display: 'flex', flexDirection: 'column', gap: '0.7rem', paddingTop: '1rem', borderTop: '1px solid var(--border-faint)' },
  blockTitle: { margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' },
  hint: { fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 },
  ways: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem' },
  way: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.85rem 0.95rem', borderRadius: 12, border: '1px solid var(--border-faint)', background: 'var(--bg-base)' },
  wayIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'var(--bg-card)', border: '1px solid var(--border-faint)', color: 'var(--text)' },
  wayText: { display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 },
  wayName: { fontSize: '0.92rem', fontWeight: 600, color: 'var(--text)' },
  tag: { marginLeft: 6, fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' },
  note: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' },
  steps: { margin: '0.35rem 0 0', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  segment: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 12, background: 'var(--bg-base)', border: '1px solid var(--border-faint)', maxWidth: 480 },
  segmentOption: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '0.55rem 0.75rem', borderRadius: 9, border: '1px solid transparent', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease' },
  segmentActive: { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' },
  segmentLabel: { fontSize: '0.9rem', fontWeight: 600 },
  segmentSub: { fontSize: '0.76rem', opacity: 0.8 },
  calc: { display: 'flex', flexDirection: 'column', gap: '0.45rem', padding: '0.85rem 1rem', borderRadius: 12, background: 'var(--bg-base)', border: '1px solid var(--border-faint)', maxWidth: 480 },
  calcRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: '0.88rem', color: 'var(--text-muted)', minHeight: 28 },
  calcTotal: { paddingTop: '0.5rem', borderTop: '1px solid var(--border-faint)', fontWeight: 600, color: 'var(--text)' },
  calcYou: { fontWeight: 700, color: 'var(--color-success)' },
  calcNote: { margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 },
  num: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  amountInput: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 0.55rem', height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' },
  currency: { fontSize: '0.88rem', color: 'var(--text-muted)' },
  input: { width: 84, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: '0.92rem', fontWeight: 600, fontFamily: 'inherit', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  footer: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  disconnect: { display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border-faint)' },
};
