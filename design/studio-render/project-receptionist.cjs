// Project a character plane and foreground occluders through the authored cameras.
// Geometry and camera stops match build_scene.py / render_artist.py (metres).
const {PerspectiveCamera,Vector3}=require('three');
const fs=require('node:fs'),path=require('node:path');
const direct=require('../../components/studio-cinematic/artist-camera-path.json');
const entrance=[[0,[0,-1.60,1.70],[0,3.1,1.65]],[16,[.05,-1.40,1.70],[-.1,3.4,1.65]],[34,[.25,.38,1.68],[-.6,3.4,1.55]],[58,[.30,1.64,1.65],[-.65,3.3,1.56]]];
const artist=[[0,[.30,1.64,1.65],[-.65,3.30,1.56]],[36,[.95,3.60,1.67],[.50,7.60,1.45]],[78,[.35,6.90,1.67],[-.40,11,1.35]],[114,[.55,9,1.60],[-1,11.2,1.30]],[144,[1.15,8.60,1.20],[-1.30,11,1.30]]];
function position(stops,f,k){
 const i=stops.findIndex((s,i)=>i<stops.length-1&&f<=stops[i+1][0]),a=stops[i],b=stops[i+1],dt=b[0]-a[0],t=(f-a[0])/dt;
 const slope=j=>j===0||j===stops.length-1?new Vector3():new Vector3(...stops[j+1][k]).sub(new Vector3(...stops[j-1][k])).divideScalar(stops[j+1][0]-stops[j-1][0]);
 return new Vector3(...a[k]).multiplyScalar(2*t**3-3*t*t+1).addScaledVector(slope(i),(t**3-2*t*t+t)*dt).addScaledVector(new Vector3(...b[k]),-2*t**3+3*t*t).addScaledVector(slope(i+1),(t**3-t*t)*dt);
}
// Face the arriving artist, rather than flattening the figure against the wall.
const person=[[-2.433,3.294,1.88],[-1.907,4.006,1.88],[-1.907,4.006,.70],[-2.433,3.294,.70]];
const occluders=[
 [[-3.22,2.475,1.163],[-.32,2.475,1.163],[-.32,3.425,1.163],[-3.22,3.425,1.163]],
 [[-3.17,2.525,1.135],[-.37,2.525,1.135],[-.37,2.525,0],[-3.17,2.525,0]],
 [[-.50,2.45,1.25],[-.06,2.45,1.25],[-.06,3.45,1.25],[-.50,3.45,1.25]],
 [[-.50,2.45,1.25],[-.06,2.45,1.25],[-.06,2.45,0],[-.50,2.45,0]],
 [[-1.18,3.01,1.76],[-.82,3.01,1.76],[-.82,2.91,1.28],[-1.18,2.91,1.28]],
];
const result={};
for(const [variant,w,h,lens] of [['portrait',720,1100,22],['landscape',1280,800,25]]){
 const camera=new PerspectiveCamera(2*Math.atan(36/(2*lens)/(w/h))*180/Math.PI,w/h,.08,80);camera.up.set(0,0,1);
 const frames={};
 for(const f of [...Array.from({length:59},(_,i)=>i),...Array.from({length:60},(_,i)=>153+i),...Array.from({length:direct.frameCount},(_,i)=>direct.firstFrame+i)]){
  const isDirect=f>=direct.firstFrame;
  const stops=isDirect?direct.stops:f<=58?entrance:artist,n=isDirect?f-direct.firstFrame+1:f<=58?f:f-152;
  camera.position.copy(position(stops,n,1));camera.lookAt(position(stops,n,2));camera.updateMatrixWorld();
  const project=poly=>{const p=poly.map(v=>new Vector3(...v).applyMatrix4(camera.matrixWorldInverse));if(p.some(v=>v.z>=-.08))return null;return p.map(v=>{v.applyMatrix4(camera.projectionMatrix);return [+((v.x+1)*w/2).toFixed(2),+((1-v.y)*h/2).toFixed(2)];});};
  const quad=project(person);
  if(quad&&quad.some(([x,y])=>x>-w*.2&&x<w*1.2&&y>0&&y<h))frames[f]={quad,occluders:occluders.map(project).filter(Boolean)};
 }
 result[variant]={width:w,height:h,frames};
}
fs.writeFileSync(path.join(__dirname,'../../components/studio-cinematic/receptionist-projection.json'),JSON.stringify(result)+'\n');
