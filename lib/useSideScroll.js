'use client';

import { useEffect, useState } from 'react';

// A row that scrolls sideways (filter chips, tabs) without a visible scrollbar. Touch
// swipes it natively; this adds the same for a mouse: the wheel scrolls it sideways while
// there's more to see that way, and it can be dragged. A drag doesn't count as a click.
// Returns a callback ref for the scrolling element (it can appear and go, e.g. sub-filters).
export function useSideScroll() {
  const [el, setEl] = useState(null);
  useEffect(() => {
    if (!el) return undefined;
    // A row that snaps (e.g. by week) would jump back on each small wheel step or drag
    // move: snapping is off while it moves and comes back (settling it) once it stops.
    const snap = getComputedStyle(el).scrollSnapType;
    let settle = null;
    function pauseSnap() {
      if (!snap || snap === 'none') return;
      el.style.scrollSnapType = 'none';
      clearTimeout(settle);
      settle = setTimeout(() => { el.style.scrollSnapType = ''; }, 160);
    }
    function onWheel(event) {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return; // pinch, or already sideways
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, el.scrollLeft + event.deltaY));
      if (next === el.scrollLeft) return; // at the end: let the page scroll
      event.preventDefault();
      pauseSnap();
      el.scrollLeft = next;
    }
    let drag = null;
    let dragged = false;
    function onPointerDown(event) {
      if (event.pointerType !== 'mouse' || event.button !== 0 || el.scrollWidth <= el.clientWidth) return;
      drag = { x: event.clientX, left: el.scrollLeft };
      dragged = false;
    }
    function onPointerMove(event) {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (!dragged && Math.abs(dx) < 5) return;
      dragged = true;
      pauseSnap();
      el.scrollLeft = drag.left - dx;
    }
    function onPointerUp() { drag = null; }
    function onClick(event) {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('click', onClick, true);
    return () => {
      clearTimeout(settle);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('click', onClick, true);
    };
  }, [el]);
  return setEl;
}
