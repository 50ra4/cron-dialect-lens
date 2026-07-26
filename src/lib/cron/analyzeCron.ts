import { CronExpressionParser } from 'cron-parser';
import { toString as describeExpression } from 'cronstrue';
import 'cronstrue/locales/ja';

import { getGitHubActionsWarnings } from './githubActionsRules';
import { getKubernetesWarnings } from './kubernetesRules';
import type {
  CronAnalysis,
  CronAnalysisEnvironment,
  CronCandidate,
  CronWarning,
} from './types';

const SEVERITY_ORDER: Record<CronWarning['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
};

const formatTime = (date: Date, timeZone: string, language: string): string =>
  new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'long',
    timeZone,
  }).format(date);

const invalidTimeZoneWarning = (timeZone: string): CronWarning => ({
  code: 'INVALID_EXPRESSION',
  message: `The IANA timezone ${timeZone} is invalid or unavailable.`,
  severity: 'error',
});

const invalidExpressionWarning = (error: unknown): CronWarning => ({
  code: 'INVALID_EXPRESSION',
  message:
    error instanceof Error ? error.message : 'The cron expression is invalid.',
  severity: 'error',
});

const validateExpression = (
  expression: string,
  currentDate: Date,
): CronWarning | undefined => {
  try {
    CronExpressionParser.parse(expression, { currentDate });
    return undefined;
  } catch (error: unknown) {
    return invalidExpressionWarning(error);
  }
};

const describe = (expression: string, language: string): string | undefined => {
  try {
    return describeExpression(expression, {
      locale: language.toLowerCase().startsWith('ja') ? 'ja' : 'en',
      throwExceptionOnParseError: true,
      use24HourTimeFormat: true,
    });
  } catch {
    return undefined;
  }
};

const parseNextRuns = (
  expression: string,
  currentDate: Date,
  timeZone: string,
  environment: CronAnalysisEnvironment,
): CronAnalysis['nextRuns'] => {
  const interval = CronExpressionParser.parse(expression, {
    currentDate,
    tz: timeZone,
  });
  return Array.from({ length: 5 }, () => interval.next().toDate()).map(
    (date) => ({
      browserTime: formatTime(
        date,
        environment.browserTimeZone,
        environment.language,
      ),
      instant: date.toISOString(),
      scheduleTime: formatTime(date, timeZone, environment.language),
    }),
  );
};

const intervalWarning = (
  nextRuns: CronAnalysis['nextRuns'],
): CronWarning | undefined => {
  const instants = nextRuns.map(({ instant }) => Date.parse(instant));
  for (let index = 1; index < instants.length; index += 1) {
    const current = instants[index];
    const previous = instants[index - 1];
    if (
      current !== undefined &&
      previous !== undefined &&
      current - previous < 5 * 60 * 1000
    ) {
      return {
        code: 'GITHUB_INTERVAL_TOO_SHORT',
        message:
          'GitHub Actions schedules cannot run more often than every 5 minutes.',
        severity: 'warning',
      };
    }
  }
  return undefined;
};

const baseWarnings = (candidate: CronCandidate): CronWarning[] => {
  if (candidate.dialect === 'github-actions') {
    return getGitHubActionsWarnings(candidate.expression);
  }
  if (candidate.dialect === 'kubernetes') {
    return getKubernetesWarnings(
      candidate.expression,
      candidate.scheduleTimeZone,
    );
  }
  const warnings: CronWarning[] = [
    {
      code: 'DIALECT_UNCERTAIN',
      message:
        'Dialect not confirmed because the required YAML context is not visible.',
      severity: 'warning',
    },
  ];
  if (
    candidate.expression.startsWith('@') ||
    candidate.expression.split(/\s+/u).length !== 5
  ) {
    warnings.push({
      code: 'INVALID_EXPRESSION',
      message:
        'An unknown POSIX schedule must contain exactly five cron fields.',
      severity: 'error',
    });
  }
  return warnings;
};

const effectiveTimeZone = (candidate: CronCandidate): string | undefined => {
  if (candidate.dialect === 'github-actions') {
    return candidate.scheduleTimeZone ?? 'UTC';
  }
  if (candidate.dialect === 'kubernetes') return candidate.scheduleTimeZone;
  return undefined;
};

export const analyzeCron = (
  candidate: CronCandidate,
  now: Date,
  environment: CronAnalysisEnvironment,
): CronAnalysis => {
  const expression = candidate.expression.trim().replace(/\s+/gu, ' ');
  const normalizedCandidate = { ...candidate, expression };
  const warnings = baseWarnings(normalizedCandidate);
  const timeZone = effectiveTimeZone(normalizedCandidate);
  let nextRuns: CronAnalysis['nextRuns'] = [];

  if (candidate.dialect === 'kubernetes' && timeZone === undefined) {
    warnings.push({
      code: 'KUBERNETES_CONTROLLER_TIMEZONE_UNKNOWN',
      message:
        'spec.timeZone is absent; execution depends on the kube-controller-manager timezone.',
      severity: 'warning',
    });
  }

  if (timeZone !== undefined && !isValidTimeZone(timeZone)) {
    warnings.push(invalidTimeZoneWarning(timeZone));
  } else if (
    timeZone === undefined &&
    !warnings.some(({ severity }) => severity === 'error')
  ) {
    const syntaxWarning = validateExpression(expression, now);
    if (syntaxWarning) warnings.push(syntaxWarning);
  } else if (
    timeZone !== undefined &&
    !warnings.some(({ severity }) => severity === 'error')
  ) {
    try {
      nextRuns = parseNextRuns(expression, now, timeZone, environment);
      if (candidate.dialect === 'github-actions') {
        const shortInterval = intervalWarning(nextRuns);
        if (shortInterval) warnings.push(shortInterval);
      }
    } catch (error: unknown) {
      warnings.push(invalidExpressionWarning(error));
    }
  }

  warnings.sort(
    (left, right) =>
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity],
  );
  const hasError = warnings.some(({ severity }) => severity === 'error');

  return {
    browserTimeZone: environment.browserTimeZone,
    candidate: normalizedCandidate,
    description: hasError
      ? undefined
      : describe(expression, environment.language),
    effectiveTimeZone: timeZone,
    nextRuns,
    warnings,
  };
};
