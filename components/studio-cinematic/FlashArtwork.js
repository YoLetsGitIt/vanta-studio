import { useId } from 'react';

// Original flash sheet used by the framed prints in the rendered studio.
// SVG view boxes frame each motif without downloading nine separate images.
// These crops match the UV rectangles in build_scene.py (UV Y runs upward).
// Keep the same tattoo throughout the lift and the final feature-card artwork.
const PRINTS = {
  forms: '0 0 317.44 1090.56',
  branding: '593.92 0 430.08 706.56',
  schedule: '655.36 1075.2 368.64 460.8',
  consent: '0 1013.76 337.92 522.24',
  clients: '317.44 1029.12 348.16 506.88',
  artists: '552.96 706.56 471.04 445.44',
  analytics: '276.48 491.52 327.68 660.48',
  languages: '0 0 1024 1536',
  migration: '337.92 0 481.28 506.88',
};

export default function FlashArtwork({ id }) {
  const clipId=useId();
  const [x,y,width,height]=PRINTS[id].split(' ');
  return <svg viewBox={PRINTS[id]} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs><clipPath id={clipId}><rect x={x} y={y} width={width} height={height}/></clipPath></defs>
    <image href="/studio/flash-sheet.webp" width="1024" height="1536" clipPath={`url(#${clipId})`} />
  </svg>;
}
