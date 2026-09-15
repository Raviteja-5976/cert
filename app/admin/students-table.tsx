"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Mail, Minus, Search, X } from "lucide-react";

export type AdminRow = {
  id: string;
  name: string;
  registeredName: string;
  email: string;
  workshop: string;
  feedback: boolean;
  certificateNumber: string | null;
  emailSent: boolean;
  claimedAt: string | null;
};

type Filter = "all" | "claimed" | "pending" | "failed";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "claimed", label: "Claimed" },
  { key: "pending", label: "Not claimed" },
  { key: "failed", label: "Email failed" },
];

/** Admin views show a shortened address: enough to identify a student, not a scrapeable list. */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${local.length > 2 ? "…" : ""}@${domain}`;
}

export function StudentsTable({ rows }: { rows: AdminRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, "sent" | "failed">>({});

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "claimed" && !row.certificateNumber) return false;
      if (filter === "pending" && row.certificateNumber) return false;
      if (filter === "failed" && (!row.certificateNumber || row.emailSent)) return false;
      if (!needle) return true;
      return row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle) || (row.certificateNumber || "").toLowerCase().includes(needle);
    });
  }, [rows, query, filter]);

  async function resend(certificateNumber: string) {
    setPending(certificateNumber);
    try {
      const response = await fetch("/api/admin/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ certificateNumber }),
      });
      const payload = await response.json().catch(() => ({}));
      setResults((current) => ({ ...current, [certificateNumber]: response.ok && payload.emailSent ? "sent" : "failed" }));
    } catch {
      setResults((current) => ({ ...current, [certificateNumber]: "failed" }));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="table-card card-brut">
      <div className="table-head">
        <div>
          <p className="section-kicker">STUDENT ROSTER</p>
          <h2>Claim status</h2>
        </div>
        <div className="table-controls">
          <div className="table-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or ID" aria-label="Search students" />
          </div>
          <div className="filter-row">
            {FILTERS.map(({ key, label }) => (
              <button key={key} type="button" className={filter === key ? "selected" : ""} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Email</th>
              <th>Workshop</th>
              <th>Feedback</th>
              <th>Certificate</th>
              <th>Email</th>
              <th>Claimed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const result = row.certificateNumber ? results[row.certificateNumber] : undefined;
              return (
                <tr key={row.id}>
                  <td>
                    <b>{row.name}</b>
                    {row.name !== row.registeredName && <small className="renamed">was: {row.registeredName}</small>}
                  </td>
                  <td className="mono">{maskEmail(row.email)}</td>
                  <td>{row.workshop}</td>
                  <td>{row.feedback ? <Check size={16} className="ok" /> : <Minus size={16} className="idle" />}</td>
                  <td className="mono">{row.certificateNumber || <Minus size={16} className="idle" />}</td>
                  <td>
                    {!row.certificateNumber ? <Minus size={16} className="idle" /> : row.emailSent || result === "sent" ? <Check size={16} className="ok" /> : <X size={16} className="bad" />}
                  </td>
                  <td className="mono">{row.claimedAt ? new Date(row.claimedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</td>
                  <td>
                    {row.certificateNumber ? (
                      <button className="row-action" type="button" onClick={() => resend(row.certificateNumber as string)} disabled={pending === row.certificateNumber}>
                        {pending === row.certificateNumber ? <Loader2 className="spin" size={14} /> : <Mail size={14} />}
                        {result === "sent" ? "Sent" : result === "failed" ? "Retry" : "Resend"}
                      </button>
                    ) : (
                      <span className="idle-text">Not claimed</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No students match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="table-foot">
        Showing {visible.length} of {rows.length} students.
      </p>
    </section>
  );
}
