import { STUDIO_FEATURE_DEMOS } from './studioFeatureDemos';

// Shared with the signup introduction and walkthrough feature explorer.
// Keep product copy and demo assets in one place.
const FEATURES = [
  {
    id: 'forms',
    summary: "Your questions, your booking form. Share a link, QR code, or website embed.",
    section: 'Bookings',
    images: [],
    videos: ['/signup/custom-booking-form.webm', '/signup/booking-widget.webm'],
    title: 'Booking form & widget',
    desc: 'Build the tattoo-specific form your clients need, then share it as a link, QR code, or embed on your own site.',
    detail: [
      'Every field beyond name, date of birth, email, and phone is optional. Turn on artist preference, placement, size, skin tone, reference photos, or allergies individually, and mark any of them as required before a client can submit.',
      'Clients can scan a QR code, follow a link, or use an embed on your site to request a session. Deposits, 7-day and 24-hour email reminders, and a reschedule cutoff you set are all handled for you.',
    ],
  },
  {
    id: 'branding',
    summary: "Make the booking experience feel like your studio, with colours to match.",
    section: 'Bookings',
    images: ['/signup/widget-branding-2.png'],
    video: '/signup/widget-branding.webm',
    mediaAspectRatio: '11 / 4',
    title: 'Widget branding',
    desc: 'Add the booking widget to your own website in minutes — match your studio\'s colors, then paste in one line of code. No developer needed.',
    detail: [
      'Copy a single embed snippet — one div and one script tag — onto any website you control, no matter what it\'s built with. No developer needed.',
      'Pick a background and highlight color to match your own site — the preview updates live as you type a hex code, so you see exactly what clients will see before you save anything.',
    ],
  },
  {
    id: 'schedule',
    summary: "Give every booking a free station. Keep artists and chairs in sync.",
    section: 'Bookings',
    images: [],
    title: 'Station scheduling',
    desc: 'The booking form only ever offers a station that\'s actually free at that date and time — two artists can\'t land on the same chair by accident.',
  },
  {
    id: 'consent',
    summary: "Your consent form, signed online. Guardian consent included when needed.",
    section: 'Clients',
    images: [],
    video: '/signup/consent-builder.webm',
    title: 'Consent builder',
    desc: 'Design your own waiver from headings, checkboxes, and e-signatures — guardian fields appear automatically for clients under 18.',
    detail: [
      'Build your waiver from six field types — headings, paragraphs, checkboxes, text, long text, and yes/no questions — in whatever order makes sense for your studio, with a live preview of the client-facing version as you go.',
      'Require an e-signature, and the form automatically adds a guardian-consent section the moment a client\'s date of birth shows they\'re under 18 — you don\'t have to build that logic yourself.',
    ],
  },
  {
    id: 'clients',
    summary: "Consent, client notes, and booking history. All in one searchable profile.",
    section: 'Clients',
    images: ['/signup/client-records-profile.png'],
    mediaLayout: 'stacked',
    mediaMaxWidth: 330,
    mediaPreviewHeight: 440,
    mediaAnimation: 'scroll',
    title: 'Client records',
    desc: 'Every client\'s consent status, allergies, and full booking history — searchable in seconds.',
    detail: [
      'Every client gets a running profile beyond the basic contact card: consent status against your current template, design preferences, allergy or skin-condition notes, and even a pain-tolerance scale — all searchable by name, email, or phone in one box.',
      'Send a consent link straight from their profile, and it updates the moment they sign.',
    ],
  },
  {
    id: 'artists',
    summary: "Know who’s booked, what they’ve earned, and what’s still owed.",
    section: 'Studio',
    images: [],
    media: [
      { type: 'video', src: '/signup/artist-payout-interaction.webm' },
      { type: 'image', src: '/signup/artist-stats-redacted.png', presentation: 'artist-stats' },
    ],
    mediaPresentation: 'artist-focus',
    title: 'Artist management',
    desc: 'See artist performance at a glance, then track exactly what each artist has earned, been paid, and is still owed.',
    detail: [
      'The Artists & Payouts view puts performance and payment status together: tattoos, gross sales, average ticket, deposits, hours, artist payout, paid-out amount, and the outstanding balance.',
      'Every artist profile has its own operating view, with session, completion, upcoming-booking, and revenue stats alongside availability, timetable, and scheduled work.',
    ],
  },
  {
    id: 'analytics',
    summary: "See your bookings, revenue, and returning clients at a glance.",
    section: 'Studio',
    images: ['/signup/analytics-live-overview.png'],
    title: 'Analytics',
    desc: 'Appointment counts, revenue, and a studio-vs-personal split, updated in real time.',
    detail: [
      'Appointment counts broken into completed, confirmed, pending, cancelled, and no-show, plus revenue and a studio-vs-personal booking split — filterable by week, month, or a custom date range.',
      'See new versus returning clients at a glance, and which clients are spending the most with your studio over the period you pick.',
    ],
  },
  {
    id: 'languages',
    summary: "Work in English, Simplified Chinese, or Korean. Switch any time.",
    section: 'System',
    images: [],
    title: 'Multi-language',
    desc: 'The entire dashboard is available in English, Simplified Chinese, and Korean — switch anytime from Settings.',
  },
  {
    id: 'migration',
    summary: "Bring your client history from Square, Acuity, or Fresha.",
    section: 'System',
    images: [],
    title: 'Migration import',
    desc: 'Already on Square, Acuity, or Fresha? Bring your client history over with built-in column mapping.',
  },
];

// Both the signup introduction and walkthrough use the same chaptered demos.
export const STUDIO_FEATURE_CATALOG = FEATURES.map(feature => {
  const ids = feature.id === 'artists' ? ['artists', 'payouts'] : [feature.id];
  const demos = ids.map(id => STUDIO_FEATURE_DEMOS[id]);
  return { ...feature, demos, media: demos.map(demo => ({ type: 'video', ...demo })) };
});
