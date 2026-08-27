import { hashColor } from "@/lib/color";
import type { PresenceEntry } from "./usePresence";

interface PresenceAvatarsProps {
  entries: PresenceEntry[];
}

export function PresenceAvatars({ entries }: PresenceAvatarsProps) {
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {entries.slice(0, 8).map((entry) => (
          <div
            key={entry.key}
            title={entry.label}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-turf-950 text-xs font-bold text-turf-950 shadow"
            style={{ backgroundColor: hashColor(entry.key) }}
          >
            {entry.label.slice(0, 1).toUpperCase()}
          </div>
        ))}
      </div>
      {entries.length > 8 && (
        <span className="text-xs text-chalk-muted">+{entries.length - 8} more</span>
      )}
      <span className="text-xs text-chalk-muted">
        {entries.length} watching live
      </span>
    </div>
  );
}
