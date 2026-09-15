import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "../../../lib/supabase/admin";
import { certificateArtwork } from "../../../lib/assets";
import { renderCertificate, CERTIFICATE_BUCKET } from "../../../lib/certificate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY production diagnostic. Delete once the claim failure is understood.
 * Returns 404 unless DIAG_TOKEN is set in the environment and matches ?token=.
 */
async function probe<T>(fn: () => Promise<T>) {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

async function listDir(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
}

export async function GET(request: Request) {
  const token = process.env.DIAG_TOKEN;
  const supplied = new URL(request.url).searchParams.get("token");
  if (!token || supplied !== token) return new NextResponse("Not found", { status: 404 });

  const cwd = process.cwd();
  const assetsDir = path.join(cwd, "assets");

  const filesystem = {
    cwd,
    nodeVersion: process.version,
    cwdEntries: await probe(() => listDir(cwd)),
    assetsDir: await probe(() => listDir(assetsDir)),
    fontsDir: await probe(() => listDir(path.join(assetsDir, "fonts"))),
    pdfDir: await probe(() => listDir(path.join(assetsDir, "pdf"))),
    fontSize: await probe(async () => (await stat(path.join(assetsDir, "fonts", "Inter-Regular.ttf"))).size),
    // Where else the bundle might have put the traced assets, if not beside cwd.
    candidateRoots: await Promise.all(
      [cwd, path.join(cwd, ".next", "standalone"), "/var/task", "/var/task/.next/standalone", process.env.LAMBDA_TASK_ROOT || ""]
        .filter(Boolean)
        .map(async (root) => ({ root, fonts: await probe(() => listDir(path.join(root, "assets", "fonts"))) })),
    ),
  };

  const artwork = await probe(async () => {
    const art = await certificateArtwork();
    return { logo: art.logo.length, gni: art.gni.length, ieee: art.ieee.length, jubilee: art.jubilee.length, anniversary: art.anniversary.length, signature: art.signature?.length ?? null };
  });

  const render = await probe(async () => {
    const started = Date.now();
    const buffer = await renderCertificate({
      name: "Diagnostic Probe",
      certificateNumber: "DIAG-000000",
      workshopName: "Diagnostic Workshop",
      workshopDate: "2026-01-01",
    });
    return { bytes: buffer.length, ms: Date.now() - started };
  });

  const db = supabaseAdmin();

  const workshops = await probe(async () => {
    const { data, error } = await db.from("workshops").select("id,slug,certificate_prefix,certificate_seq");
    if (error) throw new Error(error.message);
    return data;
  });

  const claims = await probe(async () => {
    const { count, error } = await db.from("certificate_claims").select("*", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return count;
  });

  const bucket = await probe(async () => {
    const { data, error } = await db.storage.from(CERTIFICATE_BUCKET).list("", { limit: 1 });
    if (error) throw new Error(error.message);
    return { reachable: true, sample: data?.length ?? 0 };
  });

  const upload = await probe(async () => {
    const probePath = `_diag/${Date.now()}.txt`;
    const { error } = await db.storage.from(CERTIFICATE_BUCKET).upload(probePath, Buffer.from("diag"), { contentType: "text/plain", upsert: true });
    if (error) throw new Error(error.message);
    await db.storage.from(CERTIFICATE_BUCKET).remove([probePath]);
    return { wrote: probePath };
  });

  return NextResponse.json({ filesystem, artwork, render, workshops, claims, bucket, upload }, { status: 200 });
}
