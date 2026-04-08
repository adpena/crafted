import { t, getLocale, type Locale } from "../lib/i18n.ts";

export interface ProgressBarProps {
	current: number;
	goal: number;
	/** Display label key (e.g., "progress_signatures", "progress_pledges") */
	labelKey?: "progress_signatures" | "progress_pledges" | "progress_signups" | "progress_donors";
	/** Override the fill color */
	accentColor?: string;
	/** Display mode: bar (default), thermometer, countdown */
	mode?: "bar" | "thermometer" | "countdown";
	/** Countdown deadline (ISO date string) — only used in countdown mode */
	deadline?: string;
	/** Locale for translated labels */
	locale?: Locale;
}

/**
 * Animated progress indicator showing campaign momentum.
 *
 * Modes:
 * - **bar**: horizontal progress bar with "X of Y" label
 * - **thermometer**: vertical fill with percentage
 * - **countdown**: shows time remaining + progress toward goal
 *
 * Only renders when goal > 0. Accent color defaults to theme --page-accent.
 */
export function ProgressBar({
	current,
	goal,
	labelKey = "progress_signatures",
	accentColor,
	mode = "bar",
	deadline,
	locale: localeProp,
}: ProgressBarProps) {
	if (!goal || goal <= 0) return null;

	const locale = getLocale(localeProp);
	const pct = Math.min(100, Math.round((current / goal) * 100));
	const formatted = current.toLocaleString();
	const goalFormatted = goal.toLocaleString();
	const accent = accentColor ?? "var(--page-accent)";
	const label = t(locale, labelKey);

	if (mode === "countdown" && deadline) {
		return <CountdownBar current={current} goal={goal} label={label} accent={accent} pct={pct} formatted={formatted} goalFormatted={goalFormatted} deadline={deadline} locale={locale} />;
	}

	if (mode === "thermometer") {
		return <ThermometerBar pct={pct} accent={accent} formatted={formatted} label={label} />;
	}

	// Default: horizontal bar
	return (
		<div style={{ marginBottom: "1.5rem" }} role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={goal} aria-label={`${label} progress`} aria-valuetext={`${formatted} of ${goalFormatted} ${label}`}>
			<div style={{
				fontFamily: "var(--page-font-mono)",
				fontSize: "0.75rem",
				color: "var(--page-secondary)",
				marginBottom: "0.5rem",
				display: "flex",
				justifyContent: "space-between",
			}}>
				<span><strong>{formatted}</strong> {label}</span>
				<span>{t(locale, "progress_of_goal", { goal: goalFormatted })}</span>
			</div>
			<div style={{
				width: "100%",
				height: "6px",
				backgroundColor: "var(--page-border)",
				borderRadius: "var(--page-radius, 3px)",
				overflow: "hidden",
			}}>
				<div style={{
					width: `${pct}%`,
					height: "100%",
					backgroundColor: accent,
					borderRadius: "inherit",
					transition: "width 600ms ease-out",
				}} />
			</div>
		</div>
	);
}

function CountdownBar({ current, goal, label, accent, pct, formatted, goalFormatted, deadline, locale }: {
	current: number; goal: number; label: string; accent: string; pct: number;
	formatted: string; goalFormatted: string; deadline: string; locale: Locale;
}) {
	const deadlineDate = new Date(deadline);
	const now = new Date();
	const diff = deadlineDate.getTime() - now.getTime();
	const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
	const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

	const urgencyColor = days <= 3 ? "#dc2626" : days <= 7 ? "#ea580c" : accent;

	const timeText = days > 0
		? t(locale, "progress_days_remaining", { days: String(days), hours: String(hours), plural: days !== 1 ? "s" : "" })
		: hours > 0
			? t(locale, "progress_hours_remaining", { hours: String(hours) })
			: t(locale, "progress_deadline_passed");

	return (
		<div style={{ marginBottom: "1.5rem", textAlign: "center" }} role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={goal} aria-label={`${label} progress`} aria-valuetext={`${formatted} of ${goalFormatted} ${label} — ${timeText}`}>
			<div style={{
				fontFamily: "var(--page-font-mono)",
				fontSize: "0.7rem",
				textTransform: "uppercase",
				letterSpacing: "0.1em",
				color: urgencyColor,
				marginBottom: "0.25rem",
				fontWeight: 600,
			}}>
				{timeText}
			</div>
			<div style={{
				fontFamily: "var(--page-font-serif)",
				fontSize: "1.5rem",
				fontWeight: 400,
				color: "var(--page-text)",
				marginBottom: "0.5rem",
			}}>
				<strong>{formatted}</strong> {t(locale, "progress_of_goal", { goal: goalFormatted })} {label}
			</div>
			<div style={{
				width: "100%",
				height: "8px",
				backgroundColor: "var(--page-border)",
				borderRadius: "var(--page-radius, 4px)",
				overflow: "hidden",
			}}>
				<div style={{
					width: `${pct}%`,
					height: "100%",
					backgroundColor: urgencyColor,
					borderRadius: "inherit",
					transition: "width 600ms ease-out",
				}} />
			</div>
		</div>
	);
}

function ThermometerBar({ pct, accent, formatted, label }: {
	pct: number; accent: string; formatted: string; label: string;
}) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} progress`} aria-valuetext={`${pct}% — ${formatted} ${label}`}>
			<div style={{
				width: "3rem",
				height: "8rem",
				backgroundColor: "var(--page-border)",
				borderRadius: "var(--page-radius, 999px)",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				justifyContent: "flex-end",
				flexShrink: 0,
			}}>
				<div style={{
					width: "100%",
					height: `${pct}%`,
					backgroundColor: accent,
					borderRadius: "inherit",
					transition: "height 600ms ease-out",
				}} />
			</div>
			<div>
				<div style={{
					fontFamily: "var(--page-font-serif)",
					fontSize: "1.75rem",
					fontWeight: 400,
					color: "var(--page-text)",
				}}>
					{pct}%
				</div>
				<div style={{
					fontFamily: "var(--page-font-mono)",
					fontSize: "0.7rem",
					color: "var(--page-secondary)",
				}}>
					{formatted} {label}
				</div>
			</div>
		</div>
	);
}
