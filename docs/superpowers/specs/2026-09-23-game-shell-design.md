# 宵闇の賭場 — ゲームの入口と運営キー化 設計書

日付: 2026-09-23
状態: 設計承認済み (チャットで ①サーバー ②画面の流れ ③コードの分け方 を提示しユーザー承認)
前提: `2026-09-22-luna-occulta-fanwork-design.md` (二次創作版の本体)

## 1. 目的

今の入口は開発者向けです。API キーを自分で用意し、席数・スタック・ブラインド・先読みを入力しないと
遊べません。これを一般のゲームの入口にします。

1. プレイヤーは何も入力せずに遊べる。Jev の API キーは運営が持つ。
2. タイトル → 卓を整える → 卓、の短い流れにする。選ぶのは卓の形・レート・(1 対 1 なら) 相手だけ。
3. 運営キーを悪用させない。ゲーム以外の用途に使えず、予算を超えて使われない。

### 非目標 (YAGNI)

- 勾玉の持ち越し (資金制)。毎回同じ勾玉で着席する。
- 差し向かい (1 対 1) の見物。見物は六人卓だけ。
- BYOK (プレイヤー自身のキー) の併用。運営キーだけにする。
- 速度の選択。「ふつう」固定。
- 先読み。既定オフで UI からも消す (運営予算を 2〜3 倍食うため)。
- アカウント・ログイン・ランキング。

## 2. 決定事項

| 論点 | 決定 |
| --- | --- |
| API キー | 運営のキーを Worker のシークレットに置く。プレイヤーは入力しない |
| 上限に達したら | その日は遊べない。「今宵はここまで」で卓を止め、日本時間 0 時に戻る |
| 基盤 | Cloudflare Workers に移す。静的ファイル配信・API・Durable Object を 1 つの Worker に |
| 悪用対策 | ブラウザからは文章を送らせない (閉じた語彙の局面だけ)。文章はサーバーが組み立てる。Turnstile で通行証、IP ごとの瞬間流量と 1 日上限、全体の 1 日上限 |
| 卓の形 | 六人卓 (あるじどの + 御霊 5 人、固定) / 差し向かい (御霊 1 人を選ぶ) |
| レート | 宵 100BB / 深更 50BB / 蝕 25BB。ブラインド 1/2 固定、スタックが 200 / 100 / 50 |
| 見物 | 六人卓だけ。あるじどのは語らない御霊として座る |
| 設定 | 音 (BGM・効果音・声) と言語だけ。タイトルと卓のヘッダから開く |
| 速度 | ふつう固定 |
| 録画モード | URL に `?rec` を付けたときだけヘッダにボタンを出す |
| `@jev-poker/agent` | 追加エクスポート 1 つ (§3.3)。既存の挙動と公開 API は変えない |

## 3. サーバー

### 3.1 構成 (`wrangler.jsonc`)

Pages から Workers に移す。1 つの Worker が次を持つ。

- `main`: `src/worker/index.ts`
- `assets`: `directory: "./dist"`、`not_found_handling: "single-page-application"`、
  `run_worker_first: ["/api/*"]` (API だけ Worker を先に通し、それ以外は静的ファイル)
- Durable Object `JEV_BUDGET` (クラス `JevBudget`、`new_sqlite_classes` で SQLite 版。無料枠で可)
- 流量制限バインディング `JEV_BURST`: IP ごと 10 秒あたり 20 回
- シークレット: `JEV_API_KEY` (運営の Jev キー)、`TURNSTILE_SECRET`、`SESSION_SECRET` (通行証の署名鍵)
- 変数 (`vars`): `JEV_ROUTE` (`typesafe` / `lolipop` / `vercel` / `cloudflare`)、`JEV_MODEL`、
  Cloudflare 経路なら `JEV_CF_ACCOUNT` `JEV_CF_GATEWAY` `JEV_CF_PROVIDER`、
  `DAILY_CALLS_PER_PLAYER` (既定 600)、`DAILY_CALLS_TOTAL` (既定 20000)、
  `TURNSTILE_SITE_KEY` (クライアントに渡す公開キー)

`functions/` (Pages Function) は削除する。

### 3.2 API

**`POST /api/session`** — 卓に着く前に 1 回。

- 本文 `{ turnstileToken: string }`。Turnstile の siteverify で検証する。
- 通れば `{ token, expiresAt }` を返す。`token` は `base64url(payload).base64url(HMAC-SHA256)`、
  payload は `{ ip, exp }` (有効 2 時間)。署名鍵は `SESSION_SECRET`。
- 失敗は 403 `turnstile_failed`。

**`POST /api/jev/decide`** — 御霊の手番ごとに 1 回。上から順に検査し、最初に落ちたところで返す。

1. **通行証**: `Authorization: Bearer <token>`。署名・期限・IP が合わなければ 401 `session_expired`
   (クライアントは Turnstile をやり直す)。
2. **形**: 本文 16KB 以下の JSON で、§3.3 のスキーマに合うこと。合わなければ 400 `bad_request`。
3. **瞬間流量**: `JEV_BURST.limit({ key: ip })`。超えたら 429 `slow_down` (`retry-after: 2`)。
4. **1 日予算**: `JEV_BUDGET` に `take(ip, day)`。上限なら 429 `tonight_is_over`、
   本文に `{ resumesAt }` (次の日本時間 0 時の ISO 時刻)。
5. **組み立てと転送**: §3.3 で Jev のリクエストを組み立て、運営キーで上流へ。上流の選択は
   今の `upstreamUrl` を運営の変数で呼ぶ。
6. **応答**: 上流の答えから次だけを取り出して返す。
   `{ model, action: { choice, probabilities }, sizing: { score }, bluff_intent: { noul } }`。
   上流の 402 (運営のクレジット切れ) は 429 `tonight_is_over` に変換。401/403 は 503 `unavailable`
   (運営キーの問題をプレイヤーのせいにしない)。それ以外の失敗は 502 `upstream_error`。

これ以外のパスはすべて 404。

### 3.3 閉じた語彙のリクエスト

ブラウザは**文章を 1 文字も送らない**。送れるのは次の構造だけで、文章はサーバーが組み立てる。

```ts
interface DecideRequest {
  spirit: SpiritId;                 // 6 択。人格文はサーバーが spirits.ts から引く
  legal: { fold: boolean; checkOrCall: boolean; betOrRaise: boolean };
  prose: { style: PromptStyle; rangeEquity: boolean };
  hand: FeaturesHand;               // 型は @jev-poker/agent のまま
  table: FeaturesTable;
  history: FeaturesHistoryEntry[];
}
```

**検査** (`src/worker/schema.ts`): 未知のキーは拒否。

- 列挙値は決まった一覧のどれか: `street`、`position`、`madeHand`、`pairKind`、`draws[]`、
  `preflopStrength`、`board_texture`、`action`、`OpponentType`、`style`。
- 数値は有限で範囲内: 百分率は 0〜100、BB は 0〜10000、席番号は 0〜9、人数は 1〜10。
- カード表記は `^([2-9TJQKA][shdc])( [2-9TJQKA][shdc])*$` か空文字 (`board` は 0〜5 枚、
  `holeCards` は 2 枚)。
- 配列の長さに上限: `stacksBB` ≤ 10、`history` ≤ 80、`opponentStats` / `opponentTypes` ≤ 9。
- 合法手は最低 1 つ真。

**組み立て** (`src/worker/decide.ts`):

- `persona` = `personaPrompt(spirit(id).persona)`。
- `task` と `importantContext` = `featureProse(...)` (下記)。引数はすべてリクエストの構造から
  決める: `style` と `rangeEquity` は `prose` から、`preflop` は `hand.street` から、
  `hasOpponentStats` は `table.opponentStats` が空でないか、`opponentTypes` は
  `table.opponentTypes` の型の集合。
- `questions` = `buildQuestions(legal, { street: hand.street, style })`。
- `model` = `JEV_MODEL`。

**`@jev-poker/agent` への追加**: `featuresFromView` の中で状況説明とガイダンス文を選んでいる部分を、
純関数 `featureProse({ style, preflop, rangeEquity, hasOpponentStats, opponentTypes })` →
`{ task, importantContext }` として切り出してエクスポートする。`featuresFromView` はこれを呼ぶだけに
なり、出力は変わらない (既存のスナップショットテストで保証)。changeset は minor。

### 3.4 予算 (`src/worker/budget.ts`)

- 数える処理は純関数 `takeCall(state, ip, day, limits) → { ok, state }` に切り出す。
- `JevBudget` は 1 インスタンス (`idFromName("global")`) で、SQLite に `(day, ip, count)` と
  `(day, total)` を持つ。`take` は `blockConcurrencyWhile` の中で読んで数えて書く。
- 日付は日本時間 (UTC+9) の `YYYY-MM-DD`。前日以前の行は `take` のついでに消す。
- 上限は `DAILY_CALLS_PER_PLAYER` と `DAILY_CALLS_TOTAL`。

### 3.5 ローカル開発

- Vite の開発サーバーのプラグインが `/api/session` と `/api/jev/decide` を同じハンドラで処理する。
- 予算はメモリ上の実装 (`MemoryBudget`)、瞬間流量は常に通す。
- Turnstile は Cloudflare のテスト用キー (必ず通る) を既定にする。
- 運営キーは環境変数 `JEV_API_KEY`。無ければ `/api/jev/decide` は 503 を返す。
- ハンドラは `{ budget, burst, fetch, env }` を引数で受け取り、本番と開発とテストで差し替える。

## 4. クライアント

### 4.1 画面の流れ

```
タイトル ─ 開帳 ─→ 卓を整える ─ 開帳 ─→ (Turnstile) ─→ 卓
        ├ 見物 ─→ 卓を整える(六人卓のみ) ─ 見物 ─→ (Turnstile) ─→ 卓
        └ 設定 ─→ 設定ダイアログ
```

**タイトル画面** (`TitleScreen.tsx`、新規): 題字「宵闇の賭場」、副題「月蝕綺譚 二次創作ポーカー」、
決め口上「喰われた月の下で、逢いましょう」。ボタン「開帳」「見物」「設定」。フッターの非公式表記は
今のまま。今のヘッダの接続ボタンと言語切替は消し、ソースコードへのリンクはフッターへ移す。

**卓を整える画面** (`TableSetup.tsx`、今の `Setup.tsx` を置き換え):

- **卓の形**: 式札 2 枚。「六人卓」「差し向かい」。見物のときは六人卓だけで、この段は出さない。
- **相手**: 差し向かいのときだけ出る。御霊 5 人の式札 (顔・名前・所属・キャッチコピー) から 1 人。
- **レート**: 式札 3 枚。
  | id | 名 | 深さ | スタック | ひとこと |
  | --- | --- | --- | --- | --- |
  | `yoi` | 宵 | 100BB | 200 | 落ち着いた卓 |
  | `shinkou` | 深更 | 50BB | 100 | 勝負が早い |
  | `shoku` | 蝕 | 25BB | 50 | オールインとカットインが多い |
- 下に「開帳」(見物なら「見物」) と「戻る」。

**設定ダイアログ** (`SettingsDialog.tsx`、新規): 今の `SoundSettings` と言語切替。タイトルと卓の
ヘッダの両方から開く。卓のヘッダの「音」ボタンは「設定」に変える。

**卓のヘッダ**: 局番号・一時停止・設定・席を立つ。先読みの切替と速度の選択は消す。録画モードの
ボタンは `location.search` に `rec` があるときだけ出す。右の「記録」「統計」は今のまま。

**今宵はここまで** (`TonightOverDialog.tsx`、今の `BillingModal` を置き換え): サーバーが
`tonight_is_over` を返したら卓を一時停止して出す。文言は「今宵はここまで。月がまた昇る頃に
— 日本時間 0 時から、また卓を囲めます」。ボタンは「席を立つ」だけ。

### 4.2 卓の選択 (`src/ui/tableChoice.ts`、新規)

```ts
type TableFormat = "six" | "hu";
type RateId = "yoi" | "shinkou" | "shoku";
interface TableChoice { format: TableFormat; rate: RateId; opponent: CpuSpiritId }
function settingsFor(choice: TableChoice, mode: "play" | "watch", base: Settings): Settings;
```

- 六人卓で遊ぶ: 席は `[あるじどの(human), 咲耶, マミ, タルト, 孫市, 蛇ノ目]`。
- 六人卓を見物: 同じ並びで、あるじどのも CPU。
- 差し向かい: `[あるじどの(human), opponent]`。
- ブラインド 1/2、スタックはレートから。速度は `normal`、先読みは `false`。
- 最後の `TableChoice` を localStorage (`jev-poker.tableChoice`) に保存し、次に開いたときの初期値にする。
  音の設定は今の `Settings` のまま保存する。

### 4.3 Jev への呼び出し (`src/jev/gameBackend.ts`、新規)

`@jev-poker/agent` の `decideAction` は `backend.systemOne({ state, questions, model })` を呼ぶ。
新しい `JevBackend` 実装がこれを受けて次をする。

1. `state` (= `DecisionFeatures`) から `task` `persona` `importantContext` を捨て、
   `hand` `table` `history` だけを残す。
2. `questions.action` の選択肢のキーから `legal` を、`state.persona` ではなく席の御霊 ID から
   `spirit` を作る (バックエンドは席ごとに御霊 ID を知る必要があるので、`useGame` から
   `(seat) => SpiritId` を渡す)。
3. 通行証を付けて `/api/jev/decide` に送り、返ってきた答えを `SystemOneResult` の形に戻す。
4. 401 `session_expired` なら Turnstile をやり直して 1 回だけ再送。429 `slow_down` は
   `retry-after` だけ待って 1 回だけ再送。429 `tonight_is_over` は専用のエラーを投げ、
   `useGame` が一時停止して `TonightOverDialog` を出す。

`useGame` の `pauseReason` は `"auth" | "billing"` を `"tonight"` に置き換える。

### 4.4 Turnstile (`src/ui/turnstile.ts`、新規)

- 「開帳」「見物」を押したときに、見えない (invisible) ウィジェットで判定し、`/api/session` で
  通行証に換える。通行証はメモリにだけ持つ (localStorage には置かない)。
- スクリプトは `https://challenges.cloudflare.com/turnstile/v0/api.js` を必要になったときに読み込む。
- 判定に失敗したら卓を整える画面に「月が雲に隠れました。もう一度お試しください」と出す。

### 4.5 消すもの

`ConnectionModal`、`BillingModal`、`Setup`、`src/jev/connection.ts` のクライアント側 (経路ヘッダ・
`connectionHeaders` など)、`src/jev/backend.ts` の BYOK 用 `createProxyBackend`、`src/proxy/` の
BYOK ハンドラ、`storage.ts` の接続情報の保存と読み込み、席数・名前・人間/CPU・スタック・ブラインド・
先読み・同時リクエスト数・速度の UI、それぞれのテスト。上流の URL を組み立てる `upstreamUrl` と
その正規表現の検査はサーバーで使うので残す。

## 5. テスト

- **一番大事**: 乱数で 300 局 (六人卓と差し向かい、3 つのレート) を回し、実際に出た全リクエストが
  §3.3 の検査を通ること。同じリクエストの文字列フィールドに任意の文章を混ぜたもの、未知のキーを
  足したもの、範囲外の数値にしたものは必ず落ちること。
- `featureProse`: 切り出し前後で `featuresFromView` の出力が一致すること (既存スナップショット)。
- 通行証: 発行・検証・期限切れ・署名改ざん・IP 違いで落ちること。
- 予算: IP ごとの上限、全体の上限、日本時間 0 時をまたいだ切り替わり、古い日の掃除。
- ハンドラ: 各段で落ちたときの状態コードと本文、上流 402/401/失敗の変換、応答から余計な項目が
  消えていること。
- `gameBackend`: 文章を送っていないこと、再送の規則、`tonight_is_over` で専用エラーになること。
- `settingsFor`: 形・レート・相手・遊ぶ/見物の全組み合わせ。
- 画面: タイトルの 3 ボタン、卓を整える画面 (差し向かいのときだけ相手が出る、見物のときは形の段が
  出ない)、設定ダイアログ、今宵はここまで。
- `pnpm check` は各段階の終わりに緑。

## 6. 段階

1. **サーバーの新しい口とバックエンド差し替え**: `featureProse` の切り出し、`schema.ts`、
   `decide.ts`、開発サーバーのプラグイン (予算はメモリ、Turnstile はテストキー)、`gameBackend.ts`。
   この段階の終わりに、今の画面のままローカルで遊べる。
2. **画面の作り替え**: タイトル、卓を整える、設定ダイアログ、`tableChoice.ts`、デバッグ UI と
   BYOK の撤去、録画モードの `?rec`。
3. **本番の守り**: `session.ts` と Turnstile、`JevBudget`、瞬間流量、`TonightOverDialog`、
   `wrangler.jsonc` の Workers 化、`functions/` の削除、README のデプロイ手順。

## 7. 運営の作業 (段階 3 のあと)

1. Cloudflare ダッシュボードで Turnstile のウィジェットを作り (モードは「Invisible」、ホスト名は
   公開ドメインと `localhost`)、サイトキーとシークレットを控える。
2. `wrangler secret put JEV_API_KEY` / `TURNSTILE_SECRET` / `SESSION_SECRET`。
3. `wrangler.jsonc` の `vars` に経路・モデル・上限値・Turnstile のサイトキーを入れる。
4. Workers Builds をこのリポジトリの Git に連携し、独自ドメインを割り当てる。
5. `index.html` の canonical と OG の URL を公開ドメインに差し替える。
