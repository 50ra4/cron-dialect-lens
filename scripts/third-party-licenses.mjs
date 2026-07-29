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
    copyright: 'Copyright 2019 JS Foundation and other contributors',
    licenseSha256:
      'f8f62778c92d145b6d7af0af71ca23c032a67e01e04fbc01586a3e5af5852296',
    name: 'luxon',
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
  {
    copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
    licenseSha256:
      'cf9b17822d1fcd4ff32ccbe14183386fb3adf6f2ff92dc184130823f7fc28173',
    name: 'scheduler',
  },
];

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const resolveDependencyPath = (packages, issuerPath, dependencyName) => {
  let searchPath = issuerPath;

  while (true) {
    const candidate = searchPath
      ? `${searchPath}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (isRecord(packages[candidate])) return candidate;

    const parentIndex = searchPath.lastIndexOf('/node_modules/');
    if (parentIndex >= 0) {
      searchPath = searchPath.slice(0, parentIndex);
    } else if (searchPath.startsWith('node_modules/')) {
      searchPath = '';
    } else {
      return undefined;
    }
  }
};

export const collectRuntimeDependencyVersions = (packageLock) => {
  if (!isRecord(packageLock) || !isRecord(packageLock.packages)) return {};

  const packages = packageLock.packages;
  const root = packages[''];
  if (!isRecord(root) || !isRecord(root.dependencies)) return {};

  const versions = {};
  const queue = Object.keys(root.dependencies).map((name) => ({
    issuerPath: '',
    name,
  }));
  const visitedPaths = new Set();

  while (queue.length > 0) {
    const dependency = queue.shift();
    const packagePath = resolveDependencyPath(
      packages,
      dependency.issuerPath,
      dependency.name,
    );
    if (packagePath === undefined || visitedPaths.has(packagePath)) continue;
    visitedPaths.add(packagePath);

    const packageEntry = packages[packagePath];
    if (!isRecord(packageEntry) || typeof packageEntry.version !== 'string') {
      continue;
    }
    versions[dependency.name] = packageEntry.version;

    const runtimeDependencies = {
      ...(isRecord(packageEntry.dependencies) ? packageEntry.dependencies : {}),
      ...(isRecord(packageEntry.optionalDependencies)
        ? packageEntry.optionalDependencies
        : {}),
    };
    for (const name of Object.keys(runtimeDependencies)) {
      queue.push({ issuerPath: packagePath, name });
    }
  }

  return Object.fromEntries(
    Object.entries(versions).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
};

export const validateThirdPartyLicenses = (contents, versions) => {
  const errors = [];
  const noticesByName = new Map(
    REQUIRED_NOTICES.map((notice) => [notice.name, notice]),
  );

  for (const [name, version] of Object.entries(
    isRecord(versions) ? versions : {},
  )) {
    if (typeof version !== 'string' || version.length === 0) {
      errors.push(`${name} must be a pinned runtime dependency.`);
      continue;
    }
    const notice = noticesByName.get(name);
    if (notice === undefined) {
      errors.push(`${name} ${version} license validation must be configured.`);
      continue;
    }

    const heading = `===== ${name} ${version} =====`;
    const start = contents.indexOf(heading);
    if (start < 0) {
      errors.push(`${name} ${version} license section is missing.`);
      continue;
    }
    const next = contents.indexOf('\n===== ', start + heading.length);
    const section = contents
      .slice(start + heading.length, next < 0 ? undefined : next)
      .trim();

    if (!section.includes(notice.copyright)) {
      errors.push(`${name} ${version} must include ${notice.copyright}.`);
    }
    const digest = createHash('sha256').update(section).digest('hex');
    if (digest !== notice.licenseSha256) {
      errors.push(
        `${name} ${version} must include the complete MIT license terms.`,
      );
    }
  }

  return errors;
};
