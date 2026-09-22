# 御霊の声 — Irodori-TTS で生成する

台本は `src/characters/lines.ts` が正。ここから JSON を書き出し、Irodori-TTS の VoiceDesign
モデルで 1 行ずつ合成して `public/kitan/voice/<御霊>/<行id>.mp3` に置く。声の設計
(caption と seed) は公式の声見本に添えられていた値をそのまま使う (`src/characters/spirits.ts`
の `voice`)。生成物はコミットする。

## 準備 (一度だけ)

Irodori-TTS をこのリポジトリの外に clone し、CUDA 12.8 の extra で環境を作る。

```sh
git clone https://github.com/Aratako/Irodori-TTS D:/tools/Irodori-TTS
cd D:/tools/Irodori-TTS
uv sync --extra cu128
```

`ffmpeg` が PATH にあること。GPU は RTX 2080 Ti (11GB) で確認した。

## 生成

```sh
pnpm voice:lines                      # lines.ts -> scripts/voice/lines.json
pnpm voice:generate                   # 足りない mp3 だけ生成
pnpm voice:generate -- --only mami.   # マミの行だけ
pnpm voice:generate -- --force        # 全部作り直す
pnpm voice:generate -- --dry-run      # 何を作るか見るだけ
```

`voice:generate` は `uv run --project D:/tools/Irodori-TTS --no-sync python scripts/voice/generate.py`
の別名。checkout の場所が違うなら `IRODORI_DIR` で上書きできる。

## モデル

- 採用: `Aratako/Irodori-TTS-500M-v2-VoiceDesign` (公式の声見本と同じ声になることを聴き比べて確認)
- 後処理: ffmpeg で mono / 44.1kHz / 64kbps mp3、`loudnorm` (I=-18, TP=-1.5) で音量を揃える

## 掟

公式の声見本は「AI に読み込ませて OK。音源そのままの単体再配布・販売は NG」。ここで作る mp3 は
このゲームのセリフとしてだけ使い、音声集として配らない。
