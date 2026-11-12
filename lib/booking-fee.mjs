// The Vanta booking fee: what a client pays for booking a deposit through Vanta.
// It is the same however they pay (card, Apple Pay or from their bank), so pages
// show it as a booking fee with the total, never as a card or payment fee.
//
// The server sends the amounts (deposit_options.booking_fee / total). The formula
// here matches it (3% + A$0.50) for pages that only know the deposit.
export function bookingFee(deposit) {
  const amount = Number(deposit) || 0;
  if (amount <= 0) return 0;
  return (Math.round(amount * 3) + 50) / 100;
}

// What the client pays for this deposit: { deposit, fee, total, throughVanta, bank }.
// A deposit paid straight to the studio (its own PayID or bank details) has no fee.
export function depositCharge(deposit, options) {
  const amount = Number(deposit) || 0;
  const throughVanta = options ? options.card !== false : true;
  if (!throughVanta || amount <= 0) return { deposit: amount, fee: 0, total: amount, throughVanta: false, bank: false };
  const fee = Number(options?.booking_fee) > 0 ? Number(options.booking_fee) : bookingFee(amount);
  const total = Number(options?.total) > 0 ? Number(options.total) : Math.round((amount + fee) * 100) / 100;
  return { deposit: amount, fee, total, throughVanta: true, bank: Boolean(options?.bank) };
}

export const money = amount => `$${(Number(amount) || 0).toFixed(2)}`;

// How a deposit through Vanta can be paid. Both ways cost the same.
export const payWays = bank => (bank ? 'Pay by card, Apple Pay or from your bank account.' : 'Pay by card or Apple Pay.');

export const BOOKING_FEE_NOTE = 'The Vanta booking fee is for booking through Vanta. It’s the same however you pay.';
