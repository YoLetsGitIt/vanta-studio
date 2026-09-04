'use client';

import { useState, useEffect } from 'react';
import {
  getStudioArtists,
  getStudioSchedule,
  getStudioScheduleRange,
  getMyStudioAccount,
  listConsentTemplates,
  generateConsentLink,
  getBatchClientConsentSubmissions,
  getClientConsents,
  getDashboardAttention,
  getStudioRevenueStats,
  getStudioBooking,
  reviewReimbursement,
  approveStudioArtist,
  rejectStudioArtist,
  getStripeStatus,
} from '@/lib/api';
import { useRouter } from 'next/navigation';
import { initials, toISODate } from '@/lib/format';
import BookingDetailPanel from '@/components/BookingDetailPanel';
import CompleteBookingModal from '@/components/CompleteBookingModal';
import SendSelectionLinkModal from '@/components/SendSelectionLinkModal';
import DashboardQuickActions from '@/components/DashboardQuickActions';
import { requestConfirmation, showError } from '@/lib/feedback';
import { bookingActions } from '@/lib/bookingActions';


function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [toISODate(mon), toISODate(sun)];
}

function needsDepositPayment(booking) {
  const scheduledTime = booking.chosen_time ? new Date(booking.chosen_time).getTime() : NaN;
  const hasScheduledDate = Number.isFinite(scheduledTime);
  const depositRequired = booking.deposit_required === true && Number(booking.deposit_amount) > 0;
  const depositPaid = Boolean(booking.deposit_paid_at || booking.deposit_confirmed_at);
  const inactive = ['completed', 'cancelled', 'rejected', 'declined', 'timed_out', 'no_show'].includes(booking.status);
  return hasScheduledDate && depositRequired && !depositPaid && !inactive;
}

export default function HomePage() {
  const [artists, setArtists] = useState([]);
  const [todayEntries, setTodayEntries] = useState([]);
  const [weekEntries, setWeekEntries] = useState([]);
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [submissionsByEmail, setSubmissionsByEmail] = useState({});
  const [oldConsents, setOldConsents] = useState({ consents: {}, version: '1' });
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [unconfirmedCount, setUnconfirmedCount] = useState(0);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [unconfirmedBookings, setUnconfirmedBookings] = useState([]);
  const [overdueBookings, setOverdueBookings] = useState([]);
  const [paymentRecordingReq, setPaymentRecordingReq] = useState(null);
  const [sendingLink, setSendingLink] = useState(null);
  const [sentLink, setSentLink] = useState(null);
  const [attentionOpen, setAttentionOpen] = useState(true);
  const [todayRevenue, setTodayRevenue] = useState(null);
  const [openAttentionGroups, setOpenAttentionGroups] = useState({});
  const [attentionAction, setAttentionAction] = useState(null);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [completeBooking, setCompleteBooking] = useState(null);
  const [pendingArtists, setPendingArtists] = useState([]);
  const [pendingReimbursements, setPendingReimbursements] = useState([]);
  const [unpaidDepositBookings, setUnpaidDepositBookings] = useState([]);
  const [sendLinkOpen, setSendLinkOpen] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [loadError, setLoadError] = useState('');
  const router = useRouter();

  const TODAY_SENT_KEY = `consent_sent_${new Date().toISOString().slice(0, 10)}`;
  const [sentToday, setSentToday] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`consent_sent_${new Date().toISOString().slice(0, 10)}`) ?? '[]')); }
    catch { return new Set(); }
  });

  const today = toISODate(new Date());

  useEffect(() => {
    async function load() {
      try {
        const [weekStart, weekEnd] = getWeekRange();
        const [artistData, scheduleData, weekData, accountData, templateData, revenueData, attentionData] = await Promise.all([
          getStudioArtists('approved'),
          getStudioSchedule(today),
          getStudioScheduleRange(weekStart, weekEnd),
          getMyStudioAccount(),
          listConsentTemplates(),
          getStudioRevenueStats(today, today).catch(() => null),
          getDashboardAttention(),
        ]);

        const a = artistData.artists ?? [];
        const e = scheduleData.entries ?? [];
        const we = weekData.entries ?? [];
        const templates = templateData.templates ?? [];

        const req = accountData.studio?.payment_recording_requirement ?? null;
        setPaymentRecordingReq(req);
        setArtists(a);
        setTodayEntries(e);
        setWeekEntries(we);
        setConsentTemplates(templates);
        setTodayRevenue(revenueData?.summary ?? null);
        const allBookings = attentionData.bookings ?? [];
        setPendingArtists(attentionData.pending_artists ?? []);
        setPendingReimbursements(attentionData.pending_reimbursements ?? []);
        setUnpaidDepositBookings(allBookings.filter(needsDepositPayment));

        const pending = allBookings.filter(booking => booking.status === 'pending');
        const unconfirmed = allBookings.filter(booking => booking.status === 'requires_confirmation');
        setPendingBookings(pending);
        setPendingCount(pending.length);
        setUnconfirmedBookings(unconfirmed);
        setUnconfirmedCount(unconfirmed.length);

        // Find all overdue confirmed bookings from the same complete snapshot.
        if (req && req !== 'none' && req !== 'artist_only') {
          const now = Date.now();
          const overdue = allBookings.filter(booking => {
            if (booking.status !== 'confirmed' || !booking.chosen_time) return false;
            const duration = booking.proposed_duration_minutes ?? booking.duration_minutes ?? 60;
            const end = new Date(booking.chosen_time).getTime() + duration * 60000;
            return Number.isFinite(end) && end < now;
          }).sort((left, right) => new Date(left.chosen_time) - new Date(right.chosen_time));
          setOverdueBookings(overdue);
        }

        // Fetch consent data for today's unique client emails (both systems).
        const emails = [...new Set(e.map(x => x.requesterEmail).filter(Boolean))];
        if (emails.length > 0) {
          const [subData, oldData] = await Promise.allSettled([
            templates.length > 0 ? getBatchClientConsentSubmissions(emails) : Promise.resolve({ submissions: [] }),
            getClientConsents(emails),
          ]);
          if (subData.status === 'fulfilled') {
            const byEmail = {};
            for (const sub of (subData.value.submissions ?? [])) {
              if (!sub.client_email) continue;
              if (!byEmail[sub.client_email]) byEmail[sub.client_email] = [];
              byEmail[sub.client_email].push(sub);
            }
            setSubmissionsByEmail(byEmail);
          }
          if (oldData.status === 'fulfilled') {
            setOldConsents({
              consents: oldData.value.consents ?? {},
              version: oldData.value.current_version ?? '1',
            });
          }
        }
      } catch (error) {
        setLoadError(error?.message || 'We could not load your dashboard. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    getStripeStatus().then(status => setStripeConnected(!!(status?.connected && status?.charges_enabled))).catch(() => {});
  }, []);

  const firstTemplate = consentTemplates[0];

  function getConsentStatus(email) {
    if (!email) return 'unknown';
    // New system (template-based) takes priority.
    if (firstTemplate) {
      const subs = submissionsByEmail[email] ?? [];
      const sub = subs.find(s => s.template_id === firstTemplate.id);
      if (sub) {
        return new Date(sub.submitted_at) < new Date(firstTemplate.updated_at) ? 'outdated' : 'current';
      }
    }
    // Fall back to old version-based system.
    const old = oldConsents.consents[email];
    if (old?.consent_version === oldConsents.version) return 'current';
    if (old) return 'outdated';
    // No templates configured — don't flag anyone.
    if (!firstTemplate) return 'unknown';
    return 'none';
  }

  async function handleSendLink(email) {
    setSendingLink(email);
    try {
      await generateConsentLink(email, firstTemplate?.id);
      setSentLink(email);
      const next = new Set(sentToday);
      next.add(email);
      setSentToday(next);
      localStorage.setItem(TODAY_SENT_KEY, JSON.stringify([...next]));
      setTimeout(() => setSentLink(null), 3000);
    } catch (e) { showError(e); }
    finally { setSendingLink(null); }
  }

  function toggleAttentionGroup(key) {
    setOpenAttentionGroups(current => ({ ...current, [key]: !current[key] }));
  }

  async function runAttentionAction(key, action, onDone) {
    setAttentionAction(key);
    try {
      await action();
      onDone?.();
    } catch (e) {
      showError(e);
    } finally {
      setAttentionAction(null);
    }
  }

  async function openBookingReview(bookingOrId) {
    const id = typeof bookingOrId === 'string' ? bookingOrId : bookingOrId.id ?? bookingOrId.bookingId;
    setReviewBooking(typeof bookingOrId === 'object' ? bookingOrId : { id });
    setReviewLoading(true);
    try { setReviewBooking(await getStudioBooking(id)); }
    catch { /* retain summary data in the sidebar */ }
    finally { setReviewLoading(false); }
  }

  async function confirmReviewedBooking() {
    if (!reviewBooking?.id) return;
    await runAttentionAction(reviewBooking.id, () => bookingActions.confirm(reviewBooking.id), () => {
      setUnconfirmedBookings(items => items.filter(item => item.id !== reviewBooking.id));
      setUnconfirmedCount(count => Math.max(0, count - 1));
      setReviewBooking(null);
    });
  }

  async function completeReviewedBooking(finalPrice, paymentSplits) {
    if (!completeBooking?.id) return;
    await runAttentionAction(completeBooking.id, () => bookingActions.complete(completeBooking.id, { finalPrice, paymentSplits }), () => {
      setOverdueBookings(items => items.filter(item => item.id !== completeBooking.id));
      setCompleteBooking(null);
      setReviewBooking(null);
    });
  }

  function openSendLink() {
    setSendLinkOpen(true);
  }

  async function handleSelectionLinkSent(id) {
    const refreshed = await getStudioBooking(id);
    setReviewBooking(refreshed);
    setUnpaidDepositBookings(items => {
      const withoutBooking = items.filter(item => item.id !== refreshed.id);
      return needsDepositPayment(refreshed) ? [...withoutBooking, refreshed] : withoutBooking;
    });
    if (refreshed.status !== 'pending') {
      setPendingBookings(items => items.filter(item => item.id !== refreshed.id));
      setPendingCount(count => Math.max(0, count - (pendingBookings.some(item => item.id === refreshed.id) ? 1 : 0)));
    }
  }

  // Group today by artist
  const byArtist = {};
  for (const entry of todayEntries) {
    const key = entry.artistId ?? '__unassigned__';
    if (!byArtist[key]) byArtist[key] = [];
    byArtist[key].push(entry);
  }

  const artistsWorkingToday = artists.filter(a => byArtist[a.artistId ?? a.id]);
  const artistsOffToday = artists.filter(a => !byArtist[a.artistId ?? a.id]);

  // Week utilization per artist
  const weekByArtist = {};
  for (const entry of weekEntries) {
    if (!entry.artistId) continue;
    weekByArtist[entry.artistId] = (weekByArtist[entry.artistId] || 0) + 1;
  }
  const maxWeekCount = Math.max(1, ...Object.values(weekByArtist));
  const weekUtilization = [...artists]
    .map(a => ({ artist: a, count: weekByArtist[a.artistId ?? a.id] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const awaitingPaymentCount = unpaidDepositBookings.length;

  // Clients today missing consent (deduped by email)
  const consentNeededEntries = todayEntries
    .filter(e => e.requesterEmail && getConsentStatus(e.requesterEmail) !== 'current' && getConsentStatus(e.requesterEmail) !== 'unknown')
    .reduce((acc, e) => {
      if (!acc.some(x => x.requesterEmail === e.requesterEmail)) acc.push(e);
      return acc;
    }, [])
    .sort((a, b) => new Date(a.chosenTime) - new Date(b.chosenTime));

  const hasPending = pendingCount > 0 || unconfirmedCount > 0 || awaitingPaymentCount > 0 || consentNeededEntries.length > 0 || overdueBookings.length > 0 || pendingArtists.length > 0 || pendingReimbursements.length > 0;
  const attentionCount = pendingCount + unconfirmedCount + awaitingPaymentCount + consentNeededEntries.length + overdueBookings.length + pendingArtists.length + pendingReimbursements.length;
  const upcomingToday = [...todayEntries]
    .filter(e => new Date(e.chosenTime).getTime() + (e.durationMins ?? 60) * 60000 >= Date.now())
    .sort((a, b) => new Date(a.chosenTime) - new Date(b.chosenTime))
    .slice(0, 4);
  const isEmptyDashboard = !loadError && !hasPending && artists.length === 0 && todayEntries.length === 0 && weekEntries.length === 0;
  const dateLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Today</h1>
        <p style={s.date}>{dateLabel}</p>
      </div>

      <div style={s.body} className="studio-home-body">
        {loading && <p style={s.msg}>Loading...</p>}

        {!loading && loadError && (
          <div role="alert" style={s.loadError}>
            <div>
              <strong style={s.loadErrorTitle}>Dashboard couldn&apos;t be loaded</strong>
              <p style={s.loadErrorText}>{loadError}</p>
            </div>
            <button type="button" style={s.inlinePrimary} onClick={() => window.location.reload()}>Try again</button>
          </div>
        )}

        {!loading && isEmptyDashboard && (
          <div style={s.emptyState}>
            <div style={s.emptyIcon}>✦</div>
            <div style={s.emptyCopy}>
              <span style={s.emptyEyebrow}>YOUR STUDIO IS READY</span>
              <h2 style={s.emptyTitle}>Start with your booking flow.</h2>
              <p style={s.emptyText}>Set up the details clients will see, then invite your artists when you&apos;re ready.</p>
            </div>
            <div style={s.emptyActions}>
              <button type="button" style={s.emptyPrimary} onClick={() => router.push('/dashboard/settings?tab=bookings')}>Set up bookings <span>→</span></button>
              <button type="button" style={s.emptySecondary} onClick={() => router.push('/dashboard/artists?onboarding=1')}>Add your first artist</button>
            </div>
          </div>
        )}


        {/* ── NEEDS ATTENTION ───────────────────────────────────── */}
        {!loading && !loadError && !isEmptyDashboard && (
          <div style={s.section}>
            <button type="button" style={s.sectionToggle} onClick={() => setAttentionOpen(v => !v)} aria-expanded={attentionOpen}>
              <span style={s.sectionLabel}>NEEDS ATTENTION</span>
              <span style={s.attentionHeaderMeta}><b style={s.attentionCount}>{attentionCount}</b>{attentionOpen ? 'Hide' : 'Show'} <span style={{ transform: attentionOpen ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>⌄</span></span>
            </button>
            {attentionOpen && (
            <div style={s.attentionCard}>
              {pendingCount > 0 && (
                <AttentionGroup title="Pending bookings" icon="calendar" count={pendingCount} subtitle="Awaiting your approval" open={!!openAttentionGroups.pending} onToggle={() => toggleAttentionGroup('pending')}>
                  {pendingBookings.map(booking => (
                    <AttentionItem key={booking.id} title={booking.requester_name ?? 'Client'} subtitle={bookingSubtitle(booking)}>
                      <button style={s.inlinePrimary} onClick={() => openBookingReview(booking)}>Review booking</button>
                    </AttentionItem>
                  ))}
                </AttentionGroup>
              )}

              {unconfirmedCount > 0 && (
                <AttentionGroup title="Booking confirmations" icon="check" count={unconfirmedCount} subtitle="Bookings awaiting studio confirmation" open={!!openAttentionGroups.confirmation} onToggle={() => toggleAttentionGroup('confirmation')}>
                  {unconfirmedBookings.map(booking => (
                    <AttentionItem key={booking.id} title={booking.requester_name ?? 'Client'} subtitle={bookingSubtitle(booking)}>
                      <button style={s.inlinePrimary} onClick={() => openBookingReview(booking)}>Review & confirm</button>
                    </AttentionItem>
                  ))}
                </AttentionGroup>
              )}

              {awaitingPaymentCount > 0 && (
                <AttentionGroup title="Unpaid deposits" icon="card" count={awaitingPaymentCount} subtitle="Deposit not yet received" open={!!openAttentionGroups.payment} onToggle={() => toggleAttentionGroup('payment')}>
                  {unpaidDepositBookings.map(booking => (
                    <AttentionItem key={booking.id} title={booking.requester_name ?? 'Client'} subtitle={bookingSubtitle(booking)}>
                      <button style={s.inlineSecondary} onClick={() => openBookingReview(booking)}>Open booking</button>
                    </AttentionItem>
                  ))}
                </AttentionGroup>
              )}

              {overdueBookings.length > 0 && (
                <AttentionGroup title="Incomplete past sessions" icon="clock" count={overdueBookings.length} subtitle="Past sessions still need an outcome and payment" open={!!openAttentionGroups.overdue} onToggle={() => toggleAttentionGroup('overdue')}>
                  {overdueBookings.map(booking => (
                    <AttentionItem key={booking.id} title={booking.requester_name ?? 'Client'} subtitle={bookingSubtitle(booking)}>
                      <button style={s.inlinePrimary} onClick={() => openBookingReview(booking)}>Record outcome</button>
                    </AttentionItem>
                  ))}
                </AttentionGroup>
              )}

              {consentNeededEntries.length > 0 && (
                <AttentionGroup title="Clients missing consent forms" icon="document" count={consentNeededEntries.length} subtitle="Upcoming clients without current consent" open={!!openAttentionGroups.consent} onToggle={() => toggleAttentionGroup('consent')}>
                  {consentNeededEntries.map(entry => {
                    const status = getConsentStatus(entry.requesterEmail);
                    const isSending = sendingLink === entry.requesterEmail;
                    const isSent = sentLink === entry.requesterEmail;
                    const wasSentToday = sentToday.has(entry.requesterEmail);
                    return (
                      <AttentionItem key={entry.requesterEmail} title={entry.clientName} subtitle={`${formatTime(entry.chosenTime)} · ${status === 'outdated' ? 'Outdated consent' : 'Not consented'}`} badge={wasSentToday ? 'Consent sent today' : null}>
                        <button style={{ ...s.inlinePrimary, opacity: isSending ? 0.6 : 1 }} onClick={() => handleSendLink(entry.requesterEmail)} disabled={isSending}>
                          {isSent ? 'Sent ✓' : isSending ? 'Sending…' : 'Send link'}
                        </button>
                      </AttentionItem>
                    );
                  })}
                </AttentionGroup>
              )}

              {pendingArtists.length > 0 && (
                <AttentionGroup title="Pending artist requests" icon="user" count={pendingArtists.length} subtitle="Artists waiting to join your studio" open={!!openAttentionGroups.artists} onToggle={() => toggleAttentionGroup('artists')}>
                  {pendingArtists.map(artist => (
                    <AttentionItem key={artist.id} title={artist.name ?? 'Artist'} subtitle={[artist.email, artist.instagram].filter(Boolean).join(' · ') || 'Studio association request'}>
                      <button style={s.inlinePrimary} disabled={attentionAction === artist.id} onClick={() => runAttentionAction(artist.id, () => approveStudioArtist(artist.id), () => setPendingArtists(items => items.filter(item => item.id !== artist.id)))}>Approve</button>
                      <button style={s.inlineDanger} disabled={attentionAction === artist.id} onClick={async () => {
                        const confirmed = await requestConfirmation({ title: 'Reject artist request?', message: `${artist.name ?? 'This artist'} will not be added to your studio.`, confirmLabel: 'Reject request', danger: true });
                        if (confirmed) runAttentionAction(artist.id, () => rejectStudioArtist(artist.id), () => setPendingArtists(items => items.filter(item => item.id !== artist.id)));
                      }}>Reject</button>
                    </AttentionItem>
                  ))}
                </AttentionGroup>
              )}

              {pendingReimbursements.length > 0 && (
                <AttentionGroup title="Pending reimbursements" icon="receipt" count={pendingReimbursements.length} subtitle="Expense claims waiting for review" open={!!openAttentionGroups.reimbursements} onToggle={() => toggleAttentionGroup('reimbursements')}>
                  {pendingReimbursements.map(item => (
                    <AttentionItem key={item.id} title={`${item.artist_name ?? 'Artist'} · $${Number(item.amount ?? 0).toFixed(2)}`} subtitle={item.description || 'Reimbursement request'}>
                      <button style={s.inlinePrimary} disabled={attentionAction === item.id} onClick={() => runAttentionAction(item.id, () => reviewReimbursement(item.id, 'approve'), () => setPendingReimbursements(items => items.filter(entry => entry.id !== item.id)))}>Mark paid</button>
                      <button style={s.inlineDanger} disabled={attentionAction === item.id} onClick={async () => {
                        const confirmed = await requestConfirmation({ title: 'Reject reimbursement?', message: 'The reimbursement request will be marked as rejected.', confirmLabel: 'Reject request', danger: true });
                        if (confirmed) runAttentionAction(item.id, () => reviewReimbursement(item.id, 'reject'), () => setPendingReimbursements(items => items.filter(entry => entry.id !== item.id)));
                      }}>Reject</button>
                    </AttentionItem>
                  ))}
                </AttentionGroup>
              )}

              {pendingCount === 0 && <EmptyAttentionGroup title="Pending bookings" icon="calendar" />}
              {unconfirmedCount === 0 && <EmptyAttentionGroup title="Booking confirmations" icon="check" />}
              {awaitingPaymentCount === 0 && <EmptyAttentionGroup title="Unpaid deposits" icon="card" />}
              {overdueBookings.length === 0 && <EmptyAttentionGroup title="Incomplete past sessions" icon="clock" />}
              {consentNeededEntries.length === 0 && <EmptyAttentionGroup title="Clients missing consent forms" icon="document" />}
              {pendingReimbursements.length === 0 && <EmptyAttentionGroup title="Pending reimbursements" icon="receipt" />}

            </div>
            )}
          </div>
        )}

        {/* ── TODAY AT THE STUDIO ───────────────────────────────── */}
        {!loading && !isEmptyDashboard && (
          <div style={s.section}>
            <div style={s.sectionHeadingRow}>
              <span style={s.sectionLabel}>TODAY AT THE STUDIO</span>
              <button type="button" style={s.textLink} onClick={() => router.push('/dashboard/schedule')}>Open schedule →</button>
            </div>
            <div style={s.twoCol} className="studio-home-two-col">
              <div style={s.card}>
                <span style={s.cardLabel}>Next appointments</span>
                {upcomingToday.length === 0 ? <span style={s.empty}>No more appointments today</span> : upcomingToday.map(entry => (
                  <button key={entry.bookingId} type="button" style={s.todayBookingRow} onClick={() => router.push('/dashboard/schedule')}>
                    <span style={s.todayTime}>{formatTime(entry.chosenTime)}</span>
                    <span style={s.todayBookingCopy}>
                      <strong style={s.artistRowName}>{entry.clientName}</strong>
                      <small style={s.attentionSub}>{entry.artistName ?? 'Unassigned'}{entry.stationName ? ` · ${entry.stationName}` : ' · No station'}</small>
                    </span>
                    <span style={s.attentionChevron}>→</span>
                  </button>
                ))}
              </div>
              <div style={s.card}>
                <span style={s.cardLabel}>Artists in today ({artistsWorkingToday.length})</span>
                {artistsWorkingToday.length === 0 ? <span style={s.empty}>No artists scheduled</span> : artistsWorkingToday.map(a => (
                  <div key={a.id} style={s.artistRow}>
                    {a.profileImage ? (
                      <img src={a.profileImage} alt={a.name} style={s.avatarSm} />
                    ) : (
                      <div style={{ ...s.avatarSm, ...s.avatarFallback }}>{initials(a.name)}</div>
                    )}
                    <span style={s.artistRowName}>{a.name}</span>
                    <span style={s.countBadge}>{(byArtist[a.artistId ?? a.id] ?? []).length} booking{(byArtist[a.artistId ?? a.id] ?? []).length === 1 ? '' : 's'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── QUICK ACTIONS ─────────────────────────────────────── */}
        {!loading && !isEmptyDashboard && (
          <div style={s.section}>
            <span style={s.sectionLabel}>QUICK ACTIONS</span>
            <DashboardQuickActions artists={artists} />
          </div>
        )}

        {/* ── DAILY MONEY ───────────────────────────────────────── */}
        {!loading && !isEmptyDashboard && (
          <div style={s.section}>
            <div style={s.sectionHeadingRow}>
              <span style={s.sectionLabel}>DAILY MONEY</span>
              <button type="button" style={s.textLink} onClick={() => router.push('/dashboard/financial')}>Review finances →</button>
            </div>
            <div style={s.moneyGrid} className="studio-home-four-col">
              <MoneyStat label="Collected today" value={todayRevenue?.gross_sales} accent />
              <MoneyStat label="Deposits received" value={todayRevenue?.deposits_collected} />
              <MoneyStat label="Outstanding" value={todayRevenue?.remaining_balances} />
              <MoneyStat label="Completed sessions" value={todayRevenue?.completed_sessions ?? 0} money={false} />
            </div>
          </div>
        )}

        {/* ── THIS WEEK ─────────────────────────────────────────── */}
        {!loading && !isEmptyDashboard && artists.length > 0 && (
          <div style={s.section}>
            <span style={s.sectionLabel}>THIS WEEK</span>
            <div style={s.card}>
              <div style={s.utilList}>
                {weekUtilization.map(({ artist, count }) => (
                  <div key={artist.id} style={s.utilRow}>
                    <span style={s.utilName}>{artist.name}</span>
                    <div style={s.utilBarBg}>
                      <div style={{ ...s.utilBarFill, width: count === 0 ? '0%' : `${Math.max(4, (count / maxWeekCount) * 100)}%` }} />
                    </div>
                    <span style={s.utilCount}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {reviewBooking && (
        <BookingDetailPanel
          booking={reviewBooking.id ? reviewBooking : null}
          entry={reviewBooking.bookingId ? reviewBooking : null}
          loading={reviewLoading}
          onClose={() => setReviewBooking(null)}
          onConfirm={reviewBooking.status === 'requires_confirmation' ? confirmReviewedBooking : undefined}
          onComplete={reviewBooking.status === 'confirmed' ? () => setCompleteBooking(reviewBooking) : undefined}
          onSendLink={reviewBooking.status === 'pending' || reviewBooking.status === 'awaiting_payment' ? openSendLink : undefined}
          actionLoading={attentionAction === reviewBooking.id}
        />
      )}

      {sendLinkOpen && reviewBooking && (
        <SendSelectionLinkModal booking={reviewBooking} artists={artists} stripeConnected={stripeConnected} onClose={() => setSendLinkOpen(false)} onSent={handleSelectionLinkSent} />
      )}

      {completeBooking && (
        <CompleteBookingModal
          initialPrice={completeBooking.estimated_quote ?? completeBooking.final_price}
          depositAmount={completeBooking.deposit_amount ?? null}
          onConfirm={completeReviewedBooking}
          onCancel={() => setCompleteBooking(null)}
          saving={attentionAction === completeBooking.id}
        />
      )}
    </div>
  );
}

function ArtistGuide({ studioName, copied, onCopy, onClose, onViewRequests }) {
  return (
    <div style={s.artistGuideOverlay} role="dialog" aria-modal="true" aria-label="Add your first artist">
      <div style={s.artistGuideCard}>
        <button type="button" onClick={onClose} style={s.artistGuideClose} aria-label="Close">×</button>
        <div style={s.artistGuideIntro}>
          <span style={s.artistGuideEyebrow}>BUILD YOUR TEAM</span>
          <h2 style={s.artistGuideTitle}>Add your first artist.</h2>
          <p style={s.artistGuideText}>Artists join from the Vanta mobile app. Once they select your studio, you approve their request here.</p>
          <div style={s.artistGuideSteps}>
            <GuideStep number="1" title="Share your studio name" body="Send this exact name to your artist so they can find the right studio." />
            <div style={s.studioNameChip}>
              <span>{studioName}</span>
              <button type="button" onClick={onCopy} style={s.copyStudioName}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <GuideStep number="2" title="They join on mobile" body="They create an artist profile, search for your studio, and select it during setup." />
            <GuideStep number="3" title="Approve their request" body="Their request lands in Artists → Pending review. Approve them to add them to your schedule." />
          </div>
          <div style={s.artistGuideActions}>
            <button type="button" onClick={onViewRequests} style={s.artistGuidePrimary}>View pending requests <span>→</span></button>
            <button type="button" onClick={onClose} style={s.artistGuideSecondary}>Done for now</button>
          </div>
        </div>
        <div style={s.mobilePreviewWrap}>
          <span style={s.mobilePreviewLabel}>ARTIST MOBILE APP</span>
          <div style={s.mobilePhone}>
            <div style={s.phoneSpeaker} />
            <div style={s.phoneScreen}>
              <span style={s.phoneKicker}>STUDIO</span>
              <h3 style={s.phoneTitle}>Where do you work?</h3>
              <p style={s.phoneText}>Search for your studio to send a request.</p>
              <div style={s.phoneSearch}>⌕ <span>{studioName}</span></div>
              <div style={s.phoneResult}>
                <div style={s.phoneResultMark}>v</div>
                <div><strong>{studioName}</strong><small>Studio account</small></div>
                <span>✓</span>
              </div>
              <button type="button" style={s.phoneContinue}>Continue</button>
            </div>
          </div>
          <p style={s.mobilePreviewCaption}>The artist selects your studio, then you approve the request from the web dashboard.</p>
        </div>
      </div>
    </div>
  );
}

function GuideStep({ number, title, body }) {
  return <div style={s.guideStep}><span style={s.guideStepNumber}>{number}</span><div><strong style={s.guideStepTitle}>{title}</strong><p style={s.guideStepBody}>{body}</p></div></div>;
}

function MoneyStat({ label, value, accent = false, money = true }) {
  const display = money
    ? `$${Number(value ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : Number(value ?? 0).toLocaleString('en-AU');
  return (
    <div style={s.moneyStat}>
      <span style={s.moneyLabel}>{label}</span>
      <strong style={{ ...s.moneyValue, color: accent ? 'var(--accent)' : 'var(--text)' }}>{display}</strong>
    </div>
  );
}

function bookingSubtitle(booking) {
  const when = booking.chosen_time ?? booking.proposed_time_primary;
  const date = when ? new Date(when).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'Date to be arranged';
  const time = when ? formatTime(when) : null;
  const artist = booking.artist_name ?? 'Unassigned artist';
  return [date, time, artist].filter(Boolean).join(' · ');
}

function AttentionGroup({ title, icon, count, subtitle, open, onToggle, children }) {
  return (
    <div style={s.attentionGroup}>
      <button type="button" style={s.attentionRow} onClick={onToggle} aria-expanded={open}>
        <AttentionIcon name={icon} />
        <div style={s.attentionBody}>
          <span style={s.attentionGroupTitleRow}><span style={s.attentionTitle}>{title}</span><strong style={s.groupCount}>{count}</strong></span>
          <span style={s.attentionSub}>{subtitle}</span>
        </div>
        <span style={{ ...s.attentionChevron, transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </button>
      {open && <div style={s.attentionItems}>{children}</div>}
    </div>
  );
}

function AttentionItem({ title, subtitle, badge, children }) {
  return (
    <div style={s.attentionItem} className="studio-attention-item">
      <div style={s.attentionBody}>
        <div style={s.attentionItemTitleRow}>
          <span style={s.attentionTitle}>{title}</span>
          {badge && <span style={s.sentTodayBadge}>{badge}</span>}
        </div>
        <span style={s.attentionSub}>{subtitle}</span>
      </div>
      <div style={s.attentionActions} className="studio-attention-actions">{children}</div>
    </div>
  );
}

function EmptyAttentionGroup({ title, icon }) {
  return (
    <div style={s.emptyAttentionRow} aria-label={`${title}: none`}>
      <AttentionIcon name={icon} />
      <span style={s.emptyAttentionTitle}>{title}</span>
      <span style={s.noneBadge}>None</span>
    </div>
  );
}

function AttentionIcon({ name }) {
  const paths = {
    calendar: <><rect x="3" y="4.5" width="14" height="12" rx="2"/><path d="M6 2.5v4M14 2.5v4M3 8.5h14"/></>,
    check: <><circle cx="10" cy="10" r="7"/><path d="m6.8 10 2.1 2.1 4.4-4.5"/></>,
    card: <><rect x="2.5" y="5" width="15" height="10" rx="2"/><path d="M2.5 8.5h15M6 12h2.5"/></>,
    clock: <><circle cx="10" cy="10" r="7"/><path d="M10 6v4.3l2.8 1.7"/></>,
    document: <><path d="M5 2.5h7l3 3V17H5z"/><path d="M12 2.5V6h3M7.5 9.5h5M7.5 12.5h5"/></>,
    user: <><circle cx="10" cy="7" r="3"/><path d="M4.5 17c.5-3.1 2.3-4.7 5.5-4.7s5 1.6 5.5 4.7"/></>,
    receipt: <><path d="M5 2.5 7 4l2-1.5L11 4l2-1.5L15 4v13l-2-1.5-2 1.5-2-1.5L7 17l-2-1.5z"/><path d="M8 8h4M8 11h4"/></>,
  };
  return <span style={s.attentionIcon}><svg viewBox="0 0 20 20" aria-hidden="true" style={s.attentionIconSvg}>{paths[name] ?? paths.document}</svg></span>;
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    padding: '1.75rem 2rem 1.25rem',
    borderBottom: '1px solid var(--border-faint)',
    flexShrink: 0,
  },
  title: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', margin: 0 },
  date: { fontSize: '0.8rem', color: 'var(--text-faint)', marginTop: '0.2rem', marginBottom: 0 },
  body: {
    flex: 1, overflowY: 'auto',
    padding: '1.5rem 2rem 2rem',
    display: 'flex', flexDirection: 'column', gap: '1.75rem',
  },
  msg: { fontSize: '0.875rem', color: 'var(--text-faint)' },
  loadError: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.1rem', borderRadius: 10, border: '1px solid rgba(224,96,96,0.38)', background: 'rgba(224,96,96,0.07)' },
  loadErrorTitle: { display: 'block', color: 'var(--text)', fontSize: '0.9rem' },
  loadErrorText: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' },

  emptyState: {
    width: 'min(100%, 620px)', minHeight: 380, margin: 'auto',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '1.4rem',
    padding: '2.5rem', borderRadius: 16,
    background: 'linear-gradient(135deg, var(--accent-tint), var(--bg-card))',
    border: '1px solid var(--accent-tint-border)', boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
  },
  emptyIcon: {
    width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 12,
    color: 'var(--accent)', background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', fontSize: '1.1rem',
  },
  emptyCopy: { display: 'flex', flexDirection: 'column', gap: '0.45rem', maxWidth: 440 },
  emptyEyebrow: { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-ghost)' },
  emptyTitle: { margin: 0, fontSize: '1.55rem', lineHeight: 1.1, letterSpacing: '-0.035em', color: 'var(--text)' },
  emptyText: { margin: 0, fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--text-muted)' },
  emptyActions: { display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' },
  emptyPrimary: {
    border: 0, borderRadius: 8, padding: '0.72rem 0.95rem', background: 'var(--accent)', color: 'var(--accent-contrast)',
    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: '0.7rem', alignItems: 'center',
  },
  emptySecondary: {
    border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', background: 'transparent', color: 'var(--text-muted)',
    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  },
  artistGuideOverlay: { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: '1.25rem', background: 'rgba(5,7,11,0.78)', backdropFilter: 'blur(8px)' },
  artistGuideCard: { width: 'min(100%, 940px)', maxHeight: 'min(760px, calc(100vh - 2.5rem))', overflow: 'auto', position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(250px, 0.7fr)', gap: '2rem', padding: '2rem', borderRadius: 18, background: '#171b24', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 30px 100px rgba(0,0,0,0.5)' },
  artistGuideClose: { position: 'absolute', top: 14, right: 16, width: 32, height: 32, border: '1px solid var(--border)', borderRadius: '50%', background: 'transparent', color: 'var(--text-muted)', fontSize: '1.35rem', lineHeight: 1, cursor: 'pointer' },
  artistGuideIntro: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  artistGuideEyebrow: { fontSize: '0.66rem', letterSpacing: '0.11em', fontWeight: 700, color: 'var(--accent)' },
  artistGuideTitle: { margin: '0.45rem 0 0', fontSize: '1.7rem', letterSpacing: '-0.04em', color: 'var(--text)' },
  artistGuideText: { margin: '0.7rem 0 1.4rem', maxWidth: 500, fontSize: '0.88rem', lineHeight: 1.55, color: 'var(--text-muted)' },
  artistGuideSteps: { display: 'flex', flexDirection: 'column', gap: '0.95rem', width: '100%' },
  guideStep: { display: 'flex', gap: '0.75rem' },
  guideStepNumber: { width: 22, height: 22, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'var(--accent-tint)', color: 'var(--accent)', fontSize: '0.68rem', fontWeight: 700 },
  guideStepTitle: { display: 'block', fontSize: '0.82rem', color: 'var(--text)' },
  guideStepBody: { margin: '0.2rem 0 0', fontSize: '0.76rem', lineHeight: 1.45, color: 'var(--text-ghost)' },
  studioNameChip: { margin: '-0.3rem 0 0 2.75rem', padding: '0.55rem 0.6rem 0.55rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--accent-tint-border)', borderRadius: 8, background: 'var(--accent-tint)', fontSize: '0.76rem', color: 'var(--accent)' },
  copyStudioName: { border: 0, borderRadius: 5, padding: '0.3rem 0.5rem', background: 'var(--accent-active-tint)', color: 'var(--accent)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' },
  artistGuideActions: { display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '1.5rem' },
  artistGuidePrimary: { border: 0, borderRadius: 8, padding: '0.7rem 0.85rem', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.55rem' },
  artistGuideSecondary: { border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.85rem', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' },
  mobilePreviewWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0.5rem 0' },
  mobilePreviewLabel: { fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.11em', color: 'var(--text-ghost)' },
  mobilePhone: { width: 224, padding: '0.45rem', borderRadius: 28, background: '#090c12', border: '4px solid #353944', boxShadow: '0 20px 48px rgba(0,0,0,0.3)' },
  phoneSpeaker: { width: 64, height: 5, margin: '0.15rem auto 0.45rem', borderRadius: 4, background: '#353944' },
  phoneScreen: { minHeight: 350, padding: '1.15rem', display: 'flex', flexDirection: 'column', borderRadius: 21, background: 'linear-gradient(150deg, #151b27, #0d1017)' },
  phoneKicker: { fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.12em', color: '#8f96a3' },
  phoneTitle: { margin: '0.5rem 0 0', fontSize: '1.05rem', letterSpacing: '-0.04em', color: '#fff' },
  phoneText: { margin: '0.45rem 0 0.9rem', fontSize: '0.64rem', lineHeight: 1.45, color: '#9ba1ac' },
  phoneSearch: { padding: '0.55rem', display: 'flex', gap: '0.35rem', borderRadius: 7, background: 'rgba(255,255,255,0.07)', color: '#d9d2c3', fontSize: '0.62rem', overflow: 'hidden', whiteSpace: 'nowrap' },
  phoneResult: { marginTop: '0.65rem', padding: '0.58rem', display: 'flex', alignItems: 'center', gap: '0.45rem', borderRadius: 8, background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', color: 'var(--accent)', fontSize: '0.58rem' },
  phoneResultMark: { width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: 5, background: 'var(--accent)', color: 'var(--accent-contrast)', fontWeight: 800 },
  phoneContinue: { marginTop: 'auto', padding: '0.6rem', border: 0, borderRadius: 7, background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.63rem', fontWeight: 700 },
  mobilePreviewCaption: { maxWidth: 250, margin: 0, textAlign: 'center', fontSize: '0.69rem', lineHeight: 1.45, color: 'var(--text-ghost)' },

  // Section wrapper
  section: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  sectionLabel: {
    fontSize: '0.68rem', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--text-ghost)',
  },
  sectionToggle: { width: '100%', padding: 0, border: 0, background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left' },
  sectionHeadingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' },
  textLink: { padding: 0, border: 0, background: 'none', color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 600 },

  // Needs attention card
  attentionCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  attentionHeaderMeta: { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-faint)', fontSize: '0.7rem', fontWeight: 600 },
  attentionCount: { minWidth: 21, height: 21, padding: '0 0.35rem', display: 'grid', placeItems: 'center', borderRadius: 99, background: 'var(--accent-tint)', border: '1px solid var(--accent-tint-border)', color: 'var(--accent)', fontSize: '0.66rem' },
  attentionGroup: { borderBottom: '1px solid var(--border-faint)' },
  attentionGroupTitleRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  groupCount: { minWidth: 25, height: 21, padding: '0 0.4rem', display: 'grid', placeItems: 'center', borderRadius: 99, background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.68rem', lineHeight: 1 },
  attentionItems: { padding: '0 0.65rem 0.65rem 2.05rem', display: 'flex', flexDirection: 'column' },
  attentionItem: { minHeight: 54, padding: '0.7rem 0.45rem', borderTop: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: '0.75rem' },
  attentionItemTitleRow: { display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' },
  attentionActions: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' },
  inlinePrimary: { padding: '0.38rem 0.65rem', border: 0, borderRadius: 6, background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.69rem', fontWeight: 700, whiteSpace: 'nowrap' },
  inlineSecondary: { padding: '0.35rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-chip)', color: 'var(--text-muted)', fontSize: '0.69rem', fontWeight: 600, whiteSpace: 'nowrap' },
  inlineDanger: { padding: '0.35rem 0.6rem', border: '1px solid rgba(232,111,111,0.3)', borderRadius: 6, background: 'rgba(232,111,111,0.1)', color: '#e86f6f', fontSize: '0.69rem', fontWeight: 600, whiteSpace: 'nowrap' },
  inlineSelect: { maxWidth: 130, padding: '0.35rem 0.45rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text)', fontSize: '0.69rem' },
  emptyAttentionRow: { minHeight: 42, padding: '0.55rem 1.1rem', borderBottom: '1px solid var(--border-faint)', display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: 0.58 },
  emptyAttentionTitle: { flex: 1, color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 600 },
  noneBadge: { padding: '0.16rem 0.48rem', borderRadius: 99, background: 'var(--bg-chip)', border: '1px solid var(--border-faint)', color: 'var(--text-ghost)', fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  attentionRow: {
    display: 'flex', alignItems: 'center', gap: '0.9rem',
    padding: '0.85rem 1.1rem',
    borderBottom: '1px solid var(--border-faint)',
    background: 'none', border: 'none', width: '100%', textAlign: 'left',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-faint)',
  },
  attentionDot: (color) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: color, flexShrink: 0,
  }),
  attentionIcon: { width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 7, background: 'var(--bg-chip)', border: '1px solid var(--border-faint)', color: 'var(--text-faint)' },
  attentionIconSvg: { width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
  attentionBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  attentionTitle: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' },
  attentionSub: { fontSize: '0.72rem', color: 'var(--text-ghost)' },
  attentionChevron: { fontSize: '0.85rem', color: 'var(--text-ghost)', flexShrink: 0 },
  sentTodayBadge: {
    fontSize: '0.65rem', fontWeight: 600,
    padding: '0.1rem 0.45rem', borderRadius: 5,
    background: 'rgba(76,201,138,0.1)',
    color: '#4cc98a',
    border: '1px solid rgba(76,201,138,0.2)',
    flexShrink: 0,
  },
  sendBtn: {
    background: 'var(--bg-chip)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-muted)',
    fontSize: '0.72rem', fontWeight: 600,
    padding: '0.3rem 0.7rem',
    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
  },

  // Generic card
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-faint)',
    borderRadius: 12,
    padding: '1rem 1.1rem',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  cardLabel: {
    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
  },
  todayBookingRow: { width: '100%', padding: '0.55rem 0', border: 0, borderBottom: '1px solid var(--border-faint)', background: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' },
  todayTime: { width: 64, flexShrink: 0, color: 'var(--accent)', fontSize: '0.74rem', fontWeight: 700 },
  todayBookingCopy: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.12rem' },


  moneyGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.65rem' },
  moneyStat: { padding: '1rem 1.1rem', border: '1px solid var(--border-faint)', borderRadius: 10, background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  moneyLabel: { color: 'var(--text-faint)', fontSize: '0.7rem', fontWeight: 600 },
  moneyValue: { fontSize: '1.15rem', letterSpacing: '-0.025em' },

  modalOverlay: { position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: '1rem' },
  sendLinkModal: { width: 'min(100%, 360px)', padding: '1.4rem', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-panel)', boxShadow: 'var(--shadow-modal)', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  modalTitle: { margin: 0, color: 'var(--text)', fontSize: '1rem', fontWeight: 700 },
  modalSub: { margin: '0 0 0.15rem', color: 'var(--text-ghost)', fontSize: '0.78rem', lineHeight: 1.45 },
  modalLabel: { color: 'var(--text-faint)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  modalSelect: { width: '100%', padding: '0.55rem 0.7rem', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '0.82rem' },
  modalInput: { width: '100%', padding: '0.55rem 0.7rem', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: '0.82rem' },
  modalCheckRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' },
  modalActions: { marginTop: '0.35rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' },
  modalCancel: { padding: '0.5rem 0.8rem', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  modalConfirm: { padding: '0.5rem 0.85rem', borderRadius: 7, border: 0, background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: '0.78rem', fontWeight: 700 },

  // Team two-column
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' },
  artistRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  avatarSm: { width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, fontSize: '0.65rem', fontWeight: 700 },
  artistRowName: { fontSize: '0.82rem', color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  countBadge: {
    fontSize: '0.68rem', fontWeight: 700,
    background: 'var(--bg-chip)', border: '1px solid var(--border)',
    borderRadius: 5, padding: '0.1rem 0.4rem',
    color: 'var(--text-secondary)', flexShrink: 0,
  },
  empty: { fontSize: '0.8rem', color: 'var(--text-faint)' },

  // Week utilization
  utilList: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  utilRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  utilName: { fontSize: '0.82rem', color: 'var(--text)', minWidth: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  utilBarBg: { flex: 1, height: 6, background: 'var(--bg-chip)', borderRadius: 3, overflow: 'hidden' },
  utilBarFill: { height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s ease' },
  utilCount: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 22, textAlign: 'right', flexShrink: 0 },
};
