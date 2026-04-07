import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChannelCard } from "./components/ChannelCard.tsx";
import { PresetCard } from "./components/PresetCard.tsx";
import { SecretInput } from "./components/SecretInput.tsx";
import { TestResult, type TestResultData } from "./components/TestResult.tsx";
import { Field, inputStyle } from "./components/Field.tsx";
import { Section } from "./components/Section.tsx";

// =============================================================================
// Types
// =============================================================================

/**
 * Settings shape persisted by the plugin's settingsSchema. This component is
 * agnostic about how the values are loaded/saved — the host wires those up
 * via the `initialValues`, `onChange`, and `onSave` props. That keeps the
 * component reusable inside emdash's admin shell or a stand-alone preview.
 */
export interface NotificationSettings {
  // Discord
  discord_webhook_url: string;
  // Slack
  slack_webhook_url: string;
  // Telegram
  telegram_bot_token: string;
  telegram_chat_id: string;
  // WhatsApp
  whatsapp_api_token: string;
  whatsapp_phone_id: string;
  whatsapp_to: string;
  whatsapp_api_url: string;
  // Resend
  resend_api_key: string;
  resend_from_email: string;
  resend_to_email: string;
  // Cloudflare Email
  cf_email_from: string;
  cf_email_to: string;
  // HubSpot Forms
  hubspot_portal_id: string;
  hubspot_form_id: string;
  // HubSpot Contacts
  hubspot_api_token: string;
  // Google Sheets
  google_sheets_webhook: string;
  // Custom Webhooks
  webhook_url_1: string;
  webhook_url_2: string;
  webhook_secret: string;
}

export type ChannelId =
  | "resend"
  | "cloudflare-email"
  | "slack"
  | "discord"
  | "telegram"
  | "whatsapp"
  | "hubspot-forms"
  | "hubspot-contacts"
  | "google-sheets"
  | "webhook";

const CHANNEL_NAME_BY_ID: Record<ChannelId, string> = {
  resend: "Resend",
  "cloudflare-email": "Cloudflare Email",
  slack: "Slack",
  discord: "Discord",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  "hubspot-forms": "HubSpot Forms",
  "hubspot-contacts": "HubSpot Contacts",
  "google-sheets": "Google Sheets",
  webhook: "Webhooks",
};

export interface AdvancedSettings {
  hmacSecret: string;
  perEventFilters: Record<string, ChannelId[]>;
  retry: { maxAttempts: number; backoffMs: number };
  timeoutMs: number;
}

export interface WebhookCallback {
  id: string;
  url: string;
  events: string[];
  format: "json" | "form";
}

export interface NotificationConfigProps {
  initialValues?: Partial<NotificationSettings>;
  initialEnabled?: Partial<Record<ChannelId, boolean>>;
  initialCallbacks?: WebhookCallback[];
  initialAdvanced?: Partial<AdvancedSettings>;
  /** Called whenever a setting field changes. */
  onChange?: (key: keyof NotificationSettings, value: string) => void;
  /** Called when the user clicks "Save changes". */
  onSave?: (state: {
    settings: NotificationSettings;
    enabled: Record<ChannelId, boolean>;
    callbacks: WebhookCallback[];
    advanced: AdvancedSettings;
  }) => Promise<void> | void;
  /**
   * Override the default `fetch("./test-notification", ...)` test runner.
   * Useful in storybook / unit tests.
   */
  testRunner?: (channel?: ChannelId) => Promise<TestResultData>;
}

// =============================================================================
// Defaults
// =============================================================================

const EMPTY_SETTINGS: NotificationSettings = {
  discord_webhook_url: "",
  slack_webhook_url: "",
  telegram_bot_token: "",
  telegram_chat_id: "",
  whatsapp_api_token: "",
  whatsapp_phone_id: "",
  whatsapp_to: "",
  whatsapp_api_url: "",
  resend_api_key: "",
  resend_from_email: "",
  resend_to_email: "",
  cf_email_from: "",
  cf_email_to: "",
  hubspot_portal_id: "",
  hubspot_form_id: "",
  hubspot_api_token: "",
  google_sheets_webhook: "",
  webhook_url_1: "",
  webhook_url_2: "",
  webhook_secret: "",
};

const ALL_EVENTS = ["petition_sign", "donation_click", "gotv_pledge", "signup"] as const;

const DEFAULT_ADVANCED: AdvancedSettings = {
  hmacSecret: "",
  perEventFilters: {
    petition_sign: ["slack", "discord", "google-sheets"],
    donation_click: ["slack", "discord", "google-sheets", "hubspot-contacts"],
    gotv_pledge: ["slack", "discord", "google-sheets"],
    signup: ["resend", "slack", "google-sheets", "hubspot-contacts"],
  },
  retry: { maxAttempts: 3, backoffMs: 1000 },
  timeoutMs: 5000,
};

// =============================================================================
// Helpers
// =============================================================================

/** A channel is "configured" once its required fields are non-empty. */
function isChannelConfigured(channel: ChannelId, s: NotificationSettings): boolean {
  switch (channel) {
    case "resend":
      return Boolean(s.resend_api_key && s.resend_from_email && s.resend_to_email);
    case "cloudflare-email":
      return Boolean(s.cf_email_from && s.cf_email_to);
    case "slack":
      return Boolean(s.slack_webhook_url);
    case "discord":
      return Boolean(s.discord_webhook_url);
    case "telegram":
      return Boolean(s.telegram_bot_token && s.telegram_chat_id);
    case "whatsapp":
      return Boolean(s.whatsapp_api_token && s.whatsapp_phone_id && s.whatsapp_to);
    case "hubspot-forms":
      return Boolean(s.hubspot_portal_id && s.hubspot_form_id);
    case "hubspot-contacts":
      return Boolean(s.hubspot_api_token);
    case "google-sheets":
      return Boolean(s.google_sheets_webhook);
    case "webhook":
      return Boolean(s.webhook_url_1 || s.webhook_url_2);
  }
}

async function defaultTestRunner(channel?: ChannelId): Promise<TestResultData> {
  const channelName = channel ? CHANNEL_NAME_BY_ID[channel] : undefined;
  const response = await fetch("./test-notification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(channelName ? { channel: channelName } : {}),
  });
  if (!response.ok) {
    throw new Error(`Test failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { data?: TestResultData; error?: { message?: string } };
  if (!payload.data) {
    throw new Error(payload.error?.message ?? "Unknown error");
  }
  return payload.data;
}

// =============================================================================
// Styles
// =============================================================================

const pageStyle: CSSProperties = {
  maxWidth: "960px",
  margin: "0 auto",
  padding: "2.5rem 1.5rem 4rem",
  fontFamily: "Georgia, 'Times New Roman', serif",
  color: "var(--page-text, #1a1a1a)",
};

const heroStyle: CSSProperties = {
  marginBottom: "2.5rem",
};

const heroEyebrowStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--page-secondary, #6b6b6b)",
  margin: 0,
};

const heroTitleStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "2.5rem",
  fontWeight: 500,
  letterSpacing: "-0.02em",
  margin: "0.25rem 0 0.5rem 0",
};

const heroLeadStyle: CSSProperties = {
  fontSize: "1.05rem",
  lineHeight: 1.55,
  color: "var(--page-secondary, #4b4b4b)",
  margin: 0,
  maxWidth: "640px",
};

const presetGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "1rem",
};

const channelStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "1.25rem",
};

const advancedToggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  marginBottom: "1.5rem",
};

const monoLabelStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--page-text, #1a1a1a)",
};

const buttonStyle: CSSProperties = {
  minHeight: "44px",
  padding: "0 1.25rem",
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  background: "transparent",
  color: "var(--page-text, #1a1a1a)",
  border: "1px solid var(--page-border, #d4d4c8)",
  borderRadius: "2px",
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "var(--page-text, #1a1a1a)",
  color: "var(--page-bg, #fff)",
  borderColor: "var(--page-text, #1a1a1a)",
};

const callbackRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "0.75rem",
  alignItems: "end",
};

const callbackCardStyle: CSSProperties = {
  border: "1px solid var(--page-border, #d4d4c8)",
  borderRadius: "4px",
  padding: "1rem 1.25rem",
  background: "var(--page-surface, #faf9f5)",
};

const tagStyle: CSSProperties = {
  display: "inline-block",
  padding: "0.25rem 0.5rem",
  marginRight: "0.25rem",
  marginBottom: "0.25rem",
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.65rem",
  border: "1px solid var(--page-border, #d4d4c8)",
  borderRadius: "2px",
  background: "var(--page-bg, #fff)",
};

const togglePillStyle = (enabled: boolean): CSSProperties => ({
  width: "44px",
  height: "24px",
  borderRadius: "12px",
  border: "1px solid var(--page-border, #d4d4c8)",
  background: enabled ? "#1a1a1a" : "transparent",
  position: "relative",
  cursor: "pointer",
  padding: 0,
});

const toggleKnobStyle = (enabled: boolean): CSSProperties => ({
  position: "absolute",
  top: "1px",
  left: enabled ? "21px" : "1px",
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: enabled ? "#fff" : "#9ca3af",
  transition: "left 120ms ease",
});

const jsonViewerStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono, 'SF Mono', 'Fira Code', monospace)",
  fontSize: "0.75rem",
  background: "#0f1115",
  color: "#e4e4e7",
  padding: "1rem 1.25rem",
  borderRadius: "4px",
  overflowX: "auto",
  whiteSpace: "pre",
  lineHeight: 1.5,
};

// =============================================================================
// Component
// =============================================================================

export function NotificationConfig({
  initialValues,
  initialEnabled,
  initialCallbacks,
  initialAdvanced,
  onChange,
  onSave,
  testRunner = defaultTestRunner,
}: NotificationConfigProps = {}) {
  const [settings, setSettings] = useState<NotificationSettings>({
    ...EMPTY_SETTINGS,
    ...initialValues,
  });

  const [enabled, setEnabled] = useState<Record<ChannelId, boolean>>(() => {
    const base: Record<ChannelId, boolean> = {
      resend: false,
      "cloudflare-email": false,
      slack: false,
      discord: false,
      telegram: false,
      whatsapp: false,
      "hubspot-forms": false,
      "hubspot-contacts": false,
      "google-sheets": false,
      webhook: false,
    };
    return { ...base, ...initialEnabled };
  });

  const [callbacks, setCallbacks] = useState<WebhookCallback[]>(initialCallbacks ?? []);
  const [advanced, setAdvanced] = useState<AdvancedSettings>({
    ...DEFAULT_ADVANCED,
    ...initialAdvanced,
    perEventFilters: { ...DEFAULT_ADVANCED.perEventFilters, ...(initialAdvanced?.perEventFilters ?? {}) },
    retry: { ...DEFAULT_ADVANCED.retry, ...(initialAdvanced?.retry ?? {}) },
  });

  const [advancedMode, setAdvancedMode] = useState(false);
  const [highlight, setHighlight] = useState<ChannelId[]>([]);
  const [testResult, setTestResult] = useState<TestResultData | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const channelRefs = useRef<Partial<Record<ChannelId, HTMLDivElement | null>>>({});

  const updateSetting = useCallback(
    (key: keyof NotificationSettings, value: string) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      onChange?.(key, value);
    },
    [onChange],
  );

  const focusChannels = useCallback((ids: ChannelId[]) => {
    setHighlight(ids);
    const first = ids[0];
    if (!first) return;
    const node = channelRefs.current[first];
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.setTimeout(() => setHighlight([]), 2400);
  }, []);

  const runTest = useCallback(
    async (channel?: ChannelId) => {
      setTestLoading(true);
      setTestError(null);
      try {
        const result = await testRunner(channel);
        setTestResult(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setTestError(message);
        throw err;
      } finally {
        setTestLoading(false);
      }
    },
    [testRunner],
  );

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSavingState("saving");
    try {
      await onSave({ settings, enabled, callbacks, advanced });
      setSavingState("saved");
      window.setTimeout(() => setSavingState("idle"), 1500);
    } catch {
      setSavingState("error");
    }
  }, [advanced, callbacks, enabled, onSave, settings]);

  const configuredMap = useMemo(() => {
    const map: Record<ChannelId, boolean> = {} as Record<ChannelId, boolean>;
    (Object.keys(CHANNEL_NAME_BY_ID) as ChannelId[]).forEach((id) => {
      map[id] = isChannelConfigured(id, settings);
    });
    return map;
  }, [settings]);

  const channelsInOrder: ChannelId[] = [
    "resend",
    "cloudflare-email",
    "slack",
    "discord",
    "telegram",
    "whatsapp",
    "hubspot-forms",
    "hubspot-contacts",
    "google-sheets",
    "webhook",
  ];

  // Lock body horizontal overflow when the cards stack on mobile.
  useEffect(() => {
    return () => {
      // no-op cleanup; placeholder for future side effects
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // Channel renderers
  // ──────────────────────────────────────────────────────────────────────

  const renderResendFields = () => (
    <div style={fieldGridStyle}>
      <SecretInput
        label="API Key"
        value={settings.resend_api_key}
        onChange={(v) => updateSetting("resend_api_key", v)}
        helper="Resend dashboard › API Keys › Create. Begins with re_."
        placeholder="re_..."
      />
      <StringField
        label="From Address"
        value={settings.resend_from_email}
        onChange={(v) => updateSetting("resend_from_email", v)}
        helper="Verified sender (e.g. notifications@yourdomain.com)."
        placeholder="notifications@yourdomain.com"
        type="email"
      />
      <StringField
        label="To Address"
        value={settings.resend_to_email}
        onChange={(v) => updateSetting("resend_to_email", v)}
        helper="Where transactional notifications are delivered."
        placeholder="you@yourdomain.com"
        type="email"
      />
    </div>
  );

  const renderCloudflareFields = () => (
    <div style={fieldGridStyle}>
      <StringField
        label="From Address"
        value={settings.cf_email_from}
        onChange={(v) => updateSetting("cf_email_from", v)}
        helper="Verified sender. SEND_EMAIL binding is auto-injected by Workers."
        placeholder="notifications@yourdomain.com"
        type="email"
      />
      <StringField
        label="To Address"
        value={settings.cf_email_to}
        onChange={(v) => updateSetting("cf_email_to", v)}
        helper="Verified destination in Cloudflare Email Routing."
        placeholder="you@yourdomain.com"
        type="email"
      />
    </div>
  );

  const renderSlackFields = () => (
    <div style={fieldGridStyle}>
      <StringField
        label="Webhook URL"
        value={settings.slack_webhook_url}
        onChange={(v) => updateSetting("slack_webhook_url", v)}
        helper="Slack › Apps › Incoming Webhooks › Add to Slack."
        placeholder="https://hooks.slack.com/services/..."
      />
    </div>
  );

  const renderDiscordFields = () => (
    <div style={fieldGridStyle}>
      <StringField
        label="Webhook URL"
        value={settings.discord_webhook_url}
        onChange={(v) => updateSetting("discord_webhook_url", v)}
        helper="Channel › Edit › Integrations › Webhooks."
        placeholder="https://discord.com/api/webhooks/..."
      />
    </div>
  );

  const renderTelegramFields = () => (
    <div style={fieldGridStyle}>
      <SecretInput
        label="Bot Token"
        value={settings.telegram_bot_token}
        onChange={(v) => updateSetting("telegram_bot_token", v)}
        helper="Create via @BotFather on Telegram."
        placeholder="123456:ABC-DEF..."
      />
      <StringField
        label="Chat ID"
        value={settings.telegram_chat_id}
        onChange={(v) => updateSetting("telegram_chat_id", v)}
        helper="Numeric ID. Group IDs start with -100."
        placeholder="-1001234567890"
      />
    </div>
  );

  const renderWhatsappFields = () => (
    <div style={fieldGridStyle}>
      <SecretInput
        label="API Token"
        value={settings.whatsapp_api_token}
        onChange={(v) => updateSetting("whatsapp_api_token", v)}
        helper="Meta › WhatsApp Business › Generate access token."
        placeholder="EAABs..."
      />
      <StringField
        label="Phone Number ID"
        value={settings.whatsapp_phone_id}
        onChange={(v) => updateSetting("whatsapp_phone_id", v)}
        helper="Meta › WhatsApp › API Setup."
        placeholder="1234567890"
      />
      <StringField
        label="Recipient"
        value={settings.whatsapp_to}
        onChange={(v) => updateSetting("whatsapp_to", v)}
        helper="E.164 format, no plus sign."
        placeholder="15551234567"
      />
      <StringField
        label="API URL (optional)"
        value={settings.whatsapp_api_url}
        onChange={(v) => updateSetting("whatsapp_api_url", v)}
        helper="Override the Meta Graph API endpoint."
        placeholder="https://graph.facebook.com/v19.0"
      />
    </div>
  );

  const renderHubspotFormsFields = () => (
    <div style={fieldGridStyle}>
      <StringField
        label="Portal ID"
        value={settings.hubspot_portal_id}
        onChange={(v) => updateSetting("hubspot_portal_id", v)}
        helper="HubSpot › Settings › Account ID."
        placeholder="12345678"
      />
      <StringField
        label="Form ID"
        value={settings.hubspot_form_id}
        onChange={(v) => updateSetting("hubspot_form_id", v)}
        helper="Marketing › Forms › Embed code."
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      />
    </div>
  );

  const renderHubspotContactsFields = () => (
    <div style={fieldGridStyle}>
      <SecretInput
        label="Private App Token"
        value={settings.hubspot_api_token}
        onChange={(v) => updateSetting("hubspot_api_token", v)}
        helper="Settings › Integrations › Private Apps. Requires crm.objects.contacts.write."
        placeholder="pat-na1-..."
      />
    </div>
  );

  const renderGoogleSheetsFields = () => (
    <div style={fieldGridStyle}>
      <StringField
        label="Apps Script Web App URL"
        value={settings.google_sheets_webhook}
        onChange={(v) => updateSetting("google_sheets_webhook", v)}
        helper="Deploy the Apps Script template as a web app, then paste the /exec URL here."
        placeholder="https://script.google.com/macros/s/.../exec"
      />
    </div>
  );

  const renderWebhookFields = () => (
    <div style={fieldGridStyle}>
      <StringField
        label="Primary Webhook URL"
        value={settings.webhook_url_1}
        onChange={(v) => updateSetting("webhook_url_1", v)}
        helper="Zapier Catch Hook or any HTTPS endpoint."
        placeholder="https://hooks.zapier.com/..."
      />
      <StringField
        label="Secondary Webhook URL"
        value={settings.webhook_url_2}
        onChange={(v) => updateSetting("webhook_url_2", v)}
        helper="Optional second endpoint."
        placeholder="https://example.com/hook"
      />
      <SecretInput
        label="HMAC Secret"
        value={settings.webhook_secret}
        onChange={(v) => updateSetting("webhook_secret", v)}
        helper="HMAC-SHA256 signing key. Sent in X-Signature header."
      />
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      <header style={heroStyle}>
        <p style={heroEyebrowStyle}>Action Pages › Notifications</p>
        <h1 style={heroTitleStyle}>Wire up your channels</h1>
        <p style={heroLeadStyle}>
          Configure where action page submissions go: email, chat, CRM, or any custom webhook.
          Unconfigured channels are silently skipped at dispatch time, so you can adopt them gradually.
        </p>
      </header>

      {/* ── Quick setup ──────────────────────────────────────────────── */}
      <Section step={1} title="Quick Setup" description="Pick a starting point — we'll scroll you to the right cards.">
        <div style={presetGridStyle}>
          <PresetCard
            title="Email Only"
            description="Send transactional alerts via Resend or Cloudflare Email."
            icon="✉"
            accent="#0f766e"
            onSelect={() => focusChannels(["resend", "cloudflare-email"])}
          />
          <PresetCard
            title="Team Chat"
            description="Push submissions to your Slack and Discord channels."
            icon="#"
            accent="#4338ca"
            onSelect={() => focusChannels(["slack", "discord"])}
          />
          <PresetCard
            title="CRM Integration"
            description="Capture every lead in HubSpot Forms with field mapping."
            icon="◉"
            accent="#c2410c"
            onSelect={() => focusChannels(["hubspot-forms", "hubspot-contacts"])}
          />
        </div>
      </Section>

      {/* ── Channels ─────────────────────────────────────────────────── */}
      <Section step={2} title="Channels" description="One card per adapter. Toggle to enable, expand to configure, test to verify.">
        <div style={channelStackStyle}>
          {channelsInOrder.map((id) => (
            <div
              key={id}
              ref={(node) => {
                channelRefs.current[id] = node;
              }}
            >
              <ChannelCard
                id={id}
                name={CHANNEL_NAME_BY_ID[id]}
                icon={ICONS[id]}
                description={DESCRIPTIONS[id]}
                configured={configuredMap[id]}
                enabled={enabled[id]}
                highlight={highlight.includes(id)}
                onToggleEnabled={(next) => setEnabled((prev) => ({ ...prev, [id]: next }))}
                onTest={() => runTest(id)}
                docsUrl={DOCS_URLS[id]}
              >
                {id === "resend" && renderResendFields()}
                {id === "cloudflare-email" && renderCloudflareFields()}
                {id === "slack" && renderSlackFields()}
                {id === "discord" && renderDiscordFields()}
                {id === "telegram" && renderTelegramFields()}
                {id === "whatsapp" && renderWhatsappFields()}
                {id === "hubspot-forms" && renderHubspotFormsFields()}
                {id === "hubspot-contacts" && renderHubspotContactsFields()}
                {id === "google-sheets" && renderGoogleSheetsFields()}
                {id === "webhook" && renderWebhookFields()}
              </ChannelCard>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Advanced ─────────────────────────────────────────────────── */}
      <Section step={3} title="Advanced" description="Fine-tune routing, retries, and signing for power users.">
        <div style={advancedToggleRowStyle}>
          <button
            type="button"
            role="switch"
            aria-checked={advancedMode}
            aria-pressed={advancedMode}
            aria-label="Toggle advanced mode"
            style={togglePillStyle(advancedMode)}
            onClick={() => setAdvancedMode((prev) => !prev)}
          >
            <span aria-hidden style={toggleKnobStyle(advancedMode)} />
          </button>
          <span style={monoLabelStyle}>Advanced mode {advancedMode ? "on" : "off"}</span>
        </div>

        <CallbacksEditor callbacks={callbacks} onChange={setCallbacks} />

        <div style={{ marginTop: "1.5rem" }}>
          <SecretInput
            label="Webhook HMAC Secret"
            value={advanced.hmacSecret}
            onChange={(v) => setAdvanced((prev) => ({ ...prev, hmacSecret: v }))}
            helper="Signs every outgoing webhook with X-Signature: sha256=…"
          />
        </div>

        <PerEventFilters
          filters={advanced.perEventFilters}
          onChange={(filters) => setAdvanced((prev) => ({ ...prev, perEventFilters: filters }))}
        />

        <RetryPolicy
          retry={advanced.retry}
          timeoutMs={advanced.timeoutMs}
          onChange={(patch) => setAdvanced((prev) => ({ ...prev, ...patch }))}
        />

        {advancedMode && (
          <div style={{ marginTop: "1.5rem" }}>
            <p style={monoLabelStyle}>Raw configuration</p>
            <pre style={jsonViewerStyle} aria-label="Raw configuration JSON">
              {JSON.stringify({ settings, enabled, callbacks, advanced }, null, 2)}
            </pre>
          </div>
        )}
      </Section>

      {/* ── Test center ──────────────────────────────────────────────── */}
      <Section step={4} title="Test Center" description="Send a sample message and review the result.">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => {
              runTest().catch(() => {
                /* error captured by runTest */
              });
            }}
            disabled={testLoading}
          >
            {testLoading ? "Sending…" : "Send test to all configured channels"}
          </button>
          {channelsInOrder
            .filter((id) => configuredMap[id])
            .map((id) => (
              <button
                key={id}
                type="button"
                style={buttonStyle}
                onClick={() => {
                  runTest(id).catch(() => {
                    /* error captured by runTest */
                  });
                }}
                disabled={testLoading}
              >
                Test {CHANNEL_NAME_BY_ID[id]}
              </button>
            ))}
        </div>
        <TestResult result={testResult} isLoading={testLoading} error={testError} />
      </Section>

      {/* ── Save bar ─────────────────────────────────────────────────── */}
      {onSave && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--page-border, #d4d4c8)",
          }}
        >
          <button type="button" style={primaryButtonStyle} onClick={handleSave} disabled={savingState === "saving"}>
            {savingState === "saving" ? "Saving…" : "Save changes"}
          </button>
          {savingState === "saved" && <span style={monoLabelStyle}>Saved</span>}
          {savingState === "error" && (
            <span style={{ ...monoLabelStyle, color: "#dc2626" }}>Save failed</span>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationConfig;

// =============================================================================
// Internal helpers
// =============================================================================

interface StringFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
  placeholder?: string;
  type?: "text" | "email" | "url";
}

function StringField({ label, value, onChange, helper, placeholder, type = "text" }: StringFieldProps) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} helper={helper}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle()}
        spellCheck={false}
      />
    </Field>
  );
}

interface CallbacksEditorProps {
  callbacks: WebhookCallback[];
  onChange: (next: WebhookCallback[]) => void;
}

function CallbacksEditor({ callbacks, onChange }: CallbacksEditorProps) {
  const updateOne = (id: string, patch: Partial<WebhookCallback>) => {
    onChange(callbacks.map((cb) => (cb.id === id ? { ...cb, ...patch } : cb)));
  };
  const remove = (id: string) => onChange(callbacks.filter((cb) => cb.id !== id));
  const add = () =>
    onChange([
      ...callbacks,
      {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
        url: "",
        events: [...ALL_EVENTS],
        format: "json",
      },
    ]);

  return (
    <div>
      <p style={monoLabelStyle}>Webhook callbacks</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
        {callbacks.length === 0 && (
          <p style={{ fontStyle: "italic", color: "var(--page-secondary, #6b6b6b)", margin: 0 }}>
            No additional callbacks configured.
          </p>
        )}
        {callbacks.map((cb) => (
          <div key={cb.id} style={callbackCardStyle}>
            <div style={callbackRowStyle}>
              <Field label="URL" helper={`Format: ${cb.format}, ${cb.events.length} events`}>
                <input
                  type="url"
                  value={cb.url}
                  onChange={(e) => updateOne(cb.id, { url: e.target.value })}
                  placeholder="https://..."
                  style={inputStyle()}
                />
              </Field>
              <button type="button" style={buttonStyle} onClick={() => remove(cb.id)} aria-label="Remove callback">
                Remove
              </button>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              {ALL_EVENTS.map((event) => {
                const active = cb.events.includes(event);
                return (
                  <button
                    key={event}
                    type="button"
                    style={{
                      ...tagStyle,
                      cursor: "pointer",
                      background: active ? "#1a1a1a" : "var(--page-bg, #fff)",
                      color: active ? "#fff" : "var(--page-text, #1a1a1a)",
                      borderColor: active ? "#1a1a1a" : "var(--page-border, #d4d4c8)",
                    }}
                    aria-pressed={active}
                    onClick={() =>
                      updateOne(cb.id, {
                        events: active ? cb.events.filter((e) => e !== event) : [...cb.events, event],
                      })
                    }
                  >
                    {event}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <button type="button" style={buttonStyle} onClick={add}>
          + Add callback
        </button>
      </div>
    </div>
  );
}

interface PerEventFiltersProps {
  filters: Record<string, ChannelId[]>;
  onChange: (filters: Record<string, ChannelId[]>) => void;
}

function PerEventFilters({ filters, onChange }: PerEventFiltersProps) {
  const allChannels = Object.keys(CHANNEL_NAME_BY_ID) as ChannelId[];
  return (
    <div style={{ marginTop: "1.5rem" }}>
      <p style={monoLabelStyle}>Per-event filtering</p>
      <p
        style={{
          fontStyle: "italic",
          color: "var(--page-secondary, #6b6b6b)",
          fontSize: "0.85rem",
          margin: "0.25rem 0 0.75rem 0",
        }}
      >
        Pick which adapters fire for each submission type.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {ALL_EVENTS.map((event) => {
          const selected = filters[event] ?? [];
          return (
            <fieldset
              key={event}
              style={{
                border: "1px solid var(--page-border, #d4d4c8)",
                borderRadius: "4px",
                padding: "0.75rem 1rem",
              }}
            >
              <legend style={{ ...monoLabelStyle, padding: "0 0.5rem" }}>{event}</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                {allChannels.map((channel) => {
                  const active = selected.includes(channel);
                  return (
                    <button
                      key={channel}
                      type="button"
                      style={{
                        ...tagStyle,
                        cursor: "pointer",
                        background: active ? "#1a1a1a" : "var(--page-bg, #fff)",
                        color: active ? "#fff" : "var(--page-text, #1a1a1a)",
                        borderColor: active ? "#1a1a1a" : "var(--page-border, #d4d4c8)",
                      }}
                      aria-pressed={active}
                      onClick={() => {
                        const next = active
                          ? selected.filter((c) => c !== channel)
                          : [...selected, channel];
                        onChange({ ...filters, [event]: next });
                      }}
                    >
                      {CHANNEL_NAME_BY_ID[channel]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

interface RetryPolicyProps {
  retry: { maxAttempts: number; backoffMs: number };
  timeoutMs: number;
  onChange: (patch: Partial<AdvancedSettings>) => void;
}

function RetryPolicy({ retry, timeoutMs, onChange }: RetryPolicyProps) {
  const maxId = useId();
  const backoffId = useId();
  const timeoutId = useId();
  return (
    <div style={{ marginTop: "1.5rem" }}>
      <p style={monoLabelStyle}>Retry & timeout</p>
      <div style={{ ...fieldGridStyle, marginTop: "0.75rem" }}>
        <Field label="Max attempts" htmlFor={maxId} helper="Number of times to retry a failed dispatch.">
          <input
            id={maxId}
            type="number"
            min={1}
            max={10}
            value={retry.maxAttempts}
            style={inputStyle()}
            onChange={(e) =>
              onChange({ retry: { ...retry, maxAttempts: Number(e.target.value) || 1 } })
            }
          />
        </Field>
        <Field label="Backoff (ms)" htmlFor={backoffId} helper="Initial delay; exponential between attempts.">
          <input
            id={backoffId}
            type="number"
            min={0}
            step={100}
            value={retry.backoffMs}
            style={inputStyle()}
            onChange={(e) =>
              onChange({ retry: { ...retry, backoffMs: Number(e.target.value) || 0 } })
            }
          />
        </Field>
        <Field label="Per-adapter timeout (ms)" htmlFor={timeoutId} helper="Aborts each adapter after this long.">
          <input
            id={timeoutId}
            type="number"
            min={500}
            step={500}
            value={timeoutMs}
            style={inputStyle()}
            onChange={(e) => onChange({ timeoutMs: Number(e.target.value) || 5000 })}
          />
        </Field>
      </div>
    </div>
  );
}

// =============================================================================
// Static metadata
// =============================================================================

const ICONS: Record<ChannelId, string> = {
  resend: "✉",
  "cloudflare-email": "☁",
  slack: "#",
  discord: "♺",
  telegram: "✈",
  whatsapp: "☏",
  "hubspot-forms": "▤",
  "hubspot-contacts": "◉",
  "google-sheets": "▦",
  webhook: "↯",
};

const DESCRIPTIONS: Record<ChannelId, string> = {
  resend: "Transactional email via the Resend API.",
  "cloudflare-email": "Zero-cost email via Cloudflare Email Workers binding.",
  slack: "Post submissions to a Slack channel via incoming webhook.",
  discord: "Post submissions to a Discord channel via webhook.",
  telegram: "Push messages through a Telegram bot.",
  whatsapp: "Send notifications via the WhatsApp Business API.",
  "hubspot-forms": "Submit leads through HubSpot's public Forms API.",
  "hubspot-contacts": "Create or upsert contacts via the HubSpot CRM v3 API.",
  "google-sheets": "Append rows to a Google Sheet via Apps Script.",
  webhook: "Send signed payloads to any HTTPS endpoint with retry.",
};

const DOCS_URLS: Record<ChannelId, string> = {
  resend: "https://resend.com/docs/api-reference/emails/send-email",
  "cloudflare-email": "https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/",
  slack: "https://api.slack.com/messaging/webhooks",
  discord: "https://support.discord.com/hc/en-us/articles/228383668",
  telegram: "https://core.telegram.org/bots/api",
  whatsapp: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  "hubspot-forms": "https://developers.hubspot.com/docs/api/marketing/forms",
  "hubspot-contacts": "https://developers.hubspot.com/docs/api/crm/contacts",
  "google-sheets": "https://developers.google.com/apps-script/guides/web",
  webhook: "https://github.com/adpena/notifications#webhooks",
};
