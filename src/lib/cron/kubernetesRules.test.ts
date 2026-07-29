import { getKubernetesWarnings } from './kubernetesRules';

describe('getKubernetesWarnings', () => {
  it('allows an official macro', () => {
    expect(getKubernetesWarnings('@daily', 'Asia/Tokyo')).toEqual([]);
  });

  it.each(['TZ=Asia/Tokyo 0 3 * * *', 'CRON_TZ=UTC 0 3 * * *'])(
    'rejects an embedded timezone: %s',
    (expression) => {
      expect(getKubernetesWarnings(expression, 'Asia/Tokyo')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'KUBERNETES_TZ_IN_SCHEDULE',
            severity: 'error',
          }),
        ]),
      );
    },
  );

  it.each(['0 0 L * *', '0 0 * * 1#2', 'H * * * *'])(
    'rejects Kubernetes unsupported syntax: %s',
    (expression) => {
      expect(getKubernetesWarnings(expression)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_EXPRESSION',
            severity: 'error',
          }),
        ]),
      );
    },
  );

  it.each([
    '5-55/10 0 * * 1-5',
    '5 0 1 JAN MON',
    '0 0 ? * MON',
    '0 0 * * 0',
    '0 0 * * 6',
    '0 0 * * 0-6',
    '0 0 * * SUN',
    '0 0 * * SAT',
  ])('accepts Kubernetes standard syntax: %s', (expression) => {
    expect(getKubernetesWarnings(expression)).toEqual([]);
  });

  it.each(['0 0 * * 7', '0 0 * * 0-7'])(
    'explains the unsupported Kubernetes day-of-week range: %s',
    (expression) => {
      expect(getKubernetesWarnings(expression)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_EXPRESSION',
            message:
              'Kubernetes CronJob day-of-week must use 0-6 or SUN-SAT; 7 is not allowed (use 0 or SUN for Sunday).',
            severity: 'error',
          }),
        ]),
      );
    },
  );
});
