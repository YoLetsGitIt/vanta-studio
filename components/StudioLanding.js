'use client';

import { AnimatePresence, motion, useReducedMotion, useScroll, useMotionValueEvent } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import './studio-landing.css';

const demoUrl = 'mailto:support@vanta.tattoo?subject=Vanta%20Studio%20demo&body=Hi%20Matthew%2C%20I%27d%20like%20a%2015-minute%20demo.%0A%0AStudio%3A%0ALocation%3A%0ANumber%20of%20artists%3A%0APreferred%20times%3A';

const features = [
  { eyebrow: '01 — Booking', title: 'A booking flow that makes sense for tattoos.', description: 'Ask for the details tattooing actually needs — placement, size, reference photos and artist preference — before a request ever reaches your team.', points: ['Custom tattoo-specific booking questions', 'Deposits collected before the session', 'Branded link or embedded booking form'], visual: 'booking' },
  { eyebrow: '02 — Studio control', title: 'Keep artists, stations and appointments in sync.', description: 'See the team’s schedule together, coordinate stations and keep consent and client information close to each appointment.', points: ['Artist and station scheduling', 'Client records and booking history', 'Digital consent forms and client notes'], visual: 'operations' },
  { eyebrow: '03 — Artist finances', title: 'Know what each artist is owed.', description: 'Keep recorded payments, commission rules and reimbursements together. Review outstanding amounts and record artist payouts after you pay them.', points: ['Collect online deposits through Stripe', 'Track cash and card payments recorded against bookings', 'Calculate commissions and record payouts — bank transfers are handled separately'], visual: 'finances' },
];

const rise = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const connectedStages = [
  {
    step: '01',
    label: 'ARTISTS · VANTA APP',
    title: 'Keep your work connected.',
    description: 'Present your portfolio and manage booking activity from the Vanta app, wherever the day takes you.',
    icon: <><rect x="4.5" y="4.5" width="11" height="11" rx="2" /><path d="M9 15.5v1.5a2.5 2.5 0 0 0 2.5 2.5H19a2.5 2.5 0 0 0 2.5-2.5V9a2.5 2.5 0 0 0-2.5-2.5h-1.5" /></>,
  },
  {
    step: '02',
    label: 'STUDIOS · VANTA STUDIO',
    title: 'Bring the team together.',
    description: 'Coordinate appointments, stations, client records and artist finances in Vanta Studio.',
    icon: <><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17" /><path d="M8 3v4.5M16 3v4.5" /></>,
  },
];

function useScrollStep(containerRef, stepCount) {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const manual = useRef(false);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start 0.85', 'end 0.3'] });
  useMotionValueEvent(scrollYProgress, 'change', value => {
    if (manual.current || reducedMotion) return;
    setStep(Math.min(stepCount - 1, Math.max(0, Math.floor(value * stepCount))));
  });
  const setManualStep = index => { manual.current = true; setStep(index); };
  return [step, setManualStep];
}

const bookingTabs = ['Form fields', 'Availability', 'Deposits'];
const bookingFields = [
  { field: 'Artist preference', optional: false },
  { field: 'Placement & size', optional: false },
  { field: 'Reference photos', optional: true },
];
const availabilitySlots = [
  { time: '9:00', status: 'booked' }, { time: '10:00', status: 'open' }, { time: '11:30', status: 'open' },
  { time: '1:00', status: 'booked' }, { time: '2:30', status: 'open' }, { time: '4:00', status: 'open' },
];

function BookingVisual({ containerRef }) {
  const [tab, setTab] = useScrollStep(containerRef, bookingTabs.length);
  const [fieldsOn, setFieldsOn] = useState([true, true, true]);
  const [slot, setSlot] = useState('11:30');
  const [depositOn, setDepositOn] = useState(true);
  const [depositAmount, setDepositAmount] = useState(100);
  return (
    <motion.div className="studios-feature-ui studios-feature-ui--booking" initial={{ opacity: 0, y: 28, rotate: -2 }} whileInView={{ opacity: 1, y: 0, rotate: -1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}>
      <div className="feature-ui-title"><span>Booking form</span><b>Preview</b></div>
      <p className="feature-live-hint"><span className="feature-live-dot" /> Interactive — tap to try it</p>
      <div className="feature-booking-tabs" role="tablist" aria-label="Booking form preview">
        {bookingTabs.map((label, index) => (
          <button key={label} type="button" role="tab" aria-selected={tab === index} className={tab === index ? 'is-active' : ''} onClick={() => setTab(index)}>{label}</button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {tab === 0 && (
          <motion.div key="fields" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <p>Client request details</p>
            {bookingFields.map((row, index) => (
              <button key={row.field} type="button" className="feature-form-row" onClick={() => setFieldsOn(prev => prev.map((v, i) => i === index ? !v : v))}>
                <span>{row.field}</span>
                <em>{row.optional ? 'Optional' : 'Required'}</em>
                <i className={`feature-toggle${fieldsOn[index] ? ' is-on' : ''}`} aria-hidden="true" />
              </button>
            ))}
            <div className="feature-booking-bottom"><div className="feature-deposit"><span>Deposit required</span><b>${depositAmount}</b></div><div className="feature-station"><span>Station availability</span><b>Checked automatically</b></div></div>
          </motion.div>
        )}
        {tab === 1 && (
          <motion.div key="availability" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <p>Client picks a time</p>
            <div className="feature-slot-grid">
              {availabilitySlots.map(item => (
                <button key={item.time} type="button" disabled={item.status === 'booked'} className={`feature-slot${slot === item.time ? ' is-selected' : ''}${item.status === 'booked' ? ' is-booked' : ''}`} onClick={() => setSlot(item.time)}>{item.time}</button>
              ))}
            </div>
            <div className="feature-booking-bottom"><div className="feature-station"><span>Selected</span><b>{slot} · Station checked</b></div></div>
          </motion.div>
        )}
        {tab === 2 && (
          <motion.div key="deposits" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <p>Set what clients pay to confirm</p>
            <button type="button" className="feature-form-row" onClick={() => setDepositOn(v => !v)}>
              <span>Require deposit</span>
              <em>{depositOn ? 'On' : 'Off'}</em>
              <i className={`feature-toggle${depositOn ? ' is-on' : ''}`} aria-hidden="true" />
            </button>
            <div className="feature-stepper">
              <span>Deposit amount</span>
              <div>
                <button type="button" onClick={() => setDepositAmount(v => Math.max(20, v - 20))} aria-label="Decrease deposit">−</button>
                <b>${depositAmount}</b>
                <button type="button" onClick={() => setDepositAmount(v => Math.min(300, v + 20))} aria-label="Increase deposit">+</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div className="studios-feature-tag studios-feature-tag--booking" initial={{ opacity: 0, x: 12, rotate: 4 }} whileInView={{ opacity: 1, x: 0, rotate: 3 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.5 }}>↳ Written for tattoo bookings, not generic forms</motion.div>
    </motion.div>
  );
}

const scheduleRows = [
  { artist: 'Alex Morgan', station: 'Station A', booking: '10:00 — Full sleeve', size: 'is-long', detail: '2 hrs · Deposit $150 paid · Reference photos on file' },
  { artist: 'Mia Chen', station: 'Station B', booking: '13:00 — Fine line', size: 'is-mid', detail: '1 hr · Deposit $80 paid · First session' },
  { artist: 'Sam Taylor', station: 'Station C', booking: '16:00 — Flash session', size: 'is-short', detail: '30 min · No deposit required · Walk-in flash' },
];

function OperationsVisual({ containerRef }) {
  const [active, setActive] = useScrollStep(containerRef, scheduleRows.length);
  return (
    <>
    <motion.div className="studios-feature-stack studios-feature-stack--artists" initial={{ opacity: 0, x: -16, rotate: -10 }} whileInView={{ opacity: 1, x: 0, rotate: -8 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <span>3 artists</span><span>1 studio</span><b>Synced live</b>
    </motion.div>
    <motion.div className="studios-feature-ui studios-feature-ui--operations" initial={{ opacity: 0, y: 28, rotate: -2 }} whileInView={{ opacity: 1, y: 0, rotate: -1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}>
      <div className="feature-ui-title"><span>Studio schedule</span><b>Today · 3 stations</b></div>
      <p className="feature-live-hint"><span className="feature-live-dot" /> Interactive — tap a booking</p>
      <div className="feature-schedule-times"><span>10am</span><span>1pm</span><span>4pm</span></div>
      {scheduleRows.map((row, index) => (
        <button key={row.artist} type="button" className={`feature-schedule-row${active === index ? ' is-active' : ''}`} aria-expanded={active === index} onClick={() => setActive(index)}>
          <div><strong>{row.artist}</strong><small>{row.station}</small></div>
          <span className={row.size}>{row.booking}</span>
          <AnimatePresence>
            {active === index && (
              <motion.small className="feature-schedule-detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>{row.detail}</motion.small>
            )}
          </AnimatePresence>
        </button>
      ))}
      <div className="feature-payout-summary"><div><span>Deposits held</span><b>$420</b></div><div><span>Artist payouts</span><b>$1,280</b></div><em>✓ No station conflicts</em></div>
    </motion.div>
    </>
  );
}

const financeRows = [
  { label: 'Artist earnings', amount: '$1,200', detail: '6 sessions this month · commission already applied' },
  { label: 'Approved reimbursements', amount: '$80', detail: 'Travel $30 · Supplies $50' },
  { label: 'Previously paid', amount: '$400', detail: 'Paid by bank transfer on Aug 14' },
  { label: 'Outstanding', amount: '$880', detail: 'Ready to pay — record the payout once transferred' },
];

function FinancesVisual({ containerRef }) {
  const [active, setActive] = useScrollStep(containerRef, financeRows.length);
  return (
    <>
      <motion.div className="studios-feature-receipt studios-feature-receipt--back" initial={{ opacity: 0, rotate: -9, y: 10 }} whileInView={{ opacity: 1, rotate: -7, y: 6 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} />
      <motion.div className="studios-feature-receipt studios-feature-receipt--mid" initial={{ opacity: 0, rotate: 6, y: 6 }} whileInView={{ opacity: 1, rotate: 4, y: 3 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }} />
      <motion.div className="studios-feature-ui studios-feature-ui--finances" initial={{ opacity: 0, y: 28, rotate: -2 }} whileInView={{ opacity: 1, y: 0, rotate: -1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}>
        <div className="feature-finance-preview">
          <div className="feature-ui-title"><span>Artist payout summary</span><b>Example</b></div>
          <p className="feature-live-hint"><span className="feature-live-dot" /> Interactive — tap a line</p>
          <h4>Alex Morgan</h4>
          <dl>
            {financeRows.map((row, index) => (
              <div key={row.label}>
                <button type="button" className={`feature-finance-row${active === index ? ' is-active' : ''}`} onClick={() => setActive(index)}>
                  <dt>{row.label}</dt><dd>{row.amount}</dd>
                </button>
                <AnimatePresence>
                  {active === index && (
                    <motion.small className="feature-finance-detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>{row.detail}</motion.small>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </dl>
          <p>Review the balance. Pay your artist. Record the payout.</p>
        </div>
      </motion.div>
    </>
  );
}

const studioDayScenes = [
  { title: 'A new enquiry arrives', detail: 'Mia requests a botanical piece with Alex.', label: 'Booking request', value: 'Mia Carter', meta: 'Fine line · Botanical piece' },
  { title: 'An appointment takes its place', detail: 'Mia’s booking is scheduled for 10 am with Alex.', label: 'Appointment confirmed', value: '10:00–12:00', meta: 'Alex Morgan · Station 1' },
  { title: 'The deposit is confirmed', detail: 'The payment stays linked to Mia’s booking.', label: 'Deposit received', value: 'A$100 paid', meta: 'Mia Carter · Online payment' },
  { title: 'Station availability is checked', detail: 'Available stations are checked for Riley’s appointment time.', label: 'Station availability', value: '10:00–12:00', meta: 'Checking available stations' },
  { title: 'An available station is selected', detail: 'The first available station is selected. You can change it before creating the appointment.', label: 'Station selected', value: 'Station 3', meta: 'First available · Can be changed' },
  { title: 'Consent stays with the client', detail: 'Mia’s completed form is available with her appointment.', label: 'Consent form', value: 'Completed', meta: 'Mia Carter · Ready for the session' },
  { title: 'Your team’s day comes together', detail: 'Bookings, deposits and stations in one view.', label: 'Ready for the day', value: '3 appointments', meta: 'Deposits recorded · Stations organised' },
];
const studioDaySteps = studioDayScenes.map(scene => scene.title);
const dayArtists = [
  { name: 'Alex Morgan', initials: 'AM', style: 'Fine line', client: 'Mia Carter', work: 'Botanical piece', time: '10:00–12:00', left: '5%', width: '34%' },
  { name: 'Sam Taylor', initials: 'ST', style: 'Traditional', client: 'Jordan Lee', work: 'Flash session', time: '12:00–14:00', left: '38%', width: '32%' },
  { name: 'Riley Chen', initials: 'RC', style: 'Blackwork', client: 'Ari Bell', work: 'Sleeve consultation', time: '10:00–12:00', left: '5%', width: '34%' },
];

function StudioDashboard() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const current = reducedMotion ? studioDayScenes.length - 1 : step;
  const scene = studioDayScenes[current];
  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(() => setStep(value => (value + 1) % studioDayScenes.length), step === 3 || step === 4 ? 4500 : 3000);
    return () => window.clearTimeout(timer);
  }, [paused, reducedMotion, step]);

  return (
    <div className={`studio-day-preview${paused ? " is-paused" : ""}`}>
      <div className="studio-day-heading"><span>A DAY AT YOUR STUDIO</span></div>
      <div className="studio-day-board">
        <div className="studio-day-top"><div><span className="studio-preview-brand"><img className="studio-brand-symbol" src="/brand/vanta-eclipse.svg" alt="" width="32" height="32" /><img className="studio-day-logo" src="/brand/vanta-studio.svg" alt="Vanta Studio" width="170" height="80" /></span><span>Studio schedule</span></div><span>Friday, 28 August <b>Day view</b></span></div>
        <div className="studio-day-times"><span>Artists / Stations</span><div>{['10 am', '12 pm', '2 pm', '4 pm'].map(time => <span key={time}>{time}</span>)}</div></div>
        {dayArtists.map((artist, index) => (
          <div className={`studio-day-row${index === 2 ? ' studio-day-row--extra' : ''}`} key={artist.name}>
            <div className="studio-day-artist"><i>{artist.initials}</i><div><strong>{artist.name}</strong><small>{artist.style} · Station {index + 1}</small></div></div>
            <div className="studio-day-track">
              <AnimatePresence>
                {(index === 0 ? current >= 1 : index === 1 || current >= 4) && <motion.div className={`studio-day-booking studio-day-booking--${index}${current === 2 && index === 0 ? ' is-deposit' : ''}`} style={{ left: artist.left, width: artist.width }} initial={reducedMotion ? false : { opacity: 0, y: -16, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .45 }}>
                  <span>{artist.time}</span><strong>{artist.client}</strong><small>{artist.work}</small><em key={`${current}-${index}`} className={current === 2 && index === 0 ? "deposit-confirmation" : ""}>{index === 0 ? current < 2 ? 'Awaiting A$100 deposit' : current >= 5 ? '✓ Deposit paid · Consent complete' : '✓ A$100 deposit paid' : '✓ Deposit paid'}</em>
                </motion.div>}
              </AnimatePresence>
              {index === 0 && current === 0 && <motion.div className="day-request" initial={{ opacity: 0, x: 35 }} animate={{ opacity: 1, x: 0 }}><span>↙ NEW ENQUIRY</span><strong>Mia Carter</strong><small>Botanical piece · Alex Morgan</small><b>Schedule for 10 am →</b></motion.div>}
              <AnimatePresence mode="wait">
                {index === 0 && current === 2 && <motion.div key="payment" className="day-action day-payment" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><span className="day-check">✓</span><div><small>DEPOSIT RECEIVED</small><strong>A$100</strong><span>Linked to Mia’s booking</span></div></motion.div>}
                {index === 2 && current === 3 && <motion.div key="availability" className="day-action day-stations" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><small>NEW APPOINTMENT · RILEY</small><strong>Checking stations…</strong><span>10:00–12:00 · 2 hours</span></motion.div>}
                {index === 2 && current === 4 && <motion.div key="stations" className="day-action day-stations" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><small>AVAILABLE STATIONS</small><div><span className="day-station-option">Station 3 <i>Selected ✓</i></span></div><span>First available selected · You can change it</span></motion.div>}
                {index === 0 && current === 5 && <motion.div key="consent" className="day-action day-consent" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><small>CLIENT CONSENT · MIA CARTER</small><span>✓ Details confirmed</span><span>✓ Consent signed</span><svg viewBox="0 0 130 25" aria-hidden="true"><motion.path d="M4 20 Q15 -8 18 18 L27 5 L30 19 Q42 5 44 17 Q50 24 58 12 Q65 4 65 17 Q78 27 94 8 M55 22 L122 20" fill="none" stroke="currentColor" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} /></svg></motion.div>}
              </AnimatePresence>
            </div>
          </div>
        ))}
        <div className="studio-day-story">
          <div className="studio-day-event"><span className="studio-day-live-dot" /><div><strong>{scene.title}</strong><span>{scene.detail}</span></div></div>
          
        </div>
      </div>
      <div className="studio-day-controls"><div aria-label="Preview scenes">{studioDaySteps.map((label, index) => <button key={label} type="button" aria-label={label} aria-pressed={current === index} className={current === index ? 'is-active' : ''} disabled={!!reducedMotion} onClick={() => { setStep(index); setPaused(true); }} />)}</div>{!reducedMotion && <button className="studios-preview-toggle" type="button" onClick={() => setPaused(value => !value)}>{paused ? 'Play preview' : 'Pause preview'}</button>}</div>
    </div>
  );
}

function FeatureVisual({ type, containerRef }) {
  if (type === 'booking') return <BookingVisual containerRef={containerRef} />;
  if (type === 'operations') return <OperationsVisual containerRef={containerRef} />;
  return <FinancesVisual containerRef={containerRef} />;
}

export default function StudiosPage({ featuresOnly = false }) {
  const reducedMotion = useReducedMotion();
  const bookingRef = useRef(null);
  const operationsRef = useRef(null);
  const financesRef = useRef(null);
  const storyRefs = { booking: bookingRef, operations: operationsRef, finances: financesRef };
  return (
    <div className="studios-page">
      <div className="studios-page-nav"><header className="studio-marketing-nav"><a href="/" className="studio-marketing-brand"><img className="studio-brand-symbol" src="/brand/vanta-eclipse.svg" alt="" width="48" height="48" /><img className="studio-brand-wordmark" src="/brand/vanta-studio.svg" alt="Vanta Studio" width="170" height="80" /></a><nav aria-label="Studio navigation"><a href="/signin">Sign in</a><a href="/?signup">Try Vanta Studio <span aria-hidden="true">↗</span></a></nav><details className="studio-mobile-menu"><summary aria-label="Open navigation"><span /><span /></summary><nav aria-label="Mobile studio navigation"><a href="/signin">Sign in</a><a href="/?signup">Try Vanta Studio <span aria-hidden="true">↗</span></a></nav></details></header></div>
      <main className="studios-main">
        {featuresOnly && <header className="feature-page-heading"><a href="/">← Back to the studio</a><h1>The details behind the day.</h1><p>Explore the tools that keep your studio together.</p></header>}
        {!featuresOnly && <section className="studios-hero">

          <motion.div
            className="studios-hero-copy"
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.11, delayChildren: 0.08 }}
          >
            <motion.h1 variants={rise} transition={{ duration: 0.7, ease: [0.2, 0.65, 0.3, 1] }}>
              From the first hello <span>to the final detail.</span>
            </motion.h1>
            <motion.p variants={rise} transition={{ duration: 0.7, ease: [0.2, 0.65, 0.3, 1] }} className="studios-hero-desc">
              Bookings, artists and the details in between. All in one place.
            </motion.p>

          </motion.div>

          <StudioDashboard />
        </section>}

        <section className="studios-features">
          <div className="studios-features-intro">
            <p className="studios-eyebrow">Built around the appointment</p>
            <h2>From the first enquiry to the end-of-day admin.</h2>
          </div>
          <div className="studios-feature-sequence">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                id={feature.visual}
                ref={storyRefs[feature.visual]}
                className={`studios-feature-story studios-feature-story--${feature.visual}`}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-70px' }}
                transition={{ duration: 0.65, delay: index * 0.09, ease: [0.2, 0.65, 0.3, 1] }}
              >
                <div className="studios-feature-copy" data-index={String(index + 1).padStart(2, '0')}>
                  <span>{feature.eyebrow}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <ul>{feature.points.map(point => <li key={point}>{point}</li>)}</ul>
                </div>
                <div className="studios-feature-visual">
                  <FeatureVisual type={feature.visual} containerRef={storyRefs[feature.visual]} />
                  <motion.div className="studios-feature-chip" initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.56 }}>
                    {feature.visual === 'booking' ? 'Deposit paid' : feature.visual === 'finances' ? 'Payout recorded' : 'Schedule organised'}
                  </motion.div>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="studios-connected connection-section" aria-labelledby="connected-title">
<header className="connection-header"><div><p className="connection-eyebrow">VANTA + VANTA STUDIO</p><h2 id="connected-title">Their app. Your studio.<br />Connected.</h2></div><p>Artists manage their work in Vanta.<br />You coordinate the team in Vanta Studio.</p></header><div className="connection-stage"><div><div className="connection-phone"><div className="connection-screen"><div className="connection-notch"></div><span className="connection-tiny">FRIDAY, 28 AUGUST</span><h3>Your appointments</h3><div className="connection-appt"><small>10:00 — 12:00</small><strong>Mia Carter</strong><p>Botanical piece</p><span className="connection-badge">Confirmed</span></div><div className="connection-phone-foot"><span>Alex Morgan</span><span>Studio booking</span></div></div></div><p className="connection-view-label"><strong>Artist view</strong> · Vanta app</p></div><div className="connection-link"></div><div className="connection-desktop-wrap"><div className="connection-desktop"><div className="connection-toolbar"><span className="connection-brand">vanta.</span><span>Studio schedule</span><span>28 Aug</span></div><div className="connection-content"><h3>The whole team, together.</h3><div className="connection-row"><span>Alex Morgan</span><div className="connection-booking connection-selected"><b>Mia Carter · Botanical piece</b><small>10:00–12:00 · Confirmed</small></div></div><div className="connection-row"><span>Sam Taylor</span><div className="connection-booking">12:00 · Flash session</div></div><div className="connection-row"><span>Riley Chen</span><div className="connection-booking">14:00 · Consultation</div></div></div></div><p className="connection-view-label"><strong>Studio view</strong> · Vanta Studio</p></div></div><p className="connection-caption">One shared appointment. The right view for each person.</p>
        </section>
        <section id="pricing" className="studios-pricing" aria-labelledby="pricing-title">
          <div><p className="studios-eyebrow">Straightforward pricing</p><h2 id="pricing-title">One studio plan.</h2><p>Start with a 14-day free trial. A card is required; billing begins when the trial ends unless you cancel.</p></div>
          <div className="studios-price-card"><h3>Vanta Studio</h3><p className="studios-price"><strong>A$60</strong> / month</p><p>Includes up to 6 artists.<br />A$15/month per additional artist.</p><a className="studios-hero-cta" href="https://studio.vanta.tattoo/?signup">Start free trial →</a><p className="studios-price-fine">Online deposits add a client-paid fee of 3% + A$0.50 per transaction. For example, an A$100 deposit costs the client A$103.50. This is separate from the studio subscription.</p></div>
        </section>
        <section className="studios-faq" aria-labelledby="faq-title">
          <p className="studios-eyebrow">Getting started</p><h2 id="faq-title">A few things before you switch.</h2>
          {[
            ['Can we keep our existing website?', 'Yes. Share your studio booking link or embed the booking form on your existing website.'],
            ['Do clients need the Vanta app to book?', 'No. Clients can use your web booking form. The Vanta app also lets people discover artists and send booking requests.'],
            ['How do our artists join?', 'Artists create a profile in the Vanta app and select your studio. You approve their request from the studio dashboard.'],
            ['Can we bring existing records across?', 'Vanta Studio supports CSV imports. We can review your export during the demo to check which fields can be brought across before you switch.'],
            ['Does Vanta automatically transfer artist payouts?', 'No. Vanta Studio calculates and tracks what is owed and lets you record payouts. You pay your artists separately using your existing payment method. Online client deposits are collected through Stripe.'],
            ['Can I get help setting up?', 'Email support@vanta.tattoo to discuss your artists, booking form and commission setup. For studios around Sydney, you can also request an in-person demo.'],
            ['How do I cancel?', 'Manage your subscription in the studio account settings. Cancel before the trial ends to avoid the subscription charge. For a paid subscription, cancellation takes effect at the end of the current billing period.'],
          ].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
        </section>

        <motion.section
          className="studios-finale"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.2, 0.65, 0.3, 1] }}
        >
          <p className="studios-eyebrow">Built for working studios</p>
          <h2>Let’s walk through your studio.</h2>
          <p>Bring your booking process and your questions. We’ll show you how Vanta Studio could fit your team.</p>
          <a className="studios-hero-cta" href="/?signup">Start free trial <span aria-hidden="true">→</span></a>
        </motion.section>
        <footer className="studio-marketing-footer">
          <a href="/" className="studio-marketing-brand"><img className="studio-brand-symbol" src="/brand/vanta-eclipse.svg" alt="" width="48" height="48" /><img className="studio-brand-wordmark" src="/brand/vanta-studio.svg" alt="Vanta Studio" width="170" height="80" /></a>
          <nav aria-label="Footer"><a href="mailto:support@vanta.tattoo">Contact</a><a href="https://www.vanta.tattoo/privacy">Privacy</a><a href="https://www.vanta.tattoo/terms">Terms</a></nav>
        </footer>
      </main>
    </div>
  );
}
