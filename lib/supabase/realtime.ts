import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sends a one-off Realtime Broadcast message from the server. The channel
 * must be subscribed before a message can be sent, so this joins, sends,
 * then leaves — used for the single `race_start` signal at reveal time.
 */
export async function broadcastOnce(
  supabase: SupabaseClient,
  channelName: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const channel = supabase.channel(channelName);

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error(`Realtime channel subscribe failed: ${status}`));
      }
    });
  });

  await channel.send({ type: "broadcast", event, payload });
  await supabase.removeChannel(channel);
}
