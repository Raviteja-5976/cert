import { NextResponse } from "next/server";
import { currentStudent } from "../../../lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "../../../lib/supabase/admin";

export const runtime = "nodejs";

type Payload = {
  workshopRating: number;
  understandingRating: number;
  implementationRating: number;
  resourcePersonRating: number;
  liked: string;
  disliked?: string;
  improvements: string;
  internshipInterest: string;
};

const MAX_TEXT = 2000;
const isRating = (value: unknown) => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;

/** Server-side validation; the client form checks are a convenience only. */
function validate(body: Payload) {
  const ratings = [body.workshopRating, body.understandingRating, body.implementationRating, body.resourcePersonRating];
  if (!ratings.every(isRating)) return "Please give a rating between 1 and 5 for every question.";
  if (!body.liked?.trim()) return "Please tell us what you liked most about the workshop.";
  if (!body.improvements?.trim()) return "Please tell us what we could improve.";
  if (!["Yes", "Maybe", "No"].includes(body.internshipInterest)) return "Please answer the internship question.";
  if ([body.liked, body.disliked || "", body.improvements].some((text) => text.length > MAX_TEXT)) return `Please keep each answer under ${MAX_TEXT} characters.`;
  return null;
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  const context = await currentStudent();
  if (!context) return NextResponse.json({ error: "Your session has expired. Please verify your email again." }, { status: 401 });

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid feedback submission." }, { status: 400 });
  }
  const problem = validate(body);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const { student } = context;
  // UNIQUE(student_id, workshop_id) makes a refresh or a second tab a no-op rather than an error.
  const { error } = await supabaseAdmin()
    .from("feedback")
    .upsert(
      {
        student_id: student.id,
        workshop_id: student.workshop_id,
        workshop_rating: body.workshopRating,
        understanding_rating: body.understandingRating,
        implementation_rating: body.implementationRating,
        resource_person_rating: body.resourcePersonRating,
        liked: body.liked.trim(),
        disliked: body.disliked?.trim() || null,
        improvements: body.improvements.trim(),
        internship_interest: body.internshipInterest,
      },
      { onConflict: "student_id,workshop_id", ignoreDuplicates: true },
    );
  if (error) {
    // Log the full PostgREST error: `message` alone hides the constraint that actually failed.
    console.error("Feedback save failed", {
      student: student.id,
      workshop: student.workshop_id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: "The server could not store your feedback.", stage: "database", code: error.code ?? null },
      { status: 500 },
    );
  }
  return NextResponse.json({ saved: true });
}
