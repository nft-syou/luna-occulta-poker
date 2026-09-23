import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ja from "./locales/ja.json";

export type Language = "en" | "ja";
export const LANGUAGES: readonly Language[] = ["en", "ja"];
export const LANGUAGE_STORAGE_KEY = "jev-poker.lang";

/** The slice of `navigator` the language is read from. */
export interface BrowserLanguages {
  /** The user's languages, most preferred first. */
  readonly languages?: readonly string[];
  readonly language?: string;
}

/**
 * The language to open in. A choice the player made in the settings wins; otherwise the
 * browser's own list is read in order and the first Japanese or English entry decides, so a
 * French-first browser that also lists Japanese opens in Japanese. Nothing usable: English.
 */
export function detectLanguage(
  stored: string | null,
  browser: BrowserLanguages | undefined,
): Language {
  if (stored === "ja" || stored === "en") return stored;
  const listed = [...(browser?.languages ?? []), browser?.language ?? ""];
  for (const entry of listed) {
    const tag = entry.toLowerCase();
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}

/** Initializes i18next once; later calls return the same instance without changing language. */
export function initI18n(language: Language): typeof i18next {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      resources: { en: { translation: en }, ja: { translation: ja } },
      lng: language,
      fallbackLng: "en",
      interpolation: { escapeValue: false },
    });
  }
  return i18next;
}

export default i18next;
