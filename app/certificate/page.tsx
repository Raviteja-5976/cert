"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, Clock3, Loader2, Mail, Pencil, ShieldCheck, Sparkles, Star, UserRound } from "lucide-react";
import logo from "../../assets/DevTrackAcademy-logo.png";
import { PartnerStrip, SiteHeader } from "../components/site-chrome";
import type { MeResponse } from "../../lib/types";
import { OTP_LENGTH, emptyOtp } from "../../lib/config";

type Step = "email" | "otp" | "name" | "feedback" | "claiming" | "complete";

const RATING_QUESTIONS = [
  ["workshopRating", "How would you rate the workshop overall?"],
  ["understandingRating", "How well do you understand the concepts covered in the workshop?"],
  ["implementationRating", "How confident are you in implementing the projects yourself?"],
  ["resourcePersonRating", "How would you rate the resource person?"],
] as const;

type RatingKey = (typeof RATING_QUESTIONS)[number][0];

function Stepper({ step }: { step: Step }) {
  const items = ["Verify", "Confirm", "Feedback", "Certificate"];
  const active = { email: 0, otp: 0, name: 1, feedback: 2, claiming: 3, complete: 3 }[step];
  return (
    <div className="stepper" aria-label="Claim progress">
      {items.map((item, index) => (
        <div key={item} className={`step ${index <= active ? "is-active" : ""} ${index < active ? "is-done" : ""}`}>
          <span>{index < active ? <Check size={14} /> : index + 1}</span>
          <b>{item}</b>
        </div>
      ))}
    </div>
  );
}

export default function CertificatePage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [step, setStep] = useState<Step>("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(emptyOtp);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [certificateNumber, setCertificateNumber] = useState("");
  const [emailSent, setEmailSent] = useState(true);

  const [ratings, setRatings] = useState<Partial<Record<RatingKey, number>>>({});
  const [liked, setLiked] = useState("");
  const [disliked, setDisliked] = useState("");
  const [improvements, setImprovements] = useState("");
  const [internshipInterest, setInternshipInterest] = useState("");

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  /** Generates the certificate, then lands the student on the step matching the outcome. */
  const claimCertificate = useCallback(async () => {
    setStep("claiming");
    setError("");
    const response = await fetch("/api/certificate/claim", { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "We could not generate your certificate right now. Please try again in a moment.");
      setStep("feedback");
      return;
    }
    setCertificateNumber(payload.certificateNumber);
    setEmailSent(Boolean(payload.emailSent));
    setStep("complete");
  }, []);

  /** Decides where an authenticated student belongs: dashboard, certificate, feedback or name. */
  const routeAuthenticated = useCallback(
    async (data: MeResponse) => {
      setMe(data);
      if (data.certificate) {
        router.replace("/dashboard");
        return;
      }
      if (data.feedbackSubmitted) {
        await claimCertificate();
        return;
      }
      setStep("name");
    },
    [claimCertificate, router],
  );

  // Returning students never repeat the flow: an existing session is resolved on load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/me");
        if (!cancelled && response.ok) await routeAuthenticated((await response.json()) as MeResponse);
      } catch {
        // Not signed in; start at the email step.
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeAuthenticated]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function requestCode(address: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 429) {
        setError(payload.error || "We could not send the verification code. Please try again.");
        return false;
      }
      setCooldown(payload.cooldown || 60);
      setNotice(payload.message || "");
      return true;
    } catch {
      setError("Network error. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function startVerification(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setEmail(normalized);
    if (await requestCode(normalized)) {
      setOtp(emptyOtp());
      setStep("otp");
      window.setTimeout(() => otpRefs.current[0]?.focus(), 60);
    }
  }

  async function verifyCode(code: string) {
    setBusy(true);
    setError("");
    try {
      // Verified server-side so the session cookie arrives with this response; the browser
      // never has to win a race against its own cookie write.
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Distinct statuses get distinct messages: a wrong code, an ineligible address and a
        // misconfigured server are three different problems.
        setError(payload.error || "We could not verify that code. Please try again.");
        if (response.status === 401) {
          setOtp(emptyOtp());
          otpRefs.current[0]?.focus();
        }
        return;
      }
      if (payload.role === "admin") {
        router.replace("/admin");
        return;
      }
      await routeAuthenticated(payload.me as MeResponse);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function updateOtp(index: number, value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      const cleared = [...otp];
      cleared[index] = "";
      setOtp(cleared);
      return;
    }
    const next = [...otp];
    // A pasted code fills the remaining boxes in one go.
    digits.split("").forEach((digit, offset) => {
      if (index + offset < OTP_LENGTH) next[index + offset] = digit;
    });
    setOtp(next);
    otpRefs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
    // Submit automatically only for a pasted full code; typing ends with the Verify button,
    // so a single mistyped digit does not immediately wipe the whole entry.
    if (digits.length > 1 && next.every(Boolean)) void verifyCode(next.join(""));
  }

  function submitOtp(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !otp.every(Boolean)) return;
    void verifyCode(otp.join(""));
  }

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/student/name", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nameDraft }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "We could not save that name. Please try again.");
        return;
      }
      setMe(payload as MeResponse);
      setEditingName(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (RATING_QUESTIONS.some(([key]) => !ratings[key]) || !liked.trim() || !improvements.trim() || !internshipInterest) {
      setError("Please complete each required field before continuing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...ratings, liked: liked.trim(), disliked: disliked.trim(), improvements: improvements.trim(), internshipInterest }),
      });
      if (!response.ok) {
        const raw = await response.text();
        let payload: { error?: string; stage?: string; code?: string } = {};
        try {
          payload = JSON.parse(raw);
        } catch {
          // Not JSON - an unhandled server error rendered an HTML page.
        }
        // Surfaced in the console so a failure can be reported precisely rather than by guesswork.
        console.error("Feedback submission failed", { status: response.status, body: raw.slice(0, 500) });
        setError(
          payload.error
            ? `${payload.error}${payload.code ? ` (${payload.code})` : ""}`
            : `Unexpected response from the server (HTTP ${response.status}). Please try again.`,
        );
        return;
      }
      await claimCertificate();
    } catch {
      setError("Network error. Your feedback was not saved — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <main>
        <SiteHeader chip="CERTIFICATE CLAIM" />
        <section className="boot-screen">
          <Loader2 className="spin" size={30} />
          <p>Loading your certificate…</p>
        </section>
      </main>
    );
  }

  const firstName = me?.student.name.split(" ")[0] || "";

  return (
    <main>
      <SiteHeader chip="CERTIFICATE CLAIM">
        <div className="header-trust">
          <ShieldCheck size={17} /> SECURE STUDENT PORTAL
        </div>
      </SiteHeader>

      <section className="claim-shell">
        <div className="claim-intro">
          <div>
            <p className="eyebrow">
              <Sparkles size={15} /> {(me?.workshop.name || "DevOps & Docker Workshop").toUpperCase()}
            </p>
            <h1>
              Claim your <span className="marker">certificate.</span>
            </h1>
            <p className="lead">A quick, secure way to collect your workshop certificate and unlock your student benefits.</p>
          </div>
          <div className="event-badge">
            <Clock3 size={20} />
            <div>
              <b>2 minutes</b>
              <span>to complete</span>
            </div>
          </div>
        </div>

        <Stepper step={step} />

        {step === "email" && (
          <section className="claim-layout">
            <div className="form-card card-brut">
              <p className="section-kicker">STEP 01 / VERIFY YOUR EMAIL</p>
              <h2>Let&apos;s find your registration.</h2>
              <p>Enter the same address you used when registering for the workshop.</p>
              <form onSubmit={startVerification}>
                <label htmlFor="email">Email address</label>
                <div className="input-icon">
                  <Mail size={20} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                    disabled={busy}
                  />
                </div>
                {error && <p className="error-note">{error}</p>}
                <button className="tactile-btn primary" type="submit" disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="spin" size={18} /> Sending code…
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
              <p className="privacy-note">
                <ShieldCheck size={16} /> Only students registered for this workshop can claim a certificate.
              </p>
            </div>
            <CertificateTeaser />
          </section>
        )}

        {step === "otp" && (
          <section className="wizard-card card-brut">
            <button className="back-btn" type="button" onClick={() => setStep("email")} disabled={busy}>
              <ChevronLeft size={18} /> Change email
            </button>
            <p className="section-kicker">STEP 01 / VERIFY YOUR EMAIL</p>
            <h2>Check your inbox.</h2>
            <p>
              {notice || "If this email is registered for the workshop, a verification code is on its way."} We sent it to <strong>{email}</strong>.
            </p>
            <form onSubmit={submitOtp}>
              <div className="otp-row">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpRefs.current[index] = element;
                    }}
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={OTP_LENGTH}
                    value={digit}
                    disabled={busy}
                    onChange={(event) => updateOtp(index, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace" && !digit && index) otpRefs.current[index - 1]?.focus();
                    }}
                    aria-label={`Verification digit ${index + 1} of ${OTP_LENGTH}`}
                  />
                ))}
              </div>
              {error && <p className="error-note">{error}</p>}
              <button className="tactile-btn primary" type="submit" disabled={busy || !otp.every(Boolean)}>
                {busy ? (
                  <>
                    <Loader2 className="spin" size={18} /> Verifying…
                  </>
                ) : (
                  <>
                    Verify and continue <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
            <p className="form-hint">
              Enter the {OTP_LENGTH}-digit code. It is valid for a short time — check your spam folder if it does not arrive.
            </p>
            <button className="text-btn" type="button" disabled={cooldown > 0 || busy} onClick={() => void requestCode(email)}>
              {cooldown ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </section>
        )}

        {step === "name" && (
          <section className="wizard-card card-brut">
            <p className="section-kicker">STEP 02 / CONFIRM YOUR NAME</p>
            <h2>Almost there, {firstName}!</h2>
            <p>This is the name that will appear on your certificate. Please check the spelling carefully.</p>

            {editingName ? (
              <form onSubmit={saveName}>
                <label htmlFor="certificate-name">Name on certificate</label>
                <div className="input-icon">
                  <UserRound size={20} />
                  <input
                    id="certificate-name"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    maxLength={80}
                    autoFocus
                    disabled={busy}
                    aria-describedby="certificate-name-hint"
                  />
                </div>
                {error && <p className="error-note">{error}</p>}
                <p className="form-hint" id="certificate-name-hint">
                  Registered as <strong>{me?.student.registeredName}</strong>. Correct the spelling only — this appears on your
                  certificate and cannot be changed once it is issued.
                </p>
                <div className="button-row">
                  <button className="tactile-btn primary" type="submit" disabled={busy || !nameDraft.trim()}>
                    {busy ? (
                      <>
                        <Loader2 className="spin" size={18} /> Saving…
                      </>
                    ) : (
                      <>
                        Save name <Check size={18} />
                      </>
                    )}
                  </button>
                  <button
                    className="tactile-btn secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingName(false);
                      setNameDraft(me?.student.name || "");
                      setError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="name-panel">
                  <span>CERTIFICATE RECIPIENT</span>
                  <strong>{me?.student.name}</strong>
                </div>
                {me?.student.nameEdited && (
                  <p className="form-hint">
                    Corrected from the registered name <strong>{me.student.registeredName}</strong>.
                  </p>
                )}
                {error && <p className="error-note">{error}</p>}
                <div className="button-row">
                  <button className="tactile-btn primary" type="button" onClick={() => setStep("feedback")}>
                    Yes, continue <ArrowRight size={18} />
                  </button>
                  <button
                    className="tactile-btn secondary"
                    type="button"
                    onClick={() => {
                      setNameDraft(me?.student.name || "");
                      setEditingName(true);
                      setError("");
                    }}
                  >
                    <Pencil size={18} /> Change my name
                  </button>
                </div>
                <p className="form-hint">
                  Your name is taken from the workshop registration records. Fix the spelling here if it is wrong — it cannot be
                  changed after your certificate is issued.
                </p>
              </>
            )}
          </section>
        )}

        {step === "feedback" && (
          <section className="feedback-card card-brut">
            <p className="section-kicker">STEP 03 / WORKSHOP FEEDBACK</p>
            <h2>Tell us how it went.</h2>
            <p className="feedback-lead">Your feedback helps us make future DevTrackAcademy workshops even better. This takes about two minutes.</p>
            <form onSubmit={submitFeedback}>
              {RATING_QUESTIONS.map(([key, question], index) => (
                <fieldset key={key}>
                  <legend>
                    <span>0{index + 1}</span>
                    {question}
                  </legend>
                  <div className="rating-row">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={ratings[key] === value ? "selected" : ""}
                        onClick={() => setRatings({ ...ratings, [key]: value })}
                        aria-pressed={ratings[key] === value}
                        aria-label={`${value} out of 5`}
                      >
                        <Star size={18} fill={ratings[key] === value ? "currentColor" : "none"} />
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}

              <label>
                <span className="q-index">05</span> What did you like most about the workshop?
                <textarea maxLength={2000} value={liked} onChange={(event) => setLiked(event.target.value)} placeholder="The practical projects, the pace, the hands-on support…" />
              </label>
              <label>
                <span className="q-index">06</span> What did you dislike about the workshop? <em>(optional)</em>
                <textarea maxLength={2000} value={disliked} onChange={(event) => setDisliked(event.target.value)} placeholder="Anything that did not work for you." />
              </label>
              <label>
                <span className="q-index">07</span> What could we improve from our side?
                <textarea maxLength={2000} value={improvements} onChange={(event) => setImprovements(event.target.value)} placeholder="Your ideas help us make the next workshop stronger." />
              </label>

              <fieldset>
                <legend>
                  <span>08</span>Would you be interested in an internship opportunity from DevTrackAcademy?
                </legend>
                <div className="choice-row">
                  {["Yes", "Maybe", "No"].map((option) => (
                    <button key={option} type="button" className={internshipInterest === option ? "selected" : ""} onClick={() => setInternshipInterest(option)} aria-pressed={internshipInterest === option}>
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>

              {error && <p className="error-note">{error}</p>}
              <button className="tactile-btn primary" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="spin" size={18} /> Submitting feedback…
                  </>
                ) : (
                  <>
                    Submit feedback &amp; prepare certificate <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </section>
        )}

        {step === "claiming" && (
          <section className="complete-card card-brut">
            <div className="success-mark">
              <Loader2 className="spin" size={40} />
            </div>
            <p className="section-kicker">FEEDBACK SUBMITTED ✓</p>
            <h2>Preparing your certificate…</h2>
            <p>We are generating your PDF and emailing a copy. This takes a few seconds — please keep this page open.</p>
          </section>
        )}

        {step === "complete" && (
          <section className="complete-card card-brut">
            <div className="success-mark">
              <Check size={46} />
            </div>
            <p className="section-kicker">CERTIFICATE READY</p>
            <h2>That&apos;s a wrap! 🎉</h2>
            <p>
              Your certificate has been issued and your student benefits are unlocked.
              {emailSent ? " A copy is on its way to your inbox." : ""}
            </p>
            {!emailSent && (
              <p className="notice warn">We could not send the certificate email, but your certificate is ready to download from your dashboard.</p>
            )}
            <a className="tactile-btn primary" href="/dashboard">
              Open my dashboard <ArrowRight size={18} />
            </a>
            {certificateNumber && (
              <p className="form-hint">
                Certificate ID: <strong>{certificateNumber}</strong>
              </p>
            )}
          </section>
        )}
      </section>

      <PartnerStrip />
    </main>
  );
}

function CertificateTeaser() {
  return (
    <aside className="certificate-teaser">
      <div className="certificate-sheet">
        <div className="cert-top">
          <span>DEVTRACKACADEMY</span>
          <Image src={logo} alt="" />
        </div>
        <p>CERTIFICATE OF COMPLETION</p>
        <small>This is proudly presented to</small>
        <strong>YOUR NAME</strong>
        <small>for successfully completing</small>
        <b>DevOps &amp; Docker Workshop</b>
        <div className="cert-bottom">
          <span>VERIFIED CREDENTIAL</span>
          <span>DEVTRACKACADEMY</span>
        </div>
      </div>
      <div className="teaser-note">
        <Check size={18} /> Secure, verifiable &amp; yours forever
      </div>
    </aside>
  );
}
