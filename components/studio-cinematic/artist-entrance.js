import route from './artist-camera-path.json' with { type: 'json' };

// Dedicated doorway-to-station renders: no reception camera or timed stop.
export const ARTIST_ENTRANCE_MS=2600;
const clamp=n=>Math.max(0,Math.min(1,n));
export function artistEntranceFrame(progress){
  const n=Math.round(clamp(progress)*route.frameCount);
  return n?route.firstFrame+n-1:0;
}
export const artistEntranceProgress=frame=>frame>=route.firstFrame?clamp((frame-route.firstFrame+1)/route.frameCount):0;
