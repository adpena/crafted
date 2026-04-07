import type { CSSProperties, ReactNode } from "react";
import { useIsMobile } from "../hooks/useIsMobile.ts";

export interface HeroSplitProps {
  headline: string;
  subhead?: string;
  body?: string;

  // Media side
  media_type?: "image" | "video";
  media_url: string;
  media_alt?: string;
  media_side?: "left" | "right";

  // Style
  background_color?: string;
  ratio?: "1/1" | "1/2" | "2/3";
}

const RATIO_MAP: Record<NonNullable<HeroSplitProps["ratio"]>, string> = {
  "1/1": "1fr 1fr",
  "1/2": "1fr 2fr",
  "2/3": "2fr 3fr",
};

export function HeroSplit({
  headline,
  subhead,
  body,
  media_type = "image",
  media_url,
  media_alt = "",
  media_side = "right",
  background_color,
  ratio = "1/1",
}: HeroSplitProps): ReactNode {
  const isMobile = useIsMobile();

  // On mobile: stacks vertically, media on top
  // On desktop: 2 columns, content/media order driven by media_side
  const desktopColumns = (() => {
    const split = RATIO_MAP[ratio];
    // ratio is content/media, so left column is content by default
    // If media is on left, swap the order of fr values
    if (media_side === "left") {
      const parts = split.split(" ");
      return `${parts[1]} ${parts[0]}`;
    }
    return split;
  })();

  const containerStyle: CSSProperties = isMobile
    ? {
        display: "grid",
        gridTemplateColumns: "1fr",
        gridTemplateRows: "auto auto",
        width: "100%",
        backgroundColor: background_color ?? "var(--page-bg, #f5f5f0)",
      }
    : {
        display: "grid",
        gridTemplateColumns: desktopColumns,
        width: "100%",
        minHeight: "60vh",
        backgroundColor: background_color ?? "var(--page-bg, #f5f5f0)",
      };

  const contentOrder = isMobile ? 2 : media_side === "left" ? 2 : 1;
  const mediaOrder = isMobile ? 1 : media_side === "left" ? 1 : 2;

  const mediaHeight = isMobile ? "40vh" : "auto";

  const mediaSection: ReactNode = (
    <div
      key="media"
      style={{
        order: mediaOrder,
        position: "relative",
        width: "100%",
        height: mediaHeight,
        minHeight: isMobile ? "40vh" : "60vh",
        overflow: "hidden",
      }}
    >
      {media_type === "video" ? (
        <video
          src={media_url}
          autoPlay
          muted
          loop
          playsInline
          aria-label={media_alt || "Hero video"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <img
          src={media_url}
          alt={media_alt}
          loading="eager"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
    </div>
  );

  const contentSection: ReactNode = (
    <div
      key="content"
      style={{
        order: contentOrder,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: isMobile ? "2rem 1.5rem" : "3rem 2.5rem",
        maxWidth: "42em",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--page-font-serif, Georgia, serif)",
          color: "var(--page-text, #1a1a1a)",
          fontSize: "clamp(1.75rem, 4.5vw, 3rem)",
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: "-0.015em",
          margin: 0,
        }}
      >
        {headline}
      </h1>

      {subhead && (
        <p
          style={{
            fontFamily: "var(--page-font-serif, Georgia, serif)",
            color: "var(--page-secondary, #555)",
            fontSize: "clamp(1.05rem, 2.2vw, 1.3rem)",
            lineHeight: 1.5,
            marginTop: "0.75rem",
            marginBottom: 0,
            fontWeight: 400,
          }}
        >
          {subhead}
        </p>
      )}

      {body && (
        <div
          style={{
            marginTop: "1.5rem",
            color: "var(--page-secondary, #555)",
            fontSize: "1.05rem",
            lineHeight: 1.7,
          }}
        >
          {body.split(/\n{2,}/).map((p, i) => (
            <p
              key={i}
              style={{
                margin: 0,
                marginTop: i > 0 ? "1.1em" : 0,
              }}
            >
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );

  return <div style={containerStyle}>{[mediaSection, contentSection]}</div>;
}
