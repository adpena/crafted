import { fireCallbacks, type Callback } from "./callbacks.ts";
import { sendToSheets, type SubmissionData } from "./sheets-adapter.ts";

export interface IntegrationConfig {
  callbacks: Callback[];
  sheetsUrl?: string;
}

/**
 * Fire all configured integrations for a submission event.
 * Runs webhooks and Sheets in parallel. Never throws.
 */
export async function fireIntegrations(
  config: IntegrationConfig,
  event: string,
  data: Record<string, unknown>,
): Promise<{ webhooks: number; sheets: boolean }> {
  const matchingWebhooks = config.callbacks.filter((cb) =>
    cb.events.includes(event),
  );

  const sheetsData: SubmissionData = {
    type: event,
    page_slug: String(data.page_slug ?? ""),
    campaign_id: data.campaign_id != null ? String(data.campaign_id) : undefined,
    timestamp: new Date().toISOString(),
    ...data,
  };

  try {
    const [, sheetsResult] = await Promise.allSettled([
      fireCallbacks(config.callbacks, event, data),
      config.sheetsUrl
        ? sendToSheets(config.sheetsUrl, sheetsData)
        : Promise.resolve(null),
    ]);

    const sheetsOk =
      sheetsResult.status === "fulfilled" &&
      (sheetsResult.value === null || sheetsResult.value.ok === true);

    return {
      webhooks: matchingWebhooks.length,
      sheets: sheetsOk,
    };
  } catch {
    // Never throw from fireIntegrations
    return { webhooks: 0, sheets: false };
  }
}
