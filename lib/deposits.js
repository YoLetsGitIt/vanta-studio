// A studio can request deposits once its Stripe account can take payments. Deposits go
// through Stripe only (card, or bank through PayTo).
export function canCollectDeposits(status) {
  return hasStripeCharges(status);
}

// Connected to Stripe and able to charge.
export function hasStripeCharges(status) {
  return !!(status?.connected && status?.charges_enabled);
}
