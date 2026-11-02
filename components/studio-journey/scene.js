import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Local geometry with locally hosted CC0 surface scans and Studio screenshots.
// The render pipeline adds contact depth without remote runtime dependencies.
export function createStudioScene(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#262522');
  scene.fog = new THREE.Fog('#34322e', 20, 40);
  const camera = new THREE.PerspectiveCamera(54, 1, 0.08, 45);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  // A small prefiltered room environment supplies reflections to metal and glass.
  const roomEnvironment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(roomEnvironment, 0.04, 0.1, 100, { size: 128 });
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.48;
  roomEnvironment.dispose(); pmrem.dispose();
  const textures = new Set();
  const materials = new Set();
  const geometries = new Set();
  const standard = (color, options = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...options });
    materials.add(m);
    return m;
  };
  const ink = standard('#242421');
  const plaster = standard('#c9c3b7');
  const darkWall = standard('#8f887b');
  const cream = standard('#d9d2bf');
  const black = standard('#191b1b', { roughness: 0.65 });
  const brass = standard('#b49861', { metalness: 0.65, roughness: 0.3 });
  const steel = standard('#79817e', { metalness: 0.75, roughness: 0.32 });
  const leather = standard('#262c2b', { roughness: 0.54 });
  const glow = standard('#ffe1a6', { emissive: '#ffce83', emissiveIntensity: 1.4 });
  function mesh(geo, mat, x, y, z, parent = scene) {
    geometries.add(geo);
    const obj = new THREE.Mesh(geo, mat);
    obj.position.set(x, y, z);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  const box = (w,h,d,mat,x,y,z,parent) => {
    const geo=new THREE.BoxGeometry(w,h,d);
    if(mat===plaster||mat===darkWall||mat===cream){
      const a=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
      for(let i=0;i<a.count;i++)uv.setXY(i,(Math.abs(n.getX(i))>.5?a.getZ(i):a.getX(i))/3.2,(Math.abs(n.getY(i))>.5?a.getZ(i):a.getY(i))/3.2);
    }
    return mesh(geo,mat,x,y,z,parent);
  };
  function island(w,h,d,r,mat,x,y,z){
    const shape=new THREE.Shape();const a=w/2,b=d/2;
    shape.moveTo(-a+r,-b);shape.lineTo(a-r,-b);shape.quadraticCurveTo(a,-b,a,-b+r);shape.lineTo(a,b-r);shape.quadraticCurveTo(a,b,a-r,b);shape.lineTo(-a+r,b);shape.quadraticCurveTo(-a,b,-a,b-r);shape.lineTo(-a,-b+r);shape.quadraticCurveTo(-a,-b,-a+r,-b);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:true,bevelSegments:3,bevelSize:.012,bevelThickness:.012,steps:1,curveSegments:16});geo.translate(0,0,-h/2);
    const m=mesh(geo,mat,x,y,z);m.rotation.x=Math.PI/2;return m;
  }
  const round = (w, h, d, mat, x, y, z, parent) => mesh(new RoundedBoxGeometry(w, h, d, mat===leather?5:3, Math.min(w, h, d) * (mat===leather?.46:.25)), mat, x, y, z, parent);
  const cylinder = (r, r2, h, mat, x, y, z, parent) => mesh(new THREE.CylinderGeometry(r, r2, h, 40), mat, x, y, z, parent);
  function canvasTexture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.add(texture);
    return texture;
  }
  // Repeatable microstructure keeps the large surfaces from looking plastic.
  let seed = 1247;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const noise = canvasTexture((ctx,w,h) => {
    const pixels = ctx.createImageData(w,h);
    for(let i=0;i<pixels.data.length;i+=4){const v=120+Math.floor(random()*22);pixels.data.set([v,v,v,255],i);}
    ctx.putImageData(pixels,0,0);
  },256,256);
  noise.colorSpace=THREE.NoColorSpace; noise.wrapS=noise.wrapT=THREE.RepeatWrapping; noise.repeat.set(5,5);
  [plaster,darkWall,cream].forEach(m=>{m.bumpMap=noise;m.bumpScale=0.012;});
  leather.bumpMap=noise;leather.bumpScale=0.003;
  const woodTexture = canvasTexture((ctx,w,h) => {
    ctx.fillStyle='#a78c6d';ctx.fillRect(0,0,w,h);
    for(let i=0;i<700;i++){
      const x=random()*w;ctx.strokeStyle=`rgba(62,42,24,${0.025+random()*0.09})`;ctx.lineWidth=.4+random();
      ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+Math.sin(i)*6,h*.3,x-3,h*.7,x+2,h);ctx.stroke();
    }
  });
  const wood = standard('#e1cfb5',{map:woodTexture,roughness:.64});
  const floor=standard('#aca69b',{roughness:.62});
  // Real color / normal / roughness scans. Neutral materials remain if a map fails.
  let disposed=false, lastProgress=0, lastReduced=false, needsSceneRender=true, lastFrame='';
  const loader=new THREE.TextureLoader();
  function surfaceMap(file,color=false,repeat=1){
    const t=loader.load(`/studio/materials/${file}.jpg`,()=>{needsSceneRender=true;if(!disposed)render(lastProgress,lastReduced);},undefined,()=>{});
    t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.add(t);return t;
  }
  const scanColor=surfaceMap('plaster-color',true),scanNormal=surfaceMap('plaster-normal'),scanRough=surfaceMap('plaster-roughness');
  [plaster,darkWall,cream].forEach(m=>{m.map=scanColor;m.normalMap=scanNormal;m.normalScale=new THREE.Vector2(.22,.22);m.roughnessMap=scanRough;m.bumpMap=null;});
  floor.map=scanColor;floor.normalMap=scanNormal;floor.normalScale=new THREE.Vector2(.12,.12);floor.roughnessMap=scanRough;
  // Soft baked contact shadows add grounding without extra shadow-casting lights.
  const contactTexture=canvasTexture((ctx,w,h)=>{
    const grad=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
    grad.addColorStop(0,'rgba(0,0,0,.42)');grad.addColorStop(.45,'rgba(0,0,0,.22)');grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  },128,128);
  const contactMat=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});materials.add(contactMat);
  function contact(x,z,w,d,parent=scene){const m=mesh(new THREE.PlaneGeometry(w,d),contactMat,x,.012,z,parent);m.rotation.x=-Math.PI/2;m.castShadow=false;m.receiveShadow=false;}
  // Warm walnut shelving adds scale and a useful reception backdrop.
  const walnut=standard('#574637',{map:woodTexture,roughness:.65});
  const signTexture = canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); ctx.textAlign = 'center';
    ctx.fillStyle = '#f1e6cd'; ctx.font = 'bold 150px Arial'; ctx.fillText('vanta.', w / 2, 171);
    ctx.font = '20px Arial'; ctx.fillText('T A T T O O   S T U D I O', w / 2, 224);
  }, 640, 280);
  const signMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  materials.add(signMat);
  const sign = (w, h, x, y, z, parent) => mesh(new THREE.PlaneGeometry(w, h), signMat, x, y, z, parent);

  // Open central aisle, reception to the left, workstations at the back.
  box(9,0.18,20,ink,0,-0.1,-5);
  const floorGeo=new THREE.PlaneGeometry(9,20);const floorUV=floorGeo.attributes.uv;for(let i=0;i<floorUV.count;i++)floorUV.setXY(i,floorUV.getX(i)*2.8,floorUV.getY(i)*6.25);
  const floorSurface=mesh(floorGeo,floor,0,-.006,-5);
  floorSurface.rotation.x=-Math.PI/2;floorSurface.castShadow=false;
  box(0.2, 4.4, 20, plaster, -4.5, 2.2, -5);
  box(0.2, 4.4, 20, plaster, 4.5, 2.2, -5);
  box(9, 4.4, 0.2, darkWall, 0, 2.2, -14.7);
  box(9, 0.14, 20, plaster, 0, 4.45, -5);
  [-4.36, 4.36].forEach(x => box(0.05, 0.13, 20, ink, x, 0.1, -5));
  [-2, -7, -12].forEach(z => box(9, 0.18, 0.18, ink, 0, 4.22, z));
  // Front elevation is a real doorway, not a full-screen image plane.
  box(3.25, 4.4, 0.28, darkWall, -2.91, 2.2, 3.4);
  box(3.25, 4.4, 0.28, darkWall, 2.91, 2.2, 3.4);
  box(2.6, 1.1, 0.28, darkWall, 0, 3.87, 3.4);
  [-1.29, 1.29].forEach(x => box(0.1, 3.38, 0.23, brass, x, 1.69, 3.55));
  box(2.68, 0.1, 0.23, brass, 0, 3.36, 3.55);
  box(2.58, 0.035, 0.3, brass, 0, 0.025, 3.5);
  const door = new THREE.Group(); door.position.set(-1.22, 0, 3.46); scene.add(door);
  const glass = standard('#31443b', { transparent: true, opacity: 0.83, metalness: 0.25, roughness: 0.28 });
  box(2.44, 3.25, 0.055, glass, 1.22, 1.65, 0, door);
  [0.04, 2.40].forEach(x => box(0.065, 3.25, 0.11, ink, x, 1.65, 0, door));
  [0.07, 3.23].forEach(y => box(2.44, 0.065, 0.11, ink, 1.22, y, 0, door));
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 3.1, 0.015), brass, 38);
  geometries.add(ribs.geometry);
  for (let i = 0; i < 38; i++) ribs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0.08 + i * 0.061, 1.65, -0.032));
  door.add(ribs);
  cylinder(0.025, 0.025, 0.63, brass, 2.17, 1.48, 0.15, door);
  [1.2, 1.76].forEach(y => box(0.05, 0.04, 0.16, brass, 2.17, y, 0.085, door));
  sign(1.16, 0.51, 1.22, 2.12, 0.061, door);

  // Reception joinery, counter tablet, wall niche and seating.
  contact(-1.82,-1.6,4.7,2.5);
  island(3.6,.93,1.04,.36,cream,-1.82,.62,-1.6);
  island(3.35,.14,.85,.30,black,-1.82,.11,-1.6);
  island(3.7,.06,1.10,.39,black,-1.82,1.10,-1.6);
  island(3.85,.085,1.18,.43,cream,-1.82,1.16,-1.6);
  box(4.25, 3.6, 0.15, darkWall, -2.25, 1.8, -3.7);
  sign(2.15, .94, -2.12, 2.52, -3.61);
  // Thin brass reveal and concealed light above the reception wall.
  box(4.25,.012,.025,brass,-2.25,3.49,-3.60);
  box(4.1,.012,.03,glow,-2.25,3.51,-3.58);
  box(.025,3.5,.035,brass,-.15,1.75,-3.59);
  box(0.45, 0.035, 0.35, black, -1.04, 1.22, -1.38);
  const tablet = new THREE.Group(); tablet.position.set(-1.04, 1.55, -1.4); tablet.rotation.x = -0.19; scene.add(tablet);
  round(0.50, 0.72, 0.035, black, 0, 0, 0, tablet);
  const screenTexture = canvasTexture((ctx,w,h) => { ctx.fillStyle='#111'; ctx.fillRect(0,0,w,h); }, 460, 680);
  const tabletImages = new Map();
  let tabletState = '';
  function setTabletState(state) {
    if (state === tabletState) return;
    tabletState = state;
    const file = {form:'booking-form',enquiry:'enquiry',confirmed:'confirmed',signed:'consent-signed'}[state] || 'booking-form';
    const paint = img => {
      if (disposed || tabletState !== state || !img.naturalWidth) return;
      const ctx = screenTexture.image.getContext('2d');
      const scale = Math.min(460/img.naturalWidth,680/img.naturalHeight);
      ctx.fillStyle='#111'; ctx.fillRect(0,0,460,680);
      ctx.drawImage(img,(460-img.naturalWidth*scale)/2,0,img.naturalWidth*scale,img.naturalHeight*scale);
      screenTexture.needsUpdate=true;needsSceneRender=true;
      render(lastProgress,lastReduced);
    };
    let img = tabletImages.get(file);
    if (img?.complete && img.naturalWidth) { paint(img); return; }
    if (!img) { img=new Image(); tabletImages.set(file,img); }
    img.onload=()=>paint(img);
    if (!img.src) img.src=`/studio/screenshots/${file}.png`;
  }
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture }); materials.add(screenMat);
  mesh(new THREE.PlaneGeometry(0.45, 0.67), screenMat, 0, 0, 0.02, tablet);
  cylinder(0.025, 0.025, 0.3, steel, -1.04, 1.36, -1.49);
  [0, 1, 2].forEach(i => box(0.37 - i * 0.025, 0.035, 0.28, i % 2 ? cream : ink, -2.65, 1.24 + i * 0.036, -1.5));
  round(0.7, 0.13, 2.2, leather, 3.9, 0.48, 0.1);
  [-0.7, 0.9].forEach(z => box(0.52, 0.42, 0.08, ink, 3.9, 0.22, z));

  function flash(x, y, z, variant = 0, rotation = 0) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = rotation; scene.add(group);
    box(0.88, 1.18, 0.07, ink, 0, 0, 0, group);
    const texture = canvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#d9ccb0'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3e4736'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      if(variant%3===0){
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.85); ctx.bezierCurveTo(w * 0.3, h * 0.6, w * 0.64, h * 0.4, w / 2, h * 0.15); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const y = h * (0.25 + i * 0.09), dir = i % 2 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(w / 2, y + 30);
        ctx.bezierCurveTo(w / 2 + dir * (70 + variant * 8), y + 10, w / 2 + dir * 65, y - 65, w / 2, y + 30);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(w / 2, h * 0.12, 13 + variant * 3, 0, Math.PI * 2); ctx.stroke();
      }else if(variant%3===1){
        // Symmetric moth with fine inner wing detail.
        ctx.save();ctx.translate(w/2,h*.48);
        for(const direction of [-1,1]){ctx.save();ctx.scale(direction,1);
          ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(30,-95,120,-100,91,-8);ctx.bezierCurveTo(100,70,36,88,0,12);ctx.stroke();
          for(let n=0;n<4;n++){ctx.beginPath();ctx.moveTo(4,n*6);ctx.quadraticCurveTo(50,-60+n*25,86,-42+n*20);ctx.stroke();}
          ctx.beginPath();ctx.ellipse(55,-24,14,23,.5,0,Math.PI*2);ctx.stroke();ctx.restore();
        }
        ctx.beginPath();ctx.ellipse(0,0,6,50,0,0,Math.PI*2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(-3,-45);ctx.quadraticCurveTo(-25,-80,-31,-63);ctx.moveTo(3,-45);ctx.quadraticCurveTo(25,-80,31,-63);ctx.stroke();ctx.restore();
      }else{
        // Ornamental dagger.
        ctx.beginPath();ctx.moveTo(w*.43,h*.40);ctx.lineTo(w*.44,h*.70);ctx.lineTo(w*.5,h*.84);ctx.lineTo(w*.56,h*.70);ctx.lineTo(w*.57,h*.40);ctx.closePath();ctx.stroke();
        ctx.beginPath();ctx.moveTo(w*.5,h*.44);ctx.lineTo(w*.5,h*.79);ctx.stroke();
        ctx.strokeRect(w*.46,h*.20,w*.08,h*.19);
        for(let n=0;n<5;n++){ctx.beginPath();ctx.moveTo(w*.46,h*(.22+n*.03));ctx.lineTo(w*.54,h*(.24+n*.03));ctx.stroke();}
        ctx.beginPath();ctx.moveTo(w*.3,h*.43);ctx.quadraticCurveTo(w*.5,h*.32,w*.7,h*.43);ctx.stroke();
        ctx.beginPath();ctx.arc(w*.5,h*.16,12,0,Math.PI*2);ctx.stroke();
      }
      ctx.font = '14px Georgia'; ctx.textAlign = 'center'; ctx.fillText(['BOTANICA', 'NOCTURNE', 'FORTITUDE'][variant % 3], w / 2, h * 0.94);
    }, 256, 384);
    const mat = standard('#ffffff', { map: texture });
    mesh(new THREE.PlaneGeometry(0.73, 1.03), mat, 0, 0, 0.039, group);
  }
  flash(-4.37, 2.5, -2.5, 0, Math.PI / 2);
  [-6.3, -8.3, -10.3].forEach((z, i) => flash(-4.37, 2.5, z, i, Math.PI / 2));
  [0.3, -1.1].forEach((z, i) => flash(4.37, 2.35, z, i, -Math.PI / 2));
  [-2.5, 0, 2.5].forEach((x, i) => flash(x, 2.6, -14.56, i));

  function plant(x, z, size = 1) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(size); scene.add(group);
    cylinder(0.26, 0.19, 0.49, standard('#b39a77'), 0, 0.25, 0, group);
    const leaf = standard('#3c5138',{side:THREE.DoubleSide,roughness:.65});
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.399, height = 0.62 + i * 0.093;
      const stem = cylinder(0.009, 0.012, height, leaf, Math.sin(angle) * 0.1, 0.5 + height / 2, Math.cos(angle) * 0.1, group);
      stem.rotation.z = Math.sin(angle) * 0.2;
      const vertices=[],uvs=[],indices=[];
      for(let row=0;row<=12;row++){
        const t=row/12,width=Math.sin(Math.PI*t)*.16;
        for(let col=0;col<3;col++){const side=col-1;vertices.push(side*width,t*.63,Math.sin(t*Math.PI)*.065-Math.abs(side)*.035);uvs.push(col/2,t);}
      }
      for(let row=0;row<12;row++)for(let col=0;col<2;col++){const n=row*3+col;indices.push(n,n+1,n+3,n+1,n+4,n+3);}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
      const l=mesh(geo,leaf,Math.sin(angle)*.1,.5+height,Math.cos(angle)*.1,group);
      l.rotation.set(.6,angle,-.45);
      const vein=cylinder(.002,.004,.55,standard('#6a7c53'),0,.28,.025,l);vein.castShadow=false;
    }
  }
  plant(-3.92, -0.4); plant(3.8, -4.3, 1.2); plant(-3.8, -13.6, 1.25);

  function pendant(x,z){
    cylinder(.012,.012,1.05,black,x,3.89,z);
    const profile=[[.035,0],[.10,-.025],[.18,-.09],[.29,-.17],[.38,-.21],[.39,-.24]].map(([r,y])=>new THREE.Vector2(r,y));
    const shade=mesh(new THREE.LatheGeometry(profile,48),brass,x,3.45,z);
    shade.material.side=THREE.DoubleSide;
    cylinder(.36,.36,.015,glow,x,3.205,z);
    const light=new THREE.SpotLight('#ffe6c5',28,7,Math.PI/2.8,.85,2);light.position.set(x,3.03,z);light.target.position.set(x,0,z);scene.add(light,light.target);
  }
  pendant(-1.7,-1.4);pendant(1.5,-6.2);pendant(-1.7,-11.4);
  // Low cabinetry gives the workstation area an intentional, fitted interior.
  box(.56,.82,4.0,walnut,-4.1,.45,-8.6);
  round(.64,.06,4.12,cream,-4.1,.89,-8.6);
  for(let i=0;i<5;i++){
    box(.028,.70,.74,walnut,-3.80,.47,-10.16+i*.78);
    box(.018,.012,.19,brass,-3.777,.72,-10.16+i*.78);
  }
  // Luminous window panes give the rear room a softer daylight contrast.
  const windowMat = standard('#dae6e9', { emissive: '#dbe9f0', emissiveIntensity: 1.15 });
  [-7, -11].forEach(z => {
    box(0.07, 2.0, 2.6, ink, 4.37, 2.45, z);
    box(0.075, 1.87, 2.45, windowMat, 4.32, 2.45, z);
    box(0.11, 2, 0.055, ink, 4.25, 2.45, z);
    box(0.11, 0.05, 2.5, ink, 4.25, 2.45, z);
    box(.34,.065,2.8,cream,4.19,1.43,z);
    // Recessed reveals read as architecture rather than luminous wall stickers.
    [z-1.32,z+1.32].forEach(edge=>box(.22,2.16,.065,cream,4.27,2.45,edge));
    box(.22,.065,2.7,cream,4.27,3.5,z);
  });

  function bed(x, z, angle = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = angle; scene.add(g);
    contact(0,0,2.1,3.2,g);
    round(0.72, 0.09, 0.85, black, 0, 0.08, 0, g);
    cylinder(.18,.2,.12,steel,0,.17,0,g);
    cylinder(.075,.075,.3,brass,0,.63,0,g);
    round(.72,.06,1.2,black,0,.71,-.03,g);
    cylinder(0.085, 0.12, 0.65, steel, 0, 0.42, 0, g);
    round(0.86, 0.18, 1.15, leather, 0, 0.83, 0.24, g);
    const back = round(0.86, 0.17, 0.82, leather, 0, 1.02, -0.62, g); back.rotation.x = 0.4;
    // Raised piping and a hinge give the upholstery its own construction.
    const seam=standard('#56615a',{roughness:.8});
    [-.409,.409].forEach(x=>{
      round(.012,.013,1.02,seam,x,.918,.24,g);
      const piping=round(.012,.013,.71,seam,x,1.107,-.62,g);piping.rotation.x=.4;
      const hinge=cylinder(.09,.09,.035,steel,x,.84,-.28,g);hinge.rotation.z=Math.PI/2;
    });
    const foot=round(.82,.16,.49,leather,0,.72,1.03,g);foot.rotation.x=-.25;
    const head = round(0.46, 0.15, 0.3, leather, 0, 1.22, -1.08, g); head.rotation.x = 0.4;
    [-0.61, 0.61].forEach(side => {
      cylinder(0.023, 0.023, 0.4, steel, side, 0.84, -0.25, g);
      round(0.22, 0.1, 0.56, leather, side, 1.05, -0.25, g);
    });
    // Instrument trolley and a task light.
    const trayX = 1.1;
    [0.38, 0.88].forEach(y => round(0.58, 0.05, 0.55, steel, trayX, y, -0.4, g));
    [-0.22, 0.22].forEach(offset => cylinder(0.016, 0.016, 0.85, steel, trayX + offset, 0.46, -0.4, g));
    [-.23,.23].forEach(dx=>[-.2,.2].forEach(dz=>{
      cylinder(.012,.012,.83,steel,trayX+dx,.46,-.4+dz,g);
      const wheel=cylinder(.038,.038,.025,black,trayX+dx,.065,-.4+dz,g);wheel.rotation.z=Math.PI/2;
    }));
    round(.36,.018,.21,cream,trayX,.918,-.29,g);
    for(let i=0;i<5;i++)cylinder(.018,.023,.026,cream,trayX-.15+i*.065,.94,-.26,g);
    round(.16,.09,.09,black,trayX+.13,.95,-.53,g);
    [0, 1, 2].forEach(i => {
      cylinder(0.035, 0.035, 0.12, i % 2 ? cream : ink, trayX - 0.14 + i * 0.13, 0.96, -0.5, g);
      cylinder(0.012, 0.018, 0.05, black, trayX - 0.14 + i * 0.13, 1.045, -0.5, g);
    });
    cylinder(.23,.26,.045,black,-1,.05,-.7,g);
    cylinder(0.022, 0.022, 1.7, steel, -1.0, 0.92, -0.7, g);
    cylinder(.08,.09,.035,black,-1,1.65,-.7,g);
    // Adjustable artist stool beside each station.
    const seat=mesh(new THREE.SphereGeometry(1,32,16),leather,.9,.59,.65,g);seat.scale.set(.26,.065,.26);
    cylinder(.035,.065,.49,steel,.9,.31,.65,g);
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      const spoke=box(.035,.025,.34,steel,.9+Math.sin(a)*.15,.1,.65+Math.cos(a)*.15,g);spoke.rotation.y=a;
      const caster=cylinder(.035,.035,.023,black,.9+Math.sin(a)*.30,.06,.65+Math.cos(a)*.30,g);caster.rotation.z=Math.PI/2;
    }
    const arm = box(0.025, 0.025, 0.7, steel, -1.0, 1.76, -0.4, g); arm.rotation.x = -0.18;
    const lamp = cylinder(0.13, 0.17, 0.09, cream, -1, 1.7, -0.06, g); lamp.rotation.z = -0.3;
    cylinder(0.15, 0.15, 0.015, glow, -1.0, 1.65, -0.06, g);
  }
  bed(-1.6, -7.5, 0.12); bed(2, -10.8, -0.12); bed(-2.2, -12.2, 0.08);

  // A deliberately stylised artist preparing the tray, animated by scroll.
  const artist = new THREE.Group(); artist.position.set(-0.04, 0, -7.85); artist.rotation.y = -0.55;
  // Retained for a future authored character; the primitive placeholder is hidden.
  artist.visible=false;scene.add(artist);
  const cloth = standard('#8c9187'), apron = standard('#272e2c'), skin = standard('#b98b6b');
  contact(0,0,1.1,.9,artist);
  [-0.13, 0.13].forEach(x => {
    const leg = cylinder(0.085, 0.075, 0.68, black, x, 0.4, 0, artist); leg.rotation.z = x * 0.3;
    round(0.19, 0.12, 0.32, black, x, 0.075, 0.07, artist);
  });
  const torso = mesh(new THREE.CapsuleGeometry(0.21, 0.37, 6, 20), cloth, 0, 1.0, 0, artist); torso.scale.z = 0.7;
  round(0.35, 0.48, 0.035, apron, 0, 0.93, 0.155, artist);
  round(.24,.14,.019,apron,0,.93,.18,artist);
  const stitching=standard('#9a947e');
  box(.23,.007,.005,stitching,0,.995,.193,artist);
  [-.11,.11].forEach(x=>{const strap=round(.025,.27,.016,apron,x,1.24,.137,artist);strap.rotation.z=-x*1.6;});
  cylinder(0.06, 0.07, 0.14, skin, 0, 1.38, 0, artist);
  const head = mesh(new THREE.SphereGeometry(0.133, 24, 18), skin, 0, 1.55, 0.02, artist); head.scale.set(.93,1.22,.94);head.rotation.x=.12;
  const hair = mesh(new THREE.SphereGeometry(0.14, 24, 16, 0, Math.PI * 2, 0, 1.65), ink, 0, 1.58, 0.008, artist);
  hair.rotation.x = -0.1;
  mesh(new THREE.SphereGeometry(0.095, 12, 8), ink, 0, 1.58, -0.13, artist);
  const movingArm = new THREE.Group(); movingArm.position.set(-0.26, 1.2, 0); artist.add(movingArm);
  const upper = cylinder(0.07, 0.065, 0.29, cloth, 0, -0.12, 0, movingArm); upper.rotation.z = -0.13;
  const forearm = cylinder(0.055, 0.045, 0.29, skin, -0.02, -0.25, 0.13, movingArm); forearm.rotation.x = -1.2;
  mesh(new THREE.SphereGeometry(0.055, 10, 8), black, -0.02, -0.29, 0.27, movingArm);
  const otherArm=new THREE.Group();otherArm.position.set(.25,1.21,0);otherArm.rotation.z=.12;artist.add(otherArm);
  mesh(new THREE.CapsuleGeometry(.068,.19,4,16),cloth,0,-.12,0,otherArm);
  const lower=mesh(new THREE.CapsuleGeometry(.045,.20,4,16),skin,0,-.3,.12,otherArm);lower.rotation.x=-.95;
  const glove=mesh(new THREE.SphereGeometry(.052,16,12),black,0,-.37,.24,otherArm);glove.scale.set(.85,1,1.3);
  round(.08,.013,.13,steel,0,-.36,.30,otherArm);

  scene.add(new THREE.HemisphereLight('#e5edf2','#514941',.40));
  // Keep the key inside the building: the old light was above an opaque roof.
  const sun=new THREE.DirectionalLight('#fff3dc',4.5);
  sun.position.set(4.1,3.4,-7);sun.target.position.set(-3,.15,-5);
  sun.castShadow=true;
  const mobile=host.clientWidth<700;
  sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:6,bottom:-6,near:.1,far:22});
  sun.shadow.bias=-.0002;sun.shadow.normalBias=.025;sun.shadow.radius=3;sun.shadow.blurSamples=8;
  scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight('#ece7df',.5);fill.position.set(-2,3,3);scene.add(fill);
  const receptionLight=new THREE.PointLight('#fff1dd',7,6,2);receptionLight.position.set(-2.2,3.15,-2.6);scene.add(receptionLight);

  const points = [
    { p: 0, position: [0, 1.65, 6.5], target: [0, 1.7, 3.4] },
    { p: 0.16, position: [0, 1.65, 5.5], target: [-0.3, 1.7, -1.8] },
    { p: 0.32, position: [0.15, 1.65, 1.0], target: [-1.4, 1.55, -2.4] },
    { p: 0.43, position: [-1.04, 1.72, -0.30], target: [-1.04, 1.55, -1.4] },
    { p: 0.69, position: [-1.04, 1.72, -0.30], target: [-1.04, 1.55, -1.4] },
    { p: 0.76, position: [-0.5, 1.68, 0.1], target: [-1.05, 1.5, -1.45] },
    { p: 0.79, position: [1.1, 1.7, -2.5], target: [0.9, 1.5, -7.7] },
    { p: 0.91, position: [1.25, 1.78, -5.0], target: [-0.8, 1.2, -8.0] },
    { p: 1, position: [1.15, 1.83, -5.8], target: [-0.75, 1.15, -8.2] },
  ];
  const pos = new THREE.Vector3(), target = new THREE.Vector3();
  const lerpVector = (a, b, t, result) => result.set(...a).lerp(new THREE.Vector3(...b), t);
  // AO grounds objects in corners and at joints; effects render only on demand.
  const mobileQuality=host.clientWidth<700;
  const composer=new EffectComposer(renderer);
  const renderPass=new RenderPass(scene,camera);
  const ao=new SSAOPass(scene,camera,1,1,mobileQuality?12:24);
  ao.kernelRadius=.42;ao.minDistance=.0002;ao.maxDistance=.035;
  const overrideVisibility=ao._overrideVisibility.bind(ao);
  ao._overrideVisibility=()=>{
    overrideVisibility();
    scene.traverse(obj=>{if(obj.isMesh&&obj.visible&&obj.material.transparent){obj.visible=false;ao._visibilityCache.push(obj);}});
  };
  const output=new OutputPass(),fxaa=new ShaderPass(FXAAShader);
  composer.addPass(renderPass);composer.addPass(ao);composer.addPass(output);composer.addPass(fxaa);
  function render(progress, reduced = false) {
    if(progress<.21||lastProgress<.21)renderer.shadowMap.needsUpdate=true;
    lastProgress = progress;lastReduced=reduced;
    let index = points.findIndex(point => point.p >= progress);
    index = Math.max(1, index === -1 ? points.length - 1 : index);
    const a = points[index - 1], b = points[index];
    const fraction = THREE.MathUtils.clamp((progress - a.p) / (b.p - a.p), 0, 1);
    const t = fraction * fraction * (3 - 2 * fraction);
    lerpVector(a.position, b.position, t, pos); lerpVector(a.target, b.target, t, target);
    camera.position.copy(pos); camera.lookAt(target);
    door.rotation.y = Math.PI * 0.53 * THREE.MathUtils.smoothstep(progress, 0.015, 0.19);
    movingArm.rotation.x = reduced ? -0.35 : -0.35 + Math.sin(progress * 65) * 0.12;
    // The camera is parked during the form story: reuse that frame until a
    // screen texture changes instead of running AO for every scroll event.
    const frame=[...pos.toArray(),...target.toArray(),door.rotation.y].map(v=>v.toFixed(5)).join(',');
    if(!needsSceneRender&&frame===lastFrame)return;
    needsSceneRender=false;lastFrame=frame;
    composer.render();
  }
  function resize() {
    needsSceneRender=true;
    const width = host.clientWidth, height = host.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.fov = width < 700 ? 65 : 54;
    camera.updateProjectionMatrix();
    // Bound both effects resolution and GPU memory on phones and large screens.
    const ratio=Math.min(window.devicePixelRatio||1,width<700?1.25:1.5,1800/Math.max(width,height));
    composer.setPixelRatio(ratio);composer.setSize(width,height);
    ao.setSize(Math.max(1,Math.round(width*.7)),Math.max(1,Math.round(height*.7)));
    fxaa.material.uniforms.resolution.value.set(1/(width*ratio),1/(height*ratio));
    render(lastProgress,lastReduced);
  }
  resize();
  return {
    render, resize, setTabletState,
    tabletAnchor() {
      const point = tablet.getWorldPosition(new THREE.Vector3()).project(camera);
      const rect = host.getBoundingClientRect();
      return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
    },
    dispose() {
      disposed=true;
      tabletImages.forEach(img=>{img.onload=null;img.onerror=null;});
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      composer.passes.forEach(pass=>pass.dispose());composer.dispose();
      environment.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
