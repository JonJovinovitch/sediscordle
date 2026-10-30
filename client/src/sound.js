// Sound effects, made on the fly with the Web Audio API (no audio files needed).
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem("sediscordle-muted") === "1";
} catch {
  /* storage blocked */
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem("sediscordle-muted", m ? "1" : "0");
  } catch {
    /* storage blocked */
  }
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Call on the first key press so browsers allow sound later.
export function unlockAudio() {
  audio();
}

// One "squee!": a fast upward pitch swoop with a wobble, like an excited squeal.
function squee(ac, start, from, to, length, volume) {
  const osc = ac.createOscillator();
  const wobble = ac.createOscillator();
  const wobbleDepth = ac.createGain();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + length * 0.55);
  osc.frequency.exponentialRampToValueAtTime(to * 0.92, start + length);

  wobble.frequency.value = 18; // fast vibrato makes it sound alive
  wobbleDepth.gain.value = to * 0.035;
  wobble.connect(wobbleDepth).connect(osc.frequency);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(from * 2, start);
  filter.frequency.exponentialRampToValueAtTime(to * 1.6, start + length);
  filter.Q.value = 2.5;

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
  gain.gain.setValueAtTime(volume, start + length * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);

  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(start);
  wobble.start(start);
  osc.stop(start + length + 0.05);
  wobble.stop(start + length + 0.05);
}

// A little sparkle of high notes on top.
function sparkle(ac, start) {
  [1568, 2093, 2637, 3136].forEach((f, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t = start + i * 0.05;
    osc.type = "triangle";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}

// Board solved: "squee-SQUEEE!" plus sparkles. Gets more excited the more boards you've solved.
export function playSolved(solvedSoFar = 1) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  const lift = 1 + Math.min(solvedSoFar, 16) * 0.02;
  squee(ac, t, 620 * lift, 1500 * lift, 0.16, 0.16);
  squee(ac, t + 0.15, 800 * lift, 2300 * lift, 0.34, 0.2);
  sparkle(ac, t + 0.12);
}

// All 16 solved: a longer run of squeals going higher and higher.
export function playWin() {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.05;
  [0, 0.16, 0.32].forEach((d, i) => squee(ac, t + d, 700 + i * 200, 1700 + i * 450, 0.2, 0.17));
  squee(ac, t + 0.5, 1100, 3000, 0.55, 0.22);
  sparkle(ac, t + 0.45);
  sparkle(ac, t + 0.7);
}
