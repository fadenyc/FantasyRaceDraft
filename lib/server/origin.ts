import "server-only";
import { headers } from "next/headers";

/** Builds the app's own origin from request headers, so Server Components can render absolute links without a client-side hydration workaround. */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
