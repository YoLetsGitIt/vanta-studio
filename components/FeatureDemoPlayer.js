'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './FeatureDemoPlayer.module.css';

export default function FeatureDemoPlayer({ demo, title }) {
  const videoRef=useRef(null);
  const [time,setTime]=useState(0),[failed,setFailed]=useState(false);
  const chapters=demo.chapters||[];
  const chapter=Math.max(0,chapters.findLastIndex(item=>time>=item.at));
  useEffect(()=>{
    const pause=()=>{if(document.hidden)videoRef.current?.pause();};
    document.addEventListener('visibilitychange',pause);
    return()=>document.removeEventListener('visibilitychange',pause);
  },[]);
  function seek(at){
    const video=videoRef.current;if(!video)return;
    video.currentTime=at;setTime(at);
    video.play().catch(()=>{});
  }
  return <div className={styles.player} data-portrait={demo.portrait || undefined} data-tour={demo.tour || undefined}>
    <div className={styles.stage}>
      <video ref={videoRef} src={demo.src} poster={demo.poster} data-feature-demo tabIndex={0} controls muted={!demo.narrated} playsInline preload="metadata"
        onPlay={event=>document.querySelectorAll('video[data-feature-demo]').forEach(video=>{if(video!==event.currentTarget)video.pause();})}
        aria-label={`${title} product demonstration`} onTimeUpdate={event=>setTime(event.currentTarget.currentTime)}
        onError={()=>setFailed(true)} onLoadedData={()=>setFailed(false)}>
        Your browser cannot play this demo. <a href={demo.src}>Open the video</a>.
      </video>
      {failed&&<p role="status" className={styles.error}>The demo couldn’t load. <button onClick={()=>{setFailed(false);videoRef.current?.load();}}>Try again</button></p>}
    </div>
    <div className={styles.meta}><span>{demo.title||title}</span><small>{demo.duration ? `${Math.floor(demo.duration / 60)}:${String(Math.floor(demo.duration % 60)).padStart(2, '0')} · ` : ''}{demo.narrated ? 'Narrated tour' : 'Sound-free demo'} · {demo.context || 'Sample data'}</small></div>
    {chapters.length>0&&<div className={styles.chapters} role="group" aria-label={`${title} demo chapters`}>
      {chapters.map((item,index)=><button key={item.at} onClick={()=>seek(item.at)} aria-pressed={index===chapter}><span>{demo.tour ? `${Math.floor(item.at/60)}:${String(Math.floor(item.at%60)).padStart(2,'0')}` : String(index+1).padStart(2,'0')}</span>{item.title}</button>)}
    </div>}
  </div>;
}
