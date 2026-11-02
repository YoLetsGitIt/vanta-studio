import assert from 'node:assert/strict';
import { createScrollPlayhead } from '../components/studio-cinematic/scroll-playhead.js';

for (const fps of [30,60,120]) {
  const head=createScrollPlayhead(), dt=1000/fps;
  let now=0,target=0,result;
  head.update(0,now,844);
  for(const speed of [120,600,2400,4000,600,120,-120,-4000]) {
    for(let i=0;i<fps/4;i++){
      now+=dt;target+=speed/fps;
      result=head.update(target,now,844);
      assert.equal(result.position,target,'Speed changes never change input-to-scene tracking');
      assert(result.settled,'No animation backlog remains after native scrolling');
    }
  }
  result=head.update(target,now+=dt,844);
  assert.equal(result.position,target,'Stopping has no residual drift');
  result=head.update(3500,now+=dt,844);
  assert(result.fast&&result.settled);
  assert.equal(result.position,3500,'A fast swipe skips straight to its destination');
  result=head.update(400,now+=dt,844);
  assert.equal(result.position,400,'Reversing never briefly continues in the old direction');
  result=head.update(2600,now+=dt,844,{motion:false});
  assert.equal(result.position,2600);assert(!result.fast);
}
const head=createScrollPlayhead();head.update(0,0,844);
assert.equal(head.update(2500,16,844,{scripted:true}).position,2500,'Button easing is not eased a second time');
assert(!head.update(3000,32,844,{scripted:true}).fast);
assert.equal(head.update(4500,400,844,{contentStart:4000}).position,4500,'Feature reading uses the same native position');
console.log('PASS direct scroll tracking, speed changes, reversal, zero drift, 30/60/120Hz, button travel and reduced motion');
