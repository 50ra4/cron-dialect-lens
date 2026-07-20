import { detectDialect } from './detectDialect';
import type { VisibleCodeLine } from './types';

const lines = (...text: string[]): VisibleCodeLine[] =>
  text.map((value, index) => ({ lineNumber: index + 1, text: value }));

describe('detectDialect', () => {
  it('detects GitHub Actions and its adjacent timezone with high confidence', () => {
    expect(
      detectDialect({
        context: 'blob',
        filePath: '.github/workflows/nightly.yml',
        key: 'cron',
        lineIndex: 2,
        lines: lines(
          'on:',
          '  schedule:',
          "    - cron: '0 3 * * *'",
          '      timezone: Asia/Tokyo',
        ),
      }),
    ).toEqual({
      confidence: 'high',
      dialect: 'github-actions',
      scheduleTimeZone: 'Asia/Tokyo',
    });
  });

  it('detects a visible Kubernetes CronJob and spec.timeZone', () => {
    expect(
      detectDialect({
        context: 'blob',
        filePath: 'deploy/cronjob.yaml',
        key: 'schedule',
        lineIndex: 4,
        lines: lines(
          'apiVersion: batch/v1',
          'kind: CronJob',
          'spec:',
          '  timeZone: Asia/Tokyo',
          "  schedule: '0 3 * * 1'",
        ),
      }),
    ).toEqual({
      confidence: 'high',
      dialect: 'kubernetes',
      scheduleTimeZone: 'Asia/Tokyo',
    });
  });

  it('does not overclaim Kubernetes when a PR diff omits kind context', () => {
    expect(
      detectDialect({
        context: 'pull-request-diff',
        filePath: 'deploy/cronjob.yaml',
        key: 'schedule',
        lineIndex: 0,
        lines: lines("+  schedule: '0 3 * * 1'"),
      }),
    ).toEqual({ confidence: 'low', dialect: 'unknown-posix' });
  });
});
