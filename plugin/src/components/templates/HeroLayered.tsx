import { useState, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";

export interface HeroLayeredProps {
  // Background
  background_type?: "color" | "gradient" | "image" | "video";
  background_color?: string;
  background_gradient?: string;
  background_image?: string;
  background_video?: string;
  background_position?: string;

  // Splash
  splash_image?: string;
  splash_alt?: string;
  splash_position?: "left" | "center" | "right";
  splash_align?: "top" | "middle" | "bottom";
  splash_size?: "small" | "medium" | "large" | "full";

  // Overlay
  overlay?: "none" | "subtle" | "dark" | "gradient-bottom" | "gradient-top";
  overlay_opacity?: number;

  // Content
  headline: string;
  subhead?: string;
  content_position?:
    | "top-left"
    | "top-center"
    | "bottom-left"
    | "bottom-center"
    | "center";
  content_color?: string;

  // Sizing
  height?: string;
}

function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setMobile(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return mobile;
}

const SPLASH_SIZE_MAP: Record<NonNullable<HeroLayeredProps["splash_size"]>, string> = {
  small: "200px",
  medium: "400px",
  large: "600px",
  full: "100%",
};

function getSplashMaxWidth(
  size: NonNullable<HeroLayeredProps["splash_size"]>,
  isMobile: boolean,
): string {
  if (size === "full") return "100%";
  const base = SPLASH_SIZE_MAP[size];
  if (!isMobile) return base;
  // Reduce by ~50% on mobile
  const px = parseInt(base, 10);
  return `${Math.round(px / 2)}px`;
}

function getContentAlignment(
  position: NonNullable<HeroLayeredProps["content_position"]>,
): {
  justifyContent: CSSProperties["justifyContent"];
  alignItems: CSSProperties["alignItems"];
  textAlign: CSSProperties["textAlign"];
} {
  switch (position) {
    case "top-left":
      return { justifyContent: "flex-start", alignItems: "flex-start", textAlign: "left" };
    case "top-center":
      return { justifyContent: "flex-start", alignItems: "center", textAlign: "center" };
    case "bottom-left":
      return { justifyContent: "flex-end", alignItems: "flex-start", textAlign: "left" };
    case "bottom-center":
      return { justifyContent: "flex-end", alignItems: "center", textAlign: "center" };
    case "center":
    default:
      return { justifyContent: "center", alignItems: "center", textAlign: "center" };
  }
}

function getOverlayStyle(
  overlay: NonNullable<HeroLayeredProps["overlay"]>,
  opacity?: number,
): CSSProperties | null {
  if (overlay === "none") return null;
  switch (overlay) {
    case "subtle":
      return { backgroundColor: `rgba(0, 0, 0, ${opacity ?? 0.2})` };
    case "dark":
      return { backgroundColor: `rgba(0, 0, 0, ${opacity ?? 0.6})` };
    case "gradient-bottom":
      return {
        background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,${opacity ?? 0.75}) 100%)`,
      };
    case "gradient-top":
      return {
        background: `linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,${opacity ?? 0.75}) 100%)`,
      };
    default:
      return null;
  }
}

export function HeroLayered({
  background_type = "color",
  background_color,
  background_gradient,
  background_image,
  background_video,
  background_position = "center center",
  splash_image,
  splash_alt = "",
  splash_position = "center",
  splash_align = "middle",
  splash_size = "medium",
  overlay = "none",
  overlay_opacity,
  headline,
  subhead,
  content_position = "center",
  content_color,
  height,
}: HeroLayeredProps): ReactNode {
  const isMobile = useIsMobile();
  const resolvedHeight = height ?? (isMobile ? "50vh" : "70vh");

  // Default text color: white over busy backgrounds (image/video/gradient), theme over color
  const usesMediaBg =
    background_type === "image" ||
    background_type === "video" ||
    background_type === "gradient";
  const defaultTextColor = usesMediaBg ? "#fff" : "var(--page-text, #1a1a1a)";
  const defaultSecondaryColor = usesMediaBg
    ? "rgba(255,255,255,0.9)"
    : "var(--page-secondary, #555)";
  const textColor = content_color ?? defaultTextColor;
  const secondaryColor = content_color ?? defaultSecondaryColor;
  const textShadow = usesMediaBg ? "0 2px 12px rgba(0,0,0,0.5)" : "none";
  const subheadShadow = usesMediaBg ? "0 1px 8px rgba(0,0,0,0.4)" : "none";

  // Background container style
  const bgContainerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  };

  if (background_type === "color" && background_color) {
    bgContainerStyle.backgroundColor = background_color;
  } else if (background_type === "gradient" && background_gradient) {
    bgContainerStyle.background = background_gradient;
  } else if (background_type === "image" && background_image) {
    bgContainerStyle.backgroundImage = `url(${background_image})`;
    bgContainerStyle.backgroundSize = "cover";
    bgContainerStyle.backgroundPosition = background_position;
    bgContainerStyle.backgroundRepeat = "no-repeat";
  } else if (background_type === "color" && !background_color) {
    bgContainerStyle.backgroundColor = "var(--page-bg, #f5f5f0)";
  }

  // Splash absolute positioning
  const splashWrapperStyle: CSSProperties = (() => {
    const effectivePosition = isMobile ? "center" : splash_position;
    const effectiveAlign = isMobile ? "middle" : splash_align;

    const style: CSSProperties = {
      position: "absolute",
      display: "flex",
      pointerEvents: "none",
    };

    // Horizontal
    if (effectivePosition === "left") {
      style.left = "5%";
      style.right = "auto";
    } else if (effectivePosition === "right") {
      style.right = "5%";
      style.left = "auto";
    } else {
      style.left = "50%";
      style.transform = "translateX(-50%)";
    }

    // Vertical
    if (effectiveAlign === "top") {
      style.top = "5%";
      style.bottom = "auto";
    } else if (effectiveAlign === "bottom") {
      style.bottom = "5%";
      style.top = "auto";
    } else {
      style.top = "50%";
      style.bottom = "auto";
      style.transform = `${style.transform ?? ""} translateY(-50%)`.trim();
    }

    return style;
  })();

  const splashMaxWidth = getSplashMaxWidth(splash_size, isMobile);
  const overlayStyle = getOverlayStyle(overlay, overlay_opacity);
  const contentAlign = getContentAlignment(content_position);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: resolvedHeight,
        maxHeight: "900px",
        overflow: "hidden",
      }}
    >
      {/* Background layer */}
      {background_type === "video" && background_video ? (
        <video
          src={background_video}
          autoPlay
          muted
          loop
          playsInline
          aria-label="Background video"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div style={bgContainerStyle} />
      )}

      {/* Splash layer */}
      {splash_image && (
        <div style={splashWrapperStyle}>
          <img
            src={splash_image}
            alt={splash_alt}
            style={{
              maxWidth: splashMaxWidth,
              width: splash_size === "full" ? "100%" : "auto",
              height: "auto",
              display: "block",
            }}
          />
        </div>
      )}

      {/* Overlay layer */}
      {overlayStyle && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            ...overlayStyle,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Content layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: contentAlign.justifyContent,
          alignItems: contentAlign.alignItems,
          padding: "2.5rem 1.5rem",
          textAlign: contentAlign.textAlign,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--page-font-serif, Georgia, serif)",
            color: textColor,
            fontSize: "clamp(1.75rem, 5vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            margin: 0,
            maxWidth: "20em",
            textShadow,
          }}
        >
          {headline}
        </h1>

        {subhead && (
          <p
            style={{
              color: secondaryColor,
              fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
              lineHeight: 1.5,
              marginTop: "0.75rem",
              marginBottom: 0,
              maxWidth: "32em",
              fontWeight: 400,
              textShadow: subheadShadow,
            }}
          >
            {subhead}
          </p>
        )}
      </div>
    </div>
  );
}
