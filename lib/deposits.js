// A studio can request deposits once it has any way to be paid that's switched on:
// an active Stripe account with card deposits on, or PayID / bank transfer details.
export function canCollectDeposits(status) {
  return !!(hasStripeCharges(status) || status?.manual_deposits_ready);
}

// Card deposits through Stripe: connected, able to charge, and not switched off.
export function hasStripeCharges(status) {
  return !!(status?.connected && status?.charges_enabled && status?.card_enabled !== false);
}
