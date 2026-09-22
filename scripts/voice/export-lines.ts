// Writes the script to scripts/voice/lines.json for generate.py: one row per line with the
// text to read and the spirit's official voice design (caption + seed).
//
//   pnpm voice:lines
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allLines } from "../../src/characters/lines";
import { spirit } from "../../src/characters/spirits";

const here = dirname(fileURLToPath(import.meta.url));
const rows = allLines().map(({ spirit: id, line }) => {
  const voice = spirit(id).voice;
  if (voice === null) throw new Error(`${id} has no voice design`);
  return {
    id: line.id,
    spirit: id,
    text: line.tts ?? line.text,
    caption: voice.caption,
    seed: voice.seed,
  };
});
mkdirSync(here, { recursive: true });
const out = resolve(here, "lines.json");
writeFileSync(out, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`${rows.length} lines → ${out}`);
