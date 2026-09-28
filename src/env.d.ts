// Resource bindings come from `npm run types` (wrangler.jsonc).
// Secrets are optional: routes check configuration before using an integration.
declare namespace Cloudflare {
  interface Env {
    BACKUPS?: R2Bucket;
    ACTBLUE_WEBHOOK_SECRET?: string;
    ACTION_NETWORK_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    AN_WEBHOOK_SECRET?: string;
    CONGRESS_API_KEY?: string;
    CONSTANT_CONTACT_API_KEY?: string;
    CONSTANT_CONTACT_LIST_ID?: string;
    EVENTBRITE_API_TOKEN?: string;
    EVENTBRITE_ORGANIZATION_ID?: string;
    EVERYACTION_API_KEY?: string;
    EVERYACTION_APP_NAME?: string;
    FACEBOOK_ACCESS_TOKEN?: string;
    FIGMA_ACCESS_TOKEN?: string;
    GOOGLE_CONVERSION_ID?: string;
    GOOGLE_CONVERSION_LABEL?: string;
    HUSTLE_API_TOKEN?: string;
    HUSTLE_GROUP_ID?: string;
    HUSTLE_ORGANIZATION_ID?: string;
    MAILCHIMP_API_KEY?: string;
    MAILCHIMP_DC?: string;
    MAILCHIMP_LIST_ID?: string;
    MAILCHIMP_WEBHOOK_SECRET?: string;
    MCP_ADMIN_TOKEN?: string;
    META_ACCESS_TOKEN?: string;
    META_PIXEL_ID?: string;
    MOBILIZE_ACTIVIST_CODE?: string;
    MOBILIZE_API_TOKEN?: string;
    MOBILIZE_EVENT_ID?: string;
    MOBILIZE_ORGANIZATION_ID?: string;
    MOBILIZE_TIMESLOT_ID?: string;
    NATIONBUILDER_API_TOKEN?: string;
    NATIONBUILDER_NATION_SLUG?: string;
    NGPVAN_ACTIVIST_CODE_ID?: string;
    NGPVAN_API_KEY?: string;
    NGPVAN_APP_NAME?: string;
    PROPUBLICA_API_KEY?: string;
    PUBLIC_BASE_URL?: string;
    REPORT_EMAIL?: string;
    RESEND_API_KEY?: string;
    RESEND_DAILY_LIMIT?: string;
    RESEND_FROM_EMAIL?: string;
    SALSA_API_TOKEN?: string;
    SALSA_HOST?: string;
    SENDGRID_API_KEY?: string;
    SENDGRID_LIST_ID?: string;
    TURNSTILE_SECRET?: string;
    UNSUBSCRIBE_BASE_URL?: string;
    UNSUBSCRIBE_SECRET?: string;
  }
}
