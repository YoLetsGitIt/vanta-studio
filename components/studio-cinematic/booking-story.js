// Each chapter gets 30vh, including the first chapter's tablet entrance.
// Keep the approach and studio departure outside those equal budgets.
const APPROACH_VH = 89;
const CHAPTER_VH = 30;
const DEPARTURE_VH = 85;
const SCROLL_VH = APPROACH_VH + 3 * CHAPTER_VH + DEPARTURE_VH;
export const JOURNEY_SCREENS = 1 + SCROLL_VH / 100;
export const FEATURE_REVEAL_SCREENS = .32;
// seat/look time the artist walk to the stool and the look down at the phone,
// which play on a timer. 2.8s over the walk's 144 frames is ~51 frames a second,
// close to one new frame per display refresh.
export const TRAVEL_MS = { entrance: 3400, panel: 650, studio: 2200, features: 850, seat: 2800, look: 600 };
const SCROLL_POINTS = [
  [0, 0],
  [APPROACH_VH / SCROLL_VH, .20],
  [(APPROACH_VH + 12) / SCROLL_VH, .27],
  [(APPROACH_VH + CHAPTER_VH) / SCROLL_VH, .45],
  [(APPROACH_VH + 2 * CHAPTER_VH) / SCROLL_VH, .65],
  [(APPROACH_VH + 3 * CHAPTER_VH) / SCROLL_VH, .825],
  [(SCROLL_VH - 10) / SCROLL_VH, .98], [1, 1],
];
function mapProgress(value, from, to) {
  const n = Math.max(0, Math.min(1, value));
  const end = SCROLL_POINTS.findIndex(point => point[from] >= n);
  if (end <= 0) return SCROLL_POINTS[0][to];
  const a = SCROLL_POINTS[end - 1], b = SCROLL_POINTS[end];
  return a[to] + (n - a[from]) / (b[from] - a[from]) * (b[to] - a[to]);
}
export const storyProgress = value => mapProgress(value, 0, 1);
export const scrollProgress = value => mapProgress(value, 1, 0);

export const BOOKING_MOMENTS = [
  {
    id: 'form', at: .27, end: .45, reveal: [.30, .38], label: 'Your form',
    title: 'Your bookings.\nYour form.',
    text: 'Choose your fields. Match your website. Share one booking link.',
    before: 'booking-form', after: 'booking-form-details',
    alt: 'Vanta’s customisable booking form: client details, then chosen tattoo questions including a required design description.',
    result: 'Make it yours. Share it anywhere.',
  },
  {
    id: 'booked', at: .46, end: .65, reveal: [.50, .57], label: 'Booked in',
    title: 'From first hello\nto booked in.',
    text: 'Enquiry, availability, deposit. A clear path from idea to appointment.',
    before: 'enquiry', after: 'confirmed',
    alt: 'Mia Carter’s confirmed appointment with Alex Morgan, with the $100 deposit paid.',
    result: 'Deposit paid. You’re booked in.',
  },
  {
    id: 'consent', at: .66, end: .90, reveal: [.70, .77], label: 'Consent',
    title: 'Signed.\nSaved with the client.',
    text: 'Make it yours. Send it to sign. Keep it with the client.',
    before: 'consent', after: 'consent-signed',
    alt: 'Mia Carter’s client record with her signed consent saved and marked Consented.',
    result: 'Signed consent. Right where it belongs.',
  },
];

export function phaseFor(progress) {
  if (progress < .10) return 'door';
  if (progress < .20) return 'reception';
  return BOOKING_MOMENTS.find(moment => progress < moment.end)?.id || (progress < .96 ? 'walk' : 'studio');
}
