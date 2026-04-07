import { describe, it, expect } from "vitest";
import { t, getLocale, type Locale, type Translations } from "../src/lib/i18n.js";

describe("t()", () => {
  it("returns English text by default", () => {
    expect(t("en", "petition_heading")).toBe("Sign the Petition");
  });

  it("returns Spanish text for 'es' locale", () => {
    expect(t("es", "petition_heading")).toBe("Firma la petición");
  });

  it("falls back to English for unknown locale", () => {
    // Cast to satisfy TS — runtime should still resolve to English
    expect(t("fr" as Locale, "petition_heading")).toBe("Sign the Petition");
  });

  it("interpolates ${amount} variable", () => {
    expect(t("en", "fundraise_donate_amount", { amount: "$25" })).toBe("Donate $25");
  });

  it("interpolates variables in Spanish", () => {
    expect(t("es", "fundraise_donate_amount", { amount: "$25" })).toBe("Donar $25");
  });

  it("leaves text unchanged when vars don't match placeholders", () => {
    expect(t("en", "petition_heading", { foo: "bar" })).toBe("Sign the Petition");
  });
});

describe("getLocale()", () => {
  it("returns 'en' for undefined", () => {
    expect(getLocale(undefined)).toBe("en");
  });

  it("returns 'es' for 'es'", () => {
    expect(getLocale("es")).toBe("es");
  });

  it("returns 'en' for unrecognized locale string", () => {
    expect(getLocale("de")).toBe("en");
  });
});

describe("translation completeness", () => {
  const locales: Locale[] = ["en", "es"];

  // Extract all keys by translating with "en" and checking they exist
  const allKeys: (keyof Translations)[] = [
    "petition_heading",
    "petition_first_name",
    "petition_last_name",
    "petition_email",
    "petition_zip",
    "petition_comment",
    "petition_submit",
    "petition_signing",
    "petition_signed",
    "petition_signatures",
    "fundraise_custom_amount",
    "fundraise_donate",
    "fundraise_donate_amount",
    "gotv_pledge_default",
    "gotv_submit",
    "gotv_pledging",
    "signup_email",
    "signup_name",
    "signup_submit",
    "signup_joining",
    "required_field",
    "invalid_email",
    "submit_error",
    "paid_for_by",
    "treasurer",
    "consent_data_collection",
    "consent_privacy_policy",
  ];

  it("all keys exist in both locales", () => {
    for (const locale of locales) {
      for (const key of allKeys) {
        const value = t(locale, key);
        expect(value, `Missing ${locale}.${key}`).toBeTruthy();
      }
    }
  });

  it("no empty translation values", () => {
    for (const locale of locales) {
      for (const key of allKeys) {
        const value = t(locale, key);
        expect(value.trim().length, `Empty ${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});
