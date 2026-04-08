import { useEffect, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { getToken as readToken, setToken as writeToken } from "./token.ts";

/**
 * Campaign management admin panel (firm-level only).
 *
 * Lists campaigns with name, slug, status, page count, submission count.
 * Create campaign form generates and displays token once.
 * Per-campaign sharing controls with toggle switches.
 * Archive/activate toggle.
 */

interface CampaignSharing {
  cross_campaign_contacts: boolean;
  cross_campaign_attribution: boolean;
  list_builder_access: boolean;
  visible_tags: string[];
}

interface CampaignRecord {
  id: string;
  slug: string;
  name: string;
  status: "active" | "archived";
  sharing: CampaignSharing;
  created_at: string;
  page_count: number;
  submission_count: number;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const containerStyle: CSSProperties = {
  maxWidth: "52rem",
  margin: "0 auto",
  padding: "2rem 1.5rem",
  fontFamily: "Georgia, 'Times New Roman', serif",
  color: "var(--page-text, #1a1a1a)",
};

const titleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "2rem",
  fontWeight: 500,
  marginBottom: "0.5rem",
  letterSpacing: "-0.01em",
};

const subtitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1rem",
  color: "var(--page-secondary, #6b6b6b)",
  marginBottom: "2rem",
  fontStyle: "italic",
};

const monoLabel: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--page-text, #1a1a1a)",
  fontWeight: 500,
};

const inputBase: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  padding: "0.5rem 0",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1rem",
  color: "var(--page-text, #1a1a1a)",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--page-border, #d4d4c8)",
  borderRadius: 0,
  outline: "none",
  boxSizing: "border-box" as const,
};

const btnPrimary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  padding: "0.75rem 1.5rem",
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.8rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#fff",
  background: "var(--page-text, #1a1a1a)",
  border: "none",
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  ...btnPrimary,
  background: "transparent",
  color: "var(--page-text, #1a1a1a)",
  border: "1px solid var(--page-border, #d4d4c8)",
};

const cardStyle: CSSProperties = {
  padding: "1.25rem",
  borderBottom: "1px solid var(--page-border, #d4d4c8)",
};

const tokenBoxStyle: CSSProperties = {
  padding: "1rem",
  background: "#fef3c7",
  border: "1px solid #f59e0b",
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.85rem",
  wordBreak: "break-all" as const,
  marginTop: "1rem",
  marginBottom: "1rem",
};

const badgeBase: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.65rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "0.2rem 0.5rem",
  borderRadius: "2px",
};

const toggleRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.5rem 0",
  borderBottom: "1px solid var(--page-border, #d4d4c8)",
};

const toggleLabel: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.9rem",
};

const toggleDesc: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "0.8rem",
  color: "var(--page-secondary, #6b6b6b)",
  fontStyle: "italic",
  margin: "0.125rem 0 0 0",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CampaignManager() {
  const [token, setToken] = useState(readToken());
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  // Expanded campaign for editing
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as { data: CampaignRecord[] };
      setCampaigns(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    setCreating(true);
    setError(null);
    setNewToken(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json() as { api_token: string };
      setNewToken(json.api_token);
      setNewName("");
      setNewSlug("");
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const res = await fetch(`/api/admin/campaigns?id=${id}`, {
        method: currentStatus === "active" ? "DELETE" : "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: currentStatus !== "active" ? JSON.stringify({ status: "active" }) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update campaign");
    }
  };

  const handleUpdateSharing = async (id: string, sharing: CampaignSharing) => {
    try {
      const res = await fetch(`/api/admin/campaigns?id=${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sharing }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sharing");
    }
  };

  // Token entry
  if (!token) {
    return (
      <div style={containerStyle}>
        <h1 style={titleStyle}>Campaigns</h1>
        <p style={subtitleStyle}>Enter your admin token to manage campaigns.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={monoLabel}>Admin Token</label>
          <input
            type="password"
            style={inputBase}
            placeholder="Paste firm admin token..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setToken((e.target as HTMLInputElement).value);
                writeToken((e.target as HTMLInputElement).value);
              }
            }}
          />
        </div>
      </div>
    );
  }

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const archivedCampaigns = campaigns.filter((c) => c.status === "archived");

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={titleStyle}>Campaigns</h1>
          <p style={{ ...subtitleStyle, marginBottom: 0 }}>
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} across your firm
          </p>
        </div>
        <button style={btnPrimary} onClick={() => { setShowCreate(!showCreate); setNewToken(null); }}>
          {showCreate ? "Cancel" : "+ New Campaign"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fca5a5", marginBottom: "1rem", fontSize: "0.9rem" }}>
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div style={{ padding: "1.5rem", border: "1px solid var(--page-border, #d4d4c8)", marginBottom: "2rem" }}>
          <h3 style={{ ...monoLabel, fontSize: "0.75rem", marginBottom: "1rem" }}>New Campaign</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={monoLabel}>Campaign Name</label>
              <input
                style={inputBase}
                placeholder="Jane Doe for Congress"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label style={monoLabel}>Slug</label>
              <input
                style={inputBase}
                placeholder="jane-doe-congress"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
              <p style={{ ...toggleDesc, marginTop: "0.25rem" }}>
                URL-safe identifier. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>
            <button
              style={btnPrimary}
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newSlug.trim()}
            >
              {creating ? "Creating..." : "Create Campaign"}
            </button>
          </div>

          {newToken && (
            <div style={tokenBoxStyle}>
              <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>
                Save this API token now -- it will not be shown again:
              </p>
              <code style={{ wordBreak: "break-all" }}>{newToken}</code>
              <button
                style={{ ...btnSecondary, marginTop: "0.75rem", fontSize: "0.7rem" }}
                onClick={() => {
                  navigator.clipboard.writeText(newToken);
                }}
              >
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>
      )}

      {loading && <p style={{ fontStyle: "italic", color: "var(--page-secondary, #6b6b6b)" }}>Loading campaigns...</p>}

      {/* Active campaigns */}
      {activeCampaigns.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ ...monoLabel, fontSize: "0.75rem", marginBottom: "0.75rem" }}>Active</h3>
          {activeCampaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              expanded={expandedId === c.id}
              onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onToggleStatus={() => handleToggleStatus(c.id, c.status)}
              onUpdateSharing={(sharing) => handleUpdateSharing(c.id, sharing)}
            />
          ))}
        </div>
      )}

      {/* Archived campaigns */}
      {archivedCampaigns.length > 0 && (
        <div>
          <h3 style={{ ...monoLabel, fontSize: "0.75rem", marginBottom: "0.75rem", color: "var(--page-secondary, #6b6b6b)" }}>Archived</h3>
          {archivedCampaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              expanded={expandedId === c.id}
              onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onToggleStatus={() => handleToggleStatus(c.id, c.status)}
              onUpdateSharing={(sharing) => handleUpdateSharing(c.id, sharing)}
            />
          ))}
        </div>
      )}

      {!loading && campaigns.length === 0 && (
        <p style={{ fontStyle: "italic", color: "var(--page-secondary, #6b6b6b)", textAlign: "center", padding: "3rem 0" }}>
          No campaigns yet. Create one to get started.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Campaign card                                                      */
/* ------------------------------------------------------------------ */

function CampaignCard({
  campaign,
  expanded,
  onToggleExpand,
  onToggleStatus,
  onUpdateSharing,
}: {
  campaign: CampaignRecord;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleStatus: () => void;
  onUpdateSharing: (sharing: CampaignSharing) => void;
}) {
  const isActive = campaign.status === "active";

  return (
    <div style={cardStyle}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={onToggleExpand}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "1.1rem", fontWeight: 500 }}>
              {campaign.name}
            </span>
            <span style={{
              ...badgeBase,
              background: isActive ? "#dcfce7" : "#f3f4f6",
              color: isActive ? "#166534" : "#6b7280",
            }}>
              {campaign.status}
            </span>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.25rem" }}>
            <span style={{ ...monoLabel, fontSize: "0.65rem", color: "var(--page-secondary, #6b6b6b)" }}>
              /{campaign.slug}
            </span>
            <span style={{ ...monoLabel, fontSize: "0.65rem", color: "var(--page-secondary, #6b6b6b)" }}>
              {campaign.page_count} page{campaign.page_count !== 1 ? "s" : ""}
            </span>
            <span style={{ ...monoLabel, fontSize: "0.65rem", color: "var(--page-secondary, #6b6b6b)" }}>
              {campaign.submission_count} submission{campaign.submission_count !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <span style={{ fontFamily: "monospace", fontSize: "1.2rem", color: "var(--page-secondary, #6b6b6b)" }}>
          {expanded ? "-" : "+"}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: "1.25rem" }}>
          <h4 style={{ ...monoLabel, fontSize: "0.7rem", marginBottom: "0.75rem" }}>Data Sharing Controls</h4>
          <p style={toggleDesc}>
            Controls what this campaign can see from other campaigns in your firm.
          </p>

          <div style={{ marginTop: "0.75rem" }}>
            <SharingToggle
              label="Cross-campaign contacts"
              description="Can this campaign see contacts from other campaigns?"
              checked={campaign.sharing.cross_campaign_contacts}
              onChange={(v) => onUpdateSharing({ ...campaign.sharing, cross_campaign_contacts: v })}
            />
            <SharingToggle
              label="Cross-campaign attribution"
              description="Can this campaign see attribution data from other campaigns?"
              checked={campaign.sharing.cross_campaign_attribution}
              onChange={(v) => onUpdateSharing({ ...campaign.sharing, cross_campaign_attribution: v })}
            />
            <SharingToggle
              label="List builder access"
              description="Can this campaign use the firm-level list builder?"
              checked={campaign.sharing.list_builder_access}
              onChange={(v) => onUpdateSharing({ ...campaign.sharing, list_builder_access: v })}
            />
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
            <button style={btnSecondary} onClick={onToggleStatus}>
              {isActive ? "Archive Campaign" : "Reactivate Campaign"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle component                                                   */
/* ------------------------------------------------------------------ */

function SharingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const switchOuter: CSSProperties = {
    width: "40px",
    height: "22px",
    borderRadius: "11px",
    background: checked ? "#166534" : "var(--page-border, #d4d4c8)",
    position: "relative",
    cursor: "pointer",
    transition: "background 0.15s ease",
    flexShrink: 0,
  };

  const switchInner: CSSProperties = {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "#fff",
    position: "absolute",
    top: "2px",
    left: checked ? "20px" : "2px",
    transition: "left 0.15s ease",
  };

  return (
    <div style={toggleRow}>
      <div style={{ flex: 1 }}>
        <div style={toggleLabel}>{label}</div>
        <p style={toggleDesc}>{description}</p>
      </div>
      <div style={switchOuter} onClick={() => onChange(!checked)}>
        <div style={switchInner} />
      </div>
    </div>
  );
}

export default CampaignManager;
