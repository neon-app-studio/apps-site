// English text-to-speech via the Web Speech API.
let voice = null;
const synth = window.speechSynthesis;
export const hasSpeech = !!synth && typeof SpeechSynthesisUtterance !== 'undefined';

const PREF = ['Samantha', 'Ava', 'Allison', 'Nicky', 'Susan', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Alex'];
function pickVoice() {
  if (!hasSpeech) return;
  const vs = synth.getVoices();
  const us = vs.filter((v) => /^en[-_]US/i.test(v.lang));
  for (const p of PREF) { const v = us.find((x) => x.name.includes(p)); if (v) { voice = v; return; } }
  voice = us.find((v) => v.localService) || us[0] || vs.find((v) => /^en/i.test(v.lang)) || null;
}
if (hasSpeech) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

export function speak(text, rate = 0.9) {
  if (!hasSpeech) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = rate; u.pitch = 1; u.volume = 1;
  if (voice) u.voice = voice;
  if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(() => synth.speak(u), 60); }
  else synth.speak(u);
  return true;
}
// Must be called inside a user tap (iOS unlock).
export function unlockSpeech(text) {
  if (!hasSpeech) return;
  pickVoice();
  const u = new SpeechSynthesisUtterance(text || ' ');
  u.lang = 'en-US'; u.rate = 0.95; if (voice) u.voice = voice;
  if (!text) u.volume = 0;
  synth.cancel(); synth.speak(u);
}
