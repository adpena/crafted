import { afterEach, describe, expect, it, vi } from 'vitest';
import { hash, verifyLive, verifyArtifacts } from '../scripts/portfolio-release.mjs';
import { parseWorkFilter, workFilterHref, isPublicPortfolioSlug } from '../src/lib/portfolio-content';

afterEach(() => vi.unstubAllGlobals());
function fakeSite(change?: (path: string) => Response | undefined) {
  vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
    const path = url.pathname;
    const override = change?.(path);
    if (override) return override;
    if (path.includes('working-but-uncovered')) return new Response('Not found', { status: 404 });
    if (path.endsWith('.pdf')) return new Response('%PDF-1.7');
    return new Response('Selected work CharterCostTracker full-stack engineer');
  }));
}
describe('release guards', () => {
  it('rejects an otherwise valid deployed artifact from an older release', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('old artifact')));
    await expect(verifyArtifacts({ 'public/resumes/resume.pdf': hash('new artifact') }, 'http://localhost')).rejects.toThrow('does not match');
    expect(await verifyArtifacts({ 'public/resumes/resume.pdf': hash('old artifact') }, 'http://localhost')).toEqual(['/resumes/resume.pdf']);
  });
  it('detects content changes independently of object key order', () => {
    expect(hash({ a: 1, b: { c: 2 } })).toBe(hash({ b: { c: 2 }, a: 1 }));
    expect(hash({ a: 1, draft: 'old' })).not.toBe(hash({ a: 1, draft: 'new' }));
  });
  it('requires the live portfolio, resumes, and absent WIP routes', async () => {
    fakeSite(); expect(await verifyLive('http://localhost')).toHaveLength(13);
  });
  it('rejects an error page served as a PDF with HTTP 200', async () => {
    fakeSite((p) => p.endsWith('.pdf') ? new Response('<html>Error</html>') : undefined);
    await expect(verifyLive('http://localhost')).rejects.toThrow('not a PDF');
  });
  it('rejects missing About content and stale homepages', async () => {
    fakeSite((p) => p === '/about' ? new Response('Unavailable') : undefined);
    await expect(verifyLive('http://localhost')).rejects.toThrow('About content');
    fakeSite((p) => p === '/' ? new Response('Old homepage') : undefined);
    await expect(verifyLive('http://localhost')).rejects.toThrow('stale or incomplete');
  });
  it('rejects accidentally published or linked WIP', async () => {
    fakeSite((p) => p.includes('working-but-uncovered') ? new Response('Draft') : undefined);
    await expect(verifyLive('http://localhost')).rejects.toThrow('expected 404');
    fakeSite((p) => p === '/' ? new Response('Selected work CharterCostTracker /work/dev/working-but-uncovered') : undefined);
    await expect(verifyLive('http://localhost')).rejects.toThrow('excluded project exposed');
  });
});
describe('shareable work selection', () => {
  it('uses the requested audience and resets unknown values to all work', () => {
    expect(parseWorkFilter('research')).toBe('research');
    expect(parseWorkFilter('software')).toBe('software');
    expect(parseWorkFilter('invalid')).toBe('all');
    expect(workFilterHref('research')).toBe('/?focus=research#work');
    expect(workFilterHref('all')).toBe('/#work');
  });
  it('keeps unpublished work excluded independently of CMS status', () => {
    expect(isPublicPortfolioSlug('working-but-uncovered')).toBe(false);
    expect(isPublicPortfolioSlug('tx-working-but-uncovered')).toBe(false);
    expect(isPublicPortfolioSlug('molt')).toBe(true);
  });
});
