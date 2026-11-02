'use client';

import { useEffect, useRef } from 'react';
import styles from './cinematic.module.css';

function AudienceChoice({ artist = false, onClick }) {
  return <button className={styles.audienceChoice} data-role={artist ? 'artist' : 'owner'} onClick={onClick} aria-label={artist ? 'I’m an artist' : 'I’m a studio owner'}>
    <span className={styles.choiceSurface} aria-hidden="true"/>
    <svg className={styles.choiceFrame} viewBox="0 0 400 160" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path d="M1 1h379l19 19v139H20L1 140Z"/>
      <path className={styles.choiceEdge} d="M20 7h88M393 52v78"/>
    </svg>
    <span className={styles.choiceLabel}><small>{artist ? 'I’M AN' : 'I’M A'}</small><strong>{artist ? 'Artist' : 'Studio owner'}</strong></span>
    <svg className={styles.choiceIcon} viewBox="0 0 40 48" fill="none" aria-hidden="true">
      {artist ? <>
        <path d="M16 7h8l4 6-3 20H15l-3-20ZM13 14h14M14 19h12M15 24h10M17 33l3 11 3-11M20 3v4"/>
        <path className={styles.choiceIconDetail} d="M7 9v6M4 12h6M33 29v6M30 32h6"/>
      </> : <>
        <path d="M5 17V9l15-5 15 5v8M7 20v23h26V20M3 43h34M16 43V29a4 4 0 0 1 8 0v14M5 17h30"/>
        <path className={styles.choiceIconDetail} d="M11 23h2M27 23h2M13 12h14"/>
      </>}
    </svg>
  </button>;
}

export default function StudioAudience({ open, onChoose, onBack, navigation }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if(open) dialogRef.current.querySelector('h2')?.focus({preventScroll:true});
  }, [open]);
  // Choosing walks into the studio; the artist tour itself lives in ArtistVisit.
  return <dialog ref={dialogRef} className={styles.audienceDialog} aria-labelledby="audience-heading" onCancel={event => { event.preventDefault(); onBack(); }}>
    {open&&navigation}
    <div className={styles.audiencePanel}>
    <h2 id="audience-heading" tabIndex={-1} className={styles.audienceHidden}>Choose your Vanta experience</h2>
    <div className={styles.audienceChoices}>
      <AudienceChoice onClick={() => onChoose('owner')} />
      <AudienceChoice artist onClick={() => onChoose('artist')} />
    </div>
    </div>
  </dialog>;
}
