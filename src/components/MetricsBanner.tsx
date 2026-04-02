import { useEffect, useRef } from "react";

interface Metric {
  value: string;
  label: string;
}

interface MetricsBannerProps {
  metrics: Metric[];
}

export default function MetricsBanner({ metrics }: MetricsBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current || !containerRef.current) return;
    hasAnimated.current = true;

    const valueEls = containerRef.current.querySelectorAll<HTMLElement>(
      "[data-metric-value]",
    );

    valueEls.forEach((el, i) => {
      const finalText = el.getAttribute("data-metric-value") || "";
      const numericMatch = finalText.match(/^([\d,.]+)/);

      if (numericMatch) {
        const numStr = numericMatch[1];
        const suffix = finalText.slice(numStr.length);
        const target = parseFloat(numStr.replace(/,/g, ""));
        const hasDecimal = numStr.includes(".");
        const decimalPlaces = hasDecimal ? numStr.split(".")[1].length : 0;
        const hasCommas = numStr.includes(",");
        const duration = 800;
        const startTime = performance.now();
        const delay = i * 120;

        el.textContent = hasDecimal ? `0.${"0".repeat(decimalPlaces)}${suffix}` : `0${suffix}`;

        // Fade in
        el.animate(
          [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 400, delay, fill: "forwards", easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );

        setTimeout(() => {
          function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;

            let display: string;
            if (hasDecimal) {
              display = current.toFixed(decimalPlaces);
            } else {
              const rounded = Math.round(current);
              display = hasCommas
                ? rounded.toLocaleString("en-US")
                : String(rounded);
            }

            el.textContent = `${display}${suffix}`;

            if (progress < 1) {
              requestAnimationFrame(tick);
            } else {
              el.textContent = finalText;
            }
          }
          requestAnimationFrame(tick);
        }, delay);
      } else {
        // Non-numeric: just fade in
        el.animate(
          [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 500, delay: i * 120, fill: "forwards", easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      }
    });
  }, []);

  return (
    <div ref={containerRef} className="metrics-banner" role="region" aria-label="Project metrics">
      {metrics.map((metric, i) => (
        <div key={i} className="metrics-banner__item">
          <span className="metrics-banner__value" data-metric-value={metric.value}>
            {metric.value}
          </span>
          <span className="metrics-banner__label">{metric.label}</span>
        </div>
      ))}

      <style>{`
        .metrics-banner {
          display: flex;
          align-items: baseline;
          gap: 0;
          padding: 1.25rem 0;
          border-top: 1px solid var(--color-border);
          border-bottom: 1px solid var(--color-border);
          margin-bottom: var(--spacing-2xl);
        }

        .metrics-banner__item {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
          padding: 0 1.5rem;
        }

        .metrics-banner__item:not(:last-child) {
          border-right: 1px solid var(--color-border);
        }

        .metrics-banner__item:first-child {
          padding-left: 0;
        }

        .metrics-banner__item:last-child {
          padding-right: 0;
        }

        .metrics-banner__value {
          font-family: var(--font-mono);
          font-size: var(--font-size-xl);
          font-weight: 400;
          color: var(--color-text);
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .metrics-banner__label {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--color-secondary);
          line-height: 1;
        }

        @media (max-width: 640px) {
          .metrics-banner {
            flex-wrap: wrap;
            gap: 1rem 0;
          }

          .metrics-banner__item {
            flex: 0 0 50%;
            padding: 0;
            padding-right: 1rem;
          }

          .metrics-banner__item:not(:last-child) {
            border-right: none;
          }
        }
      `}</style>
    </div>
  );
}
