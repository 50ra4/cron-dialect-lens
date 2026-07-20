import { scanGitHubCronCandidates } from './githubCronAdapter';
import actionsBlob from './fixtures/actions-blob.html?raw';
import kubernetesBlob from './fixtures/kubernetes-blob.html?raw';
import incompletePullRequest from './fixtures/pr-incomplete.html?raw';
import pullRequestFiles from './fixtures/pr-files.html?raw';

const fixtures: Record<string, string> = {
  'actions-blob.html': actionsBlob,
  'kubernetes-blob.html': kubernetesBlob,
  'pr-incomplete.html': incompletePullRequest,
  'pr-files.html': pullRequestFiles,
};

const loadFixture = (name: string): Document => {
  const html = fixtures[name];
  if (html === undefined) throw new Error(`Unknown fixture: ${name}`);
  return new DOMParser().parseFromString(html, 'text/html');
};

describe('scanGitHubCronCandidates', () => {
  it('extracts path, line, expression, and timezone from a blob', () => {
    const document = loadFixture('actions-blob.html');
    const matches = scanGitHubCronCandidates(
      document,
      new URL(
        'https://github.com/acme/widgets/blob/main/.github/workflows/nightly.yml',
      ),
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.candidate).toMatchObject({
      confidence: 'high',
      dialect: 'github-actions',
      expression: '*/5 * * * *',
      filePath: '.github/workflows/nightly.yml',
      lineNumber: 3,
      scheduleTimeZone: 'Asia/Tokyo',
    });
  });

  it('extracts Kubernetes context from a grid-style blob', () => {
    const document = loadFixture('kubernetes-blob.html');
    const matches = scanGitHubCronCandidates(
      document,
      new URL('https://github.com/acme/widgets/blob/main/deploy/cronjob.yaml'),
    );

    expect(matches[0]?.candidate).toMatchObject({
      confidence: 'high',
      dialect: 'kubernetes',
      expression: '0 3 * * 1',
      lineNumber: 5,
      scheduleTimeZone: 'Asia/Tokyo',
    });
  });

  it('scans only YAML files in a PR and does not duplicate annotations', () => {
    const document = loadFixture('pr-files.html');
    const url = new URL('https://github.com/acme/widgets/pull/42/files');

    const first = scanGitHubCronCandidates(document, url);
    first.forEach(({ candidate, lineElement }) => {
      lineElement.dataset.cronDialectLensId = candidate.id;
    });
    const second = scanGitHubCronCandidates(document, url);

    expect(first).toHaveLength(2);
    expect(first.map(({ candidate }) => candidate.filePath)).toEqual([
      '.github/workflows/ci.yml',
      'deploy/cronjob.yaml',
    ]);
    expect(second).toEqual([]);
  });

  it('returns no matches for unsupported GitHub routes', () => {
    expect(
      scanGitHubCronCandidates(
        loadFixture('actions-blob.html'),
        new URL('https://github.com/acme/widgets/commit/abc'),
      ),
    ).toEqual([]);
  });

  it('downgrades an incomplete PR diff instead of assuming Kubernetes', () => {
    const matches = scanGitHubCronCandidates(
      loadFixture('pr-incomplete.html'),
      new URL('https://github.com/acme/widgets/pull/42/files'),
    );

    expect(matches[0]?.candidate).toMatchObject({
      confidence: 'low',
      dialect: 'unknown-posix',
    });
  });
});
