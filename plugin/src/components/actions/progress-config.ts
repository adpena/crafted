import type { ProgressBarProps } from "../ProgressBar.tsx";

/**
 * Configurable progress bar settings passed via action_props.
 * All fields are optional — sensible defaults are applied per action type.
 */
export interface ProgressConfig {
  /** Enable the progress bar (default: false) */
  enabled?: boolean;
  /** Target number of submissions */
  goal?: number;
  /** Display mode */
  mode?: ProgressBarProps["mode"];
  /** i18n label key */
  labelKey?: ProgressBarProps["labelKey"];
  /** Override fill color */
  accentColor?: string;
  /** ISO deadline for countdown mode */
  deadline?: string;
  /** Live refresh interval in ms (0 = no refresh). Default: 0 */
  refreshInterval?: number;
  /** Override the count endpoint URL */
  countUrl?: string;
  /** SSE endpoint for live updates (e.g., /api/action/stream?slug=X) */
  sseUrl?: string;
  /**
   * Initial count offset for platform migration.
   * When set, the progress bar adds this to the live count from the API.
   * Example: "we already have 5,000 signatures from our previous platform."
   */
  initialCount?: number;
}
