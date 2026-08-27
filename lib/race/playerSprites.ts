// One character sprite sheet per lane, assigned by lane position (team's
// index within the season's team list) — shared between the race canvas
// and anywhere else (like chat) that needs to show "which runner is this".
export const PLAYER_SHEETS = [
  "/images/players/team01-alpha-sheet.png",
  "/images/players/team02-bravo-sheet.png",
  "/images/players/team03-charlie-sheet.png",
  "/images/players/team04-delta-sheet.png",
  "/images/players/team05-echo-sheet.png",
  "/images/players/team06-foxtrot-sheet.png",
  "/images/players/team07-golf-sheet.png",
  "/images/players/team08-hotel-sheet.png",
  "/images/players/team09-india-sheet.png",
  "/images/players/team10-juliett-sheet.png",
  "/images/players/team11-kilo-sheet.png",
  "/images/players/team12-lima-sheet.png",
];

// From the pack's manifest.json: 6 frames, 512px each, laid out horizontally.
export const SHEET_FRAME_COUNT = 6;

export function playerSpriteForIndex(index: number): string {
  return PLAYER_SHEETS[index % PLAYER_SHEETS.length];
}
