import type { CronAnalysis } from '../../lib/cron/types';

type CronLensPanelProps = {
  analysis: CronAnalysis;
};

const timeZoneSummary = (analysis: CronAnalysis): string =>
  analysis.effectiveTimeZone
    ? `Schedule: ${analysis.effectiveTimeZone} · Browser: ${analysis.browserTimeZone}`
    : `Schedule: unknown (controller-dependent) · Browser: ${analysis.browserTimeZone}`;

export const CronLensPanel = ({ analysis }: CronLensPanelProps) => (
  <aside aria-label="Cron schedule explanation" className="cron-lens-panel">
    <header>
      <strong>
        {analysis.candidate.dialect} · {analysis.candidate.confidence}{' '}
        confidence
      </strong>
    </header>

    <section>
      <h2>Expression</h2>
      <code>{analysis.candidate.expression}</code>
    </section>

    <section>
      <h2>Description</h2>
      <p>{analysis.description ?? 'Description unavailable.'}</p>
    </section>

    <section>
      <h2>Timezone</h2>
      <p>{timeZoneSummary(analysis)}</p>
    </section>

    <section>
      <h2>Next runs</h2>
      {analysis.nextRuns.length > 0 ? (
        <ol>
          {analysis.nextRuns.map((run) => (
            <li key={run.instant}>
              <time dateTime={run.instant}>{run.scheduleTime}</time>
              {analysis.effectiveTimeZone !== analysis.browserTimeZone && (
                <small>Browser: {run.browserTime}</small>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p>Next runs unavailable.</p>
      )}
    </section>

    {analysis.warnings.length > 0 && (
      <section>
        <h2>Warnings</h2>
        <ul className="cron-lens-warnings">
          {analysis.warnings.map((warning) => (
            <li data-severity={warning.severity} key={warning.code}>
              <span aria-hidden="true">
                {warning.severity === 'error' ? '✕' : '⚠'}
              </span>{' '}
              {warning.message}
            </li>
          ))}
        </ul>
      </section>
    )}

    <footer>Processed locally. No code is sent anywhere.</footer>
  </aside>
);
