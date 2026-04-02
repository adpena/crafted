# Crafted

> Early alpha. Expect rough edges.

A personal portfolio and campaign action page engine, built on [emdash](https://github.com/emdash-cms/emdash) CMS and deployed to Cloudflare.

## What this is

**The portfolio** is a newspaper-style editorial site running on Astro 6 + Cloudflare Workers. Content is managed through emdash's admin UI and MCP server.

**The plugin** is an emdash plugin that creates rapid-deploy campaign action pages. It handles FEC and state disclaimer auto-generation, geo-personalized donation asks, ActBlue deep-linking, A/B testing at the edge, and Turnstile bot protection. Action pages are embeddable anywhere via a single `<script>` tag.

**The compliance dataset** is an open-source collection of political advertising disclaimer rules for FEC federal regulations and 10 US states. JSON format, versioned, community-contributable.

## Quick start

```
git clone https://github.com/adpena/crafted.git
cd crafted
npm install
npm run bootstrap
npm run dev
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
