import type {
  CronCandidate,
  DetectionConfidence,
  VisibleCodeLine,
} from './types';

type DetectionInput = {
  context: CronCandidate['context'];
  filePath: string;
  key: 'cron' | 'schedule';
  lineIndex: number;
  lines: VisibleCodeLine[];
};

type DetectionResult = {
  dialect: CronCandidate['dialect'];
  confidence: DetectionConfidence;
  scheduleTimeZone?: string;
};

const YAML_PATH = /\.ya?ml$/iu;
const WORKFLOW_PATH = /^\.github\/workflows\/.+\.ya?ml$/iu;
const DOCUMENT_BOUNDARY = /^\s*---\s*$/u;

const legacyDiffMarker = (text: string): '+' | '-' | undefined => {
  const marker = text[0];
  return marker === '+' || marker === '-' ? marker : undefined;
};

const inferredDiffSide = (
  line: VisibleCodeLine,
): VisibleCodeLine['diffSide'] => {
  if (line.diffSide) return line.diffSide;
  const marker = legacyDiffMarker(line.text);
  return marker === '+' ? 'addition' : marker === '-' ? 'deletion' : undefined;
};

const codeText = (line: VisibleCodeLine): string =>
  legacyDiffMarker(line.text) ? line.text.slice(1) : line.text;

const currentSideContext = (
  lines: VisibleCodeLine[],
  lineIndex: number,
): { lineIndex: number; lines: VisibleCodeLine[] } => {
  const targetLine = lines[lineIndex] ?? { text: '' };
  const targetPane = targetLine.diffPane;
  const targetSide =
    targetPane === 'left' || inferredDiffSide(targetLine) === 'deletion'
      ? 'deletion'
      : 'addition';
  const oppositeSide = targetSide === 'addition' ? 'deletion' : 'addition';
  const selected = lines
    .map((line, originalIndex) => ({ line, originalIndex }))
    .filter(
      ({ line }) =>
        (targetPane === undefined ||
          line.diffPane === undefined ||
          line.diffPane === targetPane) &&
        inferredDiffSide(line) !== oppositeSide,
    );
  const selectedLineIndex = selected.findIndex(
    ({ originalIndex }) => originalIndex === lineIndex,
  );

  return {
    lineIndex: selectedLineIndex,
    lines: selected.map(({ line }) => ({
      ...line,
      text: codeText(line),
    })),
  };
};

const yamlValue = (line: string, key: string): string | undefined => {
  const pattern = new RegExp(
    `^\\s*(?:-\\s*)?${key}\\s*:\\s*['"]?([^'"#]+?)['"]?\\s*(?:#.*)?$`,
    'iu',
  );
  return pattern.exec(line)?.[1]?.trim();
};

const yamlKeyIndent = (line: string): number =>
  /^\s*(?:-\s+)?/u.exec(line)?.[0].length ?? 0;

const yamlMappingKey = (line: string): string | undefined =>
  /^\s*(?:-\s*)?['"]?([a-z0-9_.-]+)['"]?\s*:\s*(?:#.*)?$/iu.exec(line)?.[1];

const sequenceIndent = (line: string): number | undefined =>
  /^(\s*)-\s+/u.exec(line)?.[1]?.length;

const findParentMapping = (
  lines: VisibleCodeLine[],
  lineIndex: number,
): { index: number; key: string } | undefined => {
  const childIndent = yamlKeyIndent(lines[lineIndex]?.text ?? '');
  for (let index = lineIndex - 1; index >= 0; index -= 1) {
    const text = lines[index]?.text ?? '';
    if (DOCUMENT_BOUNDARY.test(text)) break;
    if (yamlKeyIndent(text) >= childIndent) continue;
    const key = yamlMappingKey(text);
    if (key) return { index, key };
  }
  return undefined;
};

const isWorkflowScheduleCron = (
  lines: VisibleCodeLine[],
  lineIndex: number,
): boolean => {
  const schedule = findParentMapping(lines, lineIndex);
  if (schedule?.key.toLowerCase() !== 'schedule') return false;
  const on = findParentMapping(lines, schedule.index);
  return on?.key.toLowerCase() === 'on';
};

const findParentSpec = (
  lines: VisibleCodeLine[],
  lineIndex: number,
): number | undefined => {
  const parent = findParentMapping(lines, lineIndex);
  return parent?.key.toLowerCase() === 'spec' ? parent.index : undefined;
};

const findOwningKind = (
  lines: VisibleCodeLine[],
  specIndex: number,
): string | undefined => {
  const specIndent = yamlKeyIndent(lines[specIndex]?.text ?? '');
  for (let index = specIndex - 1; index >= 0; index -= 1) {
    const text = lines[index]?.text ?? '';
    if (DOCUMENT_BOUNDARY.test(text)) break;
    const kind = yamlValue(text, 'kind');
    if (kind && yamlKeyIndent(text) === specIndent) return kind;
    const itemIndent = sequenceIndent(text);
    if (itemIndent !== undefined && itemIndent < specIndent) break;
  }
  return undefined;
};

const findSpecTimeZone = (
  lines: VisibleCodeLine[],
  specIndex: number,
  scheduleIndex: number,
): string | undefined => {
  const specIndent = yamlKeyIndent(lines[specIndex]?.text ?? '');
  const scheduleIndent = yamlKeyIndent(lines[scheduleIndex]?.text ?? '');
  for (let index = specIndex + 1; index < lines.length; index += 1) {
    const text = lines[index]?.text ?? '';
    if (DOCUMENT_BOUNDARY.test(text)) break;
    if (
      text.trim().length > 0 &&
      !text.trimStart().startsWith('#') &&
      yamlKeyIndent(text) <= specIndent
    ) {
      break;
    }
    if (yamlKeyIndent(text) !== scheduleIndent) continue;
    const timeZone = yamlValue(text, 'timeZone');
    if (timeZone) return timeZone;
  }
  return undefined;
};

const findWorkflowTimeZone = (
  lines: VisibleCodeLine[],
  lineIndex: number,
): string | undefined => {
  const schedule = findParentMapping(lines, lineIndex);
  if (schedule?.key.toLowerCase() !== 'schedule') return undefined;
  const fieldIndent = yamlKeyIndent(lines[lineIndex]?.text ?? '');
  let itemStart = lineIndex;
  for (let index = lineIndex; index > schedule.index; index -= 1) {
    const text = lines[index]?.text ?? '';
    if (
      sequenceIndent(text) !== undefined &&
      yamlKeyIndent(text) === fieldIndent
    ) {
      itemStart = index;
      break;
    }
  }
  const itemIndent = sequenceIndent(lines[itemStart]?.text ?? '');
  if (itemIndent === undefined) return undefined;

  for (let index = itemStart; index < lines.length; index += 1) {
    const text = lines[index]?.text ?? '';
    if (
      index > itemStart &&
      sequenceIndent(text) === itemIndent &&
      yamlKeyIndent(text) === fieldIndent
    ) {
      break;
    }
    if (DOCUMENT_BOUNDARY.test(text)) break;
    if (
      text.trim().length > 0 &&
      !text.trimStart().startsWith('#') &&
      yamlKeyIndent(text) <= yamlKeyIndent(lines[schedule.index]?.text ?? '')
    ) {
      break;
    }
    if (yamlKeyIndent(text) !== fieldIndent) continue;
    const timeZone = yamlValue(text, 'timezone');
    if (timeZone) return timeZone;
  }
  return undefined;
};

export const detectDialect = (input: DetectionInput): DetectionResult => {
  const { context, filePath, key } = input;
  const detectionContext =
    context === 'pull-request-diff'
      ? currentSideContext(input.lines, input.lineIndex)
      : { lineIndex: input.lineIndex, lines: input.lines };
  const { lineIndex, lines } = detectionContext;

  if (
    key === 'cron' &&
    WORKFLOW_PATH.test(filePath) &&
    isWorkflowScheduleCron(lines, lineIndex)
  ) {
    const scheduleTimeZone = findWorkflowTimeZone(lines, lineIndex);
    return {
      confidence: 'high',
      dialect: 'github-actions',
      ...(scheduleTimeZone ? { scheduleTimeZone } : {}),
    };
  }

  if (key === 'schedule' && YAML_PATH.test(filePath)) {
    const specIndex = findParentSpec(lines, lineIndex);
    const kind =
      specIndex === undefined ? undefined : findOwningKind(lines, specIndex);
    if (kind?.toLowerCase() === 'cronjob' && specIndex !== undefined) {
      const scheduleTimeZone = findSpecTimeZone(lines, specIndex, lineIndex);
      return {
        confidence: 'high',
        dialect: 'kubernetes',
        ...(scheduleTimeZone ? { scheduleTimeZone } : {}),
      };
    }
  }

  return {
    confidence: context === 'pull-request-diff' ? 'low' : 'medium',
    dialect: 'unknown-posix',
  };
};
