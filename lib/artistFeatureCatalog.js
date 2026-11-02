// Artist-facing features of the Vanta iOS app, for the walkthrough's artist path.
// Copy follows the app's own screens and the artist page on vanta.tattoo; the
// screenshots are real app captures (see public/studio/artist).
export const APP_STORE_URL = 'https://apps.apple.com/au/app/vanta-find-your-next-tattoo/id6760996738';

const screen = name => `/studio/artist/${name}-780.webp`;

const FEATURES = [
  {
    id: 'portfolio',
    art: 'forms',
    section: 'Your work',
    title: 'Portfolio & Instagram import',
    summary: 'Import your Instagram posts in one tap. Every piece is tagged for discovery.',
    desc: 'Already have a following on Instagram? Import your existing posts to start your portfolio. Vanta suggests the title, style, body placement and colour for each piece, so it can be discovered without extra effort.',
    detail: [
      'Import from Instagram or upload new work from your gallery. If you step away mid-upload, you can save the piece as a draft.',
      'Suggested tags are editable. Change the style, placement, colour or description before posting.',
    ],
    images: [screen('portfolio')],
  },
  {
    id: 'discovery',
    art: 'branding',
    section: 'Your work',
    title: 'Found in feed, search & map',
    summary: 'Clients browse a personalised feed, search by style and find artists nearby.',
    desc: 'Clients browse a personalised feed of tattoos, like and save pieces, follow artists and message them directly. Every piece leads back to your profile.',
    detail: [
      'Style and placement tags on each piece help it appear in search and the right feeds.',
      'The map shows nearby artists and their studio, so local clients can find you.',
      'Clients can message you from your profile, or go straight to booking.',
    ],
    images: [screen('discovery')],
  },
  {
    id: 'requests',
    art: 'consent',
    section: 'Bookings',
    title: 'Structured booking requests',
    summary: 'Style, placement, colour and reference photos arrive with every request.',
    desc: 'Clients submit a structured booking form, so you get everything you need before you reply.',
    detail: [
      'Clients choose placement and colour, describe the design, and add up to five reference photos before submitting.',
      'Reply with a proposal, or decline and let the client know why.',
    ],
    images: [screen('request-form')],
  },
  {
    id: 'proposals',
    art: 'clients',
    section: 'Bookings',
    title: 'Quotes, times & deposits',
    summary: 'Send a quote, duration and times. The client accepts and pays the deposit.',
    desc: 'Answer a request with an estimated quote, session duration, deposit and the times you can do. The client picks a time and pays to confirm.',
    detail: [
      'Propose a primary time and up to two alternates. Clients can accept, ask for changes or decline.',
      'Deposits paid in person can be confirmed from the booking.',
      'After the session, mark it complete and record the final price. No-shows can be recorded too.',
    ],
    images: [screen('proposal')],
  },
  {
    id: 'schedule',
    art: 'schedule',
    section: 'Schedule',
    title: 'Working hours & calendar',
    summary: 'Clients only book inside the hours you set. Block days off in a tap.',
    desc: 'Set your regular working hours and clients can only book within them. Confirmed sessions land in your calendar.',
    detail: [
      'Add date overrides for days off or changed hours, with an optional note.',
      'Add your own appointments alongside the bookings clients make through Vanta.',
    ],
    images: [screen('calendar')],
  },
  {
    id: 'link',
    art: 'migration',
    section: 'Bookings',
    title: 'Your booking link',
    summary: 'Share one link so clients can book you, on your terms.',
    desc: 'Share your booking link anywhere, from your Instagram bio to a message, so clients can book you directly.',
    detail: [
      'Choose how long you have to respond to a request, and the session lengths clients can pick from.',
      'Artists in a studio can have these settings managed by their studio.',
    ],
    images: [],
  },
  {
    id: 'payments',
    art: 'artists',
    section: 'Payments',
    title: 'Deposits & payouts',
    summary: 'Connect Stripe and client deposits are paid out to you.',
    desc: 'Connect a Stripe account, set a deposit amount and require it before a booking is confirmed. Deposits are paid out to you.',
    detail: [
      'Turn deposits on or off and set the amount yourself, unless your studio manages deposits.',
      'Studio artists can send reimbursement requests for supplies like needles, inks and aftercare stock, for the studio to include in payouts.',
    ],
    images: [],
  },
  {
    id: 'consent',
    art: 'languages',
    section: 'Clients',
    title: 'Consent forms',
    summary: 'Clients read and agree to your consent form before they book.',
    desc: 'Write your consent form once. Clients scroll through it and agree to the terms before continuing to their booking request.',
    detail: [
      'Use your own wording, or the consent form your studio sets.',
    ],
    images: [],
  },
  {
    // The app's weekly analytics page is switched off for now (ProfileView), so
    // describe the stats artists can see today: views and saves on their profile.
    id: 'analytics',
    art: 'analytics',
    section: 'Growth',
    title: 'Views & saves',
    summary: 'See how often your work is viewed and saved, right on your profile.',
    desc: 'Your profile shows how many times your work has been viewed and saved, with the full count a tap away.',
    detail: [
      'Views and saves add up across every piece you post, so you can see what draws people in.',
    ],
    images: [],
  },
];

export const ARTIST_FEATURE_CATALOG = FEATURES;

// The three phone moments shown while seated at the station. `ring` and each
// chip's `y` are percentages of the screenshot, pointing at the real UI.
export const ARTIST_MOMENTS = [
  {
    id: 'found',
    label: 'Get found',
    title: 'Your work.\nFound.',
    text: 'Import from Instagram in one tap. Every piece is tagged so clients searching your style find you.',
    screen: 'portfolio',
    alt: 'An artist profile and portfolio grid in the Vanta app',
    ring: { top: 49.5, left: 4.5, width: 91, height: 28.5 },
    chips: [
      { label: 'Imported from Instagram', y: 9, side: 'right' },
      { label: 'Tagged by style & placement', y: 63, side: 'left' },
    ],
  },
  {
    id: 'request',
    label: 'Quote & deposit',
    title: 'Every detail.\nBefore you reply.',
    text: 'Placement, colour and references arrive up front. Send a quote and times, and the deposit confirms it.',
    screen: 'proposal',
    alt: 'A booking with the artist’s proposed times, quote and deposit in the Vanta app',
    ring: { top: 37.5, left: 4.5, width: 91, height: 23.5 },
    chips: [
      { label: 'Quote $300 · 4 hours', y: 41, side: 'left' },
      { label: 'Deposit $50 to confirm', y: 48, side: 'right' },
    ],
  },
  {
    id: 'week',
    label: 'Your week',
    title: 'Your week.\nBooked in.',
    text: 'Confirmed sessions land in your calendar, only inside the hours you set.',
    screen: 'calendar',
    alt: 'The artist booking calendar in the Vanta app',
    ring: { top: 47.5, left: 4, width: 92, height: 9.5 },
    chips: [
      { label: 'Inside your working hours', y: 32, side: 'right' },
      { label: 'Sat 10:00 · confirmed', y: 52, side: 'left' },
    ],
  },
];
