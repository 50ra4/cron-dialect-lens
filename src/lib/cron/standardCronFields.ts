type CronFieldSpec = {
  field: CronFieldName;
  maximum: number;
  minimum: number;
  names?: readonly string[];
};

export type CronFieldName =
  'minute' | 'hour' | 'day-of-month' | 'month' | 'day-of-week';

export type StandardCronFieldViolation = {
  field: CronFieldName;
  maximum: number;
  minimum: number;
  names?: readonly string[];
  value: string;
};

const FIELD_SPECS: readonly CronFieldSpec[] = [
  { field: 'minute', maximum: 59, minimum: 0 },
  { field: 'hour', maximum: 23, minimum: 0 },
  { field: 'day-of-month', maximum: 31, minimum: 1 },
  {
    field: 'month',
    maximum: 12,
    minimum: 1,
    names: [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ],
  },
  {
    // GitHub Actions and Kubernetes/robfig cron both document 0-6.
    field: 'day-of-week',
    maximum: 6,
    minimum: 0,
    names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
  },
];

const fieldValue = (value: string, spec: CronFieldSpec): number | undefined => {
  if (/^\d+$/u.test(value)) {
    const parsed = Number(value);
    return parsed >= spec.minimum && parsed <= spec.maximum
      ? parsed
      : undefined;
  }

  const nameIndex = spec.names?.indexOf(value.toUpperCase()) ?? -1;
  return nameIndex >= 0 ? spec.minimum + nameIndex : undefined;
};

const validFieldPart = (part: string, spec: CronFieldSpec): boolean => {
  const stepParts = part.split('/');
  if (stepParts.length > 2) return false;
  const [base, step] = stepParts;
  if (base === undefined || base.length === 0) return false;
  if (step !== undefined && (!/^\d+$/u.test(step) || Number(step) === 0)) {
    return false;
  }
  if (base === '*') return true;

  const range = base.split('-');
  if (range.length > 2) return false;
  const start = range[0];
  if (start === undefined) return false;
  const startValue = fieldValue(start, spec);
  if (startValue === undefined) return false;
  const end = range[1];
  if (end === undefined) return true;
  const endValue = fieldValue(end, spec);
  return endValue !== undefined && startValue <= endValue;
};

const validField = (
  field: string,
  spec: CronFieldSpec,
  allowQuestionMark: boolean,
): boolean =>
  (allowQuestionMark && field === '?') ||
  (field.length > 0 &&
    field.split(',').every((part) => validFieldPart(part, spec)));

export const findStandardCronFieldViolation = (
  expression: string,
  options: { allowQuestionMark?: boolean } = {},
): StandardCronFieldViolation | undefined => {
  const fields = expression.trim().split(/\s+/u);
  if (fields.length !== FIELD_SPECS.length) return undefined;

  for (const [index, field] of fields.entries()) {
    const spec = FIELD_SPECS[index];
    if (spec === undefined) continue;
    const allowQuestionMark =
      options.allowQuestionMark === true && (index === 2 || index === 4);
    if (!validField(field, spec, allowQuestionMark)) {
      return {
        field: spec.field,
        maximum: spec.maximum,
        minimum: spec.minimum,
        ...(spec.names ? { names: spec.names } : {}),
        value: field,
      };
    }
  }
  return undefined;
};

export const formatStandardCronFieldViolation = (
  subject: string,
  violation: StandardCronFieldViolation,
): string => {
  const numericTokens = violation.value.split(/\D+/u);
  if (violation.field === 'day-of-week' && numericTokens.includes('7')) {
    return `${subject} day-of-week must use 0-6 or SUN-SAT; 7 is not allowed (use 0 or SUN for Sunday).`;
  }
  const namedRange = violation.names
    ? ` or ${violation.names[0]}-${violation.names.at(-1)}`
    : '';
  return `${subject} ${violation.field} must use ${violation.minimum}-${violation.maximum}${namedRange}; received "${violation.value}".`;
};

export const isStandardCronExpression = (
  expression: string,
  options: { allowQuestionMark?: boolean } = {},
): boolean =>
  expression.trim().split(/\s+/u).length === FIELD_SPECS.length &&
  findStandardCronFieldViolation(expression, options) === undefined;
