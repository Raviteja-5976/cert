type CertificateEmail = {
  to: string;
  recipientName: string;
  certificateNumber: string;
  workshopName: string;
  pdf: Buffer;
};

const INK = "#1B1F3B";
const PAPER = "#FFF8F0";
const ORANGE = "#FF6B35";

function template({ firstName, workshopName, certificateNumber, dashboardUrl, verifyUrl }: { firstName: string; workshopName: string; certificateNumber: string; dashboardUrl: string; verifyUrl: string }) {
  // Table-based layout with inline styles: the only markup email clients render consistently.
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:${PAPER};font-family:Arial,Helvetica,sans-serif;color:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:4px solid ${INK};border-radius:20px;">
<tr><td style="padding:28px 28px 0;">
  <p style="margin:0;font-size:11px;letter-spacing:2px;font-weight:bold;color:${ORANGE};">DEVTRACKACADEMY</p>
  <h1 style="margin:10px 0 0;font-size:27px;line-height:1.15;color:${INK};">Your certificate is ready &#127891;</h1>
</td></tr>
<tr><td style="padding:18px 28px 0;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 14px;">Hi ${firstName},</p>
  <p style="margin:0 0 14px;">Congratulations on successfully completing the <strong>${workshopName}</strong>.</p>
  <p style="margin:0 0 14px;">Your certificate is attached to this email as a PDF.</p>
</td></tr>
<tr><td style="padding:6px 28px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border:3px solid ${INK};border-radius:14px;">
    <tr><td style="padding:14px 16px;">
      <p style="margin:0;font-size:10px;letter-spacing:1.5px;font-weight:bold;color:#8A8496;">CERTIFICATE ID</p>
      <p style="margin:4px 0 0;font-size:16px;font-weight:bold;font-family:'Courier New',monospace;">${certificateNumber}</p>
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:22px 28px 0;">
  <a href="${dashboardUrl}" style="display:inline-block;padding:13px 22px;background:${ORANGE};color:#ffffff;font-weight:bold;font-size:14px;text-decoration:none;border:3px solid ${INK};border-radius:14px;">View my dashboard</a>
</td></tr>
<tr><td style="padding:18px 28px 28px;font-size:14px;line-height:1.6;">
  <p style="margin:0 0 14px;">From your dashboard you can download the certificate again, copy your interview platform promo code, and revisit the workshop resources.</p>
  <p style="margin:0;">Regards,<br/><strong>DevTrackAcademy</strong></p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#8A8496;">You received this email because you registered for a DevTrackAcademy workshop.</p>
</td></tr></table></body></html>`;
}

function textVersion({ firstName, workshopName, certificateNumber, dashboardUrl }: { firstName: string; workshopName: string; certificateNumber: string; dashboardUrl: string }) {
  return [
    `Hi ${firstName},`,
    "",
    `Congratulations on successfully completing the ${workshopName}.`,
    "Your certificate is attached to this email as a PDF.",
    "",
    `Certificate ID: ${certificateNumber}`,
    `Dashboard: ${dashboardUrl}`,
    "",
    "Regards,",
    "DevTrackAcademy",
  ].join("\n");
}

/** Sends the certificate through Brevo. Server-only — the API key must never reach the browser. */
export async function sendCertificateEmail({ to, recipientName, certificateNumber, workshopName, pdf }: CertificateEmail) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured.");
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "certificates@devtrackacademy.com";
  const senderName = process.env.BREVO_SENDER_NAME || "DevTrackAcademy";
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const context = {
    firstName: recipientName.trim().split(/\s+/)[0] || "there",
    workshopName,
    certificateNumber,
    dashboardUrl: `${base}/dashboard`,
    verifyUrl: `${base}/verify/${certificateNumber}`,
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to, name: recipientName }],
      subject: "Your DevTrackAcademy Certificate is Ready 🎓",
      htmlContent: template(context),
      textContent: textVersion(context),
      attachment: [{ name: `${certificateNumber}.pdf`, content: pdf.toString("base64") }],
      tags: ["certificate"],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo rejected the certificate email (${response.status}): ${detail.slice(0, 200)}`);
  }
}
