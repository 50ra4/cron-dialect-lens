import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { chromium } from '@playwright/test';

const variants = [
  { source: 'assets/branding/icon.svg', suffix: '' },
  { source: 'assets/branding/icon-dev.svg', suffix: '-dev' },
];
const sizes = [16, 48, 128];
const browser = await chromium.launch({ channel: 'chromium', headless: true });

try {
  for (const variant of variants) {
    const svg = await readFile(resolve(variant.source), 'utf8');
    for (const size of sizes) {
      const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: { height: size, width: size },
      });
      await page.setContent(svg);
      await page.locator('svg').evaluate((element, dimension) => {
        element.style.display = 'block';
        element.style.height = `${dimension}px`;
        element.style.width = `${dimension}px`;
        document.body.style.margin = '0';
      }, size);
      await page.locator('svg').screenshot({
        path: resolve(`public/logo/icon${size}${variant.suffix}.png`),
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
