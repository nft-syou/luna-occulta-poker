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
    script.onerror = () => {
      script.remove(); // a retry adds its own tag
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null; // let the next attempt try the network again
    throw error;
  });
  return loading;
}

/**
 * Runs the (Invisible) Turnstile widget once and resolves with its token. The widget only shows
 * itself if Cloudflare wants an interaction, in a box fixed over the middle of the screen; it is
 * removed as soon as it answers. One 30 s deadline covers loading the script and the widget, and
 * the promise always settles.
 */
export function turnstileToken(siteKey: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let api: TurnstileApi | undefined;
    let widgetId: string | undefined;
    let container: HTMLDivElement | undefined;

    const removeWidget = () => {
      if (api === undefined || widgetId === undefined) return;
      try {
        api.remove(widgetId);
      } catch {
        // Already gone, or Turnstile is in a bad way; either way there is nothing left to do.
      }
      widgetId = undefined;
    };
    /** Settles first, then cleans up, so a cleanup that throws cannot leave the caller waiting. */
    const settle = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outcome();
      removeWidget();
      container?.remove();
    };

    const timer = setTimeout(
      () => settle(() => reject(new Error("turnstile timed out"))),
      TIMEOUT_MS,
    );

    loadTurnstile()
      .then((turnstile) => {
        if (settled) return;
        api = turnstile;
        container = document.createElement("div");
        container.className = "turnstile-challenge";
        document.body.appendChild(container);
        widgetId = turnstile.render(container, {
          sitekey: siteKey,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token) => settle(() => resolve(token)),
          "error-callback": () => settle(() => reject(new Error("turnstile refused"))),
        });
        // A callback during render ran before the id was known; remove the widget now.
        if (settled) removeWidget();
        else turnstile.execute(widgetId);
      })
      .catch((error: unknown) => settle(() => reject(error)));
  });
}
