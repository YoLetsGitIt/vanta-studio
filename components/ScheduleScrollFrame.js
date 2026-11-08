'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import styles from './ScheduleScrollFrame.module.css';

const ControlsCollapsed = createContext(false);
const THRESHOLD = 12;

export function ScheduleControls({ children }) {
  const collapsed = useContext(ControlsCollapsed);
  return (
    <div className={styles.controls} data-collapsed={collapsed || undefined} inert={collapsed || undefined}>
      <div className={styles.controlsInner}>{children}</div>
    </div>
  );
}

export default function ScheduleScrollFrame({ children, resetKey, style }) {
  const [collapsed, setCollapsed] = useState(false);
  const root = useRef(null);

  useEffect(() => {
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
      if (top <= 4 || intent.distance >= THRESHOLD) {
        setCollapsed(top > 4 && direction > 0);
      }
    }
    const listeners = { wheel, pointerdown: pointer, touchstart: touchStart, touchmove: touchMove, keydown: key, scroll };
    for (const [name, handler] of Object.entries(listeners)) container.addEventListener(name, handler, { capture: true, passive: true });
    return () => {
      for (const [name, handler] of Object.entries(listeners)) container.removeEventListener(name, handler, true);
    };
  }, [resetKey]);

  return (
    <ControlsCollapsed.Provider value={collapsed}>
      <div ref={root} className="studio-feature-page studio-schedule-page" style={style} data-controls-collapsed={collapsed}>
        {children}
      </div>
    </ControlsCollapsed.Provider>
  );
}
