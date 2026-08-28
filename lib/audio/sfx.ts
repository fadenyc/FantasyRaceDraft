/**
 * Sound effects. Most of these are real audio files (public/sounds/) —
 * claim confirmation and reaction-tap stay synthesized via the Web Audio
 * API since no file was provided for those, and they're tiny enough that a
 * synthesized blip is unnoticeable next to the recorded sounds.
 */

const SOUNDS = {
  waitingRoom: "/sounds/waitingroom.mp3",
  kickoff: "/sounds/whentheracestart.mp3",
  raceComplete: "/sounds/racecomplete.mp3",
  running: ["/sounds/running1.mp3", "/sounds/running2.mp3", "/sounds/running3.mp3"],
} as const;

function playOneShot(src: string, volume = 0.6): void {
  if (typeof window === "undefined") return;
  const audio = new Audio(src);
  audio.volume = volume;
  void audio.play().catch(() => {
    // Autoplay can still be blocked in edge cases; nothing useful to do.
  });
}

/** Plays once when the race actually kicks off. */
export function playKickoff(): void {
  playOneShot(SOUNDS.kickoff, 0.7);
}

/** Plays once when the race finishes. */
export function playRaceComplete(): void {
  playOneShot(SOUNDS.raceComplete, 0.7);
}

let waitingRoomAudio: HTMLAudioElement | null = null;

/** Loops the waiting-room ambience. Idempotent — a second call while already playing does nothing. */
export function startWaitingRoomAmbience(): void {
  if (typeof window === "undefined" || waitingRoomAudio) return;
  const audio = new Audio(SOUNDS.waitingRoom);
  audio.loop = true;
  audio.volume = 0.3;
  void audio.play().catch(() => {});
  waitingRoomAudio = audio;
}

export function stopWaitingRoomAmbience(): void {
  if (!waitingRoomAudio) return;
  waitingRoomAudio.pause();
  waitingRoomAudio = null;
}

let runningTimer: ReturnType<typeof setTimeout> | null = null;
let lastRunningIndex = -1;

const RUNNING_DELAY_MIN_MS = 260;
const RUNNING_DELAY_MAX_MS = 460;

/**
 * Footsteps during the race: one clip at a time, picked so the same clip
 * never repeats twice in a row, spaced out with a randomized gap rather
 * than looped back-to-back — that gap is what keeps it sounding like an
 * actual running cadence instead of a mechanical loop.
 */
export function startRunningSounds(): void {
  if (typeof window === "undefined" || runningTimer) return;

  function playNext() {
    let index = Math.floor(Math.random() * SOUNDS.running.length);
    if (SOUNDS.running.length > 1 && index === lastRunningIndex) {
      index = (index + 1) % SOUNDS.running.length;
    }
    lastRunningIndex = index;
    playOneShot(SOUNDS.running[index], 0.35);

    const delay = RUNNING_DELAY_MIN_MS + Math.random() * (RUNNING_DELAY_MAX_MS - RUNNING_DELAY_MIN_MS);
    runningTimer = setTimeout(playNext, delay);
  }

  playNext();
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
