import { createHash } from 'node:crypto';

export const THIRD_PARTY_LICENSE_FILE = 'THIRD_PARTY_LICENSES.txt';

const REQUIRED_NOTICES = [
  {
    copyright: 'Copyright (c) 2014-2023 Harri Siirak',
    licenseSha256:
      '9a08965c44ca16aa85423ed8a1f8682e9d8229897cb4189099bd38e132afa93a',
    name: 'cron-parser',
  },
  {
    copyright: 'Copyright (c) 2017 Brady Holt',
    licenseSha256:
      'c1bbc9d29473550bd4d8a74801e8b93c075204cade0cb5525b9a1a087c30abdc',
    name: 'cronstrue',
  },
  {
    copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
    licenseSha256:
      'cf9b17822d1fcd4ff32ccbe14183386fb3adf6f2ff92dc184130823f7fc28173',
    name: 'react',
  },
  {
    copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
    licenseSha256:
      'cf9b17822d1fcd4ff32ccbe14183386fb3adf6f2ff92dc184130823f7fc28173',
    name: 'react-dom',
  },
];

export const validateThirdPartyLicenses = (contents, versions) => {
  const errors = [];

  for (const notice of REQUIRED_NOTICES) {
    const version = versions?.[notice.name];
    if (typeof version !== 'string' || version.length === 0) {
      errors.push(`${notice.name} must be a pinned runtime dependency.`);
      continue;
    }

    const heading = `===== ${notice.name} ${version} =====`;
    const start = contents.indexOf(heading);
    if (start < 0) {
      errors.push(`${notice.name} ${version} license section is missing.`);
      continue;
    }
    const next = contents.indexOf('\n===== ', start + heading.length);
    const section = contents
      .slice(start + heading.length, next < 0 ? undefined : next)
      .trim();

    if (!section.includes(notice.copyright)) {
      errors.push(
        `${notice.name} ${version} must include ${notice.copyright}.`,
      );
    }
    const digest = createHash('sha256').update(section).digest('hex');
    if (digest !== notice.licenseSha256) {
      errors.push(
        `${notice.name} ${version} must include the complete MIT license terms.`,
      );
    }
  }

  return errors;
};
