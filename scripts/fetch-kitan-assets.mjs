// Builds public/kitan/ from the ledger in scripts/kitan-assets.json.
//
// Icons are shrunk to 256px webp, standing art is capped at 1024px on the long side, videos
// are copied as they are. The output is committed, so players never fetch from the official
// servers; this script exists so the intake is reproducible and the sources are on record.
//
//   node scripts/fetch-kitan-assets.mjs            # only what is missing
//   node scripts/fetch-kitan-assets.mjs --force    # everything again
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ledger = JSON.parse(readFileSync(resolve(root, "scripts/kitan-assets.json"), "utf8"));
const force = process.argv.includes("--force");

async function source(asset) {
  if (asset.file !== undefined) return readFileSync(resolve(root, asset.file));
  const res = await fetch(asset.url);
  if (!res.ok) throw new Error(`${asset.url}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (asset.sha256 !== undefined) {
    const got = createHash("sha256").update(bytes).digest("hex");
    if (got !== asset.sha256) throw new Error(`${asset.url}: sha256 ${got} != ${asset.sha256}`);
  }
  return bytes;
}

async function transform(asset, bytes) {
  switch (asset.transform) {
    case "icon256":
      return sharp(bytes).resize(256, 256, { fit: "cover" }).webp({ quality: 88 }).toBuffer();
    case "canon":
      return sharp(bytes)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
    case "copy":
      return bytes;
    case "cutinFrame":
      return cutinFrame(bytes, asset.framePosition ?? 0.5);
    case "chibiFace":
      return chibiFace(bytes, asset.crop, asset.key ?? [27, 119, 52]);
    default:
      throw new Error(`${asset.out}: unknown transform ${asset.transform}`);
  }
}

/**
 * One frame of an official 必殺カットイン. The animation is a held pose with petals and
 * sparks drifting, so a single frame keeps the drawing and loses almost nothing — and the
 * cut-in's own staging supplies the motion for a fraction of the weight (1.5 MB of animated
 * webp becomes about 120 KB).
 */
async function cutinFrame(bytes, position) {
  const meta = await sharp(bytes, { animated: true }).metadata();
  const page = Math.min(
    (meta.pages ?? 1) - 1,
    Math.max(0, Math.floor((meta.pages ?? 1) * position)),
  );
  return sharp(bytes, { page })
    .resize({ width: 720, withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer();
}

/**
 * A face cut from a chibi sheet: the sheet is drawn on flat green, so the crop is keyed to
 * transparency by distance from the green, with a soft edge and the green spill pulled out
 * of the fringe, then framed on 256px like the official face icons.
 */
async function chibiFace(bytes, crop, key) {
  const { data, info } = await sharp(bytes)
    .extract(crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [kr, kg, kb] = key;
  const soft = 40;
  const solid = 120;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const d = Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb);
    const alpha = Math.max(0, Math.min(1, (d - soft) / (solid - soft)));
    data[i + 3] = Math.round(alpha * 255);
    // Despill: a fringe pixel keeps no more green than its other channels justify.
    if (alpha < 1 && g > Math.max(r, b)) data[i + 1] = Math.max(r, b);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer();
}

let written = 0;
for (const asset of ledger.assets) {
  const out = resolve(root, "public/kitan", asset.out);
  if (!force && existsSync(out)) continue;
  const bytes = await transform(asset, await source(asset));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  written += 1;
  console.log(`${asset.out}  ${(bytes.length / 1024).toFixed(0)} KB`);
}
console.log(`${written} file(s) written to public/kitan/`);
