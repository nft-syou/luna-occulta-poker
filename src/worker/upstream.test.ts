import { describe, expect, it } from "vitest";
import { upstreamUrl } from "./upstream";

type CfPatch = Partial<Record<"accountId" | "gatewayId" | "providerSlug", unknown>>;

const CF_CONFIG = {
  accountId: "0123456789abcdef0123456789abcdef",
  gatewayId: "my-gateway",
  providerSlug: "typesafe",
};

describe("upstreamUrl", () => {
  it("builds the exact url for every route and both paths", () => {
    expect(upstreamUrl("typesafe", "v1/systemone", null, {})).toBe(
      "https://api.typesafe.ai/v1/systemone",
    );
    expect(upstreamUrl("typesafe", "v1/models", null, {})).toBe(
      "https://api.typesafe.ai/v1/models",
    );
    expect(upstreamUrl("vercel", "v1/systemone", null, {})).toBe(
      "https://ai-gateway.vercel.sh/typesafe/v1/systemone",
    );
    expect(upstreamUrl("vercel", "v1/models", null, {})).toBe(
      "https://ai-gateway.vercel.sh/typesafe/v1/models",
    );
    expect(upstreamUrl("lolipop", "v1/systemone", null, {})).toBe(
      "https://ai-gateway.lolipop.jp/v1/systemone",
    );
    expect(upstreamUrl("lolipop", "v1/models", null, {})).toBe(
      "https://ai-gateway.lolipop.jp/v1/models",
    );
    expect(upstreamUrl("cloudflare", "v1/systemone", CF_CONFIG, {})).toBe(
      "https://gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/my-gateway/custom-typesafe/v1/systemone",
    );
    expect(upstreamUrl("cloudflare", "v1/models", CF_CONFIG, {})).toBe(
      "https://gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/my-gateway/custom-typesafe/v1/models",
    );
  });

  it("ignores a TYPESAFE_BASE_URL that is not an https (or local http) origin", () => {
    // A typo must never yield a relative URL or send keys somewhere unencrypted.
    for (const TYPESAFE_BASE_URL of [
      "",
      "   ",
      "api.typesafe.ai",
      "/v1",
      "//evil.test",
      "http://evil.test",
      "https:/api.typesafe.ai",
      "ftp://api.typesafe.ai",
      "javascript:alert(1)",
      "https://api.typesafe.ai extra",
    ]) {
      expect(
        upstreamUrl("typesafe", "v1/systemone", null, { TYPESAFE_BASE_URL }),
        JSON.stringify(TYPESAFE_BASE_URL),
      ).toBe("https://api.typesafe.ai/v1/systemone");
    }
    for (const base of [
      "https://staging.typesafe.test",
      "http://localhost:8787",
      "http://127.0.0.1:1234/base",
    ]) {
      expect(upstreamUrl("typesafe", "v1/models", null, { TYPESAFE_BASE_URL: base }), base).toBe(
        `${base}/v1/models`,
      );
    }
  });

  it("honours TYPESAFE_BASE_URL on the typesafe route only", () => {
    const env = { TYPESAFE_BASE_URL: "https://example.test/" };
    expect(upstreamUrl("typesafe", "v1/models", null, env)).toBe("https://example.test/v1/models");
    expect(upstreamUrl("vercel", "v1/models", null, env)).toBe(
      "https://ai-gateway.vercel.sh/typesafe/v1/models",
    );
    expect(upstreamUrl("cloudflare", "v1/models", CF_CONFIG, env)).toBe(
      "https://gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/my-gateway/custom-typesafe/v1/models",
    );
  });

  it("defaults a missing route to typesafe and refuses any other route id", () => {
    expect(upstreamUrl(null, "v1/systemone", null, {})).toBe(
      "https://api.typesafe.ai/v1/systemone",
    );
    expect(upstreamUrl(undefined, "v1/systemone", null, {})).toBe(
      "https://api.typesafe.ai/v1/systemone",
    );
    for (const route of ["", "Vercel", "typesafe ", "openai", "https://evil.test", "__proto__"]) {
      expect(upstreamUrl(route, "v1/systemone", null, {}), route).toEqual({
        error: "invalid_route",
      });
    }
  });

  it("refuses paths outside the allow-list, including traversal and injection", () => {
    for (const path of [
      "",
      "v1",
      "v1/other",
      "v1/systemone/",
      "/v1/systemone",
      "../v1/systemone",
      "v1%2fsystemone",
      "v1/systemone?x=1",
      "v1/systemone#f",
      "constructor",
      "__proto__",
      "toString",
    ]) {
      expect(upstreamUrl("typesafe", path, null, {}), path).toEqual({ error: "invalid_path" });
      expect(upstreamUrl("cloudflare", path, CF_CONFIG, {}), path).toEqual({
        error: "invalid_path",
      });
    }
  });

  it("refuses a cloudflare config that fails any regex, without inventing a url", () => {
    expect(upstreamUrl("cloudflare", "v1/systemone", null, {})).toEqual({
      error: "invalid_gateway_config",
    });
    const broken: CfPatch[] = [
      { accountId: "../../evil" },
      { accountId: "0123456789abcdef0123456789abcde" },
      { gatewayId: "gw/../.." },
      { gatewayId: "gw?x=1" },
      { gatewayId: "" },
      { providerSlug: "a/b" },
      { providerSlug: "%2e%2e" },
      { providerSlug: "custom-" },
      { providerSlug: "Upper" },
      { accountId: undefined },
      { gatewayId: undefined },
      { providerSlug: undefined },
    ];
    for (const patch of broken) {
      expect(
        upstreamUrl("cloudflare", "v1/systemone", { ...CF_CONFIG, ...patch }, {}),
        JSON.stringify(patch),
      ).toEqual({ error: "invalid_gateway_config" });
    }
  });

  it("never lets a gateway field escape its url segment", () => {
    const url = upstreamUrl("cloudflare", "v1/systemone", CF_CONFIG, {});
    expect(typeof url).toBe("string");
    expect(new URL(String(url)).origin).toBe("https://gateway.ai.cloudflare.com");
    expect(new URL(String(url)).pathname).toBe(
      "/v1/0123456789abcdef0123456789abcdef/my-gateway/custom-typesafe/v1/systemone",
    );
  });

  it("keeps a free-form url out: an absolute url in any field is refused", () => {
    for (const field of ["accountId", "gatewayId", "providerSlug"] as const) {
      expect(
        upstreamUrl(
          "cloudflare",
          "v1/systemone",
          { ...CF_CONFIG, [field]: "https://evil.test" },
          {},
        ),
        field,
      ).toEqual({ error: "invalid_gateway_config" });
    }
  });
});
