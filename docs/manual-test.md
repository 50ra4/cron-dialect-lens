# Manual acceptance test

## Setup

1. Use Node.js 24 or later.
2. Run `npm ci` and `npm run verify:full`.
3. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
   and select `extension/`.
4. Keep DevTools Network open while testing and confirm the extension creates
   no external requests.

## GitHub Actions blob

1. Open a `.github/workflows/*.yml` blob containing
   `- cron: '*/5 * * * *'` and an adjacent `timezone: Asia/Tokyo`. Repeat with
   `timezone` before `cron` in the same schedule item.
2. Confirm one Lens button appears beside the cron value and the source text is
   unchanged.
3. Focus the button using Tab. Confirm the panel shows `github-actions`, high
   confidence, the expression, description, `Asia/Tokyo`, browser timezone,
   five `<time>` entries, and the local-processing disclosure.
4. Repeat with no `timezone:` and confirm the effective timezone is UTC.
5. Check `* * * * *`, `@daily`, `0 * * * *`, a six-field expression, and
   unsupported `L` / `#` / `H` tokens. Confirm the five-minute, macro,
   top-of-hour, and invalid-expression messages.

## Kubernetes blob

1. Open a YAML blob with `kind: CronJob`, `spec.timeZone: Asia/Tokyo`, and
   `schedule: '0 3 * * 1'`.
2. Confirm Kubernetes/high confidence and five timezone-aware runs.
3. Remove `timeZone`; confirm no next run is asserted and the controller
   timezone warning appears.
4. Use `CRON_TZ=Asia/Tokyo 0 3 * * *`; confirm an error and no next runs.
5. Use `0 0 L * *`, `0 0 * * 1#2`, and `H * * * *`; confirm each is rejected.

## Pull request and lifecycle

1. Open a PR Files changed view containing both supported YAML types and a
   non-YAML file with a schedule-like line.
2. Confirm only YAML candidates receive buttons.
3. Collapse/expand a diff and navigate to another PR page without a full
   reload. Confirm new rows are detected after rendering.
4. Trigger repeated DOM mutations. Confirm each candidate has exactly one
   button.
5. Test an incomplete diff without `kind: CronJob`; confirm `unknown-posix`
   rather than Kubernetes.

## Interaction, isolation, and cleanup

1. Open the panel separately by hover, focus, and click.
2. Press Escape and click outside; confirm the panel closes.
3. Confirm warning states use an icon as well as color.
4. Resize and scroll the page; confirm the panel stays inside the viewport and
   does not block GitHub scrolling.
5. Disable/uninstall the extension and reload. Confirm injected buttons and the
   panel are absent and no stored data remains.
6. Select and copy a cron source line. Confirm the Lens icon is not included in
   the copied YAML.
