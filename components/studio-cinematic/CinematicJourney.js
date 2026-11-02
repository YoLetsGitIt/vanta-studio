'use client';

import { useEffect, useRef, useState } from 'react';
import { BOOKING_MOMENTS, phaseFor, storyProgress, scrollProgress, JOURNEY_SCREENS, FEATURE_REVEAL_SCREENS, TRAVEL_MS } from './booking-story';
import styles from './cinematic.module.css';
import RenderedScene from './RenderedScene';
import { frameForProgress, artistFrame, ARTIST_FIRST, DIRECT_FIRST } from './frame-player';
import { artistEntranceFrame, artistEntranceProgress, ARTIST_ENTRANCE_MS } from './artist-entrance';
import { sceneVariant } from './scene-framing';
import tabletBounds from './tablet-bounds.json';
import FeatureExplorer from './FeatureExplorer';
import { updateFlashWall, flashRevealState, WALL_ZOOM } from './flash-wall-motion';
import { createScrollPlayhead } from './scroll-playhead';
import StudioEntryButton from './StudioEntryButton';
import FormOverview from './FormOverview';
import BookingOverview from './BookingOverview';
import ConsentOverview from './ConsentOverview';
import StudioAudience from './StudioAudience';
import ArtistVisit, { ARTIST_STEPS } from './ArtistVisit';
import { JourneyLinksProvider } from './JourneyLinks';

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const n = clamp(value); return n * n * (3 - 2 * n); };

function SceneImage({ name, priority = false, onError }) {
  const imageRef = useRef(null);
  useEffect(() => {
    // A cached failure can finish before React attaches its error handler.
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) onError?.();
  }, [onError]);
  return <img ref={imageRef} src={`/studio/cinematic/${name}-1536.webp`}
    srcSet={[640, 960, 1536].map(w => `/studio/cinematic/${name}-${w}.webp ${w}w`).join(', ')}
    sizes="(max-aspect-ratio: 3/2) 150svh, 100vw" width="1536" height="1024"
    fetchPriority={priority ? 'high' : 'auto'} loading={priority ? 'eager' : 'lazy'}
    alt="" draggable="false" onError={onError} />;
}

export default function CinematicJourney({ rendered = false, initialAudience = null, links = null }) {
  const sequenceRef = useRef(null);
  const audienceRef = useRef(null);
  // Artist camera: 0..1 walks from reception to the stool, 1..2 looks down at
  // the phone. Scroll stays parked at reception, so this drives the camera.
  const seatRef = useRef(0), seatWalkRef = useRef(0);
  const artistEntranceRef = useRef(null);
  const [artistStep, setArtistStep] = useState(null), [artistSettled, setArtistSettled] = useState(false);
  const artistStepRef = useRef(null), stepLockRef = useRef(0);
  const [audience, setAudience] = useState(null), [audienceOpen, setAudienceOpen] = useState(false);
  const productRef = useRef(null), screenRef = useRef(null);
  const [featuresOpen, setFeaturesOpen] = useState(false), [featuresReady, setFeaturesReady] = useState(false);
  const featureRef=useRef(null), stageRef=useRef(null), focusFeatures=useRef(false);
  const rootRef = useRef(null), trackRef = useRef(null), titleRef = useRef(null);
  const scheduleRef = useRef(() => {}), motionRef = useRef(true), pendingFocus = useRef(null);
  const [phase, setPhase] = useState('door');
  const travelRef = useRef(0);
  const [travelling, setTravelling] = useState(false);
  const [motion, setMotion] = useState(true), [interiorFailed, setInteriorFailed] = useState(false);
  const [tabletReady, setTabletReady] = useState(!rendered);
  const [inside, setInside] = useState(false);
  const index = BOOKING_MOMENTS.findIndex(step => step.id === phase);
  const inStory = index >= 0;
  const step = BOOKING_MOMENTS[Math.max(0, index)];
  const moment = step;

  useEffect(() => {
    const root = rootRef.current, track = trackRef.current;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, lastPhase = 'door';
    const playhead = createScrollPlayhead();
    function paint(now) {
      frame = 0;
      const stageHeight=stageRef.current.offsetHeight;
      const sceneDistance=stageHeight*JOURNEY_SCREENS-root.clientHeight;
      const featureDistance=stageHeight*FEATURE_REVEAL_SCREENS;
      // Pause at reception for the same choice whether entering by button,
      // wheel, keyboard or touch. Native scrolling resumes after selection.
      const reception=scrollProgress(.16)*sceneDistance;
      if (initialAudience === 'artist' && !audienceRef.current && root.scrollTop > 1) {
        enterArtist();
      } else if (!audienceRef.current && root.scrollTop >= reception-1) {
        cancelAnimationFrame(travelRef.current);travelRef.current=0;
        pendingFocus.current=null;setTravelling(false);
        root.scrollTop=reception;
        // The first steps toward the stool, so choosing Artist starts moving at
        // once. The rest streams like the owner walk, skipping ahead on slow
        // connections rather than holding a frame.
        sequenceRef.current?.warm?.(ARTIST_FIRST,ARTIST_FIRST+23);
        if (initialAudience) chooseAudience(initialAudience);
        else setAudienceOpen(true);
      } else if (audienceRef.current && root.scrollTop < reception-8) {
        // Returning to the entrance forgets the choice, so walking back in
        // asks again instead of carrying the visitor straight through.
        audienceRef.current=null;setAudience(null);
      }
      const scroll = playhead.update(root.scrollTop, now, stageHeight, {
        motion: motionRef.current, scripted: Boolean(travelRef.current),
        contentStart: sceneDistance+featureDistance,
      });
      const current = storyProgress(scroll.position / Math.max(1, sceneDistance));
      const featureProgress=clamp((scroll.position-sceneDistance)/featureDistance);
      root.dataset.scrollFast=String(scroll.fast);
      const featureFade=motionRef.current?smooth((featureProgress-.02)/.16):Number(featureProgress>=.5);
      const wallPush=flashRevealState(featureProgress,0,motionRef.current).push;
      const overflow=Math.max(0,featureRef.current.scrollHeight-stageHeight);
      track.style.setProperty('--features-overflow',`${overflow}px`);
      track.style.setProperty('--feature-distance',`${featureDistance}px`);
      root.style.setProperty('--features-fade',String(featureFade));
      root.style.setProperty('--wall-push',String(wallPush));
      root.style.setProperty('--wall-zoom',String(WALL_ZOOM));
      root.style.setProperty('--wall-shade',String(motionRef.current?smooth((featureProgress-.14)/.30):featureFade));
      root.style.setProperty('--wall-copy',String(motionRef.current?smooth((featureProgress-.10)/.24):featureFade));
      root.style.setProperty('--arrival-exit',String(motionRef.current?1-smooth(featureProgress/.35):1-featureFade));
      root.style.setProperty('--features-offset',`${-Math.max(0,scroll.position-sceneDistance-featureDistance)}px`);
      updateFlashWall(featureRef.current,featureProgress,root.clientWidth,stageHeight,motionRef.current,rendered,wallPush);
      setFeaturesOpen(featureProgress>.02);
      setFeaturesReady(featureProgress>=.52);
      sequenceRef.current?.seek(artistEntranceRef.current ?? (seatRef.current>0 ? artistFrame(seatRef.current) : frameForProgress(current, motionRef.current)), motionRef.current);
      setInside(current >= .10);
      const next = phaseFor(current);
      if(next!==lastPhase){root.dataset.fastPhase=String(scroll.fast);lastPhase=next;}
      setPhase(next);
      root.dataset.phase = next;
      // No scroll position should leave a reading panel blank. Its brief
      // entrance animation runs in time, even when the visitor stops scrolling.
      for (const { id } of BOOKING_MOMENTS) {
        root.style.setProperty(`--panel-${id}`, String(Number(next===id)));
      }
      root.style.setProperty('--progress', String(current));
      root.style.setProperty('--intro-opacity', String(motionRef.current ? 1-smooth((current-.025)/.065) : 1));
      root.style.setProperty('--intro-lift', `${motionRef.current ? smooth((current-.025)/.065)*-12 : 0}px`);
      root.style.setProperty('--arrival-opacity', String(motionRef.current ? smooth((current-.925)/.035) : 1));
      // A reversible aperture opens as we leave the tablet. No extra scroll track.
      const departure = motionRef.current ? smooth((current-.825)/.04) : 0;
      const aperture = motionRef.current ? smooth((current-.825)/.018)*(1-smooth((current-.85)/.095)) : 0;
      root.style.setProperty('--departure', String(departure));
      root.style.setProperty('--room-inset', `${aperture*12}%`);
      root.style.setProperty('--arrival-line', String(motionRef.current ? smooth((current-.965)/.025) : 1));
      root.style.setProperty('--arrival-detail', String(motionRef.current ? smooth((current-.952)/.028) : 1));
      root.style.setProperty('--entry-scale', String(motionRef.current ? 1 + smooth(current/.22)*.13 : 1.04));
      root.style.setProperty('--interior-scale', String(motionRef.current ? 1.06-smooth((current-.88)/.12)*.06 : 1));
      root.style.setProperty('--interior-opacity', String(smooth((current-.87)/.09)));
      root.style.setProperty('--story-opacity', String(smooth((current-.18)/.055)*(1-smooth((current-.865)/.04))));
      if (rendered) {
        // Pick up the rendered screen with an identical crop before expanding.
        // Reveal the live overview during the move, without stretching its text.
        const animated = motionRef.current;
        const entrance = smooth((current-.235)/.032);
        const layout = animated ? entrance*(1-smooth((current-.825)/.03)) : 1;
        const reveal = animated ? smooth((current-.225)/.007)*(1-smooth((current-.855)/.01)) : 1;
        const overview = animated ? smooth((current-.243)/.018) : 1;
        root.style.setProperty('--tablet-opacity', String(reveal));
        root.style.setProperty('--tablet-overview', String(overview));
        root.style.setProperty('--tablet-bridge', String(animated ? 1-smooth((current-.232)/.011) : 0));
        root.style.setProperty('--story-copy-opacity', String(animated ? smooth((current-.248)/.022)*(1-smooth((current-.825)/.03)) : 1));
        root.style.setProperty('--tablet-shade', String(animated ? smooth((current-.225)/.020)*(1-smooth((current-.865)/.035)) : Number(BOOKING_MOMENTS.some(step=>step.id===next))));
        setTabletReady(!animated || reveal > .98 && layout > .98);
        if (productRef.current && screenRef.current) {
          // Match the renderer's projected screen through the canvas cover crop.
          const w = root.clientWidth, h = root.clientHeight;
          const variant = sceneVariant(w,h);
          const bounds = tabletBounds[variant];
          const scale = Math.max(w/bounds.renderWidth,h/bounds.renderHeight);
          const x = (w-bounds.renderWidth*scale)/2 + (bounds.left+bounds.width/2)*bounds.renderWidth*scale;
          const y = (h-bounds.renderHeight*scale)/2 + (bounds.top+bounds.height/2)*bounds.renderHeight*scale;
          const rect = productRef.current.getBoundingClientRect();
          const frame = screenRef.current;
          root.style.setProperty('--tablet-x', `${(x-rect.left-rect.width/2)*(1-layout)}px`);
          root.style.setProperty('--tablet-y', `${(y-rect.top-rect.height/2)*(1-layout)}px`);
          const sx=1+(bounds.width*bounds.renderWidth*scale/frame.offsetWidth-1)*(1-layout);
          const sy=1+(bounds.height*bounds.renderHeight*scale/frame.offsetHeight-1)*(1-layout);
          root.style.setProperty('--tablet-sx', String(sx));
          root.style.setProperty('--tablet-sy', String(sy));
          root.style.setProperty('--tablet-content-x', String(Math.min(sx,sy)/sx));
          root.style.setProperty('--tablet-content-y', String(Math.min(sx,sy)/sy));
          root.style.setProperty('--tablet-crop', `url(/studio/walkthrough/${variant}/0152.webp)`);
          root.style.setProperty('--tablet-crop-size', `${100/bounds.width}% ${100/bounds.height}%`);
          root.style.setProperty('--tablet-crop-position', `${100*bounds.left/(1-bounds.width)}% ${100*bounds.top/(1-bounds.height)}%`);
        }
      }
      if (!scroll.settled) frame=requestAnimationFrame(paint);
    }
    const schedule=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(paint);};
    scheduleRef.current=schedule;
    const updatePreference=()=>{motionRef.current=!preference.matches;setMotion(!preference.matches);schedule();};
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{schedule();}};
    const observer=new ResizeObserver(schedule);observer.observe(root);observer.observe(featureRef.current);
    root.addEventListener('scroll',schedule,{passive:true});
    document.addEventListener('visibilitychange',visibility);preference.addEventListener('change',updatePreference);
    updatePreference();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();root.removeEventListener('scroll',schedule);document.removeEventListener('visibilitychange',visibility);preference.removeEventListener('change',updatePreference);scheduleRef.current=()=>{};};
  }, [rendered, initialAudience]);

  useEffect(()=>{
    const root=rootRef.current;
    const cancel=()=>{cancelAnimationFrame(travelRef.current);travelRef.current=0;pendingFocus.current=null;focusFeatures.current=false;setTravelling(false);};
    const key=e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End','Escape',' '].includes(e.key))cancel();};
    const visibility=()=>{if(document.hidden)cancel();};
    root.addEventListener('wheel',cancel,{passive:true});
    root.addEventListener('touchstart',cancel,{passive:true});
    root.addEventListener('keydown',key);
    window.addEventListener('resize',cancel);
    document.addEventListener('visibilitychange',visibility);
    return()=>{cancel();root.removeEventListener('wheel',cancel);root.removeEventListener('touchstart',cancel);root.removeEventListener('keydown',key);window.removeEventListener('resize',cancel);document.removeEventListener('visibilitychange',visibility);};
  },[]);

  useEffect(()=>{
    if(!travelling&&pendingFocus.current===phase&&!featuresOpen&&(!inStory||tabletReady)){titleRef.current?.focus({preventScroll:true});pendingFocus.current=null;}
    scheduleRef.current();
  },[phase,index,inStory,tabletReady,featuresOpen,travelling]);

  function travelTo(destination, duration) {
    cancelAnimationFrame(travelRef.current);
    travelRef.current=0;
    const root=rootRef.current, origin=root.scrollTop;
    if(!motionRef.current || Math.abs(destination-origin)<2){
      root.scrollTo({top:destination,behavior:'instant'});
      setTravelling(false);
      return;
    }
    setTravelling(true);
    const start=performance.now();
    const advance=now=>{
      // A reduced-motion preference change completes navigation without leaving the visitor
      // between chapters. Wheel, touch and keyboard input cancel it separately.
      const p=motionRef.current?clamp((now-start)/duration):1;
      root.scrollTo({top:origin+(destination-origin)*smooth(p),behavior:'instant'});
      travelRef.current=p<1?requestAnimationFrame(advance):0;
      if(p===1)setTravelling(false);
    };
    travelRef.current=requestAnimationFrame(advance);
  }
  function goTo(at, duration) {
    focusFeatures.current=false;
    pendingFocus.current=phaseFor(at);
    const root=rootRef.current;
    const destination=scrollProgress(at)*(stageRef.current.offsetHeight*JOURNEY_SCREENS-root.clientHeight);
    // Adjacent overview panels respond quickly; physical camera journeys have
    // enough time to read as a walk. Replays use the same entrance pacing.
    const time=duration ?? (at===0 ? TRAVEL_MS.entrance : featuresOpen ? TRAVEL_MS.features : at>=.9 || !inStory ? TRAVEL_MS.studio : TRAVEL_MS.panel);
    travelTo(destination,time);
    if(Math.abs(root.scrollTop-destination)<2&&pendingFocus.current===phase&&!featuresOpen&&(!inStory||tabletReady)){
      titleRef.current?.focus({preventScroll:true});pendingFocus.current=null;
    }
  }
  useEffect(()=>()=>cancelAnimationFrame(seatWalkRef.current),[]);
  useEffect(()=>{
    if(artistStep===null)return;
    const root=rootRef.current;let wheel=0,touchY=null;
    const step=direction=>{
      const now=performance.now(), current=artistStepRef.current;
      // Extra downward input must not skip the arrival while the camera walks.
      // Back/Escape can still return immediately to the entrance.
      if(artistEntranceRef.current!==null){if(direction<0)closeAudience();return;}
      if(now<stepLockRef.current||document.querySelector('dialog[open]'))return;
      stepLockRef.current=now+900;wheel=0;
      const index=ARTIST_STEPS.indexOf(current)+direction;
      // Scrolling up from the stool stands up and asks again, like leaving reception.
      if(index<0)chooseAudience(null);
      else if(index<ARTIST_STEPS.length)showArtist(ARTIST_STEPS[index]);
    };
    // The artist wall scrolls natively; only its back button leaves it.
    const inWall=()=>artistStepRef.current==='wall';
    const onWheel=e=>{if(inWall())return;wheel+=e.deltaY;if(Math.abs(wheel)>60)step(Math.sign(wheel));};
    const onTouchStart=e=>{touchY=e.touches[0].clientY;};
    const onTouchEnd=e=>{if(touchY===null||inWall())return;const dy=touchY-e.changedTouches[0].clientY;touchY=null;if(Math.abs(dy)>45)step(Math.sign(dy));};
    const onKey=e=>{
      if(e.key==='Escape'&&!document.querySelector('dialog[open]')){e.preventDefault();inWall()?showArtist('seated'):step(-1);return;}
      if(inWall()||e.target.closest?.('button,a')&&e.key===' ')return;
      if(['ArrowDown','PageDown',' '].includes(e.key)){e.preventDefault();step(1);}
      else if(['ArrowUp','PageUp'].includes(e.key)){e.preventDefault();step(-1);}
    };
    root.addEventListener('wheel',onWheel,{passive:true});root.addEventListener('touchstart',onTouchStart,{passive:true});root.addEventListener('touchend',onTouchEnd,{passive:true});window.addEventListener('keydown',onKey);
    return()=>{root.removeEventListener('wheel',onWheel);root.removeEventListener('touchstart',onTouchStart);root.removeEventListener('touchend',onTouchEnd);window.removeEventListener('keydown',onKey);};
  },[artistStep===null]);
  useEffect(()=>{
    if(featuresReady&&focusFeatures.current){featureRef.current.querySelector('h2').focus({preventScroll:true});focusFeatures.current=false;}
  },[featuresReady]);
  function enterArtist(){
    if(audienceRef.current)return;
    const root=rootRef.current;
    const visible=Number(root.querySelector('canvas[data-frame]')?.dataset.frame || 0);
    let progress=artistEntranceProgress(visible);
    cancelAnimationFrame(travelRef.current);travelRef.current=0;
    cancelAnimationFrame(seatWalkRef.current);seatWalkRef.current=0;
    pendingFocus.current=null;setTravelling(false);
    audienceRef.current='artist';setAudience('artist');setAudienceOpen(false);
    artistStepRef.current='seated';setArtistStep('seated');setArtistSettled(false);
    artistEntranceRef.current=artistEntranceFrame(progress);
    root.dataset.seat='';
    root.scrollTop=scrollProgress(.16)*(stageRef.current.offsetHeight*JOURNEY_SCREENS-root.clientHeight);
    sequenceRef.current?.warm?.(DIRECT_FIRST,DIRECT_FIRST+35);
    let previous=performance.now();
    const advance=now=>{
      // Pause the clock when the tab is hidden, rather than skipping the room.
      if(!document.hidden)progress=motionRef.current?Math.min(1,progress+Math.min(64,now-previous)/ARTIST_ENTRANCE_MS):1;
      previous=now;
      artistEntranceRef.current=artistEntranceFrame(progress);
      root.dataset.artistEntrance='walk';
      if(progress===1){
        seatRef.current=1;artistEntranceRef.current=null;seatWalkRef.current=0;
        delete root.dataset.artistEntrance;
        setArtistSettled(true);
      }else seatWalkRef.current=requestAnimationFrame(advance);
      scheduleRef.current();
    };
    advance(previous);
  }
  function walkToSeat(target, done){
    cancelAnimationFrame(seatWalkRef.current);seatWalkRef.current=0;
    const root=rootRef.current, origin=seatRef.current;
    // Scroll stays parked at reception from leaving it until standing back there.
    const settle=()=>{seatWalkRef.current=0;if(!seatRef.current)delete root.dataset.seat;done?.();};
    root.dataset.seat='';
    // Walking (0..1) and looking down (1..2) keep their own pace, in order.
    const crossesSeat=(origin-1)*(target-1)<0;
    // The rendered paths already start and stop gently, so time maps linearly:
    // easing again would hold the first and last frames long enough to stutter.
    const legs=(crossesSeat?[[origin,1],[1,target]]:[[origin,target]]).filter(([from,to])=>Math.abs(to-from)>.001)
      .map(([from,to])=>[from,to,(Math.min(from,to)>=1?TRAVEL_MS.look:TRAVEL_MS.seat)*Math.abs(to-from)]);
    if(!motionRef.current || !legs.length){seatRef.current=target;scheduleRef.current();settle();return;}
    const start=performance.now();
    const advance=now=>{
      let elapsed=now-start, position=target;
      for(const [from,to,duration] of legs){
        if(elapsed<duration){position=from+(to-from)*elapsed/duration;break;}
        elapsed-=duration;
      }
      seatRef.current=position;scheduleRef.current();
      if(position!==target)seatWalkRef.current=requestAnimationFrame(advance);else settle();
    };
    seatWalkRef.current=requestAnimationFrame(advance);
  }
  function showArtist(step){
    artistStepRef.current=step;setArtistStep(step);
    if(step===null){setArtistSettled(false);return;}
    // Phone moments look down into the lap; everything else is seated eye level.
    const camera=typeof step==='number'?2:1;
    if(Math.abs(seatRef.current-camera)<.001&&!seatWalkRef.current){setArtistSettled(true);return;}
    setArtistSettled(false);walkToSeat(camera,()=>setArtistSettled(true));
  }
  function chooseAudience(value){
    setAudienceOpen(false);showArtist(null);
    if(value===null){
      // Stand up and walk back before asking again. The choice is only cleared
      // on arrival, so the reception pause cannot reopen it mid-walk.
      walkToSeat(0,()=>{audienceRef.current=null;setAudience(null);if(initialAudience)closeAudience();else setAudienceOpen(true);});
      return;
    }
    audienceRef.current=value;setAudience(value);
    if(value==='owner')walkToSeat(0,()=>goTo(.27,1600));
    // Walk to the station and sit down before offering the artist tour.
    else showArtist('seated');
  }
  function closeAudience(){
    cancelAnimationFrame(seatWalkRef.current);seatWalkRef.current=0;seatRef.current=0;
    artistEntranceRef.current=null;
    delete rootRef.current.dataset.artistEntrance;
    delete rootRef.current.dataset.seat;showArtist(null);
    audienceRef.current=null;setAudience(null);
    rootRef.current.scrollTo({top:0,behavior:'instant'});
    setAudienceOpen(false);scheduleRef.current();
  }
  function exploreFeatures(){
    pendingFocus.current=null;
    focusFeatures.current=true;
    const destination=stageRef.current.offsetHeight*(JOURNEY_SCREENS+FEATURE_REVEAL_SCREENS)-rootRef.current.clientHeight;
    travelTo(destination,TRAVEL_MS.features);
  }
  function revealFocusedFeature(event){
    if(event.target.closest('dialog'))return;
    const root=rootRef.current, stage=stageRef.current;
    // The pinned scene must never become a second, native focus scroller.
    // Keep keyboard navigation on the same scroll track as the animation.
    stage.scrollTop=0;
    const bounds=event.target.getBoundingClientRect();
    const firstFeature=Math.ceil(stage.offsetHeight*(JOURNEY_SCREENS+FEATURE_REVEAL_SCREENS)-root.clientHeight);
    const delta=bounds.bottom>root.clientHeight-16?bounds.bottom-root.clientHeight+16:bounds.top<16?bounds.top-16:0;
    // Native focus scrolling can move the pinned gallery back into its reveal
    // even when the focused card already fits on screen (especially on mobile).
    if(delta || root.scrollTop<firstFeature)root.scrollTo({top:Math.max(firstFeature,root.scrollTop+delta),behavior:'instant'});
  }

  const navigation=(inside||links)&&<header className={styles.nav} inert={featuresOpen||artistStep==='wall'}>
      <a className={styles.brand} href={links?.home || "/"} aria-label="Vanta home">vanta<span>.</span><small>{initialAudience==='artist'||audience==='artist'?'ARTIST':'STUDIO'}</small></a>
      <div className={styles.navActions}>
      {links&&<nav className={styles.productLinks} aria-label="Vanta products"><a href={links.artists} aria-current={initialAudience==='artist'?'page':undefined}>For artists</a><a href={links.studio} aria-current={initialAudience==='owner'?'page':undefined}>For studios</a><a href={links.signin}>Sign in</a></nav>}
      {!links&&audience==='artist'&&artistStep!==null&&<button className={styles.skip} onClick={()=>chooseAudience('owner')}>Studio owner view <span aria-hidden="true">↗</span></button>}
      {(!links||inside)&&audience!=='artist'&&<button className={styles.skip} onClick={()=>!audienceRef.current?chooseAudience('owner'):phase==='studio'?exploreFeatures():goTo(inStory ? .99 : .27)}>{phase==='studio'?'Explore features':inStory?'See the studio':'Explore Vanta'} <span aria-hidden="true">↗</span></button>}</div>
    </header>;

  return <JourneyLinksProvider value={links}><div className={styles.root} ref={rootRef} data-phase={phase} data-motion={motion?'on':'off'} data-story={inStory} data-rendered={rendered} data-features-open={featuresOpen} data-audience-open={audienceOpen} data-audience={audience || undefined} data-artist-step={artistStep===null ? undefined : typeof artistStep==='number' ? 'phone' : artistStep}>
    <StudioAudience navigation={navigation} open={audienceOpen} onChoose={chooseAudience} onBack={closeAudience} />
    {artistStep!==null&&<ArtistVisit step={artistStep} settled={artistSettled} motion={motion} onStep={showArtist} onOwner={()=>links?window.location.assign(links.studio):chooseAudience('owner')} scrollRoot={rootRef} />}
    {!audienceOpen&&navigation}
    <main className={styles.track} ref={trackRef} style={{ '--journey-height': `${JOURNEY_SCREENS*100}svh`, '--feature-distance': `${FEATURE_REVEAL_SCREENS*100}svh` }} aria-label="A visit to Vanta Studio. Scroll to explore.">
      <div className={styles.stage} ref={stageRef}>
        {rendered ? <RenderedScene ref={sequenceRef} receptionist={initialAudience==='artist'} /> : <>
          <div className={`${styles.photo} ${styles.entrance}`} aria-hidden="true"><SceneImage name="entrance" priority /></div>
          {!interiorFailed&&<div className={`${styles.photo} ${styles.interior}`} aria-hidden="true"><SceneImage name="interior" onError={()=>setInteriorFailed(true)} /></div>}
        </>}
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.storyShade} aria-hidden="true" />

        {phase==='door'&&<section className={`${styles.copy} ${styles.intro}`}>
          <h1 tabIndex={-1} ref={titleRef}><span>{initialAudience==='artist'?'Your work.':'From the first hello'}</span>{' '}<span>{initialAudience==='artist'?'Your next chapter.':'to the final detail.'}</span></h1>
          <StudioEntryButton motion={motion} onEnter={()=>initialAudience==='artist'?enterArtist():goTo(.27, TRAVEL_MS.entrance)} />
        </section>}
        {inStory&&<section className={styles.story} data-beat={phase} aria-label="The Vanta booking story">
          <header className={styles.storyCopy} inert={!tabletReady}>
            <nav className={styles.moments} aria-label="Booking story sections">
              {BOOKING_MOMENTS.map((item,i)=><button key={item.id} aria-current={i===index?'step':undefined} onClick={()=>goTo(item.at)}>{item.label}</button>)}
            </nav>
            <h2 key={`${moment.id}-title`} tabIndex={-1} ref={titleRef}>{moment.title.split('\n').map((line,i)=><span key={line}>{i>0&&' '}{line}</span>)}</h2>
            <p key={`${moment.id}-description`} className={styles.description}>{moment.text}</p>
          </header>
          <div className={styles.product} ref={productRef}>
            <div className={styles.screenFrame} ref={screenRef}>
              {rendered&&<div className={styles.tabletBridge} aria-hidden="true" />}
              <div className={styles.screenContents}>
              <div className={`${styles.storyPanel} ${styles.formPanel}`} aria-hidden={phase!=='form'}>
                <FormOverview />
              </div>
              <div className={`${styles.storyPanel} ${styles.bookedPanel}`} aria-hidden={phase!=='booked'}>
                <BookingOverview />
              </div>
              <div className={`${styles.storyPanel} ${styles.consentPanel}`} aria-hidden={phase!=='consent'}>
                <ConsentOverview />
              </div>
              </div>
            </div>
            <div className={styles.tabletControls} inert={!tabletReady}>
              <button className={styles.tabletArrow} onClick={()=>goTo(index>0?BOOKING_MOMENTS[index-1].at:0)} aria-label="Previous moment"><span aria-hidden="true">←</span></button>
              <button className={styles.tabletArrow} onClick={()=>goTo(BOOKING_MOMENTS[index+1]?.at||.99)} aria-label={index===BOOKING_MOMENTS.length-1?'Continue into the studio':'Next moment'}><span aria-hidden="true">→</span></button>
            </div>
          </div>
        </section>}

        {(phase==='walk'||phase==='studio')&&<section className={`${styles.copy} ${styles.arrival}`} inert={featuresOpen}>
          <h2 tabIndex={-1} ref={titleRef}><span className={styles.arrivalMask}><span>You focus on the art.</span></span>{' '}<span className={`${styles.arrivalMask} ${styles.arrivalDetail}`}><span>We’ll handle the rest.</span></span></h2>
          <button className={styles.exploreStudio} onClick={exploreFeatures} inert={phase!=='studio'}>Explore the flash wall <span className={styles.featureButtonIcon} aria-hidden="true"><i/><i/><i/><i/></span></button>
        </section>}
        <FeatureExplorer sectionRef={featureRef} active={featuresReady} onFocusCapture={revealFocusedFeature} scrollRoot={rootRef} onClose={()=>goTo(.99)} onReplay={()=>goTo(0)}/>
      </div>
    </main>

  </div></JourneyLinksProvider>;
}
