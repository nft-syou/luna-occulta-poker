# 宵闇の賭場 — 月蝕綺譚 二次創作版 設計書

日付: 2026-09-22
状態: 設計承認済み (セクション ①〜④ をチャットで提示しユーザー承認。⑤ と細部は Claude に一任)
前提: `2026-09-19-jev-poker-design.md` (ゲーム本体)、`2026-09-22-library-packages-design.md` (パッケージ境界)

## 1. 目的

jev-poker を『月蝕綺譚 -Luna Occulta-』の非公式二次創作ポーカー「宵闇の賭場」にする。

1. CPU を公式の御霊にする。性格はポーカーの型に寄せず、公式設定 (口調・芯) から打ち方を導く。
2. 席に顔、要所にお披露目動画 (カットイン)、行動ごとにセリフと声を付ける。
3. 画面全体を公式トンマナ「宵闇に金」に揃える。

原典の資料は kitan-lore MCP (`get_worldview` / `get_guidelines` / `get_design_tone` / `get_ui_kit` /
`get_spirit`) が正本。掟: 公式を名乗らない、品位を損なわない、素材そのままの再配布をしない。

### 非目標 (YAGNI)

- 効果音 (配札・チップ) と BGM。宵闇素材庫の音は後日。
- 実行時 TTS。声は事前生成した静的ファイルのみ。
- 人格エディタ。御霊の性格は固定。custom persona の保存も廃止。
- 6 人以外の御霊。データ構造は増やせる形にするが、今回は 5 御霊 + あるじどの。
- `@jev-poker/engine` / `@jev-poker/agent` の変更。アプリ層だけで完結させる。
- ライト/ダーク切替。宵闇のみ。

## 2. 決定事項

| 論点 | 決定 |
| --- | --- |
| 面子 | 咲耶・マミ・タルト・孫市・蛇ノ目 (CPU) + あるじどの (人間席の既定。見物モードでは語らない CPU としても座れる) |
| 不採用 | ゴコウ・結 (声見本が ElevenLabs 型で配布 WAV なし)、石舟斎 (お披露目動画なし、あるじどので席が足りる) |
| 題名 | 「宵闇の賭場」 / 英 "Yoiyami Poker"。副題「月蝕綺譚 二次創作ポーカー」 |
| 非公式表記 | ヘッダ副題・フッター・README・`index.html` の description に明記。fanworks と CryptoNinja ガイドラインへリンク。`#月蝕綺譚` |
| 素材 | 公式素材を `public/kitan/` にコピーして同梱 (取り込みスクリプトで再現可能にする)。素材集に見えないよう、ゲームが使う分だけ |
| 席の絵 | 顔アイコン (公式透過 webp を 256px に縮小。マミは公式アイコンが無いので、ちびシートの笑顔を切り出して緑を透過にする)。動画は席に置かない |
| 動画 | お披露目 (素の版) を大きな局面のカットインにだけ使う |
| 声 | Irodori-TTS VoiceDesign をローカル (RTX 2080 Ti) で回し、公式の caption + seed で生成。mp3 を同梱 |
| 台本 | `src/characters/lines.ts` が正。id 安定。生成前にユーザーがレビュー |
| 咲耶 | 公式「嘘がつけず顔に出る」を、ブラフ時のセリフ差分 (テル) として実装。他は無し |

## 3. 御霊データ (`src/characters/`)

### 3.1 型

```ts
export type SpiritId = "arujidono" | "sakuya" | "mami" | "tart" | "magoichi" | "janome";

export interface Spirit {
  readonly id: SpiritId;
  readonly name: LocalizedText;          // { ja: "咲耶", en: "Sakuya" }
  readonly kana: string;                 // "さくや"
  readonly tagline: LocalizedText;       // { ja: "甲賀・火", en: "Koga · Fire" }
  readonly copy: LocalizedText;          // 公式キャッチ (ja) と英訳
  readonly persona: Persona;             // id = SpiritId。Jev へ渡す
  readonly silent: boolean;              // true = セリフ・声・カットイン無し (あるじどの)
  readonly tell: boolean;                // true = ブラフ時にセリフ差分 (咲耶)
  readonly icon: string;                 // "/kitan/icon/sakuya.webp"
  readonly canon: string;                // "/kitan/canon/sakuya.webp" (立ち絵。reduced-motion のカットイン用)
  readonly showcase: string | null;      // "/kitan/showcase/sakuya.mp4"。silent なら null
  readonly voice: { caption: string; seed: number } | null; // Irodori 用。silent なら null
}
```

`Persona` は `@jev-poker/agent` の既存型 (`name`, `description` (ja/en), `variance`, `isPreset: true`)。
`spiritPersonas(): Persona[]` が 6 件を返し、`useGame` の `personas` 引数にそのまま渡す。
統計 (`stats.ts`) は persona id をキーにしているので、御霊 id がそのまま統計キーになる。

### 3.2 性格 → 打ち方

英文 (`description.en`) が Jev に渡る本文。和文は設定画面の説明。

| 御霊 | 公式の芯 | 人格文の骨子 | variance |
| --- | --- | --- | --- |
| 咲耶 | 快活な姉御。嘘がつけず顔に出る | 強い手は正面から殴る。ブラフはほぼしない。降りる時も潔い | 0.3 |
| マミ | 化かすのは嘘でなく夢を見せる | ブラフ・セミブラフが多い。ポジションと回数で押す | 0.6 |
| タルト | 急がば、まわれ〜 | 参加は少なく待つ。コール中心、大きい手だけレイズ | 0.25 |
| 孫市 | 外したことは一度もねぇ | 入ったらバリューで大きく打つ。ポットを取り切る | 0.4 |
| 蛇ノ目 | のんびりで致命的にズレる | ルースで読めない。時々とんでもない手で突っ込む | 0.85 |
| あるじどの | 語らず、名乗らず | 冷静で堅実。読みに徹する (TAG 相当) | 0.15 |

### 3.3 席設定 (`src/ui/storage.ts`)

- `SeatSetting` は `{ name, kind, spiritId }`。`personaId` は廃止。
- 既定: `[あるじどの(human), 咲耶, マミ, タルト, 孫市, 蛇ノ目]` (全て CPU)。席数を減らすと後ろから外れる。
- 席の表示名は御霊名 (`spirit.name[lang]`) で固定。`name` は人間席だけ編集可 (既定「あるじどの」)。
- 同じ御霊は 1 卓に 1 人。`validateSettings` が `duplicateSpirit` を返す。
- 旧 `personaId` 付きの localStorage は `spiritId` が無ければ既定に戻す (`loadSettings` の検証で落とす)。
- `Settings` に `voice: boolean` (既定 true) と `voiceVolume: number` (0〜1、既定 0.8) を追加。

### 3.4 設定画面 (`Setup.tsx`)

- 席の行: 番号 / 顔アイコン + 御霊名 / 種別 (あるじどの|御霊) / 御霊の選択 (顔付き `<select>` は不可なので、
  `<select>` の隣に選択中の顔を出す)。
- 「人格を編集」ボタンと `PersonaEditor` を削除。`personas.ts` の custom 読み書きはアプリから呼ばない。
- 声のオン/オフと音量のフィールド。

## 4. 見た目の部品

### 4.1 素材取り込み (`scripts/fetch-kitan-assets.mjs`)

- 台帳 `scripts/kitan-assets.json`: `{ id, url, sha256?, out, transform }`。
  transform は `icon256` (webp 256px)、`copy` のどちらか。
- 実行: `pnpm assets:kitan`。`sharp` (devDependency) で縮小。出力先 `public/kitan/{icon,canon,showcase}/<spiritId>.*`。
- マミには公式の顔アイコンが無い。台帳の `chibiFace` 変換で、ちびシート右上の笑顔を切り出し、緑背景を距離キーで透過にして 256px に収める。
- 生成物 (`public/kitan/**`) はコミットする。README に出典と掟を書く。

素材の対応:

| 御霊 | 顔 | 立ち絵 | 動画 |
| --- | --- | --- | --- |
| あるじどの | `arujidono_icon.webp` | `arujidono_canon.webp` | なし |
| 咲耶 | `sakuya_icon.webp` | `sakuya_canon.webp` | `showcase_sakuya_v3.mp4` |
| マミ | `mami_chibi_sheet.png` の笑顔を切り出し | `mami_canon.webp` | `showcase_mami_v3.mp4` |
| タルト | `tart_icon.webp` | `tart_canon.webp` | `showcase_tart_v4.mp4` |
| 孫市 | `magoichi_icon.webp` | `magoichi_canon.webp` | `showcase_magoichi_v5.mp4` |
| 蛇ノ目 | `janome_icon.webp` | `janome_canon.webp` | `showcase_janome_v9.mp4` |

### 4.2 席 (`SeatView`)

- カードの上に顔アイコン (48px、席が広い時 56px) を式札風の枠で置く: 角丸 5px、金泥 1px の縁線、面は `--kitan-panel`。
- 名前は Shippori Mincho、下に `tagline` の小ラベル (11px、`--kitan-sublabel`)。
- 手番の席: 縁線が `--kitan-kindei-hi` になり 2.4s 周期で明滅 (行灯の灯)。光る輪は作らない。
- フォールド: アイコンとカードを暗く沈める (opacity 0.45 + grayscale)。
- 勝者: 既存 `winner-glow` を金のこぼれ光 (`#F0CE7E` 40%, blur 34) に差し替え。勝った瞬間だけ。

### 4.3 セリフ吹き出し (`CalloutView` → `SpeechView`)

- `fx.ts` の `Callout` に `line: SpeechLine | null` を追加 (`{ id, text }`)。`reduceFx` が
  `action_taken` を受けた時、席の御霊と局面から `pickLine()` で選ぶ。人間席と silent は `null`。
- 見た目: 羽二重 (縁なし、面 `--kitan-bubble`、影二層、角丸 10px、尾は同色)。本文 (ja) を Shippori Mincho 500、
  下に行動ラベル (`FOLD` / `RAISE 12 BB`) を `--kitan-sublabel` で。`line` が無い席は行動ラベルだけ。
- 表示時間・向き (`inward`) は今の `CalloutView` と同じ。英語 UI でもセリフは日本語のまま。

### 4.4 カットイン (`CutInLayer`、`TableFxLayer` に追加)

- 発火 (CPU で `silent` でない席のみ):
  1. `allin` の宣言
  2. ポット獲得が `40 BB` 以上
  3. バースト (スタック 0 でハンド終了)
- 挙動: フェルト中央に羽二重パネル (radius 18、影二層)、中に `showcase` 動画を 1 回再生 (`muted`、`playsInline`)、
  上に決めゼリフ (`bigwin` / `allin` / `bust` の行) とその声。動画終了または 5 秒で 280ms フェード。
- 再生中に別の発火が来たら捨てる。動画はゲーム開始時に `<link rel="preload">` 相当で先読み。
- `prefers-reduced-motion` なら動画の代わりに立ち絵 (`canon`) の静止画を 1.0→1.03 でゆっくり寄せる。
- 録画 (showcase) モードでも出す。

## 5. 音声

### 5.1 台本 (`src/characters/lines.ts`)

```ts
export type Situation =
  | "greet" | "fold" | "check" | "call" | "bet" | "raise" | "allin"
  | "win" | "bigwin" | "lose" | "bust";

export interface SpeechLine {
  readonly id: string;      // "sakuya.raise.2"
  readonly text: string;    // 画面に出す本文 (ja)
  readonly tts?: string;    // 読み上げ用 (絵文字注釈・かな化)。省略時は text
  readonly bluff?: boolean; // 咲耶のテル。true = ブラフ時にだけ選ばれる
}

export const LINES: Readonly<Record<Exclude<SpiritId, "arujidono">, Readonly<Record<Situation, readonly SpeechLine[]>>>>;
export function pickLine(spirit: SpiritId, situation: Situation, rng: () => number, bluff?: boolean): SpeechLine | null;
export function audioPath(line: SpeechLine): string; // "/kitan/voice/sakuya/sakuya.raise.2.mp3"
```

- 局面 11 種 × 2〜3 本。咲耶だけ `bet` / `raise` に `bluff: true` の行が加わる。
- `bluff` の判定: `DecisionInfo.jev.probabilities.bluff_intent ≥ 0.5` (ブラフ質問の yes 確率)。
- `greet` はゲーム開始時 (対局開始ボタン押下後、1 席ずつ 600ms ずらして)。
- 口調・一人称・呼び方は `get_spirit` の `voice` 欄に従う。相手は「あるじどの」または各キャラの address。

### 5.2 生成 (`scripts/voice/`)

- `pnpm voice:lines` (tsx) が `LINES` を `scripts/voice/lines.json` に書き出す (id, spirit, tts, caption, seed)。
- `scripts/voice/generate.py` (uv プロジェクト、`Aratako/Irodori-TTS` を依存に `cu128` extra) が
  `InferenceRuntime` で 1 行ずつ合成。`--seed` は公式 `voice_design_seed`、`--caption` は公式
  `voice_design_caption`、`--no-ref`。既存の mp3 がある id は飛ばす (`--force` で再生成)。
- 後処理: ffmpeg で `-ac 1 -b:a 64k` の mp3、`-af loudnorm` で音量を揃える。出力
  `public/kitan/voice/<spirit>/<id>.mp3`。
- モデルは `Irodori-TTS-500M-v2-VoiceDesign` を第一候補。公式見本 WAV と聴き比べ、違えば `600M-v3` を試す。
  採用したモデル id を `scripts/voice/README.md` に記録。

### 5.3 再生 (`src/characters/voice.ts`)

- `createVoicePlayer({ enabled, volume })` → `{ play(line, { priority? }), preload(lines), setEnabled, setVolume }`。
- `HTMLAudioElement` を行ごとに 1 つ (preload="auto")。席ごとに同時 1 本、`priority` (カットイン) は他を止める。
- ファイルの 404 やデコード失敗は握りつぶす (本文だけ出る)。
- 自動再生制限: 対局開始ボタンの click で無音の `play()` を 1 回呼び unlock。
- `useGame` の外、`TableView` の副作用で `Callout` の `line` が変わった時に `play()`。

## 6. テーマ

### 6.1 トークン (`styles.css` `:root`)

UI キットの `tokens_css` をそのまま置く (`--kitan-yoiyami` #131320, `--kitan-yoiyami-hi` #1B1B2E,
`--kitan-kindei` #D9A94C, `--kitan-kindei-hi` #F0CE7E, `--kitan-shokko` #C93A2E, `--kitan-geppaku` #E8E4D8,
`--kitan-anshi` #5C4470, `--kitan-panel` #100E1C, `--kitan-bubble` #181626, `--kitan-sublabel` #9D93B5,
角丸 4/5/10)。地は `linear-gradient(#131320, #1B1B2E)`。純黒・白背景・明るい赤の面は禁止。
赤はオールイン・バースト・警告・トランプの赤スートだけ (面積 5% 以下)。

### 6.2 部品

- 書体: 見出し・ボタン・名前 = Shippori Mincho B1 800 + 金グラデ文字。本文 = 同 500・月白。数字 = M PLUS Rounded 1c 800。
  Google Fonts (`display=swap`)。11px 未満は作らない。
- 卓: 楕円の面は `--kitan-panel` の放射グラデ (上端中央が明るい)、縁は金泥 1px。緑は全廃。
- カード: 面 `--kitan-geppaku`、スートは墨 (#1a1622) と蝕紅。裏は漆に金の細い格子 (CSS `repeating-linear-gradient`)。
- チップ: 金泥の細線で描いた輪郭のみ (面ベタにしない)。
- ボタン: UI キットの KitanButton (`get_ui_kit("button")` の CSS を移植)。押下 0.965 / 90ms。
- パネル・モーダル: 羽二重 (縁なし、放射グラデ、二層影、radius 18)。
- モーション: easeOutCubic。押下 90 / 小要素 200 / ダイアログ 280 / 全画面 420ms。既存の `fx` 演出の時間は据え置き、カーブだけ揃える。
- 光る輪の装飾は作らない (蝕環は公式署名)。

### 6.3 言葉 (`ja.json`)

| 今 | 後 |
| --- | --- |
| jev-poker | 宵闇の賭場 |
| CPU | 御霊 |
| 人間 / You | あるじどの |
| 人格 | 御霊 |
| 対局を始める | 開帳 |
| 観戦する | 見物する |
| 退席 | 席を立つ |
| チップ | 勾玉 (数値と BB 表記はそのまま) |
| ハンド | 一局 |

感嘆符は演出時だけ。英語版 (`en.json`) は "Yoiyami Poker" 以外は素直な英語のまま。

### 6.4 看板と配布物

- ヘッダ: 題「宵闇の賭場」、副題「月蝕綺譚 二次創作ポーカー」。
- フッター (全画面共通): 「本作は『月蝕綺譚 -Luna Occulta-』の非公式二次創作です。」+ fanworks リンク + CryptoNinja ガイドラインリンク + `#月蝕綺譚` + 「CPU は TypeSafe Jev で考えます」。
- `index.html`: title / description / OG / theme-color (#131320) を差し替え。`site.webmanifest` の name も。
- ファビコン: 金の式札 (縦長の角丸矩形に細い線) の SVG。蝕環は使わない。
- OG 画像: テーマ完成後にテーブル画面を 1200×630 で撮って `public/og.png` を差し替え。
- README (ja/en): 冒頭に二次創作である旨と面子、素材の出典と掟、声の生成手順。

## 7. テスト

- `spirits.test.ts`: 6 件、id 一意、persona の variance が 0〜1、silent の御霊は showcase/voice が null。
- `lines.test.ts`: 全御霊 × 全局面に 2 本以上、id が `<spirit>.<situation>.<n>` で一意、
  `pickLine` が bluff 指定で咲耶の bluff 行だけを返す、silent には null。
- `voice-files.test.ts`: `LINES` の全 id に `public/kitan/voice/<spirit>/<id>.mp3` が存在 (Node の fs)。生成前は `it.skip` にしない — 生成が終わるまで失敗で良い (段階 4 で緑にする)。
- `voice.test.ts`: `Audio` をモックし、play 時に正しい src、priority が他を止める、disabled で鳴らない。
- `storage.test.ts`: 旧 `personaId` 設定が既定に戻る、重複御霊が `duplicateSpirit`。
- `fx.test.ts`: `action_taken` で `line` が付く、人間席・silent は null。
- `CutInLayer.test.tsx`: allin / 40BB / bust で発火、再生中は捨てる、reduced-motion で img。
- `SeatView.test.tsx` / `Setup.test.tsx` / `TableView.test.tsx`: 顔と御霊名の表示に合わせて更新。
- 既存テストは削除しない。`PersonaEditor.test.tsx` だけはコンポーネントごと削除。
- `pnpm check` (lint → typecheck → test → build → verify:packages) を各段階の終わりに緑にする。
- 見た目: `agent-browser` でスクリーンショットを撮り、公式チェックリスト (地は宵闇藍 / 金は線と粒 / 赤 5% 以下 / 余白 / 輪なし / 語彙 / 5 秒で分かる) を目視。

## 8. 段階

1. **テーマ**: トークン・書体・卓・カード・ボタン・パネル・言葉・看板・メタデータ。データ変更なし。
2. **御霊**: `spirits.ts`、素材取り込み、`storage` 移行、`Setup`、`SeatView` の顔、PersonaEditor 削除。
3. **セリフとカットイン**: `lines.ts` (台本レビュー)、`fx` の `line`、`SpeechView`、`CutInLayer`。声なしで動く。
4. **声**: Irodori-TTS の環境、生成、`voice.ts`、設定、`greet`。
5. **仕上げ**: OG 画像、ファビコン、README、CHANGELOG。

各段階の終わりにコミット。ブランチ `feat/luna-occulta` を `main` から切る。
