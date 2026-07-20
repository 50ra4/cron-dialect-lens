import { expect, test } from './fixtures';

test('explains both cron dialects and remains idempotent after a client render', async ({
  extensionPage,
  testPageUrl,
}) => {
  await extensionPage.setViewportSize({ height: 800, width: 1280 });
  await extensionPage.goto(testPageUrl);

  const lensButtons = extensionPage.getByRole('button', {
    name: 'Explain cron schedule',
  });
  await expect(lensButtons).toHaveCount(2);

  await lensButtons.first().focus();
  await expect(
    extensionPage.getByText('github-actions · high confidence'),
  ).toBeVisible();
  await expect(
    extensionPage.getByText('Schedule: Asia/Tokyo · Browser: Asia/Tokyo'),
  ).toBeVisible();
  await expect(extensionPage.locator('time')).toHaveCount(5);

  if (process.env.CAPTURE_STORE_SCREENSHOT === '1') {
    await extensionPage.screenshot({
      path: 'docs/images/cron-lens.png',
    });
  }

  await extensionPage.evaluate(() => {
    const files = document.querySelector('#files');
    if (files) files.replaceWith(files.cloneNode(true));
  });
  await expect(lensButtons).toHaveCount(2);
});
