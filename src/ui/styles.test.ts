import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `(?:^|\\})\\s*(?:/\\*[\\s\\S]*?\\*/\\s*)*${escaped}\\s*\\{([^}]*)\\}`,
    "m",
  ).exec(css);
  if (match === null) throw new Error(`no rule for ${selector}`);
  return match[1] ?? "";
}

// jsdom computes no layout, so these guard the two stylesheet facts that were measured in a real
// browser to stop the table from changing width on every action.
describe("layout stability guards", () => {
  it("clips chip flights exactly at the felt", () => {
    // Each flight is a felt-sized box translated by tens of percent. Any clip margin counted as
    // scrollable overflow: a 390px page grew to 400px for a few frames per bet.
    const layer = rule(".fx-layer");
    expect(layer).toMatch(/overflow:\s*clip/);
    expect(layer).not.toMatch(/overflow-clip-margin/);
    expect(layer).toMatch(/inset:\s*0/);
  });

  it("does not let the action feed set the table column's minimum width", () => {
    // A grid item's default `min-width: auto` is its min-content width; the feed is a row of
    // unbreakable entries, so at 820px the whole column sat 50px wider than the page and
    // changed width as entries came and went.
    expect(rule(".table-screen > *")).toMatch(/min-width:\s*0/);
    const feed = rule(".action-feed");
    expect(feed).toMatch(/overflow:\s*hidden/);
    expect(feed).toMatch(/min-width:\s*0/);
    // Packed right, so it is the oldest entries that leave the strip, not the newest action.
    expect(feed).toMatch(/justify-content:\s*flex-end/);
  });

  it("keeps the scrollbar gutter reserved so a vertical scrollbar cannot shift the layout", () => {
    expect(rule(":root")).toMatch(/scrollbar-gutter:\s*stable/);
  });
});

// Measured at 390x844 and 375x667: the fixed action bar used to sit on top of the bottom seat,
// the player's own, hiding 145px of it (all of it) on their own turn.
describe("action bar guards", () => {
  it("keeps room under the felt for the bar and scrolls the felt clear of it", () => {
    const phone = css.slice(css.indexOf("@media (max-width: 720px)"));
    expect(phone).toMatch(/padding-bottom:\s*calc\([^;]*var\(--turn-bar-height, 0px\)/);
    expect(phone).toMatch(/scroll-margin-bottom:\s*calc\([^;]*var\(--turn-bar-height, 0px\)/);
  });

  it("pins the bar to the bottom of a wide screen, so no height needs a scroll to reach it", () => {
    const wide = css.slice(css.indexOf("On a wide screen the bar is pinned"));
    const bar = /\.your-turn \{([^}]*)\}/.exec(wide)?.[1] ?? "";
    expect(bar).toMatch(/position:\s*sticky/);
    expect(bar).toMatch(/bottom:\s*0/);
    const z = Number(/z-index:\s*(\d+)/.exec(bar)?.[1] ?? 0);
    expect(z).toBeGreaterThan(Number(/z-index:\s*(\d+)/.exec(rule(".cutin"))?.[1]));
    expect(z).toBeLessThan(Number(/z-index:\s*(\d+)/.exec(rule(".drawer"))?.[1]));
  });

  it("budgets a computer screen's height: the felt gets what the rest leaves", () => {
    expect(rule(".felt")).toMatch(/calc\(\(100vh - var\(--felt-room, 390px\)\) \* 1\.6\)/);
    const wide = css.slice(css.indexOf("A computer screen does not scroll"));
    expect(wide).toMatch(/--felt-room:\s*350px/);
    expect(wide).toMatch(/\.footer \{[^}]*font-size:\s*0\.72rem/);
  });

  it("gives fold, call and raise a fixed slot each, whichever of them are on offer", () => {
    expect(rule(".action-main")).toMatch(/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(rule(".action-main .passive")).toMatch(/grid-column:\s*2/);
    expect(rule(".action-main .aggressive")).toMatch(/grid-column:\s*3/);
  });

  it("sizes the amount inputs to their grid cell, padding included", () => {
    // Without it the 84px number box rendered 110px wide and ran under the + button.
    expect(rule('.sizing-fine input[type="number"]')).toMatch(/box-sizing:\s*border-box/);
  });
});

// 宵闇に金: the official tone (kitan-lore `get_design_tone`) as far as a stylesheet can promise it.
describe("tone guards", () => {
  it("declares the official palette tokens on :root", () => {
    const root = rule(":root");
    for (const [name, hex] of [
      ["--kitan-yoiyami", "#131320"],
      ["--kitan-yoiyami-hi", "#1b1b2e"],
      ["--kitan-kindei", "#d9a94c"],
      ["--kitan-kindei-hi", "#f0ce7e"],
      ["--kitan-shokko", "#c93a2e"],
      ["--kitan-geppaku", "#e8e4d8"],
      ["--kitan-anshi", "#5c4470"],
      ["--kitan-panel", "#100e1c"],
      ["--kitan-bubble", "#181626"],
      ["--kitan-sublabel", "#9d93b5"],
    ]) {
      expect(root, name).toContain(`${name}: ${hex}`);
    }
  });

  it("has no green felt, pure black or white ground left", () => {
    expect(css).not.toMatch(/#0f1a14|#2e8b57|#123d28|#16261d|#2f4a3b/i);
    expect(css).not.toMatch(/background:\s*(#000|black|#fff|white)\b/i);
  });

  it("never sets a font size under 11px", () => {
    for (const match of css.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)) {
      const px = match[2] === "px" ? Number(match[1]) : Number(match[1]) * 16;
      expect(px, match[0]).toBeGreaterThanOrEqual(11);
    }
  });

  it("uses the mincho for text and the rounded gothic for numbers", () => {
    expect(rule(":root")).toMatch(/--kitan-font:\s*"Shippori Mincho B1"/);
    expect(rule(":root")).toMatch(/--kitan-num:\s*"M PLUS Rounded 1c"/);
  });
});

describe("bubble stacking", () => {
  const z = (selector: string) => Number(/z-index:\s*(\d+)/.exec(rule(selector))?.[1] ?? 0);

  it("paints every bubble above the chips and their flights, and below the cut-in", () => {
    const bubbles = z(".speech-layer");
    expect(bubbles).toBeGreaterThan(z(".bet-stack"));
    expect(bubbles).toBeGreaterThan(z(".fx-layer"));
    expect(bubbles).toBeLessThan(z(".cutin"));
    expect(rule(".speech-layer")).toMatch(/position:\s*absolute/);
    expect(rule(".speech-layer")).toMatch(/inset:\s*0/);
  });

  it("gives the bubble no z-index of its own, which would only count inside a seat", () => {
    expect(rule(".callout-spot")).not.toMatch(/z-index/);
  });
});

describe("bubble placement", () => {
  it("grows a side seat's bubble inwards from its seat rather than centring it", () => {
    // Centred on a side seat, a long line ran off a 360px page on the outer side.
    expect(rule(".callout-spot")).toMatch(
      /translate\(\s*calc\(-50% \+ var\(--in-x, 0\) \* 50%\),\s*-50%\s*\)/,
    );
  });

  it("keeps a phone's bubble within its max-width, padding included", () => {
    const phone = css.slice(css.indexOf("@media (max-width: 720px) {\n  .table-screen"));
    const speech = /\n {2}\.speech \{([^}]*)\}/.exec(phone)?.[1] ?? "";
    expect(speech).toMatch(/box-sizing:\s*border-box/);
    expect(speech).toMatch(/max-width:\s*min\(160px, 42vw\)/);
  });
});

describe("dialog stacking", () => {
  it("keeps a dialog above the chips, bubbles and cut-in on the felt and above the bars", () => {
    const z = (selector: string) => Number(/z-index:\s*(\d+)/.exec(rule(selector))?.[1] ?? 0);
    const dialog = z(".modal-backdrop");
    for (const selector of [
      ".bet-stack",
      ".fx-layer",
      ".speech-layer",
      ".cutin",
      ".drawer",
      ".drawer-backdrop",
      ".your-turn",
    ]) {
      expect(dialog, selector).toBeGreaterThan(z(selector));
    }
  });

  it("slides the drawer in above the felt, the chips, the cut-in and the action bar", () => {
    const z = (selector: string) => Number(/z-index:\s*(\d+)/.exec(rule(selector))?.[1] ?? 0);
    for (const selector of [".speech-layer", ".cutin", ".your-turn"]) {
      expect(z(".drawer"), selector).toBeGreaterThan(z(selector));
      expect(z(".drawer-backdrop"), selector).toBeGreaterThan(z(selector));
    }
    expect(z(".drawer")).toBeGreaterThan(z(".drawer-backdrop"));
    expect(z(".turnstile-challenge")).toBeGreaterThan(z(".drawer"));
    expect(rule(".drawer")).toMatch(/position:\s*fixed/);
    expect(rule(".drawer")).toMatch(/right:\s*0/);
  });
});

describe("opening guards", () => {
  const z = (selector: string) => Number(/z-index:\s*(\d+)/.exec(rule(selector))?.[1]);

  it("veils the table, its bars and the drawer, and stays under the dialogs and Turnstile", () => {
    const opening = z(".opening");
    expect(opening).toBeGreaterThan(z(".cutin"));
    expect(opening).toBeGreaterThan(z(".drawer"));
    expect(opening).toBeLessThan(z(".modal-backdrop"));
    expect(opening).toBeLessThan(z(".turnstile-challenge"));
  });

  it("covers the viewport without letting the parting doors make the page scroll", () => {
    const opening = rule(".opening");
    expect(opening).toMatch(/position:\s*fixed/);
    expect(opening).toMatch(/inset:\s*0/);
    expect(opening).toMatch(/overflow:\s*hidden/);
  });
});
