import { useState, useEffect } from "react";
import type { ReactNode } from "react";

export interface HeroMediaProps {
  headline: string;
  subhead?: string;
  media_url: string;
  media_type?: "image" | "video";
  overlay_opacity?: number;
}

function useIsMobile(breakpoint = 640): boolean {
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

export function HeroMedia({
  headline,
  subhead,
  media_url,
  media_type = "image",
  overlay_opacity = 0.4,
}: HeroMediaProps): ReactNode {
  const isMobile = useIsMobile();
  const height = isMobile ? "40vh" : "60vh";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        maxHeight: "720px",
        overflow: "hidden",
      }}
    >
      {/* Media */}
      {media_type === "video" ? (
        <video
          src={media_url}
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <img
          src={media_url}
          alt=""
          loading="eager"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(0, 0, 0, ${overlay_opacity})`,
        }}
      />

      {/* Text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1.5rem",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--page-font-serif, Georgia, serif)",
            color: "#fff",
            fontSize: "clamp(1.75rem, 5vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            margin: 0,
            maxWidth: "20em",
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          {headline}
        </h1>

        {subhead && (
          <p
            style={{
              color: "rgba(255, 255, 255, 0.9)",
              fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
              lineHeight: 1.5,
              marginTop: "0.75rem",
              marginBottom: 0,
              maxWidth: "32em",
              fontWeight: 400,
              textShadow: "0 1px 8px rgba(0,0,0,0.4)",
            }}
          >
            {subhead}
          </p>
        )}
      </div>
    </div>
  );
}
