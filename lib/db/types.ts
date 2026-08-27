export type SeasonStatus = "setup" | "committed" | "revealed" | "archived";

/** Row shape as exposed by the `public_seasons` view (no admin_token, no pre-reveal server_seed). */
export interface PublicSeason {
  id: string;
  name: string;
  public_token: string;
  scheduled_at: string | null;
  status: SeasonStatus;
  commitment_hash: string | null;
  commitment_published_at: string | null;
  server_seed: string | null;
  reveal_seed_uint32: number | null;
  final_order: string[] | null;
  revealed_at: string | null;
  created_at: string;
}

/** Full row shape, server-side only (service role client) — includes admin_token. */
export interface Season extends PublicSeason {
  admin_token: string;
}

export interface Team {
  id: string;
  season_id: string;
  name: string;
  sort_index: number;
  created_at: string;
}

export interface Claim {
  id: string;
  team_id: string;
  season_id: string;
  client_token: string;
  claimed_at: string;
}

export interface ChatMessage {
  id: string;
  season_id: string;
  client_token: string;
  team_id: string | null;
  body: string;
  created_at: string;
}
