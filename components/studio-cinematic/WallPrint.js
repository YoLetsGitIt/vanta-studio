import { useId } from 'react';
import { wallPrintBounds } from './flash-wall-motion';
import styles from './flash-wall.module.css';

// Use the actual lit print from the room during the lift, then dissolve to the
// crisp flash artwork. Both variants reuse the already cached last room frame.
export default function WallPrint({ id }) {
  const clipId=useId();
  return <span className={styles.flight} data-wall-print={id} aria-hidden="true">{[false,true].map(portrait=>{
    const b=wallPrintBounds(id,portrait);
    return <svg key={String(portrait)} data-orientation={portrait?'portrait':'landscape'} viewBox={`${b.left} ${b.top} ${b.width} ${b.height}`} preserveAspectRatio="none" focusable="false">
      <defs><clipPath id={`${clipId}-${portrait}`}><polygon points={b.corners.map(p=>p.join(',')).join(' ')}/></clipPath></defs>
      <image href={`/studio/walkthrough/${portrait?'portrait':'landscape'}/0120.webp`} width={b.renderWidth} height={b.renderHeight} clipPath={`url(#${clipId}-${portrait})`}/>
    </svg>;
  })}</span>;
}
