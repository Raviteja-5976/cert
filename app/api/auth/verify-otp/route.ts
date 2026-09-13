import { NextResponse } from "next/server";
import { currentStudent, isAdmin, normalizeEmail } from "../../../../lib/auth";
import { supabaseServer } from "../../../../lib/supabase/server";
import { isSupabaseConfigured } from "../../../../lib/supabase/admin";
import { buildMeResponse } from "../../../../lib/me";

export const runtime = "nodejs";

/**
 * Verifies the emailed code on the server so the session cookie is written with Set-Cookie
 * on this response. Verifying in the browser instead leaves the very next request racing the
 * client-side cookie write, which surfaces as a bogus "not registered" error.
 *
 * Responds with a discriminated role so the caller knows where to send the user, and includes
 * the dashboard payload for students so no follow-up request is needed.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Certificate claiming is not available yet. Please try again later." }, { status: 503 });
  }

  let email = "";
  let token = "";
  try {
    const body = (await request.json()) as { email?: string; token?: string };
    email = normalizeEmail(body.email || "");
    token = (body.token || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || !token) return NextResponse.json({ error: "Enter the code we emailed you." }, { status: 400 });

  const client = await supabaseServer();
  if (!client) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  const { error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    console.warn("OTP verification failed", { status: error.status });
    return NextResponse.json({ error: "The verification code is incorrect or expired. Please try again." }, { status: 401 });
  }

  // The session now exists, but the address still has to be on the roster or the admin allowlist.
  const context = await currentStudent();
  if (context) return NextResponse.json({ role: "student", me: await buildMeResponse(context) });
  if (await isAdmin()) return NextResponse.json({ role: "admin" });

  await client.auth.signOut();
  return NextResponse.json({ error: "This email is not registered for the workshop. Please contact DevTrackAcademy." }, { status: 403 });
}
