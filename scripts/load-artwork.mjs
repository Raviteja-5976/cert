import { readFile } from "node:fs/promises";
import path from "node:path";

export async function certificateArtwork() {
  const read = (file) => readFile(path.join(process.cwd(), "assets", "pdf", file));
  const [logo, gni, ieee, jubilee, anniversary] = await Promise.all([
    read("DevTrackAcademy-logo.png"),
    read("gni-logo.png"),
    read("ieee-cs.png"),
    read("silver-jublee.png"),
    read("80aniversary.png"),
  ]);
  return { logo, gni, ieee, jubilee, anniversary };
}
