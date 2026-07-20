import { detectDialect } from '../../../lib/cron/detectDialect';
import { createCronId, extractCronLine } from '../../../lib/cron/extractCron';
import type { CronCandidate, VisibleCodeLine } from '../../../lib/cron/types';

export type GitHubCronMatch = {
  candidate: CronCandidate;
  injectionTarget: HTMLElement;
  lineElement: HTMLElement;
};

type GitHubPage =
  | { context: 'blob'; filePathFromUrl?: string }
  | { context: 'pull-request-diff' };

type RecoveredLine = VisibleCodeLine & {
  element: HTMLElement;
  injectionTarget: HTMLElement;
};

const YAML_PATH = /\.ya?ml$/iu;

const decodePath = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

const parsePage = (url: URL): GitHubPage | undefined => {
  const blob = /^\/[^/]+\/[^/]+\/blob\/[^/]+\/(.+)$/u.exec(url.pathname);
  if (blob?.[1]) {
    return { context: 'blob', filePathFromUrl: decodePath(blob[1]) };
  }
  if (/^\/[^/]+\/[^/]+\/pull\/\d+\/files\/?$/u.test(url.pathname)) {
    return { context: 'pull-request-diff' };
  }
  return undefined;
};

const readLineNumber = (line: HTMLElement): number | undefined => {
  const value =
    line.dataset.lineNumber ??
    line.querySelector<HTMLElement>('[data-line-number]')?.dataset.lineNumber ??
    line.id.match(/(?:LC?|R)[-_]?(\d+)$/u)?.[1];
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const findCodeCell = (line: HTMLElement): HTMLElement | undefined =>
  line.matches('.blob-code, [data-code-cell], code, .react-code-text')
    ? line
    : (line.querySelector<HTMLElement>(
        '.blob-code, [data-code-cell], code, .react-code-text, td:last-child',
      ) ?? undefined);

const readCodeText = (cell: HTMLElement): string => {
  const copy = cell.cloneNode(true);
  if (!(copy instanceof HTMLElement)) return cell.textContent ?? '';
  copy
    .querySelectorAll('[data-cron-dialect-lens-button]')
    .forEach((button) => button.remove());
  return copy.textContent ?? '';
};

const recoverUsingSelector = (
  root: ParentNode,
  selector: string,
): RecoveredLine[] =>
  [...root.querySelectorAll<HTMLElement>(selector)]
    .map((element): RecoveredLine | undefined => {
      const injectionTarget = findCodeCell(element);
      if (!injectionTarget) return undefined;
      return {
        element,
        injectionTarget,
        lineNumber: readLineNumber(element),
        text: readCodeText(injectionTarget),
      };
    })
    .filter((line): line is RecoveredLine => line !== undefined);

const recoverLines = (root: ParentNode): RecoveredLine[] => {
  for (const selector of [
    'table tr',
    '[role="grid"] [role="row"]',
    '.js-file-line, [data-testid="code-line"]',
    '[id^="LC"], [id^="L"]',
  ]) {
    const lines = recoverUsingSelector(root, selector);
    if (lines.length > 0) return lines;
  }
  return [];
};

const visibleFilePath = (root: ParentNode): string | undefined => {
  const values = [
    root instanceof HTMLElement ? root.dataset.path : undefined,
    root instanceof HTMLElement ? root.dataset.filePath : undefined,
    root.querySelector<HTMLElement>('[data-file-path]')?.dataset.filePath,
    root.querySelector<HTMLElement>('[data-path]')?.dataset.path,
  ];
  return values.find((value) => value !== undefined && YAML_PATH.test(value));
};

const matchesForFile = (
  root: ParentNode,
  filePath: string,
  context: CronCandidate['context'],
): GitHubCronMatch[] => {
  if (!YAML_PATH.test(filePath)) return [];
  const lines = recoverLines(root);
  const matches: GitHubCronMatch[] = [];

  lines.forEach((line, lineIndex) => {
    const extracted = extractCronLine(line.text);
    if (!extracted) return;
    const id = createCronId(filePath, line.lineNumber, extracted.expression);

    const detection = detectDialect({
      context,
      filePath,
      key: extracted.key,
      lineIndex,
      lines,
    });
    matches.push({
      candidate: {
        confidence: detection.confidence,
        context,
        dialect: detection.dialect,
        expression: extracted.expression,
        filePath,
        id,
        lineNumber: line.lineNumber,
        ...(detection.scheduleTimeZone
          ? { scheduleTimeZone: detection.scheduleTimeZone }
          : {}),
      },
      injectionTarget: line.injectionTarget,
      lineElement: line.element,
    });
  });
  return matches;
};

const pullRequestFileContainers = (document: Document): HTMLElement[] => {
  const selectors = [
    '.file[data-path]',
    '[data-testid="diff-file"]',
    '[data-file-path]',
  ];
  for (const selector of selectors) {
    const containers = [...document.querySelectorAll<HTMLElement>(selector)];
    if (containers.length > 0) return containers;
  }
  return [];
};

export const scanGitHubCronCandidates = (
  document: Document,
  url: URL,
): GitHubCronMatch[] => {
  try {
    const page = parsePage(url);
    if (!page) return [];

    if (page.context === 'blob') {
      const filePath = visibleFilePath(document) ?? page.filePathFromUrl;
      return filePath ? matchesForFile(document, filePath, 'blob') : [];
    }

    return pullRequestFileContainers(document).flatMap((container) => {
      const filePath = visibleFilePath(container);
      return filePath
        ? matchesForFile(container, filePath, 'pull-request-diff')
        : [];
    });
  } catch (error: unknown) {
    if (import.meta.env.DEV) {
      console.warn('Cron Dialect Lens could not scan this GitHub view.', error);
    }
    return [];
  }
};
