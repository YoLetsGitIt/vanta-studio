'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createFramePlayer } from './frame-player';
import styles from './cinematic.module.css';
import { NARROW_SCENE_MEDIA } from './scene-framing';
import doorProjection from './door-projection.json';

const RenderedScene = forwardRef(function RenderedScene({ receptionist = false }, ref) {
  const canvasRef=useRef(null),playerRef=useRef(null),positionRef=useRef([0,true]);
  useImperativeHandle(ref,()=>({seek(frame,motion){positionRef.current=[frame,motion];playerRef.current?.seek(frame,motion);},warm(first,last){playerRef.current?.warm(first,last);}}),[]);
  useEffect(()=>{
    const player=createFramePlayer(canvasRef.current,{receptionist});playerRef.current=player;player.seek(...positionRef.current);
    return()=>{player.dispose();playerRef.current=null;};
  },[receptionist]);
  return <div className={styles.renderedRoom} aria-hidden="true">
    <picture>
      <source media={NARROW_SCENE_MEDIA} srcSet="/studio/walkthrough/portrait/0000.webp" />
      <img src="/studio/walkthrough/landscape/0000.webp" alt="" fetchPriority="high" draggable="false" />
    </picture>
    {Object.entries(doorProjection).map(([variant,door])=><svg key={variant} className={styles.doorFinish} data-variant={variant} viewBox={`0 0 ${door.width} ${door.height}`} preserveAspectRatio="xMidYMid slice"><polygon points={door.frames[0].map(point=>point.join(',')).join(' ')} fill="rgba(28, 34, 30, 0.78)" /></svg>)}
    <canvas ref={canvasRef} />
  </div>;
});
export default RenderedScene;
