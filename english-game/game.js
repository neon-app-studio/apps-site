import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { buildKitchen } from './kitchen.js';
import { LEVELS, NOUNS } from './levels.js';
import * as sfx from './sfx.js';
import { speak, unlockSpeech, hasSpeech } from './speech.js';

const $ = (id) => document.getElementById(id);
const ROUND_SECONDS = 60;

// ---------- renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f3e2c6');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

scene.add(new THREE.HemisphereLight('#fff4e0', '#8a6f55', 0.9));
const sun = new THREE.DirectionalLight('#fff1dc', 2.2);
sun.position.set(1.6, 3.6, 2.4);
sun.target.position.set(0, 0.9, -1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 2.5, bottom: -1.5, near: 0.5, far: 9 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const lamp = new THREE.PointLight('#ffd9a0', 2.0, 6, 1.6);
lamp.position.set(0, 2.2, -0.3);
scene.add(lamp);

const K = buildKitchen(scene);

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 30);
camera.rotation.order = 'YXZ';
const view = { yaw: 0, pitch: 0, baseYaw: 0, basePitch: -0.13, yawLim: 0.3, pitchLim: [-0.3, 0.2], targetYaw: null, targetPitch: null, shake: 0 };

function resize() {
  const w = window.innerWidth, h = window.innerHeight, a = w / h;
  renderer.setSize(w, h, false);
  camera.aspect = a;
  if (a < 1) {
    camera.position.set(0, 1.5, 1.3);
    camera.fov = 62;
    view.yawLim = 0.75;
  } else {
    camera.position.set(0, 1.66, 1.45);
    const need = Math.atan(2.7 / 3.2);
    camera.fov = THREE.MathUtils.clamp((2 * Math.atan(Math.tan(need) / a) * 180) / Math.PI, 40, 60);
    view.yawLim = a > 1.8 ? 0.22 : 0.4;
  }
  view.basePitch = Math.atan2((a < 1 ? 0.78 : 1.12) - camera.position.y, Math.abs(-1.7 - camera.position.z));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------- state ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('earshot.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('earshot.' + k, JSON.stringify(v)); } catch {} },
};
const G = {
  state: 'menu', level: store.get('level', 0), jp: store.get('jp', false),
  score: 0, streak: 0, bestStreak: 0, timeLeft: ROUND_SECONDS, locked: false,
  queue: [], cur: null, curStart: 0, revealed: false, log: new Map(), correct: 0, wrong: 0,
};

// ---------- menu ----------
function renderLevels() {
  $('levels').innerHTML = LEVELS.map((L, i) => {
    const best = store.get('best' + L.id, null);
    const stars = store.get('stars' + L.id, 0);
    return `<button class="lv ${i === G.level ? 'sel' : ''}" data-i="${i}"><b>LEVEL ${L.id}</b><span>${L.name}</span><em>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</em></button>`;
  }).join('');
  $('levels').querySelectorAll('.lv').forEach((b) => b.addEventListener('click', () => { G.level = +b.dataset.i; store.set('level', G.level); sfx.unlock(); sfx.click(); renderLevels(); }));
  $('play').textContent = `TAP TO PLAY · LEVEL ${LEVELS[G.level].id}`;
}
$('jptoggle').checked = G.jp;
$('jptoggle').addEventListener('change', (e) => setJP(e.target.checked));
function setJP(on) { G.jp = on; store.set('jp', on); $('jptoggle').checked = on; $('jpbtn').classList.toggle('on', on); renderPrompt(); }
$('jpbtn').addEventListener('click', (e) => { e.stopPropagation(); setJP(!G.jp); sfx.click(); });
renderLevels();
setJP(G.jp);

$('play').addEventListener('click', () => startLevel(G.level));
$('again').addEventListener('click', () => startLevel(G.level));
$('next').addEventListener('click', () => startLevel(Math.min(G.level + 1, LEVELS.length - 1)));
$('tomenu').addEventListener('click', toMenu);
$('quit').addEventListener('click', (e) => { e.stopPropagation(); toMenu(); });
$('replay').addEventListener('click', (e) => { e.stopPropagation(); if (G.cur) sayPrompt(); });

function toMenu() {
  G.state = 'menu';
  speechSynthesis?.cancel?.();
  K.unhighlight();
  $('hud').classList.add('hidden'); $('results').classList.add('hidden'); $('count').classList.add('hidden');
  $('menu').classList.remove('hidden');
  K.setActive(LEVELS[G.level].objects);
  renderLevels();
}

// ---------- round flow ----------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

function startLevel(i) {
  // This runs inside a tap, which unlocks audio + speech on iOS.
  sfx.unlock();
  G.level = i; store.set('level', i);
  const L = LEVELS[i];
  unlockSpeech(`Level ${L.id}. ${L.name}.`);
  K.setActive(L.objects);
  K.unhighlight();
  Object.assign(G, { score: 0, streak: 0, bestStreak: 0, timeLeft: ROUND_SECONDS, locked: true, queue: [], cur: null, log: new Map(), correct: 0, wrong: 0 });
  updateHud();
  view.targetYaw = 0; view.targetPitch = 0;
  $('menu').classList.add('hidden'); $('results').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hint').style.opacity = 1;
  $('pword').textContent = ''; $('pjp').textContent = ''; $('plisten').style.display = 'none';
  G.state = 'countdown';
  const el = $('count'); el.classList.remove('hidden');
  const steps = ['3', '2', '1', 'GO!'];
  steps.forEach((s, k) => setTimeout(() => {
    if (G.state !== 'countdown') return;
    el.textContent = s; el.className = 'tick' + (k === 3 ? ' go' : '');
    void el.offsetWidth; sfx.beep(k === 3);
    if (k === 3) setTimeout(() => { el.classList.add('hidden'); if (G.state === 'countdown') { G.state = 'playing'; G.lastT = performance.now(); nextPrompt(); } }, 550);
  }, 900 + k * 700));
}

function nextPrompt() {
  if (G.state !== 'playing') return;
  const L = LEVELS[G.level];
  if (!G.queue.length) {
    let q = shuffle([...L.prompts]);
    if (G.cur && q[0].text === G.cur.text && q.length > 1) q.push(q.shift());
    G.queue = q;
  }
  G.cur = G.queue.shift();
  G.curStart = performance.now();
  G.revealed = false;
  G.locked = false;
  const p = $('prompt'); p.classList.remove('good', 'bad', 'new'); void p.offsetWidth; p.classList.add('new');
  renderPrompt();
  sayPrompt();
  clearTimeout(G.revealTimer);
  G.revealTimer = setTimeout(() => { G.revealed = true; renderPrompt(); }, hasSpeech ? L.revealMs : 0);
}

function sayPrompt() {
  const ok = speak(G.cur.text, LEVELS[G.level].kind === 'phrases' ? 0.92 : 0.85);
  const r = $('replay'); r.classList.add('speaking'); clearTimeout(G.spkT); G.spkT = setTimeout(() => r.classList.remove('speaking'), 1400);
  if (!ok) { G.revealed = true; renderPrompt(); }
}

function renderPrompt() {
  if (!G.cur) return;
  const show = G.revealed;
  $('plisten').style.display = show ? 'none' : 'flex';
  const w = $('pword');
  w.textContent = show ? G.cur.text : '';
  w.classList.toggle('phrase', LEVELS[G.level].kind === 'phrases');
  $('pjp').textContent = show && G.jp ? G.cur.jp : '';
}

function logPrompt(ok) {
  const k = G.cur.text;
  const e = G.log.get(k) || { p: G.cur, ok: 0, miss: 0 };
  ok ? e.ok++ : e.miss++;
  G.log.set(k, e);
}

// ---------- input ----------
let ptr = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, drag: false };
  try { canvas.setPointerCapture(e.pointerId); } catch {}
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  if (!ptr.drag && Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy) > 12) ptr.drag = true;
  if (ptr.drag && G.state !== 'menu') {
    const k = 2.2 / Math.max(window.innerWidth, window.innerHeight);
    view.yaw += (e.clientX - ptr.x) * k;
    view.pitch += (e.clientY - ptr.y) * k;
    view.targetYaw = null; view.targetPitch = null;
    clampView();
    $('hint').style.opacity = 0;
  }
  ptr.x = e.clientX; ptr.y = e.clientY;
});
const endPtr = (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  if (!ptr.drag && e.type === 'pointerup') shoot(e.clientX, e.clientY);
  ptr = null;
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
document.addEventListener('gesturestart', (e) => e.preventDefault());

function clampView() {
  view.yaw = THREE.MathUtils.clamp(view.yaw, -view.yawLim, view.yawLim);
  view.pitch = THREE.MathUtils.clamp(view.pitch, view.pitchLim[0], view.pitchLim[1]);
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pick(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(K.targetMeshes, false)
    .map((h) => ({ h, t: K.targetOf(h.object) }))
    .filter((x) => x.t && x.t.active);
  return hits;
}

function shoot(cx, cy) {
  if (G.state !== 'playing') return;
  reticle(cx, cy, false);
  if (G.locked) return;
  sfx.shoot();
  const hits = pick(cx, cy);
  if (!hits.length) {
    const p = ray.ray.at(2.5, new THREE.Vector3());
    K.spawn(p, { n: 6, color: '#bbbbbb', speed: 0.5, up: 0.2, life: 0.35, size: 0.04, grow: 1, gravity: 1 });
    sfx.thud();
    return;
  }
  const first = hits[0];
  const answer = G.cur.target;
  const right = hits.find((x) => x.t.id === answer && x.h.distance - first.h.distance < 0.12);
  if (right) onCorrect(right, cx, cy);
  else onWrong(first, cx, cy);
}

function onCorrect({ h, t }, cx, cy) {
  G.locked = true;
  const L = LEVELS[G.level];
  const ear = !G.revealed;
  const fast = performance.now() - G.curStart < 2500;
  G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak); G.correct++;
  const mult = G.streak >= 8 ? 3 : G.streak >= 4 ? 2 : 1;
  const pts = (100 + (ear ? 50 : 0) + (fast ? 25 : 0)) * mult;
  G.score += pts;
  logPrompt(true);
  reticle(cx, cy, true);
  sfx.hit(G.streak);
  haptic(true);
  tracer(h.point, '#ffd65a');
  K.spawn(h.point, { n: 22, color: '#ffc83d', speed: 1.4, up: 0.6, life: 0.6, size: 0.05, grow: 0.3, gravity: 2.5, additive: true, spread: 0.01 });
  K.spawn(h.point, { n: 8, color: '#ffffff', speed: 0.9, up: 0.3, life: 0.35, size: 0.09, grow: 0.2, additive: true, spread: 0.01 });
  K.bounce(t.id);
  t.act(sfx);
  const noun = NOUNS[t.id];
  label(K.topPoint(t.id), `${noun.en} ✓${G.jp ? `<small>${noun.jp}</small>` : ''}`, 'good', 1100);
  floatPts(cx, cy, `+${pts}`);
  if (ear) combo('EAR BONUS!');
  else if (G.streak === 4) combo('COMBO x2!');
  else if (G.streak === 8) combo('COMBO x3!');
  else if (G.streak > 0 && G.streak % 5 === 0) combo(`${G.streak} IN A ROW!`);
  G.revealed = true; renderPrompt();
  $('prompt').classList.add('good');
  flash('good');
  updateHud(true);
  setTimeout(nextPrompt, L.kind === 'phrases' ? 1250 : 750);
}

function onWrong({ h, t }, cx, cy) {
  G.locked = true;
  G.streak = 0; G.wrong++;
  logPrompt(false);
  sfx.miss();
  haptic(false);
  tracer(h.point, '#ff8a8a');
  K.wobble(t.id);
  const wrongNoun = NOUNS[t.id];
  label(h.point, `that's the ${wrongNoun.en}`, 'bad', 1500);
  const ans = G.cur.target;
  K.highlight(ans);
  const fp = K.focusPoint(ans);
  // turn the camera toward the right answer if it is off-screen
  const pr = fp.clone().project(camera);
  if (Math.abs(pr.x) > 0.8 || Math.abs(pr.y) > 0.8) lookAt(fp);
  G.revealed = true; renderPrompt();
  $('prompt').classList.add('bad');
  flash('bad');
  setTimeout(() => { if (G.state === 'playing') { label(K.topPoint(ans), `${NOUNS[ans].en}${G.jp ? `<small>${NOUNS[ans].jp}</small>` : ''}`, 'teach', 1300); speak(LEVELS[G.level].kind === 'phrases' ? G.cur.text : NOUNS[ans].en, 0.85); } }, 250);
  // ask this one again a little later
  G.queue.splice(Math.min(2, G.queue.length), 0, G.cur);
  updateHud();
  setTimeout(() => { K.unhighlight(); nextPrompt(); }, 1900);
}

function lookAt(p) {
  const d = p.clone().sub(camera.position);
  view.targetYaw = THREE.MathUtils.clamp(Math.atan2(-d.x, -d.z) - view.baseYaw, -view.yawLim, view.yawLim);
  view.targetPitch = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)) - view.basePitch, view.pitchLim[0], view.pitchLim[1]);
}

function haptic(good) {
  let did = false;
  try { if (navigator.vibrate) did = navigator.vibrate(good ? 35 : [25, 50, 25]); } catch {}
  view.shake = good ? 0.012 : 0.02;
  if (!did) { const a = $('app'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); }
}

function endRound() {
  G.state = 'results';
  G.locked = true;
  clearTimeout(G.revealTimer);
  K.unhighlight();
  sfx.fanfare();
  const L = LEVELS[G.level];
  const stars = G.correct >= 15 ? 3 : G.correct >= 9 ? 2 : G.correct >= 4 ? 1 : 0;
  const prevBest = store.get('best' + L.id, 0);
  const isBest = G.score > prevBest;
  if (isBest) store.set('best' + L.id, G.score);
  store.set('stars' + L.id, Math.max(stars, store.get('stars' + L.id, 0)));
  setTimeout(() => speak(G.correct ? `Time's up! You got ${G.correct}.` : "Time's up!", 0.95), 400);

  $('stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.2}s">★</span>`).join('');
  $('rscore').textContent = G.score.toLocaleString();
  $('rbest').textContent = isBest ? 'NEW BEST!' : `Best: ${Math.max(prevBest, G.score).toLocaleString()}`;
  const tries = G.correct + G.wrong;
  $('rstats').innerHTML = [
    [G.correct, 'CORRECT'], [G.wrong, 'MISSED'], [G.bestStreak, 'BEST STREAK'], [tries ? Math.round((100 * G.correct) / tries) + '%' : '—', 'ACCURACY'],
  ].map(([v, k]) => `<div><b>${v}</b><small>${k}</small></div>`).join('');
  const rows = [...G.log.values()].sort((a, b) => (b.miss > 0) - (a.miss > 0) || b.miss - a.miss);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('rlist').innerHTML = rows.length ? rows.map((r, i) => {
    const miss = r.miss > 0;
    const thing = NOUNS[r.p.target].en;
    const sub = L.kind === 'phrases' ? `→ ${thing}` : '';
    return `<div class="row ${miss ? 'miss' : ''}"><div class="ic">${miss ? '✕' : '✓'}</div>
      <div class="w">${esc(r.p.text)}${sub ? `<small>${esc(sub)}</small>` : ''}${G.jp ? `<small class="jpx">${esc(r.p.jp)}</small>` : ''}</div>
      <div class="n">${miss ? `missed ${r.miss}` : ''}${r.ok ? `${miss ? ' · ' : ''}got ${r.ok}` : ''}</div>
      <button data-i="${i}" aria-label="Hear it">🔊</button></div>`;
  }).join('') : '<div class="row"><div class="w">No words tried. Tap the things you hear!</div></div>';
  $('rlist').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => speak(rows[+b.dataset.i].p.text, 0.85)));
  $('next').classList.toggle('hidden', G.level >= LEVELS.length - 1);
  $('next').textContent = G.level < LEVELS.length - 1 ? `LEVEL ${LEVELS[G.level + 1].id}: ${LEVELS[G.level + 1].name.toUpperCase()} ▶` : '';
  setTimeout(() => { $('hud').classList.add('hidden'); $('results').classList.remove('hidden'); }, 700);
  $('time').textContent = '0';
}

// ---------- HUD / effects ----------
function updateHud(popScore) {
  $('score').textContent = G.score.toLocaleString();
  $('streak').textContent = G.streak;
  const mult = G.streak >= 8 ? 3 : G.streak >= 4 ? 2 : 1;
  $('mult').textContent = 'x' + mult;
  $('mult').style.display = mult > 1 ? '' : 'none';
  if (popScore) { const s = $('score').parentElement; s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); }
}
function setTime(t) {
  const s = Math.ceil(t);
  if ($('time').textContent !== String(s)) {
    $('time').textContent = s;
    if (s <= 10 && s > 0) sfx.tick();
  }
  $('ring').style.strokeDashoffset = 175.9 * (1 - t / ROUND_SECONDS);
  $('ring').parentElement.parentElement.classList.toggle('low', t <= 10);
}
function reticle(x, y, hit) {
  const d = document.createElement('div');
  d.className = 'reticle' + (hit ? ' hit' : '');
  d.style.left = x + 'px'; d.style.top = y + 'px';
  $('fx').appendChild(d); setTimeout(() => d.remove(), 400);
}
function floatPts(x, y, txt) {
  const d = document.createElement('div'); d.className = 'pts'; d.textContent = txt;
  d.style.left = x + 'px'; d.style.top = y + 'px';
  d.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-120%) scale(1.2)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%,-260%) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out' });
  $('fx').appendChild(d); setTimeout(() => d.remove(), 900);
}
const labels = [];
function label(pos, html, kind, ms) {
  const d = document.createElement('div');
  d.className = 'lbl ' + kind; d.innerHTML = html;
  $('fx').appendChild(d);
  labels.push({ d, pos: pos.clone().add(new THREE.Vector3(0, kind === 'bad' ? -0.06 : 0.04, 0)), t0: performance.now(), ms });
}
function combo(txt) { const c = $('combo'); c.textContent = txt; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
function flash(k) { const f = $('flash'); f.className = ''; void f.offsetWidth; f.className = k; }

const tracers = [];
function tracer(to, color) {
  const from = new THREE.Vector3(0.12, -0.16, -0.3).applyMatrix4(camera.matrixWorld);
  const len = from.distanceTo(to);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.005, len, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(from).lerp(to, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  scene.add(m);
  tracers.push({ m, t: 0 });
}

// ---------- loop ----------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (G.state === 'playing') {
    G.timeLeft -= dt;
    if (G.timeLeft <= 0) { G.timeLeft = 0; setTime(0); endRound(); }
    else setTime(G.timeLeft);
  }
  if (G.state === 'menu' || G.state === 'results') {
    view.yaw = Math.sin(time * 0.15) * view.yawLim * 0.7;
    view.pitch = Math.sin(time * 0.11) * 0.03;
  } else if (view.targetYaw != null) {
    view.yaw += (view.targetYaw - view.yaw) * Math.min(1, dt * 5);
    view.pitch += (view.targetPitch - view.pitch) * Math.min(1, dt * 5);
    if (Math.abs(view.targetYaw - view.yaw) < 0.002) { view.targetYaw = null; view.targetPitch = null; }
  }
  view.shake *= Math.pow(0.001, dt);
  camera.rotation.y = view.baseYaw + view.yaw + (Math.random() - 0.5) * view.shake;
  camera.rotation.x = view.basePitch + view.pitch + (Math.random() - 0.5) * view.shake;
  camera.updateMatrixWorld();

  K.update(dt, time);
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i]; tr.t += dt;
    tr.m.material.opacity = 0.9 * (1 - tr.t / 0.14);
    if (tr.t > 0.14) { scene.remove(tr.m); tr.m.geometry.dispose(); tr.m.material.dispose(); tracers.splice(i, 1); }
  }
  const now = performance.now();
  const placed = [];
  for (let i = labels.length - 1; i >= 0; i--) {
    const l = labels[i]; const k = (now - l.t0) / l.ms;
    if (k >= 1) { l.d.remove(); labels.splice(i, 1); continue; }
    tmp.copy(l.pos).project(camera);
    const x = (tmp.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmp.y * 0.5 + 0.5) * window.innerHeight - k * 14;
    const lx = Math.max(70, Math.min(window.innerWidth - 70, x));
    const hh = l.d.offsetHeight || 34, ww = l.d.offsetWidth || 120;
    const below = l.d.classList.contains('bad');
    let cy = below ? y + hh / 2 : y - hh / 2;
    for (const o of placed) if (Math.abs(o.x - lx) < (o.w + ww) / 2 && Math.abs(o.y - cy) < (o.h + hh) / 2 + 4) cy = o.y + (o.h + hh) / 2 + 6;
    placed.push({ x: lx, y: cy, w: ww, h: hh });
    l.d.style.left = lx + 'px';
    l.d.style.top = (below ? cy - hh / 2 : cy + hh / 2) + 'px';
    l.d.style.opacity = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
K.setActive(LEVELS[G.level].objects);
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => { if (document.hidden) clock.stop(); else clock.start(); });

// test hooks (used by the automated screenshot run)
window.__earshot = {
  G, K, camera, LEVELS,
  screenOf(id) { const p = K.focusPoint(id).project(camera); return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight }; },
  aimAt(id) { lookAt(K.focusPoint(id)); view.yaw = view.targetYaw; view.pitch = view.targetPitch; view.targetYaw = null; camera.rotation.y = view.yaw; camera.rotation.x = view.basePitch + view.pitch; camera.updateMatrixWorld(); },
  endNow() { G.timeLeft = 0.01; },
  pickAt(x, y) { return pick(x, y).map((h) => h.t.id + ':' + h.h.distance.toFixed(2)); },
};
