import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// All geometry and artwork are made locally. No models, fonts or textures are
// fetched by the scene, so the walkthrough also works with a slow connection.
export function createStudioScene(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#191e1b');
  scene.fog = new THREE.Fog('#292e27', 14, 32);
  const camera = new THREE.PerspectiveCamera(54, 1, 0.08, 45);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const textures = new Set();
  const materials = new Set();
  const geometries = new Set();
  const standard = (color, options = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...options });
    materials.add(m);
    return m;
  };
  const ink = standard('#202923');
  const plaster = standard('#697363');
  const darkWall = standard('#3c4a3e');
  const cream = standard('#e2d7bb');
  const black = standard('#151c1b', { roughness: 0.65 });
  const brass = standard('#b49861', { metalness: 0.65, roughness: 0.3 });
  const steel = standard('#79817e', { metalness: 0.75, roughness: 0.32 });
  const leather = standard('#48554a', { roughness: 0.76 });
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
  const box = (w, h, d, mat, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const round = (w, h, d, mat, x, y, z, parent) => mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.18), mat, x, y, z, parent);
  const cylinder = (r, r2, h, mat, x, y, z, parent) => mesh(new THREE.CylinderGeometry(r, r2, h, 20), mat, x, y, z, parent);
  function canvasTexture(draw, width = 512, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    return texture;
  }
  const woodTexture = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#92734f'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = i * 1.97;
      ctx.strokeStyle = `rgba(43,27,13,${0.06 + (i % 7) * 0.012})`;
      ctx.beginPath(); ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + Math.sin(i) * 9, h * 0.3, x - 5, h * 0.65, x + 2, h);
      ctx.stroke();
    }
  });
  const wood = standard('#d2b78f', { map: woodTexture });
  const signTexture = canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h); ctx.textAlign = 'center';
    ctx.fillStyle = '#f1e6cd'; ctx.font = 'bold 150px Arial'; ctx.fillText('vanta.', w / 2, 171);
    ctx.font = '20px Arial'; ctx.fillText('T A T T O O   S T U D I O', w / 2, 224);
  }, 640, 280);
  const signMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  materials.add(signMat);
  const sign = (w, h, x, y, z, parent) => mesh(new THREE.PlaneGeometry(w, h), signMat, x, y, z, parent);

  // Open central aisle, reception to the left, workstations at the back.
  box(9, 0.18, 20, wood, 0, -0.1, -5);
  const floorLines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.006, 20), ink, 30);
  geometries.add(floorLines.geometry);
  for (let i = 0; i < 30; i++) floorLines.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-4.35 + i * 0.3, 0, -5));
  scene.add(floorLines);
  box(0.2, 4.4, 20, plaster, -4.5, 2.2, -5);
  box(0.2, 4.4, 20, plaster, 4.5, 2.2, -5);
  box(9, 4.4, 0.2, darkWall, 0, 2.2, -14.7);
  box(9, 0.14, 20, ink, 0, 4.45, -5);
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
  box(3.65, 1.07, 1.0, wood, -1.82, 0.56, -1.6);
  round(3.85, 0.11, 1.18, cream, -1.82, 1.15, -1.6);
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 1.01, 0.028), brass, 60);
  geometries.add(slats.geometry);
  for (let i = 0; i < 60; i++) slats.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-3.57 + i * 0.059, 0.57, -1.085));
  scene.add(slats);
  box(4.25, 3.6, 0.15, darkWall, -2.25, 1.8, -3.7);
  sign(2.3, 1.0, -2.2, 2.63, -3.61);
  box(0.45, 0.035, 0.35, black, -1.04, 1.22, -1.38);
  const tablet = new THREE.Group(); tablet.position.set(-1.04, 1.55, -1.4); tablet.rotation.x = -0.19; scene.add(tablet);
  round(0.69, 0.46, 0.035, black, 0, 0, 0, tablet);
  const screenTexture = canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#e9e1cf'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#253b2e'; ctx.font = 'bold 35px Arial'; ctx.fillText('Make it yours.', 32, 61);
    ctx.font = '17px Arial'; ctx.fillText('Your next piece starts here.', 32, 94);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#d4cebd'; ctx.fillRect(32, 123 + i * 50, 448, 34); }
    ctx.fillStyle = '#355443'; ctx.fillRect(32, 284, 448, 42);
    ctx.fillStyle = '#f6f1e6'; ctx.fillText('Send enquiry  →', 168, 312);
  }, 512, 350);
  let tabletState = 'form';
  const initialTablet = screenTexture.image.getContext('2d').getImageData(0, 0, 512, 350);
  function setTabletState(state) {
    if (state === tabletState) return;
    tabletState = state;
    const ctx = screenTexture.image.getContext('2d');
    if (state === 'form') ctx.putImageData(initialTablet, 0, 0);
    else {
      ctx.fillStyle = '#e9e1cf'; ctx.fillRect(0, 0, 512, 350);
      ctx.fillStyle = '#253b2e'; ctx.font = 'bold 35px Arial'; ctx.fillText('Mia Carter', 32, 65);
      ctx.font = '19px Arial'; ctx.fillText('Botanical piece · Alex Morgan', 32, 103);
      ctx.fillStyle = '#d4ddcb'; ctx.fillRect(32, 139, 448, 86);
      ctx.fillStyle = '#355443'; ctx.font = '23px Arial';
      ctx.fillText(state === 'enquiry' ? 'New enquiry received' : 'Friday · 10 am · Confirmed', 48, 189);
      ctx.font = '18px Arial'; ctx.fillText(state === 'signed' ? 'Deposit paid · Consent stored' : state === 'confirmed' ? 'Deposit paid' : 'Ready for the artist to review', 32, 276);
    }
    screenTexture.needsUpdate = true;
  }
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture }); materials.add(screenMat);
  mesh(new THREE.PlaneGeometry(0.64, 0.42), screenMat, 0, 0, 0.02, tablet);
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
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.85); ctx.bezierCurveTo(w * 0.3, h * 0.6, w * 0.64, h * 0.4, w / 2, h * 0.15); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const y = h * (0.25 + i * 0.09), dir = i % 2 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(w / 2, y + 30);
        ctx.bezierCurveTo(w / 2 + dir * (70 + variant * 8), y + 10, w / 2 + dir * 65, y - 65, w / 2, y + 30);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(w / 2, h * 0.12, 13 + variant * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '14px Georgia'; ctx.textAlign = 'center'; ctx.fillText(['BOTANICA', 'EVERGROWING', 'STILL LIFE'][variant % 3], w / 2, h * 0.94);
    }, 256, 384);
    const mat = standard('#ffffff', { map: texture });
    mesh(new THREE.PlaneGeometry(0.73, 1.03), mat, 0, 0, 0.039, group);
  }
  flash(-3.3, 2.65, -3.60, 0);
  [-6.3, -8.3, -10.3].forEach((z, i) => flash(-4.37, 2.5, z, i, Math.PI / 2));
  [0.3, -1.1].forEach((z, i) => flash(4.37, 2.35, z, i, -Math.PI / 2));
  [-2.5, 0, 2.5].forEach((x, i) => flash(x, 2.6, -14.56, i));

  function plant(x, z, size = 1) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(size); scene.add(group);
    cylinder(0.26, 0.19, 0.49, standard('#b39a77'), 0, 0.25, 0, group);
    const leaf = standard('#405d37');
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.399, height = 0.62 + i * 0.093;
      const stem = cylinder(0.009, 0.012, height, leaf, Math.sin(angle) * 0.1, 0.5 + height / 2, Math.cos(angle) * 0.1, group);
      stem.rotation.z = Math.sin(angle) * 0.2;
      const l = mesh(new THREE.SphereGeometry(1, 10, 8), leaf, Math.sin(angle) * 0.27, 0.5 + height, Math.cos(angle) * 0.27, group);
      l.scale.set(0.16, 0.32, 0.045); l.rotation.set(0.4, angle, -0.5);
    }
  }
  plant(-3.92, -0.4); plant(3.8, -4.3, 1.2); plant(-3.8, -13.6, 1.25);

  function pendant(x, z) {
    cylinder(0.012, 0.012, 1.05, black, x, 3.89, z);
    cylinder(0.07, 0.37, 0.26, brass, x, 3.27, z);
    cylinder(0.3, 0.3, 0.025, glow, x, 3.13, z);
    const light = new THREE.PointLight('#ffd99a', 11, 8, 2); light.position.set(x, 2.95, z); scene.add(light);
  }
  pendant(-1.7, -1.4); pendant(1.5, -6.2); pendant(-1.7, -11.4);
  // Luminous window panes give the rear room a softer daylight contrast.
  const windowMat = standard('#cedbc9', { emissive: '#cedbc9', emissiveIntensity: 0.6 });
  [-7, -11].forEach(z => {
    box(0.07, 2.0, 2.6, ink, 4.37, 2.45, z);
    box(0.075, 1.87, 2.45, windowMat, 4.32, 2.45, z);
    box(0.11, 2, 0.055, ink, 4.25, 2.45, z);
    box(0.11, 0.05, 2.5, ink, 4.25, 2.45, z);
  });

  function bed(x, z, angle = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = angle; scene.add(g);
    round(0.72, 0.09, 0.85, black, 0, 0.08, 0, g);
    cylinder(0.085, 0.12, 0.65, steel, 0, 0.42, 0, g);
    round(0.86, 0.18, 1.15, leather, 0, 0.83, 0.24, g);
    const back = round(0.86, 0.17, 0.82, leather, 0, 1.02, -0.62, g); back.rotation.x = 0.4;
    const head = round(0.46, 0.15, 0.3, leather, 0, 1.22, -1.08, g); head.rotation.x = 0.4;
    [-0.61, 0.61].forEach(side => {
      cylinder(0.023, 0.023, 0.4, steel, side, 0.84, -0.25, g);
      round(0.22, 0.1, 0.56, leather, side, 1.05, -0.25, g);
    });
    // Instrument trolley and a task light.
    const trayX = 1.1;
    [0.38, 0.88].forEach(y => round(0.58, 0.05, 0.55, steel, trayX, y, -0.4, g));
    [-0.22, 0.22].forEach(offset => cylinder(0.016, 0.016, 0.85, steel, trayX + offset, 0.46, -0.4, g));
    [0, 1, 2].forEach(i => {
      cylinder(0.035, 0.035, 0.12, i % 2 ? cream : ink, trayX - 0.14 + i * 0.13, 0.96, -0.5, g);
      cylinder(0.012, 0.018, 0.05, black, trayX - 0.14 + i * 0.13, 1.045, -0.5, g);
    });
    cylinder(0.022, 0.022, 1.7, steel, -1.0, 0.92, -0.7, g);
    const arm = box(0.025, 0.025, 0.7, steel, -1.0, 1.76, -0.4, g); arm.rotation.x = -0.18;
    const lamp = cylinder(0.13, 0.17, 0.09, cream, -1, 1.7, -0.06, g); lamp.rotation.z = -0.3;
    cylinder(0.15, 0.15, 0.015, glow, -1.0, 1.65, -0.06, g);
  }
  bed(-1.6, -7.5, 0.12); bed(2, -10.8, -0.12); bed(-2.2, -12.2, 0.08);

  // A deliberately stylised artist preparing the tray, animated by scroll.
  const artist = new THREE.Group(); artist.position.set(-0.04, 0, -7.85); artist.rotation.y = -0.55; scene.add(artist);
  const cloth = standard('#bcb49e'), apron = standard('#303d33'), skin = standard('#b98b6b');
  [-0.13, 0.13].forEach(x => {
    const leg = cylinder(0.085, 0.075, 0.68, black, x, 0.4, 0, artist); leg.rotation.z = x * 0.3;
    round(0.19, 0.12, 0.32, black, x, 0.075, 0.07, artist);
  });
  const torso = mesh(new THREE.CapsuleGeometry(0.22, 0.34, 4, 12), cloth, 0, 1.0, 0, artist); torso.scale.z = 0.7;
  round(0.36, 0.43, 0.035, apron, 0, 0.96, 0.155, artist);
  cylinder(0.06, 0.07, 0.14, skin, 0, 1.38, 0, artist);
  const head = mesh(new THREE.SphereGeometry(0.145, 16, 12), skin, 0, 1.55, 0.02, artist); head.scale.y = 1.13;
  const hair = mesh(new THREE.SphereGeometry(0.151, 16, 10, 0, Math.PI * 2, 0, 1.65), ink, 0, 1.58, 0.008, artist);
  hair.rotation.x = -0.1;
  mesh(new THREE.SphereGeometry(0.095, 12, 8), ink, 0, 1.58, -0.13, artist);
  const movingArm = new THREE.Group(); movingArm.position.set(-0.26, 1.2, 0); artist.add(movingArm);
  const upper = cylinder(0.07, 0.065, 0.29, cloth, 0, -0.12, 0, movingArm); upper.rotation.z = -0.13;
  const forearm = cylinder(0.055, 0.045, 0.29, skin, -0.02, -0.25, 0.13, movingArm); forearm.rotation.x = -1.2;
  mesh(new THREE.SphereGeometry(0.055, 10, 8), black, -0.02, -0.29, 0.27, movingArm);
  const otherArm = cylinder(0.07, 0.055, 0.49, cloth, 0.28, 1.01, 0.06, artist); otherArm.rotation.z = 0.12;

  scene.add(new THREE.HemisphereLight('#e3e5d3', '#524332', 2.1));
  const sun = new THREE.DirectionalLight('#ffe6bc', 3.4);
  sun.position.set(3.8, 6, 0); sun.target.position.set(-1, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 12, bottom: -12, near: 0.5, far: 28 });
  sun.shadow.bias = -0.001; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#d8e1e3', 1.1); fill.position.set(-2, 3, 5); scene.add(fill);

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
  let lastProgress = 0;
  function render(progress, reduced = false) {
    lastProgress = progress;
    let index = points.findIndex(point => point.p >= progress);
    index = Math.max(1, index === -1 ? points.length - 1 : index);
    const a = points[index - 1], b = points[index];
    const fraction = THREE.MathUtils.clamp((progress - a.p) / (b.p - a.p), 0, 1);
    const t = fraction * fraction * (3 - 2 * fraction);
    lerpVector(a.position, b.position, t, pos); lerpVector(a.target, b.target, t, target);
    camera.position.copy(pos); camera.lookAt(target);
    door.rotation.y = Math.PI * 0.53 * THREE.MathUtils.smoothstep(progress, 0.015, 0.19);
    movingArm.rotation.x = reduced ? -0.35 : -0.35 + Math.sin(progress * 65) * 0.12;
    renderer.render(scene, camera);
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.fov = width < 700 ? 65 : 54;
    camera.updateProjectionMatrix();
    render(lastProgress);
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
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
