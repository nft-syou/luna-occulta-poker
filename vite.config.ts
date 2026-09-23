/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { PayloadTooLargeError, toWebRequest, writeWebResponse } from "./src/proxy/node-adapter.ts";
// Explicit `.ts` extensions: Vite's native config loader rejects extensionless source imports.
import { handleApi, json, OPEN_SESSIONS } from "./src/worker/api.ts";
import { MemoryBudget } from "./src/worker/budget.ts";

/**
 * `pnpm dev` serves `/api/*` with the Worker's own handler. The operator key comes from the
 * `JEV_API_KEY` environment variable; Turnstile and the session secret are skipped (`DEV_OPEN`),
 * and the budget lives in memory.
 */
function apiDev(): Plugin {
  const budget = new MemoryBudget();
  return {
    name: "api-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api", (req, res, next) => {
        void (async () => {
          // Connect strips the mount prefix; put it back so the handler sees the real path.
          req.url = `/api${req.url ?? ""}`;
          let request: Request;
          try {
            request = await toWebRequest(req, "http://localhost");
          } catch (error) {
            if (!(error instanceof PayloadTooLargeError)) throw error;
            await writeWebResponse(res, json(400, { error: "bad_request" }));
            return;
          }
          const env = {
            JEV_API_KEY: process.env.JEV_API_KEY,
            JEV_ROUTE: process.env.JEV_ROUTE,
            JEV_MODEL: process.env.JEV_MODEL,
            TYPESAFE_BASE_URL: process.env.TYPESAFE_BASE_URL,
            DEV_OPEN: "1",
          };
          const response = await handleApi(request, {
            env,
            budget,
            burst: { limit: async () => ({ success: true }) },
            sessions: OPEN_SESSIONS,
            fetch,
            now: Date.now,
          });
          await writeWebResponse(res, response);
        })().catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDev()],
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "app",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx", "functions/**/*.test.ts"],
        },
      },
    ],
  },
});
