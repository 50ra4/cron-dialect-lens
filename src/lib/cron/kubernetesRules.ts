import type { CronWarning } from './types';

const OFFICIAL_MACROS = new Set([
  '@annually',
  '@yearly',
  '@monthly',
  '@weekly',
  '@daily',
  '@hourly',
]);

export const getKubernetesWarnings = (
  expression: string,
  _scheduleTimeZone?: string,
): CronWarning[] => {
  const normalized = expression.trim();
  if (/^(?:CRON_TZ|TZ)\s*=/iu.test(normalized)) {
    return [
      {
        code: 'KUBERNETES_TZ_IN_SCHEDULE',
        message:
          'Kubernetes does not support TZ or CRON_TZ inside spec.schedule; use spec.timeZone.',
        severity: 'error',
      },
    ];
  }

  if (normalized.startsWith('@')) {
    return OFFICIAL_MACROS.has(normalized.toLowerCase())
      ? []
      : [
          {
            code: 'INVALID_EXPRESSION',
            message: 'This cron macro is not supported by Kubernetes CronJob.',
            severity: 'error',
          },
        ];
  }

  if (normalized.split(/\s+/u).length !== 5) {
    return [
      {
        code: 'INVALID_EXPRESSION',
        message:
          'Kubernetes CronJob schedules must contain five cron fields or a supported macro.',
        severity: 'error',
      },
    ];
  }
  return [];
};
