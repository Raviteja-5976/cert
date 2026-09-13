import { supabaseAdmin } from "./supabase/admin";
import { supabaseServer } from "./supabase/server";
import type { Student, Workshop } from "./types";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
}

/** The authenticated user from the Supabase session cookie, validated against the auth server. */
export async function sessionUser() {
  const client = await supabaseServer();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: normalizeEmail(data.user.email) };
}

export async function sessionEmail() {
  return (await sessionUser())?.email ?? null;
}

export type StudentContext = { student: Student; workshop: Workshop };

/**
 * Resolves the student record purely from the authenticated session. The client never
 * supplies its own identity — every privileged read starts here.
 */
export async function currentStudent(): Promise<StudentContext | null> {
  const email = await sessionEmail();
  if (!email) return null;
  const db = supabaseAdmin();
  const { data } = await db
    .from("students")
    .select("id,email,name,certificate_name,workshop_id,workshops(*)")
    .eq("email", email)
    .eq("eligible", true)
    .maybeSingle();
  if (!data?.workshops) return null;
  const workshop = data.workshops as unknown as Workshop;
  const certificateName = (data.certificate_name as string | null)?.trim() || null;
  return {
    student: {
      id: data.id,
      email: data.email,
      // The correction wins wherever the name is printed; the roster value stays intact.
      name: certificateName || data.name,
      registeredName: data.name,
      nameEdited: Boolean(certificateName),
      workshop_id: data.workshop_id,
    },
    workshop: { ...workshop, resources: Array.isArray(workshop.resources) ? workshop.resources : [] },
  };
}

/** Admin access requires an allowlisted email or an `admin` row in user_roles. */
export async function isAdmin() {
  const user = await sessionUser();
  if (!user) return false;
  if (adminEmails().includes(user.email)) return true;
  const db = supabaseAdmin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  return data?.role === "admin";
}
