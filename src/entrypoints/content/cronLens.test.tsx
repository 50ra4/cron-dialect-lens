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
    const initialFirstButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Explain cron schedule"]',
    );
    const initialTextNode = initialFirstButton?.firstChild;
    runtime.scan();
    expect(
      document.querySelectorAll('button[aria-label="Explain cron schedule"]'),
    ).toHaveLength(2);
    expect(initialFirstButton?.firstChild).toBe(initialTextNode);

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

  it('refreshes an existing button when its YAML context changes', async () => {
    document.documentElement.innerHTML = fixture;
    const runtime = startCronLens({
      document,
      environment: {
        browserTimeZone: 'Asia/Tokyo',
        language: 'en',
      },
      url: new URL('https://github.com/acme/widgets/pull/42/files'),
    });
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="Explain cron schedule"]',
    );
    const kubernetesButton = buttons[1];
    expect(kubernetesButton).toBeDefined();

    fireEvent.click(kubernetesButton as HTMLButtonElement);
    const panelHost = document.querySelector('[data-cron-dialect-lens-panel]');
    await waitFor(() => {
      expect(panelHost?.shadowRoot?.textContent).toContain(
        'Schedule: Asia/Tokyo',
      );
    });

    const timeZoneLine = document.querySelector<HTMLElement>(
      '[data-line-number="22"] .blob-code-addition',
    );
    expect(timeZoneLine).not.toBeNull();
    (timeZoneLine as HTMLElement).textContent = '  timeZone: UTC';
    runtime.scan();
    fireEvent.click(kubernetesButton as HTMLButtonElement);
    await waitFor(() => {
      expect(panelHost?.shadowRoot?.textContent).toContain('Schedule: UTC');
    });

    const kindLine = document.querySelector<HTMLElement>(
      '[data-line-number="20"] .blob-code',
    );
    expect(kindLine).not.toBeNull();
    (kindLine as HTMLElement).textContent = 'kind: ConfigMap';
    runtime.scan();

    expect(
      document.querySelectorAll('button[aria-label="Explain cron schedule"]'),
    ).toHaveLength(2);
    expect(kubernetesButton?.dataset.hasWarning).toBe('true');
    fireEvent.click(kubernetesButton as HTMLButtonElement);
    await waitFor(() => {
      expect(panelHost?.shadowRoot?.textContent).toContain('unknown-posix');
    });

    runtime.cleanup();
  });
});
