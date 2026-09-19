// A single example appointment, told through short scroll-driven moments.
export const BOOKING_STEPS = [
  { id: 'form', at: .27, end: .31, section: 0 },
  { id: 'form-personal', at: .34, end: .39, section: 0 },
  { id: 'enquiry', at: .42, end: .47, section: 1 },
  { id: 'estimate', at: .49, end: .53, section: 1 },
  { id: 'availability', at: .55, end: .59, section: 1 },
  { id: 'selection', at: .61, end: .65, section: 1 },
  { id: 'confirmed', at: .67, end: .71, section: 1 },
  { id: 'consent', at: .74, end: .79, section: 2 },
  { id: 'consent-signed', at: .82, end: .90, section: 2 },
];
export const CHAPTERS = [
  { label: 'The door', at: 0, end: .10 },
  { label: 'Reception', at: .16, end: .20 },
  { label: 'Your bookings', at: .27, end: .90 },
  { label: 'The studio', at: .98, end: 1.01 },
];
export function phaseFor(p) {
  if (p < .10) return 'door';
  if (p < .20) return 'reception';
  return BOOKING_STEPS.find(step => p < step.end)?.id || (p < .96 ? 'walk' : 'studio');
}
export function sceneProgress(p, reduced = false) {
  if (reduced) { const phase = phaseFor(p); return phase === 'door' ? 0 : phase === 'reception' ? .32 : phase === 'walk' || phase === 'studio' ? .95 : .55; }
  // Approach the tablet, stay still for the story, pull back, then walk on.
  const stops = [[0,0],[.10,.19],[.20,.34],[.27,.43],[.85,.69],[.92,.76],[.97,.91],[1,1]];
  const i = Math.max(1, stops.findIndex(([at]) => p <= at));
  const [a,b] = [stops[i-1],stops[i]];
  return a[1]+(b[1]-a[1])*(p-a[0])/(b[0]-a[0]);
}
