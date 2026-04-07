import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireCallbacks, type Callback } from "../src/lib/callbacks.js";

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function okResponse(): Response {
  return new Response(null, { status: 200 });
}

function errorResponse(status: number): Response {
  return new Response(null, { status });
}

const baseCallback: Callback = {
  url: "https://example.com/webhook",
  events: ["petition_sign"],
  format: "json",
};

describe("fireCallbacks", () => {
  it("fires matching callbacks", async () => {
    mockFetch.mockResolvedValue(okResponse());

    await fireCallbacks([baseCallback], "petition_sign", { email: "a@b.com" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://example.com/webhook");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body.event).toBe("petition_sign");
    expect(body.data.email).toBe("a@b.com");
    expect(body.timestamp).toBeDefined();
  });

  it("skips non-matching events", async () => {
    mockFetch.mockResolvedValue(okResponse());

    await fireCallbacks([baseCallback], "donation_click", { amount: 50 });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("includes HMAC signature when secret is provided", async () => {
    mockFetch.mockResolvedValue(okResponse());

    const cb: Callback = { ...baseCallback, secret: "my-secret-key" };
    await fireCallbacks([cb], "petition_sign", { email: "a@b.com" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["X-Signature"]).toBeDefined();
    expect(typeof headers["X-Signature"]).toBe("string");
    // HMAC-SHA256 hex is 64 chars
    expect(headers["X-Signature"]).toHaveLength(64);
  });

  it("retries on 5xx errors", async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(okResponse());

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const promise = fireCallbacks([baseCallback], "petition_sign", { email: "a@b.com" });

    // Advance past first retry delay (1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    // Advance past second retry delay (5000ms)
    await vi.advanceTimersByTimeAsync(5000);

    await promise;

    expect(mockFetch).toHaveBeenCalledTimes(3);
    errorSpy.mockRestore();
  });

  it("does not retry on 4xx errors (except 429)", async () => {
    mockFetch.mockResolvedValue(errorResponse(400));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await fireCallbacks([baseCallback], "petition_sign", { email: "a@b.com" });

    // Only one call — no retry for 400
    expect(mockFetch).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("handles network failures gracefully (never throws)", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network error"));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Should not throw — advance timers for all retry delays
    const promise = fireCallbacks([baseCallback], "petition_sign", { email: "a@b.com" });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(25000);

    await expect(promise).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });

  it("fires multiple callbacks in parallel", async () => {
    mockFetch.mockResolvedValue(okResponse());

    const cb1: Callback = { url: "https://one.com/hook", events: ["signup"], format: "json" };
    const cb2: Callback = { url: "https://two.com/hook", events: ["signup"], format: "json" };

    await fireCallbacks([cb1, cb2], "signup", { email: "a@b.com" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
    expect(urls).toContain("https://one.com/hook");
    expect(urls).toContain("https://two.com/hook");
  });

  it("supports json format with correct content-type", async () => {
    mockFetch.mockResolvedValue(okResponse());

    await fireCallbacks([baseCallback], "petition_sign", { email: "a@b.com" });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.event).toBe("petition_sign");
  });

  it("supports form-encoded format with correct content-type", async () => {
    mockFetch.mockResolvedValue(okResponse());

    const cb: Callback = { ...baseCallback, format: "form" };
    await fireCallbacks([cb], "petition_sign", { email: "a@b.com" });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const body = mockFetch.mock.calls[0][1].body as string;
    const params = new URLSearchParams(body);
    expect(params.get("event")).toBe("petition_sign");
    expect(params.get("email")).toBe("a@b.com");
  });

  it("handles undefined callbacks array", async () => {
    await expect(fireCallbacks(undefined, "signup", {})).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("handles empty callbacks array", async () => {
    await expect(fireCallbacks([], "signup", {})).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
