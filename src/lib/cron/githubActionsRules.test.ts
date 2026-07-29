import { getGitHubActionsWarnings } from './githubActionsRules';

describe('getGitHubActionsWarnings', () => {
  it.each([
    ['@daily', 'GITHUB_UNSUPPORTED_MACRO'],
    ['0 0 3 * * *', 'INVALID_EXPRESSION'],
    ['0 * * * *', 'GITHUB_TOP_OF_HOUR_DELAY'],
  ] as const)('flags %s with %s', (expression, code) => {
    expect(getGitHubActionsWarnings(expression)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it('accepts a five-field expression away from the top of the hour', () => {
    expect(getGitHubActionsWarnings('5 * * * *')).toEqual([]);
  });

  it.each([
    '5-55/10 0 * * 1-5',
    '5 0 1 JAN MON',
    '0 0 * * 0',
    '0 0 * * 6',
    '0 0 * * 0-6',
    '0 0 * * SUN',
    '0 0 * * SAT',
  ])('accepts GitHub Actions standard syntax: %s', (expression) => {
    expect(
      getGitHubActionsWarnings(expression).filter(
        ({ severity }) => severity === 'error',
      ),
    ).toEqual([]);
  });

  it.each([
    '0 0 L * *',
    '0 0 * * 1#2',
    'H * * * *',
    '0 0 ? * MON',
    '60 * * * *',
    '5 24 * * *',
  ])('rejects GitHub Actions unsupported syntax: %s', (expression) => {
    expect(getGitHubActionsWarnings(expression)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_EXPRESSION',
          severity: 'error',
        }),
      ]),
    );
  });

  it.each(['0 0 * * 7', '0 0 * * 0-7'])(
    'explains the unsupported GitHub Actions day-of-week range: %s',
    (expression) => {
      expect(getGitHubActionsWarnings(expression)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_EXPRESSION',
            message:
              'GitHub Actions day-of-week must use 0-6 or SUN-SAT; 7 is not allowed (use 0 or SUN for Sunday).',
            severity: 'error',
          }),
        ]),
      );
    },
  );
});
