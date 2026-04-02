import { describe, it, expect, vi } from "vitest";
import { notifyAll, type NotifyEnv, type Submission } from "./notify.ts";

const sub: Submission = {
  name: "Jane Doe",
  email: "jane@example.com",
  message: "Hello, I am interested in your work.",
};

describe("notifyAll", () => {
  it("skips all adapters when none are configured", async () => {
    const result = await notifyAll({}, sub);
    expect(result.skipped.length).toBe(6);
    expect(result.sent).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("returns empty result on empty submission", async () => {
    const result = await notifyAll({}, { name: "", email: "", message: "" });
    expect(result.sent).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("handles undefined submission fields", async () => {
    const result = await notifyAll({}, { name: undefined, email: undefined, message: undefined } as any);
    expect(result.sent).toEqual([]);
  });

  it("skips Resend when only API key is set (missing from/to)", async () => {
    const env: NotifyEnv = { RESEND_API_KEY: "re_test_1234567890" };
    const result = await notifyAll(env, sub);
    expect(result.skipped).toContain("Resend");
  });

  it("skips Telegram when only bot token is set (missing chat_id)", async () => {
    const env: NotifyEnv = { TELEGRAM_BOT_TOKEN: "123456:ABC-DEF" };
    const result = await notifyAll(env, sub);
    expect(result.skipped).toContain("Telegram");
  });

  it("skips WhatsApp when phone ID is missing", async () => {
    const env: NotifyEnv = { WHATSAPP_API_TOKEN: "longtoken1234", WHATSAPP_TO: "+15125551234" };
    const result = await notifyAll(env, sub);
    expect(result.skipped).toContain("WhatsApp");
  });

  it("skips secrets shorter than 8 characters", async () => {
    const env: NotifyEnv = { DISCORD_WEBHOOK_URL: "short" };
    const result = await notifyAll(env, sub);
    expect(result.skipped).toContain("Discord");
  });

  it("logs in dry-run mode without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const env: NotifyEnv = {
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1234/abcdefgh",
      DRY_RUN: "1",
    };
    const result = await notifyAll(env, sub);
    expect(result.sent).toContain("Discord");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reports failure on non-ok response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Bad Request", { status: 400 }),
    );
    const env: NotifyEnv = {
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1234/abcdefgh",
    };
    const result = await notifyAll(env, sub);
    expect(result.failed).toContain("Discord");
    expect(result.sent).not.toContain("Discord");
    fetchSpy.mockRestore();
  });

  it("reports success on ok response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 }),
    );
    const env: NotifyEnv = {
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T00/B00/xxxx1234",
    };
    const result = await notifyAll(env, sub);
    expect(result.sent).toContain("Slack");
    fetchSpy.mockRestore();
  });

  it("sanitizes markdown in Discord messages", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 }),
    );
    const env: NotifyEnv = {
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1234/abcdefgh",
    };
    const evilSub: Submission = {
      name: "**Admin**: Your account",
      email: "test@example.com",
      message: "Click _here_ for `free` money",
    };
    await notifyAll(env, evilSub);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.content).not.toContain("**");
    expect(body.content).not.toContain("_");
    expect(body.content).not.toContain("`");
    fetchSpy.mockRestore();
  });

  it("rejects invalid email in Resend adapter", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 }),
    );
    const env: NotifyEnv = {
      RESEND_API_KEY: "re_test_1234567890",
      RESEND_FROM_EMAIL: "contact@adpena.com",
      RESEND_TO_EMAIL: "me@adpena.com",
    };
    const badSub: Submission = {
      name: "Test",
      email: "not-an-email",
      message: "Hello",
    };
    const result = await notifyAll(env, badSub);
    expect(result.failed).toContain("Resend");
    fetchSpy.mockRestore();
  });

  it("rejects email with CRLF injection", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 }),
    );
    const env: NotifyEnv = {
      RESEND_API_KEY: "re_test_1234567890",
      RESEND_FROM_EMAIL: "contact@adpena.com",
      RESEND_TO_EMAIL: "me@adpena.com",
    };
    const badSub: Submission = {
      name: "Test",
      email: "test@example.com\r\nBcc: spam@evil.com",
      message: "Hello",
    };
    const result = await notifyAll(env, badSub);
    expect(result.failed).toContain("Resend");
    fetchSpy.mockRestore();
  });

  it("truncates long messages", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 }),
    );
    const env: NotifyEnv = {
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/1234/abcdefgh",
    };
    const longSub: Submission = {
      name: "Test",
      email: "test@example.com",
      message: "x".repeat(5000),
    };
    await notifyAll(env, longSub);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.content.length).toBeLessThanOrEqual(2000);
    expect(body.content).toContain("[truncated]");
    fetchSpy.mockRestore();
  });

  it("escapes HTML in Telegram messages", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("OK", { status: 200 }),
    );
    const env: NotifyEnv = {
      TELEGRAM_BOT_TOKEN: "123456789:ABCdefGHI-jklMNO",
      TELEGRAM_CHAT_ID: "-1001234567890",
    };
    const htmlSub: Submission = {
      name: '<script>alert("xss")</script>',
      email: "test@example.com",
      message: "2 > 1 & 1 < 2",
    };
    await notifyAll(env, htmlSub);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.text).not.toContain("<script>");
    expect(body.text).toContain("&lt;script&gt;");
    expect(body.text).toContain("&amp;");
    fetchSpy.mockRestore();
  });
});
