# MVP requirements traceability

Audit date: 2026-07-21

| Requirement | Status | Implementation and verification                                                                                                                                              |
| ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRON-F01    | Met    | GitHub route/YAML filtering and blob/unified/split PR line recovery in `githubCronAdapter.ts`; saved DOM fixtures and adapter tests                                          |
| CRON-F02    | Met    | Path, key, `on.schedule` / direct CronJob `spec` hierarchy, confidence, and `unknown-posix` fallback in `detectDialect.ts`; unit and incomplete-diff fixture tests           |
| CRON-F03    | Met    | Adjacent 20px namespaced button injection without replacing source text in `cronLens.tsx`; runtime and Chromium E2E tests                                                    |
| CRON-F04    | Met    | Hover/focus/click Shadow DOM panel with expression, dialect, description, timezone, five runs, warnings, and local-processing disclosure                                     |
| CRON-F05    | Met    | GitHub timezone/default UTC, five-field/macro/interval/top-of-hour rules; table tests include `*/5`, every minute, top-of-hour, macro, six fields, and invalid IANA timezone |
| CRON-F06    | Met    | Kubernetes `spec.timeZone`, controller-dependent unknown time, official macros, and embedded `TZ` / `CRON_TZ` rejection with tests                                           |
| CRON-F07    | Met    | Separate schedule/browser timezone formatting via `Intl.DateTimeFormat`; panel and analysis tests                                                                            |
| CRON-F08    | Met    | Missing PR context becomes low-confidence `unknown-posix`; dedicated incomplete PR fixture test                                                                              |
| CRON-F09    | Met    | One body `MutationObserver`, 100ms debounce, `popstate`, `pageshow`, idempotent IDs, cleanup; DOM replacement unit test and real-Chromium E2E                                |
| CRON-F10    | Met    | No Chrome API permissions, storage, background, fetch/XHR/WebSocket, analytics, or external API; manifest allowlists and privacy documentation                               |

## Acceptance checks

- GitHub Actions `*/5 * * * *`: five UTC or explicit-timezone runs.
- GitHub Actions `* * * * *`: interval below five minutes warning.
- GitHub Actions `@daily`: unsupported macro error.
- Kubernetes `0 3 * * 1` plus `Asia/Tokyo`: associated and calculated.
- Kubernetes without `timeZone`: no asserted next runs.
- Kubernetes `CRON_TZ=Asia/Tokyo 0 3 * * *`: error and no next runs.
- Repeated and replaced DOM: no duplicate annotation.
- `extension.zip`: versioned copyright notices and complete runtime dependency licenses included.
- `npm run verify:full`: required before release.

Manual checks that depend on the live GitHub DOM remain in
[manual-test.md](./manual-test.md). GitHub DOM is not a public compatibility
contract, so fixture and E2E coverage do not eliminate future adapter updates.
