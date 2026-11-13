// Project the authored glass pane through the same camera used by build_scene.py.
// This lets the browser apply a smoked-glass finish to the moving door only.
const {PerspectiveCamera,Vector3}=require('three');
const fs=require('node:fs');const path=require('node:path');
const direct=require('../../components/studio-cinematic/artist-camera-path.json');
const stops=[[0,[0,-1.60,1.70],[0,3.1,1.65]],[16,[.05,-1.40,1.70],[-.1,3.4,1.65]],[34,[.25,.38,1.68],[-.6,3.4,1.55]],[58,[.30,1.64,1.65],[-.65,3.3,1.56]],[72,[.98,2.5,1.67],[.28,6.5,1.55]],[92,[1,4.3,1.70],[.70,8.7,1.42]],[120,[.1,5.1,1.70],[.2,8.8,1.25]]];
function position(f,k,points=stops){const i=points.findIndex((s,i)=>i<points.length-1&&f<=points[i+1][0]);const a=points[i],b=points[i+1],dt=b[0]-a[0],t=(f-a[0])/dt;
 const slope=j=>(points===stops?[0,3,6]:[0,points.length-1]).includes(j)?new Vector3():new Vector3(...points[j+1][k]).sub(new Vector3(...points[j-1][k])).divideScalar(points[j+1][0]-points[j-1][0]);
 return new Vector3(...a[k]).multiplyScalar(2*t**3-3*t*t+1).addScaledVector(slope(i),(t**3-2*t*t+t)*dt).addScaledVector(new Vector3(...b[k]),-2*t**3+3*t*t).addScaledVector(slope(i+1),(t**3-t*t)*dt);
}
const result={};for(const [variant,w,h,lens] of [['portrait',720,1100,22],['landscape',1280,800,25]]){
 const camera=new PerspectiveCamera(2*Math.atan(36/(2*lens)/(w/h))*180/Math.PI,w/h,.08,80);camera.up.set(0,0,1);
 const frames=[];
 for(const f of [...Array.from({length:121},(_,i)=>i),...Array.from({length:direct.frameCount},(_,i)=>direct.firstFrame+i)]){
  const n=f>=direct.firstFrame?f-direct.firstFrame+1:f,points=f>=direct.firstFrame?direct.stops:stops;
  camera.position.copy(position(n,1,points));camera.lookAt(position(n,2,points));camera.updateMatrixWorld();
  const t=Math.min(1,n/28),angle=98*Math.PI/180*(t*t*(3-2*t));
  let polygon=[[.07,.10],[2.25,.10],[2.25,3.19],[.07,3.19]].map(([x,z])=>new Vector3(-1.16+x*Math.cos(angle),-.025+x*Math.sin(angle),z).applyMatrix4(camera.matrixWorldInverse));
  // Clip against the camera near plane before perspective division.
  const clipped=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],inside=a.z<-.08,next=b.z<-.08;if(inside)clipped.push(a);if(inside!==next)clipped.push(a.clone().lerp(b,(-.08-a.z)/(b.z-a.z)));}
  frames[f]=clipped.map(v=>{v.applyMatrix4(camera.projectionMatrix);return [Number(((v.x+1)*w/2).toFixed(2)),Number(((1-v.y)*h/2).toFixed(2))];});
 }
 result[variant]={width:w,height:h,frames};
}
fs.writeFileSync(path.join(__dirname,'../../components/studio-cinematic/door-projection.json'),JSON.stringify(result)+'\n');
