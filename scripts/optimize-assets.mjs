/**
 * One-off: downscales brand/partner artwork into compact PNGs for PDF embedding.
 * The generated files live in assets/pdf and are committed; this never runs at request time.
 *   node scripts/optimize-assets.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.join(process.cwd(), "assets");
const out = path.join(root, "pdf");

const targets = [
  { file: "DevTrackAcademy-logo.png", width: 260 },
  { file: "gni-logo.png", width: 420 },
  { file: "ieee-cs.png", width: 380 },
  { file: "silver-jublee.png", width: 360 },
  { file: "80aniversary.png", width: 260 },
];

await mkdir(out, { recursive: true });
for (const { file, width } of targets) {
  const buffer = await sharp(path.join(root, file))
    .resize({ width, withoutEnlargement: true })
    .flatten({ background: "#FFFDF7" })
    .png({ compressionLevel: 9, palette: true, quality: 88 })
    .toBuffer();
  await sharp(buffer).toFile(path.join(out, file));
  console.log(`${file} -> ${(buffer.length / 1024).toFixed(1)} KB`);
}
