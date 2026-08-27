"use client";

export interface EmojiBurst {
  id: string;
  emoji: string;
  xPercent: number;
}

interface FloatingEmojiProps {
  bursts: EmojiBurst[];
  onComplete: (id: string) => void;
}

/** Overlay of rising, fading emoji reactions — the "louder" version of the cheer button. */
export function FloatingEmojiOverlay({ bursts, onComplete }: FloatingEmojiProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bursts.map((burst) => (
        <span
          key={burst.id}
          className="animate-float-up absolute bottom-0 text-3xl"
          style={{ left: `${burst.xPercent}%` }}
          onAnimationEnd={() => onComplete(burst.id)}
        >
          {burst.emoji}
        </span>
      ))}
    </div>
  );
}
