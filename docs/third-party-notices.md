# Third-party runtime notices

Cron Dialect Lens bundles the following runtime dependencies. All are loaded
from the extension package and execute locally; no CDN is used.

| Package       | Version | License | Purpose                                    |
| ------------- | ------: | ------- | ------------------------------------------ |
| `cron-parser` |   5.6.2 | MIT     | Cron validation and next-run calculation   |
| `cronstrue`   |  3.24.0 | MIT     | English and Japanese schedule descriptions |
| `luxon`       |   3.7.2 | MIT     | Date and time handling for `cron-parser`    |
| `react`       |  19.2.7 | MIT     | Panel rendering                            |
| `react-dom`   |  19.2.7 | MIT     | Shadow DOM mounting                        |
| `scheduler`   |  0.27.0 | MIT     | Rendering scheduler for `react-dom`         |

The distributable extension and `extension.zip` include each package's
copyright notice and complete MIT license in `THIRD_PARTY_LICENSES.txt`.
Runtime dependencies, including transitive dependencies, are enumerated from
`package-lock.json` during verification. The
reviewed source for that generated artifact is
[`public/THIRD_PARTY_LICENSES.txt`](../public/THIRD_PARTY_LICENSES.txt).

This project itself is licensed under the [MIT License](../LICENSE).
