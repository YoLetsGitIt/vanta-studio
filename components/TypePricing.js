'use client';

// Picking an appointment type in Book a time, Offer times, Send link and Send quote:
// it fills in the length and deposit, and prices the booking from the artist's rate
// (hourly × length, or the half- or full-day rate). The price follows the artist and
// length until it's typed over. Once sent, the booking keeps the type.
import { useEffect, useState } from 'react';
import { setBookingAppointmentType } from '@/lib/api';
import { formatTypeLength, priceBasis, priceFor, useAppointmentTypes, useArtistRates } from '@/lib/appointmentTypes';
import styles from './TypePricing.module.css';

const money = n => `$${Number(n).toLocaleString('en-AU', { maximumFractionDigits: 2 })}`;

// Length choices, including the type's length when it isn't one of the usual ones.
export function withLength(options, minutes) {
  return !minutes || options.includes(minutes) ? options : [...options, minutes].sort((a, b) => a - b);
}
export const lengthLabel = m => (m === 480 ? 'Full day (8 hrs)' : m % 60 ? formatTypeLength(m) : `${m / 60} hour${m === 60 ? '' : 's'}`);

export function useTypePricing({ booking, artistId, duration, setDuration, setQuote, setDeposit, setDepositAmount, depositsReady = true }) {
  const { active, byId } = useAppointmentTypes();
  const { byArtist } = useArtistRates();
  const initialId = booking?.appointment_type_id ?? null;
  const [typeId, setTypeId] = useState(initialId);
  const [follow, setFollow] = useState(false); // the price follows the rate
  useEffect(() => { setTypeId(booking?.appointment_type_id ?? null); setFollow(false); }, [booking?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const type = typeId ? byId[typeId] : null;
  const basis = priceBasis(type?.price_basis);
  const rates = artistId ? byArtist[artistId] : null;
  const price = type && artistId ? priceFor(type, rates, duration) : null;
  useEffect(() => { if (follow && price != null) setQuote(String(price)); }, [follow, price]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(next) {
    if (next.id === typeId) { setTypeId(null); setFollow(false); return; }
    setTypeId(next.id);
    setDuration?.(next.duration_minutes);
    setFollow(Boolean(next.price_basis));
    if (!next.price_basis && next.price != null) setQuote(String(next.price));
    if (next.deposit > 0 && depositsReady && setDeposit) { setDeposit(true); setDepositAmount?.(String(next.deposit)); }
  }

  const artistName = rates?.artist_name || 'This artist';
  const hint = !basis || !follow ? null
    : !artistId ? `Priced from the artist’s ${basis.label.toLowerCase()} once you choose an artist.`
    : price == null ? `${artistName} has no ${basis.label.toLowerCase()} set. Add it in Settings → Appointment types, or enter a price.`
    : basis.value === 'hourly' ? `${artistName}’s hourly rate, ${money(rates.hourly_rate)} × ${formatTypeLength(duration)}.`
    : `${artistName}’s ${basis.label.toLowerCase()}.`;

  return {
    types: active, typeId, pick, hint,
    priceOf: t => (artistId ? priceFor(t, rates, t.duration_minutes) : null),
    quoteTyped: () => setFollow(false),
    // After sending: give the booking the chosen type if it changed.
    async saveType(bookingId) {
      if ((typeId ?? null) === initialId || !bookingId) return;
      try { await setBookingAppointmentType(bookingId, typeId); } catch { /* the booking is made; the type is a nice-to-have */ }
    },
  };
}

export function TypeChips({ pricing, label = 'Appointment type' }) {
  if (!pricing.types.length) return null;
  return (
    <div>
      <span id="type-pricing-label" className="studio-field-label">{label} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></span>
      <div className={styles.types} role="radiogroup" aria-labelledby="type-pricing-label" style={{ marginTop: 'var(--space-2)' }}>
        {pricing.types.map(type => {
          const p = pricing.priceOf(type);
          const meta = [formatTypeLength(type.duration_minutes), p != null ? money(p) : priceBasis(type.price_basis)?.short ?? (type.price != null ? money(type.price) : null)].filter(Boolean).join(' · ');
          return (
            <button key={type.id} type="button" role="radio" aria-checked={pricing.typeId === type.id} onClick={() => pricing.pick(type)} style={{ '--type-color': type.color }}>
              <span className={styles.name}>{type.name}</span>
              <span className={styles.meta}>{meta}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PriceHint({ pricing }) {
  return pricing.hint ? <span className={styles.hint}>{pricing.hint}</span> : null;
}
