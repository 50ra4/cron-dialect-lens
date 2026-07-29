# MVP requirements traceability

Audit date: 2026-07-26

| Requirement | Status | Implementation and verification                                                                                                                                          |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CRON-F01    | Met    | GitHub route/YAML filtering, metadata-only blob paths, diff-marker normalization, and unified/split PR line recovery in `githubCronAdapter.ts`; saved fixtures and tests |
| CRON-F02    | Met    | Path, key, `on.schedule` item / direct CronJob `spec` hierarchy, confidence, and `unknown-posix` fallback in `detectDialect.ts`; unit and incomplete-diff fixture tests  |
| CRON-F03    | Met    | Adjacent 20px namespaced, textless button slot does not alter copied source text or table columns; fallback and Chromium E2E tests                                       |
| CRON-F04    | Met    | Hover/focus/click Shadow DOM panel with expression, valid-only description, timezone, five runs, warnings, and local-processing disclosure                               |
| CRON-F05    | Met    | GitHub timezone/default UTC, documented field ranges/operators, macro/interval/top-of-hour rules; day-of-week 7 is rejected with a specific error                        |
| CRON-F06    | Met    | Kubernetes `spec.timeZone`, controller-dependent time, macros, `?`, documented field ranges, embedded `TZ` / `CRON_TZ` rejection, and strict day-of-week 0-6 tests       |
| CRON-F07    | Met    | Separate schedule/browser timezone formatting via `Intl.DateTimeFormat`; panel and analysis tests                                                                        |
| CRON-F08    | Met    | Missing PR context becomes low-confidence `unknown-posix`; dedicated incomplete PR fixture test                                                                          |
| CRON-F09    | Met    | One body `MutationObserver`, 100ms debounce, `popstate`, `pageshow`, idempotent IDs and fallback-row refresh; DOM replacement and Chromium E2E                           |
| CRON-F10    | Met    | No Chrome API permissions, storage, background, fetch/XHR/WebSocket, analytics, or external API; manifest allowlists and privacy documentation                           |

## Acceptance checks

- GitHub Actions `*/5 * * * *`: five UTC or explicit-timezone runs.
- GitHub Actions `* * * * *`: interval below five minutes warning.
- GitHub Actions `@daily`: unsupported macro error.
- GitHub Actions unquoted `5#2`: preserved then rejected, never truncated to `5`.
- Invalid expressions: no natural-language description or asserted next runs.
- Day-of-week `7`: rejected with a specific range error for GitHub Actions and Kubernetes, but retained for uncertain POSIX-compatible schedules.
- Kubernetes `0 3 * * 1` plus `Asia/Tokyo`: associated and calculated.
- Kubernetes without `timeZone`: no asserted next runs.
- Kubernetes `CRON_TZ=Asia/Tokyo 0 3 * * *`: error and no next runs.
- Repeated and replaced DOM: no duplicate annotation.
- Diff marker elements and fallback table rows: stable dialect and refreshed analysis.
- `extension.zip`: versioned copyright notices and complete runtime dependency licenses included.
- `npm run verify:full`: required before release.

Manual checks that depend on the live GitHub DOM remain in
[manual-test.md](./manual-test.md). GitHub DOM is not a public compatibility
contract, so fixture and E2E coverage do not eliminate future adapter updates.
