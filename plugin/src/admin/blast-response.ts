export interface DryRunResponse {
	dry_run: true;
	eligible: number;
}

export interface SendResponse {
	sent: number;
	failed: number;
	skipped: number;
	errors: string[];
}

function isCount(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseDryRunResponse(value: unknown): DryRunResponse {
	if (value && typeof value === "object" && "dry_run" in value && value.dry_run === true &&
		"eligible" in value && isCount(value.eligible)) {
		return { dry_run: true, eligible: value.eligible };
	}
	throw new Error("The server returned an invalid recipient preview. Please try again.");
}

export function parseSendResponse(value: unknown): SendResponse {
	if (value && typeof value === "object" &&
		"sent" in value && isCount(value.sent) &&
		"failed" in value && isCount(value.failed) &&
		"skipped" in value && isCount(value.skipped) &&
		"errors" in value && Array.isArray(value.errors) &&
		value.errors.every((error): error is string => typeof error === "string")) {
		return { sent: value.sent, failed: value.failed, skipped: value.skipped, errors: value.errors };
	}
	// Sending may have succeeded even if the response was malformed. Do not suggest a retry.
	throw new Error("The server returned an invalid send result. Check delivery status before sending again.");
}
