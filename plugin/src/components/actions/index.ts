import type { ReactNode } from "react";
import { createRegistry } from "../../lib/registry";
import { FundraiseAction } from "./FundraiseAction";
import { PetitionAction } from "./PetitionAction";
import { GOTVAction } from "./GOTVAction";
import { SignupAction } from "./SignupAction";
import { LetterAction } from "./LetterAction";
import { EventRsvpAction } from "./EventRsvpAction";
import { CallAction } from "./CallAction";
import { StepAction } from "./StepAction";

/**
 * Shared base props passed to every action component by the renderer.
 * Individual actions extend this with their own config props.
 */
export interface ActionComponentProps {
  onComplete: (data: SubmissionData) => void;
  pageId: string;
  visitorId: string;
  variant?: string;
}

/** Union of all built-in submission payloads. */
export type SubmissionData =
  | { type: "donation_click"; amount: number }
  | {
      type: "petition_sign";
      first_name: string;
      last_name: string;
      email: string;
      zip: string;
    }
  | { type: "gotv_pledge"; first_name: string; zip: string }
  | { type: "signup"; email: string; first_name?: string }
  | {
      type: "letter_sent";
      first_name: string;
      last_name: string;
      email: string;
      zip: string;
      letter_subject: string;
      letter_body: string;
      rep_names: string[];
    }
  | {
      type: "event_rsvp";
      first_name: string;
      last_name: string;
      email: string;
      guest_count?: number;
      notes?: string;
    }
  | {
      type: "call_made";
      first_name: string;
      last_name: string;
      email: string;
      zip: string;
      rep_names: string[];
      calls_completed: number;
    }
  | {
      type: "step_form";
      [key: string]: unknown;
    };

/** An action component accepts its own props merged with ActionComponentProps. */
export type ActionComponent = (
  props: ActionComponentProps & Record<string, unknown>,
) => ReactNode;

/** Action registry — populated at import time. */
export const actions = createRegistry<ActionComponent>("actions");

// Register built-in actions. Each component has specific props
// that extend ActionComponentProps, so we widen to ActionComponent.
actions.register("fundraise", FundraiseAction as unknown as ActionComponent);
actions.register("petition", PetitionAction as unknown as ActionComponent);
actions.register("gotv", GOTVAction as unknown as ActionComponent);
actions.register("signup", SignupAction as unknown as ActionComponent);
actions.register("letter", LetterAction as unknown as ActionComponent);
actions.register("event", EventRsvpAction as unknown as ActionComponent);
actions.register("call", CallAction as unknown as ActionComponent);
actions.register("step", StepAction as unknown as ActionComponent);

// Re-export individual components for direct use
export { FundraiseAction } from "./FundraiseAction";
export { PetitionAction } from "./PetitionAction";
export { GOTVAction } from "./GOTVAction";
export { SignupAction } from "./SignupAction";
export { LetterAction } from "./LetterAction";
export { EventRsvpAction } from "./EventRsvpAction";
export { CallAction } from "./CallAction";
export { StepAction } from "./StepAction";

export type { FundraiseActionProps } from "./FundraiseAction";
export type { PetitionActionProps } from "./PetitionAction";
export type { GOTVActionProps } from "./GOTVAction";
export type { SignupActionProps } from "./SignupAction";
export type { LetterActionProps } from "./LetterAction";
export type { EventRsvpActionProps } from "./EventRsvpAction";
export type { CallActionProps } from "./CallAction";
export type { StepActionProps, StepDefinition, StepField } from "./StepAction";
