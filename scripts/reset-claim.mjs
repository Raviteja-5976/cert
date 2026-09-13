/**
 * Clears one student's test data so the claim flow can be walked again from the start.
 *
 *   node scripts/reset-claim.mjs you@example.com            # feedback + claim + stored PDF
 *   node scripts/reset-claim.mjs you@example.com --keep-feedback
 *   node scripts/reset-claim.mjs you@example.com --reset-sequence
 *
 * Certificate issuance is idempotent, so an existing claim is returned as-is; this is the only
 * way to regenerate a certificate after changing the template. Intended for pre-launch testing
 * only — it permanently deletes the stored PDF.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env"]) {
  try {
    const raw = await readFile(path.join(process.cwd(), file), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    // Optional file.
  }
}

const email = (process.argv[2] || "").trim().toLowerCase();
const keepFeedback = process.argv.includes("--keep-feedback");
const resetSequence = process.argv.includes("--reset-sequence");
if (!email) {
  console.error("Usage: node scripts/reset-claim.mjs <email> [--keep-feedback] [--reset-sequence]");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: student } = await db.from("students").select("id,name,workshop_id").eq("email", email).maybeSingle();
if (!student) {
  console.error(`No student found for ${email}`);
  process.exit(1);
}
console.log(`Resetting ${student.name} <${email}>`);

const { data: claims } = await db.from("certificate_claims").select("certificate_number,certificate_path").eq("student_id", student.id);
for (const claim of claims || []) {
  const { error } = await db.storage.from("certificates").remove([claim.certificate_path]);
  console.log(`  storage  ${claim.certificate_path} ${error ? `-> ${error.message}` : "removed"}`);
}
const { error: claimError } = await db.from("certificate_claims").delete().eq("student_id", student.id);
console.log(`  claims   ${claimError ? claimError.message : `${claims?.length ?? 0} removed`}`);

if (keepFeedback) {
  console.log("  feedback kept (--keep-feedback)");
} else {
  const { error } = await db.from("feedback").delete().eq("student_id", student.id);
  console.log(`  feedback ${error ? error.message : "removed"}`);
}

if (resetSequence) {
  const { count } = await db.from("certificate_claims").select("*", { count: "exact", head: true }).eq("workshop_id", student.workshop_id);
  if (count === 0) {
    const { error } = await db.from("workshops").update({ certificate_seq: 0 }).eq("id", student.workshop_id);
    console.log(`  sequence ${error ? error.message : "reset to 0"}`);
  } else {
    console.log(`  sequence NOT reset - ${count} other claim(s) still exist for this workshop`);
  }
}

console.log("Done. Sign in again at /certificate to walk the flow.");
