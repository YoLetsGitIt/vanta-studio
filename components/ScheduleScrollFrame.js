'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import styles from './ScheduleScrollFrame.module.css';

const ControlsCollapsed = createContext(false);
const THRESHOLD = 12;

// Whether the calendar has been scrolled down (its controls make room).
export function useControlsCollapsed() {
  return useContext(ControlsCollapsed);
}

// fold: the controls slide away with the calendar (see foldHeader) instead of hiding.
export function ScheduleControls({ children, fold = false }) {
  const collapsed = useContext(ControlsCollapsed);
  if (fold) return <div className={styles.foldControls} data-fold-header>{children}</div>;
  return (
    <div className={styles.controls} data-collapsed={collapsed || undefined} inert={collapsed || undefined}>
      <div className={styles.controlsInner}>{children}</div>
    </div>
  );
}

// foldHeader (a phone): the header doesn't hide and come back on a timer. The part above
// its [data-fold-keep] (the dates) moves up with the calendar as it's scrolled, exactly as
// far, and comes back only as the calendar nears its top, again in step with it. The
// calendar lies under the header and never changes size, so nothing jumps; its sticky
// headings sit under what's left of the header (--fold-left).
export default function ScheduleScrollFrame({ children, resetKey, style, foldHeader = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!foldHeader) return undefined;
    const container = root.current;
    let fold = 0, shift = 0, intent = null;
    const last = new WeakMap();
    const header = () => container.querySelector(':scope > [data-fold-header]');
    const isScroller = el => el instanceof Element && el.classList.contains('studio-calendar-scroll');
    function paint(scroller) {
      const head = header();
      if (head) head.style.transform = shift ? `translate3d(0, ${-shift}px, 0)` : '';
      if (scroller) scroller.style.setProperty('--fold-left', `${fold - shift}px`);
      setCollapsed(fold > 0 && shift >= fold);
    }
    function measure() {
      const head = header(), keep = head?.querySelector('[data-fold-keep]');
      fold = head && keep ? Math.max(0, Math.round(keep.getBoundingClientRect().top - head.getBoundingClientRect().top)) : 0;
      container.style.setProperty('--fold-h', `${fold}px`);
      shift = Math.min(shift, fold);
      for (const el of container.querySelectorAll('.studio-calendar-scroll')) el.style.setProperty('--fold-left', `${fold - shift}px`);
      paint();
    }
    // Only scrolling the person does moves the header (not the calendar opening at 7am).
    // A wheel event can arrive just after the scroll it caused: it claims that scroll.
    let unclaimed = null;
    function arm(event) {
      if (event.type === 'wheel' && Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const scroller = event.target instanceof Element && !event.target.closest('[role="dialog"]') ? event.target.closest('.studio-calendar-scroll') : null;
      if (!scroller) return;
      intent = { scroller, until: performance.now() + 1500 };
      const late = event.type === 'wheel' && unclaimed?.scroller === scroller && performance.now() - unclaimed.at < 250;
      // Scroll events keep `last` current; the scroller may already have moved for this
      // wheel (passive events are handed over after scrolling starts).
      if (late) last.set(scroller, unclaimed.from);
      else if (!last.has(scroller)) last.set(scroller, Math.max(0, scroller.scrollTop));
      unclaimed = null;
      if (late) move(scroller);
    }
    const topOf = scroller => Math.max(0, Math.min(scroller.scrollTop, scroller.scrollHeight - scroller.clientHeight));
    function move(scroller) {
      const top = topOf(scroller);
      const previous = last.has(scroller) ? last.get(scroller) : top;
      last.set(scroller, top);
      // Down: away by as far as it scrolled. Up: back only within the header's height of
      // the top, so it is fully back exactly as the calendar reaches its top.
      const next = top > previous ? Math.min(fold, shift + top - previous) : Math.min(shift, top);
      if (next === shift) return;
      shift = next;
      paint(scroller);
    }
    function scroll(event) {
      const scroller = event.target;
      if (!isScroller(scroller)) return;
      if (intent?.scroller !== scroller || performance.now() > intent.until) {
        if (unclaimed?.scroller !== scroller || performance.now() - unclaimed.at > 250) unclaimed = { scroller, from: last.has(scroller) ? last.get(scroller) : 0, at: performance.now() };
        last.set(scroller, topOf(scroller));
        return;
      }
      intent.until = performance.now() + 1500; // momentum after the finger lifts
      move(scroller);
    }
    measure();
    const resize = new ResizeObserver(measure);
    const head = header();
    if (head) resize.observe(head);
    // Note where a calendar is before it's scrolled (a pointer coming over it comes first).
    function seen(event) {
      const scroller = event.target instanceof Element ? event.target.closest('.studio-calendar-scroll') : null;
      if (scroller && !last.has(scroller)) last.set(scroller, topOf(scroller));
    }
    const listeners = { pointerover: seen, focusin: seen, wheel: arm, pointerdown: arm, touchstart: arm, keydown: arm, scroll };
    for (const [name, handler] of Object.entries(listeners)) container.addEventListener(name, handler, { capture: true, passive: true });
    return () => {
      resize.disconnect();
      for (const [name, handler] of Object.entries(listeners)) container.removeEventListener(name, handler, true);
      shift = 0;
      const h = header();
      if (h) h.style.transform = '';
      for (const el of container.querySelectorAll('.studio-calendar-scroll')) el.style.removeProperty('--fold-left');
      setCollapsed(false);
    };
  }, [resetKey, foldHeader]);

  useEffect(() => {
    if (foldHeader) return undefined;
    setCollapsed(false);
    let intent = null;
    let touch = null;
    const container = root.current;
    // Scrolling inside a pop-up (like the "+N" list) isn't scrolling the calendar.
    const scrollerFor = event => event.target instanceof Element && !event.target.closest('[role="dialog"]') ? event.target.closest('.studio-calendar-scroll') : null;
    function arm(scroller, source = 'scroll') {
      if (!scroller) return;
      const now = performance.now();
      if (intent?.scroller !== scroller || now > intent.until || intent.source !== source) {
        intent = { scroller, source, top: scroller.scrollTop, height: scroller.clientHeight, direction: 0, distance: 0 };
      }
      intent.until = now + 1500;
    }
    function wheel(event) {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const scroller = scrollerFor(event);
      arm(scroller, 'wheel');
      if (!scroller) return;
      if (scroller.scrollTop <= 4 && event.deltaY < 0) setCollapsed(false);
      if (scroller.scrollHeight <= scroller.clientHeight) return;
      // Passive wheel events can arrive after the compositor has already scrolled.
      const direction = Math.sign(event.deltaY);
      intent.distance = intent.direction === direction ? intent.distance + Math.abs(event.deltaY) : Math.abs(event.deltaY);
      intent.direction = direction;
      if (intent.distance >= THRESHOLD) setCollapsed(direction > 0);
    }
    function pointer(event) { arm(scrollerFor(event)); }
    function touchStart(event) {
      pointer(event);
      const point = event.touches[0];
      touch = point ? { x: point.clientX, y: point.clientY } : null;
    }
    function touchMove(event) {
      const point = event.touches[0], scroller = scrollerFor(event);
      if (!touch || !point || !scroller) return;
      const dx = point.clientX - touch.x, dy = point.clientY - touch.y;
      if (Math.abs(dy) <= Math.abs(dx)) return;
      arm(scroller);
      // Upward scrolling at the top may be overscroll, with no scroll event.
      if (scroller.scrollTop <= 4 && dy >= THRESHOLD) setCollapsed(false);
    }
    function key(event) {
      if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) return;
      const scroller = scrollerFor(event);
      arm(scroller);
      if (scroller && scroller.scrollTop <= 4 && ['ArrowUp', 'PageUp', 'Home'].includes(event.key)) setCollapsed(false);
    }
    function scroll(event) {
      const scroller = event.target;
      if (scroller !== intent?.scroller || performance.now() > intent.until) return;
      const top = Math.max(0, Math.min(scroller.scrollTop, scroller.scrollHeight - scroller.clientHeight));
      const delta = top - intent.top;
      intent.top = top;
      if (intent.source === 'wheel') return;
      // Expanding the calendar can clamp scrollTop near its end. That isn't a new gesture.
      if (intent.height !== scroller.clientHeight) {
        intent.height = scroller.clientHeight;
        return;
      }
      if (!delta) return;
      intent.until = performance.now() + 1500;
      const direction = Math.sign(delta);
      intent.distance = intent.direction === direction ? intent.distance + Math.abs(delta) : Math.abs(delta);
      intent.direction = direction;
      if (top <= 4) setCollapsed(false);
      else if (intent.distance >= THRESHOLD) setCollapsed(direction > 0);
    }
    const listeners = { wheel, pointerdown: pointer, touchstart: touchStart, touchmove: touchMove, keydown: key, scroll };
    for (const [name, handler] of Object.entries(listeners)) container.addEventListener(name, handler, { capture: true, passive: true });
    return () => {
      for (const [name, handler] of Object.entries(listeners)) container.removeEventListener(name, handler, true);
    };
  }, [resetKey, foldHeader]);

  return (
    <ControlsCollapsed.Provider value={collapsed}>
      <div ref={root} className="studio-feature-page studio-schedule-page" style={style} data-controls-collapsed={collapsed} data-fold={foldHeader || undefined}>
        {children}
      </div>
    </ControlsCollapsed.Provider>
  );
}
