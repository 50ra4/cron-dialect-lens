import { render, screen } from '@testing-library/react';

import { CronLensPanel } from './CronLensPanel';
import type { CronAnalysis } from '../../lib/cron/types';

const analysis: CronAnalysis = {
  browserTimeZone: 'Asia/Tokyo',
  candidate: {
    confidence: 'high',
    context: 'blob',
    dialect: 'github-actions',
    expression: '*/5 * * * *',
    filePath: '.github/workflows/ci.yml',
    id: 'example',
  },
  description: 'Every 5 minutes',
  effectiveTimeZone: 'UTC',
  nextRuns: [
    {
      browserTime: 'Jan 1, 2026, 9:05 AM GMT+9',
      instant: '2026-01-01T00:05:00.000Z',
      scheduleTime: 'Jan 1, 2026, 12:05 AM UTC',
    },
  ],
  warnings: [
    {
      code: 'GITHUB_TOP_OF_HOUR_DELAY',
      message: 'Runs near the top of the hour may be delayed.',
      severity: 'info',
    },
  ],
};

describe('CronLensPanel', () => {
  it('renders the required analysis fields and local-processing disclosure', () => {
    render(<CronLensPanel analysis={analysis} />);

    expect(screen.getByText('github-actions · high confidence')).toBeVisible();
    expect(screen.getByText('*/5 * * * *')).toBeVisible();
    expect(screen.getByText('Every 5 minutes')).toBeVisible();
    expect(
      screen.getByText('Schedule: UTC · Browser: Asia/Tokyo'),
    ).toBeVisible();
    expect(screen.getByText(/Processed locally/u)).toBeVisible();
    expect(document.querySelector('time')).toHaveAttribute(
      'datetime',
      '2026-01-01T00:05:00.000Z',
    );
  });
});
