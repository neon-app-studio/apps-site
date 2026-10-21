// Tiny synthesized sound kit (no audio files needed).
let ctx = null, master = null, noiseBuf = null;

export function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state !== 'running') ctx.resume();
  const b = ctx.createBuffer(1, 1, 22050);
  const s = ctx.createBufferSource();
  s.buffer = b; s.connect(ctx.destination); s.start(0);
}

function tone({ f = 440, f2, type = 'sine', t = 0, dur = 0.2, vol = 0.3, attack = 0.004 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise({ t = 0, dur = 0.2, vol = 0.2, type = 'bandpass', f = 1000, f2, q = 1, attack = 0.005 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + t;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter();
  fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
}

export const shoot = () => {
  noise({ dur: 0.1, vol: 0.22, f: 3000, f2: 500, q: 0.9 });
  tone({ f: 1100, f2: 160, type: 'square', dur: 0.1, vol: 0.05 });
};
export const hit = (streak = 0) => {
  const base = 523.25 * Math.pow(2, Math.min(streak, 10) / 12);
  [0, 4, 7, 12].forEach((s, i) => tone({ f: base * 2 ** (s / 12), type: 'triangle', t: i * 0.05, dur: 0.25, vol: 0.2 }));
  tone({ f: base * 4, t: 0.18, dur: 0.5, vol: 0.07 });
  noise({ dur: 0.08, vol: 0.12, f: 6000, type: 'highpass' });
};
export const miss = () => {
  tone({ f: 330, dur: 0.22, vol: 0.18 });
  tone({ f: 247, t: 0.15, dur: 0.4, vol: 0.18 });
};
export const thud = () => tone({ f: 140, f2: 70, type: 'sine', dur: 0.12, vol: 0.12 });
export const tick = () => tone({ f: 1300, type: 'square', dur: 0.03, vol: 0.04 });
export const beep = (hi) => tone({ f: hi ? 1046 : 523, type: 'triangle', dur: hi ? 0.45 : 0.16, vol: 0.25 });
export const fanfare = () => {
  [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: i * 0.12, dur: 0.3, vol: 0.2 }));
  tone({ f: 1318, type: 'triangle', t: 0.5, dur: 0.8, vol: 0.18 });
};
export const ding = () => { tone({ f: 1975, t: 0.9, dur: 1.2, vol: 0.16 }); tone({ f: 2960, t: 0.9, dur: 0.6, vol: 0.05 }); };
export const hum = () => tone({ f: 110, type: 'sawtooth', dur: 0.9, vol: 0.025, attack: 0.1 });
export const sizzle = () => noise({ dur: 1.3, vol: 0.1, type: 'highpass', f: 3500, attack: 0.08 });
export const pop = () => { tone({ f: 180, f2: 700, dur: 0.09, vol: 0.3 }); noise({ dur: 0.05, vol: 0.15, f: 1500 }); };
export const whistle = () => { tone({ f: 1500, f2: 1900, dur: 1.0, vol: 0.06, attack: 0.25 }); };
export const water = () => noise({ dur: 1.4, vol: 0.16, type: 'lowpass', f: 1600, attack: 0.08 });
export const chop = () => [0, 0.17, 0.34].forEach((t) => { noise({ t, dur: 0.05, vol: 0.25, type: 'lowpass', f: 900 }); tone({ t, f: 160, f2: 60, dur: 0.08, vol: 0.22 }); });
export const whoosh = () => noise({ dur: 0.35, vol: 0.12, f: 400, f2: 2200, q: 0.6, attack: 0.05 });
export const clink = () => { tone({ f: 2400, dur: 0.25, vol: 0.08 }); tone({ f: 3200, t: 0.04, dur: 0.2, vol: 0.05 }); };
export const click = () => tone({ f: 900, type: 'square', dur: 0.025, vol: 0.05 });
export const pour = () => noise({ dur: 0.9, vol: 0.12, f: 900, f2: 1600, q: 2, attack: 0.05 });
