import { sceneVariant } from './scene-framing.js';
import doorProjection from './door-projection.json' with { type: 'json' };
import { createReceptionist } from './receptionist.js';
import artistCamera from './artist-camera-path.json' with { type: 'json' };

// 0..120: door/reception/workspace. 121..152: a reversible tablet approach and
// 153..320: reception-to-stool and seated phone. 321..440: the public artist's
// direct doorway-to-stool route. All paths share the same Blender scene.
export const RECEPTION_FRAME = 58, ARTIST_FIRST = 153, ARTIST_SEATED = 296;
export const DIRECT_FIRST=artistCamera.firstFrame, LAST_FRAME=DIRECT_FIRST+artistCamera.frameCount-1;
const WALK_FRAMES = ARTIST_SEATED-ARTIST_FIRST+1, LOOK_FRAMES = 320-ARTIST_SEATED;
const BRANCHES = [[0, 120], [121, 152], [ARTIST_FIRST, 320], [DIRECT_FIRST,LAST_FRAME]];
const branchOf = frame => BRANCHES.findIndex(([, last]) => frame <= last);
// Camera steps from reception along whichever branch holds the frame.
const fromReception = frame => branchOf(frame) ? frame-BRANCHES[branchOf(frame)][0]+1 : Math.abs(frame-RECEPTION_FRAME);

// 0..1 walks from reception to the stool, 1..2 looks down at the phone.
export function artistFrame(progress) {
  const p = Math.max(0, Math.min(2, progress));
  if (p > 1) return ARTIST_SEATED+Math.round((p-1)*LOOK_FRAMES);
  const n = Math.round(p*WALK_FRAMES);
  return n ? ARTIST_FIRST-1+n : RECEPTION_FRAME;
}

export function frameForProgress(progress, motion = true) {
  const p = Math.max(0, Math.min(1, progress));
  if (!motion) return p < .10 ? 0 : p < .90 ? 58 : 120;
  const tablet = t => { const n = Math.round(Math.max(0, Math.min(1, t))*32); return n ? 120+n : 58; };
  if (p <= .16) return Math.round(p / .16 * 58);
  if (p <= .225) return tablet((p-.16)/.065);
  if (p <= .865) return 152;
  if (p <= .915) return tablet(1-(p-.865)/.05);
  return Math.round(58 + Math.min(1, (p - .915) / .065) * 62);
}

export function createFramePlayer(canvas, { receptionist = false } = {}) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return { seek() {}, dispose() {} };
  const cache = new Map(), pending = new Map(), failed = new Set();
  let disposed = false, variant = '', wanted = 0, shown = -1, moving = true;
  // Compressed frames fetched ahead of a timed camera move, decoded on demand.
  let warmed = new Map(), warmController = new AbortController();
  let generation = 0, width = 1, height = 1, lastWanted = 0, direction = 1;
  const maxDecoded = 20, maxConcurrent = 3;
  const previousView=document.createElement('canvas');
  const previousContext=previousView.getContext('2d',{alpha:false});
  let blendStart=null, blendFrame=0;
  const blendDuration=160;
  const host=receptionist?createReceptionist(()=>drawCurrent()):null;
  // Side branches start at reception, not at the preceding numeric frame.
  const cameraDistance=(a,b)=>{
    if(branchOf(a)===branchOf(b))return Math.abs(a-b);
    const direct=a>=DIRECT_FIRST?a:b>=DIRECT_FIRST?b:null,other=direct===a?b:a;
    if(direct!==null&&other===0)return direct-DIRECT_FIRST+1;
    if(direct!==null&&other===ARTIST_SEATED)return LAST_FRAME-direct;
    return fromReception(a)+fromReception(b);
  };

  function cancelBlend() {
    cancelAnimationFrame(blendFrame);blendFrame=0;blendStart=null;
  }

  function drawCurrent(now=performance.now()) {
    const bitmap=cache.get(shown);
    if(disposed||!bitmap)return;
    drawScene(bitmap,shown);
    if(blendStart!==null){
      const progress=Math.min(1,(now-blendStart)/blendDuration);
      const eased=progress*progress*(3-2*progress);
      context.save();context.globalAlpha=1-eased;
      context.drawImage(previousView,0,0,width,height);context.restore();
      if(progress<1)blendFrame=requestAnimationFrame(drawCurrent);
      else {blendStart=null;blendFrame=0;}
    }
  }

  function paint() {
    if (disposed || document.hidden) return;
    let frame = wanted;
    if (!cache.has(frame)) {
      // While moving, never stand in with a frame the camera has not reached yet:
      // showing it and then the wanted frame would step backwards.
      const candidates = [...cache.keys()].filter(n => branchOf(n)===branchOf(wanted) && !(moving && (n-wanted)*direction>0)).sort((a, b) => Math.abs(a-wanted)-Math.abs(b-wanted));
      // Normally only a near neighbour stands in. When a long move outruns the
      // network, still advance to any frame closer than the one on screen.
      const gaining = shown>=0 && branchOf(shown)===branchOf(wanted) && candidates.length && Math.abs(candidates[0]-wanted)<Math.abs(shown-wanted);
      if (!candidates.length || Math.abs(candidates[0]-wanted) > 4 && !gaining) return;
      frame = candidates[0];
    }
    // A late nearby decode must not replace a frame already closer to the
    // requested position. This also avoids repainting for unrelated preloads.
    if(frame===shown)return;
    if(frame!==wanted && shown>=0 && branchOf(shown)===branchOf(wanted)
      && Math.abs(shown-wanted)<=Math.abs(frame-wanted))return;
    const dissolve=moving&&shown>=0&&previousContext&&(blendStart!==null||cameraDistance(shown,frame)>=10);
    cancelAnimationFrame(blendFrame);blendFrame=0;
    if(dissolve){
      previousView.width=width;previousView.height=height;
      previousContext.drawImage(canvas,0,0);blendStart=performance.now();
    }else blendStart=null;
    shown=frame;drawCurrent();
    canvas.dataset.frame=String(frame);canvas.dataset.variant=variant;
    canvas.style.opacity='1';
  }

  function drawScene(bitmap,frame) {
    const scale = Math.max(width/bitmap.width, height/bitmap.height);
    context.drawImage(bitmap, (width-bitmap.width*scale)/2, (height-bitmap.height*scale)/2, bitmap.width*scale, bitmap.height*scale);
    host?.draw(context,frame,variant,width,height);
    // Finish the glass itself, using its authored camera projection. Painting
    // against the shown frame keeps the tint attached even on slow connections.
    const door = doorProjection[variant];
    const polygon = door?.frames[frame];
    if (polygon?.length >= 3) {
      const cover = Math.max(width/door.width, height/door.height);
      const x = (width-door.width*cover)/2, y = (height-door.height*cover)/2;
      context.save();context.beginPath();
      polygon.forEach(([px,py],i)=>context[i?'lineTo':'moveTo'](x+px*cover,y+py*cover));
      context.closePath();context.fillStyle='rgba(28, 34, 30, 0.78)';context.fill();context.restore();
    }
  }

  function trim() {
    if (cache.size <= maxDecoded) return;
    const keep=new Set(desiredFrames());
    const farthest = [...cache.keys()].filter(n=>n!==wanted&&n!==shown).sort((a,b)=>Number(keep.has(a))-Number(keep.has(b))||Math.abs(b-wanted)-Math.abs(a-wanted));
    while(cache.size>maxDecoded&&farthest.length){const n=farthest.shift();cache.get(n).close();cache.delete(n);}
  }

  function desiredFrames() {
    const list=[wanted,0,58,120,152];
    if(moving) for(let n=1;n<=7;n++) {
      for(const frame of [wanted+n*direction,wanted-n*direction]) {
        if(frame>=0&&branchOf(frame)===branchOf(wanted)) list.push(frame);
      }
    }
    // Chapter stills allow jumps without fetching the entire film.
    return [...new Set(list)];
  }

  function pump() {
    if(disposed||document.hidden) return;
    for(const frame of desiredFrames().filter(n=>!cache.has(n)&&!pending.has(n)&&!failed.has(n))) {
      if(pending.size>=maxConcurrent) break;
      const controller=new AbortController(), stamp=generation;
      pending.set(frame,controller);
      (warmed.get(frame)||download(frame,controller.signal))
        .then(blob=>createImageBitmap(blob))
        .then(bitmap=>{
          if(disposed||stamp!==generation||controller.signal.aborted){bitmap.close();return;}
          cache.set(frame,bitmap);paint();trim();
        })
        .catch(error=>{if(stamp===generation&&!controller.signal.aborted&&error.name!=='AbortError')failed.add(frame);})
        .finally(()=>{if(stamp===generation&&pending.get(frame)===controller){pending.delete(frame);pump();}});
    }
  }

  function download(frame, signal) {
    return fetch(`/studio/walkthrough/${variant}/${String(frame).padStart(4,'0')}.webp`,{signal})
      .then(response=>{if(!response.ok)throw new Error('Frame unavailable');return response.blob();});
  }

  // Fetch a range in camera order, a few at a time, without decoding it yet.
  function warm(first, last) {
    const queue=[];
    for(let n=first;n<=last;n++)if(!warmed.has(n)&&!cache.has(n))queue.push(n);
    const signal=warmController.signal;
    const next=()=>{
      const frame=queue.shift();
      if(frame===undefined||signal.aborted||disposed)return;
      const request=download(frame,signal);
      warmed.set(frame,request);
      request.catch(()=>{if(warmed.get(frame)===request)warmed.delete(frame);}).finally(next);
    };
    for(let i=0;i<4;i++)next();
  }

  function forgetWarm() {
    warmController.abort();warmController=new AbortController();warmed=new Map();
  }

  function resize() {
    const rect=canvas.getBoundingClientRect();
    const next=sceneVariant(rect.width,rect.height);
    const ratio=Math.min(window.devicePixelRatio||1,1.5,1600/Math.max(rect.width,rect.height));
    width=Math.max(1,Math.round(rect.width*ratio));height=Math.max(1,Math.round(rect.height*ratio));
    cancelBlend();shown=-1;
    canvas.width=width;canvas.height=height;
    if(next!==variant){
      generation++;pending.forEach(c=>c.abort());pending.clear();cache.forEach(b=>b.close());cache.clear();failed.clear();forgetWarm();
      variant=next;shown=-1;canvas.style.opacity='0';
    }
    paint();pump();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  const visibility=()=>{if(document.hidden){cancelBlend();}else{drawCurrent();paint();pump();}};
  const online=()=>{failed.clear();pump();};
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('online',online);
  resize();
  return {
    seek(frame, motion=true) {
      const next=Math.max(0,Math.min(LAST_FRAME,Math.round(frame)));
      if(next!==lastWanted)direction=next>lastWanted?1:-1;
      lastWanted=next;wanted=next;moving=motion;
      if(!motion&&blendStart!==null){cancelBlend();drawCurrent();}
      if(shown!==wanted)paint();
      // Do not let obsolete downloads delay the frame requested by a fast swipe.
      const priority=desiredFrames(), useful=new Set(priority);
      // Keep downloads the camera is still moving toward from the frame on screen.
      const between=frame=>shown>=0&&branchOf(frame)===branchOf(wanted)&&branchOf(shown)===branchOf(wanted)&&(frame-shown)*(wanted-frame)>0;
      for(const [frame,controller] of pending){
        if(!useful.has(frame)&&!(moving&&between(frame))){controller.abort();pending.delete(frame);}
      }
      if(!cache.has(wanted)&&!pending.has(wanted)&&pending.size>=maxConcurrent){
        // Make room for the destination, but never by cancelling a frame still
        // ahead of the one on screen: during a long move the destination keeps
        // advancing, and cancelling those would mean nothing ever arrives.
        const stale=[...pending.keys()].filter(frame=>!(moving&&between(frame)))
          .sort((a,b)=>priority.indexOf(b)-priority.indexOf(a))[0];
        if(stale!==undefined){pending.get(stale).abort();pending.delete(stale);}
      }
      pump();
    },
    warm,
    dispose() {
      host?.dispose();
      disposed=true;generation++;forgetWarm();cancelBlend();previousView.width=previousView.height=1;observer.disconnect();document.removeEventListener('visibilitychange',visibility);
      window.removeEventListener('online',online);
      pending.forEach(c=>c.abort());pending.clear();cache.forEach(b=>b.close());cache.clear();
    },
  };
}
