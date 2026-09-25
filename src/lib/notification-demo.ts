import type { Adapter } from "@adpena/notifications";

export const CHANNELS = ["Email", "Slack", "Discord"] as const;
export type Outcome = "success" | "failure" | "timeout" | "skip";

/** Only timers and local state: these adapters cannot contact a service. */
export function mockAdapters(outcomes: Record<string, Outcome>, progress: (name: string, state: string) => void): Adapter[] {
  return CHANNELS.map((name, index) => ({
    name,
    isConfigured: () => outcomes[name] !== "skip",
    async send(_env, _message, signal) {
      progress(name, "Running");
      if (outcomes[name] === "timeout") {
        await new Promise<void>((_resolve, reject) => {
          const abort = () => {
            progress(name, "Timed out after 5 seconds");
            reject(new Error("Simulated timeout"));
          };
          if (signal.aborted) abort();
          else signal.addEventListener("abort", abort, { once: true });
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 350 + index * 250));
        if (outcomes[name] === "failure") {
          progress(name, "Simulated failure");
          throw new Error("Simulated service failure");
        }
        progress(name, "Simulated delivery complete");
      }
    },
  }));
}
