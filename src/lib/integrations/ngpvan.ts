/**
 * NGP VAN / VoteBuilder adapter — sync contacts to the Democratic voter file.
 *
 * NGP VAN is the gold standard for Democratic campaigns. VAN (Voter Activation
 * Network) maintains the voter file. The API lets us match our supporters
 * against the voter file and apply activist codes or survey responses.
 *
 * Per-action-type differentiation
 * -------------------------------
 * A campaign running multiple action pages (petition, letter, signup, etc.)
 * needs VAN to know *which* action a supporter took. VAN does not infer this
 * from context — the caller must apply a distinct activist code or survey
 * response per action type. This adapter supports four levels of precedence
 * (highest wins):
 *
 *   1. `submission.activist_code_ids`  — explicit array on the action page
 *   2. `submission.activist_code_id`   — explicit single code (legacy)
 *   3. `env.NGPVAN_ACTIVIST_CODES_JSON[type]` — action-type → code map
 *   4. `env.NGPVAN_ACTIVIST_CODE_ID`   — global default
 *
 * All resolved codes are applied in a single canvass response POST along
 * with any `submission.survey_responses`. The canvass response is checked
 * for success (non-2xx → ok:false with error detail); previous versions
 * swallowed this silently.
 *
 * Docs: https://docs.ngpvan.com/reference
 * Auth: HTTP Basic with "{appName}:{apiKey}|1" (mode 1 = VAN, mode 0 = EveryAction)
 */

import type { IntegrationSubmission, IntegrationEnv, IntegrationResult, IntegrationOptions } from "./types.ts";

const API_BASE = "https://api.securevan.com/v4";
const TIMEOUT_MS = 10_000;

/** VAN contact/input type ids for API-originated canvass responses. */
const CANVASS_CONTEXT = {
  contactTypeId: 37, // API contact type
  inputTypeId: 11,   // API input type
};

/** KV interface for match rate counters (optional, injected via opts) */
interface VanKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

async function incrementVanCounter(kv: VanKV | undefined, suffix: "matches" | "misses" | "codes_applied" | "codes_failed"): Promise<void> {
  if (!kv) return;
  const today = new Date().toISOString().slice(0, 10);
  const key = `van-${suffix}:${today}`;
  try {
    const current = parseInt((await kv.get(key)) ?? "0", 10);
    await kv.put(key, String(current + 1), { expirationTtl: 86400 * 7 });
  } catch {
    // Fail open — counter is observability, not correctness.
  }
}

/**
 * Parse NGPVAN_ACTIVIST_CODES_JSON and return the code for the given action type.
 * Accepts values as number or numeric string.
 */
function resolveTypeMappedCode(json: string | undefined, type: string): number | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return undefined;
    const raw = parsed[type];
    if (raw == null) return undefined;
    const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Build the de-duplicated list of activist code IDs to apply, in precedence
 * order. Returns integers (VAN rejects string ids in canvass responses).
 */
export function resolveActivistCodes(
  submission: IntegrationSubmission,
  env: IntegrationEnv,
): number[] {
  const ids = new Set<number>();

  // 1. Explicit array
  if (Array.isArray(submission.activist_code_ids)) {
    for (const raw of submission.activist_code_ids) {
      const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
      if (Number.isFinite(n)) ids.add(n);
    }
  }

  // 2. Explicit single
  if (submission.activist_code_id) {
    const n = parseInt(String(submission.activist_code_id), 10);
    if (Number.isFinite(n)) ids.add(n);
  }

  // 3. Type-mapped default
  const typeCode = resolveTypeMappedCode(env.NGPVAN_ACTIVIST_CODES_JSON, submission.type);
  if (typeCode != null) ids.add(typeCode);

  // 4. Global default
  if (env.NGPVAN_ACTIVIST_CODE_ID) {
    const n = parseInt(String(env.NGPVAN_ACTIVIST_CODE_ID), 10);
    if (Number.isFinite(n)) ids.add(n);
  }

  return Array.from(ids);
}

export async function pushToNgpVan(
  submission: IntegrationSubmission,
  env: IntegrationEnv,
  opts?: IntegrationOptions,
): Promise<IntegrationResult | undefined> {
  if (!env.NGPVAN_API_KEY || !env.NGPVAN_APP_NAME) return undefined;
  if (!submission.email) return undefined;

  const kv = opts?.kv;
  const fetchImpl = opts?.fetchImpl ?? fetch;

  try {
    // Step 1: Find or create the person in VAN
    const authValue = btoa(`${env.NGPVAN_APP_NAME}:${env.NGPVAN_API_KEY}|1`);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Basic ${authValue}`,
    };

    const matchRes = await fetchImpl(`${API_BASE}/people/findOrCreate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        firstName: submission.firstName ?? "",
        lastName: submission.lastName ?? "",
        emails: [{ email: submission.email }],
        phones: submission.phone ? [{ phoneNumber: submission.phone }] : [],
        addresses: submission.postalCode
          ? [{ zipOrPostalCode: submission.postalCode }]
          : [],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!matchRes.ok) {
      const body = await matchRes.text();
      return { ok: false, error: `VAN findOrCreate ${matchRes.status}: ${body.slice(0, 200)}` };
    }

    const person = (await matchRes.json()) as { vanId?: number };
    const vanId = person.vanId;

    // VAN created the contact but no voter file match — expected for email-only
    // submissions (match rates are typically 40-60%). Still ok: the contact
    // exists in VAN, just not linked to a voter file record.
    if (!vanId) {
      console.info("[ngpvan] no voter file match for submission");
      await incrementVanCounter(kv, "misses");
      return { ok: true, error: "no_van_match" };
    }
    console.info("[ngpvan] voter file match found, vanId:", vanId);
    await incrementVanCounter(kv, "matches");

    // Step 2: Resolve the full set of activist codes + survey responses.
    const activistCodes = resolveActivistCodes(submission, env);
    const surveyResponses = Array.isArray(submission.survey_responses)
      ? submission.survey_responses.filter(
          (r) =>
            r &&
            Number.isFinite(r.surveyQuestionId) &&
            Number.isFinite(r.surveyResponseId),
        )
      : [];

    // Nothing to apply — that's fine, just return success from the match.
    if (activistCodes.length === 0 && surveyResponses.length === 0) {
      return { ok: true };
    }

    const responses: Array<Record<string, unknown>> = [
      ...activistCodes.map((id) => ({
        activistCodeId: id,
        action: "Apply",
        type: "ActivistCode",
      })),
      ...surveyResponses.map((r) => ({
        surveyQuestionId: r.surveyQuestionId,
        surveyResponseId: r.surveyResponseId,
        action: "SurveyResponse",
        type: "SurveyResponse",
      })),
    ];

    const canvassPayload: Record<string, unknown> = {
      canvassContext: CANVASS_CONTEXT,
      responses,
    };
    if (submission.van_source_code_id != null && Number.isFinite(submission.van_source_code_id)) {
      (canvassPayload.canvassContext as Record<string, unknown>).inputTypeId = CANVASS_CONTEXT.inputTypeId;
      canvassPayload.resultCodeId = submission.van_source_code_id;
    }

    const canvassRes = await fetchImpl(`${API_BASE}/people/${vanId}/canvassResponses`, {
      method: "POST",
      headers,
      body: JSON.stringify(canvassPayload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!canvassRes.ok) {
      const body = await canvassRes.text();
      await incrementVanCounter(kv, "codes_failed");
      return {
        ok: false,
        error: `VAN canvassResponses ${canvassRes.status}: ${body.slice(0, 200)}`,
      };
    }

    await incrementVanCounter(kv, "codes_applied");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
