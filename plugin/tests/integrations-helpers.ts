/**
 * Shared test helpers for campaign platform integration adapter tests.
 */

import { vi } from "vitest";
import type {
	IntegrationEnv,
	IntegrationSubmission,
} from "../../src/lib/integrations/types.js";

export interface CapturedCall {
	url: string;
	init: RequestInit;
}

export function makeFetchStub(
	response: Partial<Response> & {
		ok: boolean;
		status?: number;
		body?: string;
	},
) {
	const calls: CapturedCall[] = [];
	const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init: init ?? {} });
		return {
			ok: response.ok,
			status: response.status ?? (response.ok ? 200 : 500),
			text: async () => response.body ?? "",
			json: async () => ({}),
		} as Response;
	});
	return { fn, calls };
}

export function baseEnv(
	overrides: Partial<IntegrationEnv> = {},
): IntegrationEnv {
	return { ...overrides };
}

export function baseSubmission(
	overrides: Partial<IntegrationSubmission> = {},
): IntegrationSubmission {
	return {
		type: "event_rsvp",
		slug: "rally-2026",
		email: "ada@example.com",
		firstName: "Ada",
		lastName: "Lovelace",
		postalCode: "20001",
		pageTitle: "Spring Rally 2026",
		pageUrl: "https://adpena.com/act/rally-2026",
		...overrides,
	};
}
