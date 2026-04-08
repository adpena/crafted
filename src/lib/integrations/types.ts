/**
 * Shared types for campaign platform integration adapters.
 */

import type { ActionType } from "../email-templates.ts";

export interface IntegrationSubmission {
  type: ActionType;
  slug: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  postalCode?: string;
  phone?: string;
  pageTitle?: string;
  pageUrl?: string;
  /** External event platform IDs — set per-page via action_props */
  eventIds?: {
    mobilize?: string;
    eventbrite?: string;
    facebook?: string;
  };
  /**
   * Per-page VAN activist code (single). Retained for backwards
   * compatibility — prefer `activist_code_ids` for new pages.
   */
  activist_code_id?: string;
  /**
   * Per-page VAN activist codes (multiple). A campaign may tag a single
   * action with several codes (e.g., "2026 signer" + "climate list").
   * All codes are applied in a single canvass response batch.
   */
  activist_code_ids?: Array<string | number>;
  /**
   * VAN survey responses to apply alongside activist codes. Survey
   * questions must be pre-created in VAN; we only reference their IDs.
   * Used to differentiate action types (e.g., a "how did you take
   * action?" question with separate responses for petition vs letter).
   */
  survey_responses?: Array<{
    surveyQuestionId: number;
    surveyResponseId: number;
  }>;
  /** VAN source code id for attribution (list/universe tracking). */
  van_source_code_id?: number;
}

export interface IntegrationEnv {
  // Action Network
  ACTION_NETWORK_API_KEY?: string;

  // Mailchimp
  MAILCHIMP_API_KEY?: string;
  MAILCHIMP_LIST_ID?: string;
  MAILCHIMP_DC?: string;

  // NationBuilder
  NATIONBUILDER_NATION_SLUG?: string;
  NATIONBUILDER_API_TOKEN?: string;

  // EveryAction / NGP VAN
  EVERYACTION_API_KEY?: string;
  EVERYACTION_APP_NAME?: string;

  // Mobilize America
  MOBILIZE_API_TOKEN?: string;
  MOBILIZE_ORGANIZATION_ID?: string;
  MOBILIZE_EVENT_ID?: string;
  MOBILIZE_TIMESLOT_ID?: string;
  MOBILIZE_ACTIVIST_CODE?: string;

  // Eventbrite
  EVENTBRITE_API_TOKEN?: string;
  EVENTBRITE_ORGANIZATION_ID?: string;

  // Facebook Events (requires Graph API access token with events_management scope)
  FACEBOOK_ACCESS_TOKEN?: string;

  // SendGrid Marketing Contacts
  SENDGRID_API_KEY?: string;
  SENDGRID_LIST_ID?: string;

  // Constant Contact
  CONSTANT_CONTACT_API_KEY?: string;
  CONSTANT_CONTACT_LIST_ID?: string;

  // NGP VAN / VoteBuilder (voter file)
  NGPVAN_API_KEY?: string;
  NGPVAN_APP_NAME?: string;
  /** Global default activist code applied to every VAN-matched contact. */
  NGPVAN_ACTIVIST_CODE_ID?: string;
  /**
   * Per-action-type activist code map as JSON.
   * Example: '{"petition":12345,"signup":12346,"letter":12347}'.
   * Used when the action page does not specify its own activist_code_id(s).
   * Distinct types get distinct codes, letting campaigns differentiate
   * petition signers from letter writers from donors in VAN.
   */
  NGPVAN_ACTIVIST_CODES_JSON?: string;

  // Hustle (P2P texting)
  HUSTLE_API_TOKEN?: string;
  HUSTLE_ORGANIZATION_ID?: string;
  HUSTLE_GROUP_ID?: string;

  // Salsa Labs (Salsa Engage)
  SALSA_API_TOKEN?: string;
  SALSA_HOST?: string;
}

export interface IntegrationResult {
  ok: boolean;
  error?: string;
}

/** Optional injected dependencies for adapters (KV, fetch stub, etc). */
export interface IntegrationOptions {
  /** Cloudflare KV binding, used by adapters that want to count observability metrics. */
  kv?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  };
  /** Overridable fetch for tests (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}
