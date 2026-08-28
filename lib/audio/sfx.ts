/**
 * Every sound here is synthesized on the fly via the Web Audio API — no
 * audio files, no licensing to worry about, and nothing to download. Lazily
 * creates one shared AudioContext on first use, which also happens to be
 * exactly what unlocks it under browser autoplay policy: it's only ever
 * created inside a real click handler (the sound toggle), never on mount.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    ctx = new AudioContextClass();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function envelope(gain: GainNode, start: number, attack: number, sustain: number, release: number, peak: number) {
  gain.gain.cancelScheduledValues(start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, start + attack + sustain);
  gain.gain.linearRampToValueAtTime(0, start + attack + sustain + release);
}

/** Short two-note confirmation ding — plays for you alone when your own claim succeeds. */
export function playChime(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain).connect(audio.destination);
    const start = now + i * 0.08;
    envelope(gain, start, 0.01, 0.08, 0.15, 0.15);
    osc.start(start);
    osc.stop(start + 0.3);
  });
}

/** Referee whistle — plays once when the race actually kicks off. */
export function playWhistle(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(2200, now);
  osc.frequency.linearRampToValueAtTime(2600, now + 0.15);
  osc.frequency.linearRampToValueAtTime(2200, now + 0.35);
  osc.connect(gain).connect(audio.destination);
  envelope(gain, now, 0.02, 0.3, 0.15, 0.2);
  osc.start(now);
  osc.stop(now + 0.55);
}

/** Two-tone air horn — plays once when the race finishes. */
export function playAirHorn(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  [220, 330].forEach((freq) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.connect(gain).connect(audio.destination);
    envelope(gain, now, 0.05, 0.5, 0.3, 0.16);
    osc.start(now);
    osc.stop(now + 0.9);
  });
}

/** Light tap — local feedback when you send a reaction emoji. */
export function playTap(): void {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = 600;
  osc.connect(gain).connect(audio.destination);
  envelope(gain, now, 0.005, 0.03, 0.05, 0.12);
  osc.start(now);
  osc.stop(now + 0.1);
}

interface MurmurHandle {
  sources: AudioBufferSourceNode[];
  gain: GainNode;
  lfo: OscillatorNode;
}

let murmur: MurmurHandle | null = null;

function makeNoiseBuffer(audio: AudioContext, seconds: number): AudioBuffer {
  const length = audio.sampleRate * seconds;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Low, textured stadium hum for the waiting room — two filtered noise loops
 * plus a slow LFO on the filter frequency so it breathes a little instead of
 * sitting as flat static. It reads as ambient crowd presence, not a
 * recording of an actual crowd — that's the honest ceiling of what's
 * achievable without a real audio asset.
 */
export function startCrowdMurmur(): void {
  const audio = getContext();
  if (!audio || murmur) return;

  const gain = audio.createGain();
  gain.gain.value = 0;
  gain.connect(audio.destination);

  const lfo = audio.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.15;
  const lfoGain = audio.createGain();
  lfoGain.gain.value = 120;

  const sources: AudioBufferSourceNode[] = [];
  [{ freq: 300, seconds: 3 }, { freq: 220, seconds: 4 }].forEach(({ freq, seconds }) => {
    const source = audio.createBufferSource();
    source.buffer = makeNoiseBuffer(audio, seconds);
    source.loop = true;

    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.7;

    lfo.connect(lfoGain).connect(filter.frequency);
    source.connect(filter).connect(gain);
    source.start();
    sources.push(source);
  });

  lfo.start();
  gain.gain.linearRampToValueAtTime(0.035, audio.currentTime + 1.5);

  murmur = { sources, gain, lfo };
}

export function stopCrowdMurmur(): void {
  if (!murmur) return;
  const audio = getContext();
  const handle = murmur;
  murmur = null;
  if (!audio) {
    handle.sources.forEach((s) => s.stop());
    handle.lfo.stop();
    return;
  }
  handle.gain.gain.linearRampToValueAtTime(0, audio.currentTime + 0.5);
  setTimeout(() => {
    handle.sources.forEach((s) => s.stop());
    handle.lfo.stop();
  }, 600);
}
