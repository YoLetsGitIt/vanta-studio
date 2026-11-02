// Camera, copy and artwork share the native scroll position. The browser already
// supplies touch/trackpad momentum; another easing layer makes the scene trail
// behind the gesture and changes its response when a velocity threshold is hit.
// Only explicit button navigation applies easing, in CinematicJourney.travelTo.
export function createScrollPlayhead() {
  let lastTarget = 0, lastTime = null, fastUntil = 0;
  return {
    update(target, now, viewport, { motion = true, scripted = false } = {}) {
      const elapsed = lastTime === null ? 1/60 : Math.max(1/240, Math.min((now-lastTime)/1000, .064));
      const change = target-lastTarget;
      const speed = Math.abs(change)/elapsed;
      if (motion && !scripted && (Math.abs(change)>viewport*.65 || speed>Math.max(2500,viewport*3))) {
        fastUntil = now+140;
      }
      // Fast input can suppress decorative entrances, but never changes the
      // relationship between scroll distance and visual progress.
      const fast = motion && !scripted && now<fastUntil;
      lastTarget=target;lastTime=now;
      return { position: target, fast, settled: true };
    },
  };
}
