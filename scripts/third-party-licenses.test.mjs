// @vitest-environment node

import { readFile } from 'node:fs/promises';

import { validateThirdPartyLicenses } from './third-party-licenses.mjs';

const versions = {
  'cron-parser': '5.6.2',
  cronstrue: '3.24.0',
  react: '19.2.7',
  'react-dom': '19.2.7',
};

const notices = await readFile(
  new URL('../public/THIRD_PARTY_LICENSES.txt', import.meta.url),
  'utf8',
);

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
