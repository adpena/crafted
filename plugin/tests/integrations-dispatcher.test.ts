/**
 * Unit tests for the integrations dispatcher.
 *
 * The dispatcher imports all adapter modules statically and invokes each in
 * parallel via Promise.allSettled. These tests mock the adapter modules so
 * we can observe dispatcher orchestration behavior without hitting fetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseSubmission } from "./integrations-helpers.js";
import type { IntegrationEnv } from "../../src/lib/integrations/types.js";

// Hoisted mock factories — must be defined before the module import.
const mocks = vi.hoisted(() => ({
	actionnetwork: vi.fn(async () => undefined),
	mailchimp: vi.fn(async () => undefined),
	nationbuilder: vi.fn(async () => undefined),
	everyaction: vi.fn(async () => undefined),
	mobilize: vi.fn(async () => undefined),
	eventbrite: vi.fn(async () => undefined),
	facebook: vi.fn(async () => undefined),
	sendgrid: vi.fn(async () => undefined),
	constantcontact: vi.fn(async () => undefined),
}));

vi.mock("../../src/lib/integrations/actionnetwork.ts", () => ({
	pushToActionNetwork: mocks.actionnetwork,
}));
vi.mock("../../src/lib/integrations/mailchimp.ts", () => ({
	pushToMailchimp: mocks.mailchimp,
}));
vi.mock("../../src/lib/integrations/nationbuilder.ts", () => ({
	pushToNationBuilder: mocks.nationbuilder,
}));
vi.mock("../../src/lib/integrations/everyaction.ts", () => ({
	pushToEveryAction: mocks.everyaction,
}));
vi.mock("../../src/lib/integrations/mobilize.ts", () => ({
	pushToMobilize: mocks.mobilize,
}));
vi.mock("../../src/lib/integrations/eventbrite.ts", () => ({
	pushToEventbrite: mocks.eventbrite,
}));
vi.mock("../../src/lib/integrations/facebook.ts", () => ({
	pushToFacebookEvent: mocks.facebook,
}));
vi.mock("../../src/lib/integrations/sendgrid.ts", () => ({
	pushToSendGrid: mocks.sendgrid,
}));
vi.mock("../../src/lib/integrations/constantcontact.ts", () => ({
	pushToConstantContact: mocks.constantcontact,
}));

import { dispatchIntegrations } from "../../src/lib/integrations/index.js";

const env: IntegrationEnv = {};

describe("dispatchIntegrations", () => {
	beforeEach(() => {
		for (const fn of Object.values(mocks)) {
			fn.mockReset();
			fn.mockResolvedValue(undefined);
		}
		// Silence expected console.error noise from error paths.
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns empty summary when no adapters are configured", async () => {
		const summary = await dispatchIntegrations({
			submission: baseSubmission(),
			env,
		});
		expect(summary).toEqual({});
	});

	it("calls every adapter in parallel", async () => {
		await dispatchIntegrations({ submission: baseSubmission(), env });
		expect(mocks.actionnetwork).toHaveBeenCalledTimes(1);
		expect(mocks.mailchimp).toHaveBeenCalledTimes(1);
		expect(mocks.nationbuilder).toHaveBeenCalledTimes(1);
		expect(mocks.everyaction).toHaveBeenCalledTimes(1);
		expect(mocks.mobilize).toHaveBeenCalledTimes(1);
		expect(mocks.eventbrite).toHaveBeenCalledTimes(1);
		expect(mocks.facebook).toHaveBeenCalledTimes(1);
		expect(mocks.sendgrid).toHaveBeenCalledTimes(1);
		expect(mocks.constantcontact).toHaveBeenCalledTimes(1);
	});

	it("includes per-adapter ok booleans in summary", async () => {
		mocks.actionnetwork.mockResolvedValue({ ok: true });
		mocks.mailchimp.mockResolvedValue({ ok: false, error: "bad" });
		mocks.mobilize.mockResolvedValue({ ok: true });

		const summary = await dispatchIntegrations({
			submission: baseSubmission(),
			env,
		});
		expect(summary.actionnetwork).toBe(true);
		expect(summary.mailchimp).toBe(false);
		expect(summary.mobilize).toBe(true);
	});

	it("adapter that returns undefined is excluded from summary", async () => {
		mocks.actionnetwork.mockResolvedValue({ ok: true });
		// everything else remains undefined (default)
		const summary = await dispatchIntegrations({
			submission: baseSubmission(),
			env,
		});
		expect(summary).toEqual({ actionnetwork: true });
		expect("mailchimp" in summary).toBe(false);
		expect("nationbuilder" in summary).toBe(false);
	});

	it("adapter that throws is caught and recorded as false", async () => {
		mocks.mailchimp.mockRejectedValue(new Error("kaboom"));
		mocks.actionnetwork.mockResolvedValue({ ok: true });

		const summary = await dispatchIntegrations({
			submission: baseSubmission(),
			env,
		});
		expect(summary.mailchimp).toBe(false);
		expect(summary.actionnetwork).toBe(true);
	});

	it("error from one adapter does not affect others", async () => {
		mocks.actionnetwork.mockRejectedValue(new Error("nope"));
		mocks.mailchimp.mockResolvedValue({ ok: true });
		mocks.nationbuilder.mockResolvedValue({ ok: true });
		mocks.everyaction.mockResolvedValue({ ok: false, error: "x" });
		mocks.mobilize.mockResolvedValue({ ok: true });

		const summary = await dispatchIntegrations({
			submission: baseSubmission(),
			env,
		});
		expect(summary.actionnetwork).toBe(false);
		expect(summary.mailchimp).toBe(true);
		expect(summary.nationbuilder).toBe(true);
		expect(summary.everyaction).toBe(false);
		expect(summary.mobilize).toBe(true);
	});
});
