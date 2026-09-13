import { pdf } from "@react-pdf/renderer";
import { CertificatePdf } from "./certificate-pdf";
import { certificateArtwork } from "./assets";
import { supabaseAdmin } from "./supabase/admin";
import { sendCertificateEmail } from "./brevo";
import type { Student, Workshop } from "./types";

export const CERTIFICATE_BUCKET = "certificates";

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function verificationUrl(certificateNumber: string) {
  return `${appUrl()}/verify/${certificateNumber}`;
}

export function certificatePath(workshopId: string, certificateNumber: string) {
  return `${workshopId}/${certificateNumber}.pdf`;
}

/** Renders the certificate PDF entirely from database-owned values. */
export async function renderCertificate(input: {
  name: string;
  certificateNumber: string;
  workshopName: string;
  workshopDate: string;
  workshopEndDate?: string | null;
  issueDate?: string | null;
  eventName?: string | null;
  courseName?: string | null;
  formatLabel?: string | null;
  projectsCompleted?: number | null;
}) {
  const artwork = await certificateArtwork();
  const stream = await pdf(CertificatePdf({ ...input, artwork })).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export type ClaimResult = {
  certificateNumber: string;
  emailSent: boolean;
  alreadyClaimed: boolean;
};

/**
 * Issues the certificate exactly once per (student, workshop).
 *
 * The claim row is inserted *before* the PDF is rendered, so the UNIQUE constraint — not
 * application timing — decides the winner when a student double-clicks, refreshes mid-generation,
 * or has two tabs open. The loser simply reads back the winner's row.
 */
export async function issueCertificate(student: Student, workshop: Workshop): Promise<ClaimResult> {
  const db = supabaseAdmin();

  const existing = await readClaim(student);
  if (existing) return { ...existing, alreadyClaimed: true };

  const { data: numberData, error: numberError } = await db.rpc("next_certificate_number", { p_workshop: workshop.id });
  if (numberError || !numberData) throw new Error(`Certificate number allocation failed: ${numberError?.message ?? "no value returned"}`);
  const certificateNumber = numberData as string;
  const path = certificatePath(workshop.id, certificateNumber);

  const { data: inserted, error: insertError } = await db
    .from("certificate_claims")
    .upsert({ student_id: student.id, workshop_id: workshop.id, certificate_number: certificateNumber, certificate_path: path }, { onConflict: "student_id,workshop_id", ignoreDuplicates: true })
    .select("certificate_number")
    .maybeSingle();
  if (insertError) throw insertError;

  if (!inserted) {
    // A concurrent request won the race; its certificate is the canonical one.
    const winner = await readClaim(student);
    if (winner) return { ...winner, alreadyClaimed: true };
    throw new Error("Certificate claim conflicted but no record could be read back.");
  }

  try {
    const pdfBuffer = await renderCertificate({
      name: student.name,
      certificateNumber,
      workshopName: workshop.name,
      workshopDate: workshop.workshop_start_date,
      workshopEndDate: workshop.workshop_end_date,
      issueDate: workshop.certificate_issue_date,
      eventName: workshop.event_name,
      courseName: workshop.course_name,
      formatLabel: workshop.format_label,
      projectsCompleted: workshop.projects_completed,
    });
    const { error: uploadError } = await db.storage.from(CERTIFICATE_BUCKET).upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;
    console.info("Certificate generated", { certificateNumber, workshop: workshop.slug });

    const emailSent = await deliverCertificate({ student, certificateNumber, workshopName: workshop.name, pdfBuffer });
    return { certificateNumber, emailSent, alreadyClaimed: false };
  } catch (error) {
    // Release the claim so the student can retry instead of being stranded with an empty record.
    await db.from("certificate_claims").delete().eq("student_id", student.id).eq("workshop_id", workshop.id).eq("email_sent", false);
    throw error;
  }
}

async function readClaim(student: Student) {
  const { data } = await supabaseAdmin()
    .from("certificate_claims")
    .select("certificate_number,email_sent")
    .eq("student_id", student.id)
    .eq("workshop_id", student.workshop_id)
    .maybeSingle();
  return data ? { certificateNumber: data.certificate_number, emailSent: data.email_sent } : null;
}

/** Email delivery never invalidates a certificate; a failure is recorded and can be retried. */
export async function deliverCertificate({ student, certificateNumber, workshopName, pdfBuffer }: { student: Student; certificateNumber: string; workshopName: string; pdfBuffer: Buffer }) {
  try {
    await sendCertificateEmail({ to: student.email, recipientName: student.name, certificateNumber, workshopName, pdf: pdfBuffer });
    await supabaseAdmin().from("certificate_claims").update({ email_sent: true, email_sent_at: new Date().toISOString() }).eq("certificate_number", certificateNumber);
    console.info("Certificate email sent", { certificateNumber });
    return true;
  } catch (error) {
    console.error("Certificate email failed", { certificateNumber, message: error instanceof Error ? error.message : "unknown" });
    await supabaseAdmin().from("certificate_claims").update({ email_sent: false }).eq("certificate_number", certificateNumber);
    return false;
  }
}

/** Re-sends an already issued certificate. Never regenerates the PDF. */
export async function resendCertificate(certificateNumber: string) {
  const db = supabaseAdmin();
  const { data: claim } = await db
    .from("certificate_claims")
    .select("certificate_path,students(id,name,certificate_name,email,workshop_id),workshops(name)")
    .eq("certificate_number", certificateNumber)
    .maybeSingle();
  if (!claim) throw new Error("Certificate not found.");

  const row = claim.students as unknown as { id: string; name: string; certificate_name: string | null; email: string; workshop_id: string };
  const student: Student = {
    id: row.id,
    email: row.email,
    name: row.certificate_name?.trim() || row.name,
    registeredName: row.name,
    nameEdited: Boolean(row.certificate_name?.trim()),
    workshop_id: row.workshop_id,
  };
  const workshop = claim.workshops as unknown as { name: string };
  const { data: file, error } = await db.storage.from(CERTIFICATE_BUCKET).download(claim.certificate_path);
  if (error || !file) throw new Error("Stored certificate could not be read.");
  const pdfBuffer = Buffer.from(await file.arrayBuffer());

  console.info("Certificate resend requested", { certificateNumber });
  return deliverCertificate({ student, certificateNumber, workshopName: workshop.name, pdfBuffer });
}

/** Short-lived signed URL so the storage bucket can stay private. */
export async function signedCertificateUrl(path: string, expiresInSeconds = 120) {
  const { data, error } = await supabaseAdmin().storage.from(CERTIFICATE_BUCKET).createSignedUrl(path, expiresInSeconds, { download: path.split("/").pop() });
  if (error || !data) throw new Error("Could not create a download link.");
  return data.signedUrl;
}
