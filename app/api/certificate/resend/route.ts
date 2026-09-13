import { NextResponse } from "next/server";
import { currentStudent } from "../../../../lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase/admin";
import { resendCertificate } from "../../../../lib/certificate";
import { markOtpRequested, otpCooldownRemaining } from "../../../../lib/rate-limit";

export const runtime = "nodejs";

/** Students may retry their own certificate email; the PDF is reused, never regenerated. */
export async function POST() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const context = await currentStudent();
  if (!context) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const key = `resend:${context.student.id}`;
  const cooldown = otpCooldownRemaining(key);
  if (cooldown > 0) return NextResponse.json({ error: `Please wait ${cooldown}s before requesting another email.` }, { status: 429 });

  const { data: claim } = await supabaseAdmin()
    .from("certificate_claims")
    .select("certificate_number")
    .eq("student_id", context.student.id)
    .eq("workshop_id", context.student.workshop_id)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: "No certificate has been issued for this account yet." }, { status: 404 });

  markOtpRequested(key);
  try {
    const emailSent = await resendCertificate(claim.certificate_number);
    return emailSent
      ? NextResponse.json({ emailSent: true })
      : NextResponse.json({ error: "The email could not be delivered. You can still download your certificate below." }, { status: 502 });
  } catch (error) {
    console.error("Student resend failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We could not resend the email right now. Please try again later." }, { status: 500 });
  }
}
