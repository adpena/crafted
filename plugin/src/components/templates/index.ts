import type { ReactNode } from "react";
import { createRegistry } from "../../lib/registry";
import { HeroSimple } from "./HeroSimple";
import { HeroMedia } from "./HeroMedia";
import { HeroStory } from "./HeroStory";
import { HeroLayered } from "./HeroLayered";
import { HeroSplit } from "./HeroSplit";

export type TemplateProps = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TemplateComponent = (props: any) => ReactNode;

export const templates = createRegistry<TemplateComponent>("templates");

templates.register("hero-simple", HeroSimple);
templates.register("hero-media", HeroMedia);
templates.register("hero-story", HeroStory);
templates.register("hero-layered", HeroLayered);
templates.register("hero-split", HeroSplit);

export { HeroSimple, HeroMedia, HeroStory, HeroLayered, HeroSplit };
export type { HeroSimpleProps } from "./HeroSimple";
export type { HeroMediaProps } from "./HeroMedia";
export type { HeroStoryProps } from "./HeroStory";
export type { HeroLayeredProps } from "./HeroLayered";
export type { HeroSplitProps } from "./HeroSplit";
