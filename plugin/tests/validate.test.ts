import { describe, it, expect } from "vitest";
import { validateSubmission, type SubmissionInput } from "../src/modules/validate.js";

describe("validateSubmission", () => {
  it("passes a valid donation_click", () => {
    const input: SubmissionInput = {
      type: "donation_click",
      data: { amount: 50, refcode: "email-2024" },
    };
    const result = validateSubmission(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.sanitized).toEqual({ amount: 50, refcode: "email-2024" });
  });

  it("passes a valid petition_sign", () => {
    const input: SubmissionInput = {
      type: "petition_sign",
      data: { first_name: "Ada", last_name: "Lovelace", email: "ada@example.com", zip: "02139" },
    };
    const result = validateSubmission(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails petition_sign missing required fields", () => {
    const input: SubmissionInput = {
      type: "petition_sign",
      data: { first_name: "Ada" },
    };
    const result = validateSubmission(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: last_name");
    expect(result.errors).toContain("Missing required field: email");
    expect(result.errors).toContain("Missing required field: zip");
  });

  it("fails on invalid email format", () => {
    const input: SubmissionInput = {
      type: "petition_sign",
      data: { first_name: "Ada", last_name: "Lovelace", email: "not-an-email", zip: "02139" },
    };
    const result = validateSubmission(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid email: email");
  });

  it("fails on unknown submission type", () => {
    const input = {
      type: "unknown_type",
      data: { foo: "bar" },
    } as unknown as SubmissionInput;
    const result = validateSubmission(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Unknown submission type: unknown_type");
  });

  it("sanitizes string inputs by stripping tags", () => {
    const input: SubmissionInput = {
      type: "donation_click",
      data: { refcode: "  <script>alert('xss')</script>hello  " },
    };
    const result = validateSubmission(input);
    expect(result.valid).toBe(true);
    expect(result.sanitized!.refcode).toBe("scriptalert('xss')/scripthello");
  });
});
