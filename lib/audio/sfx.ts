/**
 * Sound effects. Most of these are real audio files (public/sounds/) —
 * claim confirmation and reaction-tap stay synthesized via the Web Audio
 * API since no file was provided for those.
 *
 * Every file-based sound reuses a small set of persistent HTMLAudioElement
 * instances rather than `new Audio()` per play. That's not just tidiness —
 * strict autoplay policies (iOS Safari in particular) only allow a given
 * <audio> element to play without a fresh user gesture if THAT SAME
 * element already played (even silently) during a real gesture earlier in
 * the page's life. A freshly constructed Audio() later, even one playing
 * an already-"unlocked" URL, starts locked again. So every sound this
 * module can ever play gets built once, unlocked once (via unlockAudio(),
 * called synchronously from the sound-toggle's onClick — the only genuine
 * user gesture in this flow), and reused for every subsequent play.
 */

const SOUND_SRC = {
  waitingRoom: "/sounds/waitingroom.mp3",
  kickoff: "/sounds/whentheracestart.mp3",
  raceComplete: "/sounds/racecomplete.mp3",
  running: ["/sounds/running1.mp3", "/sounds/running2.mp3", "/sounds/running3.mp3"],
} as const;

interface AudioBank {
  waitingRoom: HTMLAudioElement;
  kickoff: HTMLAudioElement;
  raceComplete: HTMLAudioElement;
  running: HTMLAudioElement[];
}

let bank: AudioBank | null = null;

function buildBank(): AudioBank {
  const waitingRoom = new Audio(SOUND_SRC.waitingRoom);
  waitingRoom.loop = true;
  waitingRoom.volume = 0.3;

  const kickoff = new Audio(SOUND_SRC.kickoff);
  kickoff.volume = 0.7;

  const raceComplete = new Audio(SOUND_SRC.raceComplete);
  raceComplete.volume = 0.7;

  const running = SOUND_SRC.running.map((src) => {
    const el = new Audio(src);
    el.volume = 0.35;
    return el;
  });

  return { waitingRoom, kickoff, raceComplete, running };
}

function getBank(): AudioBank | null {
  if (typeof window === "undefined") return null;
  if (!bank) bank = buildBank();
  return bank;
}

/**
 * Call synchronously inside the sound-toggle's onClick — see the module
 * doc comment above for why. Playing then pausing each element unlocks it
 * without anything audible happening — pause() runs synchronously, in the
 * same tick as play(), specifically so it can't race a real play() call
 * from elsewhere (e.g. startWaitingRoomAmbience firing moments later, once
 * soundEnabled flips true). Waiting for the play() promise to resolve
 * before pausing — the previous approach — left a window where that real
 * playback could start first and then get stomped by this delayed pause.
 */
export function unlockAudio(): void {
  const b = getBank();
  if (!b) return;
  for (const el of [b.waitingRoom, b.kickoff, b.raceComplete, ...b.running]) {
    const playPromise = el.play();
    el.pause();
    el.currentTime = 0;
    if (playPromise) playPromise.catch(() => {});
  }
}

export function playKickoff(): void {
  const b = getBank();
  if (!b) return;
  b.kickoff.currentTime = 0;
  void b.kickoff.play().catch(() => {});
}

export function playRaceComplete(): void {
  const b = getBank();
  if (!b) return;
  b.raceComplete.currentTime = 0;
  void b.raceComplete.play().catch(() => {});
}

export function startWaitingRoomAmbience(): void {
  const b = getBank();
  if (!b) return;
  void b.waitingRoom.play().catch(() => {});
}

export function stopWaitingRoomAmbience(): void {
  if (!bank) return;
  bank.waitingRoom.pause();
  bank.waitingRoom.currentTime = 0;
}

let lastRunningIndex = -1;

function playRunningOnce(volumeScale: number): void {
  const b = getBank();
  if (!b) return;
  let index = Math.floor(Math.random() * b.running.length);
  if (b.running.length > 1 && index === lastRunningIndex) {
    index = (index + 1) % b.running.length;
  }
  lastRunningIndex = index;
  const el = b.running[index];
  el.currentTime = 0;
  el.volume = Math.max(0, Math.min(1, 0.35 * volumeScale));
  void el.play().catch(() => {});
}

let runningTimer: ReturnType<typeof setTimeout> | null = null;

const RUNNING_DELAY_MIN_MS = 220;
const RUNNING_DELAY_MAX_MS = 380;

/**
 * Footsteps, driven by how much of the field is still actually running —
 * not a flat loop. `getActiveFraction` should return 0..1 (1 = everyone
 * still going, 0 = everyone's finished); callers derive this from the same
 * pure race-position math the visual animation uses, so the sound tracks
 * what's actually on screen. Density thins out as runners finish — longer
 * gaps, quieter — and the scheduler stops itself the moment the fraction
 * hits 0, rather than needing a separate "the race is over" signal.
 */
export function startRunningSounds(getActiveFraction: () => number): void {
  if (typeof window === "undefined" || runningTimer) return;

  function tick() {
    const fraction = getActiveFraction();
    if (fraction <= 0) {
      runningTimer = null;
      return;
    }
    playRunningOnce(0.4 + fraction * 0.6);
    const spread = RUNNING_DELAY_MAX_MS - RUNNING_DELAY_MIN_MS;
    // Fewer runners still going → sparser footsteps.
    const delay = RUNNING_DELAY_MIN_MS + Math.random() * spread + (1 - fraction) * 350;
    runningTimer = setTimeout(tick, delay);
  }
  tick();
}

export function stopRunningSounds(): void {
  if (runningTimer) {
    clearTimeout(runningTimer);
    runningTimer = null;
  }
}

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
