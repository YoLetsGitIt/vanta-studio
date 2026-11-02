import { sceneVariant } from './scene-framing.js';

// Frame 120 of the authored room, using the same camera and frame positions as
// design/studio-render/build_scene.py. Project before applying the cover crop.
const PRINTS = {
  forms: [-2.65, 2.65, .64, .98],
  branding: [-.57, 2.67, .74, .85],
  schedule: [2.78, 1.43, .61, .7],
  consent: [-2.65, 1.5, .65, .72],
  clients: [.59, 1.38, .58, .72],
  artists: [2.8, 2.6, .67, .89],
  analytics: [.60, 2.6, .76, 1.12],
  languages: [-1.63, 2.55, .87, 1.3],
  migration: [-.40, 1.55, .8, .65],
  // The room repeats the full flash sheet on the right. Both copies join the
  // same feature print, so every physical frame participates without adding a feature.
  'languages-repeat': [1.75, 2.60, .85, 1.3],
};
const dot = (a, b) => a.reduce((sum, n, i) => sum + n*b[i], 0);
const unit = a => a.map(n => n/Math.hypot(...a));
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const forward = unit([.10, 3.7, -.45]);
const right = unit(cross(forward, [0,0,1]));
const up = cross(right, forward);
const smooth = n => { n=Math.max(0,Math.min(1,n));return Math.max(0,Math.min(1,n*n*n*(n*(n*6-15)+10))); };
export const WALL_ZOOM = .08;

// A short camera settle, then lift / travel / resolve. Scroll distance is unchanged.
export function flashRevealState(progress, delay=0, motion=true) {
  if(!motion){const visible=Number(progress>=.5);return {push:0,travel:1,resolve:visible,surface:visible,label:visible,visible:0};}
  return {
    push:smooth(progress/.30),
    travel:smooth((progress-.14-delay)/.62),
    resolve:smooth((progress-.65-delay)/.18),
    surface:smooth((progress-.20-delay)/.25),
    label:smooth((progress-.26-delay)/.25),
    visible:smooth((progress-.04)/.10),
  };
}

export function wallPrintBounds(id, portrait) {
  const [x,z,w,h]=PRINTS[id];
  const width=portrait?720:1280, height=portrait?1100:800, lens=portrait?22:25;
  const points=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([sx,sy])=>{
    const delta=[x+sx*w/2-.10,11.14-5.1,z+sy*h/2-1.70];
    const depth=dot(delta,forward);
    return [( .5+dot(delta,right)/depth*lens/36)*width,(.5-dot(delta,up)/depth*lens/36*width/height)*height];
  });
  const left=Math.min(...points.map(p=>p[0])), top=Math.min(...points.map(p=>p[1]));
  return {left,top,width:Math.max(...points.map(p=>p[0]))-left,height:Math.max(...points.map(p=>p[1]))-top,renderWidth:width,renderHeight:height,corners:[points[0],points[1],points[3],points[2]]};
}

const layouts=new WeakMap();
export function updateFlashWall(section, progress, width, height, motion, rendered, push) {
  const key=`${width}:${height}:${section.scrollHeight}`;
  let layout=layouts.get(section);
  if(layout?.key!==key){
    layout={key,prints:[...section.querySelectorAll('[data-flash-print]')].map(element=>{
      const frame=element.querySelector('[data-flash-frame]');
      let x=0,y=0,node=frame;
      while(node&&node!==section){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent;}
      const flights=[...element.querySelectorAll('[data-wall-print]')].map(flight=>{
        const bounds=wallPrintBounds(flight.dataset.wallPrint,sceneVariant(width,height)==='portrait');
        const flightHeight=frame.offsetWidth*bounds.height/bounds.width;
        flight.style.setProperty('--flight-height',`${flightHeight}px`);
        flight.style.setProperty('--flight-width',`${frame.offsetWidth}px`);
        flight.style.setProperty('--flight-left',`${frame.offsetLeft}px`);
        flight.style.setProperty('--flight-top',`${frame.offsetTop+(frame.offsetHeight-flightHeight)/2}px`);
        return {flight,bounds};
      });
      return {element,flights,x,y,width:frame.offsetWidth,height:frame.offsetHeight};
    })};
    layouts.set(section,layout);
  }
  layout.prints.forEach((print,i)=>{
    const {element}=print;
    // Send the lower rows ahead, clearing their paths before the upper prints
    // settle. All artwork lifts, on both mobile and desktop, within the same scroll span.
    // Use actual landing positions so grouped sections and uneven rows share
    // the same short reveal without assuming a flat, two-column grid.
    const firstY=Math.min(...layout.prints.map(item=>item.y));
    const lastY=Math.max(...layout.prints.map(item=>item.y));
    const delay=(lastY-print.y)/Math.max(1,lastY-firstY)*.065;
    const {travel,resolve,surface,label,visible}=flashRevealState(progress,delay*.5,motion);
    element.style.setProperty('--print-resolve',String(resolve));
    element.style.setProperty('--print-surface',String(surface));
    element.style.setProperty('--print-label',String(label));
    element.style.setProperty('--print-flight',String(rendered?visible*(1-resolve):0));
    element.style.setProperty('--flight-display',motion&&rendered?'block':'none');
    if(!motion||!rendered)return;
    print.flights.forEach(({flight,bounds})=>{
      const cover=Math.max(width/bounds.renderWidth,height/bounds.renderHeight);
      const zoom=1+push*WALL_ZOOM;
      const sourceX=(width-bounds.renderWidth*cover)/2+(bounds.left+bounds.width/2)*cover;
      const sourceY=(height-bounds.renderHeight*cover)/2+(bounds.top+bounds.height/2)*cover;
      const x=width*.5+(sourceX-width*.5)*zoom;
      const y=height*.36+(sourceY-height*.36)*zoom;
      const remaining=1-travel;
      // One continuous curve instead of completing sideways motion early.
      // A restrained upward arc gives the print a lift without a looping path.
      const dx=x-print.x-print.width/2, dy=y-print.y-print.height/2;
      const lift=Math.sin(travel*Math.PI);
      const arc=Math.min(36,Math.hypot(dx,dy)*.045);
      flight.style.setProperty('--flight-x',`${dx*remaining}px`);
      flight.style.setProperty('--flight-y',`${dy*remaining-arc*lift}px`);
      const tilt=parseFloat(element.style.getPropertyValue('--tilt'))||0;
      flight.style.setProperty('--flight-rotate',`${tilt*travel+lift*(i%2?1:-1)*1.2}deg`);
      const sourceScale=bounds.width*cover*zoom/print.width;
      const destinationScale=Math.min(1,print.height/(print.width*bounds.height/bounds.width));
      // Keep the ink's proportions throughout the move, even when the mount changes.
      flight.style.setProperty('--flight-scale',String(Math.exp(Math.log(sourceScale)*remaining+Math.log(destinationScale)*travel)));
      flight.style.setProperty('--flight-lift',String(lift));
    });
  });
}
