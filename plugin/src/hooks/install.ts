import type { PluginContext } from "emdash";
import federalData from "../../../data/disclaimers/federal.json" with { type: "json" };

export async function handleInstall(_event: unknown, ctx: PluginContext): Promise<void> {
  // Load federal disclaimer data into KV for fast access from routes
  await ctx.kv.set("disclaimers", federalData);
  ctx.log.info("Loaded federal disclaimer data into KV");

  // Seed a demo campaign and action page if none exist
  const demoMode = await ctx.kv.get<boolean>("demo_mode");
  const existingCampaigns = await ctx.storage.campaigns.query({});
  if (demoMode !== false && existingCampaigns.items.length === 0) {
    const campaignId = crypto.randomUUID();
    await ctx.storage.campaigns.put(campaignId, {
      slug: "demo",
      name: "Demo Campaign",
      committee_name: "Friends of Progress",
      created_at: new Date().toISOString(),
    });
    ctx.log.info("Created demo campaign");

    const pageId = crypto.randomUUID();
    await ctx.storage.action_pages.put(pageId, {
      slug: "demo-donate",
      campaign_id: campaignId,
      title: "Support the Cause",
      type: "fundraise",
      body: "Your contribution makes a difference. Every dollar goes directly to the campaign.",
      committee_name: "Friends of Progress",
      actblue_url: "https://secure.actblue.com/donate/example",
      refcode: "crafted-demo",
      amount_config: {
        base: [10, 25, 50, 100, 250],
        regions: {
          "US-CA": { multiplier: 1.4 },
          "US-NY": { multiplier: 1.3 },
          "US-TX": { multiplier: 0.9 },
          "US-DC": { multiplier: 1.3 },
        },
        fallback_multiplier: 1.0,
      },
      variants: ["control", "urgency"],
    });
    ctx.log.info("Created demo action page: demo-donate");
  }
}
