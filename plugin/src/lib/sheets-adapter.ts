/**
 * Google Sheets adapter for Campaign Action Pages.
 *
 * Campaigns use Google Apps Script to create a web app endpoint
 * that accepts POST requests and appends rows to a spreadsheet.
 * This adapter formats submission data into the flat row format
 * that Google Sheets expects.
 *
 * Setup guide for campaigns:
 * 1. Open Google Sheets → Extensions → Apps Script
 * 2. Paste the provided doPost function (see APPS_SCRIPT_TEMPLATE)
 * 3. Deploy as web app → "Anyone" access
 * 4. Copy the web app URL to plugin settings
 */

// The Apps Script template campaigns paste into their sheet:
export const APPS_SCRIPT_TEMPLATE = `
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);

  // Auto-create headers on first row if empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(Object.keys(data));
  }

  // Append data row matching header order
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(header) { return data[header] || ""; });
  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export interface SubmissionData {
  type: string;
  page_slug: string;
  campaign_id?: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Flatten a value to a string suitable for a spreadsheet cell.
 */
function toCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toCell).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Recursively flatten a nested object into dot-separated keys with string values.
 * Example: { address: { zip: "20001" } } → { "address.zip": "20001" }
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (
      value !== null &&
      value !== undefined &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = toCell(value);
    }
  }

  return result;
}

/**
 * Format a submission into a flat row for Google Sheets.
 * Flattens nested objects, converts dates, ensures consistent column order.
 * Keys are sorted alphabetically so column order is deterministic.
 */
export function formatForSheets(data: SubmissionData): Record<string, string> {
  const flat = flattenObject(data as Record<string, unknown>);

  // Return with keys sorted alphabetically for consistent column ordering
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(flat).sort()) {
    sorted[key] = flat[key];
  }
  return sorted;
}

/**
 * Send a submission to Google Sheets via the Apps Script web app.
 * This is a specialized callback that uses the Sheets format.
 */
export async function sendToSheets(
  url: string,
  data: SubmissionData,
): Promise<{ ok: boolean; error?: string }> {
  const formatted = formatForSheets(data);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formatted),
      redirect: "follow", // Apps Script web apps redirect on POST
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sheets-adapter] Failed to send to ${url}:`, message);
    return { ok: false, error: message };
  }
}
