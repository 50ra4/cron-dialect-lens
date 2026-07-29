# Privacy Policy

Effective date: 2026-07-20

Cron Dialect Lens processes visible GitHub YAML code locally in the browser to
detect and explain cron schedules.

## Data collection and transmission

Cron Dialect Lens does not collect, transmit, sell, share, or remotely process
personal data, repository content, browsing history, usage metrics, or crash
reports. It has no account system, backend, analytics SDK, remote configuration,
or advertising SDK. It does not call the GitHub API or any other external API.

## Local processing and storage

The content script reads only the currently rendered code lines needed to find
`cron:` and `schedule:` entries and their visible YAML context. Analysis is
performed in memory. The extension does not use Chrome storage, cookies,
IndexedDB, or localStorage and saves no user or repository data.

## Permissions

The extension is injected only on `https://github.com/*`. It declares no Chrome
API permissions and no `host_permissions`. The GitHub match exists solely so
the content script can annotate supported GitHub code views.

## Third-party code

The extension bundles open-source runtime libraries for cron parsing,
description, and UI rendering. They execute locally and are not loaded from a
CDN. See [third-party-notices.md](./third-party-notices.md).

## Retention and deletion

No data is retained. Uninstalling the extension therefore leaves no extension
data to delete.

## Changes and contact

Policy changes will be published in this repository. Questions or security
reports can be filed through the repository links in `package.json`; sensitive
reports should follow [SECURITY.md](../SECURITY.md).
