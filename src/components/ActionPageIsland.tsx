/**
 * ActionPageIsland — thin wrapper that populates the ActionPageRenderer's
 * registries with built-in templates, actions, and themes, then renders.
 *
 * This exists because the renderer uses its own registry instances.
 * Side-effect imports from the template/action/theme index modules
 * populate their local registries, but the renderer has separate ones.
 * We bridge the gap by registering into the renderer's registries here.
 */

import {
  ActionPageRenderer,
  templates,
  actions,
  type ActionPageRendererProps,
} from "../../plugin/src/components/ActionPageRenderer.tsx";

// Built-in templates
import { HeroSimple } from "../../plugin/src/components/templates/HeroSimple.tsx";
import { HeroMedia } from "../../plugin/src/components/templates/HeroMedia.tsx";
import { HeroStory } from "../../plugin/src/components/templates/HeroStory.tsx";

// Built-in actions
import { FundraiseAction } from "../../plugin/src/components/actions/FundraiseAction.tsx";
import { PetitionAction } from "../../plugin/src/components/actions/PetitionAction.tsx";
import { GOTVAction } from "../../plugin/src/components/actions/GOTVAction.tsx";
import { SignupAction } from "../../plugin/src/components/actions/SignupAction.tsx";

// Register templates into the renderer's registry
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- concrete props widen to Record<string, unknown>
if (!templates.has("hero-simple")) {
  templates.register("hero-simple", HeroSimple as any);
  templates.register("hero-media", HeroMedia as any);
  templates.register("hero-story", HeroStory as any);
}

// Register actions into the renderer's registry
if (!actions.has("fundraise")) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions.register("fundraise", FundraiseAction as any);
  actions.register("petition", PetitionAction as any);
  actions.register("gotv", GOTVAction as any);
  actions.register("signup", SignupAction as any);
}

export default function ActionPageIsland(props: ActionPageRendererProps) {
  return <ActionPageRenderer {...props} />;
}
