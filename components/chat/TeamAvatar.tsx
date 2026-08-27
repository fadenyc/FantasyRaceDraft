import { playerSpriteForIndex, SHEET_FRAME_COUNT } from "@/lib/race/playerSprites";

interface TeamAvatarProps {
  /** The team's index within the season's team list, or null for an unclaimed/guest sender. */
  teamIndex: number | null;
  size?: number;
}

/** A small static crop of a runner's "Contact" frame — same character used in the race, just as an icon. */
export function TeamAvatar({ teamIndex, size = 32 }: TeamAvatarProps) {
  if (teamIndex === null) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-turf-600 bg-turf-900 text-xs text-chalk-faint"
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }

  return (
    <div
      className="shrink-0 rounded-full border border-turf-600 bg-turf-900 bg-no-repeat"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${playerSpriteForIndex(teamIndex)})`,
        backgroundSize: `${size * SHEET_FRAME_COUNT}px ${size}px`,
        backgroundPosition: "0px 0px",
      }}
    />
  );
}
