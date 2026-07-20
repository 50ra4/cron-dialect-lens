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
});
