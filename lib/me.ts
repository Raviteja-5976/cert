import { supabaseAdmin } from "./supabase/admin";
import type { StudentContext } from "./auth";
import type { MeResponse } from "./types";

/** Shared by /api/me and /api/auth/verify-otp so both return an identical payload. */
export async function buildMeResponse({ student, workshop }: StudentContext): Promise<MeResponse> {
  const db = supabaseAdmin();
  const [{ data: feedback }, { data: claim }] = await Promise.all([
    db.from("feedback").select("id").eq("student_id", student.id).eq("workshop_id", student.workshop_id).maybeSingle(),
    db.from("certificate_claims").select("certificate_number,claimed_at,email_sent").eq("student_id", student.id).eq("workshop_id", student.workshop_id).maybeSingle(),
  ]);

  return {
    student: {
      name: student.name,
      email: student.email,
      registeredName: student.registeredName,
      nameEdited: student.nameEdited,
      canEditName: !claim,
    },
    workshop: {
      name: workshop.name,
      date: workshop.workshop_start_date,
      promoCode: workshop.promo_code,
      interviewUrl: workshop.interview_platform_url,
      devToolsUrl: workshop.dev_tools_url,
      resources: workshop.resources,
    },
    feedbackSubmitted: Boolean(feedback),
    certificate: claim ? { certificateNumber: claim.certificate_number, claimedAt: claim.claimed_at, emailSent: claim.email_sent } : null,
  };
}
