"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Search, Star } from "lucide-react";
import { maskEmail } from "./students-table";

export type FeedbackEntry = {
  id: string;
  name: string;
  email: string;
  workshop: string;
  workshopRating: number;
  understandingRating: number;
  implementationRating: number;
  resourcePersonRating: number;
  liked: string;
  disliked: string | null;
  improvements: string;
  internshipInterest: string;
  createdAt: string;
};

type Sort = "recent" | "highest" | "lowest";

const RATINGS: Array<{ key: keyof FeedbackEntry; label: string }> = [
  { key: "workshopRating", label: "Workshop overall" },
  { key: "understandingRating", label: "Concept understanding" },
  { key: "implementationRating", label: "Implementation confidence" },
  { key: "resourcePersonRating", label: "Resource person" },
];

const ANSWERS: Array<{ key: keyof FeedbackEntry; index: string; question: string }> = [
  { key: "liked", index: "05", question: "What did you like most about the workshop?" },
  { key: "disliked", index: "06", question: "What did you dislike about the workshop?" },
  { key: "improvements", index: "07", question: "What could we improve from our side?" },
];

const INTEREST_FILTERS = ["All", "Yes", "Maybe", "No"];

const SORTS: Array<{ key: Sort; label: string }> = [
  { key: "recent", label: "Newest" },
  { key: "highest", label: "Highest rated" },
  { key: "lowest", label: "Lowest rated" },
];

/** Mean of the four scores; used for sorting and for the per-response headline number. */
function averageOf(entry: FeedbackEntry) {
  return (entry.workshopRating + entry.understandingRating + entry.implementationRating + entry.resourcePersonRating) / 4;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="score-stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star key={step} size={13} strokeWidth={3} className={step <= value ? "on" : "off"} />
      ))}
    </span>
  );
}

export function FeedbackList({ entries }: { entries: FeedbackEntry[] }) {
  const [query, setQuery] = useState("");
  const [interest, setInterest] = useState("All");
  const [sort, setSort] = useState<Sort>("recent");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = entries.filter((entry) => {
      if (interest !== "All" && entry.internshipInterest !== interest) return false;
      if (!needle) return true;
      // Search covers the written answers too, so a phrase from a response finds its author.
      return [entry.name, entry.email, entry.liked, entry.disliked || "", entry.improvements].some((text) => text.toLowerCase().includes(needle));
    });
    const sorted = [...matched];
    if (sort === "recent") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "highest") sorted.sort((a, b) => averageOf(b) - averageOf(a));
    if (sort === "lowest") sorted.sort((a, b) => averageOf(a) - averageOf(b));
    return sorted;
  }, [entries, query, interest, sort]);

  return (
    <section className="table-card card-brut">
      <div className="table-head">
        <div>
          <p className="section-kicker">FEEDBACK RESPONSES</p>
          <h2>Every answer</h2>
        </div>
        <div className="table-controls">
          <div className="table-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or answer text" aria-label="Search feedback" />
          </div>
          <div className="filter-row">
            {INTEREST_FILTERS.map((option) => (
              <button key={option} type="button" className={interest === option ? "selected" : ""} onClick={() => setInterest(option)}>
                {option === "All" ? "All" : `Internship: ${option}`}
              </button>
            ))}
          </div>
          <div className="filter-row">
            {SORTS.map(({ key, label }) => (
              <button key={key} type="button" className={sort === key ? "selected" : ""} onClick={() => setSort(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="feedback-entries">
        {visible.map((entry) => (
          <article className="feedback-entry" key={entry.id}>
            <header>
              <div>
                <b>{entry.name}</b>
                <span className="mono">{maskEmail(entry.email)}</span>
              </div>
              <div className="entry-meta">
                <span className={`interest-badge ${entry.internshipInterest.toLowerCase()}`}>INTERNSHIP: {entry.internshipInterest.toUpperCase()}</span>
                <span className="mono">
                  {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · avg {averageOf(entry).toFixed(1)}/5
                </span>
              </div>
            </header>

            <div className="score-grid">
              {RATINGS.map(({ key, label }) => (
                <div className="score-cell" key={key}>
                  <span>{label}</span>
                  <div>
                    <Stars value={entry[key] as number} />
                    <b>{entry[key] as number}/5</b>
                  </div>
                </div>
              ))}
            </div>

            <div className="answer-list">
              {ANSWERS.map(({ key, index, question }) => {
                const answer = (entry[key] as string | null)?.trim();
                return (
                  <div className="answer" key={key}>
                    <p className="section-kicker">
                      {index} · {question}
                    </p>
                    <p className={answer ? "" : "no-answer"}>{answer || "No answer given."}</p>
                  </div>
                );
              })}
            </div>

            <p className="entry-foot mono">{entry.workshop}</p>
          </article>
        ))}
        {visible.length === 0 && (
          <p className="empty-feedback">
            <MessageSquare size={18} /> No feedback matches this view.
          </p>
        )}
      </div>

      <p className="table-foot">
        Showing {visible.length} of {entries.length} responses.
      </p>
    </section>
  );
}
