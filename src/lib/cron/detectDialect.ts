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
const DOCUMENT_BOUNDARY = /^\s*[+-]?\s*---\s*$/u;

const yamlValue = (line: string, key: string): string | undefined => {
  const pattern = new RegExp(
    `^\\s*[+-]?\\s*${key}\\s*:\\s*['"]?([^'"#]+?)['"]?\\s*(?:#.*)?$`,
    'iu',
  );
  return pattern.exec(line)?.[1]?.trim();
};

const documentRange = (
  lines: VisibleCodeLine[],
  lineIndex: number,
): VisibleCodeLine[] => {
  let start = lineIndex;
  let end = lineIndex;
  while (start > 0 && !DOCUMENT_BOUNDARY.test(lines[start - 1]?.text ?? '')) {
    start -= 1;
  }
  while (
    end + 1 < lines.length &&
    !DOCUMENT_BOUNDARY.test(lines[end + 1]?.text ?? '')
  ) {
    end += 1;
  }
  return lines.slice(start, end + 1);
};

const findWorkflowTimeZone = (
  lines: VisibleCodeLine[],
  lineIndex: number,
): string | undefined => {
  const current = lines[lineIndex]?.text ?? '';
  const cronIndent = current.search(/\S/u);
  const upperBound = Math.min(lines.length, lineIndex + 13);

  for (let index = lineIndex + 1; index < upperBound; index += 1) {
    const text = lines[index]?.text ?? '';
    if (/^\s*[+-]?\s*-\s*cron\s*:/iu.test(text)) break;
    const timeZone = yamlValue(text, 'timezone');
    if (timeZone) return timeZone;
    const indent = text.search(/\S/u);
    if (text.trim().length > 0 && indent >= 0 && indent < cronIndent) break;
  }
  return undefined;
};

export const detectDialect = (input: DetectionInput): DetectionResult => {
  const { context, filePath, key, lineIndex, lines } = input;

  if (key === 'cron' && WORKFLOW_PATH.test(filePath)) {
    return {
      confidence: 'high',
      dialect: 'github-actions',
      ...(findWorkflowTimeZone(lines, lineIndex)
        ? { scheduleTimeZone: findWorkflowTimeZone(lines, lineIndex) }
        : {}),
    };
  }

  if (key === 'schedule' && YAML_PATH.test(filePath)) {
    const visibleDocument = documentRange(lines, lineIndex);
    const isCronJob = visibleDocument.some(
      ({ text }) => yamlValue(text, 'kind')?.toLowerCase() === 'cronjob',
    );
    if (isCronJob) {
      const scheduleTimeZone = visibleDocument
        .map(({ text }) => yamlValue(text, 'timeZone'))
        .find((value) => value !== undefined);
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
