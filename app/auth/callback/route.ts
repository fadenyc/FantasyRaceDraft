import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

/** Exchanges the OAuth code Google (or any future provider) sends back for a real session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const failureUrl = new URL("/login", origin);
  failureUrl.searchParams.set("error", "Sign-in failed — try again.");
  return NextResponse.redirect(failureUrl);
}
