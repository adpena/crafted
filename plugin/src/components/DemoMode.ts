import { createContext, useContext } from "react";

export const DemoMode = createContext(false);

/** Local responses for sample forms. Never reads or sends a submission body. */
export const demoRequest: typeof fetch = async (input, init) => {
  if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (method.toUpperCase() === "POST") return Response.json({ ok: true, id: "demo", demo: true });
  return Response.json({
    demo: true,
    representatives: [
      { name: "Alex Example (fictional)", office: "Sample U.S. Representative", phones: ["202-555-0100"], party: "Sample", state: "TX" },
      { name: "Jordan Example (fictional)", office: "Sample U.S. Senator", phones: ["202-555-0101"], party: "Sample", state: "TX" },
    ],
  });
};

const liveRequest: typeof fetch = (...args) => globalThis.fetch(...args);
export function useActionRequest() {
  return useContext(DemoMode) ? demoRequest : liveRequest;
}
