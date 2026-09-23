const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TIMEOUT_MS = 30_000;

/** The part of Cloudflare's `window.turnstile` this file uses. */
interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      execution: "execute";
      appearance: "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
    },
  ): string;
  execute(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing"));
    script.onerror = () => reject(new Error("turnstile failed to load"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null; // let the next attempt try the network again
    throw error;
  });
  return loading;
}

/**
 * Runs the (Invisible) Turnstile widget once and resolves with its token. The widget only shows
 * itself if Cloudflare wants an interaction; it is removed as soon as it answers.
 */
export async function turnstileToken(siteKey: string): Promise<string> {
  const turnstile = await loadTurnstile();
  return new Promise<string>((resolve, reject) => {
    // Not display:none: should Cloudflare want an interaction, the player has to see it.
    const container = document.createElement("div");
    document.body.appendChild(container);
    let widgetId: string | undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (widgetId !== undefined) turnstile.remove(widgetId);
      container.remove();
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error("turnstile timed out"));
    }, TIMEOUT_MS);
    try {
      widgetId = turnstile.render(container, {
        sitekey: siteKey,
        execution: "execute",
        appearance: "interaction-only",
        callback: (token) => {
          if (done) return;
          finish();
          resolve(token);
        },
        "error-callback": () => {
          if (done) return;
          finish();
          reject(new Error("turnstile refused"));
        },
      });
      turnstile.execute(widgetId);
    } catch (error) {
      finish();
      reject(error);
    }
  });
}
