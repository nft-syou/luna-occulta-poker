import { type CpuSpiritId, type SpiritId, spiritById } from "./spirits";

/**
 * The script: what each 御霊 says at the table.
 *
 * Every line follows the official voice sheet (first person, address, tone) from kitan-lore
 * `get_spirit`. Lines are the single source of truth for the audio too: `scripts/voice`
 * reads this file, synthesises `tts ?? text` with Irodori-TTS, and writes one mp3 per id.
 * Change a line and its id keeps the clip in step; add a line and only it is generated.
 */
export type Situation =
  | "greet"
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "allin"
  | "win"
  | "bigwin"
  | "lose"
  | "bust";

export const SITUATIONS: readonly Situation[] = [
  "greet",
  "fold",
  "check",
  "call",
  "bet",
  "raise",
  "allin",
  "win",
  "bigwin",
  "lose",
  "bust",
];

export interface SpeechLine {
  /** `<spirit>.<situation>.<n>`, stable: it names the audio file. */
  readonly id: string;
  /** What the bubble shows. */
  readonly text: string;
  /** What the voice reads, when a kanji needs its kana or a pause needs marking. */
  readonly tts?: string;
  /** 咲耶 only: a line that gives the bluff away. Chosen only while she is bluffing. */
  readonly bluff?: boolean;
}

type Script = Readonly<Record<Situation, readonly SpeechLine[]>>;

/** Stamps ids onto a spirit's lines: `sakuya.raise.1`, `sakuya.raise.2`, … */
function script(
  spirit: CpuSpiritId,
  lines: Readonly<Record<Situation, readonly Omit<SpeechLine, "id">[]>>,
): Script {
  const out = {} as Record<Situation, SpeechLine[]>;
  for (const situation of SITUATIONS) {
    out[situation] = lines[situation].map((line, i) => ({
      ...line,
      id: `${spirit}.${situation}.${i + 1}`,
    }));
  }
  return out;
}

export const LINES: Readonly<Record<CpuSpiritId, Script>> = {
  // 咲耶 — あたし / あんた。快活で自信家。嘘がつけず、すぐ顔に出る。
  sakuya: script("sakuya", {
    greet: [
      { text: "あんたの顔見ると、調子出るんだよね" },
      { text: "さ、始めよっか。手加減はなしだよ" },
    ],
    fold: [{ text: "これは、ないね。降りる" }, { text: "無理は好きじゃない。次だ、次" }],
    check: [{ text: "様子見。あんたの番だよ" }, { text: "今は動かない" }],
    call: [{ text: "乗った。見せてもらうよ" }, { text: "コール。逃げないよ" }],
    bet: [
      { text: "来てる。ベットだ" },
      { text: "ここは行く。文句ある？" },
      { text: "……べ、ベット。……何よ、その目", bluff: true },
      { text: "あー、えっと、ベットで。……顔、見んな", bluff: true },
    ],
    raise: [
      { text: "レイズ。あたしの番だ" },
      { text: "上げるよ。覚悟しな" },
      { text: "れ、レイズ……。顔に出てる？ 出てないでしょ", bluff: true },
      { text: "上げる！ ……たぶん、大丈夫", bluff: true },
    ],
    allin: [
      { text: "全部だ。あたしは嘘つかない" },
      { text: "オールイン。刀と一緒、ひと太刀で決める" },
    ],
    win: [{ text: "ほらね。言ったでしょ" }, { text: "もらった。悪いね" }],
    bigwin: [
      { text: "ひと太刀で、夜に春が散る。……ごちそうさま" },
      { text: "これが甲賀の剣だよ！", tts: "これが、こうがの剣だよ！" },
    ],
    lose: [{ text: "くっ……今回はあんたの勝ち" }, { text: "……顔に、出てた？" }],
    bust: [{ text: "負けた……。刀の手入れしてくる" }, { text: "完敗。でも、次は取り返すからね" }],
  }),

  // マミ — あたし / あるじどの。ギャル語の軽口、決めどころだけ古風。化かすのは夢を見せること。
  mami: script("mami", {
    greet: [
      { text: "あるじどの、やっほ〜。今日は化かされてくれる？" },
      {
        text: "狸八化け、今夜はどの顔で行こっかな〜",
        tts: "たぬきやばけ、今夜はどの顔で行こっかな〜",
      },
    ],
    fold: [{ text: "なしなし。この手は捨てちゃお" }, { text: "化けるまでもないっしょ" }],
    check: [{ text: "ん〜、パス。様子見〜" }, { text: "チェック。焦ってないよ？" }],
    call: [{ text: "はいはい、コール〜。付き合ったげる" }, { text: "見せて見せて〜" }],
    bet: [{ text: "ベット。夢、見せてあげる" }, { text: "ここ、乗ってくる感じ？" }],
    raise: [
      { text: "レイズ〜。数で勝ってんのよ、こっちは" },
      { text: "上げちゃお。信じる？ 信じない？" },
    ],
    allin: [
      { text: "──猯とは、あたしのこと。全部、賭ける", tts: "まみとは、あたしのこと。全部、賭ける" },
      { text: "オールイン。夢の続き、見たいでしょ？" },
    ],
    win: [{ text: "化かすのはね、嘘つくのとは違うの" }, { text: "はい、いただき〜" }],
    bigwin: [
      {
        text: "狐七化け、狸八化け。ほんとの顔は、まだ見せてないよ",
        tts: "きつねななばけ、たぬきやばけ。ほんとの顔は、まだ見せてないよ",
      },
      { text: "大当たり〜！ 夢、見た？" },
    ],
    lose: [{ text: "うわ、見破られた〜。やるじゃん" }, { text: "今のは、ちょっと化け損ねた〜" }],
    bust: [
      { text: "あちゃ〜、すっからかん。八つ目の顔、出しそびれた" },
      { text: "負けちゃった。また化かしに来るね" },
    ],
  }),

  // タルト — タルト / あなた。ゆったり伸ばす、ひらがな多め。急がば、まわれ〜。
  tart: script("tart", {
    greet: [
      {
        text: "タルトだよ〜。『様』は、いらないからね〜",
        tts: "タルトだよ〜。さまは、いらないからね〜",
      },
      { text: "ゆっくり、やろうねえ" },
    ],
    fold: [{ text: "これはね〜、やめとくよ〜" }, { text: "急がば、まわれ〜。降りるね" }],
    check: [{ text: "タルトは、まだ、待つよ〜" }, { text: "チェック〜。ゆっくりね" }],
    call: [{ text: "コール〜。ついていくよ〜" }, { text: "うん、見てるよ。ぜんぶ" }],
    bet: [{ text: "ベット、だよ〜。ちゃんと、あるからね" }, { text: "ここはね、行くよ〜" }],
    raise: [
      { text: "レイズだよ〜。……びっくりした？" },
      { text: "あげるね〜。まわり道は、おしまい" },
    ],
    allin: [
      { text: "ぜんぶ、だよ〜。まもりたいもの、まるごと" },
      { text: "オールイン〜。急いだんじゃ、ないよ〜" },
    ],
    win: [{ text: "ゆっくりでもね、ちゃんと勝てるんだよ〜" }, { text: "ありがとね〜" }],
    bigwin: [
      { text: "急がば、まわれ〜。ほらね〜" },
      {
        text: "亀甲の札、六枚〜。まるごと、いただき〜",
        tts: "きっこうのふだ、ろくまい〜。まるごと、いただき〜",
      },
    ],
    lose: [{ text: "あらら〜。負けちゃった〜" }, { text: "うん、今のはあなたの、勝ちだね〜" }],
    bust: [
      {
        text: "からっぽに、なっちゃった〜。竜宮に、帰ろうかな〜",
        tts: "からっぽに、なっちゃった〜。りゅうぐうに、帰ろうかな〜",
      },
      { text: "まけちゃった〜。でもね、また、ゆっくり来るよ〜" },
    ],
  }),

  // 孫市 — アタシ / あんた。べらんめえと海の言い回し。決め口上は乱発しない。
  magoichi: script("magoichi", {
    greet: [
      {
        text: "へえ、あんたが噂の主かい。……いい目をしてる",
        tts: "へえ、あんたが噂のあるじかい。……いい目をしてる",
      },
      { text: "潮目は上々。始めようじゃねぇか", tts: "しおめは上々。始めようじゃねぇか" },
    ],
    fold: [{ text: "この波には乗らねぇ。降りるぜ" }, { text: "引き潮だ。無理はしねぇ" }],
    check: [{ text: "様子見だ。あんたの番だよ" }, { text: "チェック。波待ちさ" }],
    call: [{ text: "コールだ。付き合ってやるよ" }, { text: "乗った。見せてもらおうか" }],
    bet: [{ text: "ベット。潮が来てる" }, { text: "撃つぜ。よく狙ってな" }],
    raise: [{ text: "レイズだ。逃げるなら今だぜ" }, { text: "上げるよ。アタシの船に乗るかい？" }],
    allin: [
      { text: "オールイン。──外したことは、一度もねぇ" },
      { text: "全部だ。船ごと賭けてやる" },
    ],
    win: [
      { text: "ほらな。潮目は読めてた", tts: "ほらな。しおめは読めてた" },
      { text: "いただくぜ" },
    ],
    bigwin: [
      { text: "外したことは、一度もねぇ。……言ったろ？" },
      { text: "大漁だ！ 今夜は宴だぜ！", tts: "たいりょうだ！ 今夜はうたげだぜ！" },
    ],
    lose: [{ text: "ちっ、外したか。……たまにはある" }, { text: "あんたの勝ちだ。悪くねぇ腕だ" }],
    bust: [
      { text: "沈められたか……。まあ、海はまた荒れる" },
      { text: "すっからかんだ。船に戻るよ" },
    ],
  }),

  // 蛇ノ目 — わたし。のんびりひらがな多めの天然。オロチへの信頼だけは揺るがない。
  janome: script("janome", {
    greet: [
      { text: "へへ、きょうもいい毒日和〜", tts: "へへ、きょうもいいどくびより〜" },
      { text: "わたし、ポーカーはよくわかんないけど、がんばるね" },
    ],
    fold: [
      { text: "これは、やめとくね〜" },
      { text: "う〜ん、おりる。オロチがそう言ってる気がする" },
    ],
    check: [{ text: "チェック〜。……あ、いま寝てた" }, { text: "わたしの番？ じゃあ、まってみる" }],
    call: [{ text: "コール〜。どうなるのかな〜" }, { text: "ついてくね〜" }],
    bet: [
      { text: "ベット。……あれ、これで合ってる？" },
      { text: "なんとなく、いけそうな気がするもん" },
    ],
    raise: [
      { text: "レイズ〜。白露、ちょっとだけ抜くね", tts: "レイズ〜。しらつゆ、ちょっとだけ抜くね" },
      { text: "上げちゃった。えへへ" },
    ],
    allin: [
      { text: "ぜんぶ！ だいじょうぶ、オロチがなんとかしてくれるもん" },
      { text: "オールイン〜。……あれ、これ、そういう意味だった？" },
    ],
    win: [{ text: "あれ、勝っちゃった" }, { text: "やった〜。毒、効いた？" }],
    bigwin: [
      { text: "いっぱい、もらっちゃった〜。オロチ、見てた？" },
      { text: "白露のひと振り、だよ〜。……たぶん", tts: "しらつゆのひと振り、だよ〜。……たぶん" },
    ],
    lose: [{ text: "あ〜、負けちゃった。ま、いっか" }, { text: "う〜ん、ズレてたかな〜" }],
    bust: [
      { text: "からっぽ〜。……オロチ、なんとかして〜" },
      { text: "負けちゃった。毒日和なのにな〜", tts: "負けちゃった。どくびよりなのにな〜" },
    ],
  }),
};

/** Every line of every spirit, for the generator and the file check. */
export function allLines(): { spirit: CpuSpiritId; line: SpeechLine }[] {
  const out: { spirit: CpuSpiritId; line: SpeechLine }[] = [];
  for (const spirit of Object.keys(LINES) as CpuSpiritId[]) {
    for (const situation of SITUATIONS) {
      for (const line of LINES[spirit][situation]) out.push({ spirit, line });
    }
  }
  return out;
}

/**
 * One line for the moment, or null when this seat has nothing to say (a human, あるじどの).
 * `roll` in [0, 1) picks among the candidates, so the caller decides how random it is; the
 * effects reducer hands in a hash of its own id to stay pure.
 *
 * A bluffing 咲耶 only ever says a bluff line — that is her tell; nobody else has bluff
 * lines, so for them `bluff` changes nothing.
 */
export function pickLine(
  spiritId: SpiritId | null,
  situation: Situation,
  roll: number,
  bluff = false,
): SpeechLine | null {
  if (spiritId === null) return null;
  const who = spiritById(spiritId);
  if (who === undefined || who.silent) return null;
  const lines = LINES[spiritId as CpuSpiritId][situation];
  const telling = who.tell && bluff;
  const wanted = lines.filter((l) => (l.bluff === true) === telling);
  // A situation with no bluff variant (a fold) falls back to the honest lines.
  const pool = wanted.length > 0 ? wanted : lines.filter((l) => l.bluff !== true);
  if (pool.length === 0) return null;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)));
  return pool[index] ?? null;
}

export function audioPath(spiritId: SpiritId, line: SpeechLine): string {
  return `/kitan/voice/${spiritId}/${line.id}.mp3`;
}

/** A cheap hash of an integer to [0, 1), so a pure reducer can roll without a clock or rng. */
export function rollFrom(n: number): number {
  let x = (n + 0x9e3779b9) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}
