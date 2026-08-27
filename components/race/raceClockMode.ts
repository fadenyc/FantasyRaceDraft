export type ClockMode =
  | { mode: "idle" }
  | { mode: "live"; raceStartAt: string }
  | { mode: "replay" };
