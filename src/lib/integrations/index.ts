/**
 * Campaign platform integrations dispatcher.
 *
 * Forwards a submission to any combination of configured external campaign
 * platforms (Action Network, Mailchimp, NationBuilder, EveryAction, Mobilize).
 *
 * Each adapter:
 *   - Silently skips when its env vars are not configured (returns undefined)
 *   - Never throws — returns { ok, error? }
 *   - Uses a 10s AbortSignal timeout
 *
 * The dispatcher fires every configured adapter in parallel via
 * Promise.allSettled and returns a summary keyed by platform name.
 */

import { pushToActionNetwork } from "./actionnetwork.ts";
import { pushToMailchimp } from "./mailchimp.ts";
import { pushToNationBuilder } from "./nationbuilder.ts";
import { pushToEveryAction } from "./everyaction.ts";
import { pushToMobilize } from "./mobilize.ts";
import { pushToEventbrite } from "./eventbrite.ts";
import { pushToFacebookEvent } from "./facebook.ts";
import { pushToSendGrid } from "./sendgrid.ts";
import { pushToConstantContact } from "./constantcontact.ts";
import { pushToNgpVan } from "./ngpvan.ts";
import { pushToHustle } from "./hustle.ts";
import type { IntegrationSubmission, IntegrationEnv, IntegrationResult } from "./types.ts";

export type { IntegrationSubmission, IntegrationEnv, IntegrationResult };

export interface IntegrationsSummary {
  actionnetwork?: boolean;
  mailchimp?: boolean;
  nationbuilder?: boolean;
  everyaction?: boolean;
  mobilize?: boolean;
  eventbrite?: boolean;
  facebook?: boolean;
  sendgrid?: boolean;
  constantcontact?: boolean;
  ngpvan?: boolean;
  hustle?: boolean;
}

interface AdapterDef {
  key: keyof IntegrationsSummary;
  fn: (
    submission: IntegrationSubmission,
    env: IntegrationEnv,
  ) => Promise<IntegrationResult | undefined>;
}

const ADAPTERS: AdapterDef[] = [
  { key: "actionnetwork", fn: pushToActionNetwork },
  { key: "mailchimp", fn: pushToMailchimp },
  { key: "nationbuilder", fn: pushToNationBuilder },
  { key: "everyaction", fn: pushToEveryAction },
  { key: "mobilize", fn: pushToMobilize },
  { key: "eventbrite", fn: pushToEventbrite },
  { key: "facebook", fn: pushToFacebookEvent },
  { key: "sendgrid", fn: pushToSendGrid },
  { key: "constantcontact", fn: pushToConstantContact },
  { key: "ngpvan", fn: pushToNgpVan },
  { key: "hustle", fn: pushToHustle },
];

export interface DispatchContext {
  submission: IntegrationSubmission;
  env: IntegrationEnv;
}

/**
 * Dispatch a submission to every configured campaign platform adapter.
 * Errors are logged with sanitized messages and never thrown.
 */
export async function dispatchIntegrations(
  ctx: DispatchContext,
): Promise<IntegrationsSummary> {
  const summary: IntegrationsSummary = {};

  const tasks = ADAPTERS.map(async ({ key, fn }) => {
    try {
      const result = await fn(ctx.submission, ctx.env);
      if (result === undefined) return; // not configured / not applicable
      summary[key] = result.ok;
      if (!result.ok) {
        console.error(
          `[integrations] ${key} error:`,
          result.error ?? "unknown",
        );
      }
    } catch (err) {
      summary[key] = false;
      console.error(
        `[integrations] ${key} threw:`,
        err instanceof Error ? err.message : "unknown",
      );
    }
  });

  await Promise.allSettled(tasks);
  return summary;
}
