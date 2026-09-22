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
    default:
      throw new Error(`${asset.out}: unknown transform ${asset.transform}`);
  }
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
