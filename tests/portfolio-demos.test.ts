import type { APIContext } from "astro";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PORTFOLIO_DEMOS, preparePortfolioDemo } from "../src/lib/portfolio-demos";
import { demoRequest } from "../plugin/src/components/DemoMode";
const { storage } = vi.hoisted(() => ({ storage: vi.fn(() => { throw new Error("Demo must not access storage"); }) }));
vi.mock("cloudflare:workers", () => ({ env: { DB: { prepare: storage }, CACHE: { get: storage, put: storage } } }));
import { POST } from "../src/pages/api/action/submit";

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Demo must not access the network"); })); });
afterEach(() => vi.unstubAllGlobals());

it("handles every reserved sample and preview on the server without storage or delivery", async () => {
  for (const slug of PORTFOLIO_DEMOS) {
    const response = await POST({ request: new Request("https://example.com/api/action/submit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "signup", page_id: slug, data: { email: "sample@example.com" } }),
    }) } as APIContext);
    expect(await response.json()).toEqual({ data: { ok: true, id: "demo", demo: true } });
  }
  expect(storage).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it("rejects JSON null without throwing", async () => {
  const response = await POST({ request: new Request("https://example.com/api/action/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: "null" }) } as APIContext);
  expect(response.status).toBe(400);
});
it("simulates requests locally even when a preview supplied an external endpoint", async () => {
  const response = await demoRequest("https://example.com/submit", { method: "POST", body: "private sample" });
  expect(await response.json()).toMatchObject({ demo: true });
  const reps = await demoRequest("https://example.com/reps?zip=78701");
  expect(await reps.json()).toMatchObject({ representatives: [
    { name: expect.stringContaining("fictional") }, { name: expect.stringContaining("fictional") },
  ] });
  expect(fetch).not.toHaveBeenCalled();
});
it("removes fake donation and event destinations without mutating stored content", () => {
  const source = { action_props: { actblue_url: "https://example.com/donate", event_urls: { mobilize: "https://example.com/fake" }, event_ids: { mobilize: "fake" }, progress: { mode: "countdown", deadline: "2026-11-05" } }, template_props: {}, followup_props: { actblue_url: "https://example.com/donate" } };
  const page = preparePortfolioDemo("rally-town-hall", source);
  expect(page.action_props.actblue_url).toBe("");
  expect(page.action_props.event_urls).toBeUndefined();
  expect(page.action_props.event_ids).toBeUndefined();
  expect(page.action_props.event_timezone).toBe("America/Chicago");
  expect(page.action_props.event_date).toBe("2027-05-15T18:30:00-05:00");
  expect(page.action_props.progress.deadline).toBeUndefined();
  expect(page.followup_props.actblue_url).toBe("");
  expect(source.action_props.event_ids.mobilize).toBe("fake");
  expect(preparePortfolioDemo("a-real-campaign", source)).toBe(source);
});
