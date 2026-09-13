import { NextResponse } from "next/server";
import { currentStudent } from "../../../../lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase/admin";
import { issueCertificate } from "../../../../lib/certificate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const context = await currentStudent();
  if (!context) return NextResponse.json({ error: "Your session has expired. Please verify your email again." }, { status: 401 });
  const { student, workshop } = context;

  const { data: feedback } = await supabaseAdmin()
    .from("feedback")
    .select("id")
    .eq("student_id", student.id)
    .eq("workshop_id", student.workshop_id)
    .maybeSingle();
  if (!feedback) return NextResponse.json({ error: "Please submit your workshop feedback before claiming the certificate." }, { status: 409 });

  try {
    const result = await issueCertificate(student, workshop);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Certificate claim failed", { student: student.id, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "We could not generate your certificate right now. Your feedback has been saved — please try again in a moment." }, { status: 500 });
  }
}
