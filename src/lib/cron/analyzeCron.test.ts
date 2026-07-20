import { analyzeCron } from './analyzeCron';
import type { CronCandidate, CronDialect } from './types';

const candidate = (
  dialect: CronDialect,
  expression: string,
  scheduleTimeZone?: string,
): CronCandidate => ({
  confidence: dialect === 'unknown-posix' ? 'low' : 'high',
  context: 'blob',
  dialect,
  expression,
  filePath:
    dialect === 'github-actions'
      ? '.github/workflows/ci.yml'
      : 'deploy/cronjob.yaml',
  id: `${dialect}-${expression}`,
  lineNumber: 10,
  scheduleTimeZone,
});

const now = new Date('2026-01-01T00:00:00.000Z');
const environment = { browserTimeZone: 'Asia/Tokyo', language: 'en' };

describe('analyzeCron', () => {
  it.each([
    ['*/5 * * * *', undefined, 5, undefined],
    ['* * * * *', undefined, 5, 'GITHUB_INTERVAL_TOO_SHORT'],
    ['0 * * * *', undefined, 5, 'GITHUB_TOP_OF_HOUR_DELAY'],
    ['@daily', undefined, 0, 'GITHUB_UNSUPPORTED_MACRO'],
    ['0 0 3 * * *', undefined, 0, 'INVALID_EXPRESSION'],
    ['0 3 * * *', 'Asia/Tokyo', 5, undefined],
    ['0 3 * * *', 'Mars/Olympus', 0, 'INVALID_EXPRESSION'],
  ] as const)(
    'analyzes GitHub Actions expression %s',
    (expression, timeZone, nextRunCount, warningCode) => {
      const analysis = analyzeCron(
        candidate('github-actions', expression, timeZone),
        now,
        environment,
      );

      expect(analysis.effectiveTimeZone).toBe(timeZone ?? 'UTC');
      expect(analysis.nextRuns).toHaveLength(nextRunCount);
      if (warningCode) {
        expect(analysis.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ code: warningCode }),
          ]),
        );
      }
    },
  );

  it('does not claim Kubernetes run times without spec.timeZone', () => {
    const analysis = analyzeCron(
      candidate('kubernetes', '0 3 * * 1'),
      now,
      environment,
    );

    expect(analysis.effectiveTimeZone).toBeUndefined();
    expect(analysis.nextRuns).toEqual([]);
    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'KUBERNETES_CONTROLLER_TIMEZONE_UNKNOWN',
        }),
      ]),
    );
  });

  it.each([
    ['kubernetes', 'KUBERNETES_CONTROLLER_TIMEZONE_UNKNOWN'],
    ['unknown-posix', 'DIALECT_UNCERTAIN'],
  ] as const)(
    'rejects invalid %s syntax without calculating environment-specific run times',
    (dialect, expectedContextWarning) => {
      const analysis = analyzeCron(
        candidate(dialect, '61 * * * *'),
        now,
        environment,
      );

      expect(analysis.nextRuns).toEqual([]);
      expect(analysis.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'INVALID_EXPRESSION',
            severity: 'error',
          }),
          expect.objectContaining({ code: expectedContextWarning }),
        ]),
      );
    },
  );

  it('supports Kubernetes macros with an explicit timezone', () => {
    const analysis = analyzeCron(
      candidate('kubernetes', '@daily', 'Asia/Tokyo'),
      now,
      environment,
    );

    expect(analysis.nextRuns).toHaveLength(5);
    expect(analysis.warnings).toEqual([]);
  });

  it('rejects CRON_TZ in Kubernetes schedules before parsing', () => {
    const analysis = analyzeCron(
      candidate('kubernetes', 'CRON_TZ=Asia/Tokyo 0 3 * * *', 'Asia/Tokyo'),
      now,
      environment,
    );

    expect(analysis.nextRuns).toEqual([]);
    expect(analysis.warnings[0]?.code).toBe('KUBERNETES_TZ_IN_SCHEDULE');
  });

  it('keeps unknown POSIX analysis free of environment-specific warnings', () => {
    const analysis = analyzeCron(
      candidate('unknown-posix', '0 3 * * 1'),
      now,
      environment,
    );

    expect(analysis.nextRuns).toEqual([]);
    expect(analysis.warnings.map(({ code }) => code)).toContain(
      'DIALECT_UNCERTAIN',
    );
    expect(analysis.warnings.map(({ code }) => code)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^(GITHUB|KUBERNETES)_/u)]),
    );
  });

  it('rejects a non-five-field expression even when the dialect is unknown', () => {
    const analysis = analyzeCron(
      candidate('unknown-posix', '0 0 3 * * *'),
      now,
      environment,
    );

    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_EXPRESSION',
          severity: 'error',
        }),
      ]),
    );
  });

  it('uses the selected Japanese or English cronstrue locale', () => {
    const target = candidate('github-actions', '*/5 * * * *');
    const english = analyzeCron(target, now, environment).description;
    const japanese = analyzeCron(target, now, {
      ...environment,
      language: 'ja-JP',
    }).description;

    expect(english).toMatch(/Every 5 minutes/iu);
    expect(japanese).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
    expect(japanese).not.toBe(english);
  });

  it('keeps five runs correct across a DST transition', () => {
    const analysis = analyzeCron(
      candidate('github-actions', '0 3 * * *', 'America/New_York'),
      new Date('2026-03-07T00:00:00.000Z'),
      environment,
    );

    expect(analysis.nextRuns).toHaveLength(5);
    const first = Date.parse(analysis.nextRuns[0]?.instant ?? '');
    const second = Date.parse(analysis.nextRuns[1]?.instant ?? '');
    expect((second - first) / 3_600_000).toBe(23);
  });
});
