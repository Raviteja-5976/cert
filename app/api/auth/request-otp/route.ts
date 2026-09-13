import { NextResponse } from "next/server";
import { normalizeEmail, adminEmails } from "../../../../lib/auth";
import { supabaseAdmin, supabaseAnon, isSupabaseConfigured } from "../../../../lib/supabase/admin";
import { markOtpRequested, otpCooldownRemaining } from "../../../../lib/rate-limit";

export const runtime = "nodejs";

/** Uniform response so the endpoint never reveals whether an address is on the roster. */
const NEUTRAL = { message: "If this email is registered for the workshop, a verification code is on its way." };

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Certificate claiming is not available yet. Please try again later." }, { status: 503 });
  }
  let email = "";
  try {
    email = normalizeEmail(((await request.json()) as { email?: string }).email || "");
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const cooldown = otpCooldownRemaining(email);
  if (cooldown > 0) {
    return NextResponse.json({ ...NEUTRAL, cooldown }, { status: 429 });
  }

  const db = supabaseAdmin();
  const { data: student } = await db.from("students").select("id").eq("email", email).eq("eligible", true).maybeSingle();
  const eligible = Boolean(student) || adminEmails().includes(email);

  // Always mark the attempt so probing an unknown address costs the same as a real one.
  markOtpRequested(email);
  if (!eligible) return NextResponse.json({ ...NEUTRAL, cooldown: 60 });

  const { error } = await supabaseAnon().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    console.error("OTP dispatch failed", { email: email.replace(/(.{2}).*(@.*)/, "$1***$2"), message: error.message });
    return NextResponse.json({ error: "We could not send the verification code. Please try again in a moment." }, { status: 502 });
  }
  return NextResponse.json({ ...NEUTRAL, cooldown: 60 });
}
