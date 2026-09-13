import { NextResponse } from "next/server";
import { currentStudent } from "../../../../lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase/admin";
import { signedCertificateUrl } from "../../../../lib/certificate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Redirects to a short-lived signed URL so the bucket itself stays private. */
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const context = await currentStudent();
  if (!context) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const { data: claim } = await supabaseAdmin()
    .from("certificate_claims")
    .select("certificate_path")
    .eq("student_id", context.student.id)
    .eq("workshop_id", context.student.workshop_id)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: "No certificate has been issued for this account yet." }, { status: 404 });

  try {
    return NextResponse.redirect(await signedCertificateUrl(claim.certificate_path), { status: 302 });
  } catch (error) {
    console.error("Signed download URL failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We could not prepare your download. Please try again." }, { status: 500 });
  }
}
