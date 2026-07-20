import { createRoot, type Root } from 'react-dom/client';

import { analyzeCron } from '../../lib/cron/analyzeCron';
import type {
  CronAnalysis,
  CronAnalysisEnvironment,
} from '../../lib/cron/types';
import { CronLensPanel } from './CronLensPanel';
import panelStyles from './cronLens.css?inline';
import { scanGitHubCronCandidates } from './github/githubCronAdapter';

const BUTTON_SELECTOR = '[data-cron-dialect-lens-button]';
const PANEL_SELECTOR = '[data-cron-dialect-lens-panel]';
const SCAN_DELAY = 100;

type StartCronLensOptions = {
  document?: Document;
  environment?: CronAnalysisEnvironment;
  url?: URL;
};

type CronLensRuntime = {
  cleanup: () => void;
  scan: () => void;
};

type PanelController = {
  cleanup: () => void;
  hide: () => void;
  host: HTMLElement;
  show: (analysis: CronAnalysis, anchor: HTMLElement) => void;
};

const createPanelController = (document: Document): PanelController => {
  document.querySelector(PANEL_SELECTOR)?.remove();
  const host = document.createElement('div');
  host.dataset.cronDialectLensPanel = '';
  host.hidden = true;
  document.body.append(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = panelStyles;
  const mount = document.createElement('div');
  shadowRoot.append(style, mount);
  const root: Root = createRoot(mount);

  const hide = (): void => {
    host.hidden = true;
    root.render(null);
  };

  const show = (analysis: CronAnalysis, anchor: HTMLElement): void => {
    root.render(<CronLensPanel analysis={analysis} />);
    host.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const viewportWidth = document.defaultView?.innerWidth ?? 1024;
    const viewportHeight = document.defaultView?.innerHeight ?? 768;
    const panelWidth = Math.min(360, viewportWidth - 16);
    const estimatedHeight = Math.min(560, viewportHeight - 16);
    const left = Math.max(
      8,
      Math.min(rect.left, viewportWidth - panelWidth - 8),
    );
    const below = rect.bottom + 8;
    const top =
      below + estimatedHeight <= viewportHeight
        ? below
        : Math.max(8, rect.top - estimatedHeight - 8);
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  };

  return {
    cleanup: () => {
      root.unmount();
      host.remove();
    },
    hide,
    host,
    show,
  };
};

const createButtonStyles = (document: Document): HTMLStyleElement => {
  document.querySelector('[data-cron-dialect-lens-styles]')?.remove();
  const style = document.createElement('style');
  style.dataset.cronDialectLensStyles = '';
  style.textContent = `
    ${BUTTON_SELECTOR} {
      box-sizing: border-box;
      width: 20px;
      height: 20px;
      margin-inline-start: 6px;
      padding: 0;
      border: 1px solid currentColor;
      border-radius: 50%;
      background: transparent;
      color: #0969da;
      cursor: pointer;
      font: 12px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      vertical-align: middle;
    }
    ${BUTTON_SELECTOR}[data-has-warning="true"] { color: #9a6700; }
    ${BUTTON_SELECTOR}:hover,
    ${BUTTON_SELECTOR}:focus-visible {
      outline: 2px solid #0969da;
      outline-offset: 1px;
    }
  `;
  document.head.append(style);
  return style;
};

const defaultEnvironment = (document: Document): CronAnalysisEnvironment => ({
  browserTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  language: document.defaultView?.navigator.language || 'en',
});

export const startCronLens = (
  options: StartCronLensOptions = {},
): CronLensRuntime => {
  const document = options.document ?? window.document;
  if (!document.body)
    return { cleanup: () => undefined, scan: () => undefined };

  const environment = options.environment ?? defaultEnvironment(document);
  const panel = createPanelController(document);
  const buttonStyles = createButtonStyles(document);
  const buttons = new Map<string, HTMLButtonElement>();
  const analyses = new WeakMap<HTMLButtonElement, CronAnalysis>();
  const view = document.defaultView;
  let scanTimer: number | undefined;
  let activeButton: HTMLButtonElement | undefined;

  const currentUrl = (): URL =>
    options.url ??
    new URL(document.defaultView?.location.href ?? 'https://github.com/');

  const scan = (): void => {
    const matches = scanGitHubCronCandidates(document, currentUrl());
    matches.forEach(({ candidate, injectionTarget, lineElement }) => {
      const analysis = analyzeCron(candidate, new Date(), environment);
      const existing = buttons.get(candidate.id);
      if (existing?.isConnected) {
        analyses.set(existing, analysis);
        existing.dataset.hasWarning = String(analysis.warnings.length > 0);
        const icon = analysis.warnings.length > 0 ? '⚠' : '◉';
        if (existing.textContent !== icon) existing.textContent = icon;
        lineElement.dataset.cronDialectLensId = candidate.id;
        if (activeButton === existing && !panel.host.hidden) {
          panel.show(analysis, existing);
        }
        return;
      }
      buttons.delete(candidate.id);

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.cronDialectLensButton = candidate.id;
      button.dataset.hasWarning = String(analysis.warnings.length > 0);
      button.ariaLabel = 'Explain cron schedule';
      button.title = 'Explain cron schedule';
      button.textContent = analysis.warnings.length > 0 ? '⚠' : '◉';

      analyses.set(button, analysis);
      const open = (): void => {
        const currentAnalysis = analyses.get(button);
        if (!currentAnalysis) return;
        activeButton = button;
        panel.show(currentAnalysis, button);
      };
      button.addEventListener('mouseenter', open);
      button.addEventListener('focus', open);
      button.addEventListener('click', open);
      injectionTarget.append(button);
      lineElement.dataset.cronDialectLensId = candidate.id;
      buttons.set(candidate.id, button);
    });
  };

  const scheduleScan = (): void => {
    if (!view) return;
    if (scanTimer !== undefined) view.clearTimeout(scanTimer);
    scanTimer = view.setTimeout(() => {
      scanTimer = undefined;
      scan();
    }, SCAN_DELAY);
  };

  const Observer = view?.MutationObserver ?? MutationObserver;
  const observer = new Observer(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });

  const onDocumentClick = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Element && target.closest(BUTTON_SELECTOR)) return;
    if (event.composedPath().includes(panel.host)) return;
    activeButton = undefined;
    panel.hide();
  };
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      activeButton = undefined;
      panel.hide();
    }
  };
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeyDown);
  document.defaultView?.addEventListener('popstate', scheduleScan);
  document.defaultView?.addEventListener('pageshow', scheduleScan);

  scan();

  return {
    cleanup: () => {
      observer.disconnect();
      if (scanTimer !== undefined) view?.clearTimeout(scanTimer);
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onDocumentKeyDown);
      document.defaultView?.removeEventListener('popstate', scheduleScan);
      document.defaultView?.removeEventListener('pageshow', scheduleScan);
      buttons.forEach((button) => {
        const line = button.closest<HTMLElement>('[data-cron-dialect-lens-id]');
        if (line) delete line.dataset.cronDialectLensId;
        button.remove();
      });
      buttons.clear();
      buttonStyles.remove();
      panel.cleanup();
    },
    scan,
  };
};

if (import.meta.env.MODE !== 'test') startCronLens();
