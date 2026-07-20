import { fireEvent, waitFor } from '@testing-library/dom';

import { startCronLens } from './cronLens';
import fixture from './github/fixtures/pr-files.html?raw';

describe('startCronLens', () => {
  it('injects accessible buttons idempotently and restores them after DOM replacement', async () => {
    document.documentElement.innerHTML = fixture;
    const runtime = startCronLens({
      document,
      environment: {
        browserTimeZone: 'Asia/Tokyo',
        language: 'en',
      },
      url: new URL('https://github.com/acme/widgets/pull/42/files'),
    });

    expect(
      document.querySelectorAll('button[aria-label="Explain cron schedule"]'),
    ).toHaveLength(2);
    runtime.scan();
    expect(
      document.querySelectorAll('button[aria-label="Explain cron schedule"]'),
    ).toHaveLength(2);

    const firstButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Explain cron schedule"]',
    );
    expect(firstButton).not.toBeNull();
    fireEvent.focus(firstButton as HTMLButtonElement);
    const panelHost = document.querySelector('[data-cron-dialect-lens-panel]');
    await waitFor(() => {
      expect(panelHost?.shadowRoot?.textContent).toContain('github-actions');
    });

    document
      .querySelector('#files')
      ?.replaceWith(
        new DOMParser()
          .parseFromString(fixture, 'text/html')
          .querySelector('#files') as Node,
      );
    runtime.scan();
    expect(
      document.querySelectorAll('button[aria-label="Explain cron schedule"]'),
    ).toHaveLength(2);

    runtime.cleanup();
    expect(document.querySelector('[data-cron-dialect-lens-panel]')).toBeNull();
    expect(
      document.querySelectorAll('button[aria-label="Explain cron schedule"]'),
    ).toHaveLength(0);
  });
});
