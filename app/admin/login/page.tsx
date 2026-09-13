"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, ChevronLeft, Loader2, Lock, Mail } from "lucide-react";
import { SiteHeader } from "../../components/site-chrome";
import { OTP_LENGTH } from "../../../lib/config";

/** Admin sign-in uses the same Supabase email OTP; access is gated by ADMIN_EMAILS / user_roles. */
export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const codeRef = useRef<HTMLInputElement | null>(null);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok && response.status !== 429) {
        setError("We could not send the verification code.");
        return;
      }
      setSent(true);
      window.setTimeout(() => codeRef.current?.focus(), 60);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "We could not verify that code.");
        return;
      }
      if (payload.role !== "admin") {
        setError("This account does not have admin access.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <SiteHeader chip="ADMIN CONSOLE" />
      <section className="claim-shell">
        <div className="wizard-card card-brut">
          <p className="section-kicker">RESTRICTED AREA</p>
          <h2>
            <Lock size={26} /> Admin sign in
          </h2>
          <p>Verification codes are only issued to allowlisted DevTrackAcademy administrators.</p>

          {!sent ? (
            <form onSubmit={requestCode}>
              <label htmlFor="admin-email">Admin email</label>
              <div className="input-icon">
                <Mail size={20} />
                <input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@devtrackacademy.com" autoComplete="email" required disabled={busy} />
              </div>
              {error && <p className="error-note">{error}</p>}
              <button className="tactile-btn primary" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="spin" size={18} /> Sending code…
                  </>
                ) : (
                  <>
                    Send verification code <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={verify}>
              <label htmlFor="admin-code">Verification code</label>
              <div className="input-icon">
                <Lock size={20} />
                <input id="admin-code" ref={codeRef} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder={"0".repeat(OTP_LENGTH)} maxLength={OTP_LENGTH} required disabled={busy} />
              </div>
              {error && <p className="error-note">{error}</p>}
              <button className="tactile-btn primary" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="spin" size={18} /> Verifying…
                  </>
                ) : (
                  <>
                    Enter console <ArrowRight size={18} />
                  </>
                )}
              </button>
              <button className="text-btn" type="button" onClick={() => setSent(false)}>
                <ChevronLeft size={14} /> Use a different email
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
