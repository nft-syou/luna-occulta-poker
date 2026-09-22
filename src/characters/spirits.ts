import type { LocalizedText, Persona } from "@jev-poker/agent";

/**
 * The 御霊 who sit at this table, and あるじどの.
 *
 * Every fact here is the public canon from the official fan-work sheets (kitan-lore MCP,
 * `get_spirit`): name, clan and element, the catch copy, the way each one speaks. The poker
 * personality is *derived* from that canon — 咲耶 cannot lie so she cannot bluff, タルト's
 * motto is 急がば回れ so she waits — and never from a poker archetype.
 */
export type SpiritId = "arujidono" | "sakuya" | "mami" | "tart" | "magoichi" | "janome";

/** The five who speak: everyone but あるじどの, who has no lines by canon. */
export type CpuSpiritId = Exclude<SpiritId, "arujidono">;

export interface SpiritVoice {
  /** Irodori-TTS VoiceDesign caption, as published with the official voice sample. */
  readonly caption: string;
  /** Irodori-TTS seed, as published with the official voice sample. */
  readonly seed: number;
}

export interface Spirit {
  readonly id: SpiritId;
  readonly name: LocalizedText;
  readonly kana: string;
  /** Clan and element: "甲賀・火". */
  readonly tagline: LocalizedText;
  /** The official catch copy (ja) and a plain rendering of it (en). */
  readonly copy: LocalizedText;
  /** How they talk, for whoever writes lines: first person, address, tone. Japanese. */
  readonly speech: {
    readonly firstPerson: string;
    readonly address: string;
    readonly tone: string;
  };
  /** What Jev is told about this player. `id` matches the spirit's. */
  readonly persona: Persona;
  /** True for あるじどの: no lines, no voice, no cut-in — "所作だけで語る". */
  readonly silent: boolean;
  /** True for 咲耶: her lines give her bluffs away, because canon says her face does. */
  readonly tell: boolean;
  /** Face icon at the seat (256px webp, transparent or looped). */
  readonly icon: string;
  /** Standing canon art; the cut-in's still under reduced motion. */
  readonly canon: string;
  /** The showcase video used as the cut-in; null for a silent spirit. */
  readonly showcase: string | null;
  readonly voice: SpiritVoice | null;
}

const ASSETS = "/kitan";

function persona(
  id: SpiritId,
  name: LocalizedText,
  description: LocalizedText,
  variance: number,
): Persona {
  return { id, name, description, variance, isPreset: true };
}

export const SPIRITS: readonly Spirit[] = [
  {
    id: "arujidono",
    name: { ja: "あるじどの", en: "Arujidono" },
    kana: "あるじどの",
    tagline: { ja: "境を守った一族の、生き残り", en: "Last of the line that kept the border" },
    copy: {
      ja: "語らず、名乗らず、笠の下の顔は誰も知らない。御霊を式札に宿し、鬼を討つ。",
      en: "Speaks no word, gives no name; no one has seen the face under the hat. Binds spirits to cards and hunts demons.",
    },
    speech: {
      firstPerson: "なし(語らない)",
      address: "誰からも「あるじどの」と呼ばれる",
      tone: "セリフも独白も持たない。笠に手を添える、一礼する——所作だけで語る。",
    },
    persona: persona(
      "arujidono",
      { ja: "あるじどの", en: "Arujidono" },
      {
        en: "Silent, composed and disciplined. Plays a tight range of strong hands, bets them for value, continuation-bets when the board favours the raiser, and folds marginal hands to real pressure. Reads the table and gives nothing away.",
        ja: "語らず、静かで堅実。強いハンドだけを狭く選び、バリューで打つ。CB は場が味方する時に。微妙なハンドは本気の圧力には降りる。卓を読み、何も漏らさない。",
      },
      0.15,
    ),
    silent: true,
    tell: false,
    icon: `${ASSETS}/icon/arujidono.webp`,
    canon: `${ASSETS}/canon/arujidono.webp`,
    showcase: null,
    voice: null,
  },
  {
    id: "sakuya",
    name: { ja: "咲耶", en: "Sakuya" },
    kana: "さくや",
    tagline: { ja: "甲賀・火", en: "Koga · Fire" },
    copy: {
      ja: "緋桜を纏う甲賀の剣士。ひと太刀ごとに、夜へ春が散る。",
      en: "A Koga swordswoman wrapped in scarlet blossom. With every stroke, spring scatters into the night.",
    },
    speech: {
      firstPerson: "あたし",
      address: "あんた",
      tone: "快活で自信家の姉御肌。「〜だよ」「〜でしょ」。嘘がつけない性分で、すぐ顔に出る。",
    },
    persona: persona(
      "sakuya",
      { ja: "咲耶", en: "Sakuya" },
      {
        en: "Bright, confident and straightforward, and constitutionally unable to lie: she almost never bluffs, and when she bets or raises she has it. Plays her strong hands hard and fast for value, calls to see a flop with playable hands, and folds cleanly and without fuss when she is beaten. What you see is what she has.",
        ja: "快活で自信家、そして嘘がつけない。ブラフはほぼしない。ベットやレイズをする時は本当に持っている。強い手は正面から速く殴ってバリューを取り、遊べる手ならフロップを見に行き、負けていれば潔く降りる。見たままが手だ。",
      },
      0.3,
    ),
    silent: false,
    tell: true,
    icon: `${ASSETS}/icon/sakuya.webp`,
    canon: `${ASSETS}/canon/sakuya.webp`,
    showcase: `${ASSETS}/showcase/sakuya.mp4`,
    voice: {
      caption:
        "若い女性の澄んだ声。まっすぐで芯があり、明るく前向きなトーンでハキハキと話している。",
      seed: 35,
    },
  },
  {
    id: "mami",
    name: { ja: "マミ", en: "Mami" },
    kana: "まみ",
    tagline: { ja: "雑賀・木", en: "Saika · Wood" },
    copy: {
      ja: "雑賀の化け狸ギャル。桜の扇をひとふりすれば、姿かたちは思いのまま。狐七化け、狸八化け——ほんとの顔は、八つ数えたその先に。",
      en: "Saika's shape-shifting tanuki girl. One sweep of her cherry fan and she is whoever she likes. A fox has seven guises, a tanuki eight; her real face waits past the eighth.",
    },
    speech: {
      firstPerson: "あたし",
      address: "あるじどの",
      tone: "ギャル語ベースの軽口「〜っしょ」「〜なんだけど〜？」。決めどころだけ古風に落ちる。化かすのは嘘ではなく「夢を見せる」が芯。",
    },
    persona: persona(
      "mami",
      { ja: "マミ", en: "Mami" },
      {
        en: "A shape-shifter who wins by showing people a dream. Bluffs and semi-bluffs often, represents hands she does not have, and leans on position and repeated pressure — 'winning on numbers'. Plays a wide range, attacks weakness, and steals blinds and orphaned pots. Still lets go when someone clearly has the goods.",
        ja: "夢を見せて勝つ化け狸。ブラフとセミブラフが多く、持っていない手を演じ、ポジションと回数で圧をかける——「数で勝つ」。広いレンジで参加し、弱さを攻め、ブラインドや誰のものでもないポットを盗む。相手が明らかに持っている時は手放す。",
      },
      0.6,
    ),
    silent: false,
    tell: false,
    icon: `${ASSETS}/icon/mami.webp`,
    canon: `${ASSETS}/canon/mami.webp`,
    showcase: `${ASSETS}/showcase/mami.mp4`,
    voice: {
      caption:
        "若い女性のゆったりした柔らかい声。のほほんとした余裕のある調子で、面白そうに話している。発音は明瞭で、クリアな音質。",
      seed: 44,
    },
  },
  {
    id: "tart",
    name: { ja: "タルト", en: "Tart" },
    kana: "たると",
    tagline: { ja: "甲賀・水", en: "Koga · Water" },
    copy: {
      ja: "咲耶の相棒にして、竜宮の守り神さま。「様」はくすぐったい——咲耶の前ではただの、のんびり女子。口ぐせは「急がば、まわれ〜」。",
      en: "Sakuya's partner and the guardian of the Dragon Palace. 'Lady' makes her squirm; around Sakuya she is just an easygoing girl. Her motto: the long way round is the quick way.",
    },
    speech: {
      firstPerson: "タルト(自分の名前)",
      address: "あなた(親友の咲耶だけ「咲耶ちゃん」)",
      tone: "ゆったり伸ばす「〜だよ〜」「〜ねえ」。ひらがな多め・急がない。決めことばは「急がば、まわれ〜」。",
    },
    persona: persona(
      "tart",
      { ja: "タルト", en: "Tart" },
      {
        en: "Unhurried and patient — 'the long way round is the quick way'. Enters few pots and waits for the hand to come to her. Prefers calling to raising, protects what she has, and only raises big when she holds a very strong made hand. Never chases, never forces it, never bluffs.",
        ja: "急がない、待つ——「急がば、まわれ〜」。参加するポットは少なく、手が来るのを待つ。レイズよりコールを好み、持っているものを守り、大きくレイズするのは本当に強い完成役の時だけ。追わない、無理をしない、ブラフはしない。",
      },
      0.25,
    ),
    silent: false,
    tell: false,
    icon: `${ASSETS}/icon/tart.webp`,
    canon: `${ASSETS}/canon/tart.webp`,
    showcase: `${ASSETS}/showcase/tart.mp4`,
    voice: {
      caption:
        "若い女性の落ち着いたあたたかい声。ふところ深く、微笑むようにゆっくり話している。発音は明瞭で、クリアな音質。",
      seed: 22,
    },
  },
  {
    id: "magoichi",
    name: { ja: "孫市", en: "Magoichi" },
    kana: "まごいち",
    tagline: { ja: "雑賀・火", en: "Saika · Fire" },
    copy: {
      ja: "雑賀の首領、その正体はキセルをくわえた海の女傑。船の上で潮目を読む。二丁の銃に決め口上——外したことは、一度もねぇ。",
      en: "Chief of Saika: a sea captain with a pipe in her teeth who reads the tide from her deck. Two guns and one boast — she has never once missed.",
    },
    speech: {
      firstPerson: "アタシ",
      address: "あんた",
      tone: "べらんめえ+海の言い回しの姐御口調。決め所の口癖は「外したことは一度もねぇ」(乱発しない)。",
    },
    persona: persona(
      "magoichi",
      { ja: "孫市", en: "Magoichi" },
      {
        en: "A captain who reads the tide and has never missed a shot. Selective about which pots she enters, but once in she is aggressive: bets and raises for value, sizes big, and takes the whole pot rather than a piece of it. Applies pressure with position and does not back down from a fight she started. Folds when the tide has clearly turned.",
        ja: "潮目を読み、外したことのない船長。入るポットは選ぶが、入ったら攻める。バリューでベット・レイズし、大きく打ち、ポットを丸ごと取りに行く。ポジションで圧をかけ、自分が始めた戦いからは引かない。潮目が明らかに変わった時は降りる。",
      },
      0.4,
    ),
    silent: false,
    tell: false,
    icon: `${ASSETS}/icon/magoichi.webp`,
    canon: `${ASSETS}/canon/magoichi.webp`,
    showcase: `${ASSETS}/showcase/magoichi.mp4`,
    voice: {
      caption:
        "伝法な口調の大人の女性の低めの声。歯切れよく、威勢のいい調子で話している。発音は明瞭で、クリアな音質。",
      seed: 11,
    },
  },
  {
    id: "janome",
    name: { ja: "蛇ノ目", en: "Janome" },
    kana: "じゃのめ",
    tagline: { ja: "風魔・木", en: "Fuma · Wood" },
    copy: {
      ja: "風魔の毒使い。のんびりマイペースで、たまに致命的にズレている。愛用の蛇の目傘『白露』は、傘に見えて実は毒の仕込み刀。",
      en: "Fuma's poisoner. Easygoing, on her own clock, and now and then fatally off-beat. Her beloved umbrella Shiratsuyu is a poisoned blade in disguise.",
    },
    speech: {
      firstPerson: "わたし",
      address: "(名指しせず、そのまま話しかける)",
      tone: "のんびりひらがな多めの天然。「〜だよ」「〜もん」。オロチへの全幅の信頼だけは揺るがない。",
    },
    persona: persona(
      "janome",
      { ja: "蛇ノ目", en: "Janome" },
      {
        en: "Easygoing, on her own clock and occasionally, fatally, off. Loose and hard to read: plays many hands because they look fun, calls to see what happens, and every so often shoves or raises big with a hand nobody would expect. Not aggressive by plan — the wild moments simply happen. Sometimes folds a good hand because she lost interest.",
        ja: "のんびりマイペース、たまに致命的にズレる。ルースで読めない。楽しそうだからと多くの手で参加し、何が起きるか見たくてコールし、時々誰も予想しない手でオールインや大きなレイズをする。計画的な攻めではなく、ズレた瞬間がただ起きる。飽きて良い手を降りることもある。",
      },
      0.85,
    ),
    silent: false,
    tell: false,
    icon: `${ASSETS}/icon/janome.webp`,
    canon: `${ASSETS}/canon/janome.webp`,
    showcase: `${ASSETS}/showcase/janome.mp4`,
    voice: {
      caption:
        "まったりした女の子ののどかな声。急がずゆったりと、うれしそうに話している。クリアで聞き取りやすい音質。",
      seed: 22,
    },
  },
];

export const CPU_SPIRIT_IDS: readonly CpuSpiritId[] = [
  "sakuya",
  "mami",
  "tart",
  "magoichi",
  "janome",
];

export const SPIRIT_IDS: readonly SpiritId[] = SPIRITS.map((s) => s.id);

const BY_ID = new Map<string, Spirit>(SPIRITS.map((s) => [s.id, s]));

export function isSpiritId(value: unknown): value is SpiritId {
  return typeof value === "string" && BY_ID.has(value);
}

export function spiritById(id: string): Spirit | undefined {
  return BY_ID.get(id);
}

/** The spirit for an id that must exist; a bad id is a programming error. */
export function spirit(id: SpiritId): Spirit {
  const found = BY_ID.get(id);
  if (found === undefined) throw new Error(`unknown spirit ${id}`);
  return found;
}

/** What `useGame` is handed: one persona per spirit, ids matching. */
export function spiritPersonas(): Persona[] {
  return SPIRITS.map((s) => s.persona);
}
