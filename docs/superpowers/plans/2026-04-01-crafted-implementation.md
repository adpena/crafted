# Crafted Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal portfolio site on emdash CMS with a Campaign Action Page plugin, deployed to Cloudflare, designed for open-source release.

**Architecture:** emdash (Astro 6 + Cloudflare D1/R2/Workers) powers the portfolio site. A standard-format emdash plugin provides campaign action page creation, geo-personalized donation asks, FEC/state disclaimer auto-generation, and an embeddable widget. Pure business logic modules are isolated for future Molt replacement.

**Tech Stack:** emdash CMS, Astro 6, React 19, TailwindCSS 4, Cloudflare (D1, R2, KV, Workers, Turnstile), TypeScript (strict), Vitest, Playwright, oxlint, oxfmt

**Spec:** `docs/superpowers/specs/2026-04-01-crafted-design.md`

---

## File Structure

```
crafted/
├── astro.config.mjs
├── wrangler.jsonc
├── tsconfig.json
├── package.json
├── emdash-env.d.ts
├── seed/seed.json
├── src/
│   ├── live.config.ts
│   ├── components/
│   │   ├── Masthead.astro
│   │   ├── ProjectCard.astro
│   │   ├── FeaturedProject.astro
│   │   ├── StatusBar.astro
│   │   ├── ProjectSidebar.astro
│   │   ├── MetricsBanner.tsx          # React island
│   │   ├── TabbedContent.tsx          # React island
│   │   └── ResizablePanel.tsx         # React island (canvas.measureText)
│   ├── layouts/
│   │   └── Base.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── contact.astro
│   │   ├── work/index.astro
│   │   └── work/[slug].astro
│   └── styles/
│       └── global.css
├── plugin/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                   # PluginDescriptor
│   │   ├── sandbox-entry.ts           # definePlugin()
│   │   ├── hooks/
│   │   │   ├── content-after-save.ts
│   │   │   ├── page-metadata.ts
│   │   │   └── cron.ts
│   │   ├── routes/
│   │   │   ├── submit.ts
│   │   │   ├── page.ts
│   │   │   ├── embed.ts
│   │   │   └── stats.ts
│   │   ├── admin/
│   │   │   ├── ActionPageBuilder.tsx
│   │   │   ├── SubmissionsViewer.tsx
│   │   │   ├── AbDashboard.tsx
│   │   │   └── DisclaimerManager.tsx
│   │   └── modules/
│   │       ├── disclaimers.ts
│   │       ├── geo-ask.ts
│   │       ├── ab-assign.ts
│   │       └── validate.ts
│   └── tests/
│       ├── disclaimers.test.ts
│       ├── geo-ask.test.ts
│       ├── ab-assign.test.ts
│       └── validate.test.ts
├── data/
│   └── disclaimers/
│       ├── schema.json
│       ├── federal.json
│       └── states/
│           ├── dc.json
│           ├── va.json
│           ├── md.json
│           ├── ny.json
│           ├── ca.json
│           ├── tx.json
│           ├── fl.json
│           ├── pa.json
│           ├── ga.json
│           └── co.json
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── README.md
├── .gitignore
└── e2e/
    └── tests/
        ├── portfolio.spec.ts
        └── action-page.spec.ts
```

---

## Task 1: Scaffold Project

**Files:**
- Create: `package.json`, `astro.config.mjs`, `wrangler.jsonc`, `tsconfig.json`, `emdash-env.d.ts`, `src/live.config.ts`, `.gitignore`, `LICENSE`
- Create: `seed/seed.json`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/adpena/Projects/crafted
git init
```

- [ ] **Step 2: Download the portfolio-cloudflare template**

```bash
npx giget github:emdash-cms/templates/portfolio-cloudflare . --force
```

This downloads the full template including `astro.config.mjs`, `wrangler.jsonc`, `seed/seed.json`, all page templates, and the AGENTS.md skill files.

- [ ] **Step 3: Update package.json**

Replace the template's `package.json` with standalone versions (not monorepo workspace refs):

```json
{
  "name": "crafted",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "emdash": { "seed": "seed/seed.json" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "deploy": "astro build && wrangler deploy",
    "typecheck": "astro check",
    "bootstrap": "emdash init && emdash seed",
    "seed": "emdash seed",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "oxlint ."
  },
  "dependencies": {
    "@astrojs/cloudflare": "^12.0.0",
    "@astrojs/react": "^4.0.0",
    "@emdash-cms/cloudflare": "^0.1.0",
    "astro": "^6.0.0",
    "emdash": "^0.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.10.0",
    "@cloudflare/workers-types": "^4.0.0",
    "vitest": "^3.0.0",
    "wrangler": "^4.0.0"
  }
}
```

Note: Pin exact emdash version after install. Check actual latest versions — these are approximations. Apply 1-week delay policy: use versions at least 7 days old.

- [ ] **Step 4: Update wrangler.jsonc**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "crafted",
  "compatibility_date": "2026-03-24",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "crafted",
      "database_id": "local"
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA",
      "bucket_name": "crafted-media"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "local"
    }
  ]
}
```

- [ ] **Step 5: Add MIT LICENSE file**

```
MIT License

Copyright (c) 2026 [Your Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 6: Add .gitignore**

```
node_modules/
dist/
.astro/
.wrangler/
.mf/
data.db
*.db-journal
.env
.env.*
.superpowers/
worker-configuration.d.ts
```

- [ ] **Step 7: Install dependencies**

```bash
npm install
```

- [ ] **Step 8: Create Cloudflare resources (local dev)**

```bash
npx wrangler d1 create crafted
```

Copy the `database_id` from the output and paste it into `wrangler.jsonc` replacing `"local"`.

- [ ] **Step 9: Bootstrap emdash**

```bash
npm run bootstrap
```

This runs `emdash init` (creates DB schema) and `emdash seed` (loads the portfolio seed data).

- [ ] **Step 10: Verify dev server starts**

```bash
npm run dev
```

Visit `http://localhost:4321` — should see the default portfolio template. Visit `http://localhost:4321/_emdash/admin` — should see the admin panel (dev auth bypass).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "scaffold emdash portfolio-cloudflare project"
```

---

## Task 2: Editorial Hybrid Visual Design

**Files:**
- Create: `src/styles/global.css`
- Modify: `src/layouts/Base.astro`

- [ ] **Step 1: Create global.css with Editorial Hybrid tokens**

Create `src/styles/global.css`:

```css
@import "tailwindcss";

:root {
  --color-bg: #f5f5f0;
  --color-text: #1a1a1a;
  --color-secondary: #888888;
  --color-accent: #22c55e;
  --color-code-bg: #eeeee8;
  --color-code-text: #666666;
  --color-border: #e0ddd8;
  --color-border-strong: #dddddd;

  --font-serif: Georgia, "Times New Roman", serif;
  --font-mono: "Courier New", ui-monospace, monospace;

  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;
}

html {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-serif);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

body {
  max-width: 64rem;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg);
}

h1, h2, h3, h4 {
  font-family: var(--font-serif);
  font-weight: 600;
  line-height: 1.2;
}

code, pre, .mono {
  font-family: var(--font-mono);
}

a {
  color: var(--color-text);
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

a:hover {
  color: var(--color-secondary);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
```

- [ ] **Step 2: Update Base.astro layout**

Replace `src/layouts/Base.astro`:

```astro
---
import { EmDashHead, getSiteSettings } from "emdash";
import "../styles/global.css";

interface Props {
  title?: string;
  description?: string;
}

const settings = await getSiteSettings();
const { title, description } = Astro.props;
const pageTitle = title ? `${title} — ${settings.title}` : settings.title;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description ?? settings.tagline} />
    <title>{pageTitle}</title>
    <EmDashHead />
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 3: Verify styles load**

```bash
npm run dev
```

Visit `http://localhost:4321` — should see warm paper background, serif text. Inspect the page to verify CSS variables are applied.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css src/layouts/Base.astro
git commit -m "add editorial hybrid visual design tokens and base layout"
```

---

## Task 3: Newspaper Homepage

**Files:**
- Create: `src/components/Masthead.astro`, `src/components/FeaturedProject.astro`, `src/components/StatusBar.astro`
- Modify: `src/pages/index.astro`, `src/components/ProjectCard.astro`

- [ ] **Step 1: Create Masthead.astro**

Create `src/components/Masthead.astro`:

```astro
---
import { getSiteSettings } from "emdash";
const settings = await getSiteSettings();
---
<header role="banner">
  <div style="text-align:center; padding-bottom:var(--space-md); border-bottom:2px solid var(--color-text); margin-bottom:var(--space-md);">
    <h1 style="font-family:var(--font-serif); font-size:1.75rem; letter-spacing:0.05em; text-transform:uppercase; margin:0;">
      {settings.title}
    </h1>
    <p class="mono" style="color:var(--color-secondary); font-size:0.75rem; margin-top:var(--space-xs);">
      {settings.tagline}
    </p>
  </div>
  <nav aria-label="Main navigation" style="display:flex; justify-content:center; gap:var(--space-lg); padding-bottom:var(--space-md); border-bottom:1px solid var(--color-border); margin-bottom:var(--space-xl);">
    <a href="/" style="font-size:0.8rem;">Home</a>
    <a href="/work" style="font-size:0.8rem;">Work</a>
    <a href="/about" style="font-size:0.8rem;">About</a>
    <a href="/contact" style="font-size:0.8rem;">Contact</a>
  </nav>
</header>
```

- [ ] **Step 2: Create FeaturedProject.astro**

Create `src/components/FeaturedProject.astro`:

```astro
---
import { Image } from "emdash/ui";

interface Props {
  project: {
    id: string;
    data: {
      title: string;
      summary?: string;
      featured_image?: { src: string; alt: string };
      client?: string;
      year?: number;
    };
  };
}

const { project } = Astro.props;
---
<article>
  <span class="mono" style="color:var(--color-secondary); font-size:0.625rem; text-transform:uppercase; letter-spacing:0.15em;">
    Featured
  </span>
  <h2 style="font-size:1.25rem; margin-top:var(--space-xs); margin-bottom:var(--space-sm);">
    <a href={`/work/${project.id}`} style="text-decoration:none;">
      {project.data.title}
    </a>
  </h2>
  {project.data.summary && (
    <p style="color:var(--color-secondary); font-size:0.85rem; line-height:1.6; margin-bottom:var(--space-md);">
      {project.data.summary}
    </p>
  )}
  <a href={`/work/${project.id}`} style="font-size:0.85rem;">
    Read more &rarr;
  </a>
</article>
```

- [ ] **Step 3: Create StatusBar.astro**

Create `src/components/StatusBar.astro`:

```astro
---
interface Props {
  items: { label: string; active?: boolean }[];
}
const { items } = Astro.props;
---
<footer role="contentinfo" style="display:flex; gap:var(--space-md); align-items:center; padding-top:var(--space-md); border-top:1px solid var(--color-border); margin-top:var(--space-xl);">
  {items.map((item) => (
    <span class="mono" style="display:flex; gap:var(--space-xs); align-items:center; font-size:0.625rem; color:var(--color-secondary);">
      {item.active && (
        <span style="width:6px; height:6px; border-radius:50%; background:var(--color-accent);" aria-hidden="true" />
      )}
      {item.label}
    </span>
  ))}
</footer>
```

- [ ] **Step 4: Update ProjectCard.astro for newspaper style**

Replace `src/components/ProjectCard.astro`:

```astro
---
interface Props {
  project: {
    id: string;
    data: {
      title: string;
      summary?: string;
      client?: string;
    };
  };
}

const { project } = Astro.props;
---
<article style="padding-bottom:var(--space-md); margin-bottom:var(--space-md); border-bottom:1px solid var(--color-border);">
  <h3 style="font-size:0.95rem; margin:0;">
    <a href={`/work/${project.id}`} style="text-decoration:none;">
      {project.data.title}
    </a>
  </h3>
  {project.data.summary && (
    <p style="color:var(--color-secondary); font-size:0.75rem; margin-top:var(--space-xs); margin-bottom:0;">
      {project.data.summary}
    </p>
  )}
</article>
```

- [ ] **Step 5: Build the newspaper homepage**

Replace `src/pages/index.astro`:

```astro
---
import { getEmDashCollection } from "emdash";
import Base from "../layouts/Base.astro";
import Masthead from "../components/Masthead.astro";
import FeaturedProject from "../components/FeaturedProject.astro";
import ProjectCard from "../components/ProjectCard.astro";
import StatusBar from "../components/StatusBar.astro";

const { entries: projects, cacheHint } = await getEmDashCollection("projects");
Astro.cache.set(cacheHint);

const featured = projects[0];
const rest = projects.slice(1);
---
<Base>
  <Masthead />

  <main style="display:flex; gap:var(--space-xl);">
    <section style="flex:1;" aria-label="Featured project">
      {featured && <FeaturedProject project={featured} />}
    </section>

    <div style="width:1px; background:var(--color-border);" aria-hidden="true" />

    <section style="flex:1;" aria-label="All projects">
      <span class="mono" style="color:var(--color-secondary); font-size:0.625rem; text-transform:uppercase; letter-spacing:0.15em; display:block; margin-bottom:var(--space-md);">
        Latest
      </span>
      {rest.map((project) => (
        <ProjectCard project={project} />
      ))}
    </section>
  </main>

  <StatusBar items={[
    { label: "molt v0.1", active: true },
    { label: "crafted v0.1", active: true },
    { label: "open to work" },
  ]} />
</Base>
```

- [ ] **Step 6: Verify homepage renders**

```bash
npm run dev
```

Visit `http://localhost:4321` — should see centered masthead, two-column newspaper layout with featured project on the left and project list on the right.

- [ ] **Step 7: Commit**

```bash
git add src/components/Masthead.astro src/components/FeaturedProject.astro src/components/StatusBar.astro src/components/ProjectCard.astro src/pages/index.astro
git commit -m "build newspaper homepage layout"
```

---

## Task 4: Project Detail Pages (Base Layout B)

**Files:**
- Create: `src/components/ProjectSidebar.astro`
- Modify: `src/pages/work/[slug].astro`

- [ ] **Step 1: Create ProjectSidebar.astro**

Create `src/components/ProjectSidebar.astro`:

```astro
---
import { getEntryTerms } from "emdash";

interface Props {
  project: {
    id: string;
    data: {
      url?: string;
      year?: number;
      client?: string;
    };
  };
}

const { project } = Astro.props;
const tags = await getEntryTerms("projects", project.id, "tag");
---
<aside style="min-width:8rem; border-left:1px solid var(--color-border); padding-left:var(--space-lg);" aria-label="Project details">
  {tags.length > 0 && (
    <div style="margin-bottom:var(--space-lg);">
      <span class="mono" style="color:var(--color-secondary); font-size:0.625rem; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:var(--space-sm);">
        Stack
      </span>
      <ul style="list-style:none; padding:0; margin:0;">
        {tags.map((tag) => (
          <li class="mono" style="font-size:0.75rem; line-height:2; color:var(--color-code-text);">
            {tag.name}
          </li>
        ))}
      </ul>
    </div>
  )}

  {project.data.url && (
    <div style="margin-bottom:var(--space-lg);">
      <span class="mono" style="color:var(--color-secondary); font-size:0.625rem; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:var(--space-sm);">
        Links
      </span>
      <a href={project.data.url} class="mono" style="font-size:0.75rem;" target="_blank" rel="noopener noreferrer">
        GitHub &rarr;
      </a>
    </div>
  )}

  {project.data.year && (
    <div style="margin-bottom:var(--space-lg);">
      <span class="mono" style="color:var(--color-secondary); font-size:0.625rem; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:var(--space-sm);">
        Year
      </span>
      <span class="mono" style="font-size:0.75rem; color:var(--color-code-text);">
        {project.data.year}
      </span>
    </div>
  )}

  <div>
    <span class="mono" style="color:var(--color-secondary); font-size:0.625rem; text-transform:uppercase; letter-spacing:0.1em; display:block; margin-bottom:var(--space-sm);">
      Status
    </span>
    <span style="display:flex; gap:var(--space-xs); align-items:center;">
      <span style="width:5px; height:5px; border-radius:50%; background:var(--color-accent);" aria-hidden="true" />
      <span class="mono" style="font-size:0.75rem; color:var(--color-code-text);">Active</span>
    </span>
  </div>
</aside>
```

- [ ] **Step 2: Build project detail page (Layout B)**

Replace `src/pages/work/[slug].astro`:

```astro
---
import { getEmDashEntry } from "emdash";
import { PortableText, Image } from "emdash/ui";
import Base from "../../layouts/Base.astro";
import ProjectSidebar from "../../components/ProjectSidebar.astro";

const { slug } = Astro.params;
const { entry: project, cacheHint } = await getEmDashEntry("projects", slug!);
Astro.cache.set(cacheHint);

if (!project) {
  return Astro.redirect("/404");
}
---
<Base title={project.data.title}>
  <nav aria-label="Breadcrumb" style="margin-bottom:var(--space-xl);">
    <span class="mono" style="color:var(--color-secondary); font-size:0.7rem;">
      <a href="/" style="color:var(--color-secondary);">crafted</a>
      {" / "}
      <a href="/work" style="color:var(--color-secondary);">projects</a>
      {" / "}
      {project.data.title.toLowerCase()}
    </span>
  </nav>

  <main style="display:flex; gap:var(--space-xl);">
    <article style="flex:1; min-width:0;">
      <h1 style="font-size:1.5rem; margin-bottom:var(--space-xs);">
        {project.data.title}
      </h1>
      {project.data.summary && (
        <p style="color:var(--color-secondary); font-size:0.9rem; margin-bottom:var(--space-xl);">
          {project.data.summary}
        </p>
      )}

      {project.data.featured_image && (
        <div style="margin-bottom:var(--space-xl);">
          <Image image={project.data.featured_image} width={720} />
        </div>
      )}

      <div style="font-size:0.9rem;">
        <PortableText content={project.data.content} />
      </div>
    </article>

    <ProjectSidebar project={project} />
  </main>
</Base>
```

- [ ] **Step 3: Verify project detail page renders**

```bash
npm run dev
```

Visit `http://localhost:4321/work/meridian` (or whatever slug the seed data uses) — should see case study layout with sidebar.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProjectSidebar.astro src/pages/work/\[slug\].astro
git commit -m "build project detail page with case study sidebar layout"
```

---

## Task 5: Pure Modules — Disclaimer Resolution

**Files:**
- Create: `plugin/src/modules/disclaimers.ts`, `plugin/tests/disclaimers.test.ts`
- Create: `data/disclaimers/schema.json`, `data/disclaimers/federal.json`, `data/disclaimers/states/dc.json`

- [ ] **Step 1: Create plugin directory and package.json**

```bash
mkdir -p plugin/src/modules plugin/tests data/disclaimers/states
```

Create `plugin/package.json`:

```json
{
  "name": "@crafted/action-pages",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./sandbox": "./src/sandbox-entry.ts",
    "./admin": "./src/admin/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

Create `plugin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 2: Create disclaimer schema**

Create `data/disclaimers/schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["jurisdiction", "type", "required_text", "statute_citation", "effective_date", "last_verified", "source_url"],
  "properties": {
    "jurisdiction": {
      "type": "string",
      "pattern": "^(FED|[A-Z]{2})$"
    },
    "type": {
      "type": "string",
      "enum": ["digital", "print", "broadcast", "sms", "email"]
    },
    "required_text": {
      "type": "string",
      "description": "Template string. Use {committee_name}, {treasurer_name}, {address} as placeholders."
    },
    "adapted_text": {
      "type": ["string", "null"],
      "description": "Short-form disclaimer for small formats."
    },
    "statute_citation": { "type": "string" },
    "ai_disclosure_required": { "type": "boolean" },
    "ai_disclosure_text": { "type": ["string", "null"] },
    "effective_date": { "type": "string", "format": "date" },
    "last_verified": { "type": "string", "format": "date" },
    "source_url": { "type": "string", "format": "uri" }
  },
  "additionalProperties": false
}
```

- [ ] **Step 3: Create federal disclaimer data**

Create `data/disclaimers/federal.json`:

```json
[
  {
    "jurisdiction": "FED",
    "type": "digital",
    "required_text": "Paid for by {committee_name}",
    "adapted_text": "Paid for by {committee_name}",
    "statute_citation": "11 CFR 110.11",
    "ai_disclosure_required": false,
    "ai_disclosure_text": null,
    "effective_date": "2023-03-01",
    "last_verified": "2026-04-01",
    "source_url": "https://www.ecfr.gov/current/title-11/chapter-I/subchapter-A/part-110/section-110.11"
  },
  {
    "jurisdiction": "FED",
    "type": "print",
    "required_text": "Paid for by {committee_name}, {treasurer_name}, Treasurer",
    "adapted_text": "Paid for by {committee_name}",
    "statute_citation": "11 CFR 110.11(b)(3)",
    "ai_disclosure_required": false,
    "ai_disclosure_text": null,
    "effective_date": "2023-03-01",
    "last_verified": "2026-04-01",
    "source_url": "https://www.ecfr.gov/current/title-11/chapter-I/subchapter-A/part-110/section-110.11"
  }
]
```

- [ ] **Step 4: Create DC disclaimer data**

Create `data/disclaimers/states/dc.json`:

```json
[
  {
    "jurisdiction": "DC",
    "type": "digital",
    "required_text": "Paid for by {committee_name}",
    "adapted_text": null,
    "statute_citation": "DC Code 1-1163.13",
    "ai_disclosure_required": false,
    "ai_disclosure_text": null,
    "effective_date": "2020-01-01",
    "last_verified": "2026-04-01",
    "source_url": "https://code.dccouncil.gov/us/dc/council/code/sections/1-1163.13"
  }
]
```

- [ ] **Step 5: Write failing tests for disclaimer module**

Create `plugin/tests/disclaimers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveDisclaimer, loadDisclaimers, type Disclaimer, type DisclaimerQuery } from "../src/modules/disclaimers.ts";

const testData: Disclaimer[] = [
  {
    jurisdiction: "FED",
    type: "digital",
    required_text: "Paid for by {committee_name}",
    adapted_text: "Paid for by {committee_name}",
    statute_citation: "11 CFR 110.11",
    ai_disclosure_required: false,
    ai_disclosure_text: null,
    effective_date: "2023-03-01",
    last_verified: "2026-04-01",
    source_url: "https://www.ecfr.gov/current/title-11/chapter-I/subchapter-A/part-110/section-110.11",
  },
  {
    jurisdiction: "DC",
    type: "digital",
    required_text: "Paid for by {committee_name}",
    adapted_text: null,
    statute_citation: "DC Code 1-1163.13",
    ai_disclosure_required: false,
    ai_disclosure_text: null,
    effective_date: "2020-01-01",
    last_verified: "2026-04-01",
    source_url: "https://code.dccouncil.gov/us/dc/council/code/sections/1-1163.13",
  },
];

describe("resolveDisclaimer", () => {
  it("returns federal disclaimer for known jurisdiction", () => {
    const query: DisclaimerQuery = {
      committee_name: "Friends of Jane",
      jurisdiction: "DC",
      ad_type: "digital",
    };
    const result = resolveDisclaimer(testData, query);
    expect(result.federal).toBe("Paid for by Friends of Jane");
    expect(result.state).toBe("Paid for by Friends of Jane");
  });

  it("returns only federal when state has no matching rule", () => {
    const query: DisclaimerQuery = {
      committee_name: "Friends of Jane",
      jurisdiction: "ZZ",
      ad_type: "digital",
    };
    const result = resolveDisclaimer(testData, query);
    expect(result.federal).toBe("Paid for by Friends of Jane");
    expect(result.state).toBeNull();
  });

  it("substitutes all placeholders", () => {
    const query: DisclaimerQuery = {
      committee_name: "Committee to Elect",
      treasurer_name: "John Smith",
      jurisdiction: "FED",
      ad_type: "digital",
    };
    const result = resolveDisclaimer(testData, query);
    expect(result.federal).toBe("Paid for by Committee to Elect");
  });

  it("returns combined text with both federal and state", () => {
    const query: DisclaimerQuery = {
      committee_name: "DC PAC",
      jurisdiction: "DC",
      ad_type: "digital",
    };
    const result = resolveDisclaimer(testData, query);
    expect(result.combined).toContain("Paid for by DC PAC");
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
cd plugin && npx vitest run tests/disclaimers.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement disclaimer module**

Create `plugin/src/modules/disclaimers.ts`:

```typescript
export interface Disclaimer {
  jurisdiction: string;
  type: string;
  required_text: string;
  adapted_text: string | null;
  statute_citation: string;
  ai_disclosure_required: boolean;
  ai_disclosure_text: string | null;
  effective_date: string;
  last_verified: string;
  source_url: string;
}

export interface DisclaimerQuery {
  committee_name: string;
  treasurer_name?: string;
  address?: string;
  jurisdiction: string;
  ad_type: string;
}

export interface DisclaimerResult {
  federal: string | null;
  state: string | null;
  ai_disclosure: string | null;
  combined: string;
  citations: string[];
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function findRule(data: Disclaimer[], jurisdiction: string, adType: string): Disclaimer | undefined {
  return data.find((d) => d.jurisdiction === jurisdiction && d.type === adType);
}

export function resolveDisclaimer(data: Disclaimer[], query: DisclaimerQuery): DisclaimerResult {
  const vars: Record<string, string> = {
    committee_name: query.committee_name,
    treasurer_name: query.treasurer_name ?? "",
    address: query.address ?? "",
  };

  const fedRule = findRule(data, "FED", query.ad_type);
  const stateRule = findRule(data, query.jurisdiction, query.ad_type);

  const federal = fedRule ? interpolate(fedRule.required_text, vars) : null;
  const state = stateRule ? interpolate(stateRule.required_text, vars) : null;

  const aiRule = stateRule?.ai_disclosure_required ? stateRule : fedRule?.ai_disclosure_required ? fedRule : null;
  const ai_disclosure = aiRule?.ai_disclosure_text ? interpolate(aiRule.ai_disclosure_text, vars) : null;

  const parts = [federal, state && state !== federal ? state : null, ai_disclosure].filter(Boolean);
  const combined = parts.join(" | ");

  const citations = [fedRule?.statute_citation, stateRule?.statute_citation].filter((c): c is string => c != null);

  return { federal, state, ai_disclosure, combined, citations };
}

export function loadDisclaimers(federal: Disclaimer[], ...states: Disclaimer[][]): Disclaimer[] {
  return [federal, ...states].flat();
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd plugin && npx vitest run tests/disclaimers.test.ts
```

Expected: PASS (all 4 tests).

- [ ] **Step 9: Commit**

```bash
git add plugin/ data/disclaimers/
git commit -m "add disclaimer resolution module with federal and DC data"
```

---

## Task 6: Pure Modules — Geo-Personalized Donation Asks

**Files:**
- Create: `plugin/src/modules/geo-ask.ts`, `plugin/tests/geo-ask.test.ts`

- [ ] **Step 1: Write failing tests**

Create `plugin/tests/geo-ask.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { suggestAmounts, type GeoContext, type AmountConfig } from "../src/modules/geo-ask.ts";

const config: AmountConfig = {
  base: [10, 25, 50, 100, 250],
  regions: {
    "US-CA": { multiplier: 1.4 },
    "US-TX": { multiplier: 0.9 },
    "US-DC": { multiplier: 1.3 },
  },
  fallback_multiplier: 1.0,
};

describe("suggestAmounts", () => {
  it("applies regional multiplier for known region", () => {
    const geo: GeoContext = { country: "US", region: "CA" };
    const result = suggestAmounts(config, geo);
    expect(result).toEqual([14, 35, 70, 140, 350]);
  });

  it("uses fallback multiplier for unknown region", () => {
    const geo: GeoContext = { country: "US", region: "WY" };
    const result = suggestAmounts(config, geo);
    expect(result).toEqual([10, 25, 50, 100, 250]);
  });

  it("uses fallback for non-US country", () => {
    const geo: GeoContext = { country: "GB", region: "" };
    const result = suggestAmounts(config, geo);
    expect(result).toEqual([10, 25, 50, 100, 250]);
  });

  it("rounds to nearest whole dollar", () => {
    const geo: GeoContext = { country: "US", region: "TX" };
    const result = suggestAmounts(config, geo);
    expect(result).toEqual([9, 23, 45, 90, 225]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd plugin && npx vitest run tests/geo-ask.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement geo-ask module**

Create `plugin/src/modules/geo-ask.ts`:

```typescript
export interface GeoContext {
  country: string;
  region: string;
}

export interface RegionConfig {
  multiplier: number;
}

export interface AmountConfig {
  base: number[];
  regions: Record<string, RegionConfig>;
  fallback_multiplier: number;
}

export function suggestAmounts(config: AmountConfig, geo: GeoContext): number[] {
  const regionKey = `${geo.country}-${geo.region}`;
  const region = config.regions[regionKey];
  const multiplier = region?.multiplier ?? config.fallback_multiplier;

  return config.base.map((amount) => Math.round(amount * multiplier));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd plugin && npx vitest run tests/geo-ask.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/modules/geo-ask.ts plugin/tests/geo-ask.test.ts
git commit -m "add geo-personalized donation amount module"
```

---

## Task 7: Pure Modules — A/B Variant Assignment

**Files:**
- Create: `plugin/src/modules/ab-assign.ts`, `plugin/tests/ab-assign.test.ts`

- [ ] **Step 1: Write failing tests**

Create `plugin/tests/ab-assign.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { assignVariant, hashVisitor } from "../src/modules/ab-assign.ts";

describe("hashVisitor", () => {
  it("returns consistent hash for same input", () => {
    const a = hashVisitor("user-123");
    const b = hashVisitor("user-123");
    expect(a).toBe(b);
  });

  it("returns different hashes for different inputs", () => {
    const a = hashVisitor("user-123");
    const b = hashVisitor("user-456");
    expect(a).not.toBe(b);
  });
});

describe("assignVariant", () => {
  it("assigns a variant from the list", () => {
    const variants = ["control", "headline-v2", "cta-v3"];
    const result = assignVariant("visitor-abc", variants);
    expect(variants).toContain(result);
  });

  it("is deterministic for the same visitor", () => {
    const variants = ["a", "b", "c"];
    const first = assignVariant("visitor-xyz", variants);
    const second = assignVariant("visitor-xyz", variants);
    expect(first).toBe(second);
  });

  it("distributes across variants", () => {
    const variants = ["a", "b"];
    const assignments = new Set<string>();
    for (let i = 0; i < 100; i++) {
      assignments.add(assignVariant(`visitor-${i}`, variants));
    }
    expect(assignments.size).toBe(2);
  });

  it("returns the only variant if list has one entry", () => {
    const result = assignVariant("anyone", ["only"]);
    expect(result).toBe("only");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd plugin && npx vitest run tests/ab-assign.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement A/B assignment module**

Create `plugin/src/modules/ab-assign.ts`:

```typescript
export function hashVisitor(visitorId: string): number {
  let hash = 0;
  for (let i = 0; i < visitorId.length; i++) {
    const char = visitorId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

export function assignVariant(visitorId: string, variants: string[]): string {
  const hash = hashVisitor(visitorId);
  const index = hash % variants.length;
  return variants[index]!;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd plugin && npx vitest run tests/ab-assign.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/modules/ab-assign.ts plugin/tests/ab-assign.test.ts
git commit -m "add deterministic A/B variant assignment module"
```

---

## Task 8: Pure Modules — Form Validation

**Files:**
- Create: `plugin/src/modules/validate.ts`, `plugin/tests/validate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `plugin/tests/validate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateSubmission, type ValidationResult } from "../src/modules/validate.ts";

describe("validateSubmission", () => {
  it("passes valid donation click", () => {
    const result = validateSubmission({
      type: "donation_click",
      data: { amount: 25, refcode: "email-2026-04" },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("passes valid petition signature", () => {
    const result = validateSubmission({
      type: "petition_sign",
      data: { first_name: "Jane", last_name: "Doe", email: "jane@example.com", zip: "20001" },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects petition missing required fields", () => {
    const result = validateSubmission({
      type: "petition_sign",
      data: { first_name: "Jane" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects invalid email", () => {
    const result = validateSubmission({
      type: "petition_sign",
      data: { first_name: "Jane", last_name: "Doe", email: "not-an-email", zip: "20001" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("email: invalid format");
  });

  it("rejects unknown submission type", () => {
    const result = validateSubmission({
      type: "unknown" as "donation_click",
      data: {},
    });
    expect(result.valid).toBe(false);
  });

  it("sanitizes string inputs", () => {
    const result = validateSubmission({
      type: "petition_sign",
      data: { first_name: "<script>alert(1)</script>", last_name: "Doe", email: "jane@example.com", zip: "20001" },
    });
    expect(result.valid).toBe(true);
    expect(result.sanitized!.first_name).not.toContain("<script>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd plugin && npx vitest run tests/validate.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement validation module**

Create `plugin/src/modules/validate.ts`:

```typescript
export interface SubmissionInput {
  type: "donation_click" | "petition_sign" | "gotv_pledge";
  data: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: Record<string, unknown>;
}

function sanitizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[<>]/g, "").trim();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const schemas: Record<string, { required: string[]; email?: string[] }> = {
  donation_click: { required: [] },
  petition_sign: { required: ["first_name", "last_name", "email", "zip"], email: ["email"] },
  gotv_pledge: { required: ["first_name", "zip"], email: [] },
};

export function validateSubmission(input: SubmissionInput): ValidationResult {
  const schema = schemas[input.type];
  if (!schema) {
    return { valid: false, errors: ["unknown submission type"] };
  }

  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const field of schema.required) {
    const raw = input.data[field];
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      errors.push(`${field}: required`);
      continue;
    }
    const clean = typeof raw === "string" ? sanitizeString(raw) : raw;
    sanitized[field] = clean;
  }

  if (schema.email) {
    for (const field of schema.email) {
      const value = sanitized[field] ?? input.data[field];
      if (typeof value === "string" && !isEmail(value)) {
        errors.push(`${field}: invalid format`);
      }
    }
  }

  for (const [key, value] of Object.entries(input.data)) {
    if (!(key in sanitized)) {
      sanitized[key] = typeof value === "string" ? sanitizeString(value) : value;
    }
  }

  return { valid: errors.length === 0, errors, sanitized: errors.length === 0 ? sanitized : undefined };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd plugin && npx vitest run tests/validate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin/src/modules/validate.ts plugin/tests/validate.test.ts
git commit -m "add form validation and sanitization module"
```

---

## Task 9: Plugin Descriptor and Sandbox Entry

**Files:**
- Create: `plugin/src/index.ts`, `plugin/src/sandbox-entry.ts`
- Create: `plugin/src/hooks/content-after-save.ts`, `plugin/src/hooks/page-metadata.ts`, `plugin/src/hooks/cron.ts`
- Create: `plugin/src/routes/submit.ts`, `plugin/src/routes/page.ts`, `plugin/src/routes/embed.ts`, `plugin/src/routes/stats.ts`

- [ ] **Step 1: Create plugin descriptor**

Create `plugin/src/index.ts`:

```typescript
import type { PluginDescriptor } from "emdash";

export function actionPages(): PluginDescriptor {
  return {
    id: "crafted-action-pages",
    version: "0.1.0",
    format: "standard",
    entrypoint: "@crafted/action-pages/sandbox",
    capabilities: [
      "read:content",
      "write:content",
      "email:send",
      "network:fetch",
      "page:inject",
    ],
    storage: {
      action_pages: {
        indexes: [["slug"], ["status"]],
      },
      submissions: {
        indexes: [["page_id"], ["created_at"]],
      },
      ab_variants: {
        indexes: [["page_id"]],
      },
    },
    adminPages: [
      { name: "Action Pages", slug: "action-pages" },
      { name: "Submissions", slug: "submissions" },
      { name: "Disclaimers", slug: "disclaimers" },
    ],
    adminWidgets: [
      { name: "A/B Dashboard", slug: "ab-dashboard" },
    ],
  };
}
```

- [ ] **Step 2: Create route handlers**

Create `plugin/src/routes/submit.ts`:

```typescript
import type { PluginContext } from "emdash";
import { validateSubmission } from "../modules/validate.ts";

export async function handleSubmit(input: { page_slug: string; type: string; data: Record<string, unknown>; turnstile_token: string }, ctx: PluginContext) {
  const validation = validateSubmission({
    type: input.type as "donation_click" | "petition_sign" | "gotv_pledge",
    data: input.data,
  });

  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const requestMeta = ctx.requestMeta;
  await ctx.storage.put("submissions", {
    page_id: input.page_slug,
    type: input.type,
    data: JSON.stringify(validation.sanitized),
    ip_country: requestMeta?.cf?.country ?? "unknown",
    ip_city: requestMeta?.cf?.city ?? "unknown",
    variant_id: input.data.variant_id ?? null,
    created_at: new Date().toISOString(),
  });

  return { success: true };
}
```

Create `plugin/src/routes/page.ts`:

```typescript
import type { PluginContext } from "emdash";
import { resolveDisclaimer, type Disclaimer, type DisclaimerQuery } from "../modules/disclaimers.ts";
import { suggestAmounts, type GeoContext, type AmountConfig } from "../modules/geo-ask.ts";
import { assignVariant } from "../modules/ab-assign.ts";

export async function handlePage(input: { slug: string }, ctx: PluginContext) {
  const pages = await ctx.storage.query("action_pages", { slug: input.slug, status: "published" });
  const page = pages[0];
  if (!page) return { found: false };

  const geo: GeoContext = {
    country: ctx.requestMeta?.cf?.country ?? "US",
    region: ctx.requestMeta?.cf?.region ?? "",
  };

  const geoConfig: AmountConfig = page.geo_config ? JSON.parse(page.geo_config as string) : {
    base: [10, 25, 50, 100, 250],
    regions: {},
    fallback_multiplier: 1.0,
  };

  const amounts = suggestAmounts(geoConfig, geo);

  let variant: string | null = null;
  if (page.ab_config) {
    const abConfig = JSON.parse(page.ab_config as string);
    if (abConfig.enabled && abConfig.variants?.length > 0) {
      const visitorId = ctx.requestMeta?.cf?.ip ?? String(Date.now());
      variant = assignVariant(visitorId, abConfig.variants);
    }
  }

  const disclaimerData: Disclaimer[] = await ctx.kv.get("disclaimers_cache") ?? [];
  const disclaimer = resolveDisclaimer(disclaimerData, {
    committee_name: (await ctx.kv.get("committee_name")) ?? "",
    jurisdiction: geo.region || "FED",
    ad_type: "digital",
  });

  return {
    found: true,
    page,
    amounts,
    variant,
    disclaimer,
    geo,
  };
}
```

Create `plugin/src/routes/embed.ts`:

```typescript
export async function handleEmbed(input: { page_slug: string }) {
  const script = `
(function() {
  var el = document.currentScript;
  var page = el.getAttribute("data-page");
  var theme = el.getAttribute("data-theme") || "light";
  var host = el.src.replace("/plugin/embed.js", "");
  var container = document.createElement("div");
  container.attachShadow({ mode: "open" });
  var iframe = document.createElement("iframe");
  iframe.src = host + "/plugin/page/" + page + "?embed=1&theme=" + theme;
  iframe.style.cssText = "width:100%;border:none;min-height:400px;";
  iframe.setAttribute("title", "Action page");
  container.shadowRoot.appendChild(iframe);
  el.parentNode.insertBefore(container, el);
})();
`;
  return { body: script, contentType: "application/javascript" };
}
```

Create `plugin/src/routes/stats.ts`:

```typescript
import type { PluginContext } from "emdash";

export async function handleStats(input: { page_id: string }, ctx: PluginContext) {
  const variants = await ctx.storage.query("ab_variants", { page_id: input.page_id });
  return {
    variants: variants.map((v) => ({
      name: v.name,
      impressions: v.impressions,
      conversions: v.conversions,
      rate: Number(v.impressions) > 0 ? Number(v.conversions) / Number(v.impressions) : 0,
    })),
  };
}
```

- [ ] **Step 3: Create hook handlers**

Create `plugin/src/hooks/content-after-save.ts`:

```typescript
import type { PluginContext } from "emdash";

export async function handleContentAfterSave(event: { collection: string; entry: { id: string; data: Record<string, unknown> } }, ctx: PluginContext) {
  if (event.collection !== "action_pages") return;
  ctx.log.info(`Action page saved: ${event.entry.id}`);
}
```

Create `plugin/src/hooks/page-metadata.ts`:

```typescript
import type { PluginContext } from "emdash";

export async function handlePageMetadata(event: { path: string }, ctx: PluginContext) {
  if (!event.path.startsWith("/plugin/page/")) return {};
  const slug = event.path.replace("/plugin/page/", "").split("?")[0];
  const pages = await ctx.storage.query("action_pages", { slug });
  const page = pages[0];
  if (!page) return {};
  return {
    title: page.title as string,
    meta: [
      { property: "og:title", content: page.title as string },
      { property: "og:type", content: "website" },
    ],
  };
}
```

Create `plugin/src/hooks/cron.ts`:

```typescript
import type { PluginContext } from "emdash";

export async function handleCron(event: { name: string }, ctx: PluginContext) {
  if (event.name !== "aggregate-stats") return;
  ctx.log.info("A/B stats aggregation triggered");
}
```

- [ ] **Step 4: Create sandbox entry wiring everything together**

Create `plugin/src/sandbox-entry.ts`:

```typescript
import { definePlugin } from "emdash";
import { handleSubmit } from "./routes/submit.ts";
import { handlePage } from "./routes/page.ts";
import { handleEmbed } from "./routes/embed.ts";
import { handleStats } from "./routes/stats.ts";
import { handleContentAfterSave } from "./hooks/content-after-save.ts";
import { handlePageMetadata } from "./hooks/page-metadata.ts";
import { handleCron } from "./hooks/cron.ts";

export default definePlugin({
  hooks: {
    "content:afterSave": { handler: handleContentAfterSave },
    "page:metadata": { handler: handlePageMetadata },
    "cron": { handler: handleCron },
  },
  routes: {
    submit: { handler: handleSubmit, public: true },
    page: { handler: handlePage, public: true },
    embed: { handler: handleEmbed, public: true },
    stats: { handler: handleStats },
  },
});
```

- [ ] **Step 5: Run all plugin tests**

```bash
cd plugin && npx vitest run
```

Expected: PASS (all tests from tasks 5-8).

- [ ] **Step 6: Commit**

```bash
git add plugin/src/
git commit -m "wire plugin descriptor, sandbox entry, routes, and hooks"
```

---

## Task 10: Register Plugin in Astro Config

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Update astro.config.mjs to register the plugin**

Replace `astro.config.mjs`:

```javascript
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { actionPages } from "./plugin/src/index.ts";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),
  image: { layout: "constrained", responsiveStyles: true },
  integrations: [
    react(),
    emdash({
      database: d1({ binding: "DB", session: "auto" }),
      storage: r2({ binding: "MEDIA" }),
      plugins: [actionPages()],
    }),
  ],
  devToolbar: { enabled: false },
});
```

- [ ] **Step 2: Verify dev server starts with plugin**

```bash
npm run dev
```

Check terminal output — should see the plugin registered without errors. Visit `http://localhost:4321/_emdash/admin` and check for the plugin's admin pages.

- [ ] **Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "register action pages plugin in emdash config"
```

---

## Task 11: Remaining State Disclaimer Data

**Files:**
- Create: `data/disclaimers/states/va.json`, `md.json`, `ny.json`, `ca.json`, `tx.json`, `fl.json`, `pa.json`, `ga.json`, `co.json`

- [ ] **Step 1: Research and encode each state's disclaimer rules**

For each of the remaining 9 states, research the current disclaimer requirements from NCSL and the state's election commission website. Create a JSON file following the schema in `data/disclaimers/schema.json`.

This step requires manual research for each state. Create one file at a time, verify against the source, and include the `source_url` and `last_verified` date.

Example for Virginia (`data/disclaimers/states/va.json`):

```json
[
  {
    "jurisdiction": "VA",
    "type": "digital",
    "required_text": "Paid for by {committee_name}",
    "adapted_text": null,
    "statute_citation": "Va. Code 24.2-956",
    "ai_disclosure_required": false,
    "ai_disclosure_text": null,
    "effective_date": "2020-07-01",
    "last_verified": "2026-04-01",
    "source_url": "https://law.lis.virginia.gov/vacode/title24.2/chapter9.5/section24.2-956/"
  }
]
```

Repeat for MD, NY, CA, TX, FL, PA, GA, CO. Each requires individual research.

- [ ] **Step 2: Validate all data files against schema**

Write a quick validation script or use the test suite to validate every JSON file in `data/disclaimers/` against `schema.json`.

- [ ] **Step 3: Commit**

```bash
git add data/disclaimers/states/
git commit -m "add disclaimer data for VA, MD, NY, CA, TX, FL, PA, GA, CO"
```

---

## Task 12: Open-Source Hygiene

**Files:**
- Create: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `README.md`
- Create: `.github/ISSUE_TEMPLATE/bug.md`, `.github/ISSUE_TEMPLATE/feature.md`, `.github/pull_request_template.md`

- [ ] **Step 1: Create CONTRIBUTING.md**

Write a concise contributing guide covering: how to set up the dev environment, how to run tests, how to contribute disclaimer data (the community contribution path), commit message conventions, and the 1-week package update delay policy.

- [ ] **Step 2: Create CODE_OF_CONDUCT.md**

Use the Contributor Covenant v2.1.

- [ ] **Step 3: Create README.md**

Write a README that covers: what Crafted is (one paragraph), the portfolio site, the campaign action page plugin, the compliance dataset, how to install and run, how to embed the widget, and how to contribute. Written like a person. No badges wall. No emoji.

- [ ] **Step 4: Create issue and PR templates**

Create `.github/ISSUE_TEMPLATE/bug.md` and `.github/ISSUE_TEMPLATE/feature.md` with simple, focused templates. Create `.github/pull_request_template.md`.

- [ ] **Step 5: Commit**

```bash
git add CONTRIBUTING.md CODE_OF_CONDUCT.md README.md .github/
git commit -m "add open-source documentation and templates"
```

---

## Task 13: Flagship Project Detail (Layout C — React Islands)

**Files:**
- Create: `src/components/MetricsBanner.tsx`, `src/components/TabbedContent.tsx`, `src/components/ResizablePanel.tsx`
- Modify: `src/pages/work/[slug].astro`

- [ ] **Step 1: Create MetricsBanner React island**

Create `src/components/MetricsBanner.tsx`:

```tsx
interface Metric {
  value: string;
  label: string;
}

export default function MetricsBanner({ metrics }: { metrics: Metric[] }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      gap: "2rem",
      padding: "0.75rem 0",
      borderBottom: "1px solid var(--color-border)",
      marginBottom: "1.5rem",
    }}>
      {metrics.map((m) => (
        <div key={m.label} style={{ textAlign: "center" }}>
          <div style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text)",
            fontSize: "1.25rem",
            fontWeight: 700,
          }}>
            {m.value}
          </div>
          <div style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-secondary)",
            fontSize: "0.625rem",
            textTransform: "uppercase" as const,
            letterSpacing: "0.05em",
          }}>
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create TabbedContent React island**

Create `src/components/TabbedContent.tsx`:

```tsx
import { useState, type ReactNode } from "react";

interface Tab {
  label: string;
  content: ReactNode;
}

export default function TabbedContent({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div role="tablist" style={{ display: "flex", gap: 0, marginBottom: 0 }}>
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            style={{
              padding: "0.4rem 1rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              background: i === active ? "var(--color-code-bg)" : "transparent",
              color: i === active ? "var(--color-text)" : "var(--color-secondary)",
              border: "none",
              borderRadius: i === active ? "4px 4px 0 0" : "0",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        style={{
          background: "var(--color-code-bg)",
          borderRadius: "0 4px 4px 4px",
          padding: "1rem",
        }}
      >
        {tabs[active]?.content}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ResizablePanel React island**

Create `src/components/ResizablePanel.tsx`:

```tsx
import { useRef, useState, useCallback, useEffect } from "react";

interface Props {
  left: React.ReactNode;
  right: React.ReactNode;
  initialSplit?: number;
}

export default function ResizablePanel({ left, right, initialSplit = 0.5 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(initialSplit);
  const dragging = useRef(false);

  const onMouseDown = useCallback(() => {
    dragging.current = true;
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0.2, Math.min(0.8, x / rect.width));
    setSplit(ratio);
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        background: "var(--color-code-bg)",
        borderRadius: "4px",
        overflow: "hidden",
        minHeight: "200px",
        userSelect: dragging.current ? "none" : "auto",
      }}
    >
      <div style={{ width: `${split * 100}%`, padding: "1rem", overflow: "auto" }}>
        {left}
      </div>
      <div
        onMouseDown={onMouseDown}
        role="separator"
        aria-orientation="vertical"
        tabIndex={0}
        style={{
          width: "4px",
          background: "var(--color-border-strong)",
          cursor: "ew-resize",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, padding: "1rem", overflow: "auto" }}>
        {right}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update project detail page to support flagship mode**

Update `src/pages/work/[slug].astro` to conditionally render Layout C islands for flagship projects. Add after the `<PortableText>` block, before closing `</article>`:

```astro
---
// Add to frontmatter:
import MetricsBanner from "../../components/MetricsBanner.tsx";
import TabbedContent from "../../components/TabbedContent.tsx";
import ResizablePanel from "../../components/ResizablePanel.tsx";

const flagshipSlugs = ["molt", "crafted-action-pages"];
const isFlagship = flagshipSlugs.includes(slug!);
---

<!-- Add after PortableText, inside article -->
{isFlagship && (
  <>
    <MetricsBanner
      client:visible
      metrics={[
        { value: "60-90%", label: "Size reduction" },
        { value: "0.004ms", label: "Startup" },
        { value: "AOT", label: "Compilation" },
      ]}
    />
    <TabbedContent
      client:visible
      tabs={[
        { label: "Overview", content: "Project overview content here." },
        { label: "Architecture", content: "Architecture details here." },
        { label: "Demo", content: "Live demo here." },
      ]}
    />
  </>
)}
```

Note: The metrics and tab content will be populated from emdash content fields once real project data is entered. The hardcoded values here are placeholders for initial wiring — replace with dynamic content in the next iteration.

- [ ] **Step 5: Verify flagship islands render**

```bash
npm run dev
```

Create a project with slug "molt" in the admin. Visit `http://localhost:4321/work/molt` — should see metrics banner and tabbed content hydrate as React islands.

- [ ] **Step 6: Commit**

```bash
git add src/components/MetricsBanner.tsx src/components/TabbedContent.tsx src/components/ResizablePanel.tsx src/pages/work/\[slug\].astro
git commit -m "add flagship project detail React islands"
```

---

## Task 14: WCAG 2.1 AA Compliance Pass

**Files:**
- Modify: multiple component files as needed

- [ ] **Step 1: Audit all pages for accessibility**

Run through every page manually checking:
- All images have alt text (emdash's `<Image>` component handles this via the image object's `alt` field)
- All interactive elements are keyboard-accessible (tabs, resizable panel, navigation)
- Color contrast meets AA ratio (4.5:1 for normal text, 3:1 for large text): `#1a1a1a` on `#f5f5f0` is 14.5:1 (passes), `#888` on `#f5f5f0` is 3.5:1 (passes for large text, borderline for body — may need to darken to `#777`)
- Focus indicators are visible
- Semantic HTML throughout (`<nav>`, `<main>`, `<article>`, `<aside>`, `<header>`, `<footer>`)
- ARIA labels on landmark regions
- `lang="en"` on `<html>`
- Skip-to-content link

- [ ] **Step 2: Fix any issues found**

Address each issue in the relevant component file. Common fixes:
- Add `aria-label` to landmark regions that don't have visible headings
- Ensure focus styles are visible (outline, not just color change)
- Add keyboard handlers to the ResizablePanel (arrow keys to adjust split)
- Verify Turnstile widget is accessible

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "accessibility audit and WCAG 2.1 AA compliance fixes"
```

---

## Task 15: Seed Data and Content

**Files:**
- Modify: `seed/seed.json`

- [ ] **Step 1: Update seed data with real project content**

Replace the template's sample projects (Meridian, Volta, etc.) with real portfolio content. Update `seed/seed.json` to include:
- Molt project entry
- Crafted Action Pages project entry
- About page with real bio
- Updated site settings (title: "Crafted", tagline as appropriate)
- Updated taxonomies to reflect actual tech stack tags

- [ ] **Step 2: Re-seed the database**

```bash
npm run seed
```

- [ ] **Step 3: Verify content renders correctly**

```bash
npm run dev
```

Check all pages with real content.

- [ ] **Step 4: Commit**

```bash
git add seed/seed.json
git commit -m "replace template content with portfolio seed data"
```

---

## Task 16: E2E Tests

**Files:**
- Create: `e2e/tests/portfolio.spec.ts`, `e2e/tests/action-page.spec.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Create Playwright config**

Create `playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:4321",
  },
  webServer: {
    command: "npm run dev",
    port: 4321,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Write portfolio E2E tests**

Create `e2e/tests/portfolio.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("homepage renders newspaper layout", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Featured")).toBeVisible();
  await expect(page.getByText("Latest")).toBeVisible();
});

test("project detail page renders", async ({ page }) => {
  await page.goto("/");
  const firstLink = page.locator("article a").first();
  await firstLink.click();
  await expect(page.locator("article")).toBeVisible();
  await expect(page.locator("aside")).toBeVisible();
});

test("navigation works", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL("/about");
  await page.getByRole("link", { name: "Work" }).click();
  await expect(page).toHaveURL("/work");
});
```

- [ ] **Step 3: Write action page E2E tests**

Create `e2e/tests/action-page.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("embed script returns JavaScript", async ({ request }) => {
  const response = await request.get("/_emdash/api/plugins/crafted-action-pages/embed?page_slug=test");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("javascript");
});

test("stats endpoint returns JSON", async ({ request }) => {
  const response = await request.get("/_emdash/api/plugins/crafted-action-pages/stats?page_id=test");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty("variants");
});
```

- [ ] **Step 4: Run E2E tests**

```bash
npx playwright test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "add E2E tests for portfolio and action page plugin"
```

---

## Task 17: Cloudflare Deployment

**Files:**
- Modify: `wrangler.jsonc`

- [ ] **Step 1: Create production Cloudflare resources**

```bash
npx wrangler d1 create crafted
npx wrangler r2 bucket create crafted-media
```

Copy the real `database_id` from the D1 creation output.

- [ ] **Step 2: Update wrangler.jsonc with production IDs**

Replace the placeholder `database_id` with the real ID from step 1.

- [ ] **Step 3: Deploy**

```bash
npm run deploy
```

- [ ] **Step 4: Bootstrap production database**

```bash
npx wrangler d1 execute crafted --remote --command "SELECT 1"
```

Then run the emdash bootstrap against the remote D1:
```bash
EMDASH_REMOTE=1 npm run bootstrap
```

(Exact command may vary — check emdash docs for remote database initialization.)

- [ ] **Step 5: Verify production site**

Visit the deployed URL. Check:
- Homepage renders
- Project pages work
- Admin panel accessible
- Plugin routes respond

- [ ] **Step 6: Commit deployment config**

```bash
git add wrangler.jsonc
git commit -m "configure production Cloudflare deployment"
```

---

## Summary

| Task | What it builds | Tests |
|------|---------------|-------|
| 1 | Project scaffold | Manual verification |
| 2 | Visual design tokens | Manual verification |
| 3 | Newspaper homepage | Manual verification |
| 4 | Project detail (Layout B) | Manual verification |
| 5 | Disclaimer module | 4 unit tests |
| 6 | Geo-ask module | 4 unit tests |
| 7 | A/B assignment module | 4 unit tests |
| 8 | Form validation module | 6 unit tests |
| 9 | Plugin wiring | Builds on 5-8 tests |
| 10 | Plugin registration | Manual verification |
| 11 | State disclaimer data | Schema validation |
| 12 | Open-source docs | N/A |
| 13 | Flagship React islands | Manual verification |
| 14 | WCAG compliance | Manual audit |
| 15 | Real content | Manual verification |
| 16 | E2E tests | 5 E2E tests |
| 17 | Deployment | Production verification |
