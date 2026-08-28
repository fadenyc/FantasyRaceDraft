"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { computeLiveStandings, computeRacePositions, RACE_DURATION_MS } from "@/lib/race/animation";
import { PLAYER_SHEETS, SHEET_FRAME_COUNT } from "@/lib/race/playerSprites";
import { useReducedMotion } from "./useReducedMotion";
import type { ClockMode } from "./raceClockMode";

export interface RaceCanvasTeam {
  id: string;
  name: string;
}

const ORDINALS = [
  "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th",
  "13th", "14th", "15th", "16th", "17th", "18th", "19th", "20th", "21st", "22nd", "23rd", "24th",
];
function ordinal(rank: number): string {
  return ORDINALS[rank - 1] ?? `${rank}th`;
}

const CONTACT_FRAME = 0;
const RECOVERY_FRAME = 5;

const FPS_MIN = 10;
const FPS_MAX = 14;

const MOBILE_RUNNER_PX = 40;
const DESKTOP_RUNNER_PX = 56;
const DESKTOP_BREAKPOINT = "(min-width: 640px)";

const READY_MS = 650;
const SET_MS = 650;
const GO_MS = 500;
const PREROLL_MS = READY_MS + SET_MS + GO_MS;

const FINISH_SETTLE_MS = 450;
const HIGHLIGHT_MS = 700;
const MAX_FRAME_DELTA_MS = 250; // caps sprite-cadence catch-up after a backgrounded tab

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Small decaying oscillation for the finish-line overshoot + spring-back. */
function overshootPx(msSinceFinish: number): number {
  if (msSinceFinish >= FINISH_SETTLE_MS) return 0;
  const t = msSinceFinish / FINISH_SETTLE_MS;
  return 7 * Math.exp(-4.5 * t) * Math.cos(t * Math.PI * 2.2);
}

interface RunnerDomRefs {
  wrapper: HTMLDivElement | null;
  sprite: HTMLDivElement | null;
  shadow: HTMLDivElement | null;
  streak: HTMLDivElement | null;
  row: HTMLDivElement | null;
}

interface RunnerEngineState {
  spritePhase: number;
  finished: boolean;
  finishedAtMs: number | null;
  lastSpriteFrame: number;
}

// Repeating yard-line stripes, stopping before the end zone.
const YARD_LINES_STYLE: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(90deg, transparent, transparent calc(10% - 1px), color-mix(in srgb, var(--color-chalk) 18%, transparent) calc(10% - 1px), color-mix(in srgb, var(--color-chalk) 18%, transparent) 10%)",
  backgroundSize: "90% 100%",
  backgroundRepeat: "no-repeat",
};

// Alternating mowed-grass shade per lane — the classic striped-turf look,
// reusing the app's existing turf tones so it stays on-palette.
const LANE_TURF_CLASS = ["bg-turf-700", "bg-turf-800"];

export interface RaceCanvasProps {
  teams: RaceCanvasTeam[];
  finalOrder: string[];
  seed: number;
  mode: ClockMode;
  /** How long the race takes to play out, in ms. Defaults to the standard 60s race. */
  durationMs?: number;
  onComplete?: () => void;
}

export function RaceCanvas({
  teams,
  finalOrder,
  seed,
  mode,
  durationMs = RACE_DURATION_MS,
  onComplete,
}: RaceCanvasProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const trackWidthRef = useRef(0);
  const domRefs = useRef<Map<string, RunnerDomRefs>>(new Map());
  const engineRefs = useRef<Map<string, RunnerEngineState>>(new Map());
  const runnerSizeRef = useRef(MOBILE_RUNNER_PX);

  const [liveStandings, setLiveStandings] = useState<string[]>(finalOrder);
  const [lockedRanks, setLockedRanks] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<"preroll" | "racing">("preroll");

  const reducedMotion = useReducedMotion();
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const teamsWithSheet = useMemo(
    () => teams.map((team, index) => ({ ...team, sheet: PLAYER_SHEETS[index % PLAYER_SHEETS.length] })),
    [teams],
  );

  function getRefs(teamId: string): RunnerDomRefs {
    let refs = domRefs.current.get(teamId);
    if (!refs) {
      refs = { wrapper: null, sprite: null, shadow: null, streak: null, row: null };
      domRefs.current.set(teamId, refs);
    }
    return refs;
  }
  function getEngine(teamId: string): RunnerEngineState {
    let state = engineRefs.current.get(teamId);
    if (!state) {
      state = { spritePhase: 0, finished: false, finishedAtMs: null, lastSpriteFrame: CONTACT_FRAME };
      engineRefs.current.set(teamId, state);
    }
    return state;
  }

  // Track how wide the racetrack actually is (px) so position can be
  // expressed as a transform rather than a percentage-based `left` — and
  // stays correct across resizes without any extra logic, since every
  // frame just re-reads the current width.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      trackWidthRef.current = entries[0]?.contentRect.width ?? el.clientWidth;
    });
    observer.observe(el);
    trackWidthRef.current = el.clientWidth;
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_BREAKPOINT);
    const apply = () => {
      runnerSizeRef.current = query.matches ? DESKTOP_RUNNER_PX : MOBILE_RUNNER_PX;
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // Reduced motion: skip continuous racing entirely — jump straight to the
  // final frame with a short crossfade, per prefers-reduced-motion.
  useEffect(() => {
    if (!reducedMotion || mode.mode === "idle") return;
    // No need to touch `phase` here — the READY/SET/GO overlay is already
    // gated on `!reducedMotion` in the render below.
    const positions = computeRacePositions(seed, finalOrder, durationMs, durationMs);
    const standings = computeLiveStandings(positions);
    // One-time sync to an external condition (the OS-level reduced-motion
    // preference), not a per-frame update — jump straight to final
    // standings rather than animating through them.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveStandings(standings);
    setLockedRanks(Object.fromEntries(standings.map((teamId, i) => [teamId, i + 1])));

    positions.forEach((pos) => {
      const refs = domRefs.current.get(pos.teamId);
      if (!refs?.wrapper || !refs.sprite) return;
      const width = trackWidthRef.current || 0;
      const size = runnerSizeRef.current;
      refs.wrapper.style.transition = "opacity 500ms ease";
      refs.wrapper.style.opacity = "0";
      requestAnimationFrame(() => {
        refs.wrapper!.style.transform = `translate3d(${pos.progress * width - size}px, 0, 0)`;
        setSpriteFrame(refs.sprite!, CONTACT_FRAME, size);
        refs.wrapper!.style.opacity = "1";
      });
    });

    const timer = setTimeout(() => onCompleteRef.current?.(), 550);
    return () => clearTimeout(timer);
  }, [reducedMotion, mode.mode, seed, finalOrder, durationMs]);

  // The main engine: one rAF loop drives every runner's transform and
  // sprite frame directly via refs — no React state per frame. Position is
  // always resampled from absolute elapsed time (a pure function), so a
  // backgrounded tab just resyncs instantly next frame with no catch-up
  // jump; only the sprite run-cycle's frame-time accumulation is capped.
  useEffect(() => {
    if (reducedMotion || mode.mode === "idle") return;

    const origin = mode.mode === "live" ? new Date(mode.raceStartAt).getTime() : Date.now();
    let frameId: number;
    let lastFrameTime = performance.now();
    let lastPublishedOrder = "";
    let done = false;

    function tick(nowPerf: number) {
      const rawDelta = nowPerf - lastFrameTime;
      lastFrameTime = nowPerf;
      const dtMs = clamp(rawDelta, 0, MAX_FRAME_DELTA_MS);

      const rawElapsed = Date.now() - origin;
      const elapsed = clamp(rawElapsed, 0, durationMs);
      setPhase(elapsed >= PREROLL_MS ? "racing" : "preroll");

      const positions = computeRacePositions(seed, finalOrder, elapsed, durationMs);
      const standings = computeLiveStandings(positions);
      const width = trackWidthRef.current || 0;
      const size = runnerSizeRef.current;

      positions.forEach((pos) => {
        const refs = getRefs(pos.teamId);
        const engine = getEngine(pos.teamId);
        if (!refs.wrapper || !refs.sprite) return;

        const liveRank = standings.indexOf(pos.teamId) + 1;
        const justFinished = pos.finished && !engine.finished;
        if (justFinished) {
          engine.finished = true;
          engine.finishedAtMs = elapsed;
          setLockedRanks((prev) => (prev[pos.teamId] ? prev : { ...prev, [pos.teamId]: liveRank }));
          if (refs.row) {
            refs.row.classList.remove("lane-finish-highlight");
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            refs.row.offsetWidth; // restart the CSS animation
            refs.row.classList.add("lane-finish-highlight");
            setTimeout(() => refs.row?.classList.remove("lane-finish-highlight"), HIGHLIGHT_MS);
          }
        }

        const baseX = pos.progress * width - size;
        const msSinceFinish = engine.finishedAtMs !== null ? elapsed - engine.finishedAtMs : 0;
        const overshoot = engine.finished ? overshootPx(msSinceFinish) : 0;

        // Subtle bob (2-4px) and an accel-based lean, both derived purely
        // from elapsed time and current velocity — never randomly jittered
        // frame to frame.
        const bobPx = engine.finished ? 0 : Math.sin(elapsed * 0.012 + hashPhase(pos.teamId)) * 3 + 3;
        const leanDeg = engine.finished ? 0 : clamp(pos.velocity * 40_000, -6, 10);

        refs.wrapper.style.transform =
          `translate3d(${baseX + overshoot}px, ${-bobPx}px, 0) rotate(${leanDeg}deg)`;

        if (refs.shadow) {
          const shadowScale = clamp(1 - bobPx / 14, 0.72, 1);
          refs.shadow.style.transform = `scaleX(${shadowScale}) scaleY(${shadowScale * 0.6})`;
          refs.shadow.style.opacity = String(clamp(shadowScale, 0.25, 0.55));
        }

        if (refs.streak) {
          const speedNorm = clamp(pos.velocity * 60_000, 0, 1);
          refs.streak.style.opacity = speedNorm > 0.55 ? String((speedNorm - 0.55) / 0.45) : "0";
        }

        // Sprite run-cycle: pause on Contact before the runner has actually
        // started moving (still in READY/SET), freeze on Contact or
        // Recovery once finished (picked deterministically per runner so
        // the finish line doesn't look identical for every lane), otherwise
        // cadence scales with velocity.
        if (engine.finished) {
          const finishPose = hashPhase(pos.teamId) < Math.PI ? CONTACT_FRAME : RECOVERY_FRAME;
          if (engine.lastSpriteFrame !== finishPose) {
            setSpriteFrame(refs.sprite, finishPose, size);
            engine.lastSpriteFrame = finishPose;
          }
        } else if (elapsed < PREROLL_MS || pos.progress <= 0) {
          if (engine.lastSpriteFrame !== CONTACT_FRAME) {
            setSpriteFrame(refs.sprite, CONTACT_FRAME, size);
            engine.lastSpriteFrame = CONTACT_FRAME;
          }
        } else {
          const speedNorm = clamp(pos.velocity * 45_000, 0, 1);
          const fps = FPS_MIN + (FPS_MAX - FPS_MIN) * speedNorm;
          engine.spritePhase += (dtMs / 1000) * fps;
          const frame = Math.floor(engine.spritePhase) % SHEET_FRAME_COUNT;
          if (frame !== engine.lastSpriteFrame) {
            setSpriteFrame(refs.sprite, frame, size);
            engine.lastSpriteFrame = frame;
          }
        }
      });

      const orderKey = standings.join(",");
      if (orderKey !== lastPublishedOrder) {
        lastPublishedOrder = orderKey;
        setLiveStandings(standings);
      }

      if (elapsed < durationMs) {
        frameId = requestAnimationFrame(tick);
      } else if (!done) {
        done = true;
        onCompleteRef.current?.();
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.mode, mode.mode === "live" ? mode.raceStartAt : null, seed, finalOrder, reducedMotion, durationMs]);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-turf-700 bg-gradient-to-b from-turf-900 via-turf-800/80 to-turf-900 p-2 sm:gap-2 sm:p-4">
      {phase === "preroll" && !reducedMotion && mode.mode !== "idle" && <ReadySetGo />}
      {teamsWithSheet.map((team, index) => {
        const displayRank = lockedRanks[team.id] ?? (liveStandings.indexOf(team.id) + 1 || null);
        const isLocked = Boolean(lockedRanks[team.id]);

        return (
          <div
            key={team.id}
            ref={(el) => {
              getRefs(team.id).row = el;
            }}
            className="lane-row flex items-center gap-1.5 rounded sm:gap-3"
          >
            <div className="w-16 shrink-0 truncate text-xs font-medium text-chalk sm:w-40 sm:text-sm">
              {team.name}
            </div>
            <div
              ref={index === 0 ? trackRef : undefined}
              className={`relative h-8 min-w-0 flex-1 overflow-visible rounded-md sm:h-9 ${LANE_TURF_CLASS[index % 2]}`}
              style={YARD_LINES_STYLE}
            >
              <div className="absolute inset-y-0 right-0 flex w-[12%] items-center justify-center overflow-hidden rounded-r-md border-l-2 border-chalk/80 bg-gradient-to-l from-endzone-700 via-endzone-600 to-endzone-600/70">
                <span className="font-display text-[9px] font-bold tracking-wide text-chalk/90 [text-shadow:0_1px_1px_rgba(0,0,0,0.6)] sm:text-xs">
                  TD
                </span>
              </div>
              <div
                ref={(el) => {
                  getRefs(team.id).wrapper = el;
                }}
                className="runner-wrapper absolute top-1/2 h-10 w-10 -translate-y-1/2 will-change-transform sm:h-14 sm:w-14"
                style={{ transform: "translate3d(-40px, 0, 0)" }}
              >
                <div
                  ref={(el) => {
                    getRefs(team.id).shadow = el;
                  }}
                  className="absolute bottom-0 left-1/2 h-2 w-3/4 -translate-x-1/2 rounded-full bg-black/50 blur-[1px]"
                />
                <div
                  ref={(el) => {
                    getRefs(team.id).streak = el;
                  }}
                  className="pointer-events-none absolute right-full top-1/2 h-1.5 w-6 -translate-y-1/2 rounded-full bg-gradient-to-l from-chalk/70 to-transparent opacity-0 sm:w-9"
                />
                <div
                  ref={(el) => {
                    getRefs(team.id).sprite = el;
                  }}
                  role="img"
                  aria-label={`${team.name} runner`}
                  className="relative h-full w-full bg-no-repeat drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
                  style={{ backgroundImage: `url(${team.sheet})` }}
                />
              </div>
            </div>
            <div
              className={`rank-label w-10 shrink-0 text-right text-xs font-bold tabular-nums sm:w-14 sm:text-sm ${
                isLocked ? "text-gold-500" : "text-chalk-faint"
              }`}
            >
              {displayRank ? ordinal(displayRank) : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function setSpriteFrame(sprite: HTMLDivElement, frame: number, sizePx: number) {
  const sheetWidth = sizePx * SHEET_FRAME_COUNT;
  sprite.style.backgroundSize = `${sheetWidth}px ${sizePx}px`;
  sprite.style.backgroundPosition = `-${frame * sizePx}px 0px`;
}

/** Deterministic per-runner phase offset so bob cycles don't all move in lockstep. */
function hashPhase(teamId: string): number {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) hash = (hash * 31 + teamId.charCodeAt(i)) | 0;
  return (hash >>> 0) % 628 / 100; // 0..2π-ish
}

function ReadySetGo() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="ready-set-go rounded-full bg-turf-950/80 px-6 py-2 font-display text-2xl tracking-widest text-gold-500">
        <span className="ready-text">READY</span>
        <span className="set-text">SET</span>
        <span className="go-text">GO!</span>
      </div>
    </div>
  );
}
