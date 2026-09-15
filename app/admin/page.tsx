import { redirect } from "next/navigation";
import { BarChart3, Check, Clock3, Mail, MailX, ShieldCheck, Users } from "lucide-react";
import { SiteHeader } from "../components/site-chrome";
import { isAdmin } from "../../lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "../../lib/supabase/admin";
import { StudentsTable, type AdminRow } from "./students-table";
import { FeedbackList, type FeedbackEntry } from "./feedback-list";

export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: string;
  student_id: string;
  workshop_rating: number;
  understanding_rating: number;
  implementation_rating: number;
  resource_person_rating: number;
  liked: string;
  disliked: string | null;
  improvements: string;
  internship_interest: string;
  created_at: string;
};

type RatingField = "workshop_rating" | "understanding_rating" | "implementation_rating" | "resource_person_rating";

type StudentRow = { id: string; name: string; certificate_name: string | null; email: string; workshops: { name: string } | null };

export default async function AdminPage() {
  if (!isSupabaseConfigured()) redirect("/certificate");
  if (!(await isAdmin())) redirect("/admin/login");

  const db = supabaseAdmin();
  const [{ data: students }, { data: feedback }, { data: claims }] = await Promise.all([
    db.from("students").select("id,name,certificate_name,email,workshops(name)").eq("eligible", true).order("name"),
    db
      .from("feedback")
      .select("id,student_id,workshop_rating,understanding_rating,implementation_rating,resource_person_rating,liked,disliked,improvements,internship_interest,created_at")
      .order("created_at", { ascending: false }),
    db.from("certificate_claims").select("student_id,certificate_number,email_sent,claimed_at"),
  ]);

  const feedbackRows = (feedback || []) as FeedbackRow[];
  const feedbackByStudent = new Set(feedbackRows.map((row) => row.student_id));
  // The roster is already fetched for the table below; reuse it so the responses can name
  // their author without a second join.
  const studentById = new Map(((students || []) as unknown as StudentRow[]).map((row) => [row.id, row]));
  const claimByStudent = new Map((claims || []).map((row) => [row.student_id, row]));

  const rows: AdminRow[] = (students || []).map((student) => {
    const claim = claimByStudent.get(student.id);
    const workshop = student.workshops as unknown as { name: string } | null;
    return {
      id: student.id,
      name: (student.certificate_name as string | null)?.trim() || student.name,
      registeredName: student.name,
      email: student.email,
      workshop: workshop?.name || "—",
      feedback: feedbackByStudent.has(student.id),
      certificateNumber: claim?.certificate_number ?? null,
      emailSent: Boolean(claim?.email_sent),
      claimedAt: claim?.claimed_at ?? null,
    };
  });

  // A response whose student row is missing (deleted or no longer eligible) still counts in the
  // analytics above, but has no name to show, so it is left out of the list.
  const entries: FeedbackEntry[] = feedbackRows.flatMap((row) => {
    const student = studentById.get(row.student_id);
    if (!student) return [];
    return [
      {
        id: row.id,
        name: student.certificate_name?.trim() || student.name,
        email: student.email,
        workshop: student.workshops?.name || "—",
        workshopRating: row.workshop_rating,
        understandingRating: row.understanding_rating,
        implementationRating: row.implementation_rating,
        resourcePersonRating: row.resource_person_rating,
        liked: row.liked,
        disliked: row.disliked,
        improvements: row.improvements,
        internshipInterest: row.internship_interest,
        createdAt: row.created_at,
      },
    ];
  });

  const total = rows.length;
  const claimed = rows.filter((row) => row.certificateNumber).length;
  const emailsSent = rows.filter((row) => row.certificateNumber && row.emailSent).length;
  const emailFailed = claimed - emailsSent;

  const average = (field: RatingField) =>
    feedbackRows.length ? (feedbackRows.reduce((sum, row) => sum + row[field], 0) / feedbackRows.length).toFixed(1) : "—";
  const interest = (value: string) => feedbackRows.filter((row) => row.internship_interest === value).length;
  const distribution = (field: RatingField) =>
    [5, 4, 3, 2, 1].map((score) => ({ score, count: feedbackRows.filter((row) => row[field] === score).length }));

  const stats = [
    { label: "Total students", value: total, icon: Users, color: "sky" },
    { label: "Certificates claimed", value: claimed, icon: Check, color: "mint" },
    { label: "Not yet claimed", value: total - claimed, icon: Clock3, color: "yellow" },
    { label: "Feedback submitted", value: feedbackRows.length, icon: BarChart3, color: "sky" },
    { label: "Emails sent", value: emailsSent, icon: Mail, color: "mint" },
    { label: "Emails failed", value: emailFailed, icon: MailX, color: emailFailed ? "orange" : "yellow" },
  ];

  const ratingBars = distribution("workshop_rating");
  const peak = Math.max(1, ...ratingBars.map((bar) => bar.count));

  return (
    <main>
      <SiteHeader chip="ADMIN CONSOLE">
        <span className="header-trust">
          <ShieldCheck size={17} /> AUTHORIZED ACCESS
        </span>
      </SiteHeader>

      <section className="admin-shell">
        <p className="eyebrow">
          <ShieldCheck size={15} /> CERTIFICATE OPERATIONS
        </p>
        <h1>
          Claim <span className="marker">dashboard.</span>
        </h1>
        <p className="lead">A compact operational view of student certificate claims and workshop feedback.</p>

        <div className="admin-stats">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <article key={label} className={`admin-stat ${color} card-brut`}>
              <Icon size={22} />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        <div className="admin-grid">
          <section className="analytics-card card-brut">
            <p className="section-kicker">FEEDBACK ANALYTICS</p>
            <h2>Workshop sentiment</h2>
            <div className="rating-summary">
              <Rating label="Workshop rating" value={average("workshop_rating")} />
              <Rating label="Concept understanding" value={average("understanding_rating")} />
              <Rating label="Implementation confidence" value={average("implementation_rating")} />
              <Rating label="Resource person" value={average("resource_person_rating")} />
            </div>
            <div className="rating-bars">
              <p className="section-kicker">OVERALL RATING SPREAD</p>
              {ratingBars.map(({ score, count }) => (
                <div className="rating-bar" key={score}>
                  <span>{score} ★</span>
                  <div>
                    <i style={{ width: `${(count / peak) * 100}%` }} />
                  </div>
                  <b>{count}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="analytics-card card-brut">
            <p className="section-kicker">INTERNSHIP INTEREST</p>
            <h2>Opportunity pipeline</h2>
            <div className="interest-list">
              <Interest label="Yes" value={interest("Yes")} total={feedbackRows.length} color="mint" />
              <Interest label="Maybe" value={interest("Maybe")} total={feedbackRows.length} color="yellow" />
              <Interest label="No" value={interest("No")} total={feedbackRows.length} color="coral" />
            </div>
            <div className="admin-note card-brut">
              <Mail size={22} />
              <div>
                <h2>Email recovery</h2>
                <p>Certificates are issued independently of delivery. A student with a failed email can still download their PDF; use the roster below to retry delivery.</p>
              </div>
            </div>
          </section>
        </div>

        <StudentsTable rows={rows} />

        <FeedbackList entries={entries} />
      </section>
    </main>
  );
}

function Rating({ label, value }: { label: string; value: string }) {
  return (
    <div className="rating-summary-row">
      <span>{label}</span>
      <b>
        {value}
        <small> / 5</small>
      </b>
    </div>
  );
}

function Interest({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div className="interest-row">
      <span>{label}</span>
      <div>
        <i className={color} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
      </div>
      <b>{value}</b>
    </div>
  );
}
