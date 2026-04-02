# Contributing to Crafted

## Setup

```
git clone https://github.com/adpena/crafted.git
cd crafted
npm install
npm run bootstrap
npm run dev
```

## Tests

```
npm test              # unit tests (vitest)
npm run test:e2e      # end-to-end (playwright)
```

## Contributing disclaimer data

The compliance dataset lives in `data/disclaimers/`. Each state has its own JSON file in `data/disclaimers/states/`.

To add a new state:

1. Create `data/disclaimers/states/XX.json` following the schema in `data/disclaimers/schema.json`
2. Every entry must include `last_verified` (the date you checked the statute) and `source_url` (link to the actual statute or regulation)
3. Verify against the state's election commission website and NCSL
4. Submit a PR

We do not accept disclaimer data without a verifiable source.

## Code style

- Strict TypeScript, no `any`
- Pure modules stay pure: no side effects, no external dependencies
- Zero external dependencies in the plugin
- Keep files focused and small

## Commits

Imperative tense, concise. "add disclaimer data for Virginia" not "added VA data."

## Package updates

We maintain a 1-week delay on package updates. Do not auto-update to the latest version of any dependency. Let the ecosystem surface bugs first.
