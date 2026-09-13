import type { Metadata } from "next";
import { CheckCircle2, ChevronLeft, XCircle } from "lucide-react";
import { SiteHeader } from "../../components/site-chrome";
import { supabaseAdmin, isSupabaseConfigured } from "../../../lib/supabase/admin";
import { formatCertificateDateRange } from "../../../lib/certificate-pdf";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify a certificate | DevTrackAcademy",
  description: "Confirm the authenticity of a DevTrackAcademy workshop certificate.",
};

type VerifiedCertificate = {
  name: string;
  workshopName: string;
  issued: string;
  certificateNumber: string;
};

/**
 * Public lookup. Only certificate-facing fields are selected — the student's email address
 * and their feedback are never read here, let alone rendered.
 */
async function lookup(certificateNumber: string): Promise<VerifiedCertificate | null> {
  if (!isSupabaseConfigured()) return null;
  if (!/^[A-Z0-9-]{6,64}$/i.test(certificateNumber)) return null;
  const { data } = await supabaseAdmin()
    .from("certificate_claims")
    .select("certificate_number,claimed_at,students(name),workshops(name,workshop_start_date,workshop_end_date)")
    .eq("certificate_number", certificateNumber.toUpperCase())
    .maybeSingle();
  if (!data) return null;
  const student = data.students as unknown as { name: string } | null;
  const workshop = data.workshops as unknown as { name: string; workshop_start_date: string; workshop_end_date: string | null } | null;
  if (!student || !workshop) return null;
  return {
    name: student.name,
    workshopName: workshop.name,
    issued: formatCertificateDateRange(workshop.workshop_start_date, workshop.workshop_end_date),
    certificateNumber: data.certificate_number,
  };
}

export default async function VerifyPage({ params }: { params: Promise<{ certificateNumber: string }> }) {
  const { certificateNumber } = await params;
  const certificate = await lookup(decodeURIComponent(certificateNumber));

  return (
    <main className="verify-page">
      <SiteHeader chip="CERTIFICATE VERIFICATION" />
      <section className="verify-card card-brut">
        {certificate ? (
          <>
            <div className="verify-icon success">
              <CheckCircle2 size={52} />
            </div>
            <p className="section-kicker">AUTHENTICITY CONFIRMED</p>
            <h1>
              Certificate <span className="marker">verified.</span>
            </h1>
            <p className="lead">This is a valid DevTrackAcademy certificate.</p>
            <dl>
              <div>
                <dt>Recipient</dt>
                <dd>{certificate.name}</dd>
              </div>
              <div>
                <dt>Workshop</dt>
                <dd>{certificate.workshopName}</dd>
              </div>
              <div>
                <dt>Issued</dt>
                <dd>{certificate.issued}</dd>
              </div>
              <div>
                <dt>Certificate ID</dt>
                <dd>
                  <code>{certificate.certificateNumber}</code>
                </dd>
              </div>
              <div>
                <dt>Issued by</dt>
                <dd>DevTrackAcademy</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <div className="verify-icon missing">
              <XCircle size={52} />
            </div>
            <p className="section-kicker">NO MATCH FOUND</p>
            <h1>Certificate not found.</h1>
            <p className="lead">The certificate ID you entered could not be verified. Check the ID and try again.</p>
          </>
        )}
        <a className="back-link" href="/certificate">
          <ChevronLeft size={18} /> Back to certificate claim
        </a>
      </section>
    </main>
  );
}
