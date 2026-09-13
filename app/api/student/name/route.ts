import { NextResponse } from "next/server";
import { currentStudent } from "../../../../lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "../../../../lib/supabase/admin";
import { buildMeResponse } from "../../../../lib/me";

export const runtime = "nodejs";

const MIN = 2;
const MAX = 80;
// Letters (including accented), spaces, apostrophes, hyphens and full stops. No digits or symbols.
const NAME_PATTERN = /^[\p{L}][\p{L}\s'.-]*$/u;

/**
 * Lets a student correct the spelling of their own certificate name.
 *
 * The roster value in `students.name` is never overwritten - the correction goes to
 * `certificate_name`, so the original registration stays auditable. Editing is refused once the
 * certificate exists, because the PDF has already been rendered and stored under that name.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const context = await currentStudent();
  if (!context) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  const { student } = context;

  let name = "";
  try {
    name = (((await request.json()) as { name?: string }).name || "").replace(/\s+/g, " ").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (name.length < MIN || name.length > MAX) {
    return NextResponse.json({ error: `Your name must be between ${MIN} and ${MAX} characters.` }, { status: 400 });
  }
  if (!NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: "Use letters, spaces, hyphens, apostrophes and full stops only." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: claim } = await db
    .from("certificate_claims")
    .select("certificate_number")
    .eq("student_id", student.id)
    .eq("workshop_id", student.workshop_id)
    .maybeSingle();
  if (claim) {
    return NextResponse.json(
      { error: "Your certificate has already been issued, so the name can no longer be changed here. Please contact DevTrackAcademy." },
      { status: 409 },
    );
  }

  // Storing null when the correction matches the roster keeps "edited" meaningful.
  const value = name === student.registeredName ? null : name;
  const { error } = await db.from("students").update({ certificate_name: value }).eq("id", student.id);
  if (error) {
    console.error("Certificate name update failed", { student: student.id, code: error.code, message: error.message });
    return NextResponse.json({ error: "We could not save that name. Please try again." }, { status: 500 });
  }
  console.info("Certificate name corrected", { student: student.id, edited: value !== null });

  const refreshed = await currentStudent();
  return NextResponse.json(refreshed ? await buildMeResponse(refreshed) : { saved: true });
}
