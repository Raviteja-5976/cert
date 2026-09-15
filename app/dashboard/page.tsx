"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Gift,
  GraduationCap,
  Layers3,
  Loader2,
  LogOut,
  MessagesSquare,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { SiteHeader } from "../components/site-chrome";
import type { MeResponse } from "../../lib/types";
import { SOCIALS } from "../../lib/socials";
import { SocialIcon } from "../components/social-icons";

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/me");
        if (!response.ok) {
          router.replace("/certificate");
          return;
        }
        const data = (await response.json()) as MeResponse;
        if (cancelled) return;
        // Nothing to show until the certificate exists — send them back into the claim flow.
        if (!data.certificate) {
          router.replace("/certificate");
          return;
        }
        setMe(data);
        setLoading(false);
      } catch {
        if (!cancelled) router.replace("/certificate");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function resendEmail() {
    setResending(true);
    setResendMessage("");
    try {
      const response = await fetch("/api/certificate/resend", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setResendMessage("Sent. Check your inbox in a minute.");
        setMe((current) => (current && current.certificate ? { ...current, certificate: { ...current.certificate, emailSent: true } } : current));
      } else {
        setResendMessage(payload.error || "We could not send the email. You can still download your certificate.");
      }
    } catch {
      setResendMessage("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    router.replace("/certificate");
    router.refresh();
  }

  if (loading || !me?.certificate) {
    return (
      <main>
        <SiteHeader chip="STUDENT DASHBOARD" />
        <section className="boot-screen">
          <Loader2 className="spin" size={30} />
          <p>Loading your dashboard…</p>
        </section>
      </main>
    );
  }

  const { student, workshop, certificate } = me;
  const firstName = student.name.split(" ")[0];

  return (
    <main>
      <SiteHeader chip="STUDENT DASHBOARD">
        <button className="header-link" type="button" onClick={signOut}>
          <LogOut size={14} /> Sign out
        </button>
      </SiteHeader>

      <section className="dashboard-shell">
        <div className="dashboard-hero">
          <div>
            <p className="eyebrow">
              <ShieldCheck size={15} /> VERIFIED STUDENT ACCESS
            </p>
            <h1>
              Congratulations, <span className="marker">{firstName}!</span>
            </h1>
            <p className="lead">Your DevTrackAcademy workshop certificate is ready to download and share.</p>
          </div>
          <div className="ready-stamp">
            <Check size={20} />
            <span>
              READY TO
              <br />
              DOWNLOAD
            </span>
          </div>
        </div>

        {!certificate.emailSent && (
          <section className="notice warn banner">
            <AlertTriangle size={20} />
            <div>
              <strong>We could not send your certificate email.</strong>
              <p>Your certificate is valid and downloadable below. You can also try sending the email again.</p>
              <button className="tactile-btn secondary small" type="button" onClick={resendEmail} disabled={resending}>
                {resending ? (
                  <>
                    <Loader2 className="spin" size={16} /> Sending…
                  </>
                ) : (
                  "Resend certificate email"
                )}
              </button>
              {resendMessage && <p className="form-hint">{resendMessage}</p>}
            </div>
          </section>
        )}

        <section className="certificate-card card-brut">
          <div className="cert-icon">
            <GraduationCap size={42} />
          </div>
          <div className="cert-copy">
            <p className="section-kicker">
              {workshop.name.toUpperCase()} · {formatDate(workshop.date).toUpperCase()}
            </p>
            <h2>Certificate of Completion</h2>
            <p>
              Issued to <strong>{student.name}</strong>
            </p>
            <span className="certificate-id">{certificate.certificateNumber}</span>
          </div>
          <div className="cert-actions">
            <a className="tactile-btn primary" href="/api/certificate/download">
              <Download size={18} /> Download PDF
            </a>
            <a className="tactile-btn secondary" href={`/verify/${certificate.certificateNumber}`} target="_blank" rel="noreferrer">
              <ShieldCheck size={18} /> Verify
            </a>
          </div>
        </section>

        <div className="benefit-grid">
          <section className="benefit-card promo card-brut">
            <div className="benefit-icon">
              <Gift size={28} />
            </div>
            <p className="section-kicker">INTERVIEW PLATFORM CREDITS</p>
            <h2>Your exclusive code</h2>
            {workshop.promoCode ? (
              <>
                <div className="promo-code">
                  <code>{workshop.promoCode}</code>
                  <button type="button" onClick={() => copyCode(workshop.promoCode as string)} aria-label="Copy promo code">
                    {copied ? <Check size={20} /> : <Clipboard size={20} />}
                  </button>
                </div>
                <p>{copied ? "Copied!" : "Use this code to unlock your interview platform credits."}</p>
              </>
            ) : (
              <p>Your promo code will appear here shortly.</p>
            )}
            {workshop.interviewUrl && (
              <a className="inline-link" href={workshop.interviewUrl} target="_blank" rel="noreferrer">
                Claim credits <ArrowUpRight size={17} />
              </a>
            )}
          </section>

          <section className="benefit-card tools card-brut">
            <div className="benefit-icon">
              <Wrench size={28} />
            </div>
            <p className="section-kicker">STUDENT PERKS</p>
            <h2>Developer tools worth ₹2 lakh+</h2>
            <p>DevTrackAcademy students can claim access to selected developer tools and benefits.</p>
            {workshop.devToolsUrl && (
              <a className="inline-link" href={workshop.devToolsUrl} target="_blank" rel="noreferrer">
                Learn how to claim <ArrowUpRight size={17} />
              </a>
            )}
          </section>
        </div>

        {workshop.resources.length > 0 && (
          <section className="resources-card card-brut">
            <div>
              <div className="benefit-icon">
                <Layers3 size={28} />
              </div>
              <p className="section-kicker">KEEP LEARNING</p>
              <h2>Workshop resources</h2>
              <p>Revisit the tools, projects, and concepts from the workshop whenever you need them.</p>
            </div>
            <div className="resource-list">
              {workshop.resources.map((resource) => (
                <a key={resource.url} href={resource.url} target="_blank" rel="noreferrer">
                  <FileText size={18} />
                  <span>
                    <b>{resource.title}</b>
                    {resource.description && <small>{resource.description}</small>}
                  </span>
                  <ExternalLink size={17} />
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="socials-card card-brut">
          <div>
            <div className="benefit-icon">
              <MessagesSquare size={28} />
            </div>
            <p className="section-kicker">STAY CONNECTED</p>
            <h2>Join the community</h2>
            <p>Workshop announcements, doubt-solving, and the next batch of student perks land here first.</p>
          </div>
          <div className="social-list">
            {SOCIALS.map((social) => (
              <a key={social.url} href={social.url} target="_blank" rel="noreferrer">
                <i className="social-mark" style={{ background: social.color }}>
                  <SocialIcon name={social.name} />
                </i>
                <span>
                  <b>{social.name}</b>
                  <small>{social.description}</small>
                </span>
                <ArrowUpRight size={17} />
              </a>
            ))}
          </div>
        </section>

        <p className="dashboard-foot">
          Need help? <a href="mailto:hello@devtrackacademy.com">Contact DevTrackAcademy</a> · Keep your certificate ID handy for verification.
        </p>
      </section>
    </main>
  );
}
