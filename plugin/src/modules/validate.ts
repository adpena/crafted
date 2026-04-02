export type SubmissionInput = {
  type: "donation_click" | "petition_sign" | "gotv_pledge";
  data: Record<string, unknown>;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  sanitized?: Record<string, unknown>;
};

type FieldSchema = {
  required: string[];
  emailFields: string[];
};

const schemas: Record<string, FieldSchema> = {
  donation_click: { required: [], emailFields: [] },
  petition_sign: { required: ["first_name", "last_name", "email", "zip"], emailFields: ["email"] },
  gotv_pledge: { required: ["first_name", "zip"], emailFields: [] },
};

const MAX_LENGTHS: Record<string, number> = {
  first_name: 100,
  last_name: 100,
  email: 254,
  zip: 10,
};

function sanitizeString(value: string): string {
  return value.replace(/[<>\x00]/g, "").trim();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateSubmission(input: SubmissionInput): ValidationResult {
  const schema = schemas[input.type];
  if (!schema) {
    return { valid: false, errors: [`Unknown submission type: ${input.type}`] };
  }

  const errors: string[] = [];

  for (const field of schema.required) {
    if (!input.data[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  for (const field of schema.emailFields) {
    const value = input.data[field];
    if (typeof value === "string" && !isEmail(value)) {
      errors.push(`Invalid email: ${field}`);
    }
  }

  // Enforce max lengths on all string fields
  for (const [key, value] of Object.entries(input.data)) {
    if (typeof value === "string") {
      const max = MAX_LENGTHS[key] ?? 1000;
      if (value.length > max) {
        errors.push(`${key}: too long (max ${max})`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.data)) {
    sanitized[key] = typeof value === "string" ? sanitizeString(value) : value;
  }

  return { valid: true, errors: [], sanitized };
}
