/**
 * Imports the workshop roster into Supabase.
 *
 *   node scripts/import-students.mjs "Certficates list CODEX.csv" devops-docker-2026
 *
 * Expects NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Re-running is safe: rows are upserted on (email, workshop_id).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

async function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = await readFile(path.join(process.cwd(), file), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
      }
    } catch {
      // File is optional.
    }
  }
}

/** Minimal RFC 4180 parser: handles quoted fields and embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((entry) => entry.some((value) => value.trim()));
}

const [, , csvArg, slugArg] = process.argv;
const csvFile = csvArg || "Certficates list CODEX.csv";
const slug = slugArg || "devops-docker-2026";

await loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const { data: workshop, error: workshopError } = await db.from("workshops").select("id,name").eq("slug", slug).maybeSingle();
if (workshopError || !workshop) {
  console.error(`Workshop "${slug}" not found. Apply supabase/schema.sql first.`);
  process.exit(1);
}

const rows = parseCsv(await readFile(path.join(process.cwd(), csvFile), "utf8"));
const header = rows[0].map((value) => value.trim().toLowerCase());
const column = (...names) => {
  const index = header.findIndex((value) => names.includes(value));
  return index === -1 ? null : index;
};
const columns = {
  name: column("name", "student name", "full name"),
  email: column("email address", "email", "e-mail"),
  roll: column("roll no", "roll no.", "roll number"),
  branch: column("branch", "department"),
  campus: column("campus", "college", "institution"),
};
if (columns.name === null || columns.email === null) {
  console.error(`CSV must contain name and email columns. Found: ${header.join(", ")}`);
  process.exit(1);
}

const seen = new Set();
const students = [];
const skipped = [];
for (const row of rows.slice(1)) {
  const email = (row[columns.email] || "").trim().toLowerCase();
  const name = (row[columns.name] || "").trim().replace(/\s+/g, " ");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) { skipped.push(row.join(",")); continue; }
  if (seen.has(email)) { skipped.push(`${email} (duplicate)`); continue; }
  seen.add(email);
  students.push({
    email,
    name,
    roll_no: columns.roll === null ? null : (row[columns.roll] || "").trim() || null,
    branch: columns.branch === null ? null : (row[columns.branch] || "").trim() || null,
    campus: columns.campus === null ? null : (row[columns.campus] || "").trim() || null,
    workshop_id: workshop.id,
    eligible: true,
  });
}

for (let i = 0; i < students.length; i += 100) {
  const batch = students.slice(i, i + 100);
  const { error } = await db.from("students").upsert(batch, { onConflict: "email,workshop_id" });
  if (error) { console.error("Import failed:", error.message); process.exit(1); }
  console.log(`Imported ${Math.min(i + batch.length, students.length)} / ${students.length}`);
}

console.log(`\nDone. ${students.length} students are eligible for "${workshop.name}".`);
if (skipped.length) console.log(`Skipped ${skipped.length} row(s):\n  ${skipped.join("\n  ")}`);
