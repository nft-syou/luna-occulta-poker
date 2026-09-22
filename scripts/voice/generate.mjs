// Runs generate.py inside the Irodori-TTS checkout's environment. Arguments pass through.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const irodori = process.env.IRODORI_DIR ?? "D:/tools/Irodori-TTS";
const script = resolve(dirname(fileURLToPath(import.meta.url)), "generate.py");
const result = spawnSync(
  "uv",
  ["run", "--project", irodori, "--no-sync", "python", script, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, IRODORI_DIR: irodori, PYTHONIOENCODING: "utf-8" },
  },
);
process.exit(result.status ?? 1);
