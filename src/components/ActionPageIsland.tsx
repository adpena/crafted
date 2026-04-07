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
  type TemplateComponent,
  type ActionComponent,
} from "../../plugin/src/components/ActionPageRenderer.tsx";

// Built-in templates
import { HeroSimple } from "../../plugin/src/components/templates/HeroSimple.tsx";
import { HeroMedia } from "../../plugin/src/components/templates/HeroMedia.tsx";
import { HeroStory } from "../../plugin/src/components/templates/HeroStory.tsx";
import { HeroLayered } from "../../plugin/src/components/templates/HeroLayered.tsx";
import { HeroSplit } from "../../plugin/src/components/templates/HeroSplit.tsx";

// Built-in actions
import { FundraiseAction } from "../../plugin/src/components/actions/FundraiseAction.tsx";
import { PetitionAction } from "../../plugin/src/components/actions/PetitionAction.tsx";
import { GOTVAction } from "../../plugin/src/components/actions/GOTVAction.tsx";
import { SignupAction } from "../../plugin/src/components/actions/SignupAction.tsx";

// Register templates into the renderer's registry
if (!templates.has("hero-simple")) {
  templates.register("hero-simple", HeroSimple as unknown as TemplateComponent);
  templates.register("hero-media", HeroMedia as unknown as TemplateComponent);
  templates.register("hero-story", HeroStory as unknown as TemplateComponent);
  templates.register("hero-layered", HeroLayered as unknown as TemplateComponent);
  templates.register("hero-split", HeroSplit as unknown as TemplateComponent);
}

// Register actions into the renderer's registry
if (!actions.has("fundraise")) {
  actions.register("fundraise", FundraiseAction as unknown as ActionComponent);
  actions.register("petition", PetitionAction as unknown as ActionComponent);
  actions.register("gotv", GOTVAction as unknown as ActionComponent);
  actions.register("signup", SignupAction as unknown as ActionComponent);
}

export default function ActionPageIsland(props: ActionPageRendererProps) {
  return <ActionPageRenderer {...props} />;
}
