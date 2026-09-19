'use client';

import { useEffect, useRef, useState } from 'react';
import './journey.css';

import BookingStory from './BookingStory';
import { CHAPTERS, BOOKING_STEPS, phaseFor, sceneProgress } from './story';

export default function StudioJourney() {
  const rootRef = useRef(null), trackRef = useRef(null), hostRef = useRef(null), progressRef = useRef(null);
  const titleRef = useRef(null), sceneRef = useRef(null), scheduleRef = useRef(null);
  const motionRef = useRef(true), focusPending = useRef(false);
  const [phase, setPhase] = useState('door');
  const [chapter, setChapter] = useState(0);
  const [sceneStatus, setSceneStatus] = useState('loading');
  const [motion, setMotion] = useState(true);
  const [booking, setBooking] = useState({ idea: 'A little botanical piece', time: 'Fri 28 Aug · 10:00 am', paid: false, signed: false });
  const bookingPhase = BOOKING_STEPS.some(step => step.id === phase);

  useEffect(() => {
    const root = rootRef.current, track = trackRef.current, host = hostRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cancelled = false, frame = 0, current = 0, previousTime = 0, scene = null, createdScene = null, contextCanvas = null;
    const readProgress = () => Math.max(0, Math.min(1, root.scrollTop / Math.max(1, track.offsetHeight - host.clientHeight)));
    const tick = now => {
      frame = 0;
      const target = readProgress(), nextPhase = phaseFor(target);
      const delta = Math.min((now - (previousTime || now)) / 1000, 0.06);
      previousTime = now;
      current = motionRef.current ? current + (target - current) * (1 - Math.exp(-delta * 15)) : target;
      if (motionRef.current && Math.abs(target - current) < 0.00015) current = target;
      progressRef.current?.style.setProperty('--journey-progress', String(target));
      root.style.setProperty('--journey-progress', String(target));
      root.dataset.phase = nextPhase;
      setPhase(nextPhase);
      setChapter(Math.max(0, CHAPTERS.findIndex(item => target < item.end)));
      scene?.setTabletState(target >= .79 ? 'signed' : target >= .65 ? 'confirmed' : target >= .39 ? 'enquiry' : 'form');
      scene?.render(sceneProgress(current, !motionRef.current), !motionRef.current);
      const smooth = value => { const t = Math.max(0, Math.min(1,value)); return t*t*(3-2*t); };
      const reveal = motionRef.current ? smooth((current-.20)/.07) * (1-smooth((current-.85)/.05)) : 1;
      root.style.setProperty('--story-reveal', String(reveal));
      const slot = root.querySelector('.sv-device-slot');
      const anchor = scene?.tabletAnchor();
      const bounds = slot?.getBoundingClientRect();
      const device = slot?.querySelector('.sv-device');
      const zoom = slot && device ? (parseFloat(getComputedStyle(slot).zoom) || 1) * (parseFloat(getComputedStyle(device).zoom) || 1) : 1;
      root.style.setProperty('--story-origin-x', `${anchor && bounds ? (anchor.x-bounds.left-bounds.width/2)*(1-reveal)/zoom : 0}px`);
      root.style.setProperty('--story-origin-y', `${anchor && bounds ? (anchor.y-bounds.top-bounds.height/2)*(1-reveal)/zoom : 25*(1-reveal)}px`);
      root.style.setProperty('--story-scale', String(.22+.78*reveal));
      if (motionRef.current && current !== target) frame = requestAnimationFrame(tick);
    };
    const schedule = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(tick); };
    scheduleRef.current = schedule;
    const updateMotion = () => { motionRef.current = !reduced.matches; setMotion(!reduced.matches); schedule(); };
    updateMotion();
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else { previousTime = 0; schedule(); }
    };
    const lostContext = event => {
      event.preventDefault();
      scene = null; sceneRef.current = null;
      setSceneStatus('fallback');
    };
    import('./scene').then(module => {
      if (cancelled) return;
      try {
        const created = module.createStudioScene(host);
        scene = created; createdScene = created; sceneRef.current = created;
        contextCanvas = host.querySelector('canvas');
        contextCanvas?.addEventListener('webglcontextlost', lostContext);
        setSceneStatus('ready'); schedule();
      } catch {
        host.replaceChildren();
        setSceneStatus('fallback');
      }
    }).catch(() => { if (!cancelled) setSceneStatus('fallback'); });
    const observer = new ResizeObserver(() => { scene?.resize(); schedule(); });
    observer.observe(host);
    root.addEventListener('scroll', schedule, { passive: true });
    reduced.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true; cancelAnimationFrame(frame); observer.disconnect();
      root.removeEventListener('scroll', schedule);
      reduced.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      contextCanvas?.removeEventListener('webglcontextlost', lostContext);
      createdScene?.dispose(); sceneRef.current = null; scheduleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (focusPending.current === phase) {
      titleRef.current?.focus({ preventScroll: true });
      focusPending.current = false;
    }
  }, [phase]);

  function goTo(progress) {
    focusPending.current = phaseFor(progress);
    if (phase === focusPending.current) {
      titleRef.current?.focus({ preventScroll: true });
      focusPending.current = false;
    }
    const root = rootRef.current;
    root.scrollTo({ top: progress * (trackRef.current.offsetHeight - hostRef.current.clientHeight), behavior: motionRef.current ? 'smooth' : 'instant' });
  }
  function toggleMotion() {
    motionRef.current = !motionRef.current;
    setMotion(motionRef.current); scheduleRef.current?.();
  }

  return <div className="studio-journey" ref={rootRef} data-scene={sceneStatus} data-motion={motion ? 'on' : 'off'}>
    <header className="sj-nav">
      <a className="sj-brand" href="/">vanta<span>.</span><small>STUDIO</small></a>
      <div className="sj-nav-right"><span className="sj-preview-label">A STUDIO VISIT / PREVIEW</span><button type="button" className="sj-skip" onClick={() => goTo(0.27)}>Skip to the story <span aria-hidden="true">↗</span></button></div>
    </header>
    <main className="sj-track" ref={trackRef} aria-label="Explore the studio by scrolling or choosing a chapter">
      <div className="sj-viewport">
        <div className="sj-fallback" aria-hidden="true" />
        <div className="sj-canvas" ref={hostRef} aria-hidden="true" />
        <div className="sj-shade" aria-hidden="true" />
        {sceneStatus === 'loading' && <span className="sj-load" role="status">Opening the studio…</span>}
        {sceneStatus === 'fallback' && <span className="sj-load" role="status">Simple view · You can still explore the booking</span>}

        {phase === 'door' && <section className="sj-intro sj-copy">
          <p className="sj-eyebrow">COME ON IN</p>
          <h1 tabIndex={-1} ref={titleRef}>From the first hello<br /><em>to the final detail.</em></h1>
          <p>A little more room for your craft.</p>
          <button className="sj-enter" onClick={() => goTo(0.16)}>Scroll to step inside <span aria-hidden="true">↓</span></button>
        </section>}

        {phase === 'reception' && <section className="sj-reception sj-copy">
          <p className="sj-eyebrow">01 / AT RECEPTION</p>
          <h2 tabIndex={-1} ref={titleRef}>Every piece starts<br /><em>with a conversation.</em></h2>
          <p>An idea. An artist. A space in the day.<br />From the first enquiry to signed consent.</p>
          <button className="sj-light-button" onClick={() => goTo(0.27)}>See how it works <span aria-hidden="true">↗</span></button>
        </section>}

        <BookingStory phase={phase} visible={bookingPhase} titleRef={titleRef} goTo={goTo} onSummaryChange={setBooking} />

        {phase === 'walk' && <section className="sj-walking sj-copy"><p className="sj-eyebrow">THROUGH TO THE STUDIO</p><h2 tabIndex={-1} ref={titleRef}>A space for<br /><em>what comes next.</em></h2><p>Keep scrolling to take a look around.</p></section>}

        {phase === 'studio' && <section className="sj-studio sj-copy">
          <p className="sj-eyebrow">03 / IN THE STUDIO</p>
          <h2 tabIndex={-1} ref={titleRef}>The day is in place.<br /><em>Stay with the work.</em></h2>
          <div className="sj-appointment"><span className="sj-status-dot" aria-hidden="true" /><div><strong>{booking.idea.trim() || 'Your next piece'}</strong><span>Alex Morgan · {booking.time || 'Time to be selected'}</span></div><span className="sj-appointment-label">EXAMPLE</span></div>
          <p className="sj-booking-outcome">{booking.paid ? '✓ Deposit paid · Booking confirmed' : 'Enquiry → estimate → availability → artist selection → deposit'}{booking.signed && ' · Consent stored'}</p><div className="sj-end-actions"><a className="sj-light-button" href="/?signup">Start free trial <span aria-hidden="true">↗</span></a><button onClick={() => goTo(0)}>Walk through again ↺</button></div>
          <small className="sj-trial-note">14 days · Card required · <a href="/features#pricing">Pricing & terms</a></small>
        </section>}
      </div>
    </main>
    <footer className="sj-controls">
      <div className="sj-progress" ref={progressRef} aria-hidden="true"><span /></div>
      <nav className="sj-chapters" aria-label="Studio visit chapters">{CHAPTERS.map((item, index) => <button key={item.label} type="button" onClick={() => goTo(item.at)} aria-current={chapter === index ? 'step' : undefined}><span className="sj-chapter-number">0{index + 1}</span>{item.label}</button>)}</nav>
      <button className="sj-motion" type="button" aria-pressed={!motion} onClick={toggleMotion}>{motion ? 'Pause motion' : 'Enable motion'}</button>
    </footer>
  </div>;
}
