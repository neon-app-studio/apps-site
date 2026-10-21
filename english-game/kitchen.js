// Procedural low-poly kitchen. Every model is built from three.js primitives in code (no external assets).
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const M = (color, roughness = 0.6, metalness = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function add(geo, mat, parent, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  parent.add(m);
  return m;
}
const box = (w, h, d, mat, p, x, y, z, o) => add(new THREE.BoxGeometry(w, h, d), mat, p, x, y, z, o);
const rbox = (w, h, d, r, mat, p, x, y, z, o) => add(new RoundedBoxGeometry(w, h, d, 3, r), mat, p, x, y, z, o);
const cyl = (rt, rb, h, mat, p, x, y, z, seg = 28, o) => add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, p, x, y, z, o);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// ---------- palette ----------
const P = {
  steel: M('#c9cdd2', 0.28, 0.9),
  steelDark: M('#8f959c', 0.4, 0.85),
  chrome: M('#e4e7ea', 0.15, 1.0),
  black: M('#1b1c1f', 0.45, 0.1),
  blackGlass: M('#0c0d10', 0.12, 0.3),
  cabinet: M('#3f6f7c', 0.55, 0.05),
  cabinetUp: M('#f4f0e8', 0.55, 0.0),
  counter: M('#efeae1', 0.3, 0.0),
  wall: M('#f3e2c6', 0.9, 0.0),
  wood: M('#c48a52', 0.6, 0.0),
  woodDark: M('#7a4f2c', 0.6, 0.0),
  white: M('#f7f7f5', 0.4, 0.0),
};

export function buildKitchen(scene) {
  const targets = {};
  const tweens = [];
  const root = new THREE.Group();
  scene.add(root);

  const tween = (dur, fn, done) => tweens.push({ t: 0, dur, fn, done });

  // ---------- room ----------
  const floorTex = canvasTex(512, 512, (g, w, h) => {
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -120;
      while (x < w) {
        const len = 180 + Math.random() * 160;
        const l = 52 + Math.random() * 10;
        g.fillStyle = `hsl(28, 42%, ${l}%)`;
        g.fillRect(x, r * (h / rows), len, h / rows);
        g.strokeStyle = 'rgba(70,40,20,0.35)';
        g.lineWidth = 2;
        g.strokeRect(x, r * (h / rows), len, h / rows);
        g.strokeStyle = 'rgba(90,55,25,0.12)';
        g.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          const yy = r * (h / rows) + 6 + Math.random() * (h / rows - 12);
          g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + 3, x + len * 0.6, yy - 3, x + len, yy); g.stroke();
        }
        x += len;
      }
    }
  }, [3, 3]);
  const floor = add(new THREE.PlaneGeometry(5.6, 5.2), M('#ffffff', 0.7, 0, { map: floorTex }), root, -0.07, 0, 0.55, { cast: false });
  floor.rotation.x = -Math.PI / 2;

  const back = add(new THREE.PlaneGeometry(5.6, 2.7), P.wall, root, -0.07, 1.35, -2.0, { cast: false });
  const left = add(new THREE.PlaneGeometry(5.2, 2.7), P.wall, root, -2.8, 1.35, 0.55, { cast: false });
  left.rotation.y = Math.PI / 2;
  const right = add(new THREE.PlaneGeometry(5.2, 2.7), P.wall, root, 2.65, 1.35, 0.55, { cast: false });
  right.rotation.y = -Math.PI / 2;
  const ceil = add(new THREE.PlaneGeometry(5.6, 5.2), M('#fbf6ee', 0.95), root, -0.07, 2.7, 0.55, { cast: false });
  ceil.rotation.x = Math.PI / 2;

  const tileTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, w, h);
    const tw = 128, th = 64;
    for (let r = 0; r < h / th; r++) for (let c = -1; c < w / tw + 1; c++) {
      const x = c * tw + (r % 2) * (tw / 2), y = r * th;
      const grd = g.createLinearGradient(x, y, x, y + th);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#eef3f3');
      g.fillStyle = grd; g.fillRect(x + 3, y + 3, tw - 6, th - 6);
    }
  }, [5, 2.2]);
  add(new THREE.PlaneGeometry(4.45, 0.7), M('#ffffff', 0.25, 0, { map: tileTex }), root, 0.33, 1.27, -1.995, { cast: false });

  // base cabinets + counters
  function baseRun(x0, x1) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    box(w, 0.8, 0.56, P.cabinet, root, cx, 0.48, -1.72);
    box(w, 0.08, 0.5, P.black, root, cx, 0.04, -1.75);
    const n = Math.max(1, Math.round(w / 0.5));
    const dw = w / n;
    for (let i = 0; i < n; i++) {
      const dx = x0 + dw * (i + 0.5);
      rbox(dw - 0.02, 0.76, 0.025, 0.008, P.cabinet, root, dx, 0.48, -1.43);
      box(0.12, 0.014, 0.02, P.chrome, root, dx, 0.8, -1.405);
    }
    box(w + 0.03, 0.04, 0.63, P.counter, root, cx, 0.9, -1.69);
  }
  baseRun(-1.9, -0.39);
  baseRun(0.39, 2.65);

  function upperRun(x0, x1, y0 = 1.62, h = 0.7) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    box(w, h, 0.34, P.cabinetUp, root, cx, y0 + h / 2, -1.83);
    const n = Math.max(1, Math.round(w / 0.45));
    const dw = w / n;
    for (let i = 0; i < n; i++) {
      const dx = x0 + dw * (i + 0.5);
      rbox(dw - 0.02, h - 0.03, 0.022, 0.008, P.cabinetUp, root, dx, y0 + h / 2, -1.655);
      box(0.014, 0.1, 0.02, P.chrome, root, dx + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), y0 + 0.09, -1.635);
    }
  }
  upperRun(-1.9, -0.42);
  upperRun(0.42, 1.62);
  upperRun(-2.72, -1.88, 2.05, 0.45);

  // window over the sink
  const winMat = M('#bfe3ff', 0.2, 0, { emissive: new THREE.Color('#d8efff'), emissiveIntensity: 1.1 });
  box(0.86, 0.8, 0.02, winMat, root, 2.08, 1.62, -1.99, { cast: false });
  const frame = M('#ffffff', 0.5);
  box(0.94, 0.05, 0.06, frame, root, 2.08, 2.04, -1.97);
  box(0.94, 0.06, 0.12, frame, root, 2.08, 1.2, -1.95);
  box(0.05, 0.86, 0.06, frame, root, 1.63, 1.62, -1.97);
  box(0.05, 0.86, 0.06, frame, root, 2.53, 1.62, -1.97);
  box(0.03, 0.8, 0.04, frame, root, 2.08, 1.62, -1.97);
  box(0.86, 0.03, 0.04, frame, root, 2.08, 1.62, -1.97);
  // little herb pot on the sill
  cyl(0.05, 0.04, 0.08, M('#c8643c', 0.8), root, 2.4, 1.27, -1.93);
  for (let i = 0; i < 5; i++) {
    const s = add(new THREE.SphereGeometry(0.04, 10, 8), M('#4f9a4a', 0.8), root, 2.4 + (Math.random() - 0.5) * 0.06, 1.34 + Math.random() * 0.04, -1.93 + (Math.random() - 0.5) * 0.05);
    s.scale.y = 1.3;
  }

  // pendant lamp
  cyl(0.004, 0.004, 0.3, P.black, root, 0, 2.55, -0.3, 6, { cast: false });
  const shade = add(new THREE.ConeGeometry(0.16, 0.16, 28, 1, true), M('#2e5560', 0.5, 0.2, { side: THREE.DoubleSide }), root, 0, 2.38, -0.3, { cast: false });
  add(new THREE.SphereGeometry(0.05, 16, 10), M('#fff6d8', 0.3, 0, { emissive: new THREE.Color('#ffe7a8'), emissiveIntensity: 2.5 }), root, 0, 2.32, -0.3, { cast: false });

  // utensil rail
  const rail = cyl(0.008, 0.008, 1.0, P.chrome, root, -1.0, 1.47, -1.96, 10);
  rail.rotation.z = Math.PI / 2;
  [-1.48, -0.52].forEach((x) => cyl(0.012, 0.012, 0.05, P.chrome, root, x, 1.47, -1.98, 10).rotation.x = Math.PI / 2);

  // ---------- target helpers ----------
  function makeTarget(id, group, proxySize, proxyOffset, opts = {}) {
    group.userData.targetId = id;
    const mats = [];
    group.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        mats.push({ m: o.material, e: o.material.emissive.clone(), i: o.material.emissiveIntensity });
        o.userData.targetId = id;
      }
    });
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...proxySize), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(...proxyOffset);
    proxy.userData.targetId = id;
    group.add(proxy);
    root.add(group);
    targets[id] = { id, group, proxy, mats, small: !!opts.small, act: opts.act || (() => {}), base: group.scale.clone() };
    return targets[id];
  }

  // ---------- particles (steam / sparks) ----------
  const puffTex = canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  });
  const particles = [];
  function spawn(pos, { n = 10, color = '#ffffff', speed = 0.4, up = 0.5, life = 1.2, size = 0.08, grow = 1.5, gravity = 0, additive = false, spread = 0.03 }) {
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({ map: puffTex, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      const s = new THREE.Sprite(mat);
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread));
      s.scale.setScalar(size);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      dir.y += up * (0.6 + Math.random() * 0.6);
      s.renderOrder = 10;
      root.add(s);
      particles.push({ s, v: dir, life, age: -Math.random() * (additive ? 0 : life * 0.5), size, grow, gravity });
    }
  }
  const steam = (pos, n = 12) => spawn(pos, { n, color: '#ffffff', speed: 0.06, up: 0.28, life: 1.6, size: 0.06, grow: 3, spread: 0.02 });

  // ---------- FRIDGE ----------
  {
    const g = new THREE.Group(); g.position.set(-2.3, 0, -1.63);
    const body = M('#e6e9ec', 0.3, 0.55);
    rbox(0.8, 1.9, 0.66, 0.03, body, g, 0, 0.95, 0);
    const inside = canvasTex(256, 384, (c, w, h) => {
      c.fillStyle = '#eef8ff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#cfe3ee';
      [120, 230, 320].forEach((y) => c.fillRect(0, y, w, 8));
      const items = [[20, 60, 40, 60, '#ffffff'], [70, 50, 34, 70, '#e85d4a'], [120, 80, 60, 40, '#ffd34d'], [190, 70, 40, 50, '#7cc576'],
        [20, 170, 70, 60, '#f3a64a'], [110, 160, 30, 70, '#4a8fe8'], [160, 185, 70, 45, '#f4f0e0'], [30, 270, 90, 50, '#91d07a'], [140, 275, 80, 45, '#e96d8a']];
      items.forEach(([x, y, iw, ih, col]) => { c.fillStyle = col; c.fillRect(x, y, iw, ih); });
    });
    const lit = add(new THREE.PlaneGeometry(0.72, 1.12), new THREE.MeshStandardMaterial({ map: inside, emissive: new THREE.Color('#ffffff'), emissiveMap: inside, emissiveIntensity: 0.9 }), g, 0, 0.66, 0.332, { cast: false });
    const lower = new THREE.Group(); lower.position.set(-0.4, 0.66, 0.35); g.add(lower);
    rbox(0.79, 1.22, 0.04, 0.012, body, lower, 0.395, 0, 0);
    box(0.025, 0.55, 0.035, P.chrome, lower, 0.72, 0.3, 0.035);
    const upper = new THREE.Group(); upper.position.set(-0.4, 1.6, 0.35); g.add(upper);
    rbox(0.79, 0.6, 0.04, 0.012, body, upper, 0.395, 0, 0);
    box(0.025, 0.3, 0.035, P.chrome, upper, 0.72, -0.12, 0.035);
    box(0.76, 0.06, 0.6, P.black, g, 0, 0.03, 0);
    makeTarget('fridge', g, [0.84, 1.94, 0.74], [0, 0.95, 0.02], {
      act: (sfx) => {
        sfx.whoosh();
        tween(0.35, (t) => (lower.rotation.y = -1.25 * easeOut(t)), () =>
          setTimeout(() => tween(0.4, (t) => (lower.rotation.y = -1.25 * (1 - easeIn(t))), () => sfx.thud()), 1100));
        steam(new THREE.Vector3(-2.15, 0.9, -1.2), 8);
      },
    });
  }

  // ---------- STOVE ----------
  {
    const g = new THREE.Group(); g.position.set(0, 0, -1.7);
    box(0.76, 0.84, 0.58, P.steel, g, 0, 0.46, 0);
    box(0.68, 0.52, 0.02, P.steelDark, g, 0, 0.38, 0.3);
    box(0.5, 0.26, 0.022, P.blackGlass, g, 0, 0.4, 0.305);
    const hb = cyl(0.012, 0.012, 0.56, P.chrome, g, 0, 0.67, 0.345, 12); hb.rotation.z = Math.PI / 2;
    [-0.26, 0.26].forEach((x) => box(0.02, 0.02, 0.04, P.chrome, g, x, 0.67, 0.325));
    box(0.76, 0.1, 0.03, P.black, g, 0, 0.8, 0.3);
    const knobs = [-0.27, -0.09, 0.09, 0.27].map((x) => { const k = cyl(0.022, 0.022, 0.026, P.chrome, g, x, 0.8, 0.325, 16); k.rotation.x = Math.PI / 2; return k; });
    box(0.78, 0.03, 0.62, P.blackGlass, g, 0, 0.905, 0.01);
    const burnerMat = M('#2a2a2c', 0.5, 0.2, { emissive: new THREE.Color('#ff3a10'), emissiveIntensity: 0 });
    const burners = [[-0.17, 0.14], [0.17, -0.13], [0.17, 0.14], [-0.17, -0.13]].map(([x, z]) => {
      const r = add(new THREE.RingGeometry(0.055, 0.1, 36), burnerMat, g, x, 0.9215, z, { cast: false });
      r.rotation.x = -Math.PI / 2; return r;
    });
    // range hood
    const hood = add(new THREE.CylinderGeometry(0.2, 0.56, 0.24, 4, 1), P.steel, root, 0, 1.86, -1.78);
    hood.rotation.y = Math.PI / 4; hood.scale.z = 0.62;
    box(0.26, 0.6, 0.22, P.steel, root, 0, 2.28, -1.89);
    makeTarget('stove', g, [0.8, 0.94, 0.66], [0, 0.46, 0.02], {
      act: (sfx) => {
        sfx.click(); sfx.sizzle();
        const ms = burners.map((b) => b.material);
        knobs.forEach((k) => tween(0.3, (u) => (k.rotation.y = -1.6 * easeOut(u))));
        tween(2.6, (u) => ms.forEach((m) => (m.emissiveIntensity = 2.2 * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85))), () => {
          ms.forEach((m) => (m.emissiveIntensity = 0)); knobs.forEach((k) => (k.rotation.y = 0));
        });
      },
    });
  }

  // ---------- FRYING PAN ----------
  {
    const g = new THREE.Group(); g.position.set(-0.17, 0.922, -1.56); g.rotation.y = 0.7;
    const prof = [[0, 0], [0.1, 0], [0.125, 0.04], [0.132, 0.046], [0.124, 0.047], [0.1, 0.009], [0, 0.009]].map(([x, y]) => new THREE.Vector2(x, y));
    add(new THREE.LatheGeometry(prof, 40), M('#2b2c31', 0.42, 0.35, { side: THREE.DoubleSide }), g);
    const h = rbox(0.2, 0.022, 0.03, 0.008, P.black, g, -0.22, 0.05, 0); h.rotation.z = -0.15;
    const egg = new THREE.Group(); egg.visible = false; g.add(egg);
    const white = add(new THREE.SphereGeometry(0.06, 20, 10), M('#ffffff', 0.4), egg, 0, 0.012, 0); white.scale.set(1.1, 0.12, 0.9);
    const yolk = add(new THREE.SphereGeometry(0.022, 16, 10), M('#ffb300', 0.25), egg, 0.01, 0.02, 0); yolk.scale.y = 0.6;
    makeTarget('frying_pan', g, [0.46, 0.14, 0.3], [-0.07, 0.03, 0], {
      small: true,
      act: (sfx) => {
        sfx.sizzle(); egg.visible = true;
        tween(0.25, (u) => egg.scale.setScalar(0.3 + 0.7 * easeOut(u)));
        steam(new THREE.Vector3(-0.17, 0.98, -1.56), 10);
        setTimeout(() => (egg.visible = false), 2200);
      },
    });
  }

  // ---------- POT ----------
  {
    const g = new THREE.Group(); g.position.set(0.17, 0.922, -1.83);
    add(new THREE.CylinderGeometry(0.12, 0.115, 0.16, 36, 1, true), M('#c9cdd2', 0.28, 0.9, { side: THREE.DoubleSide }), g, 0, 0.08, 0);
    cyl(0.115, 0.115, 0.004, P.steel, g, 0, 0.002, 0, 36);
    const rim = add(new THREE.TorusGeometry(0.12, 0.004, 8, 40), P.chrome, g, 0, 0.16, 0); rim.rotation.x = Math.PI / 2;
    const lid = new THREE.Group(); lid.position.y = 0.162; g.add(lid);
    const dome = add(new THREE.SphereGeometry(0.125, 32, 8, 0, Math.PI * 2, 0, 0.5), P.steel, lid, 0, -0.106, 0);
    cyl(0.014, 0.018, 0.025, P.black, lid, 0, 0.03, 0, 16);
    [-1, 1].forEach((s) => { const hh = add(new THREE.TorusGeometry(0.025, 0.007, 8, 16), P.black, g, s * 0.13, 0.13, 0); hh.rotation.x = Math.PI / 2; });
    makeTarget('pot', g, [0.34, 0.26, 0.3], [0, 0.1, 0], {
      small: true,
      act: (sfx) => {
        sfx.clink();
        tween(1.2, (u) => { lid.position.y = 0.162 + Math.abs(Math.sin(u * 30)) * 0.02 * (1 - u); lid.rotation.z = Math.sin(u * 25) * 0.05 * (1 - u); });
        steam(new THREE.Vector3(0.17, 1.12, -1.83), 14);
      },
    });
  }

  // ---------- KETTLE ----------
  {
    const g = new THREE.Group(); g.position.set(0.66, 0.92, -1.72); g.rotation.y = -0.5;
    const prof = [[0, 0], [0.09, 0], [0.108, 0.035], [0.104, 0.1], [0.075, 0.155], [0.035, 0.172], [0, 0.175]].map(([x, y]) => new THREE.Vector2(x, y));
    const red = M('#d6392c', 0.28, 0.1);
    add(new THREE.LatheGeometry(prof, 36), red, g);
    add(new THREE.SphereGeometry(0.018, 14, 10), P.black, g, 0, 0.185, 0);
    const handle = add(new THREE.TorusGeometry(0.07, 0.011, 8, 24, Math.PI), P.black, g, 0, 0.165, 0);
    const spout = cyl(0.01, 0.022, 0.12, red, g, 0.12, 0.1, 0, 14); spout.rotation.z = -0.9;
    makeTarget('kettle', g, [0.32, 0.3, 0.24], [0.02, 0.12, 0], {
      small: true,
      act: (sfx) => {
        sfx.whistle();
        const p = new THREE.Vector3(0.17, 0.14, 0); g.localToWorld(p);
        steam(p, 16);
        tween(0.9, (u) => (g.position.y = 0.92 + Math.abs(Math.sin(u * 40)) * 0.006 * (1 - u)));
      },
    });
  }

  // ---------- TOASTER ----------
  {
    const g = new THREE.Group(); g.position.set(-1.6, 0.92, -1.74); g.rotation.y = 0.25;
    rbox(0.27, 0.18, 0.15, 0.04, M('#dfe2e5', 0.2, 0.95), g, 0, 0.095, 0);
    box(0.28, 0.012, 0.16, P.black, g, 0, 0.006, 0);
    [-0.03, 0.03].forEach((z) => box(0.19, 0.006, 0.026, P.black, g, 0, 0.184, z, { cast: false }));
    const toastMat = M('#d39a55', 0.9);
    const toasts = [-0.03, 0.03].map((z) => box(0.15, 0.11, 0.016, toastMat, g, 0, 0.12, z));
    box(0.03, 0.018, 0.035, P.black, g, 0.15, 0.13, 0);
    cyl(0.012, 0.012, 0.012, P.black, g, 0.14, 0.05, 0.07, 12).rotation.x = Math.PI / 2;
    makeTarget('toaster', g, [0.34, 0.26, 0.22], [0, 0.11, 0], {
      small: true,
      act: (sfx) => {
        sfx.pop();
        tween(0.35, (u) => toasts.forEach((t) => (t.position.y = 0.12 + 0.09 * easeOutBack(u))), () =>
          setTimeout(() => tween(0.3, (u) => toasts.forEach((t) => (t.position.y = 0.21 - 0.09 * u))), 1600));
      },
    });
  }

  // ---------- CUTTING BOARD + ONION ----------
  {
    const g = new THREE.Group(); g.position.set(-0.98, 0.92, -1.64); g.rotation.y = -0.08;
    rbox(0.42, 0.022, 0.26, 0.008, M('#d4a06a', 0.65), g, 0, 0.011, 0);
    const onion = add(new THREE.SphereGeometry(0.036, 18, 12), M('#c7955a', 0.55), g, -0.12, 0.055, -0.05); onion.scale.y = 0.9;
    cyl(0.002, 0.008, 0.02, M('#8a6a3a', 0.8), g, -0.12, 0.092, -0.05, 8);
    makeTarget('cutting_board', g, [0.44, 0.05, 0.28], [0, 0.015, 0], { small: true, act: (sfx) => sfx.thud() });
  }

  // ---------- KNIFE ----------
  {
    const g = new THREE.Group(); g.position.set(-0.94, 0.946, -1.6); g.rotation.y = 0.35;
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(0.15, 0); sh.quadraticCurveTo(0.2, 0.01, 0.215, 0.036); sh.lineTo(0, 0.04); sh.lineTo(0, 0);
    const blade = add(new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false }), M('#e9edf1', 0.18, 1.0), g, 0, 0, 0.02);
    blade.rotation.x = -Math.PI / 2;
    rbox(0.11, 0.018, 0.026, 0.008, P.black, g, -0.055, 0.004, 0.0);
    [-0.08, -0.03].forEach((x) => cyl(0.004, 0.004, 0.02, P.chrome, g, x, 0.005, 0, 8));
    makeTarget('knife', g, [0.38, 0.07, 0.1], [0.05, 0.02, 0], {
      small: true,
      act: (sfx) => { sfx.chop(); tween(0.5, (u) => (g.position.y = 0.946 + Math.abs(Math.sin(u * Math.PI * 3)) * 0.05)); },
    });
  }

  // ---------- HANGING UTENSILS ----------
  function hookAt(g) { const h = add(new THREE.TorusGeometry(0.012, 0.0025, 6, 14), P.chrome, g, 0, 0.0, 0); return h; }
  const swing = (g) => tween(1.4, (u) => (g.rotation.z = Math.sin(u * 18) * 0.35 * (1 - u)));
  {
    const g = new THREE.Group(); g.position.set(-1.3, 1.455, -1.95); hookAt(g);
    cyl(0.007, 0.007, 0.26, P.steel, g, 0, -0.14, 0, 10);
    add(new THREE.SphereGeometry(0.048, 22, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('#c9cdd2', 0.25, 0.9, { side: THREE.DoubleSide }), g, 0, -0.28, 0.035);
    makeTarget('ladle', g, [0.13, 0.4, 0.1], [0, -0.17, 0.02], { small: true, act: (sfx) => { sfx.clink(); swing(g); } });
  }
  {
    const g = new THREE.Group(); g.position.set(-1.0, 1.455, -1.95); hookAt(g);
    cyl(0.009, 0.009, 0.13, P.woodDark, g, 0, -0.075, 0, 10);
    box(0.012, 0.06, 0.004, P.black, g, 0, -0.17, 0);
    box(0.08, 0.1, 0.006, M('#23252a', 0.5), g, 0, -0.245, 0);
    [-0.022, 0, 0.022].forEach((x) => box(0.007, 0.065, 0.007, M('#4a4d55', 0.5), g, x, -0.245, 0, { cast: false }));
    makeTarget('spatula', g, [0.13, 0.4, 0.1], [0, -0.17, 0], { small: true, act: (sfx) => { sfx.whoosh(); tween(0.6, (u) => (g.rotation.y = u * Math.PI * 2)); } });
  }
  {
    const g = new THREE.Group(); g.position.set(-0.72, 1.455, -1.95); hookAt(g);
    cyl(0.011, 0.011, 0.12, P.black, g, 0, -0.07, 0, 12);
    const wire = M('#e2e5e8', 0.2, 1.0);
    for (let i = 0; i < 4; i++) {
      const loop = add(new THREE.TorusGeometry(0.03, 0.0022, 6, 30), wire, g, 0, -0.2, 0, { cast: false });
      loop.scale.y = 2.4; loop.rotation.y = (i * Math.PI) / 4;
    }
    makeTarget('whisk', g, [0.13, 0.4, 0.1], [0, -0.17, 0], { small: true, act: (sfx) => { sfx.whoosh(); swing(g); } });
  }

  // ---------- MICROWAVE ----------
  {
    const g = new THREE.Group(); g.position.set(1.12, 0.92, -1.78);
    rbox(0.5, 0.3, 0.38, 0.02, M('#30333a', 0.35, 0.4), g, 0, 0.15, 0);
    box(0.36, 0.26, 0.01, M('#1d1f23', 0.3, 0.3), g, -0.06, 0.15, 0.19);
    const win = box(0.27, 0.17, 0.012, M('#141518', 0.1, 0.2, { emissive: new THREE.Color('#ffb44a'), emissiveIntensity: 0 }), g, -0.07, 0.15, 0.193, { cast: false });
    box(0.014, 0.22, 0.02, P.chrome, g, 0.13, 0.15, 0.2);
    const disp = canvasTex(128, 48, (c) => { c.fillStyle = '#041008'; c.fillRect(0, 0, 128, 48); c.fillStyle = '#58ff8a'; c.font = 'bold 34px monospace'; c.fillText('12:00', 14, 36); });
    add(new THREE.PlaneGeometry(0.075, 0.028), new THREE.MeshStandardMaterial({ map: disp, emissive: new THREE.Color('#ffffff'), emissiveMap: disp, emissiveIntensity: 1 }), g, 0.19, 0.25, 0.191, { cast: false });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) box(0.018, 0.012, 0.006, M('#5a5e66', 0.5), g, 0.17 + c * 0.022, 0.21 - r * 0.022, 0.19, { cast: false });
    box(0.06, 0.03, 0.006, M('#3fbf6a', 0.5), g, 0.19, 0.105, 0.19, { cast: false });
    makeTarget('microwave', g, [0.54, 0.34, 0.42], [0, 0.15, 0], {
      act: (sfx) => {
        sfx.hum(); sfx.ding();
        const m = win.material;
        tween(1.4, (u) => (m.emissiveIntensity = u < 0.9 ? 1.4 : 1.4 * (1 - (u - 0.9) / 0.1)), () => (m.emissiveIntensity = 0));
      },
    });
  }

  // ---------- CUP ----------
  {
    const g = new THREE.Group(); g.position.set(1.52, 0.92, -1.5); g.rotation.y = -0.7;
    const blue = M('#3b7fd6', 0.35);
    add(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 28, 1, true), M('#3b7fd6', 0.35, 0, { side: THREE.DoubleSide }), g, 0, 0.0475, 0);
    cyl(0.038, 0.038, 0.004, blue, g, 0, 0.002, 0);
    const coffee = cyl(0.04, 0.04, 0.004, M('#4a2a14', 0.2), g, 0, 0.06, 0, 24, { cast: false });
    add(new THREE.TorusGeometry(0.026, 0.0075, 8, 18), blue, g, 0.05, 0.05, 0);
    makeTarget('cup', g, [0.17, 0.17, 0.15], [0.01, 0.06, 0], {
      small: true,
      act: (sfx) => {
        sfx.pour();
        tween(0.8, (u) => (coffee.position.y = 0.03 + 0.055 * u));
        setTimeout(() => steam(new THREE.Vector3(1.52, 1.04, -1.5), 8), 500);
      },
    });
  }

  // ---------- SINK ----------
  {
    const g = new THREE.Group(); g.position.set(2.08, 0.92, -1.7);
    box(0.62, 0.008, 0.46, P.steel, g, 0, 0.004, 0, { cast: false });
    box(0.52, 0.01, 0.34, M('#7d838b', 0.45, 0.8), g, 0, 0.006, 0.0, { cast: false });
    cyl(0.025, 0.025, 0.012, P.black, g, 0, 0.008, 0, 18, { cast: false });
    cyl(0.025, 0.03, 0.04, P.chrome, g, 0, 0.02, -0.2, 18);
    const curve = new THREE.CatmullRomCurve3([[0, 0, -0.2], [0, 0.24, -0.2], [0, 0.32, -0.14], [0, 0.3, -0.05], [0, 0.24, -0.02]].map((p) => new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(curve, 30, 0.013, 12), P.chrome, g);
    const lever = box(0.012, 0.012, 0.07, P.chrome, g, 0.04, 0.05, -0.2);
    const stream = cyl(0.008, 0.008, 0.23, M('#a9dcff', 0.1, 0, { transparent: true, opacity: 0.65, emissive: new THREE.Color('#6fc6ff'), emissiveIntensity: 0.3 }), g, 0, 0.12, -0.02, 10, { cast: false });
    stream.visible = false;
    makeTarget('sink', g, [0.64, 0.38, 0.5], [0, 0.15, 0], {
      act: (sfx) => {
        sfx.water(); stream.visible = true; lever.rotation.y = 0.6;
        tween(1.4, (u) => (stream.scale.x = stream.scale.z = 1 + Math.sin(u * 60) * 0.15), () => { stream.visible = false; lever.rotation.y = 0; });
        spawn(new THREE.Vector3(2.08, 0.94, -1.72), { n: 10, color: '#cfeeff', speed: 0.25, up: 0.4, life: 0.6, size: 0.03, grow: 1, gravity: 2 });
      },
    });
  }

  // ---------- public api ----------
  const targetMeshes = [];
  for (const t of Object.values(targets)) t.group.traverse((o) => o.isMesh && targetMeshes.push(o));

  function setActive(ids) {
    for (const t of Object.values(targets)) {
      t.active = ids.includes(t.id);
      if (t.small) t.group.visible = t.active;
    }
  }

  function targetOf(obj) { while (obj) { if (obj.userData.targetId) return targets[obj.userData.targetId]; obj = obj.parent; } return null; }

  function topPoint(id) { const b = new THREE.Box3().setFromObject(targets[id].proxy); return new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2); }
  function focusPoint(id) { const p = new THREE.Vector3(); targets[id].proxy.getWorldPosition(p); return p; }

  function bounce(id) {
    const t = targets[id]; const s0 = t.base.clone(); const amp = t.small ? 0.25 : 0.05;
    tween(0.45, (u) => t.group.scale.copy(s0).multiplyScalar(1 + amp * Math.sin(u * Math.PI) * (1 - u * 0.5)), () => t.group.scale.copy(s0));
  }
  function wobble(id) {
    const t = targets[id]; const r0 = t.group.rotation.z;
    tween(0.5, (u) => (t.group.rotation.z = r0 + Math.sin(u * 30) * 0.08 * (1 - u)), () => (t.group.rotation.z = r0));
  }
  let highlighted = null;
  function highlight(id) {
    unhighlight();
    highlighted = targets[id];
  }
  function unhighlight() {
    if (!highlighted) return;
    highlighted.mats.forEach(({ m, e, i }) => { m.emissive.copy(e); m.emissiveIntensity = i; });
    highlighted = null;
  }
  const gold = new THREE.Color('#ffc83d');
  function update(dt, time) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; tw.t += dt;
      const u = Math.min(1, tw.t / tw.dur);
      tw.fn(u);
      if (u >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt;
      if (p.age < 0) { p.s.visible = false; continue; }
      p.s.visible = true;
      const k = p.age / p.life;
      if (k >= 1) { root.remove(p.s); p.s.material.dispose(); particles.splice(i, 1); continue; }
      p.v.y -= p.gravity * dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(p.size * (1 + (p.grow - 1) * k));
      p.s.material.opacity = (1 - k) * (k < 0.1 ? k / 0.1 : 1) * 0.9;
    }
    if (highlighted) {
      const s = 0.55 + 0.45 * Math.sin(time * 10);
      highlighted.mats.forEach(({ m }) => { m.emissive.copy(gold); m.emissiveIntensity = s; });
    }
  }

  return { targets, targetMeshes, setActive, targetOf, focusPoint, topPoint, bounce, wobble, highlight, unhighlight, update, spawn, tween };
}

const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
