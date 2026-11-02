'use client';

import { useEffect } from 'react';
import { BOOKING_STEPS } from './story';
import './process.css';

import { MOMENTS, SCREENS } from './story-content';

export default function BookingStory({ phase, visible, titleRef, goTo, onSummaryChange }) {
  const index=BOOKING_STEPS.findIndex(step=>step.id===phase);
  const step=BOOKING_STEPS[Math.max(0,index)], moment=MOMENTS[step.section];
  const screen=SCREENS[phase] || SCREENS.form;
  const paid=index>=6, signed=phase==='consent-signed';
  useEffect(()=>{
    if(visible) onSummaryChange({idea:'A little botanical piece',time:'Fri 9 Oct · 10:00 am',paid,signed});
  },[visible,paid,signed,onSummaryChange]);
  useEffect(()=>{
    if(!visible)return;
    const next=SCREENS[BOOKING_STEPS[index+1]?.id];
    if(next){const img=new Image();img.src=`/studio/screenshots/${next.file}.png`;}
  },[index,visible]);

  return <section className="sv-story" hidden={!visible} data-beat={phase} data-section={step.section} aria-label="Vanta Studio, from enquiry to signed consent">
    <header className="sv-caption">
      <p className="sv-eyebrow">{moment.label}</p>
      <h2 ref={visible?titleRef:undefined} tabIndex={-1}>{moment.title.split('\n').map((line,i)=><span key={line}>{i===1?<em>{line}</em>:line}</span>)}</h2>
      <p className="sv-description">{screen.text || moment.text}</p>
      <div className="sv-moments" aria-label="Story progress">{['Your form','Booked in','Consent'].map((label,i)=><span key={label} aria-current={i===step.section?'step':undefined}>{label}</span>)}</div>
    </header>
    <div className="sv-device-slot">
      <div className="sv-device sv-device-real">
        <div className="sv-device-camera" aria-hidden="true" />
        <div className="sv-real-screen">
          <img key={screen.file} src={`/studio/screenshots/${screen.file}.png`} alt={screen.alt} width="920" height="1360" decoding="async" draggable="false" />
        </div>
      </div>
    </div>
    <footer className="sv-story-nav"><button disabled={index<=0} onClick={()=>goTo(BOOKING_STEPS[index-1].at)} aria-label="Previous moment">←</button><span>{screen.label}<small>Actual Studio screens · Sample data · Scroll ↓</small></span><button onClick={()=>goTo(BOOKING_STEPS[index+1]?.at || .98)} aria-label={index===BOOKING_STEPS.length-1?'Continue into the studio':'Next moment'}>→</button></footer>
  </section>;
}
