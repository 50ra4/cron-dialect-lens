import { detectDialect } from '../../../lib/cron/detectDialect';
import { createCronId, extractCronLine } from '../../../lib/cron/extractCron';
import type { CronCandidate, VisibleCodeLine } from '../../../lib/cron/types';

export type GitHubCronMatch = {
  candidate: CronCandidate;
  injectionTarget: HTMLElement;
  lineElement: HTMLElement;
};

type GitHubPage = { context: 'blob' } | { context: 'pull-request-diff' };

type RecoveredLine = VisibleCodeLine & {
  element: HTMLElement;
  injectionTarget: HTMLElement;
};

type RawRecoveredLine = RecoveredLine & {
  textMarkerHint: boolean;
};

const YAML_PATH = /\.ya?ml$/iu;

const parsePage = (url: URL): GitHubPage | undefined => {
  if (/^\/[^/]+\/[^/]+\/blob\/.+\/.+$/u.test(url.pathname))
    return { context: 'blob' };
  if (/^\/[^/]+\/[^/]+\/pull\/\d+\/files\/?$/u.test(url.pathname)) {
    return { context: 'pull-request-diff' };
  }
  return undefined;
};

const readLineNumberValue = (element: HTMLElement): string | undefined =>
  element.dataset.lineNumber ??
  element.querySelector<HTMLElement>('[data-line-number]')?.dataset
    .lineNumber ??
  element.id.match(/(?:LC?|R)[-_]?(\d+)$/u)?.[1];

const precedingGutter = (cell: HTMLElement): HTMLElement | undefined => {
  let sibling = cell.previousElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement) {
      if (sibling.matches('.blob-num, [data-line-number]')) return sibling;
      if (
        sibling.matches('.blob-code, [data-code-cell], code, .react-code-text')
      ) {
        break;
      }
      if (cell.tagName === 'TD' && sibling.tagName === 'TD') return sibling;
    }
    sibling = sibling.previousElementSibling;
  }
  return undefined;
};

const precedingLineNumber = (cell: HTMLElement): string | undefined => {
  let sibling = cell.previousElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement) {
      const value = readLineNumberValue(sibling);
      if (value !== undefined) return value;
      if (
        sibling.matches('.blob-code, [data-code-cell], code, .react-code-text')
      ) {
        break;
      }
    }
    sibling = sibling.previousElementSibling;
  }
  return undefined;
};

const readLineNumber = (
  line: HTMLElement,
  cell: HTMLElement,
): number | undefined => {
  const value =
    readLineNumberValue(cell) ??
    precedingLineNumber(cell) ??
    readLineNumberValue(line);
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const findCodeCells = (line: HTMLElement): HTMLElement[] => {
  if (line.matches('.blob-code, [data-code-cell], code, .react-code-text')) {
    return [line];
  }
  for (const selector of [
    '.blob-code',
    '[data-code-cell]',
    'code',
    '.react-code-text',
  ]) {
    const cells = [...line.querySelectorAll<HTMLElement>(selector)];
    if (cells.length > 0) return cells;
  }
  const fallback = [
    ...line.querySelectorAll<HTMLElement>(
      'td:not([data-cron-dialect-lens-slot])',
    ),
  ].at(-1);
  return fallback ? [fallback] : [];
};

const readCodeText = (cell: HTMLElement): string => {
  const copy = cell.cloneNode(true);
  if (!(copy instanceof HTMLElement)) return cell.textContent ?? '';
  copy
    .querySelectorAll(
      '[data-code-marker], [data-cron-dialect-lens-button], [data-cron-dialect-lens-slot]',
    )
    .forEach((injected) => injected.remove());
  return copy.textContent ?? '';
};

const normalizeDiffSide = (
  value: string | undefined,
): VisibleCodeLine['diffSide'] => {
  switch (value?.toLowerCase()) {
    case '+':
    case 'add':
    case 'added':
    case 'addition':
      return 'addition';
    case '-':
    case 'delete':
    case 'deleted':
    case 'deletion':
      return 'deletion';
    case 'context':
    case 'unchanged':
      return 'context';
    default:
      return undefined;
  }
};

const readDiffSide = (
  line: HTMLElement,
  cell: HTMLElement,
): VisibleCodeLine['diffSide'] => {
  const marker = cell.querySelector<HTMLElement>('[data-code-marker]');
  for (const value of [
    cell.dataset.diffSide,
    cell.dataset.lineType,
    cell.dataset.codeMarker,
    marker?.dataset.codeMarker,
    line.dataset.diffSide,
    line.dataset.lineType,
  ]) {
    const side = normalizeDiffSide(value);
    if (side) return side;
  }

  const classRoot = cell.matches(
    '.blob-code-addition, .blob-code-context, .blob-code-deletion',
  )
    ? cell
    : line.querySelector<HTMLElement>(
        '.blob-code-addition, .blob-code-context, .blob-code-deletion',
      );
  if (classRoot?.classList.contains('blob-code-addition')) return 'addition';
  if (classRoot?.classList.contains('blob-code-deletion')) return 'deletion';
  if (classRoot?.classList.contains('blob-code-context')) return 'context';
  return undefined;
};

const diffMarker = (
  side: VisibleCodeLine['diffSide'],
): '+' | '-' | ' ' | undefined => {
  switch (side) {
    case 'addition':
      return '+';
    case 'deletion':
      return '-';
    case 'context':
      return ' ';
    default:
      return undefined;
  }
};

const recoverUsingSelector = (
  root: ParentNode,
  selector: string,
): RecoveredLine[] => {
  const recovered = [...root.querySelectorAll<HTMLElement>(selector)].flatMap(
    (element) =>
      findCodeCells(element).map(
        (injectionTarget, cellIndex, cells): RawRecoveredLine => {
          const diffSide = readDiffSide(element, injectionTarget);
          const diffPane =
            cells.length > 1 ? (cellIndex === 0 ? 'left' : 'right') : undefined;
          const hasRenderedMarker =
            injectionTarget.querySelector('[data-code-marker]') !== null;
          const textMarkerHint =
            !hasRenderedMarker &&
            [
              injectionTarget.dataset.diffSide,
              injectionTarget.dataset.lineType,
              injectionTarget.dataset.codeMarker,
              element.dataset.diffSide,
              element.dataset.lineType,
            ].some((value) => normalizeDiffSide(value) !== undefined);
          return {
            ...(diffPane ? { diffPane } : {}),
            ...(diffSide ? { diffSide } : {}),
            element: injectionTarget,
            injectionTarget:
              precedingGutter(injectionTarget) ?? injectionTarget,
            lineNumber: readLineNumber(element, injectionTarget),
            text: readCodeText(injectionTarget),
            textMarkerHint,
          };
        },
      ),
  );

  const sidedLines = recovered.filter(
    (line) => diffMarker(line.diffSide) !== undefined && line.text.length > 0,
  );
  const hasTextMarkers =
    recovered.some((line) => line.textMarkerHint) &&
    sidedLines.length > 0 &&
    // A non-empty markerless context row mixed into a text-marker hunk is
    // inherently ambiguous, so leave that file unnormalized.
    sidedLines.every((line) => {
      const marker = diffMarker(line.diffSide);
      return marker !== undefined && line.text.startsWith(marker);
    });

  return recovered.map(({ textMarkerHint: _, ...line }): RecoveredLine => {
    const marker = diffMarker(line.diffSide);
    return {
      ...line,
      text:
        hasTextMarkers && marker !== undefined && line.text.startsWith(marker)
          ? line.text.slice(1)
          : line.text,
    };
  });
};

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
    const id = createCronId(
      filePath,
      line.lineNumber,
      extracted.expression,
      line.diffSide,
      line.diffPane,
    );

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
      const filePath = visibleFilePath(document);
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
