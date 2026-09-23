# 宵闇の賭場 — 月蝕綺譚 二次創作ポーカー

[![CI](https://github.com/nft-syou/jev-poker/actions/workflows/ci.yml/badge.svg)](https://github.com/nft-syou/jev-poker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 24](https://img.shields.io/badge/node-24-339933?logo=nodedotjs&logoColor=white)](.node-version)
[![pnpm](https://img.shields.io/badge/pnpm-12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![Deploys to Cloudflare Workers](https://img.shields.io/badge/deploys%20to-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](#cloudflare-workers-へデプロイ)

**遊ぶのに準備は要りません** — キーもアカウントも不要で、サイトを開いて座るだけです。自分で運営する場合は [Cloudflare Workers へデプロイ](#cloudflare-workers-へデプロイ) を参照してください。

**English version: [README.md](README.md)**

> 本作は『月蝕綺譚 -Luna Occulta-』(CryptoNinja 外伝) の**非公式二次創作**です。公式とは関係ありません。
> [二次創作の掟](https://vibe.co.jp/luna-occulta/fanworks) と
> [CryptoNinja 利用ガイドライン](https://www.ninja-dao.com/guidelines) の範囲で作っています。 #月蝕綺譚

喰われた月の下、漆の卓で御霊たちと勾玉を賭けるノーリミット・テキサスホールデム。
あなたは「あるじどの」として卓に着き、相手は公式設定から性格を写した 5 人の御霊
— 咲耶・マミ・タルト・孫市・蛇ノ目。御霊たちの一手はすべて
[TypeSafe Jev](https://typesafe.ai) が考え、席の顔と声、要所のカットインで語ります。
全席御霊の見物モードもあります。鍵も準備も不要 — 運営の Jev キーは卓の奥に置かれ、
あなたのブラウザには来ません。

[jev-poker](https://github.com/nft-syou/jev-poker) を土台に、見た目・キャラクター・声を
月蝕綺譚の世界に合わせたものです。エンジンと CPU は元のまま (`@jev-poker/engine`、`@jev-poker/agent`)。

## 御霊たち

| 御霊 | 所属 | 公式の芯 | 卓での打ち方 |
| --- | --- | --- | --- |
| 咲耶 | 甲賀・火 | 快活な姉御。嘘がつけず顔に出る | 強い手は正面から。ブラフはほぼしない。**ブラフの時だけセリフが変わる** (テル) |
| マミ | 雑賀・木 | 化かすのは嘘でなく夢を見せる | ブラフとセミブラフが多く、数で押す |
| タルト | 甲賀・水 | 急がば、まわれ〜 | 参加は少なく待つ。コール中心、大きい手だけレイズ |
| 孫市 | 雑賀・火 | 外したことは一度もねぇ | 入ったらバリューで大きく打ち、取り切る |
| 蛇ノ目 | 風魔・木 | のんびりで致命的にズレる | ルースで読めない。時々とんでもない手で突っ込む |
| あるじどの | — | 語らず、名乗らず | あなたの席。見物モードでは語らない CPU として座る |

性格の文章は `src/characters/spirits.ts`、セリフは `src/characters/lines.ts` にあります。

## 仕組み

1. ゲームエンジン (`src/engine`、依存ゼロ) が配札・ベッティング・サイドポット・役判定を行う。
2. CPU の手番ごとに `src/jev` が状況を圧縮し (ポジション、完成役、ドロー、正確なハンド強度とエクイティ、ポットオッズ、BB 換算スタック、今ハンドのアクション)、文章を一切含まない閉じた語彙の構造 — 列挙値・数値・カード表記だけ — に変えて、このサイト自身の Worker にだけ送る。
3. Worker (`src/worker/decide.ts`) はリクエストに乗らない部分を組み立て直す: 御霊の人格文 (`src/characters/spirits.ts` から) と、`@jev-poker/agent` の `buildQuestions` が構造から導く 3 つの型付き質問 (`action`、`sizing`、`bluff_intent`)。ライブラリ自身が組む自由文の 2 項目 (`task`、`importantContext`) は `src/worker/prose-allowlist.json` と一字一句一致したときだけ通す。
4. Worker は組み立てたリクエストを運営のキーで Jev に転送し、`{ model, action, sizing, bluff_intent }` だけを返す。
5. 人格の「ぶれ」で argmax かサンプリングかが決まり、最後に合法なベット額にクランプされる。
6. Jev に届かない、あるいはその日の運営予算を使い切っていれば check か fold にし、履歴にその理由が出る (卓は「今宵はここまで」で止まる — 「遊ぶ」参照)。

The engine and the CPU are the npm packages `@jev-poker/engine` and `@jev-poker/agent`, developed in https://github.com/nft-syou/jev-poker.

あなたのブラウザは文章を一切送らず、運営のキーを見ることもありません。話す相手はこのサイト自身の
`POST /api/session` と `POST /api/jev/decide` だけで、どちらも 1 つの Cloudflare Worker
(`src/worker/`) が受け持ちます。詳しくは下の「セキュリティ」を参照してください。

## 遊ぶ

1. デプロイ済みのサイトを開く (または下記の手順でローカルで起動する)。
2. タイトル画面: 「開帳」で着席、「見物」で全席御霊の卓を眺める、「設定」で音と言語を変える。
3. 卓を整える: 卓の形 (六人卓、または差し向かい — 差し向かいなら相手の御霊も選ぶ)、続けてレート — 宵 100BB・深更 50BB・蝕 25BB。見物は六人卓だけです。
4. 着席すると見えない Turnstile の判定が入ります。通れば 2 時間その卓にいられます。
5. ハンド履歴の「Jev」を開くと、各 CPU のアクションの裏にある確率が見られます。
6. あなたの IP、またはサイト全体の 1 日の予算を使い切ると、卓は「今宵はここまで」で止まります — 日本時間 0 時に再開します。

## セキュリティ

運営の Jev キーを持つのは Worker だけで、ブラウザには届きません。以下の「IP ごと」は、IPv4 なら
アドレスごと、IPv6 なら /64 ごとです (1 回線に /64 がまるごと割り当てられることが多いため)。

`POST /api/session` は `{ turnstileToken }` を受け取ります。下と同じ瞬間流量の制限 (429 `slow_down`)
を通ったあと、Cloudflare の siteverify にトークンを問い合わせ、通らなければ 403 `turnstile_failed`
を返します。

`POST /api/jev/decide` は毎回、次の順で検査し、最初に落ちたところで返します。

1. **通行証** — `Authorization: Bearer <token>`。Turnstile を通った後に `/api/session` が発行する HMAC-SHA256 の署名付きトークンで、有効 2 時間、呼び出し元の IP に紐づきます。壊れている・期限切れ・IP が違えば 401 `session_expired`。
2. **形** — 本文は 16KB 以下の JSON で、閉じた語彙のスキーマ (`src/worker/schema.ts`) に合うこと: 列挙値は決まった一覧から、数値は範囲内、カード表記は正規表現に合致、配列は長さに上限、未知のキーは拒否。合わなければ 400 `bad_request`。
3. **瞬間流量** — IP ごと 10 秒に 20 回 (`JEV_BURST`、Cloudflare のレート制限バインディング)。超えたら 429 `slow_down` (`retry-after: 2`)。
4. **1 日の予算** — Durable Object (`JEV_BUDGET`) が IP ごとと全体の回数を数え、日本時間 0 時にリセットします (既定 `DAILY_CALLS_PER_PLAYER=600`、`DAILY_CALLS_TOTAL=20000`)。どちらかを超えると 429 `tonight_is_over` (`{ resumesAt }`)。
5. **上流** — Worker が実際の Jev リクエストを自分で組み立てます (「仕組み」参照)。ブラウザの JSON がそのまま Jev に届くことはありません。呼び先は運営の `JEV_ROUTE` が選ぶ 4 つの固定ホストのどれかで、ブラウザから来た URL は使いません (`src/worker/upstream.ts`)。上流の 402 (運営のクレジット切れ) は 429 `tonight_is_over` に、401/403 (キーの問題) はプレイヤーのせいにせず 503 `unavailable` に、それ以外の失敗は 502 `upstream_error` になります。

`/api/session` と `/api/jev/decide` 以外のパスはすべて 404 `not_found`、`POST` 以外は 405
`method_not_allowed` です。本番で `TURNSTILE_SECRET` か `SESSION_SECRET` が無ければ Worker は
すべてのリクエストに 503 `unavailable` を返し、開いたまま動くことはありません (Vite の開発サーバー
だけが `DEV_OPEN=1` でこれを飛ばします)。脆弱性の報告は [SECURITY.md](SECURITY.md) を参照してください。

## ローカルで動かす

Node.js 24 と pnpm が必要です。

    pnpm install
    JEV_API_KEY=sk-... pnpm dev   # Vite の開発サーバー。/api/* は Worker と同じハンドラで動き、
                                   # 予算はメモリ上、Turnstile はスキップ (DEV_OPEN)
    pnpm dev:worker                # ビルド + `wrangler dev`: 本物の Worker・Durable Object・
                                    # レート制限。下記のシークレットが必要
    pnpm check                     # lint + 型チェック + テスト + ビルド

`pnpm dev:worker` はプロジェクト直下の `.dev.vars` からシークレットと変数を読みます —
**Git 管理外なので、絶対にコミットしないでください**。

    JEV_API_KEY=sk-...
    JEV_ROUTE=typesafe
    JEV_MODEL=jev-latest
    TURNSTILE_SECRET=1x0000000000000000000000000000000AA
    SESSION_SECRET=<任意のランダムな文字列。例: `openssl rand -base64 32`>

上の `TURNSTILE_SECRET` は Cloudflare が公開している「必ず通る」テスト用シークレットのひとつです。
対応するテスト用サイトキーをビルド前に `VITE_TURNSTILE_SITE_KEY` として設定すれば、
`pnpm dev:worker` は本物のウィジェットなしで最後まで動きます。現行のペアは
[developers.cloudflare.com/turnstile/troubleshooting/testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
を参照してください。本番サイトの鍵をローカルで使い回さないでください。

`.node-version` は、それを読むツール向けに Node 24 を固定しています。

## Cloudflare Workers へデプロイ

公開インスタンスは Cloudflare Workers Builds により `main` から自動デプロイされます。自分の運営として
動かす場合:

1. このリポジトリを GitHub にフォークまたはプッシュする。
2. Cloudflare ダッシュボード → Turnstile → ウィジェットを作成する。モードは「Invisible」、ホスト名は
   公開ドメインのみ。サイトキーとシークレットを控える。ローカル開発では、確認していない
   鍵を使い回さず、Cloudflare が公開しているテスト用の鍵のペアを使ってください —
   [developers.cloudflare.com/turnstile/troubleshooting/testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)。
3. 3 つのシークレットを設定する。

       wrangler secret put JEV_API_KEY
       wrangler secret put TURNSTILE_SECRET
       wrangler secret put SESSION_SECRET

   `SESSION_SECRET` はセッショントークンに署名する HMAC 鍵です — 例えば `openssl rand -base64 32`
   で生成してください。
4. `wrangler.jsonc` の `vars` に `JEV_ROUTE` (`typesafe` / `vercel` / `lolipop` / `cloudflare`) と
   `JEV_MODEL` を設定し、既定値 (`DAILY_CALLS_PER_PLAYER` / `DAILY_CALLS_TOTAL` = 日本時間の 1 日
   あたり 600 / 20000) が合わなければ調整する。Cloudflare AI Gateway 経由なら `JEV_CF_ACCOUNT`・
   `JEV_CF_GATEWAY`・`JEV_CF_PROVIDER` も必要です — **`custom-` 接頭辞を付けない slug 単体**を
   入れること。`custom-…` を入れると、すべての判断が 503 `unavailable` になります。
5. Cloudflare ダッシュボード → Workers & Pages → Create → Workers Builds でこのリポジトリの Git を
   連携する。ビルドコマンドは `pnpm build`、デプロイコマンドは `wrangler deploy`。
6. `VITE_TURNSTILE_SITE_KEY` (手順 2 の公開サイトキー。シークレットではありませんが、Vite が埋め込む
   にはビルド時に存在している必要があります) を Workers Builds の **ビルド変数** として追加する。
7. Worker に独自ドメインを割り当て、`index.html` の canonical と Open Graph の URL をそのドメインに
   差し替える。
8. 最初のデプロイの後、自分で 1 ハンド遊んでみる。鍵の入力を求められずに卓が開くこと、そして
   Turnstile が対話的な判定を出す場合は、それが画面中央に見え、答えられることを確認する。

任意の環境変数 `TYPESAFE_BASE_URL` は `typesafe` 経路の上流 API ルートだけを上書きします
(ゲートウェイのホストはコード内の定数です)。`https://…` (ローカル作業なら `http://localhost…`)
の形のときだけ使われ、それ以外は既定値に戻ります。

## 素材と声

- 顔アイコン・立ち絵・必殺カットインの決め絵は公式の二次創作資料と素材蔵から `public/kitan/` に取り込んだものです。カットインはアニメ webp から決め絵を 1 枚抜き、動きはこちらの演出で付けています。
  出典と加工は `scripts/kitan-assets.json`、再現は `pnpm assets:kitan`。権利は原作にあり、このリポジトリの
  MIT ライセンスの対象ではありません ([public/kitan/README.md](public/kitan/README.md))。
- 声は公式の声見本に添えられた設計 (caption と seed) を
  [Irodori-TTS](https://github.com/Aratako/Irodori-TTS) の VoiceDesign モデルに渡して生成した mp3 です。
  台本を直したら [scripts/voice/README.md](scripts/voice/README.md) の手順で該当行だけ作り直せます。
- BGM と効果音は宵闇素材庫 (<https://vibe.co.jp/yoiyami/>) の CC0 素材です。卓に流れるのは
  「琴と遠い風鈴」ひとつ、効果音は配札・勾玉・カットインなど数種だけ。公式のトンマナ
  「静寂が地」に合わせて鳴らしすぎないようにしています。
- デザインは公式のトンマナ「宵闇に金」に揃えています (宵闇藍の地、金は線と粒、蝕紅は警告と高揚だけ)。

## 構成

    src/engine/       ポーカーエンジン (配札・ベッティング・サイドポット・役判定)、依存ゼロ
    src/characters/   御霊のデータ、台本、声の再生
    src/jev/          アプリ専用: セッション/Turnstile クライアントと Worker 経由の CPU 判断バックエンド
    src/worker/       Cloudflare Worker: 静的配信、/api/session、/api/jev/decide、予算の Durable Object
    src/ui/        React UI、ゲームループ、Jev の確率付き履歴、吹き出しとカットイン
    src/i18n/      en / ja 辞書
    src/proxy/     開発サーバーのリクエスト/レスポンスアダプタ (`pnpm dev` が使う)
    public/kitan/  公式素材 (画像・動画) と生成した声
    scripts/       素材の取り込み、声の生成、文の許可リスト生成
    docs/superpowers/specs/  設計書

## 今後

- トーナメント形式: `BlindSchedule` がブラインドを抽象化済み。`format` が `tournament` のときは飛んだ席をリバイしない。
- 質問セットのバージョンを各判断に記録する。

## コントリビュート

バグ報告、機能要望、プルリクエストを歓迎します。ビルドとテストの方法は
[CONTRIBUTING.md](CONTRIBUTING.md)、行動規範は [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)、
変更履歴は [CHANGELOG.md](CHANGELOG.md) を参照してください (いずれも英語)。

## ライセンス

コードは MIT — [`LICENSE`](LICENSE) を参照。

`public/kitan/` の素材には **MIT は適用されません**。条件は
[`public/kitan/LICENSE`](public/kitan/LICENSE) にまとめてあります。画像と声は『月蝕綺譚』の
二次創作素材で、掟の範囲でこのゲームが使うために同梱しています (素材集としての転載・再配布は
不可)。`public/kitan/sound/` の BGM と効果音だけは宵闇素材庫の CC0 です。
