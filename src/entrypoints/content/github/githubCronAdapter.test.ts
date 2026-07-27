import { scanGitHubCronCandidates } from './githubCronAdapter';
import actionsBlob from './fixtures/actions-blob.html?raw';
import kubernetesBlob from './fixtures/kubernetes-blob.html?raw';
import incompletePullRequest from './fixtures/pr-incomplete.html?raw';
import pullRequestFiles from './fixtures/pr-files.html?raw';
import reactMarkerPullRequest from './fixtures/pr-react-markers.html?raw';
import sequenceDashPullRequest from './fixtures/pr-sequence-dashes.html?raw';
import splitPullRequest from './fixtures/pr-split.html?raw';

const fixtures: Record<string, string> = {
  'actions-blob.html': actionsBlob,
  'kubernetes-blob.html': kubernetesBlob,
  'pr-incomplete.html': incompletePullRequest,
  'pr-files.html': pullRequestFiles,
  'pr-react-markers.html': reactMarkerPullRequest,
  'pr-sequence-dashes.html': sequenceDashPullRequest,
  'pr-split.html': splitPullRequest,
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

  it('uses rendered path metadata when the blob ref contains slashes', () => {
    const matches = scanGitHubCronCandidates(
      loadFixture('actions-blob.html'),
      new URL(
        'https://github.com/acme/widgets/blob/feature/foo/.github/workflows/nightly.yml',
      ),
    );

    expect(matches[0]?.candidate).toMatchObject({
      confidence: 'high',
      dialect: 'github-actions',
      filePath: '.github/workflows/nightly.yml',
    });
  });

  it('does not guess a blob path from a slash-containing ref without metadata', () => {
    const document = loadFixture('actions-blob.html');
    document.querySelector('[data-path]')?.remove();

    expect(
      scanGitHubCronCandidates(
        document,
        new URL(
          'https://github.com/acme/widgets/blob/feature/foo/.github/workflows/nightly.yml',
        ),
      ),
    ).toEqual([]);
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

  it('rescans YAML candidates in a PR so existing annotations can refresh', () => {
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
    expect(first[1]?.candidate.scheduleTimeZone).toBe('Asia/Tokyo');
    expect(second).toHaveLength(2);
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

  it('recovers both code cells and their line numbers from a split PR diff', () => {
    const matches = scanGitHubCronCandidates(
      loadFixture('pr-split.html'),
      new URL('https://github.com/acme/widgets/pull/42/files'),
    );

    expect(matches).toHaveLength(2);
    expect(
      matches.map(({ candidate }) => ({
        lineNumber: candidate.lineNumber,
        scheduleTimeZone: candidate.scheduleTimeZone,
      })),
    ).toEqual([
      { lineNumber: 23, scheduleTimeZone: 'UTC' },
      { lineNumber: 23, scheduleTimeZone: 'Asia/Tokyo' },
    ]);
    expect(new Set(matches.map(({ candidate }) => candidate.id)).size).toBe(2);
    matches.forEach(({ injectionTarget, lineElement }) => {
      expect(lineElement).not.toBe(injectionTarget);
      expect(injectionTarget.classList.contains('blob-num')).toBe(true);
    });
  });

  it('removes rendered and text diff markers before detecting both sides', () => {
    const matches = scanGitHubCronCandidates(
      loadFixture('pr-react-markers.html'),
      new URL('https://github.com/acme/widgets/pull/42/files'),
    );

    expect(
      matches.map(({ candidate }) => ({
        confidence: candidate.confidence,
        dialect: candidate.dialect,
        expression: candidate.expression,
      })),
    ).toEqual([
      {
        confidence: 'high',
        dialect: 'github-actions',
        expression: '0 0 * * *',
      },
      {
        confidence: 'high',
        dialect: 'github-actions',
        expression: '0 9 * * *',
      },
      {
        confidence: 'high',
        dialect: 'github-actions',
        expression: '0 0 * * *',
      },
      {
        confidence: 'high',
        dialect: 'github-actions',
        expression: '0 9 * * *',
      },
    ]);
  });

  it('preserves YAML sequence dashes with rendered or text diff markers', () => {
    const matches = scanGitHubCronCandidates(
      loadFixture('pr-sequence-dashes.html'),
      new URL('https://github.com/acme/widgets/pull/42/files'),
    );

    expect(
      matches.map(({ candidate }) => ({
        confidence: candidate.confidence,
        dialect: candidate.dialect,
        scheduleTimeZone: candidate.scheduleTimeZone,
      })),
    ).toEqual([
      {
        confidence: 'high',
        dialect: 'kubernetes',
        scheduleTimeZone: 'Asia/Tokyo',
      },
      {
        confidence: 'high',
        dialect: 'kubernetes',
        scheduleTimeZone: 'Asia/Tokyo',
      },
    ]);
  });
});
