import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatForSheets,
  sendToSheets,
  type SubmissionData,
} from "../src/lib/sheets-adapter.js";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseSubmission: SubmissionData = {
  type: "petition_sign",
  page_slug: "save-the-parks",
  campaign_id: "camp-001",
  timestamp: "2026-04-07T12:00:00.000Z",
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
  zip: "20001",
};

describe("formatForSheets", () => {
  it("flattens nested objects with dot-separated keys", () => {
    const data: SubmissionData = {
      ...baseSubmission,
      address: { street: "123 Main St", city: "DC", state: "DC" },
    };

    const result = formatForSheets(data);

    expect(result["address.street"]).toBe("123 Main St");
    expect(result["address.city"]).toBe("DC");
    expect(result["address.state"]).toBe("DC");
    // The nested object itself should not appear as a key
    expect(result["address"]).toBeUndefined();
  });

  it("converts Date objects to ISO strings", () => {
    const date = new Date("2026-11-03T00:00:00.000Z");
    const data: SubmissionData = {
      ...baseSubmission,
      signed_at: date,
    };

    const result = formatForSheets(data);

    expect(result["signed_at"]).toBe("2026-11-03T00:00:00.000Z");
  });

  it("joins arrays with commas", () => {
    const data: SubmissionData = {
      ...baseSubmission,
      tags: ["volunteer", "donor", "phonebank"],
    };

    const result = formatForSheets(data);

    expect(result["tags"]).toBe("volunteer, donor, phonebank");
  });

  it("handles all submission types", () => {
    const petition: SubmissionData = {
      type: "petition_sign",
      page_slug: "stop-drilling",
      timestamp: "2026-04-07T12:00:00.000Z",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      zip: "20001",
    };
    expect(formatForSheets(petition)["type"]).toBe("petition_sign");

    const donation: SubmissionData = {
      type: "donation_click",
      page_slug: "fund-campaign",
      timestamp: "2026-04-07T12:00:00.000Z",
      amount: 50,
    };
    const donationResult = formatForSheets(donation);
    expect(donationResult["type"]).toBe("donation_click");
    expect(donationResult["amount"]).toBe("50");

    const gotv: SubmissionData = {
      type: "gotv_pledge",
      page_slug: "vote-2026",
      timestamp: "2026-04-07T12:00:00.000Z",
      first_name: "Ada",
      zip: "20001",
    };
    expect(formatForSheets(gotv)["type"]).toBe("gotv_pledge");

    const signup: SubmissionData = {
      type: "signup",
      page_slug: "join-list",
      timestamp: "2026-04-07T12:00:00.000Z",
      email: "ada@example.com",
    };
    expect(formatForSheets(signup)["type"]).toBe("signup");
  });

  it("sorts keys alphabetically for consistent column order", () => {
    const result = formatForSheets(baseSubmission);
    const keys = Object.keys(result);

    expect(keys).toEqual([...keys].sort());
    // Verify specific ordering
    expect(keys.indexOf("campaign_id")).toBeLessThan(keys.indexOf("email"));
    expect(keys.indexOf("email")).toBeLessThan(keys.indexOf("first_name"));
    expect(keys.indexOf("first_name")).toBeLessThan(keys.indexOf("type"));
  });

  it("converts null and undefined to empty strings", () => {
    const data: SubmissionData = {
      ...baseSubmission,
      comment: null as unknown,
      phone: undefined,
    };

    const result = formatForSheets(data);

    expect(result["comment"]).toBe("");
    expect(result["phone"]).toBe("");
  });

  it("serializes nested objects within arrays as JSON", () => {
    const data: SubmissionData = {
      ...baseSubmission,
      amounts: [10, 25, 50],
    };

    const result = formatForSheets(data);

    expect(result["amounts"]).toBe("10, 25, 50");
  });
});

describe("sendToSheets", () => {
  it("posts correctly formatted data to the Apps Script URL", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await sendToSheets("https://script.google.com/exec/abc", baseSubmission);

    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://script.google.com/exec/abc");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");

    // Body should be the formatted (flat, sorted) data
    const body = JSON.parse(init.body);
    const keys = Object.keys(body);
    expect(keys).toEqual([...keys].sort());
    expect(body.type).toBe("petition_sign");
    expect(body.first_name).toBe("Ada");
    expect(body.email).toBe("ada@example.com");
  });

  it("follows redirects (Apps Script web apps redirect on POST)", async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await sendToSheets("https://script.google.com/exec/abc", baseSubmission);

    const init = mockFetch.mock.calls[0][1];
    expect(init.redirect).toBe("follow");
  });

  it("handles HTTP errors gracefully", async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 500 }));

    const result = await sendToSheets("https://script.google.com/exec/abc", baseSubmission);

    expect(result).toEqual({ ok: false, error: "HTTP 500" });
  });

  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendToSheets("https://script.google.com/exec/abc", baseSubmission);

    expect(result).toEqual({ ok: false, error: "Failed to fetch" });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("handles non-Error throw gracefully", async () => {
    mockFetch.mockRejectedValue("connection reset");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendToSheets("https://script.google.com/exec/abc", baseSubmission);

    expect(result).toEqual({ ok: false, error: "connection reset" });
    errorSpy.mockRestore();
  });
});
