// Build and serve out/ locally before running. Remote services are fully mocked.
// STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/mobile-smoke.cjs
const assert = require('node:assert/strict');
const { chromium, webkit } = require(process.env.STUDIO_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.STUDIO_TEST_URL || 'http://127.0.0.1:3019';
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const client = { id: 'client-1', name: 'Alexandra Montgomery-Williams', email: 'alexandra.montgomery@example.test', phone: '+61412345678', booking_count: 12, last_booking: now.toISOString() };
const artists = Array.from({ length: 3 }, (_, i) => ({ id: `membership-${i}`, artistId: `artist-${i}`, name: ['Sam Anderson', 'Jamie Lee', 'Taylor Smith'][i], email: `artist${i}@example.test`, status: 'approved', acceptingBookings: true }));
const booking = { id: 'booking-1', requester_name: client.name, requester_email: client.email, requester_phone: client.phone, artist_id: 'artist-0', artist_name: artists[0].name, status: 'confirmed', source: 'studio', chosen_time: `${date}T11:00:00`, created_at: now.toISOString(), duration_minutes: 90, estimated_quote: 450, body_location: 'Upper arm', session_type: 'tattoo' };
const entries = artists.map((artist, i) => ({ bookingId: i ? `booking-${i + 1}` : booking.id, artistId: artist.artistId, artistName: artist.name, clientName: client.name, requesterEmail: client.email, source: 'studio', status: 'confirmed', chosenTime: `${date}T${11 + i}:00:00`, endTime: `${date}T${12 + i}:30:00`, durationMins: 90, stationId: `station-${i}`, stationName: `Station ${i + 1}` }));
const stations = artists.map((_, i) => ({ id: `station-${i}`, name: `Station ${i + 1}` }));

async function setup(context) {
  await context.addInitScript(() => {
    if (window !== window.top) return;
    const user = { id: '22222222-2222-4222-8222-222222222222', email: 'studio@example.test' };
    localStorage.setItem('sb-aznxvdnpvbcofaqxgmtu-auth-token', JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_at: 2000000000, user }));
    localStorage.setItem(`vanta-studio-tour:${user.id}`, 'complete');
    localStorage.setItem(`vanta-studio-artist-guide:${user.id}`, 'complete');
    sessionStorage.setItem('financial_unlocked', '1');
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (route.request().resourceType() === 'script') return route.fulfill({ contentType: 'application/javascript', body: '' });
    const path = url.pathname;
    let json = { audiences: [], clients: [], campaigns: [], connections: [], providers: {gmail:true,outlook:true}, hours: [], stations: [], templates: [], fields: {}, connected: false, notes: [], submissions: [], consents: {}, payouts: [], reimbursements: [] };
    if (path === '/auth/v1/user') json = {id:'22222222-2222-4222-8222-222222222222',email:'studio@example.test'};
    else if (path === '/studio/me/marketing') json = {available:true,ready:true,domain_available:true,stats:{consented_clients:1,sent_this_month:0,unsubscribed:0,failed_this_month:0},settings:{from_name:'Northside Studio',reply_to:'studio@example.test',sender_provider:'resend',footer_address:'Local test address',domain:'',domain_status:''}};
    else if (path === '/studio/me') json = { status: 'approved', studio_id: 'test-studio', studio: { name: 'Northside Tattoo Studio', timezone: 'Australia/Melbourne', subscription_status: 'active', payment_recording_requirement: 'studio_only' } };
    else if (path === '/studio/me/artists') json = { artists: url.searchParams.get('status') === 'approved' ? artists : [] };
    else if (path === '/studio/me/dashboard-attention') json = { bookings: [{ ...booking, id: 'pending-1', status: 'pending' }, { ...booking, id: 'confirmation-1', status: 'requires_confirmation' }], pending_artists: [], pending_reimbursements: [] };
    else if (path === '/studio/me/schedule') json = { entries };
    else if (path === '/studio/me/clients') json = { clients: [client] };
    else if (path === '/studio/me/clients/client-1') json = { client, bookings: [booking] };
    else if (path === '/studio/me/bookings') json = { bookings: [booking] };
    else if (path === '/studio/me/bookings/booking-1') json = booking;
    else if (path.endsWith('/sms')) json = { opt_in: false, opted_out: false, delivery: { status: 'not_opted_in' } };
    else if (path === '/studio/me/stations' || path === '/studio/me/stations/available') json = { stations };
    else if (path === '/studio/me/hours') json = { hours: Array.from({ length: 7 }, (_, day) => ({ day_of_week: day, open_time: '09:00', close_time: '18:00', is_closed: false })) };
    else if (path === '/studio/me/revenue') json = { summary: { gross_sales: 12345, completed_sessions: 12 }, weekly: [{ week_start: date, gross_sales: 12345, session_count: 12 }], by_artist: [{ artist_id: 'artist-0', artist_name: artists[0].name, session_count: 12, gross_sales: 12345 }] };
    await route.fulfill({ json });
  });
}

async function closeAppointment(page) {
  await page.getByRole('button', { name: 'Close new appointment' }).click();
  await page.waitForFunction(() => document.querySelector('.studio-appointment-panel')?.getAttribute('aria-hidden') === 'true' || document.querySelector('dialog[open][role="alertdialog"]'));
  const discard = page.getByRole('button', { name: 'Discard appointment', exact: true });
  if (await discard.isVisible()) await discard.click();
  await page.getByRole('dialog', { name: 'New Appointment', exact: true }).waitFor({ state: 'hidden' });
}

const layoutErrors = [];
async function contained(page, label) {
  const problems = await page.evaluate(() => {
    const main = document.querySelector('.studio-dashboard-main');
    const issues = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('document overflow');
    if (main && main.scrollWidth > main.clientWidth + 1) issues.push(`main overflow ${main.scrollWidth}/${main.clientWidth}`);
    for (const el of document.querySelectorAll('.studio-feature-header, .studio-feature-body, .studio-booking-row, .studio-client-row, .studio-mobile-nav')) {
      const box = el.getBoundingClientRect();
      if (box.width && (box.left < -1 || box.right > innerWidth + 1)) issues.push(`${el.className}: ${box.left}–${box.right}`);
    }
    return issues;
  });
  if (problems.length) { layoutErrors.push({ label, problems }); console.error(label, problems); }
}



module.exports = { setup, booking, client };
