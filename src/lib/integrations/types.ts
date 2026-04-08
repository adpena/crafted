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
  pageTitle?: string;
  pageUrl?: string;
  /** External event platform IDs — set per-page via action_props */
  eventIds?: {
    mobilize?: string;
    eventbrite?: string;
    facebook?: string;
  };
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
}

export interface IntegrationResult {
  ok: boolean;
  error?: string;
}
