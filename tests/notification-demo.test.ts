import { afterEach, expect, it, vi } from "vitest";
import { notifyAll } from "@adpena/notifications";
import { mockAdapters } from "../src/lib/notification-demo";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("starts configured channels together, finishes independent delivery, and times out locally", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const states = vi.fn();
  const result = notifyAll({}, { subject: "Test", body: "Sample" }, mockAdapters({ Email: "success", Slack: "failure", Discord: "timeout" }, states));
  expect(states.mock.calls.filter(([,state]) => state === "Running")).toHaveLength(3);
  await vi.advanceTimersByTimeAsync(1000);
  expect(states).toHaveBeenCalledWith("Email", "Simulated delivery complete");
  expect(states).toHaveBeenCalledWith("Slack", "Simulated failure");
  await vi.advanceTimersByTimeAsync(4000);
  const completed = await result;
  expect(completed.sent).toEqual(["Email"]);
  expect(completed.failed).toHaveLength(2);
  expect(completed.skipped).toEqual([]);
  expect(states).toHaveBeenCalledWith("Discord", "Timed out after 5 seconds");
  expect(fetch).not.toHaveBeenCalled();
});
it("does not run adapters configured to skip", async () => {
  const states = vi.fn();
  const result = await notifyAll({}, { subject: "Test", body: "Sample" }, mockAdapters({ Email: "skip", Slack: "skip", Discord: "skip" }, states));
  expect(result).toMatchObject({ sent: [], failed: [], skipped: ["Email", "Slack", "Discord"] });
  expect(states).not.toHaveBeenCalled();
});
