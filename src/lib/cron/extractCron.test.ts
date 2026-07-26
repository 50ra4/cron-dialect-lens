import { createCronId, extractCronLine } from './extractCron';

describe('extractCronLine', () => {
  it.each([
    ["  - cron: '*/5 * * * *'", 'cron', '*/5 * * * *'],
    ['    schedule: "0 3 * * 1" # weekly', 'schedule', '0 3 * * 1'],
    [
      '    schedule: CRON_TZ=Asia/Tokyo 0 3 * * *',
      'schedule',
      'CRON_TZ=Asia/Tokyo 0 3 * * *',
    ],
    ['      - cron: 0 0 * * 5#2', 'cron', '0 0 * * 5#2'],
    ['      - cron: 0 0 * * * # comment', 'cron', '0 0 * * *'],
  ])('extracts %s', (source, key, expression) => {
    expect(extractCronLine(source)).toEqual({ expression, key });
  });

  it.each(['# cron: 0 * * * *', 'name: cron', 'schedulePolicy: daily'])(
    'ignores non-candidate line %s',
    (source) => {
      expect(extractCronLine(source)).toBeUndefined();
    },
  );

  it.each([
    'cron:',
    'cron: |',
    'cron: |-',
    'cron: >',
    'cron: >-',
    'schedule: |+',
  ])('ignores empty or block-scalar candidate %s', (source) => {
    expect(extractCronLine(source)).toBeUndefined();
  });
});

describe('createCronId', () => {
  it('normalizes path, line, and expression into a stable id', () => {
    expect(createCronId('.github/workflows/ci.yml', 12, ' 0 * * * * ')).toBe(
      createCronId('./.github/workflows/ci.yml', 12, '0   * * * *'),
    );
  });

  it('keeps addition and deletion candidates distinct on a split diff', () => {
    expect(
      createCronId('deploy/cronjob.yaml', 23, '0 3 * * 1', 'addition'),
    ).not.toBe(
      createCronId('deploy/cronjob.yaml', 23, '0 3 * * 1', 'deletion'),
    );
  });
});
