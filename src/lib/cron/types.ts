export type CronDialect = 'github-actions' | 'kubernetes' | 'unknown-posix';

export type DetectionConfidence = 'high' | 'medium' | 'low';

export type DiffLineSide = 'addition' | 'context' | 'deletion';

export type DiffLinePane = 'left' | 'right';

export type CronCandidate = {
  id: string;
  expression: string;
  filePath: string;
  lineNumber?: number;
  dialect: CronDialect;
  confidence: DetectionConfidence;
  scheduleTimeZone?: string;
  context: 'blob' | 'pull-request-diff';
};

export type CronWarningCode =
  | 'GITHUB_INTERVAL_TOO_SHORT'
  | 'GITHUB_UNSUPPORTED_MACRO'
  | 'GITHUB_TOP_OF_HOUR_DELAY'
  | 'KUBERNETES_CONTROLLER_TIMEZONE_UNKNOWN'
  | 'KUBERNETES_TZ_IN_SCHEDULE'
  | 'DIALECT_UNCERTAIN'
  | 'INVALID_EXPRESSION';

export type CronWarning = {
  code: CronWarningCode;
  severity: 'info' | 'warning' | 'error';
  message: string;
};

export type CronAnalysis = {
  candidate: CronCandidate;
  description?: string;
  effectiveTimeZone?: string;
  browserTimeZone: string;
  nextRuns: Array<{
    instant: string;
    scheduleTime: string;
    browserTime: string;
  }>;
  warnings: CronWarning[];
};

export type VisibleCodeLine = {
  diffPane?: DiffLinePane;
  diffSide?: DiffLineSide;
  lineNumber?: number;
  text: string;
};

export type CronAnalysisEnvironment = {
  browserTimeZone: string;
  language: string;
};
