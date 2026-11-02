'use client';

// Phones: slide the top bar away while scrolling down the page and bring it back on
// any scroll up, like Safari's toolbar. Only the page's own scroll counts: panels that
// scroll inside a fixed page (the calendar) keep the bar, so no empty strip appears.
// No React state: a data attribute on the shell drives a CSS transform, so scrolling
// never re-renders.
import { useEffect } from 'react';
import { MOBILE_MEDIA } from '@/lib/responsive';

const THRESHOLD = 8; // px of movement before the bar reacts

// `active` turns true once the shell is on screen (the layout shows a loading screen first).
export function useHideHeaderOnScroll(shellRef, headerRef, scrollRef, active = true) {
  useEffect(() => {
    const shell = shellRef.current, header = headerRef.current, scroller = scrollRef.current;
    if (!active || !shell || !header || !scroller) return undefined;
    const media = window.matchMedia(MOBILE_MEDIA);
    let lastY = scroller.scrollTop;
    let hidden = false;
    const setHidden = value => {
      if (value === hidden) return;
      hidden = value;
      if (value) shell.setAttribute('data-header-hidden', '');
      else shell.removeAttribute('data-header-hidden');
    };
    const measure = () => shell.style.setProperty('--mobile-header-h', `${header.offsetHeight}px`);
    const onScroll = () => {
      if (!media.matches) return setHidden(false);
      const y = scroller.scrollTop;
      if (y <= header.offsetHeight) { lastY = y; return setHidden(false); }
      if (Math.abs(y - lastY) < THRESHOLD) return;
      setHidden(y > lastY);
      lastY = y;
    };
    // A focused field near the top should never sit under a hidden bar's gap.
    const onFocus = () => { if (scroller.scrollTop <= header.offsetHeight) setHidden(false); };
    const resize = new ResizeObserver(measure);
    resize.observe(header);
    measure();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('focusin', onFocus);
    const onMedia = () => { if (!media.matches) setHidden(false); measure(); };
    media.addEventListener('change', onMedia);
    return () => {
      resize.disconnect();
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('focusin', onFocus);
      media.removeEventListener('change', onMedia);
      setHidden(false);
    };
  }, [shellRef, headerRef, scrollRef, active]);
}
