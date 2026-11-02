// A studio can request deposits once it has any way to be paid:
// an active Stripe account, or saved PayID / bank transfer details.
export function canCollectDeposits(status) {
  return !!((status?.connected && status?.charges_enabled) || status?.manual_deposits_ready);
}

export function hasStripeCharges(status) {
  return !!(status?.connected && status?.charges_enabled);
}
