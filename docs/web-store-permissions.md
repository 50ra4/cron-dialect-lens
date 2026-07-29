# Chrome Web Store permission explanation

## Site access

`https://github.com/*` is the only content-script match. Cron Dialect Lens must
read the currently rendered YAML code lines on GitHub blob and pull request
Files changed pages to locate `cron:` / `schedule:` and add the adjacent Lens
button. A narrower static path pattern cannot cover arbitrary repository owner,
repository, ref, and pull request segments.

The content script exits immediately on unsupported GitHub routes and ignores
non-YAML files. `<all_urls>` is not used.

## Chrome API permissions

None. The extension does not declare `permissions`, `host_permissions`,
`optional_permissions`, or `optional_host_permissions` values. It has no
background service worker, popup, options page, externally connectable entry,
or remote code.

## Data use statement

Visible YAML context is processed in memory and never transmitted or stored.
The extension makes no GitHub API or third-party network requests.
