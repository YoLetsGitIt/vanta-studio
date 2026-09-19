'use client';

import { useEffect } from 'react';
import { BOOKING_STEPS } from './story';
import './process.css';

const MOMENTS = [
  { label: 'Made for your studio', title: 'Your bookings.\nYour form.', text: 'Fully customisable, from colours to questions. Share your form anywhere your clients find you.' },
  { label: 'One connected appointment', title: 'From first enquiry\nto booked in.', text: 'Enquiries, estimates, availability and deposits. All connected.' },
  { label: 'The details, taken care of', title: 'Your consent.\nKept together.', text: 'Fully customisable consent forms. Send a link to sign, then keep the completed form with the client’s record.' },
];
function Botanical() {
  return <svg viewBox="0 0 90 100" fill="none" aria-hidden="true"><path d="M42 91Q48 65 46 15M46 36Q20 34 24 14Q42 16 46 36M46 57Q74 53 72 33Q52 37 46 57M46 77Q20 72 22 54Q42 57 46 77" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function Signature() {
  return <svg viewBox="0 0 240 55" className="sv-signature" aria-hidden="true"><path pathLength="1" d="M14 44Q39 1 36 42L50 20L51 42Q62 29 69 35Q76 46 82 28M92 41Q113 1 127 18Q141 29 107 41Q120 52 145 31M150 38L161 26L157 42Q174 26 177 35Q181 44 195 33L208 30M95 50L221 43" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
export default function BookingStory({ phase, visible, titleRef, goTo, onSummaryChange }) {
  const index = BOOKING_STEPS.findIndex(step => step.id === phase);
  const step = BOOKING_STEPS[Math.max(0,index)];
  const moment = MOMENTS[step.section];
  const personal = index >= 1, paid = index >= 6, signed = phase === 'consent-signed';
  const status = step.section === 0 ? 'Your enquiry form' : signed ? 'Consent signed' : paid ? 'Booking confirmed' : phase === 'enquiry' ? 'New enquiry' : phase === 'selection' ? 'Awaiting deposit' : 'Planning your piece';
  useEffect(() => {
    if (visible) onSummaryChange({ idea: 'A little botanical piece', time: 'Fri 28 Aug · 10:00 am', paid, signed });
  }, [visible, paid, signed, onSummaryChange]);

  return <section className="sv-story" hidden={!visible} data-beat={phase} data-section={step.section} aria-label="An appointment from enquiry to signed consent">
    <header className="sv-caption">
      <p className="sv-eyebrow">{moment.label}</p>
      <h2 ref={visible ? titleRef : undefined} tabIndex={-1}>{moment.title.split('\n').map((line,i)=><span key={line}>{i===1 ? <em>{line}</em> : line}</span>)}</h2>
      <p className="sv-description">{moment.text}</p>
      <div className="sv-moments" aria-label="Story progress">{['Your form','Booked in','Consent'].map((label,i)=><span key={label} aria-current={i===step.section ? 'step' : undefined}>{label}</span>)}</div>
    </header>

    <div className="sv-device-slot">
      <div className="sv-device" data-personal={personal}>
        <div className="sv-device-camera" aria-hidden="true" />
        <div className="sv-screen">
          <header className="sv-studio-name"><span>YOUR STUDIO</span><span className={`sv-status ${paid ? 'sv-status-paid' : ''}`}>{status}</span></header>
          <div className="sv-client"><span className="sv-avatar">{step.section === 0 ? '↗' : 'MC'}</span><div><h3>{step.section === 0 ? 'Your next piece.' : 'Mia Carter'}</h3><p>{step.section === 0 ? 'A little space for a big idea.' : 'A little botanical piece · Alex Morgan'}</p></div></div>
          <div className="sv-card-content">
            {step.section === 0 && <div className="sv-enquiry">
              <div className="sv-idea"><div><small>TATTOO IDEA</small><p>A little botanical piece<br />for my forearm.</p></div><Botanical /></div>
              <div className="sv-form-detail" data-shown={personal}><span>Placement <b>*</b></span><strong>Forearm</strong></div>
              <div className="sv-reference"><span>Reference image</span><span>Botanical-study.jpg <b>↗</b></span></div>
              <div className="sv-form-foot"><span className="sv-palette" aria-label="Customisable colours"><i /><i /><i /></span><span>Your colours. Your questions.</span></div>
              <div className="sv-submit" aria-hidden="true">Enquire about a tattoo <span>↗</span></div>
            </div>}
            {step.section === 1 && <div className="sv-booking">
              <div className="sv-idea"><div><small>{phase === 'enquiry' ? 'AN IDEA ARRIVES' : paid ? 'A PLACE IN THE DAY' : 'THE DETAILS COME TOGETHER'}</small><p>{phase === 'enquiry' ? <>A little botanical piece<br />for my forearm.</> : paid ? <>Friday, 28 August<br /><strong>10:00 am · 2 hours</strong></> : <>Estimated A$350<br /><strong>2 hours with Alex</strong></>}</p></div><Botanical /></div>
              <div className="sv-booking-moment" key={phase}>
                {phase === 'enquiry' && <><span className="sv-who">CLIENT → ARTIST</span><h4>Something new in your inbox.</h4><p>Mia’s idea, placement and reference image arrive together.</p><div className="sv-receipt">✓ Enquiry received</div></>}
                {phase === 'estimate' && <><span className="sv-who">ARTIST → CLIENT</span><h4>An estimate. An invitation.</h4><p>Alex sends the quote and duration, then asks Mia which times work.</p><div className="sv-receipt">✓ Estimate sent</div></>}
                {phase === 'availability' && <><span className="sv-who">CLIENT → ARTIST</span><h4>Times that work for both.</h4><p>Mia suggests times from Alex’s availability.</p><div className="sv-times"><span>Fri · 10 am <b>✓</b></span><span>Sat · 11 am <b>✓</b></span></div></>}
                {phase === 'selection' && <><span className="sv-who">ARTIST → CLIENT</span><h4>Alex makes the final selection.</h4><p>Friday at 10 am, from Mia’s suggestions.</p><div className="sv-receipt">Time selected · Deposit requested</div></>}
                {phase === 'confirmed' && <><span className="sv-who">CLIENT → STUDIO</span><h4>It’s booked.</h4><p>Mia pays the deposit. The appointment is confirmed.</p><div className="sv-receipt sv-paid">✓ A$100 deposit paid</div></>}
              </div>
              <div className="sv-booking-trail" aria-label="Booking progress"><span data-complete={true}>Enquiry</span><i>→</i><span data-complete={index>=3}>Details</span><i>→</i><span data-complete={paid}>Booked</span></div>
            </div>}
            {step.section === 2 && <div className="sv-consent">
              <div className="sv-document"><header><span aria-hidden="true">▤</span><div><small>YOUR STUDIO’S FORM</small><h4>Tattoo consent</h4></div><span className="sv-document-state">{signed ? 'Signed ✓' : 'Ready to sign'}</span></header><p>Your wording, questions and required acknowledgements.</p><div className="sv-document-lines" aria-hidden="true"><i /><i /></div><div className="sv-agreement"><span>{signed ? '✓' : '□'}</span> I’ve read and agreed to the form.</div><div className="sv-signature-space">{signed ? <Signature /> : <span>Client signature</span>}</div></div>
              <div className={`sv-consent-record ${signed ? 'sv-attached' : ''}`}><span aria-hidden="true">{signed ? '✓' : '↗'}</span><div><strong>{signed ? 'Signed and kept together.' : 'One link. Ready to sign.'}</strong><p>{signed ? 'Tattoo Consent · Mia’s client record' : 'Send it to your client’s phone.'}</p></div></div>
              <div className="sv-booking-reference"><span>Fri 28 Aug · 10 am</span><span>✓ Deposit paid</span></div>
            </div>}
          </div>
        </div>
        {step.section===0 && <div className="sv-sharing"><span>◎ Instagram bio</span><i>·</i><span>↗ Your website</span></div>}
      </div>
    </div>
    <footer className="sv-story-nav"><button disabled={index<=0} onClick={()=>goTo(BOOKING_STEPS[index-1].at)} aria-label="Previous moment">←</button><span>Scroll to follow the story <b>↓</b><small>Example appointment</small></span><button onClick={()=>goTo(BOOKING_STEPS[index+1]?.at || .98)} aria-label={index===BOOKING_STEPS.length-1 ? 'Continue into the studio' : 'Next moment'}>→</button></footer>
  </section>;
}
