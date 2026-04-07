import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { templates } from "../src/components/templates/index.js";
import { HeroLayered } from "../src/components/templates/HeroLayered.js";
import { HeroSplit } from "../src/components/templates/HeroSplit.js";

describe("template registry", () => {
  it("registers all 5 hero templates", () => {
    const keys = templates.keys();
    expect(keys).toContain("hero-simple");
    expect(keys).toContain("hero-media");
    expect(keys).toContain("hero-story");
    expect(keys).toContain("hero-layered");
    expect(keys).toContain("hero-split");
    expect(keys.length).toBeGreaterThanOrEqual(5);
  });

  it("retrieves the new templates as functions", () => {
    expect(typeof templates.get("hero-layered")).toBe("function");
    expect(typeof templates.get("hero-split")).toBe("function");
  });
});

describe("HeroLayered", () => {
  it("renders with a color background", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "Hello",
        background_type: "color",
        background_color: "#abcdef",
      }),
    );
    expect(html).toContain("Hello");
    expect(html).toContain("#abcdef");
  });

  it("renders with a gradient background", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "Gradient hero",
        background_type: "gradient",
        background_gradient: "linear-gradient(45deg, red, blue)",
      }),
    );
    expect(html).toContain("Gradient hero");
    expect(html).toContain("linear-gradient");
  });

  it("renders with an image background", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "Image hero",
        background_type: "image",
        background_image: "https://example.com/bg.jpg",
      }),
    );
    expect(html).toContain("Image hero");
    expect(html).toContain("https://example.com/bg.jpg");
  });

  it("renders with a video background", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "Video hero",
        background_type: "video",
        background_video: "https://example.com/bg.mp4",
      }),
    );
    expect(html).toContain("Video hero");
    expect(html).toContain("<video");
    expect(html).toContain("https://example.com/bg.mp4");
    expect(html).toContain("aria-label");
  });

  it("renders splash image when provided", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "With splash",
        background_type: "color",
        background_color: "#000",
        splash_image: "https://example.com/splash.png",
        splash_alt: "Candidate portrait",
        splash_position: "right",
        splash_align: "bottom",
        splash_size: "large",
      }),
    );
    expect(html).toContain("https://example.com/splash.png");
    expect(html).toContain('alt="Candidate portrait"');
  });

  it("renders an overlay when not 'none'", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "Overlay test",
        background_type: "image",
        background_image: "https://example.com/bg.jpg",
        overlay: "dark",
        overlay_opacity: 0.7,
      }),
    );
    expect(html).toContain("rgba(0, 0, 0, 0.7)");
  });

  it("renders gradient overlay variants", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "Grad overlay",
        background_type: "image",
        background_image: "https://example.com/bg.jpg",
        overlay: "gradient-bottom",
      }),
    );
    expect(html).toContain("linear-gradient");
  });

  it("handles missing optional layers gracefully (no splash, no overlay)", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "Bare hero",
      }),
    );
    expect(html).toContain("Bare hero");
    // No splash image
    expect(html).not.toContain("<img");
    // No video
    expect(html).not.toContain("<video");
  });

  it("renders subhead when provided", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "Title",
        subhead: "Subtitle here",
      }),
    );
    expect(html).toContain("Subtitle here");
  });

  it("respects content_color override", () => {
    const html = renderToStaticMarkup(
      createElement(HeroLayered, {
        headline: "Custom color",
        content_color: "#ff00ff",
      }),
    );
    expect(html).toContain("#ff00ff");
  });
});

describe("HeroSplit", () => {
  it("renders with media on the right by default", () => {
    const html = renderToStaticMarkup(
      createElement(HeroSplit, {
        headline: "Split right",
        media_url: "https://example.com/img.jpg",
      }),
    );
    expect(html).toContain("Split right");
    expect(html).toContain("https://example.com/img.jpg");
    // Default media_side is right -> grid columns 1fr 1fr (ratio 1/1)
    expect(html).toContain("1fr 1fr");
  });

  it("renders with media on the left", () => {
    const html = renderToStaticMarkup(
      createElement(HeroSplit, {
        headline: "Split left",
        media_url: "https://example.com/img.jpg",
        media_side: "left",
      }),
    );
    expect(html).toContain("Split left");
    // media on the left should set order:1 on the media block
    expect(html).toMatch(/order:\s*1/);
  });

  it("renders a video media type", () => {
    const html = renderToStaticMarkup(
      createElement(HeroSplit, {
        headline: "Split video",
        media_url: "https://example.com/clip.mp4",
        media_type: "video",
        media_alt: "campaign clip",
      }),
    );
    expect(html).toContain("<video");
    expect(html).toContain("https://example.com/clip.mp4");
    expect(html).toContain('aria-label="campaign clip"');
  });

  it("renders subhead and body when provided", () => {
    const html = renderToStaticMarkup(
      createElement(HeroSplit, {
        headline: "Headline",
        subhead: "A subhead",
        body: "Paragraph one.\n\nParagraph two.",
        media_url: "https://example.com/img.jpg",
      }),
    );
    expect(html).toContain("A subhead");
    expect(html).toContain("Paragraph one.");
    expect(html).toContain("Paragraph two.");
  });

  it("respects ratio prop", () => {
    const html = renderToStaticMarkup(
      createElement(HeroSplit, {
        headline: "Ratio",
        media_url: "https://example.com/img.jpg",
        ratio: "1/2",
      }),
    );
    expect(html).toContain("1fr 2fr");
  });

  it("uses background_color when provided", () => {
    const html = renderToStaticMarkup(
      createElement(HeroSplit, {
        headline: "Bg",
        media_url: "https://example.com/img.jpg",
        background_color: "#123456",
      }),
    );
    expect(html).toContain("#123456");
  });
});
