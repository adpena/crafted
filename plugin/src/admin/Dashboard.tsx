import { useEffect, useState, useMemo } from "react";

/**
 * Campaign ROI Dashboard — interactive admin panel.
 *
 * Pure SVG charts (zero external deps). Fetches from /api/admin/dashboard.
 * Apple-quality minimal aesthetic: Georgia serif for numbers, mono for labels.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DayBucket {
  date: string;
  submissions: number;
  raised: number;
}

interface PageStat {
  slug: string;
  title: string;
  submissions: number;
  raised: number;
  conversion: number;
}

interface SourceStat {
  submissions: number;
  raised: number;
  cost_per_action: number | null;
}

interface DashboardPayload {
  period: string;
  summary: {
    total_submissions: number;
    total_pages: number;
    total_donors: number;
    total_raised: number;
    conversion_rate: number;
    top_page: { slug: string; submissions: number } | null;
  };
  by_day: DayBucket[];
  by_action_type: Record<string, number>;
  by_page: PageStat[];
  attribution: Record<string, SourceStat>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("action_pages_admin_token") ?? "";
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtDollar(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ACTION_LABELS: Record<string, string> = {
  petition_sign: "Petition signatures",
  letter_sent: "Letters sent",
  donation_click: "Donation clicks",
  event_rsvp: "Event RSVPs",
  gotv_pledge: "GOTV pledges",
  signup: "Signups",
  call_made: "Calls made",
  step_form: "Multi-step forms",
};

const SOURCE_COLORS: Record<string, string> = {
  facebook: "#4267B2",
  email: "#2D9CDB",
  organic: "#27AE60",
  google: "#EA4335",
  twitter: "#1DA1F2",
  direct: "#6B7280",
};

/* ------------------------------------------------------------------ */
/*  SVG Chart primitives                                               */
/* ------------------------------------------------------------------ */

function scalePoints(
  points: { x: number; y: number }[],
  w: number,
  h: number,
  pad: number,
): string {
  if (points.length === 0) return "";
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys) || 1;

  return points
    .map((p) => {
      const sx = pad + ((p.x - minX) / (maxX - minX || 1)) * (w - 2 * pad);
      const sy = h - pad - (p.y / maxY) * (h - 2 * pad);
      return `${sx},${sy}`;
    })
    .join(" ");
}

function LineChart({
  data,
  width = 600,
  height = 200,
  color = "#1a1a1a",
  areaColor,
  label,
  formatY = fmt,
}: {
  data: { x: number; y: number; label?: string }[];
  width?: number;
  height?: number;
  color?: string;
  areaColor?: string;
  label?: string;
  formatY?: (n: number) => string;
}) {
  const pad = 32;
  if (data.length === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#9ca3af" fontSize="13" fontFamily="monospace">
          No data
        </text>
      </svg>
    );
  }

  const pts = scalePoints(data, width, height, pad);
  const maxY = Math.max(...data.map((d) => d.y)) || 1;

  // Grid lines (4 horizontal)
  const gridLines = [0.25, 0.5, 0.75, 1].map((frac) => {
    const y = height - pad - frac * (height - 2 * pad);
    const val = Math.round(maxY * frac);
    return { y, val };
  });

  // Area fill path
  const firstPt = pts.split(" ")[0];
  const lastPt = pts.split(" ").slice(-1)[0];
  const areaPath = firstPt
    ? `M ${firstPt} ${pts.split(" ").slice(1).map((p) => `L ${p}`).join(" ")} L ${lastPt.split(",")[0]},${height - pad} L ${firstPt.split(",")[0]},${height - pad} Z`
    : "";

  // X-axis labels (every ~5th point)
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div>
      {label && (
        <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", fontFamily: "monospace", marginBottom: "0.5rem" }}>
          {label}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={areaColor || color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={areaColor || color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {gridLines.map((g) => (
          <g key={g.val}>
            <line x1={pad} y1={g.y} x2={width - pad} y2={g.y} stroke="#e5e7eb" strokeWidth="0.5" />
            <text x={pad - 6} y={g.y + 4} textAnchor="end" fill="#9ca3af" fontSize="10" fontFamily="monospace">
              {formatY(g.val)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        {areaPath && (
          <path d={areaPath} fill={`url(#grad-${color.replace("#", "")})`} />
        )}

        {/* Line */}
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots at data points */}
        {pts.split(" ").map((pt, i) => {
          const [cx, cy] = pt.split(",").map(Number);
          return (
            <circle key={i} cx={cx} cy={cy} r="2.5" fill={color} />
          );
        })}

        {/* X-axis labels */}
        {xLabels.map((d, i) => {
          const idx = data.indexOf(d);
          const pt = pts.split(" ")[idx];
          if (!pt) return null;
          const x = Number(pt.split(",")[0]);
          return (
            <text key={i} x={x} y={height - 8} textAnchor="middle" fill="#9ca3af" fontSize="10" fontFamily="monospace">
              {d.label || ""}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function HBarChart({
  data,
  color = "#1a1a1a",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((d) => d.value)) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {data.map((d) => {
        const pct = (d.value / maxVal) * 100;
        return (
          <div key={d.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
              <span style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "#374151" }}>{d.label}</span>
              <span style={{ fontSize: "0.875rem", fontFamily: "Georgia, serif", fontWeight: 600, color: "#1f2937" }}>
                {fmt(d.value)}
              </span>
            </div>
            <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: color,
                  borderRadius: 3,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({
  segments,
  size = 180,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={60} fill="none" stroke="#e5e7eb" strokeWidth="20" />
      </svg>
    );
  }

  const r = 60;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((seg) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const dashOffset = -offset;
          offset += dashLen;
          return (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          );
        })}
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#1f2937" fontSize="18" fontFamily="Georgia, serif" fontWeight="600">
          {fmt(total)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#9ca3af" fontSize="10" fontFamily="monospace">
          total
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {segments.map((seg) => (
          <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "#374151" }}>{seg.label}</span>
            <span style={{ fontSize: "0.8rem", fontFamily: "Georgia, serif", color: "#6b7280", marginLeft: "auto" }}>
              {fmt(seg.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary card                                                       */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 200px",
        padding: "1.25rem 1.5rem",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0.5rem",
      }}
    >
      <div
        style={{
          fontSize: "0.65rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#6b7280",
          fontFamily: "monospace",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 600,
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#1f2937",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#9ca3af",
            fontFamily: "monospace",
            marginTop: "0.375rem",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chart panel wrapper                                                */
/* ------------------------------------------------------------------ */

function Panel({
  title,
  children,
  style: extraStyle,
}: {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0.5rem",
        padding: "1.5rem",
        ...extraStyle,
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#6b7280",
          fontFamily: "monospace",
          marginBottom: "1rem",
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-page performance table                                         */
/* ------------------------------------------------------------------ */

function PageTable({ pages }: { pages: PageStat[] }) {
  if (pages.length === 0) return <div style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No pages</div>;
  const maxSubs = Math.max(...pages.map((p) => p.submissions)) || 1;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
        <thead>
          <tr>
            {["Page", "Submissions", "", "Raised", "Conv."].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: h === "Page" ? "left" : "right",
                  padding: "0.5rem 0.75rem",
                  borderBottom: "1px solid #e5e7eb",
                  fontFamily: "monospace",
                  fontWeight: 600,
                  fontSize: "0.65rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#6b7280",
                  ...(h === "" ? { textAlign: "left", width: "30%" } : {}),
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.slug} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "0.625rem 0.75rem", fontFamily: "monospace", color: "#374151" }}>
                <div style={{ fontWeight: 500 }}>{p.title}</div>
                <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>/{p.slug}</div>
              </td>
              <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontFamily: "Georgia, serif", fontWeight: 600 }}>
                {fmt(p.submissions)}
              </td>
              <td style={{ padding: "0.625rem 0.75rem" }}>
                <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, minWidth: 60 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(p.submissions / maxSubs) * 100}%`,
                      background: "#1f2937",
                      borderRadius: 3,
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
              </td>
              <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontFamily: "Georgia, serif" }}>
                {fmtDollar(p.raised)}
              </td>
              <td style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontFamily: "monospace", color: "#6b7280" }}>
                {fmtPct(p.conversion)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard component                                           */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("No admin token found. Set your token in Action Pages settings.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch("/api/admin/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DashboardPayload>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Memoize chart data transforms
  const submissionChartData = useMemo(() => {
    if (!data) return [];
    return data.by_day.map((d, i) => ({
      x: i,
      y: d.submissions,
      label: fmtDate(d.date),
    }));
  }, [data]);

  const raisedChartData = useMemo(() => {
    if (!data) return [];
    return data.by_day.map((d, i) => ({
      x: i,
      y: d.raised,
      label: fmtDate(d.date),
    }));
  }, [data]);

  const actionTypeData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.by_action_type)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({
        label: ACTION_LABELS[key] || key,
        value,
      }));
  }, [data]);

  const attributionSegments = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.attribution).map(([key, stat]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      value: stat.submissions,
      color: SOURCE_COLORS[key] || "#6B7280",
    }));
  }, [data]);

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            width: 24,
            height: 24,
            border: "2px solid #e5e7eb",
            borderTopColor: "#1f2937",
            borderRadius: "50%",
            animation: "dashboard-spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes dashboard-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ marginTop: "0.75rem", color: "#6b7280", fontFamily: "monospace", fontSize: "0.8rem" }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  /* ---- Error state ---- */
  if (error) {
    return (
      <div style={{ padding: "2rem 1.5rem" }}>
        <div
          style={{
            padding: "1rem 1.25rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.375rem",
            color: "#991b1b",
            fontSize: "0.875rem",
            fontFamily: "monospace",
          }}
        >
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const s = data.summary;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2
          style={{
            fontSize: "1.25rem",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 400,
            color: "#1f2937",
            margin: 0,
          }}
        >
          Campaign Dashboard
        </h2>
        <div style={{ fontSize: "0.7rem", fontFamily: "monospace", color: "#9ca3af", marginTop: "0.25rem" }}>
          Last 30 days
        </div>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <SummaryCard label="Total submissions" value={fmt(s.total_submissions)} />
        <SummaryCard label="Total raised" value={fmtDollar(s.total_raised)} sub={`${fmt(s.total_donors)} donors`} />
        <SummaryCard label="Conversion rate" value={fmtPct(s.conversion_rate)} sub={`${fmt(s.total_pages)} pages`} />
        <SummaryCard
          label="Top page"
          value={s.top_page?.slug || "---"}
          sub={s.top_page ? `${fmt(s.top_page.submissions)} submissions` : undefined}
        />
      </div>

      {/* Charts: line charts row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <Panel title="Submissions over time">
          <LineChart
            data={submissionChartData}
            color="#1f2937"
            areaColor="#1f2937"
            formatY={fmt}
          />
        </Panel>
        <Panel title="Dollars raised over time">
          <LineChart
            data={raisedChartData}
            color="#059669"
            areaColor="#059669"
            formatY={fmtDollar}
          />
        </Panel>
      </div>

      {/* Charts: bar + donut row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <Panel title="Action type breakdown">
          <HBarChart data={actionTypeData} color="#1f2937" />
        </Panel>
        <Panel title="Attribution source">
          <DonutChart segments={attributionSegments} />
        </Panel>
      </div>

      {/* Per-page performance table */}
      <Panel title="Per-page performance">
        <PageTable pages={data.by_page} />
      </Panel>
    </div>
  );
}
