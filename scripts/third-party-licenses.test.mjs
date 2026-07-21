// @vitest-environment node

import { readFile } from 'node:fs/promises';

import {
  collectRuntimeDependencyVersions,
  validateThirdPartyLicenses,
} from './third-party-licenses.mjs';

const versions = {
  'cron-parser': '5.6.2',
  cronstrue: '3.24.0',
  luxon: '3.7.2',
  react: '19.2.7',
  'react-dom': '19.2.7',
  scheduler: '0.27.0',
};

const notices = await readFile(
  new URL('../public/THIRD_PARTY_LICENSES.txt', import.meta.url),
  'utf8',
);

const packageLock = JSON.parse(
  await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
);

test('collects direct and transitive runtime dependencies from the lockfile', () => {
  expect(collectRuntimeDependencyVersions(packageLock)).toEqual({
    'cron-parser': '5.6.2',
    cronstrue: '3.24.0',
    luxon: '3.7.2',
    react: '19.2.7',
    'react-dom': '19.2.7',
    scheduler: '0.27.0',
  });
});

test('reports missing notices for transitive runtime dependencies', () => {
  const runtimeVersions = collectRuntimeDependencyVersions(packageLock);
  const directOnlyNotices = ['luxon', 'scheduler'].reduce(
    (contents, name) =>
      contents.replace(
        new RegExp(
          `\\n===== ${name} [^\\n]+ =====[\\s\\S]*?(?=\\n===== |$)`,
          'u',
        ),
        '',
      ),
    notices,
  );

  expect(
    validateThirdPartyLicenses(directOnlyNotices, runtimeVersions),
  ).toEqual([
    'luxon 3.7.2 license section is missing.',
    'scheduler 0.27.0 license section is missing.',
  ]);
});

test('accepts versioned copyright and complete MIT terms for every runtime dependency', () => {
  expect(validateThirdPartyLicenses(notices, versions)).toEqual([]);
});

test('reports a dependency section with incomplete MIT terms', () => {
  const incomplete = notices.replace(
    'Permission is hereby granted, free of charge',
    'Permission is granted without charge',
  );

  expect(validateThirdPartyLicenses(incomplete, versions)).toContain(
    'cron-parser 5.6.2 must include the complete MIT license terms.',
  );
});

test('rejects a lockfile runtime dependency without configured license validation', () => {
  expect(
    validateThirdPartyLicenses(notices, {
      ...versions,
      'new-runtime': '1.0.0',
    }),
  ).toContain('new-runtime 1.0.0 license validation must be configured.');
});
