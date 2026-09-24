# 宵闇の賭場 — 月蝕綺譚 二次創作ポーカー

[![CI](https://github.com/nft-syou/luna-occulta-poker/actions/workflows/ci.yml/badge.svg)](https://github.com/nft-syou/luna-occulta-poker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Deploys to Cloudflare Workers](https://img.shields.io/badge/deploys%20to-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](#デプロイ)

**[yoiyami.syou.io](https://yoiyami.syou.io/) で遊べます** — キーもアカウントも不要。サイトを開いて座るだけです。

**English version: [README.md](README.md)**

> 本作は『月蝕綺譚 -Luna Occulta-』(CryptoNinja 外伝) の**非公式二次創作**です。公式とは関係ありません。
> [二次創作の掟](https://vibe.co.jp/luna-occulta/fanworks) と
> [CryptoNinja 利用ガイドライン](https://www.ninja-dao.com/guidelines) の範囲で作っています。 #月蝕綺譚

喰われた月の下、漆の卓で御霊たちと勾玉を賭けるノーリミット・テキサスホールデム。
あなたは「あるじどの」として卓に着き、相手は公式設定から性格を写した 5 人の御霊です。
御霊たちは声でセリフを語り、席には公式の顔が並び、オールインや大勝ち、飛んだ瞬間には
カットインが入ります。全席御霊の卓を眺める見物もできます。

## 遊び方

1. 「開帳」で着席、「見物」で全席御霊の卓を眺める、「設定」で音と言語を変える。
2. 卓を選ぶ — 六人卓、または差し向かい (相手の御霊を 1 人選ぶ)。続けてレート — 宵 100BB・深更 50BB・蝕 25BB。
3. 局の記録の「読み」を開くと、御霊がその一手で何を量っていたかが見られます。
4. サイトには 1 日の予算があります。使い切ると卓は「今宵はここまで」で閉じ、日本時間 0 時にまた開きます。

## 御霊たち

| 御霊 | 所属 | 公式の芯 | 卓での打ち方 |
| --- | --- | --- | --- |
| 咲耶 | 甲賀・火 | 快活な姉御。嘘がつけず顔に出る | 強い手は正面から。ブラフはほぼしない。**ブラフの時だけセリフが変わる** (テル) |
| マミ | 雑賀・木 | 化かすのは嘘でなく夢を見せる | ブラフとセミブラフが多く、数で押す |
| タルト | 甲賀・水 | 急がば、まわれ〜 | 参加は少なく待つ。コール中心、大きい手だけレイズ |
| 孫市 | 雑賀・火 | 外したことは一度もねぇ | 入ったらバリューで大きく打ち、取り切る |
| 蛇ノ目 | 風魔・木 | のんびりで致命的にズレる | ルースで読めない。時々とんでもない手で突っ込む |
| あるじどの | — | 語らず、名乗らず | あなたの席。見物では語らない御霊として座る |

性格の文章は `src/characters/spirits.ts`、セリフは `src/characters/lines.ts` にあります。

## 仕組み

御霊たちの一手は [TypeSafe Jev](https://typesafe.ai) が考えます。ポーカーのエンジンと CPU は
[jev-poker](https://github.com/nft-syou/jev-poker) のもの (`@jev-poker/engine` と
`@jev-poker/agent` を npm からそのまま使用) で、このリポジトリはその周りのゲーム —
見た目、キャラクター、声、そして 1 つの Cloudflare Worker — です。

ブラウザはキーを持ちません。判断のたびに局面の形 (列挙値・数値・カード表記だけで、文章は
一切含まない) を Worker に送り、Worker が御霊の人格と質問を自分で組み立て直して、運営のキーで
Jev を呼び、答えだけを返します。通行証は見えない Turnstile の判定で発行され、瞬間流量の制限と
1 日の予算でキーの使用量に上限をかけています。検査の全容は [SECURITY.md](SECURITY.md) にあります。

## ローカルで動かす

Node.js 24 と pnpm 12 が必要です。

    pnpm install
    JEV_API_KEY=sk-... pnpm dev                     # アプリ本体。/api は Worker と同じハンドラ
    pnpm check                                      # lint + 型チェック + テスト + ビルド

`pnpm dev` は Turnstile を飛ばし、予算はメモリ上で数えます。本物の Worker・Durable Object・
レート制限で動かすときは、Git 管理外の `.dev.vars` にシークレットを書いて `pnpm dev:worker` を使います。

    JEV_API_KEY=sk-...
    JEV_ROUTE=typesafe
    TURNSTILE_SECRET=<Cloudflare のテスト用シークレット>
    SESSION_SECRET=<openssl rand -base64 32>

ビルド時は、対応するテスト用サイトキーを `VITE_TURNSTILE_SITE_KEY` に入れてください。テスト用の
鍵のペアは [developers.cloudflare.com/turnstile/troubleshooting/testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
にあります。

## デプロイ

公開サイトは Cloudflare Workers Builds で `main` から自動デプロイされます。自分で運営する場合:

1. **Turnstile** — Cloudflare ダッシュボードでウィジェットを作る。モードは「Invisible」、ホスト名は公開ドメイン。
2. **シークレット** —

       wrangler secret put JEV_API_KEY
       wrangler secret put TURNSTILE_SECRET
       wrangler secret put SESSION_SECRET    # 例: openssl rand -base64 32

3. **設定** — `wrangler.jsonc` の `routes` を自分のドメインに、`vars` の `JEV_ROUTE`
   (`typesafe` / `vercel` / `lolipop` / `cloudflare`)・`JEV_MODEL`・1 日の上限
   `DAILY_CALLS_PER_PLAYER` / `DAILY_CALLS_TOTAL` (600 / 20000) を設定する。`cloudflare` 経路では
   `JEV_CF_ACCOUNT`・`JEV_CF_GATEWAY`・`JEV_CF_PROVIDER` も必要 (`custom-` 接頭辞を付けない slug 単体)。
   `index.html` の canonical と Open Graph の URL も自分のドメインに差し替える。
4. **Workers Builds** — リポジトリを Worker に連携し (ビルドコマンド `pnpm build`、デプロイコマンド
   `npx wrangler deploy`)、ビルド変数を 2 つ追加する: `VITE_TURNSTILE_SITE_KEY` (ウィジェットの
   サイトキー。ビルド時に埋め込まれる) と `PNPM_VERSION=12.4.2` (ビルド環境の既定の pnpm は古いため)。
5. **確認** — 最初のデプロイの後、自分で卓に着いてみる。

## 素材と声

- 顔アイコン・立ち絵・必殺カットインの決め絵は公式の二次創作資料から `public/kitan/` に取り込んだものです
  (カットインは公式アニメから決め絵を 1 枚抜き、動きはこちらの演出)。出典と加工は
  `scripts/kitan-assets.json`、再現は `pnpm assets:kitan`。
- 声は公式の声見本に添えられた caption と seed を [Irodori-TTS](https://github.com/Aratako/Irodori-TTS)
  に渡して生成しています — [scripts/voice/README.md](scripts/voice/README.md) を参照。
- BGM と効果音は宵闇素材庫 (<https://vibe.co.jp/yoiyami/>) の CC0 素材です。
- デザインは公式のトンマナ「宵闇に金」に揃えています (宵闇藍の地、金は線と粒、蝕紅は警告と高揚だけ)。

## 構成

    src/ui/           画面、卓、ゲームループ、吹き出し、カットイン、開帳の演出
    src/characters/   御霊のデータ、セリフ、声と効果音の再生
    src/jev/          判断のブラウザ側: 通行証、Turnstile、Worker 経由の CPU
    src/worker/       Cloudflare Worker: /api/session、/api/jev/decide、1 日の予算
    src/i18n/         ja / en 辞書
    public/kitan/     公式素材、生成した声、BGM
    scripts/          素材の取り込み、声の生成、アイコンとシェア画像、文の許可リスト

## コントリビュート

Issue とプルリクエストを歓迎します — [CONTRIBUTING.md](CONTRIBUTING.md) と
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) を参照してください。変更履歴は [CHANGELOG.md](CHANGELOG.md) にあります (いずれも英語)。

## ライセンス

コードは MIT — [`LICENSE`](LICENSE) を参照。

`public/kitan/` の素材には **MIT は適用されません**。条件は [`public/kitan/LICENSE`](public/kitan/LICENSE)
にあります。画像と声は『月蝕綺譚』の二次創作素材で、掟の範囲でこのゲームが使うために同梱しています
(素材集としての転載・再配布は不可)。`public/kitan/sound/` の BGM と効果音だけは宵闇素材庫の CC0 です。
