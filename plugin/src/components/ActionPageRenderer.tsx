import { useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { createRegistry } from "../lib/registry.ts";
import { fireWebhooks, type WebhookConfig } from "@crafted/notifications";
import { resolveTheme } from "./themes/index.ts";
import type { Theme } from "./themes/index.ts";
import { Transition } from "./Transition.tsx";
import { Disclaimer } from "./Disclaimer.tsx";
import type { DisclaimerProps } from "./Disclaimer.tsx";
import { Consent } from "./Consent.tsx";
import type { Locale } from "../lib/i18n.ts";

/* ------------------------------------------------------------------ */
/*  Component types                                                    */
/* ------------------------------------------------------------------ */

export type SubmissionData = Record<string, unknown>;

export type ActionComponentProps = {
  onComplete: (data: SubmissionData) => void;
  pageId: string;
  visitorId: string;
  variant?: string;
};

export type ActionComponent = (
  props: ActionComponentProps & Record<string, unknown>,
) => ReactNode;

export type TemplateComponent = (
  props: Record<string, unknown>,
) => ReactNode;

/* ------------------------------------------------------------------ */
/*  Registries                                                         */
/* ------------------------------------------------------------------ */

export const templates = createRegistry<TemplateComponent>("templates");
export const actions = createRegistry<ActionComponent>("actions");

/* ------------------------------------------------------------------ */
/*  ActionPage config                                                  */
/* ------------------------------------------------------------------ */

export type ActionPageConfig = {
  slug: string;
  campaign_id?: string;

  template: string;
  template_props: Record<string, unknown>;

  action: string;
  action_props: Record<string, unknown>;

  followup?: string;
  followup_props?: Record<string, unknown>;
  followup_message?: string;

  disclaimer: DisclaimerProps & {
    candidate_name?: string;
    office?: string;
  };
  jurisdiction?: string;

  locale?: Locale;

  consent?: {
    privacy_url?: string;
    required?: boolean;
  };

  variants?: string[];

  theme?: string | Record<string, string>;

  callbacks?: WebhookConfig[];
};

/* ------------------------------------------------------------------ */
/*  Renderer props                                                     */
/* ------------------------------------------------------------------ */

export type ActionPageRendererProps = {
  page: ActionPageConfig;
  visitorId?: string;
  variant?: string;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ActionPageRenderer({ page, visitorId = "", variant }: ActionPageRendererProps) {
  const [completed, setCompleted] = useState(false);

  const Template = templates.get(page.template);
  const Action = actions.get(page.action);
  const Followup = page.followup ? actions.get(page.followup) : null;
  const theme = resolveTheme(page.theme);

  const handleComplete = (data: SubmissionData) => {
    setCompleted(true);
    fireWebhooks(page.callbacks, page.action, data);
  };

  const handleFollowupComplete = (data: SubmissionData) => {
    if (page.followup) {
      fireWebhooks(page.callbacks, page.followup, data);
    }
  };

  const rootStyle: CSSProperties = { ...theme } as CSSProperties;

  if (!Template) {
    console.error(`[ActionPageRenderer] template not found: ${page.template}`);
    return null;
  }

  if (!Action) {
    console.error(`[ActionPageRenderer] action not found: ${page.action}`);
    return null;
  }

  return (
    <div style={rootStyle}>
      <Template {...page.template_props} />

      {!completed ? (
        <Action
          {...page.action_props}
          onComplete={handleComplete}
          pageId={page.slug}
          visitorId={visitorId}
          variant={variant}
        />
      ) : (
        Followup && (
          <Transition show={completed}>
            {page.followup_message && (
              <p style={{ color: "var(--page-text)", fontFamily: "var(--page-font-serif)" }}>
                {page.followup_message}
              </p>
            )}
            <Followup
              {...page.followup_props}
              onComplete={handleFollowupComplete}
              pageId={page.slug}
              visitorId={visitorId}
              variant={variant}
            />
          </Transition>
        )
      )}

      {page.consent && (
        <Consent
          locale={page.locale}
          privacy_url={page.consent.privacy_url}
          required={page.consent.required}
        />
      )}

      <Disclaimer
        committee_name={page.disclaimer.committee_name}
        treasurer_name={page.disclaimer.treasurer_name}
        locale={page.locale}
      />
    </div>
  );
}
