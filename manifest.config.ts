import { defineManifest } from '@crxjs/vite-plugin';
import { name, version } from './package.json';
import { createManifestVersion } from './scripts/manifest-version.mjs';

const manifestVersion = createManifestVersion(version);

const EXTENSION_NAMES = {
  build: name,
  serve: `[DEV] ${name}`,
} as const;

const createIconFileSuffix = (command: 'build' | 'serve') =>
  command === 'serve' ? '-dev' : '';

// import to `vite.config.ts`
export default defineManifest(({ command }) => ({
  ...manifestVersion,
  manifest_version: 3,
  name: EXTENSION_NAMES[command],
  description:
    'Explain GitHub Actions and Kubernetes cron schedules locally on GitHub.',
  icons: {
    '16': `public/logo/icon16${createIconFileSuffix(command)}.png`,
    '48': `public/logo/icon48${createIconFileSuffix(command)}.png`,
    '128': `public/logo/icon128${createIconFileSuffix(command)}.png`,
  },
  ...(command === 'build'
    ? {
        content_security_policy: {
          extension_pages: "script-src 'self'; object-src 'self';",
        },
      }
    : {}),
  permissions: [],
  content_scripts: [
    {
      matches: ['https://github.com/*'],
      js: ['src/entrypoints/content/cronLens.tsx'],
      run_at: 'document_idle',
    },
  ],
}));
