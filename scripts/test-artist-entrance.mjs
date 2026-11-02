import assert from 'node:assert/strict';
import {artistEntranceFrame,artistEntranceProgress,ARTIST_ENTRANCE_MS} from '../components/studio-cinematic/artist-entrance.js';
import route from '../components/studio-cinematic/artist-camera-path.json' with {type:'json'};
const last=route.firstFrame+route.frameCount-1;
const samples=Array.from({length:Math.ceil(ARTIST_ENTRANCE_MS/16)+1},(_,i)=>artistEntranceFrame(i*16/ARTIST_ENTRANCE_MS));
assert.equal(samples[0],0);assert.equal(samples.at(-1),last);
assert(samples.every((f,i)=>!i||f>=samples[i-1]),'The entrance never reverses');
assert(samples.every(f=>f===0||f>=route.firstFrame),'No reception or greeting frames');
for(let frame=route.firstFrame;frame<=last;frame++)assert.equal(artistEntranceFrame(artistEntranceProgress(frame)),frame);
// Approach looks along the aisle, not toward the reception tablet to the left.
for(const [frame,eye,target] of route.stops.filter(([f])=>f<=34)){
 assert(target[0]>=eye[0],`Frame ${frame} must not pivot left toward reception`);
 assert(target[1]>eye[1]);
}
const atReception=route.stops.find(([f])=>f===34);
assert(atReception[1][0]>.3,'Camera stays in the aisle alongside reception');
assert.deepEqual(route.stops.at(-1).slice(1),[[1.15,8.6,1.2],[-1.3,11,1.3]],'Match the existing seated phone camera');
console.log('PASS direct artist camera: aisle sightline, no reception frames, seated continuity');
