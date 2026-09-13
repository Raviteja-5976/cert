import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, Buffer>();

/** Reads a bundled asset once per process. Server-only. */
export async function assetBuffer(relativePath: string) {
  const cached = cache.get(relativePath);
  if (cached) return cached;
  const buffer = await readFile(path.join(process.cwd(), "assets", relativePath));
  cache.set(relativePath, buffer);
  return buffer;
}

export function assetPath(relativePath: string) {
  return path.join(process.cwd(), "assets", relativePath);
}

export type CertificateArtwork = {
  logo: Buffer;
  gni: Buffer;
  ieee: Buffer;
  jubilee: Buffer;
  anniversary: Buffer;
  /** Optional scanned signature; falls back to the script-font name when absent. */
  signature: Buffer | null;
};

/** Returns null instead of throwing when the asset has not been supplied. */
async function optionalAsset(relativePath: string) {
  try {
    return await assetBuffer(relativePath);
  } catch {
    return null;
  }
}

export async function certificateArtwork(): Promise<CertificateArtwork> {
  const [logo, gni, ieee, jubilee, anniversary, signature] = await Promise.all([
    assetBuffer("pdf/DevTrackAcademy-logo.png"),
    assetBuffer("pdf/gni-logo.png"),
    assetBuffer("pdf/ieee-cs.png"),
    assetBuffer("pdf/silver-jublee.png"),
    assetBuffer("pdf/80aniversary.png"),
    optionalAsset("pdf/signature.png"),
  ]);
  return { logo, gni, ieee, jubilee, anniversary, signature };
}
