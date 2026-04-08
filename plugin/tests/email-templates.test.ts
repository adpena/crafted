import { describe, it, expect } from "vitest";
import { renderConfirmationEmail, type EmailTemplateData } from "../../src/lib/email-templates.js";

const baseData: EmailTemplateData = {
  type: "petition_sign",
  firstName: "Ada",
  email: "ada@example.com",
  pageTitle: "Save the Park",
  pageUrl: "https://example.com/save-the-park",
  timestamp: "2025-06-15T12:00:00Z",
};

describe("renderConfirmationEmail", () => {
  describe("petition_sign", () => {
    it("subject is 'Thanks for signing!'", () => {
      const { subject } = renderConfirmationEmail(baseData);
      expect(subject).toBe("Thanks for signing!");
    });

    it("HTML contains the first name", () => {
      const { html } = renderConfirmationEmail(baseData);
      expect(html).toContain("Ada");
    });

    it("text fallback contains the first name", () => {
      const { text } = renderConfirmationEmail(baseData);
      expect(text).toContain("Ada");
    });
  });

  describe("gotv_pledge", () => {
    it("subject mentions pledge", () => {
      const { subject } = renderConfirmationEmail({ ...baseData, type: "gotv_pledge" });
      expect(subject).toMatch(/pledge/i);
    });
  });

  describe("signup", () => {
    it("subject is \"You're in!\"", () => {
      const { subject } = renderConfirmationEmail({ ...baseData, type: "signup" });
      expect(subject).toBe("You're in!");
    });
  });

  describe("donation_click", () => {
    it("subject mentions contribution", () => {
      const { subject } = renderConfirmationEmail({ ...baseData, type: "donation_click" });
      expect(subject).toMatch(/contribution/i);
    });
  });

  describe("HTML structure", () => {
    const types: EmailTemplateData["type"][] = [
      "petition_sign",
      "gotv_pledge",
      "signup",
      "donation_click",
    ];

    for (const type of types) {
      it(`${type} produces valid HTML with doctype, html, and body tags`, () => {
        const { html } = renderConfirmationEmail({ ...baseData, type });
        expect(html).toMatch(/<!DOCTYPE html>/i);
        expect(html).toContain("<html");
        expect(html).toContain("<body");
        expect(html).toContain("</body>");
        expect(html).toContain("</html>");
      });
    }
  });

  describe("XSS prevention", () => {
    it("escapes <script> tag in firstName in HTML output", () => {
      const xssData: EmailTemplateData = {
        ...baseData,
        firstName: '<script>alert("xss")</script>',
      };
      const { html } = renderConfirmationEmail(xssData);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("share block", () => {
    it("includes share links when pageUrl is provided", () => {
      const { html } = renderConfirmationEmail(baseData);
      expect(html).toContain("Spread the word");
      expect(html).toContain("twitter.com/intent/tweet");
      expect(html).toContain("facebook.com/sharer");
    });

    it("omits share block when pageUrl is missing", () => {
      const { html } = renderConfirmationEmail({
        ...baseData,
        pageUrl: undefined,
      });
      expect(html).not.toContain("Spread the word");
      expect(html).not.toContain("twitter.com/intent/tweet");
    });
  });

  describe("text fallback", () => {
    it("petition includes share URL in text when pageUrl is set", () => {
      const { text } = renderConfirmationEmail(baseData);
      expect(text).toContain(baseData.pageUrl);
    });

    it("petition text omits share URL when pageUrl is missing", () => {
      const { text } = renderConfirmationEmail({ ...baseData, pageUrl: undefined });
      expect(text).not.toContain("Share:");
    });
  });
});
