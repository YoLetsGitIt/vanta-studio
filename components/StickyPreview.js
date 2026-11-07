'use client';

// A form preview beside settings that stays in view while the settings scroll. A
// preview shorter than the window sticks near the top; a taller one scrolls with the
// page until its bottom is in view, then stays put. It never scrolls inside itself.
import { useEffect, useRef, useState } from 'react';

const GAP = 24;

export default function StickyPreview({ children }) {
  const ref = useRef(null);
  const [top, setTop] = useState(GAP);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setTop(Math.min(GAP, window.innerHeight - el.offsetHeight - GAP));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  return (
    <div ref={ref} className="studio-consent-preview" style={{ position: 'sticky', top }}>
      {children}
    </div>
  );
}
