import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

/** Clears the session cookie server-side, mirroring how it was set. */
export async function POST() {
  const client = await supabaseServer();
  if (client) await client.auth.signOut();
  return NextResponse.json({ signedOut: true });
}
