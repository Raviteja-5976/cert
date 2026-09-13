import { NextResponse } from "next/server";
import { currentStudent } from "../../../lib/auth";
import { isSupabaseConfigured } from "../../../lib/supabase/admin";
import { buildMeResponse } from "../../../lib/me";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the claim flow and dashboard need, resolved from the session alone. */
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const context = await currentStudent();
  if (!context) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json(await buildMeResponse(context));
}
