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

  // SendGrid Marketing Contacts
  SENDGRID_API_KEY?: string;
  SENDGRID_LIST_ID?: string;

  // Constant Contact
  CONSTANT_CONTACT_API_KEY?: string;
  CONSTANT_CONTACT_LIST_ID?: string;

  // NGP VAN / VoteBuilder (voter file)
  NGPVAN_API_KEY?: string;
  NGPVAN_APP_NAME?: string;
  NGPVAN_ACTIVIST_CODE_ID?: string;

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
