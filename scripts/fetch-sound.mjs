// Builds public/kitan/sound/ from the ledger in scripts/sound-assets.json.
//
// The 宵闇素材庫 ships each sound as a zip of WAV + OGG. OGG does not play everywhere, and
// the WAV of a 77-second loop is 13 MB, so the WAV is re-encoded to mp3 here. The output is
// committed; this script exists so the intake is reproducible and the sources are on record.
//
//   node scripts/fetch-sound.mjs            # only what is missing
//   node scripts/fetch-sound.mjs --force    # everything again
//
// Needs `unzip` and `ffmpeg` on PATH.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ledger = JSON.parse(readFileSync(resolve(root, "scripts/sound-assets.json"), "utf8"));
const force = process.argv.includes("--force");

function need(tool) {
  const probe = spawnSync(tool, ["-version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  if (probe.error !== undefined) {
    console.error(`${tool} not found on PATH; both are needed to rebuild public/kitan/sound/`);
    process.exit(1);
  }
}

/** The zip's WAV, unpacked into a scratch directory. */
function wavFrom(zip, scratch) {
  execFileSync("unzip", ["-o", "-j", zip, "-d", scratch], { stdio: "ignore" });
  const wav = readdirSync(scratch).find((f) => f.toLowerCase().endsWith(".wav"));
  if (wav === undefined) throw new Error(`${zip}: no wav inside`);
  return join(scratch, wav);
}

let written = 0;
const scratchRoot = mkdtempSync(join(tmpdir(), "kitan-sound-"));
try {
  const todo = ledger.assets.filter(
    (a) => force || !existsSync(resolve(root, "public/kitan/sound", a.out)),
  );
  if (todo.length > 0) {
    need("unzip");
    need("ffmpeg");
  }
  for (const asset of todo) {
    const url = `https://yoiyami-files.vibe.co.jp/audio/${asset.id}.zip`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const zip = join(scratchRoot, `${asset.id}.zip`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    const scratch = join(scratchRoot, asset.id);
    mkdirSync(scratch, { recursive: true });
    const wav = wavFrom(zip, scratch);
    const out = resolve(root, "public/kitan/sound", asset.out);
    mkdirSync(dirname(out), { recursive: true });
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      wav,
      "-ac",
      String(asset.channels ?? 1),
      "-ar",
      "44100",
      "-b:a",
      asset.bitrate ?? "96k",
      "-codec:a",
      "libmp3lame",
      out,
    ]);
    const bytes = readFileSync(out).length;
    console.log(`${asset.out}  ${(bytes / 1024).toFixed(0)} KB  ${asset.name}`);
    written += 1;
  }
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}
console.log(`${written} file(s) written to public/kitan/sound/`);
