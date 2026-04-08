import { useEffect, useState, useCallback } from "react";
import { getToken as readToken, setToken as writeToken, clearToken } from "./token.ts";

/**
 * Cross-campaign list builder admin panel.
 *
 * Provides a search form for building targeted contact lists across
 * campaigns, viewing results, saving searches as named lists, and
 * syncing lists to campaign platforms.
 *
 * Authentication: requires MCP_ADMIN_TOKEN in localStorage as
 * "action_pages_admin_token" (same as SubmissionsViewer).
 */

interface ContactResult {
  email: string;
  first_name?: string;
  last_name?: string;
  zip?: string;
  total_actions: number;
  campaigns: string[];
  action_types: string[];
  first_seen: string;
  last_action: string;
  tags: string[];
}

interface SearchResponse {
  data: ContactResult[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

interface SavedList {
  id: string;
  name: string;
  filters: SearchFilters;
  created_at: string;
  contact_count: number;
}

interface SearchFilters {
  has_action?: string[];
  missing_action?: string[];
  campaigns?: string[];
  any_campaign?: boolean;
  tags?: string[];
  zip_prefix?: string;
  min_actions?: number;
  since?: string;
}

const PAGE_SIZE = 50;

const ACTION_TYPES = [
  "petition_sign",
  "letter_sent",
  "donation_click",
  "gotv_pledge",
  "signup",
  "csv_import",
] as const;

const PLATFORMS = [
  "mailchimp",
  "actionnetwork",
  "nationbuilder",
  "everyaction",
  "sendgrid",
  "constantcontact",
] as const;

export function ListBuilder() {
  const [token, setToken] = useState(readToken());
  const [tokenInput, setTokenInput] = useState("");

  // Search form state
  const [hasAction, setHasAction] = useState<string[]>([]);
  const [missingAction, setMissingAction] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState("");
  const [anyCampaign, setAnyCampaign] = useState(true);
  const [tags, setTags] = useState("");
  const [zipPrefix, setZipPrefix] = useState("");
  const [minActions, setMinActions] = useState("");
  const [since, setSince] = useState("");

  // Results state
  const [data, setData] = useState<SearchResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Saved lists
  const [lists, setLists] = useState<SavedList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Sync
  const [syncPlatform, setSyncPlatform] = useState("");
  const [syncTag, setSyncTag] = useState("");
  const [syncStatus, setSyncStatus] = useState("");

  const buildFilters = useCallback((): SearchFilters => {
    const filters: SearchFilters = {};
    if (hasAction.length > 0) filters.has_action = hasAction;
    if (missingAction.length > 0) filters.missing_action = missingAction;
    const campaignList = campaigns
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (campaignList.length > 0) filters.campaigns = campaignList;
    if (anyCampaign) filters.any_campaign = true;
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagList.length > 0) filters.tags = tagList;
    if (zipPrefix) filters.zip_prefix = zipPrefix;
    if (minActions) filters.min_actions = parseInt(minActions, 10) || undefined;
    if (since) filters.since = since;
    return filters;
  }, [hasAction, missingAction, campaigns, anyCampaign, tags, zipPrefix, minActions, since]);

  const runSearch = useCallback(
    async (newOffset = 0) => {
      if (!token) return;
      setLoading(true);
      setError("");
      setOffset(newOffset);

      try {
        const res = await fetch("/api/admin/contacts/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filters: buildFilters(),
            limit: PAGE_SIZE,
            offset: newOffset,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as SearchResponse;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [token, buildFilters],
  );

  const loadLists = useCallback(async () => {
    if (!token) return;
    setListsLoading(true);
    try {
      const res = await fetch("/api/admin/lists", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = (await res.json()) as { data: SavedList[] };
      setLists(json.data ?? []);
    } catch {
      // silent
    } finally {
      setListsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  async function saveList() {
    if (!saveName.trim() || !token) return;
    try {
      const res = await fetch("/api/admin/lists", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: saveName.trim(), filters: buildFilters() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveName("");
      loadLists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deleteList(id: string) {
    if (!token) return;
    try {
      await fetch(`/api/admin/lists?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadLists();
    } catch {
      // silent
    }
  }

  async function syncList(id: string) {
    if (!syncPlatform || !token) return;
    setSyncStatus("Syncing...");
    try {
      const res = await fetch(`/api/admin/lists/sync?id=${encodeURIComponent(id)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platform: syncPlatform, tag: syncTag || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { synced: number; failed: number; platform: string };
      setSyncStatus(`Synced ${json.synced} to ${json.platform}${json.failed ? `, ${json.failed} failed` : ""}`);
    } catch (err) {
      setSyncStatus(err instanceof Error ? err.message : "Sync failed");
    }
  }

  function loadListFilters(list: SavedList) {
    const f = list.filters;
    setHasAction(f.has_action ?? []);
    setMissingAction(f.missing_action ?? []);
    setCampaigns((f.campaigns ?? []).join(", "));
    setAnyCampaign(f.any_campaign ?? true);
    setTags((f.tags ?? []).join(", "));
    setZipPrefix(f.zip_prefix ?? "");
    setMinActions(f.min_actions ? String(f.min_actions) : "");
    setSince(f.since ?? "");
  }

  function toggleInList(value: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function saveToken() {
    writeToken(tokenInput);
    setToken(tokenInput);
    setTokenInput("");
  }

  if (!token) {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
          List Builder
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
          Enter your admin token to use the list builder.
        </p>
        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="MCP_ADMIN_TOKEN"
          style={{ ...inputStyle, width: "100%", marginBottom: "0.5rem", fontFamily: "monospace" }}
        />
        <button type="button" onClick={saveToken} disabled={!tokenInput} style={btnPrimary(!tokenInput)}>
          Save Token
        </button>
      </div>
    );
  }

  const pagination = data?.pagination;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", padding: "2rem" }}>
      {/* Sidebar: Saved Lists */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Saved Lists</h2>
          <button
            type="button"
            onClick={() => { clearToken(); setToken(""); }}
            style={btnSmall}
          >
            Forget token
          </button>
        </div>

        {listsLoading && <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Loading...</p>}

        {lists.length === 0 && !listsLoading && (
          <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No saved lists yet.</p>
        )}

        {lists.map((list) => (
          <div
            key={list.id}
            style={{
              padding: "0.75rem",
              border: "1px solid #e5e7eb",
              borderRadius: "0.375rem",
              marginBottom: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{list.name}</div>
            <div style={{ color: "#6b7280", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
              {list.contact_count.toLocaleString()} contacts
            </div>
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => loadListFilters(list)} style={btnSmall}>
                Load
              </button>
              <button type="button" onClick={() => syncList(list.id)} style={btnSmall}>
                Sync
              </button>
              <button type="button" onClick={() => deleteList(list.id)} style={{ ...btnSmall, color: "#dc2626" }}>
                Delete
              </button>
            </div>
          </div>
        ))}

        {/* Sync controls */}
        <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "0.375rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.5rem", color: "#374151" }}>
            Sync Settings
          </div>
          <select
            value={syncPlatform}
            onChange={(e) => setSyncPlatform(e.target.value)}
            style={{ ...inputStyle, width: "100%", marginBottom: "0.375rem" }}
          >
            <option value="">Platform...</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            type="text"
            value={syncTag}
            onChange={(e) => setSyncTag(e.target.value)}
            placeholder="Tag (optional)"
            style={{ ...inputStyle, width: "100%", marginBottom: "0.375rem" }}
          />
          {syncStatus && (
            <div style={{ fontSize: "0.75rem", color: syncStatus.includes("fail") ? "#dc2626" : "#059669" }}>
              {syncStatus}
            </div>
          )}
        </div>
      </div>

      {/* Main: Search + Results */}
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>List Builder</h1>

        {/* Search Form */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {/* Has action */}
            <div>
              <label style={labelStyle}>Has action (any of)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                {ACTION_TYPES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleInList(a, hasAction, setHasAction)}
                    style={chipStyle(hasAction.includes(a))}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Missing action */}
            <div>
              <label style={labelStyle}>Missing action (none of)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                {ACTION_TYPES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleInList(a, missingAction, setMissingAction)}
                    style={chipStyle(missingAction.includes(a))}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Campaigns */}
            <div>
              <label style={labelStyle}>Campaigns (comma-separated slugs)</label>
              <input
                type="text"
                value={campaigns}
                onChange={(e) => setCampaigns(e.target.value)}
                placeholder="fund-public-schools, climate-action-now"
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>

            {/* Any campaign toggle */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", paddingBottom: "0.25rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem" }}>
                <input
                  type="checkbox"
                  checked={anyCampaign}
                  onChange={(e) => setAnyCampaign(e.target.checked)}
                />
                Search across all campaigns
              </label>
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags (all required)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="volunteer, super-supporter"
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>

            {/* Zip prefix */}
            <div>
              <label style={labelStyle}>Zip prefix</label>
              <input
                type="text"
                value={zipPrefix}
                onChange={(e) => setZipPrefix(e.target.value)}
                placeholder="787"
                style={{ ...inputStyle, width: "100%" }}
                maxLength={5}
              />
            </div>

            {/* Min actions */}
            <div>
              <label style={labelStyle}>Min actions</label>
              <input
                type="number"
                value={minActions}
                onChange={(e) => setMinActions(e.target.value)}
                placeholder="2"
                style={{ ...inputStyle, width: "100%" }}
                min={1}
              />
            </div>

            {/* Since */}
            <div>
              <label style={labelStyle}>Since date</label>
              <input
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
          </div>

          {/* Search + Save buttons */}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", alignItems: "center" }}>
            <button type="button" onClick={() => runSearch(0)} style={btnPrimary(false)}>
              Search
            </button>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="List name..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={saveList}
              disabled={!saveName.trim()}
              style={btnPrimary(!saveName.trim())}
            >
              Save as List
            </button>
          </div>
        </div>

        {/* Status */}
        {loading && <p style={{ color: "#6b7280" }}>Searching...</p>}
        {error && <p style={{ color: "#dc2626" }}>{error}</p>}
        {!loading && !error && data && data.data.length === 0 && (
          <p style={{ color: "#6b7280" }}>No contacts match these filters.</p>
        )}

        {/* Results table */}
        {data && data.data.length > 0 && (
          <>
            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "0.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <tr>
                    <th style={th}>Name</th>
                    <th style={th}>Email</th>
                    <th style={th}>Zip</th>
                    <th style={th}>Actions</th>
                    <th style={th}>Campaigns</th>
                    <th style={th}>Types</th>
                    <th style={th}>Last Action</th>
                    <th style={th}>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row) => (
                    <tr key={row.email} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={td}>
                        {[row.first_name, row.last_name].filter(Boolean).join(" ") || "--"}
                      </td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: "0.8rem" }}>{row.email}</td>
                      <td style={td}>{row.zip ?? "--"}</td>
                      <td style={td}>{row.total_actions}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {row.campaigns.map((c) => (
                            <span key={c} style={tagStyle}>{c}</span>
                          ))}
                        </div>
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {row.action_types.map((t) => (
                            <span key={t} style={tagStyle}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td style={td}>{new Date(row.last_action).toLocaleDateString()}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {row.tags.map((t) => (
                            <span key={t} style={{ ...tagStyle, background: "#dbeafe", color: "#1e40af" }}>{t}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                  {offset + 1}--{offset + data.data.length} of {pagination.total.toLocaleString()}
                </span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => runSearch(Math.max(0, offset - PAGE_SIZE))}
                    disabled={offset === 0}
                    style={pageBtn(offset === 0)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => runSearch(offset + PAGE_SIZE)}
                    disabled={!pagination.has_more}
                    style={pageBtn(!pagination.has_more)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.5rem",
  border: "1px solid #d1d5db",
  borderRadius: "0.25rem",
  fontSize: "0.875rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "0.25rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const th: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  fontWeight: 600,
  color: "#374151",
  textTransform: "uppercase",
  fontSize: "0.75rem",
  letterSpacing: "0.04em",
};

const td: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  color: "#1f2937",
};

const tagStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.125rem 0.375rem",
  background: "#f3f4f6",
  borderRadius: "0.25rem",
  fontSize: "0.75rem",
  color: "#374151",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
    border: `1px solid ${active ? "#2563eb" : "#d1d5db"}`,
    borderRadius: "0.25rem",
    background: active ? "#eff6ff" : "#fff",
    color: active ? "#2563eb" : "#374151",
    cursor: "pointer",
  };
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.5rem 1rem",
    background: disabled ? "#9ca3af" : "#1f2937",
    color: "#fff",
    border: "none",
    borderRadius: "0.25rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontSize: "0.875rem",
  };
}

const btnSmall: React.CSSProperties = {
  padding: "0.25rem 0.5rem",
  fontSize: "0.75rem",
  background: "transparent",
  border: "1px solid #d1d5db",
  borderRadius: "0.25rem",
  cursor: "pointer",
};

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.375rem 0.75rem",
    fontSize: "0.875rem",
    background: disabled ? "#f3f4f6" : "#fff",
    border: "1px solid #d1d5db",
    borderRadius: "0.25rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
