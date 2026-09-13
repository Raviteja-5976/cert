/**
 * Renders a sample certificate for visual review.
 *   node scripts/preview-certificate.mjs [output-dir]
 * Writes sample-certificate.pdf (and a .png preview when pdf-to-img is installed).
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const outDir = process.argv[2] || path.join(process.cwd(), "preview");
const sampleName = process.argv[3] || "Ravi Teja Karnati";
await mkdir(outDir, { recursive: true });

// Bundle inside the project so external packages still resolve from node_modules.
const bundle = path.join(process.cwd(), "node_modules", ".cache", "certificate-bundle.mjs");
await mkdir(path.dirname(bundle), { recursive: true });
await build({
  entryPoints: [path.join(process.cwd(), "lib/certificate-pdf.tsx")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  external: ["@react-pdf/renderer", "react"],
  jsx: "automatic",
  logLevel: "error",
});

const { CertificatePdf } = await import(pathToFileURL(bundle).href);
const { pdf } = await import("@react-pdf/renderer");
const { certificateArtwork } = await import("./load-artwork.mjs");

const certificateNumber = "DTA-2026-DVOPS-000127";
const stream = await pdf(
  CertificatePdf({
    name: sampleName,
    certificateNumber,
    workshopName: "DevOps & Docker Workshop",
    workshopDate: "2026-09-11",
    workshopEndDate: process.argv[4] ?? "2026-09-12",
    issueDate: null,
    eventName: "Codex'26",
    courseName: "DevOps & Docker",
    formatLabel: "Live Hands-on Workshop",
    projectsCompleted: 3,
    artwork: await certificateArtwork(),
  }),
).toBuffer();

const chunks = [];
for await (const chunk of stream) chunks.push(Buffer.from(chunk));
const pdfBuffer = Buffer.concat(chunks);
const pdfPath = path.join(outDir, "sample-certificate.pdf");
await writeFile(pdfPath, pdfBuffer);
console.log(`PDF  ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

try {
  const { pdf: toImages } = await import("pdf-to-img");
  const document = await toImages(pdfPath, { scale: 2 });
  let index = 0;
  for await (const page of document) {
    const pngPath = path.join(outDir, `sample-certificate-${++index}.png`);
    await writeFile(pngPath, page);
    console.log(`PNG  ${pngPath}`);
  }
} catch (error) {
  console.log(`PNG preview skipped: ${error.message}`);
}

await rm(bundle, { force: true });
