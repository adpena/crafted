import { describe, it, expect, vi } from 'vitest';
import type { RouteContext } from 'emdash';
import { createPlugin } from '../src/sandbox-entry';

describe('EmDash 1 native registration', () => {
  it('passes the native request context to handlers that read storage', async () => {
    const query = vi.fn().mockResolvedValue({ items: [] });
    const plugin = createPlugin();
    expect(plugin.capabilities).toContain('content:read');
    const context = { request: new Request('https://example.com/?slug=missing'), input: {},
      storage: { action_pages: { query } } } as unknown as RouteContext;
    const response = await plugin.routes.page.handler(context);
    expect(query).toHaveBeenCalledWith({ where: { slug: 'missing' } });
    expect(response).toMatchObject({ __emdashPluginResponse: true, status: 404 });
    expect(plugin.routes.stats.public).not.toBe(true);
  });

  it('redirects scripts to site assets and preserves validation status codes', async () => {
    const plugin = createPlugin();
    const context = { request: new Request('https://example.com/?slug=demo'), input: {} } as RouteContext;
    const script = await plugin.routes.embed.handler(context);
    expect(plugin.routes.embed.response).toBe('raw');
    expect(script).toMatchObject({ __emdashPluginResponse: true, status: 302,
      headers: [['location', '/api/action/embed.js?slug=demo']] });
    context.request = new Request('https://example.com/');
    expect(await plugin.routes.page.handler(context)).toMatchObject({ status: 400 });
  });
});
