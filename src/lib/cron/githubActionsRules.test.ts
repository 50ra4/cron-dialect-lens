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
});
