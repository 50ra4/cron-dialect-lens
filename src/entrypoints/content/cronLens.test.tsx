import { fireEvent, waitFor } from '@testing-library/dom';

import { startCronLens } from './cronLens';
import fixture from './github/fixtures/pr-files.html?raw';
import splitFixture from './github/fixtures/pr-split.html?raw';

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
    const codeCells = document.querySelectorAll<HTMLElement>('.blob-code');
    expect(codeCells[2]?.textContent).toBe("    - cron: '0 * * * *'");
    expect(codeCells[7]?.textContent).toBe("  schedule: '0 3 * * 1'");
    document
      .querySelectorAll<HTMLButtonElement>('[data-cron-dialect-lens-button]')
      .forEach((button) => expect(button.textContent).toBe(''));
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

  it('injects separate buttons into both sides of a split PR diff', () => {
    document.documentElement.innerHTML = splitFixture;
    const runtime = startCronLens({
      document,
      environment: {
        browserTimeZone: 'Asia/Tokyo',
        language: 'en',
      },
      url: new URL('https://github.com/acme/widgets/pull/42/files'),
    });

    const splitScheduleCells = document.querySelectorAll(
      'tr:last-child .blob-code-context',
    );
    expect(splitScheduleCells).toHaveLength(2);
    splitScheduleCells.forEach((cell) => {
      expect(
        cell.previousElementSibling?.querySelectorAll(
          '[data-cron-dialect-lens-button]',
        ),
      ).toHaveLength(1);
      expect(cell.querySelector('[data-cron-dialect-lens-button]')).toBeNull();
    });

    runtime.cleanup();
  });

  it('keeps fallback table rows stable and refreshable across rescans', async () => {
    document.documentElement.innerHTML = `
      <body>
        <div data-path="deploy/cronjob.yaml"></div>
        <table>
          <tr data-line-number="1"><td>1</td><td>kind: CronJob</td></tr>
          <tr data-line-number="2"><td>2</td><td>spec:</td></tr>
          <tr data-line-number="3"><td>3</td><td>  timeZone: UTC</td></tr>
          <tr data-line-number="4"><td>4</td><td>  schedule: '0 3 * * 1'</td></tr>
        </table>
      </body>
    `;
    const runtime = startCronLens({
      document,
      environment: {
        browserTimeZone: 'Asia/Tokyo',
        language: 'en',
      },
      url: new URL(
        'https://github.com/acme/widgets/blob/main/deploy/cronjob.yaml',
      ),
    });
    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Explain cron schedule"]',
    );
    expect(button).not.toBeNull();
    expect(document.querySelectorAll('tr:last-child > td')).toHaveLength(2);

    const kindCell = document.querySelector<HTMLElement>(
      'tr:first-child > td:last-child',
    );
    expect(kindCell).not.toBeNull();
    (kindCell as HTMLElement).textContent = 'kind: ConfigMap';
    runtime.scan();
    fireEvent.click(button as HTMLButtonElement);

    const panelHost = document.querySelector('[data-cron-dialect-lens-panel]');
    await waitFor(() => {
      expect(panelHost?.shadowRoot?.textContent).toContain('unknown-posix');
    });

    runtime.cleanup();
  });
});
