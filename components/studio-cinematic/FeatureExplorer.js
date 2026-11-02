'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STUDIO_FEATURES } from './studio-features';
import styles from './features.module.css';
import wall from './flash-wall.module.css';
import FlashArtwork from './FlashArtwork';
import WallPrint from './WallPrint';
import FeatureDemoPlayer from '@/components/FeatureDemoPlayer';
import { useJourneyLinks } from './JourneyLinks';

// Content comes from the shared product catalogue; only the gallery order changes.
const GROUP_INTROS = {
  Bookings: 'From the first enquiry to a full studio day.',
  Clients: 'Keep every detail with the person behind the piece.',
  Studio: 'Your team, your performance, your bigger picture.',
  System: 'Settle in and make Vanta work for you.',
};
const FEATURE_GROUPS = [...new Set(STUDIO_FEATURES.map(feature => feature.section))].map(name => ({
  name,
  label: name === 'System' ? 'Getting started' : name,
  intro: GROUP_INTROS[name],
  features: STUDIO_FEATURES.filter(feature => feature.section === name),
}));



// Shared with the artist wall, which supplies its own brand and call to action.
export function FeatureDetail({ feature, onClose, scrollRoot, brand = 'Vanta Studio', action: suppliedAction, backLabel = 'Back to features' }) {
  const links = useJourneyLinks();
  const action = suppliedAction || { href: links.signup, label: 'Start free trial' };
  const dialogRef = useRef(null), backRef = useRef(null);
  const [screenIndex, setScreenIndex] = useState(0);
  const screen = feature.screens[screenIndex];
  useEffect(() => {
    const dialog = dialogRef.current, root = scrollRoot.current;
    const opener = document.activeElement, overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    dialog.showModal();
    backRef.current.focus();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||root.dataset.motion==='off';
    const origin=feature.origin, bounds=dialog.getBoundingClientRect();
    const animation=!reduced&&dialog.animate([
      {opacity:0,transform:`translate(${origin ? (origin.x+origin.width/2-bounds.x-bounds.width/2)*.15 : 0}px, 22px) scale(.9)`},
      {opacity:1,transform:'translate(0,0) scale(1)'},
    ],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});
    return () => {
      if(animation)animation.cancel();
      dialog.close(); root.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [scrollRoot]);
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="feature-title" aria-describedby="feature-intro" onCancel={event=>{event.preventDefault();event.stopPropagation();onClose();}} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const r = event.currentTarget.getBoundingClientRect();
    if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) onClose();
  }}>
    <div className={styles.dialogNav}>
      <button ref={backRef} onClick={onClose} className={styles.back}>← <span>{backLabel}</span></button>
      <span className={styles.dialogLabel}>{brand.toUpperCase()}</span>
    </div>
    <div className={`${styles.detail} ${!screen ? styles.textDetail : screen.type==='video' ? screen.portrait && !screen.tour ? styles.portraitDemo : styles.demoDetail : ''}`}>
      <header className={styles.detailHeader}>
        {!screen?.tour && <span className={wall.detailArt}><FlashArtwork id={feature.art || feature.id}/></span>}
        <h2 id="feature-title">{feature.title}</h2>
        <p id="feature-intro">{feature.intro}</p>
      </header>
      {screen&&<figure className={`${styles.figure} ${(feature.portrait || feature.id==='clients') && screen.type!=='video' ? styles.portrait : styles.wide}`}>
        <div className={screen.type==='video' ? undefined : styles.capture}>
          {screen.type==='video'
            ? <FeatureDemoPlayer key={screen.src} demo={screen} title={feature.title} />
            : <img key={screen.src} src={screen.src} alt={screen.alt} decoding="async"/>}
        </div>
        {screen.type!=='video'&&<figcaption>{feature.title}<span>{brand} · {screen.label}</span></figcaption>}
        {feature.screens.length>1 && <div className={styles.screenPicker} role="group" aria-label="Product previews">{feature.screens.map((item,i)=><button key={item.src} aria-pressed={i===screenIndex} onClick={()=>setScreenIndex(i)}>{item.label}</button>)}</div>}
      </figure>}
      {feature.points.length>0&&<ul className={styles.points}>{feature.points.map(description=><li key={description}><p>{description}</p></li>)}</ul>}
      <div className={styles.detailAction}><a href={action.href} className={styles.cta} {...(action.external ? { target: '_blank', rel: 'noopener' } : {})}>{action.label} <span aria-hidden="true">↗</span></a><button onClick={onClose} className={styles.textButton}>Keep exploring</button></div>
    </div>
  </dialog>;
}

export default function FeatureExplorer({ sectionRef, active, onFocusCapture, scrollRoot, onReplay, onClose }) {
  const links = useJourneyLinks();
  const [selected, setSelected] = useState(null);
  return <section ref={sectionRef} className={`${styles.explorer} ${wall.gallery} ${wall.groupedGallery}`} aria-labelledby="explore-heading" id="studio-features" inert={!active} aria-hidden={!active} onFocusCapture={onFocusCapture}>
    <div className={wall.navigation}><span>VANTA / FEATURES</span><button onClick={onClose}><span aria-hidden="true">←</span>Back to studio</button></div>
    <div className={wall.inner}>
      <header className={wall.heading}><h2 tabIndex={-1} id="explore-heading">Everything behind the art.</h2><p>Less admin. More time for your craft.<br/>Take a closer look at the tools behind your studio.</p></header>
      <div className={wall.featureGroups}>{FEATURE_GROUPS.map((group,groupIndex)=><section key={group.name} data-category={group.name.toLowerCase()} className={wall.featureGroup} aria-labelledby={`feature-group-${groupIndex}`}>
        <header className={wall.groupHeading}>
          <span className={wall.groupNumber}>{String(groupIndex+1).padStart(2,'0')}</span>
          <h3 id={`feature-group-${groupIndex}`}>{group.label}</h3>
          {group.intro&&<p>{group.intro}</p>}
        </header>
        <div className={wall.groupGrid}>{group.features.map(feature=><button key={feature.id} data-flash-print={feature.id} className={wall.print} style={{'--tilt':'0deg'}} onClick={event=>{const {x,y,width,height}=event.currentTarget.getBoundingClientRect();setSelected({...feature,origin:{x,y,width,height}});}} aria-haspopup="dialog" aria-label={`Explore ${feature.title}`} aria-describedby={`flash-summary-${feature.id}`}>
        <span data-flash-frame className={wall.frame}><span className={wall.paper}><FlashArtwork id={feature.id}/></span></span>
        <WallPrint id={feature.id}/>
        {feature.id==='languages'&&<WallPrint id="languages-repeat"/>}
        <span className={wall.caption}><h4>{feature.title}</h4></span>
        <p id={`flash-summary-${feature.id}`} className={wall.summary}>{feature.teaser}</p>
        <span className={wall.learn} aria-hidden="true"><span className={wall.demoLabel}>{feature.screens.some(screen=>screen.type==='video')?'Watch demo':'View details'}</span></span>
      </button>)}</div>
      </section>)}</div>
      <footer className={`${wall.footer} ${wall.trialFooter}`}>
        <div className={wall.trialCopy}>
          <h3>Make it your studio.</h3>
          <p>Try Vanta Studio for 14 days.</p>
        </div>
        <div className={wall.trialActions}>
          <a className={wall.trialButton} href={links.signup}>Start free trial<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></a>
          <small>Card required <span aria-hidden="true">·</span> <a href={links.pricing}>Pricing &amp; terms</a></small>
        </div>
        <button className={wall.replayButton} onClick={onReplay}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></svg>Replay the studio visit</button>
      </footer>
    </div>
    {selected && createPortal(<FeatureDetail feature={selected} onClose={()=>setSelected(null)} scrollRoot={scrollRoot}/>, document.body)}
  </section>;
}
