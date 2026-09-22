"""Synthesise the 御霊's lines with Irodori-TTS VoiceDesign and write one mp3 per line.

Runs inside the Irodori-TTS checkout's environment (see README.md next to this file):

    uv run --project D:/tools/Irodori-TTS --no-sync python scripts/voice/generate.py

Reads scripts/voice/lines.json (written by `pnpm voice:lines`), designs each spirit's voice
from the caption and seed published with her official sample, and writes
public/kitan/voice/<spirit>/<id>.mp3 (mono, 64 kbps, loudness-normalised). Lines whose mp3
already exists are skipped, so editing one line regenerates one file.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
# The checkout is not installed as a package; import it from where it lives.
IRODORI_DIR = Path(os.environ.get("IRODORI_DIR", "D:/tools/Irodori-TTS"))
if str(IRODORI_DIR) not in sys.path:
    sys.path.insert(0, str(IRODORI_DIR))
DEFAULT_MODEL = "Aratako/Irodori-TTS-500M-v2-VoiceDesign"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--lines", default=str(HERE / "lines.json"))
    p.add_argument("--out", default=str(ROOT / "public" / "kitan" / "voice"))
    p.add_argument("--model", default=DEFAULT_MODEL, help="Hugging Face repo id of the VoiceDesign checkpoint")
    p.add_argument("--only", default=None, help="Only ids starting with this prefix (e.g. 'sakuya.' or 'mami.greet')")
    p.add_argument("--force", action="store_true", help="Regenerate even when the mp3 exists")
    p.add_argument("--steps", type=int, default=None, help="Sampling steps (checkpoint default when omitted)")
    p.add_argument("--wav-dir", default=None, help="Also keep the raw wav here (for listening tests)")
    p.add_argument("--device", default="cuda")
    p.add_argument("--precision", default="fp32")
    p.add_argument("--dry-run", action="store_true", help="List what would be generated and exit")
    return p.parse_args()


def load_runtime(model: str, device: str, precision: str):
    from irodori_tts.inference_runtime import InferenceRuntime, RuntimeKey, download_hf_checkpoint

    checkpoint = download_hf_checkpoint(model)
    print(f"[model] {model} -> {checkpoint}", flush=True)
    return InferenceRuntime.from_key(
        RuntimeKey(
            checkpoint=checkpoint,
            model_device=device,
            model_precision=precision,
            codec_device=device,
            codec_precision="fp32",
        )
    )


def to_mp3(wav: Path, mp3: Path) -> None:
    mp3.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
            "-af", "loudnorm=I=-18:TP=-1.5:LRA=11",
            "-ac", "1", "-ar", "44100", "-b:a", "64k", "-codec:a", "libmp3lame",
            str(mp3),
        ],
        check=True,
    )


def main() -> int:
    args = parse_args()
    rows = json.loads(Path(args.lines).read_text(encoding="utf8"))
    out = Path(args.out)
    todo = []
    for row in rows:
        if args.only and not row["id"].startswith(args.only):
            continue
        mp3 = out / row["spirit"] / f"{row['id']}.mp3"
        if mp3.exists() and not args.force:
            continue
        todo.append((row, mp3))
    print(f"[plan] {len(todo)} of {len(rows)} lines to generate", flush=True)
    if args.dry_run or not todo:
        for row, _ in todo:
            print(f"  {row['id']}: {row['text']}")
        return 0
    if shutil.which("ffmpeg") is None:
        print("ffmpeg not found on PATH", file=sys.stderr)
        return 1

    from irodori_tts.inference_runtime import SamplingRequest

    try:
        from irodori_tts.inference_runtime import save_wav
    except ImportError:  # older layouts keep it beside infer.py
        import soundfile as sf

        def save_wav(path, audio, sample_rate):  # type: ignore[no-redef]
            data = audio.detach().cpu().numpy()
            if data.ndim == 2:
                data = data.T
            sf.write(str(path), data, sample_rate)
            return path

    runtime = load_runtime(args.model, args.device, args.precision)
    wav_dir = Path(args.wav_dir) if args.wav_dir else None
    tmp = Path(tempfile.mkdtemp(prefix="kitan-voice-"))
    started = time.time()
    for i, (row, mp3) in enumerate(todo, 1):
        t0 = time.time()
        result = runtime.synthesize(
            SamplingRequest(
                text=row["text"],
                caption=row["caption"],
                no_ref=True,
                seed=int(row["seed"]),
                num_steps=args.steps,
            )
        )
        wav = (wav_dir / f"{row['id']}.wav") if wav_dir else (tmp / f"{row['id']}.wav")
        wav.parent.mkdir(parents=True, exist_ok=True)
        save_wav(str(wav), result.audio, result.sample_rate)
        to_mp3(wav, mp3)
        seconds = result.audio.shape[-1] / result.sample_rate
        print(
            f"[{i}/{len(todo)}] {row['id']}  {seconds:.1f}s audio  {time.time() - t0:.1f}s  "
            f"seed={result.used_seed}  {row['text']}",
            flush=True,
        )
    print(f"[done] {len(todo)} lines in {time.time() - started:.0f}s -> {out}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
