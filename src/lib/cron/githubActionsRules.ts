import type { CronWarning } from './types';
import {
  findStandardCronFieldViolation,
  formatStandardCronFieldViolation,
} from './standardCronFields';

const warning = (
  code: CronWarning['code'],
  severity: CronWarning['severity'],
  message: string,
): CronWarning => ({ code, message, severity });

const includesZero = (minuteField: string): boolean => {
  if (minuteField === '*') return true;
  return minuteField.split(',').some((part) => {
    const base = part.split('/')[0];
    if (base === '*') return true;
    const [start, end] = base?.split('-') ?? [];
    if (end !== undefined) {
      const startNumber = Number(start);
      const endNumber = Number(end);
      return startNumber === 0 && endNumber >= 0;
    }
    return Number(base) === 0;
  });
};

export const getGitHubActionsWarnings = (expression: string): CronWarning[] => {
  const normalized = expression.trim();
  if (normalized.startsWith('@')) {
    return [
      warning(
        'GITHUB_UNSUPPORTED_MACRO',
        'error',
        'GitHub Actions does not support cron macros such as @daily.',
      ),
    ];
  }

  const fields = normalized.split(/\s+/u);
  if (fields.length !== 5) {
    return [
      warning(
        'INVALID_EXPRESSION',
        'error',
        'GitHub Actions schedules must contain exactly five cron fields.',
      ),
    ];
  }

  const violation = findStandardCronFieldViolation(normalized);
  if (violation) {
    return [
      warning(
        'INVALID_EXPRESSION',
        'error',
        formatStandardCronFieldViolation('GitHub Actions', violation),
      ),
    ];
  }

  return fields[0] !== undefined && includesZero(fields[0])
    ? [
        warning(
          'GITHUB_TOP_OF_HOUR_DELAY',
          'info',
          'Runs near the start of an hour can be delayed or dropped during high load.',
        ),
      ]
    : [];
};
