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

  it.each([
    {
      expected: {
        confidence: 'high',
        dialect: 'kubernetes',
        scheduleTimeZone: 'Asia/Tokyo',
      },
      name: 'uses only added context for an added schedule',
      source: [
        '+kind: CronJob',
        '+spec:',
        '-  timeZone: UTC',
        '+  timeZone: Asia/Tokyo',
        "+  schedule: '0 3 * * 1'",
      ],
      target: 4,
    },
    {
      expected: { confidence: 'low', dialect: 'unknown-posix' },
      name: 'ignores a removed kind for an added schedule',
      source: [
        '-kind: CronJob',
        '+kind: ConfigMap',
        '+spec:',
        "+  schedule: '0 3 * * 1'",
      ],
      target: 3,
    },
  ])('$name', ({ expected, source, target }) => {
    expect(
      detectDialect({
        context: 'pull-request-diff',
        filePath: 'deploy/cronjob.yaml',
        key: 'schedule',
        lineIndex: target,
        lines: lines(...source),
      }),
    ).toEqual(expected);
  });

  it.each([
    {
      name: 'metadata',
      source: [
        'kind: CronJob',
        'metadata:',
        '  annotations:',
        '    timeZone: UTC',
        'spec:',
        "  schedule: '0 3 * * 1'",
      ],
      target: 5,
    },
    {
      name: 'a nested pod template',
      source: [
        'kind: CronJob',
        'spec:',
        "  schedule: '0 3 * * 1'",
        '  jobTemplate:',
        '    spec:',
        '      template:',
        '        spec:',
        '          timeZone: UTC',
      ],
      target: 2,
    },
    {
      name: 'another CronJob in a List',
      source: [
        'kind: List',
        'items:',
        '  - kind: CronJob',
        '    spec:',
        '      timeZone: UTC',
        "      schedule: '0 1 * * *'",
        '  - kind: CronJob',
        '    spec:',
        "      schedule: '0 3 * * 1'",
      ],
      target: 8,
    },
  ])('does not use timeZone from $name', ({ source, target }) => {
    expect(
      detectDialect({
        context: 'blob',
        filePath: 'deploy/cronjob.yaml',
        key: 'schedule',
        lineIndex: target,
        lines: lines(...source),
      }),
    ).toEqual({ confidence: 'high', dialect: 'kubernetes' });
  });
});
