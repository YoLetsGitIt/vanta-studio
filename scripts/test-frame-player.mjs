// Resource and interaction regressions for the rendered walkthrough, without a GPU.
import assert from 'node:assert/strict';
const {createFramePlayer,frameForProgress,artistFrame}=await import(new URL('../components/studio-cinematic/frame-player.js',import.meta.url));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
let animationId=0, snapshots=0;
const animations=new Map();
globalThis.requestAnimationFrame=fn=>{animations.set(++animationId,fn);return animationId;};
globalThis.cancelAnimationFrame=id=>animations.delete(id);
const finishBlend=()=>{const jobs=[...animations.values()];animations.clear();jobs.forEach(fn=>fn(performance.now()+200));};
const settle=async()=>{for(let i=0;i<40;i++)await tick();finishBlend();};
let size={width:390,height:844},resize,requests=[],live=0,peak=0,painted;
const failures=new Set();
const listeners=new Map();
globalThis.window={devicePixelRatio:2,addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){snapshots++;}})}),hidden:false,addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)};
globalThis.ResizeObserver=class{constructor(fn){resize=fn;}observe(){}disconnect(){}};
globalThis.fetch=async(url,{signal})=>{
 requests.push(url);await tick();if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 return {ok:!failures.has(url.split('/').at(-1)),blob:async()=>url};
};
globalThis.createImageBitmap=async(url)=>{
 live++;peak=Math.max(peak,live);
 return {width:url.includes('portrait')?720:1280,height:url.includes('portrait')?1100:800,url,close(){live--;}};
};
const canvas={dataset:{},style:{},getBoundingClientRect:()=>size,getContext:()=>({drawImage(bitmap){if(bitmap.url)painted=bitmap.url;},save(){},beginPath(){},moveTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));},lineTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));},closePath(){},fill(){},restore(){}})};
const player=createFramePlayer(canvas);await settle();
assert.equal(canvas.dataset.frame,'0');assert.equal(canvas.dataset.variant,'portrait');
assert(requests.length<=18,'Initial load must not fetch the full sequence');
assert(requests.every(url=>url.includes('/portrait/')),'Only the current orientation should download');
for(const frame of [17,40,75,119,33,58,121,136,152,136,121,58]){player.seek(frame);await settle();assert.equal(canvas.dataset.frame,String(frame));}
const beforeSmall=snapshots;player.seek(59);await settle();
assert.equal(snapshots,beforeSmall,'An adjacent camera frame should not dissolve');
player.seek(120);for(let i=0;i<40;i++)await tick();
assert(animations.size===1,'A large camera jump starts one short dissolve');
assert(snapshots>beforeSmall);finishBlend();assert.equal(animations.size,0,'The dissolve finishes without ongoing drift');
const beforeReduced=snapshots;player.seek(0,false);await settle();
assert.equal(snapshots,beforeReduced,'Reduced motion uses an immediate still');
const restingCount=requests.length;await settle();assert.equal(requests.length,restingCount,'Idle cache must not refetch evicted chapter stills forever');
assert(peak<=23,`Decoded image memory is bounded: peak ${peak}`);
player.seek(120);player.seek(3);player.seek(97);await settle();assert.equal(canvas.dataset.frame,'97','Latest rapid scroll wins');
size={width:844,height:390};resize();await settle();assert.equal(canvas.dataset.variant,'landscape');assert(painted.includes('/landscape/0097.webp'));
size={width:1250,height:1000};resize();await settle();assert.equal(canvas.dataset.variant,'portrait','Narrow desktop windows must keep the doorway in view');
player.seek(58,false);await settle();assert.equal(canvas.dataset.frame,'58');
player.dispose();await settle();assert.equal(live,0,'All decoded bitmaps must be released');assert.equal(listeners.size,0);assert.equal(animations.size,0,'Disposal cancels transitions');
failures.add('0058.webp');const recovery=createFramePlayer(canvas);await settle();recovery.seek(58,false);await settle();assert.notEqual(canvas.dataset.frame,'58');
failures.clear();listeners.get('online')();await settle();assert.equal(canvas.dataset.frame,'58','Reconnect should retry previously failed frames');
document.hidden=true;const beforeHidden=requests.length;recovery.seek(80);await settle();assert.equal(requests.length,beforeHidden,'Hidden pages should not start frame requests');
document.hidden=false;listeners.get('visibilitychange')();await settle();assert.equal(canvas.dataset.frame,'80');recovery.dispose();await settle();assert.equal(live,0);
// The tablet is a side branch, so numeric frame order reverses on leaving it.
assert.equal(frameForProgress(.16),58);assert.equal(frameForProgress(.225),152);
assert.equal(frameForProgress(.27),152);assert.equal(frameForProgress(.865),152);
assert.equal(frameForProgress(.915),58);assert.equal(frameForProgress(.98),120);
for(let i=0;i<=1000;i++)assert(frameForProgress(i/1000)>=0&&frameForProgress(i/1000)<=152);
for(const [start,end,direction] of [[0,.225,1],[.865,.915,-1],[.915,1,1]]){
 let previous=frameForProgress(start);
 for(let i=1;i<=100;i++){const next=frameForProgress(start+(end-start)*i/100);assert((next-previous)*direction>=0);previous=next;}
}
assert.equal(frameForProgress(.05,false),0);assert.equal(frameForProgress(.5,false),58);assert.equal(frameForProgress(.95,false),120);
console.log('PASS camera continuity, reception hold, bounded fetch/decode cache, rapid reversal, orientation switching, network recovery, hidden-page suspension and cleanup');

// A cold-cache fling must request the destination before slow preload requests
// finish. Simulate a fetch that ignores abort until its response resolves.
const deferred=[];
globalThis.fetch=(url,{signal})=>new Promise(resolve=>deferred.push({url,signal,resolve}));
const jumping=createFramePlayer(canvas);
jumping.seek(80);jumping.seek(140);
assert(deferred.some(r=>r.url.endsWith('/0140.webp')&&!r.signal.aborted),'Latest destination must start immediately');
assert(deferred.some(r=>r.url.endsWith('/0080.webp')&&r.signal.aborted),'Skipped destination must be cancelled');
const destination=deferred.find(r=>r.url.endsWith('/0140.webp')&&!r.signal.aborted);
destination.resolve({ok:true,blob:async()=>destination.url});await tick();await tick();
assert.equal(canvas.dataset.frame,'140');
jumping.dispose();
for(const r of deferred)r.resolve({ok:true,blob:async()=>r.url});
await settle();assert.equal(live,0,'Late aborted decodes must be released');
console.log('PASS slow-network jump priority, cancelled preloads and late-response cleanup');

// The artist walk is a second side branch from reception: stepping onto it must
// not dissolve, and its preload window must stay on the branch.
globalThis.fetch=async(url,{signal})=>{requests.push(url);await tick();if(signal.aborted)throw new DOMException('Cancelled','AbortError');return {ok:true,blob:async()=>url};};
assert.equal(artistFrame(0),58);assert.equal(artistFrame(1/144),153);assert.equal(artistFrame(1),296);assert.equal(artistFrame(1.5),308);assert.equal(artistFrame(2),320);assert.equal(artistFrame(3),320);
for(let i=1;i<=200;i++)assert(artistFrame(i/100)>=artistFrame((i-1)/100));
for(let i=0;i<=200;i++)assert(Number.isInteger(artistFrame(i/100)),'Whole frames only, like the owner walk');
const walker=createFramePlayer(canvas);walker.seek(58);await settle();
const beforeWalk=snapshots;requests=[];walker.seek(153);await settle();
assert.equal(canvas.dataset.frame,'153');assert.equal(snapshots,beforeWalk,'Leaving reception for the stool is one camera step');
assert(requests.every(url=>!/\/(01[2-4]\d|015[0-2])\.webp$/.test(url)),'Artist preloads must not fetch the tablet branch');
for(const frame of [170,296,320,308,176,153,58]){walker.seek(frame);await settle();assert.equal(canvas.dataset.frame,String(frame));}
// Warming fetches compressed frames ahead, and seeking later reuses them.
requests=[];walker.warm(210,215);await settle();
assert.deepEqual(requests.filter(u=>/02(1[0-5])\.webp$/.test(u)).length,6);
const warmedRequests=requests.length;walker.seek(213);await settle();
assert(!requests.slice(warmedRequests).some(u=>u.endsWith('/0213.webp')),'Warmed frame is not downloaded twice');
walker.seek(152);for(let i=0;i<40;i++)await tick();assert.equal(animations.size,1,'Switching side branches crosses reception, so it dissolves');
walker.dispose();await settle();assert.equal(live,0);
console.log('PASS artist stool branch continuity, branch-local preloading and cleanup');

const directWalker=createFramePlayer(canvas);await settle();
const initialBlends=snapshots;directWalker.seek(321);await settle();
assert.equal(canvas.dataset.frame,'321');assert.equal(snapshots,initialBlends,'Direct route starts at the doorway without a crossfade');
for(const frame of [334,354,380,406,440]){directWalker.seek(frame);await settle();assert.equal(canvas.dataset.frame,String(frame));}
const finalBlends=snapshots;directWalker.seek(296);await settle();
assert.equal(snapshots,finalBlends,'Direct route meets the seated artist view without a crossfade');
directWalker.dispose();await settle();assert.equal(live,0);
console.log('PASS direct artist route and seated handoff');

// A long timed move that outruns the network must keep downloads still ahead
// of the frame on screen, rather than cancelling each one for the next target.
const slow=[];
globalThis.fetch=async(url,{signal})=>{if(slow.on)return new Promise(resolve=>slow.push({url,signal,resolve}));requests.push(url);await tick();return {ok:true,blob:async()=>url};};
const mover=createFramePlayer(canvas);mover.seek(153);await settle();assert.equal(canvas.dataset.frame,'153');
slow.on=true;for(let f=160;f<=200;f++)mover.seek(f);
const early=slow[0], earlyFrame=early.url.match(/(\d+)\.webp$/)[1].replace(/^0+/,'');
assert(Number(earlyFrame)>153&&Number(earlyFrame)<200);
assert(!early.signal.aborted,'A frame between the shown one and the target keeps downloading');
early.resolve({ok:true,blob:async()=>early.url});await tick();await tick();await tick();
assert.equal(canvas.dataset.frame,earlyFrame,'The camera advances to it while the target is still loading');
mover.dispose();for(const r of slow)r.resolve({ok:true,blob:async()=>r.url});await settle();assert.equal(live,0);
console.log('PASS long moves keep advancing on slow networks');
