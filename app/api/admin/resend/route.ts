import { NextResponse } from "next/server";
import { isAdmin } from "../../../../lib/auth";
import { isSupabaseConfigured } from "../../../../lib/supabase/admin";
import { resendCertificate } from "../../../../lib/certificate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  let certificateNumber = "";
  try {
    certificateNumber = ((await request.json()) as { certificateNumber?: string }).certificateNumber?.trim() || "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!certificateNumber) return NextResponse.json({ error: "A certificate number is required." }, { status: 400 });

  try {
    const emailSent = await resendCertificate(certificateNumber);
    return NextResponse.json({ emailSent }, { status: emailSent ? 200 : 502 });
  } catch (error) {
    console.error("Admin resend failed", { certificateNumber, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Resend failed." }, { status: 500 });
  }
}
