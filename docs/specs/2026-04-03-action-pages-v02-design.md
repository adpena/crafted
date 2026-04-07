# Campaign Action Pages v0.2 — Design Spec

**Date:** 2026-04-03
**Status:** Approved
**Author:** Alejandro Pena + Claude

## Overview

Action pages are embeddable, composable campaign tools built from three primitives:
- **Template** (top) — renders the story/hero content
- **Action** (bottom) — renders the ask (petition, fundraise, GOTV, signup)
- **Theme** — CSS custom properties that style both

A successful action optionally reveals a **follow-up** (second ask). The natural campaign funnel: low-friction commitment first, fundraise second.

## Core Model

```typescript
interface ActionPage {
  slug: string
  campaign_id?: string

  // Template (top)
  template: string               // registry key: "hero-simple" | "hero-media" | "hero-story" | custom
  template_props: Record<string, unknown>

  // Primary action (bottom)
  action: string                 // "petition" | "fundraise" | "gotv" | "signup" | custom
  action_props: Record<string, unknown>

  // Follow-up (optional, reveals after primary action completes)
  followup?: string              // "fundraise" | "signup" | null
  followup_props?: Record<string, unknown>
  followup_message?: string      // "Thanks! Now chip in?"

  // Compliance
  disclaimer: {
    committee_name: string
    treasurer_name?: string
    candidate_name?: string
    office?: string
  }
  jurisdiction?: string          // "FED" | state code — auto-resolved from visitor geo

  // A/B testing
  variants?: string[]

  // Theme
  theme?: string | Record<string, string>  // registry key or custom theme object

  // Webhooks
  callbacks?: Callback[]
}
```

## Primitives

### Template

A React component that renders the content/story area above the action.

```typescript
type TemplateComponent = (props: Record<string, unknown>) => ReactNode
```

Built-in templates:
- `hero-simple` — headline, subhead, optional alignment
- `hero-media` — headline over full-bleed image/video with overlay
- `hero-story` — headline, body paragraphs, optional pull quote

### Action

A React component that renders the interactive form/action.

```typescript
interface ActionComponentProps {
  onComplete: (data: SubmissionData) => void
  pageId: string
  visitorId: string
  variant?: string
}

type ActionComponent = (props: ActionComponentProps & Record<string, unknown>) => ReactNode
```

Built-in actions:
- `fundraise` — amount buttons, custom amount, ActBlue redirect
- `petition` — name, email, zip, optional comment, signature count
- `gotv` — name, zip, pledge checkbox
- `signup` — email + optional name, list capture

### Theme

A plain object of CSS custom properties applied to the page root.

```typescript
interface Theme {
  "--page-bg": string
  "--page-text": string
  "--page-accent": string
  "--page-secondary": string
  "--page-border": string
  "--page-radius": string
  "--page-font-serif": string
  "--page-font-mono": string
}
```

Built-in themes: `warm` (editorial, matches main site), `bold` (dark, high-contrast), `clean` (white, minimal).

## Registry

Templates, actions, and themes are stored in simple Maps:

```typescript
const templates = new Map<string, TemplateComponent>()
const actions = new Map<string, ActionComponent>()
const themes = new Map<string, Theme>()
```

Custom components are registered by campaigns or agents. The registry is populated at import time — no runtime discovery, no lifecycle hooks.

## Page Renderer

The core rendering logic:

```typescript
function ActionPageRenderer({ page }: { page: ActionPage }) {
  const [completed, setCompleted] = useState(false)
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(null)

  const Template = templates.get(page.template)
  const Action = actions.get(page.action)
  const Followup = page.followup ? actions.get(page.followup) : null
  const theme = resolveTheme(page.theme)

  const handleComplete = (data: SubmissionData) => {
    setSubmissionData(data)
    setCompleted(true)
    fireCallbacks(page.callbacks, page.action, data)
  }

  return (
    <div style={theme}>
      <Template {...page.template_props} />

      {!completed
        ? <Action {...page.action_props} onComplete={handleComplete} />
        : Followup && (
            <Transition>
              {page.followup_message && <p>{page.followup_message}</p>}
              <Followup {...page.followup_props} onComplete={(data) => {
                fireCallbacks(page.callbacks, page.followup, data)
              }} />
            </Transition>
          )
      }

      <Disclaimer {...page.disclaimer} jurisdiction={page.jurisdiction} />
    </div>
  )
}
```

## Follow-up Transition

When the primary action completes:
1. The action component calls `onComplete(data)`
2. `completed` state flips to `true`
3. The primary action fades out (opacity 1→0, translateY 0→-10px, 300ms)
4. The follow-up message + action fades in (opacity 0→1, translateY 10px→0, 500ms)

Single state change, single re-render. The transition is CSS only — no animation libraries.

## Callback / Webhook System

On every successful action, configured callbacks fire asynchronously:

```typescript
interface Callback {
  url: string
  events: string[]          // ["petition_sign", "donation_click", "signup", "gotv_pledge"]
  format: "json" | "form"
  headers?: Record<string, string>
  secret?: string           // HMAC-SHA256 signature in X-Signature header
}
```

- Callbacks fire in parallel, don't block the user response
- 3 retry attempts with exponential backoff (1s, 5s, 25s)
- Each callback gets: event type, submission data, page metadata, timestamp
- HMAC signing with shared secret for webhook verification

## Embed Widget

A single script tag generates a Shadow DOM-isolated action page:

```html
<script src="https://adpena.com/embed/action/my-petition.js" async></script>
```

The script:
1. Creates a `<div>` with Shadow DOM
2. Injects scoped styles (theme CSS variables)
3. Renders the full action page (template + action + disclaimer) inside the shadow root
4. Communicates with the host page via `postMessage` for submission events

## MCP Agent Tools

```
create_campaign      — create a new campaign with name + slug
create_action_page   — create a page with template, action, followup, props, theme
update_action_page   — partial update of any page field
get_submissions      — paginated submission query
get_stats            — A/B variant performance
generate_theme       — AI generates a theme from a natural language prompt
```

## Action Type Specifications

### Fundraise
- **Fields:** amount selection (button grid + custom input)
- **Submit:** redirects to ActBlue URL with amount + refcode params
- **Props:** `{ amounts: number[], actblue_url: string, refcode?: string, suggested?: number }`
- **onComplete data:** `{ type: "donation_click", amount: number }`

### Petition
- **Fields:** first_name, last_name, email, zip, optional comment
- **Submit:** POST to plugin submit route, show success + signature count
- **Props:** `{ target?: string, goal?: number, show_count?: boolean }`
- **onComplete data:** `{ type: "petition_sign", first_name, last_name, email, zip }`

### GOTV Pledge
- **Fields:** first_name, zip, pledge checkbox
- **Submit:** POST to plugin submit route
- **Props:** `{ pledge_text?: string, election_date?: string }`
- **onComplete data:** `{ type: "gotv_pledge", first_name, zip }`

### List Signup
- **Fields:** email, optional first_name
- **Submit:** POST to plugin submit route
- **Props:** `{ list_name?: string, cta_text?: string }`
- **onComplete data:** `{ type: "signup", email, first_name? }`

## File Structure

```
plugin/src/
  components/
    ActionPageRenderer.tsx     — core page renderer (React)
    Transition.tsx             — follow-up reveal animation
    Disclaimer.tsx             — compliance text (React)
    templates/
      HeroSimple.tsx
      HeroMedia.tsx
      HeroStory.tsx
      index.ts                 — template registry
    actions/
      FundraiseAction.tsx
      PetitionAction.tsx
      GOTVAction.tsx
      SignupAction.tsx
      index.ts                 — action registry
    themes/
      index.ts                 — theme registry + built-in themes
  lib/
    callbacks.ts               — webhook dispatch with retry
    registry.ts                — generic Map-based registry
  routes/
    page.ts                    — (update) uses ActionPageRenderer
    submit.ts                  — (update) fires callbacks
    embed.ts                   — (update) full widget generation
    stats.ts                   — (unchanged)
  modules/
    disclaimers.ts             — (unchanged)
    geo-ask.ts                 — (unchanged)
    ab-assign.ts               — (unchanged)
    validate.ts                — (update) add "signup" type
```

## Themes (Built-in)

### warm
Editorial — matches the main site. Georgia serif, warm paper, near-black text.

### bold
Dark mode — high contrast. White text on near-black, red accent, Inter font.

### clean
Minimal — white background, subtle gray borders, system font stack.

## Testing Strategy

- **Unit tests:** each action component, each template, callback dispatch, registry, theme resolution, validation for new "signup" type
- **Integration tests:** full page render with template + action + follow-up transition
- **Visual tests:** Playwright screenshots at desktop + mobile for each template × action combination
- **Webhook tests:** mock HTTP server receives callback payloads with correct data + HMAC signature
```
