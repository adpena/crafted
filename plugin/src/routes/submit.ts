import type { RouteContext, PluginContext } from "emdash";
import { validateSubmission } from "../modules/validate.ts";
import type { SubmissionInput } from "../modules/validate.ts";

export async function handleSubmit(routeCtx: RouteContext, ctx: PluginContext) {
  const body = routeCtx.input as {
    page_id: string;
    type: SubmissionInput["type"];
    data: Record<string, unknown>;
    visitor_id?: string;
    variant?: string;
  };

  const result = validateSubmission({ type: body.type, data: body.data });
  if (!result.valid) {
    return { status: 400, body: { errors: result.errors } };
  }

  const geo = routeCtx.requestMeta.geo;
  const id = crypto.randomUUID();

  await ctx.storage.submissions.put(id, {
    page_id: body.page_id,
    type: body.type,
    data: result.sanitized,
    visitor_id: body.visitor_id ?? null,
    variant: body.variant ?? null,
    country: geo?.country ?? null,
    city: geo?.city ?? null,
    created_at: new Date().toISOString(),
  });

  return { status: 200, body: { ok: true } };
}
