'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ARTIST_MOMENTS, APP_STORE_URL } from '@/lib/artistFeatureCatalog';
import { ARTIST_APP_TOUR } from '@/lib/artistAppTour';
import { ARTIST_FEATURES } from './studio-features';
import { FeatureDetail } from './FeatureExplorer';
import FlashArtwork from './FlashArtwork';
import StudioEntryButton from './StudioEntryButton';
import styles from './artist.module.css';
import wall from './flash-wall.module.css';

// Seated at the station: 'seated' → phone moments 0..2 → 'wall'.
export const ARTIST_STEPS = ['seated', 0, 1, 2, 'wall'];
const APP = { href: APP_STORE_URL, label: 'Get the Vanta app', external: true };
const screen = (name, width) => `/studio/artist/${name}-${width}.webp`;
const TOUR = { id: 'artist-app-tour', title: 'Meet Vanta for artists',
  intro: 'From sharing your work to planning your week. Watch the tour, or jump to a chapter.',
  points: [], screens: [{ type: 'video', ...ARTIST_APP_TOUR }] };

function TourActions({ onTour }) {
  return <div className={styles.tourActions}>
    <button onClick={onTour} aria-haspopup="dialog"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m6 3 10 7-10 7Z" fill="currentColor"/></svg>Watch the app tour<span className={styles.tourDuration}>{Math.floor(ARTIST_APP_TOUR.duration/60)}:{String(ARTIST_APP_TOUR.duration%60).padStart(2,'0')}</span></button>
    <AppLink />
  </div>;
}

function AppLink({ className }) {
  return <a className={className} href={APP.href} target="_blank" rel="noopener">{APP.label} <span aria-hidden="true">↗</span></a>;
}

function ArtistWall({ active, onBack, onOwner, onTour, scrollRoot }) {
  const [selected, setSelected] = useState(null);
  return <section className={`${styles.wall} ${wall.gallery}`} aria-labelledby="artist-wall-heading" inert={!active} aria-hidden={!active}>
    <div className={wall.navigation}><span>VANTA / ARTIST</span><button onClick={onBack}><span aria-hidden="true">←</span>Back to your station</button></div>
    <div className={wall.inner}>
      <header className={wall.heading}><h2 tabIndex={-1} id="artist-wall-heading" data-artist-focus="wall">Everything behind your chair.</h2><p>Your portfolio, your clients and your bookings, in one app.<br/>Take a closer look at the tools for artists.</p><TourActions onTour={onTour}/></header>
      <div className={wall.grid}>{ARTIST_FEATURES.map((feature,index)=><button key={feature.id} className={`${wall.print} ${styles.print}`} style={{'--tilt':'0deg','--print-resolve':1,'--print-surface':1,'--print-label':1,'--order':index}} onClick={event=>{const {x,y,width,height}=event.currentTarget.getBoundingClientRect();setSelected({...feature,origin:{x,y,width,height}});}} aria-haspopup="dialog" aria-label={`Explore ${feature.title}`} aria-describedby={`artist-summary-${feature.id}`}>
        <span className={wall.frame}><span className={wall.paper}><FlashArtwork id={feature.art}/></span></span>
        <span className={wall.caption}><span className={wall.category}><span className={wall.number}>{String(index+1).padStart(2,'0')}</span>{feature.section}</span><h3>{feature.title}</h3></span>
        <p id={`artist-summary-${feature.id}`} className={wall.summary}>{feature.teaser}</p>
        <span className={wall.learn} aria-hidden="true">View details</span>
      </button>)}</div>
      <div className={wall.footer}><AppLink /><small>Free on the App Store · Switch to an artist account from your profile</small><button onClick={onOwner}>Explore the studio owner view ↗</button></div>
    </div>
    {selected && createPortal(<FeatureDetail feature={selected} onClose={()=>setSelected(null)} scrollRoot={scrollRoot} brand="Vanta app" action={APP}/>, document.body)}
  </section>;
}

export default function ArtistVisit({ step, settled, motion = true, onStep, onOwner, scrollRoot }) {
  const rootRef = useRef(null);
  const [tourOpen, setTourOpen] = useState(false);
  const moment = typeof step === 'number' ? ARTIST_MOMENTS[step] : null;
  // Keep the last moment on the phone while it lowers, so it never goes blank.
  const [shown, setShown] = useState(0);
  useEffect(() => { if (moment) setShown(step); }, [moment, step]);
  useEffect(() => {
    if (!settled) return;
    const key = moment ? 'phone' : step;
    rootRef.current?.querySelector(`[data-artist-focus="${key}"]`)?.focus({ preventScroll: true });
  }, [step, settled, moment]);
  const index = ARTIST_STEPS.indexOf(step);
  const go = offset => onStep(ARTIST_STEPS[Math.max(0, Math.min(ARTIST_STEPS.length-1, index+offset))]);
  const current = ARTIST_MOMENTS[shown];
  // A slight tilt toward the pointer, so the phone feels held rather than printed.
  const deviceRef = useRef(null);
  const tilt = event => {
    if (!motion || event.pointerType !== 'mouse' || !deviceRef.current) return;
    const r = deviceRef.current.getBoundingClientRect();
    deviceRef.current.style.setProperty('--tilt-x', String(((event.clientY-r.top)/r.height-.5)*-6));
    deviceRef.current.style.setProperty('--tilt-y', String(((event.clientX-r.left)/r.width-.5)*8));
  };
  const untilt = () => { deviceRef.current?.style.setProperty('--tilt-x','0'); deviceRef.current?.style.setProperty('--tilt-y','0'); };

  return <div ref={rootRef} className={styles.visit} data-step={moment ? 'phone' : step} data-settled={settled} data-motion={motion ? 'on' : 'off'} role="region" aria-label="Vanta for artists">
    {/* Seated: the same arrival treatment as the owner's walk into the studio. */}
    <section className={styles.intro} inert={step!=='seated'||!settled} aria-hidden={step!=='seated'}>
      <h2 tabIndex={-1} data-artist-focus="seated"><span className={styles.line}><span>Less admin.</span></span>{' '}<span className={`${styles.line} ${styles.lineDetail}`}><span>More time in the chair.</span></span></h2>
      <p>Requests, deposits and your calendar, handled in one app.</p>
      {/* Remount on each seating so the stamp draws in and the phone buzzes again. */}
      <div className={styles.cta}>{step==='seated'&&settled&&<StudioEntryButton icon="phone" label="See how" motion={motion} onEnter={()=>onStep(0)} />}</div>
      {step==='seated'&&settled&&<TourActions onTour={()=>setTourOpen(true)}/>}
    </section>

    <section className={styles.phoneStory} data-moment={shown} inert={!moment||!settled} aria-hidden={!moment} aria-label="The Vanta app for artists">
      <header className={styles.phoneCopy}>
        <nav className={styles.moments} aria-label="App moments">
          {ARTIST_MOMENTS.map((item,i)=><button key={item.id} aria-current={i===shown?'step':undefined} onClick={()=>onStep(i)}>{item.label}</button>)}
        </nav>
        <h2 key={`${current.id}-title`} tabIndex={-1} data-artist-focus="phone">{current.title.split('\n').map(line=><span key={line}>{line}</span>)}</h2>
        <p key={`${current.id}-text`}>{current.text}</p>
      </header>
      <div className={styles.stage} onPointerMove={tilt} onPointerLeave={untilt}>
        <button className={styles.arrow} onClick={()=>go(-1)} aria-label={shown===0?'Look up from your phone':'Previous moment'}><span aria-hidden="true">←</span></button>
        <div className={styles.device} ref={deviceRef}>
          <div className={styles.glow} aria-hidden="true" />
          <div className={styles.phone} aria-hidden="true">
            <span className={styles.buttons} />
            <div className={styles.phoneScreen}>
              {ARTIST_MOMENTS.map((item,i)=><img key={item.id} src={screen(item.screen,780)} srcSet={`${screen(item.screen,390)} 390w, ${screen(item.screen,780)} 780w`} sizes="(max-width: 700px) 60vw, 320px" alt="" data-state={i===shown?'shown':i<shown?'past':'next'} decoding="async" loading={i?'lazy':'eager'} />)}
              {/* Highlight the part of the real app screen this moment is about. */}
              <span key={`${current.id}-ring`} className={styles.ring} style={{'--top':`${current.ring.top}%`,'--left':`${current.ring.left}%`,'--width':`${current.ring.width}%`,'--height':`${current.ring.height}%`}} />
              <span className={styles.glare} />
            </div>
          </div>
          {current.chips.map((chip,i)=><span key={`${current.id}-${chip.label}`} className={styles.chip} data-side={chip.side} style={{'--y':`${chip.y}%`,'--order':i}}><i aria-hidden="true" />{chip.label}</span>)}
        </div>
        <button className={styles.arrow} onClick={()=>go(1)} aria-label={shown===ARTIST_MOMENTS.length-1?'See every artist tool':'Next moment'}><span aria-hidden="true">→</span></button>
      </div>
      {/* The phone art is decorative; describe the current screen once for assistive tech. */}
      <p className={styles.srOnly}>{current.alt}</p>
    </section>

    <ArtistWall active={step==='wall'&&settled} onBack={()=>onStep('seated')} onOwner={onOwner} onTour={()=>setTourOpen(true)} scrollRoot={scrollRoot} />
    {tourOpen && createPortal(<FeatureDetail feature={TOUR} onClose={()=>setTourOpen(false)} scrollRoot={scrollRoot} brand="Vanta app" action={APP} backLabel="Close app tour"/>, document.body)}
  </div>;
}
