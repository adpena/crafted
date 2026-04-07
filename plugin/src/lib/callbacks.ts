export interface Callback {
  url: string;
  events: string[];
  format: "json" | "form";
  headers?: Record<string, string>;
  secret?: string;
}

export type CallbackPayload = {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
};

const RETRY_DELAYS = [1000, 5000, 25000];

async function sign(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildBody(format: "json" | "form", payload: CallbackPayload): { body: string; contentType: string } {
  if (format === "form") {
    const params = new URLSearchParams();
    params.set("event", payload.event);
    params.set("timestamp", payload.timestamp);
    for (const [key, value] of Object.entries(payload.data)) {
      params.set(key, String(value));
    }
    return { body: params.toString(), contentType: "application/x-www-form-urlencoded" };
  }
  return { body: JSON.stringify(payload), contentType: "application/json" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(
  url: string,
  init: RequestInit,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return;

      // Don't retry client errors (4xx) except 429
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.error(`[callbacks] ${url} returned ${response.status}, not retrying`);
        return;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < RETRY_DELAYS.length) {
      await sleep(RETRY_DELAYS[attempt] ?? 1000);
    }
  }

  console.error(`[callbacks] ${url} failed after ${RETRY_DELAYS.length + 1} attempts:`, lastError);
}

async function dispatchOne(
  callback: Callback,
  payload: CallbackPayload,
): Promise<void> {
  const { body, contentType } = buildBody(callback.format, payload);

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    ...callback.headers,
  };

  if (callback.secret) {
    headers["X-Signature"] = await sign(callback.secret, body);
  }

  await sendWithRetry(callback.url, {
    method: "POST",
    headers,
    body,
  });
}

/**
 * Fire matching callbacks in parallel. Never throws.
 */
export async function fireCallbacks(
  callbacks: Callback[] | undefined,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (!callbacks || callbacks.length === 0) return;

  const matching = callbacks.filter((cb) => cb.events.includes(event));
  if (matching.length === 0) return;

  const payload: CallbackPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  try {
    await Promise.allSettled(
      matching.map((cb) => dispatchOne(cb, payload)),
    );
  } catch {
    // Never throw from fireCallbacks
  }
}
