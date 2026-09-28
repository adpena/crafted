# Crafted

> Alejandro Peña’s software and research portfolio. The included Action Pages experiment is unfinished.

A personal portfolio and campaign action page engine, built on [emdash](https://github.com/emdash-cms/emdash) CMS and deployed to Cloudflare.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/adpena/crafted)

Publishing, backups, and recovery: [docs/deploy.md](docs/deploy.md).

## What this is

**The portfolio** is a newspaper-style editorial site running on Astro 6 + Cloudflare Workers. Content is managed through emdash's admin UI and MCP server.

**The plugin** is an unfinished emdash experiment for campaign action pages. Its public samples do not send submissions. The source includes FEC and state disclaimer auto-generation, geo-personalized donation asks, ActBlue deep-linking, A/B testing at the edge, and Turnstile bot protection. Action pages are embeddable anywhere via a single `<script>` tag.

**The compliance dataset** is an open-source collection of political advertising disclaimer rules for FEC federal regulations and 10 US states. JSON format, versioned, community-contributable.

## Quick start

```
git clone https://github.com/adpena/crafted.git
cd crafted
nvm use
npm ci
npm rebuild better-sqlite3 --ignore-scripts=false
npm run preview:seed
PORTFOLIO_TEST_STATE=.portfolio-release/test-state npm run dev
```

Visit `http://localhost:4321` for the site, `http://localhost:4321/_emdash/admin` for the CMS.

## Embed an action page

```html
<script src="https://your-site.com/plugin/embed.js"
        data-page="donate-now"
        data-theme="light">
</script>
```

Works in WordPress, Django templates, Laravel Blade, or any HTML page.

## Structure

```
site (src/)        Astro portfolio — pages, components, layouts
plugin (plugin/)   emdash plugin — action pages, forms, disclaimers
data (data/)       compliance dataset — FEC + state disclaimer rules
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
