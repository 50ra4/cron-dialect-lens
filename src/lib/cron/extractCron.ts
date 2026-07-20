const CANDIDATE_PATTERN =
  /^\s*[+-]?\s*(?:-\s*)?(cron|schedule)\s*:\s*(.*?)\s*$/u;

const stripInlineComment = (value: string): string => {
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === "'" || character === '"') && value[index - 1] !== '\\') {
      quote = quote === character ? undefined : (quote ?? character);
      continue;
    }
    if (character === '#' && quote === undefined) return value.slice(0, index);
  }

  return value;
};

const removeMatchingQuotes = (value: string): string => {
  const trimmed = value.trim();
  const first = trimmed[0];
  const last = trimmed.at(-1);
  return (first === "'" || first === '"') && first === last
    ? trimmed.slice(1, -1).trim()
    : trimmed;
};

export type ExtractedCronLine = {
  key: 'cron' | 'schedule';
  expression: string;
};

export const extractCronLine = (
  source: string,
): ExtractedCronLine | undefined => {
  if (source.trimStart().startsWith('#')) return undefined;

  const match = CANDIDATE_PATTERN.exec(source);
  if (!match) return undefined;

  const key = match[1];
  const rawExpression = match[2];
  if ((key !== 'cron' && key !== 'schedule') || rawExpression === undefined) {
    return undefined;
  }

  const expression = removeMatchingQuotes(stripInlineComment(rawExpression));
  if (expression.length === 0) return undefined;
  return { expression, key };
};

const normalizePath = (filePath: string): string =>
  filePath
    .replace(/^\.\//u, '')
    .replace(/\/{2,}/gu, '/')
    .trim();

const hash = (value: string): string => {
  let result = 2_166_136_261;
  for (const character of value) {
    result ^= character.codePointAt(0) ?? 0;
    result = Math.imul(result, 16_777_619);
  }
  return (result >>> 0).toString(36);
};

export const createCronId = (
  filePath: string,
  lineNumber: number | undefined,
  expression: string,
): string =>
  `cron-lens-${hash(
    `${normalizePath(filePath)}:${lineNumber ?? 'unknown'}:${expression.trim().replace(/\s+/gu, ' ')}`,
  )}`;
