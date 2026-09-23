## What and why

<!-- What changes, and the reason. Link the issue if there is one. -->

## How it was verified

<!-- `pnpm check` is run by CI. Say what else you did: which tests you added, and for
     anything visual, which widths you looked at in a browser. -->

## Checklist

- [ ] `pnpm check` passes locally
- [ ] New behaviour has a test next to the code
- [ ] User-facing strings were added to both `en.json` and `ja.json`
- [ ] The Worker still contacts only the fixed upstream hosts and stores and logs nothing beyond the daily budget counts (if `src/worker` changed)
- [ ] The browser still sends no prose — new `task` / `importantContext` strings are in `src/worker/prose-allowlist.json` (`pnpm prose:allowlist`), if `@jev-poker/agent`'s prose changed
- [ ] `CHANGELOG.md` has an entry under Unreleased (for user-visible changes)
