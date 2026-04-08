/**
 * ActionPageIsland — thin wrapper that populates the ActionPageRenderer's
 * registries with built-in templates, actions, and themes, then renders.
 *
 * This exists because the renderer uses its own registry instances.
 * Side-effect imports from the template/action/theme index modules
 * populate their local registries, but the renderer has separate ones.
 * We bridge the gap by registering into the renderer's registries here.
 *
 * PERFORMANCE NOTE: This island eagerly imports all 8 action components +
 * 5 template components + the full admin BrandExtractor/PageBuilder tree
 * into a single chunk (>500KB after minification). Code-splitting via
 * React.lazy() + dynamic import() for each action/template would reduce
 * initial bundle size significantly, but requires Vite config changes
 * (e.g. build.rollupOptions.output.manualChunks) and careful handling of
 * the registry pattern. Parked for now — the current bundle loads fine on
 * edge (Cloudflare Workers) but worth revisiting if client-side perf degrades.
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
import { LetterAction } from "../../plugin/src/components/actions/LetterAction.tsx";
import { EventRsvpAction } from "../../plugin/src/components/actions/EventRsvpAction.tsx";
import { CallAction } from "../../plugin/src/components/actions/CallAction.tsx";
import { StepAction } from "../../plugin/src/components/actions/StepAction.tsx";

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
  actions.register("letter", LetterAction as unknown as ActionComponent);
  actions.register("event", EventRsvpAction as unknown as ActionComponent);
  actions.register("call", CallAction as unknown as ActionComponent);
  actions.register("step", StepAction as unknown as ActionComponent);
}

export default function ActionPageIsland(props: ActionPageRendererProps) {
  return <ActionPageRenderer {...props} />;
}
