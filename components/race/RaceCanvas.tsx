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
export const PREROLL_MS = READY_MS + SET_MS + GO_MS;

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

// ---- Field layout geometry -------------------------------------------
// Grid columns: team name | playable field (shared turf + lanes) | shared
// end zone | rank. Sized with clamp() so every region scales fluidly
// between mobile and desktop instead of jumping at a single breakpoint.
const NAME_COL = "clamp(3.75rem, 15vw, 10rem)";
const ENDZONE_COL = "clamp(1.5rem, 6vw, 3.25rem)";
const RANK_COL = "clamp(2.25rem, 8vw, 3.5rem)";
const GRID_TEMPLATE_COLUMNS = `${NAME_COL} minmax(0, 1fr) ${ENDZONE_COL} ${RANK_COL}`;
const LANE_HEIGHT = "clamp(2rem, 6vw, 2.5rem)";

// Yard markers as [value, xPercent]. The 50 sits centered; values count
// back down toward the end zone on either side, matching a real field.
// `mobile: false` entries are hidden below sm — the reduced set is
// `20 40 50 40 20`.
const YARD_MARKERS: { value: number; x: number; mobile: boolean }[] = [
  { value: 10, x: 5, mobile: false },
  { value: 20, x: 15, mobile: true },
  { value: 30, x: 25, mobile: false },
  { value: 40, x: 35, mobile: true },
  { value: 50, x: 50, mobile: true },
  { value: 40, x: 65, mobile: true },
  { value: 30, x: 75, mobile: false },
  { value: 20, x: 85, mobile: true },
  { value: 10, x: 95, mobile: false },
];

// Alternating vertical mowing stripes, a very faint grass-grain speckle,
// and the major yard lines — all as layered CSS gradients on one shared
// field element (no photograph, no per-lane repetition).
const FIELD_TEXTURE_STYLE: CSSProperties = {
  backgroundImage: [
    // Major yard lines every 10% of the field width.
    "repeating-linear-gradient(90deg, transparent, transparent calc(10% - 1px), color-mix(in srgb, var(--color-chalk) 22%, transparent) calc(10% - 1px), color-mix(in srgb, var(--color-chalk) 22%, transparent) 10%)",
    // Mowing stripes: alternating light/dark vertical bands.
    "repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-field-500) 7%, transparent) 0, color-mix(in srgb, var(--color-field-500) 7%, transparent) 5%, transparent 5%, transparent 10%)",
    // Very subtle grass-grain speckle.
    "repeating-radial-gradient(circle at 3px 3px, color-mix(in srgb, var(--color-chalk) 5%, transparent) 0, transparent 2px, transparent 9px)",
  ].join(", "),
  backgroundSize: "100% 100%, 100% 100%, 9px 9px",
  backgroundRepeat: "no-repeat, no-repeat, repeat",
};

// Finer hash-mark ticks between the major yard lines — hidden on mobile
// (via className) to keep the field readable at small sizes.
const HASH_MARKS_STYLE: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(90deg, transparent, transparent calc(2% - 1px), color-mix(in srgb, var(--color-chalk) 12%, transparent) calc(2% - 1px), color-mix(in srgb, var(--color-chalk) 12%, transparent) 2%)",
  backgroundSize: "100% 16%",
  backgroundPosition: "0 0, 0 100%",
  backgroundRepeat: "no-repeat",
};

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

  // Tracks the width of the shared field column itself (not the name
  // column or the shared end zone) — every runner's horizontal position is
  // a fraction of exactly this width, so progress=1 always lands right at
  // the goal line regardless of how wide the name/rank columns are.
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

  const rowCount = teamsWithSheet.length;

  return (
    <div
      className="relative grid gap-x-1.5 overflow-hidden rounded-xl border border-turf-700 bg-turf-950 p-2 sm:gap-x-3 sm:p-4"
      style={{ gridTemplateColumns: GRID_TEMPLATE_COLUMNS, gridAutoRows: LANE_HEIGHT, rowGap: "0.375rem" }}
    >
      {phase === "preroll" && !reducedMotion && mode.mode !== "idle" && <ReadySetGo />}

      {/* Shared field turf — one continuous background behind every lane,
          not repeated per row. Purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none rounded-md bg-turf-700"
        style={{ gridColumn: 2, gridRow: `1 / span ${rowCount}` }}
      />
      <div
        ref={trackRef}
        aria-hidden="true"
        className="pointer-events-none rounded-md"
        style={{ gridColumn: 2, gridRow: `1 / span ${rowCount}`, ...FIELD_TEXTURE_STYLE }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none hidden rounded-md sm:block"
        style={{ gridColumn: 2, gridRow: `1 / span ${rowCount}`, ...HASH_MARKS_STYLE }}
      />

      {/* Yard numbers — block-style, translucent, desktop shows all nine,
          mobile shows the reduced 20/40/50/40/20 set. */}
      {YARD_MARKERS.map((marker, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`pointer-events-none flex items-center justify-center font-display text-[clamp(0.65rem,2.4vw,1.1rem)] text-chalk/25 ${
            marker.mobile ? "" : "hidden sm:flex"
          }`}
          style={{
            gridColumn: 2,
            gridRow: `1 / span ${rowCount}`,
            justifySelf: "start",
            marginLeft: `${marker.x}%`,
            transform: "translateX(-50%)",
          }}
        >
          {marker.value}
        </div>
      ))}

      {/* Shared end zone — one instance for the whole field, not per lane. */}
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-r-md border-l-[3px] border-chalk bg-gradient-to-l from-endzone-700 via-endzone-600/90 to-endzone-600/60"
        style={{ gridColumn: 3, gridRow: `1 / span ${rowCount}` }}
      >
        <span
          aria-hidden="true"
          className="font-display text-[clamp(0.6rem,2.6vw,1rem)] font-bold tracking-[0.15em] text-chalk/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] [writing-mode:vertical-rl]"
        >
          TOUCHDOWN
        </span>
      </div>

      {teamsWithSheet.map((team, index) => {
        const row = index + 1;

        return (
          <div
            key={team.id}
            className="flex min-w-0 items-center truncate rounded pl-1 text-[clamp(0.65rem,2.8vw,0.875rem)] font-medium text-chalk"
            style={{ gridColumn: 1, gridRow: row }}
          >
            {team.name}
          </div>
        );
      })}

      {teamsWithSheet.map((team, index) => {
        const row = index + 1;
        return (
          <div
            key={team.id}
            ref={(el) => {
              getRefs(team.id).row = el;
            }}
            className={`lane-row relative min-w-0 overflow-visible ${
              index < rowCount - 1 ? "border-b border-chalk/10" : ""
            }`}
            style={{ gridColumn: 2, gridRow: row }}
          >
            <div
              ref={(el) => {
                getRefs(team.id).wrapper = el;
              }}
              className="runner-wrapper absolute top-1/2 z-10 h-[clamp(2.5rem,7vw,3.5rem)] w-[clamp(2.5rem,7vw,3.5rem)] -translate-y-1/2 will-change-transform"
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
                // The sprite frame has ~25-30% transparent padding before
                // the character's trailing edge (measured directly from
                // the sheet: left-edge pixels start around x=0.21-0.36 of
                // each frame across the run cycle) — right-full would sit
                // flush with the wrapper's raw edge, leaving a visible
                // gap between the streak and the visible character.
                className="pointer-events-none absolute right-[72%] top-1/2 h-1.5 w-5 -translate-y-1/2 rounded-full bg-gradient-to-l from-chalk/70 to-transparent opacity-0 sm:w-7"
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
        );
      })}

      {teamsWithSheet.map((team, index) => {
        const displayRank = lockedRanks[team.id] ?? (liveStandings.indexOf(team.id) + 1 || null);
        const isLocked = Boolean(lockedRanks[team.id]);
        const row = index + 1;
        return (
          <div
            key={team.id}
            className={`rank-label flex items-center justify-end text-[clamp(0.65rem,2.6vw,0.875rem)] font-bold tabular-nums ${
              isLocked ? "text-gold-500" : "text-chalk-faint"
            }`}
            style={{ gridColumn: 4, gridRow: row }}
          >
            {displayRank ? ordinal(displayRank) : ""}
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
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="ready-set-go rounded-full bg-turf-950/80 px-6 py-2 font-display text-2xl tracking-widest text-gold-500">
        <span className="ready-text">READY</span>
        <span className="set-text">SET</span>
        <span className="go-text">GO!</span>
      </div>
    </div>
  );
}
