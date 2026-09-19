'use client';
import { useEffect, useRef, useState } from 'react';
import './studio-visit.css';

export default function StudioVisit() {
 const rootRef = useRef(null);
 const journeyRef = useRef(null);
 const stageRef = useRef(null);
 const [booked, setBooked] = useState(false);
 useEffect(() => {
  const root = rootRef.current, journey = journeyRef.current, stage = stageRef.current;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  const paint = () => {
   const span = journey.offsetHeight - root.clientHeight;
   const progress = reduced.matches ? 0 : Math.max(0, Math.min(1, root.scrollTop / Math.max(span, 1)));
   stage.style.setProperty('--p', progress);
   frame = 0;
  };
  const schedule = () => { if (!frame) frame = window.requestAnimationFrame(paint); };
  root.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  reduced.addEventListener('change', schedule);
  paint();
  return () => {
   root.removeEventListener('scroll', schedule);
   window.removeEventListener('resize', schedule);
   reduced.removeEventListener('change', schedule);
   window.cancelAnimationFrame(frame);
  };
 }, []);
 return <div className="studio-visit" ref={rootRef}><nav aria-label="Main navigation"><a className="brand" href="/">vanta.<small>STUDIO</small></a><div className="visit-nav-links"><a href="/features">Explore features</a><a href="/signin">Sign in</a><a className="skip" href="/?signup">Start free trial ↗</a></div><details className="visit-menu"><summary>Menu <span aria-hidden="true">＋</span></summary><div><a href="/features">Explore features</a><a href="/signin">Sign in</a><a href="/?signup">Start free trial ↗</a></div></details></nav><main><a className="visit-skip" href="#reception">Skip entrance ↓</a><div className="journey" ref={journeyRef}><div className="stage" ref={stageRef}><div className="room" aria-hidden="true"><img className="reception-photo" src="/studio/reception.jpg" alt="" fetchPriority="high" /></div><div className="welcome"><p>01 / Reception</p><h2>Every piece starts<br />with a conversation.</h2></div><div className="door"><div className="door-copy"><img className="eclipse" src="/brand/vanta-eclipse.svg" alt="" /><div className="word">vanta.<small>STUDIO</small></div><h1>From the first hello<br />to the final detail.</h1></div><div className="handle"></div><div className="enter"><a href="#reception">Step inside<span>↓</span></a></div></div><div className="doorframe"></div></div></div><section className="reception" id="reception" aria-labelledby="reception-heading"><p className="eyebrow">01 / AT RECEPTION</p><h2 id="reception-heading">A warm welcome.<br />Less back-and-forth.</h2><p className="intro">A new idea arrives. Give it a time, an artist and a place in the studio day.</p><div className="workspace"><article className="paper"><small>NEW ENQUIRY / EXAMPLE</small><h3>A little botanical piece.</h3><p>“Something delicate for my forearm.<br />I love Alex’s fine-line work.”</p><dl><div><dt>Client</dt><dd>Mia Carter</dd></div><div><dt>Artist</dt><dd>Alex Morgan</dd></div><div><dt>Preferred time</dt><dd>Friday · 10 am</dd></div></dl></article><article className="monitor"><header><span>STUDIO SCHEDULE</span><span>FRIDAY</span></header><div className={`slot${booked ? ' booked' : ''}`}><span>10:00 — 12:00</span><strong>{booked ? 'Mia Carter' : 'A place for the next piece.'}</strong><span>{booked ? 'Botanical piece · Alex Morgan' : 'Alex Morgan · Available'}</span></div><span className="status" id="status" role="status">{booked ? '✓ Example appointment confirmed' : 'Try scheduling this example enquiry.'}</span></article></div><button className="action" type="button" onClick={() => setBooked(value => !value)}>{booked ? 'Replay example' : 'Confirm example booking ↗'}</button><a className="chapter-link" href="/features#booking">Explore booking tools →</a><p className="note">Illustrative booking · Try it without creating a real appointment.</p></section>
<section className="visit-chapter" aria-labelledby="station-heading">
 <div className="chapter-copy"><p className="eyebrow">02 / AT THE WORKSTATION</p><h2 id="station-heading">Everything in place.<br />Before they arrive.</h2><p className="intro">Keep the artist, appointment and station together. Available stations are checked when you create a booking.</p><a className="chapter-link" href="/features#operations">See how the studio stays organised →</a></div>
 <div className="station-scene"><div className="task-lamp" aria-hidden="true" /><div className="station-top"><span>STATION 03</span><span>Ready for the day</span></div><div className="station-chair" aria-hidden="true"><i /><b /><span /></div><article className="station-ticket"><small>FRIDAY / 10:00</small><h3>Mia Carter</h3><p>Botanical piece · Alex Morgan</p><span>Station selected</span></article></div>
</section>
<section className="visit-chapter visit-focus" aria-labelledby="focus-heading">
 <div className="focus-art" aria-hidden="true"><svg viewBox="0 0 260 320" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M123 293C88 222 175 177 124 33M129 91C75 83 58 29 68 24C114 38 119 59 129 91M128 130C185 108 199 63 184 52C143 75 136 99 128 130M118 187C56 153 48 114 65 106C106 119 113 145 118 187M118 230C176 207 200 164 184 153C144 165 127 197 118 230M116 261C65 230 59 194 72 186C108 203 113 230 116 261"/><circle cx="124" cy="31" r="8"/><path d="M34 292h192M45 300h170" opacity=".3"/></svg><span>THE DETAILS THAT STAY.</span></div>
 <div className="chapter-copy"><p className="eyebrow">03 / IN THE CHAIR</p><h2 id="focus-heading">Stay with<br />the work.</h2><p className="intro">The deposit, the consent form, the client’s details. Keep them with the appointment, so you can focus on the person in front of you.</p><div className="readiness"><span>✓ Deposit recorded</span><span>✓ Consent complete</span></div><a className="chapter-link" href="/features#booking">Explore the appointment details →</a></div>
</section>
<section className="visit-chapter" aria-labelledby="closing-heading">
 <div className="chapter-copy"><p className="eyebrow">04 / CLOSING THE DAY</p><h2 id="closing-heading">Finish the piece.<br />See the whole picture.</h2><p className="intro">Review payments and what each artist is owed. Pay your artists your way, then record the payout in Vanta Studio.</p><a className="chapter-link" href="/features#finances">Explore studio finances →</a></div>
 <article className="closing-paper"><p className="eyebrow">END OF DAY / EXAMPLE</p><h3>All the details.<br />Accounted for.</h3><dl><div><dt>Artist earnings</dt><dd>A$1,200</dd></div><div><dt>Reimbursements</dt><dd>A$80</dd></div><div><dt>Previously paid</dt><dd>− A$400</dd></div><div><dt>Outstanding</dt><dd>A$880</dd></div></dl><p>Review the balance. Pay your artist.<br />Record the payout.</p></article>
</section>
<section className="visit-finale"><p className="eyebrow">MAKE YOURSELF AT HOME</p><h2>Your craft.<br />A little more room for it.</h2><p>Try Vanta Studio with your team.</p><a className="action" href="/?signup">Start free trial ↗</a><a className="chapter-link" href="mailto:support@vanta.tattoo?subject=Vanta%20Studio%20demo">Book a demo →</a><small>14 days · Card required · <a href="/features#pricing">View pricing and terms</a></small></section>
</main><footer className="visit-footer"><a className="brand" href="/">vanta.<small>STUDIO</small></a><div><a href="/features">Features & pricing</a><a href="mailto:support@vanta.tattoo">Contact</a><a href="https://www.vanta.tattoo/privacy">Privacy</a><a href="https://www.vanta.tattoo/terms">Terms</a></div></footer></div>;
}
