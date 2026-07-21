type CronFieldSpec = {
  maximum: number;
  minimum: number;
  names?: readonly string[];
};

const FIELD_SPECS: readonly CronFieldSpec[] = [
  { maximum: 59, minimum: 0 },
  { maximum: 23, minimum: 0 },
  { maximum: 31, minimum: 1 },
  {
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
    maximum: 7,
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

const validField = (field: string, spec: CronFieldSpec): boolean =>
  field.length > 0 &&
  field.split(',').every((part) => validFieldPart(part, spec));

export const isStandardCronExpression = (expression: string): boolean => {
  const fields = expression.trim().split(/\s+/u);
  return (
    fields.length === FIELD_SPECS.length &&
    fields.every((field, index) => {
      const spec = FIELD_SPECS[index];
      return spec !== undefined && validField(field, spec);
    })
  );
};
