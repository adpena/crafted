import type { ReactNode } from "react";
import { createRegistry } from "../../lib/registry";
import { FundraiseAction } from "./FundraiseAction";
import { PetitionAction } from "./PetitionAction";
import { GOTVAction } from "./GOTVAction";
import { SignupAction } from "./SignupAction";

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
  | { type: "signup"; email: string; first_name?: string };

/** An action component accepts its own props merged with ActionComponentProps. */
export type ActionComponent = (
  props: ActionComponentProps & Record<string, unknown>,
) => ReactNode;

/** Action registry — populated at import time. */
export const actions = createRegistry<ActionComponent>("actions");

// Register built-in actions
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- registry accepts generic props
actions.register("fundraise", FundraiseAction as any);
actions.register("petition", PetitionAction as any);
actions.register("gotv", GOTVAction as any);
actions.register("signup", SignupAction as any);

// Re-export individual components for direct use
export { FundraiseAction } from "./FundraiseAction";
export { PetitionAction } from "./PetitionAction";
export { GOTVAction } from "./GOTVAction";
export { SignupAction } from "./SignupAction";

export type { FundraiseActionProps } from "./FundraiseAction";
export type { PetitionActionProps } from "./PetitionAction";
export type { GOTVActionProps } from "./GOTVAction";
export type { SignupActionProps } from "./SignupAction";
