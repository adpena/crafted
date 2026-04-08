import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { SLUG_RE } from "../lib/slug.ts";
import { Section } from "./components/Section";
import { Field, inputStyle } from "./components/Field";
import {
  TemplatePicker,
  TEMPLATE_OPTIONS,
  type TemplateId,
} from "./components/TemplatePicker";
import {
  ActionPicker,
  ACTION_OPTIONS,
  type ActionId,
} from "./components/ActionPicker";
import { ThemeSwatch, type ThemeId } from "./components/ThemeSwatch";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type FollowupId = "fundraise" | "signup";

export interface Campaign {
  id: string;
  name: string;
}

export interface PluginSettings {
  default_committee_name?: string;
  default_treasurer_name?: string;
  default_theme?: ThemeId;
}

export interface PageBuilderProps {
  /** Existing campaigns to populate the optional dropdown */
  campaigns?: Campaign[];
  /** Plugin settings, used as defaults */
  settings?: PluginSettings;
  /** Override the create-page endpoint (mostly for tests) */
  createPageUrl?: string;
  /** Called after a successful save/publish */
  onSaved?: (result: { page_id: string; status: "draft" | "published" }) => void;
  /** Override navigation behaviour after publish (defaults to window.location) */
  onNavigate?: (url: string) => void;
}

interface TemplateProps {
  headline: string;
  subhead: string;
  align: "left" | "center";
  media_url: string;
  overlay_opacity: number;
  body: string;
  pull_quote: string;
}

interface ActionProps {
  // fundraise
  amounts: string;
  actblue_url: string;
  refcode: string;
  // petition
  target: string;
  goal: string;
  show_count: boolean;
  // gotv
  pledge_text: string;
  election_date: string;
  // signup
  list_name: string;
  cta_text: string;
  // letter
  letter_subject: string;
  letter_template: string;
  rep_level: "senate" | "house" | "both";
  talking_points: string; // newline-separated
  // event
  event_name: string;
  event_date: string; // ISO
  event_location: string;
  event_description: string;
  allow_guests: boolean;
  offer_calendar: boolean;
  mobilize_event_id: string;
  eventbrite_event_id: string;
  facebook_event_id: string;
  // call
  script: string;
  // step — stored as raw JSON to keep the simple interface flat; advanced users
  // can edit steps via the JSON pane in the admin
  steps_json: string;
  submit_label: string;
}

const EMPTY_TEMPLATE_PROPS: TemplateProps = {
  headline: "",
  subhead: "",
  align: "left",
  media_url: "",
  overlay_opacity: 0.4,
  body: "",
  pull_quote: "",
};

const EMPTY_ACTION_PROPS: ActionProps = {
  // fundraise
  amounts: "25, 50, 100, 250",
  actblue_url: "",
  refcode: "",
  // petition
  target: "",
  goal: "",
  show_count: true,
  // gotv
  pledge_text: "",
  election_date: "",
  // signup
  list_name: "",
  cta_text: "Sign up",
  // letter
  letter_subject: "",
  letter_template: "Dear {{rep_name}},\n\nAs your constituent, I am writing to...\n\nSincerely,",
  rep_level: "both",
  talking_points: "",
  // event
  event_name: "",
  event_date: "",
  event_location: "",
  event_description: "",
  allow_guests: false,
  offer_calendar: true,
  mobilize_event_id: "",
  eventbrite_event_id: "",
  facebook_event_id: "",
  // call
  script: "",
  // step
  steps_json: "",
  submit_label: "Submit",
};

type FieldErrors = Record<string, string>;

/* ------------------------------------------------------------------ */
/*  Validators                                                         */
/* ------------------------------------------------------------------ */

function validateSlug(slug: string): string | undefined {
  if (!slug.trim()) return "Slug is required.";
  if (!SLUG_RE.test(slug))
    return "Use lowercase letters, numbers, and hyphens. Must start with a letter or number.";
  return undefined;
}

function validateActblueUrl(url: string): string | undefined {
  if (!url.trim()) return "ActBlue URL is required.";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "ActBlue URL must use HTTPS.";
    if (!parsed.hostname.endsWith("actblue.com"))
      return "ActBlue URL must be on actblue.com.";
  } catch {
    return "Not a valid URL.";
  }
  return undefined;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function parseAmounts(amounts: string): number[] {
  return amounts
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/* ------------------------------------------------------------------ */
/*  Layout styles                                                      */
/* ------------------------------------------------------------------ */

const pageStyle: CSSProperties = {
  // Theme tokens — drives child component colors via CSS variables
  ["--page-bg" as never]: "#f5f5f0",
  ["--page-text" as never]: "#1a1a1a",
  ["--page-accent" as never]: "#1a1a1a",
  ["--page-secondary" as never]: "#6b6b6b",
  ["--page-border" as never]: "#d4d4c8",
  ["--page-font-serif" as never]: "Georgia, 'Times New Roman', serif",
  ["--page-font-mono" as never]: "'SF Mono', 'Fira Code', monospace",
  background: "var(--page-bg)",
  color: "var(--page-text)",
  minHeight: "100vh",
  paddingBottom: "8rem",
};

const containerStyle: CSSProperties = {
  maxWidth: "56rem",
  margin: "0 auto",
  padding: "3rem 1.5rem 2rem",
};

const eyebrowStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono)",
  fontSize: "0.7rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--page-secondary)",
  margin: 0,
};

const titleStyle: CSSProperties = {
  fontFamily: "var(--page-font-serif)",
  fontSize: "2.5rem",
  fontWeight: 500,
  letterSpacing: "-0.02em",
  margin: "0.25rem 0 0.5rem",
};

const leadStyle: CSSProperties = {
  fontFamily: "var(--page-font-serif)",
  fontStyle: "italic",
  fontSize: "1.1rem",
  color: "var(--page-secondary)",
  margin: "0 0 2.5rem",
  maxWidth: "42rem",
  lineHeight: 1.5,
};

const errorBannerStyle: CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  padding: "0.75rem 1rem",
  marginBottom: "1.5rem",
  fontFamily: "var(--page-font-mono)",
  fontSize: "0.85rem",
};

const previewBoxStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono)",
  fontSize: "0.8rem",
  color: "var(--page-secondary)",
  padding: "0.5rem 0.75rem",
  background: "rgba(0,0,0,0.03)",
  border: "1px dashed var(--page-border)",
  marginTop: "0.5rem",
  wordBreak: "break-all",
};

const stickyBarStyle: CSSProperties = {
  position: "sticky",
  bottom: 0,
  left: 0,
  right: 0,
  background: "var(--page-bg)",
  borderTop: "1px solid var(--page-border)",
  padding: "1rem 1.5rem",
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  flexWrap: "wrap",
  zIndex: 10,
};

const stickyInnerStyle: CSSProperties = {
  maxWidth: "56rem",
  margin: "0 auto",
  width: "100%",
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.75rem",
  flexWrap: "wrap",
};

function buttonStyle(
  variant: "primary" | "secondary" | "ghost",
  disabled = false,
): CSSProperties {
  const base: CSSProperties = {
    minHeight: "44px",
    padding: "0 1.25rem",
    fontFamily: "var(--page-font-mono)",
    fontSize: "0.75rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid var(--page-text)",
    transition: "background 120ms ease, color 120ms ease, opacity 120ms ease",
    opacity: disabled ? 0.45 : 1,
  };
  if (variant === "primary") {
    return {
      ...base,
      background: "var(--page-text)",
      color: "var(--page-bg)",
    };
  }
  if (variant === "secondary") {
    return {
      ...base,
      background: "transparent",
      color: "var(--page-text)",
    };
  }
  return {
    ...base,
    background: "transparent",
    color: "var(--page-text)",
    border: "1px solid var(--page-border)",
  };
}

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  fontFamily: "var(--page-font-serif)",
  fontSize: "0.95rem",
  cursor: "pointer",
  minHeight: "44px",
};

const subSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
  padding: "1.25rem",
  background: "rgba(0,0,0,0.025)",
  border: "1px solid var(--page-border)",
};

const subHeadingStyle: CSSProperties = {
  fontFamily: "var(--page-font-mono)",
  fontSize: "0.7rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--page-secondary)",
  margin: 0,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_CREATE_URL =
  "/api/_plugin/action-pages/create-page";

export function PageBuilder({
  campaigns = [],
  settings = {},
  createPageUrl = DEFAULT_CREATE_URL,
  onSaved,
  onNavigate,
}: PageBuilderProps) {
  /* ---------- Section 1: basics ---------- */
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugAuto, setSlugAuto] = useState(true);
  const [pageTitle, setPageTitle] = useState("");
  const [campaignId, setCampaignId] = useState<string>("");

  /* ---------- Section 2: template ---------- */
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [templateProps, setTemplateProps] =
    useState<TemplateProps>(EMPTY_TEMPLATE_PROPS);

  /* ---------- Section 3: action ---------- */
  const [action, setAction] = useState<ActionId | null>(null);
  const [actionProps, setActionProps] =
    useState<ActionProps>(EMPTY_ACTION_PROPS);

  const [hasFollowup, setHasFollowup] = useState(false);
  const [followup, setFollowup] = useState<FollowupId | null>(null);
  const [followupProps, setFollowupProps] =
    useState<ActionProps>(EMPTY_ACTION_PROPS);
  const [followupMessage, setFollowupMessage] = useState(
    "Thanks! Now chip in?",
  );

  /* ---------- Section 4: style & compliance ---------- */
  const [theme, setTheme] = useState<ThemeId>(settings.default_theme ?? "warm");
  const [committeeName, setCommitteeName] = useState(
    settings.default_committee_name ?? "",
  );
  const [treasurerName, setTreasurerName] = useState(
    settings.default_treasurer_name ?? "",
  );

  /* ---------- Errors / submission state ---------- */
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);

  /* ---------- Auto-slug from title ---------- */
  useEffect(() => {
    if (slugAuto) {
      setSlug(slugifyTitle(pageTitle));
    }
  }, [pageTitle, slugAuto]);

  /* ---------- Validation (computed) ---------- */
  const validationErrors = useMemo<FieldErrors>(() => {
    const e: FieldErrors = {};

    const slugErr = validateSlug(slug);
    if (slugErr) e.slug = slugErr;
    if (!pageTitle.trim()) e.pageTitle = "Page title is required.";
    if (!template) e.template = "Pick a template.";
    if (!action) e.action = "Pick an action.";
    if (!committeeName.trim()) e.committeeName = "Committee name is required.";

    if (template) {
      if (!templateProps.headline.trim() && !pageTitle.trim()) {
        e.tp_headline = "Headline is required.";
      }
      if (template === "hero-media" && !templateProps.media_url.trim()) {
        e.tp_media_url = "Media URL is required for this template.";
      }
    }

    if (action === "fundraise") {
      const ub = validateActblueUrl(actionProps.actblue_url);
      if (ub) e.ap_actblue_url = ub;
      if (parseAmounts(actionProps.amounts).length === 0) {
        e.ap_amounts = "Add at least one amount.";
      }
    }
    if (action === "petition") {
      if (actionProps.goal && Number.isNaN(Number(actionProps.goal))) {
        e.ap_goal = "Goal must be a number.";
      }
    }
    if (action === "signup") {
      if (!actionProps.list_name.trim())
        e.ap_list_name = "List name is required.";
      if (!actionProps.cta_text.trim())
        e.ap_cta_text = "CTA text is required.";
    }
    if (action === "gotv") {
      if (!actionProps.election_date.trim())
        e.ap_election_date = "Election date is required.";
    }

    if (hasFollowup && followup) {
      if (followup === "fundraise") {
        const ub = validateActblueUrl(followupProps.actblue_url);
        if (ub) e.fu_actblue_url = ub;
        if (parseAmounts(followupProps.amounts).length === 0) {
          e.fu_amounts = "Add at least one amount.";
        }
      }
      if (followup === "signup") {
        if (!followupProps.list_name.trim())
          e.fu_list_name = "List name is required.";
        if (!followupProps.cta_text.trim())
          e.fu_cta_text = "CTA text is required.";
      }
    }
    if (hasFollowup && !followup) {
      e.followup = "Pick a follow-up action.";
    }

    return e;
  }, [
    slug,
    pageTitle,
    template,
    templateProps,
    action,
    actionProps,
    hasFollowup,
    followup,
    followupProps,
    committeeName,
  ]);

  const isValid = Object.keys(validationErrors).length === 0;

  /* ---------- Build payload ---------- */
  const buildPayload = (status: "draft" | "published") => {
    const buildTemplateProps = (): Record<string, unknown> => {
      const headline = templateProps.headline.trim() || pageTitle.trim();
      if (template === "hero-simple") {
        return {
          headline,
          subhead: templateProps.subhead,
          align: templateProps.align,
        };
      }
      if (template === "hero-media") {
        return {
          headline,
          subhead: templateProps.subhead,
          media_url: templateProps.media_url,
          overlay_opacity: templateProps.overlay_opacity,
        };
      }
      if (template === "hero-story") {
        return {
          headline,
          subhead: templateProps.subhead,
          body: templateProps.body,
          pull_quote: templateProps.pull_quote,
          image_url: templateProps.media_url || undefined,
        };
      }
      if (template === "hero-layered") {
        return {
          headline,
          subhead: templateProps.subhead,
          background_type: "image",
          background_image: templateProps.media_url || undefined,
          overlay: "dark",
          overlay_opacity: templateProps.overlay_opacity,
          content_position: "bottom-left",
          content_color: "#ffffff",
        };
      }
      if (template === "hero-split") {
        return {
          headline,
          subhead: templateProps.subhead,
          body: templateProps.body,
          media_type: "image",
          media_url: templateProps.media_url || undefined,
          media_side: templateProps.align === "center" ? "right" : templateProps.align,
          ratio: "1/1",
        };
      }
      return {};
    };

    const buildActionProps = (
      kind: ActionId | FollowupId,
      props: ActionProps,
    ): Record<string, unknown> => {
      if (kind === "fundraise") {
        return {
          amounts: parseAmounts(props.amounts),
          actblue_url: props.actblue_url.trim(),
          refcode: props.refcode.trim() || undefined,
        };
      }
      if (kind === "petition") {
        return {
          target: props.target.trim() || undefined,
          goal: props.goal ? Number(props.goal) : undefined,
          show_count: props.show_count,
        };
      }
      if (kind === "gotv") {
        return {
          pledge_text: props.pledge_text.trim() || undefined,
          election_date: props.election_date,
        };
      }
      if (kind === "signup") {
        return {
          list_name: props.list_name.trim(),
          cta_text: props.cta_text.trim(),
        };
      }
      if (kind === "letter") {
        const talkingPoints = props.talking_points
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        return {
          subject: props.letter_subject.trim(),
          letter_template: props.letter_template,
          rep_level: props.rep_level,
          talking_points: talkingPoints.length > 0 ? talkingPoints : undefined,
        };
      }
      if (kind === "event") {
        const eventIds: Record<string, string> = {};
        if (props.mobilize_event_id.trim()) eventIds.mobilize = props.mobilize_event_id.trim();
        if (props.eventbrite_event_id.trim()) eventIds.eventbrite = props.eventbrite_event_id.trim();
        if (props.facebook_event_id.trim()) eventIds.facebook = props.facebook_event_id.trim();
        return {
          event_name: props.event_name.trim(),
          event_date: props.event_date,
          event_location: props.event_location.trim(),
          event_description: props.event_description.trim() || undefined,
          allow_guests: props.allow_guests,
          offer_calendar: props.offer_calendar,
          event_ids: Object.keys(eventIds).length > 0 ? eventIds : undefined,
        };
      }
      if (kind === "call") {
        const talkingPoints = props.talking_points
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        return {
          target: props.target.trim() || undefined,
          script: props.script,
          rep_level: props.rep_level,
          talking_points: talkingPoints.length > 0 ? talkingPoints : undefined,
        };
      }
      if (kind === "step") {
        // Parse steps JSON — fall back to empty array on parse error.
        // Validation happens client-side in StepAction itself.
        let steps: unknown = [];
        try {
          steps = JSON.parse(props.steps_json || "[]");
        } catch {
          steps = [];
        }
        return {
          steps: Array.isArray(steps) ? steps : [],
          submit_label: props.submit_label.trim() || "Submit",
        };
      }
      return {};
    };

    return {
      slug,
      campaign_id: campaignId || undefined,
      template,
      template_props: buildTemplateProps(),
      action,
      action_props: action ? buildActionProps(action, actionProps) : {},
      followup: hasFollowup && followup ? followup : undefined,
      followup_props:
        hasFollowup && followup
          ? buildActionProps(followup, followupProps)
          : undefined,
      followup_message:
        hasFollowup && followupMessage.trim() ? followupMessage : undefined,
      disclaimer: {
        committee_name: committeeName.trim(),
        treasurer_name: treasurerName.trim() || undefined,
      },
      theme,
      status,
    };
  };

  /* ---------- Submit handlers ---------- */
  const submit = async (status: "draft" | "published") => {
    setErrors(validationErrors);
    setSubmitError(null);

    if (status === "published" && !isValid) {
      setSubmitError("Please fix the errors below before publishing.");
      return;
    }
    if (status === "draft" && validationErrors.slug) {
      setSubmitError("A valid slug is required, even for drafts.");
      return;
    }

    const setBusy = status === "draft" ? setSavingDraft : setPublishing;
    setBusy(true);
    try {
      const res = await fetch(createPageUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload(status)),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { page_id: string };
        error?: string;
      };
      if (!res.ok) {
        setSubmitError(json.error ?? `Save failed (${res.status})`);
        return;
      }
      const pageId = json.data?.page_id ?? "";
      onSaved?.({ page_id: pageId, status });
      const target = "/action-pages";
      if (onNavigate) onNavigate(target);
      else if (typeof window !== "undefined") window.location.href = target;
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Network error while saving.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = () => {
    if (!slug) return;
    const url = `/action/${slug}?preview=1`;
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  /* ---------- Helpers for blur-based error display ---------- */
  const showError = (key: string): string | undefined => errors[key];
  const onBlurValidate = (key: string) => () => {
    setErrors((prev) => ({ ...prev, [key]: validationErrors[key] ?? "" }));
  };

  /* ---------- Renderers for template/action prop blocks ---------- */

  const renderTemplateFields = () => {
    if (!template) return null;
    const tplOpt = TEMPLATE_OPTIONS.find((o) => o.id === template);
    return (
      <div style={subSectionStyle}>
        <p style={subHeadingStyle}>{tplOpt?.name} fields</p>

        <Field
          label="Headline"
          htmlFor="tp_headline"
          helper="Defaults to your page title if blank."
          error={showError("tp_headline")}
        >
          <input
            id="tp_headline"
            type="text"
            value={templateProps.headline}
            placeholder={pageTitle || "Your headline"}
            onChange={(e) =>
              setTemplateProps({ ...templateProps, headline: e.target.value })
            }
            onBlur={onBlurValidate("tp_headline")}
            style={inputStyle(!!showError("tp_headline"))}
          />
        </Field>

        <Field label="Subhead" htmlFor="tp_subhead" helper="One short sentence.">
          <input
            id="tp_subhead"
            type="text"
            value={templateProps.subhead}
            onChange={(e) =>
              setTemplateProps({ ...templateProps, subhead: e.target.value })
            }
            style={inputStyle()}
          />
        </Field>

        {template === "hero-simple" && (
          <Field label="Alignment" htmlFor="tp_align">
            <select
              id="tp_align"
              value={templateProps.align}
              onChange={(e) =>
                setTemplateProps({
                  ...templateProps,
                  align: e.target.value as "left" | "center",
                })
              }
              style={inputStyle()}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
            </select>
          </Field>
        )}

        {template === "hero-media" && (
          <>
            <Field
              label="Media URL"
              htmlFor="tp_media_url"
              required
              helper="Image or video URL for the hero background."
              error={showError("tp_media_url")}
            >
              <input
                id="tp_media_url"
                type="url"
                value={templateProps.media_url}
                onChange={(e) =>
                  setTemplateProps({
                    ...templateProps,
                    media_url: e.target.value,
                  })
                }
                onBlur={onBlurValidate("tp_media_url")}
                style={inputStyle(!!showError("tp_media_url"))}
              />
            </Field>
            <Field
              label="Overlay opacity"
              htmlFor="tp_overlay"
              helper="Darken the media so the headline stays readable."
              rightLabel={
                <span
                  style={{
                    fontFamily: "var(--page-font-mono)",
                    fontSize: "0.7rem",
                    color: "var(--page-secondary)",
                  }}
                >
                  {templateProps.overlay_opacity.toFixed(2)}
                </span>
              }
            >
              <input
                id="tp_overlay"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={templateProps.overlay_opacity}
                onChange={(e) =>
                  setTemplateProps({
                    ...templateProps,
                    overlay_opacity: Number(e.target.value),
                  })
                }
                style={{ width: "100%", minHeight: "44px" }}
              />
            </Field>
          </>
        )}

        {template === "hero-story" && (
          <>
            <Field
              label="Body"
              htmlFor="tp_body"
              helper="The narrative. A few short paragraphs."
            >
              <textarea
                id="tp_body"
                value={templateProps.body}
                rows={6}
                onChange={(e) =>
                  setTemplateProps({ ...templateProps, body: e.target.value })
                }
                style={{ ...inputStyle(), minHeight: "8rem", resize: "vertical" }}
              />
            </Field>
            <Field
              label="Pull quote"
              htmlFor="tp_pullquote"
              helper="A standout line. Optional."
            >
              <input
                id="tp_pullquote"
                type="text"
                value={templateProps.pull_quote}
                onChange={(e) =>
                  setTemplateProps({
                    ...templateProps,
                    pull_quote: e.target.value,
                  })
                }
                style={inputStyle()}
              />
            </Field>
          </>
        )}
      </div>
    );
  };

  const renderActionFields = (
    kind: ActionId | FollowupId,
    props: ActionProps,
    setProps: (next: ActionProps) => void,
    prefix: "ap" | "fu",
  ) => {
    const e = (k: string) => showError(`${prefix}_${k}`);
    return (
      <div style={subSectionStyle}>
        <p style={subHeadingStyle}>
          {ACTION_OPTIONS.find((o) => o.id === kind)?.name} fields
        </p>

        {kind === "fundraise" && (
          <>
            <Field
              label="Suggested amounts"
              htmlFor={`${prefix}_amounts`}
              required
              helper="Comma-separated dollar amounts (e.g. 25, 50, 100, 250)."
              error={e("amounts")}
            >
              <input
                id={`${prefix}_amounts`}
                type="text"
                value={props.amounts}
                onChange={(ev) => setProps({ ...props, amounts: ev.target.value })}
                onBlur={onBlurValidate(`${prefix}_amounts`)}
                style={inputStyle(!!e("amounts"))}
              />
            </Field>
            <Field
              label="ActBlue URL"
              htmlFor={`${prefix}_actblue_url`}
              required
              helper="Must be HTTPS on actblue.com."
              error={e("actblue_url")}
            >
              <input
                id={`${prefix}_actblue_url`}
                type="url"
                value={props.actblue_url}
                placeholder="https://secure.actblue.com/donate/..."
                onChange={(ev) =>
                  setProps({ ...props, actblue_url: ev.target.value })
                }
                onBlur={onBlurValidate(`${prefix}_actblue_url`)}
                style={inputStyle(!!e("actblue_url"))}
              />
            </Field>
            <Field
              label="Refcode"
              htmlFor={`${prefix}_refcode`}
              helper="Optional ActBlue refcode for tracking."
            >
              <input
                id={`${prefix}_refcode`}
                type="text"
                value={props.refcode}
                onChange={(ev) => setProps({ ...props, refcode: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
          </>
        )}

        {kind === "petition" && (
          <>
            <Field
              label="Target"
              htmlFor={`${prefix}_target`}
              helper="Who is the petition addressed to? Optional."
            >
              <input
                id={`${prefix}_target`}
                type="text"
                value={props.target}
                onChange={(ev) => setProps({ ...props, target: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
            <Field
              label="Signature goal"
              htmlFor={`${prefix}_goal`}
              helper="Optional. Used for the progress bar."
              error={e("goal")}
            >
              <input
                id={`${prefix}_goal`}
                type="number"
                inputMode="numeric"
                value={props.goal}
                onChange={(ev) => setProps({ ...props, goal: ev.target.value })}
                onBlur={onBlurValidate(`${prefix}_goal`)}
                style={inputStyle(!!e("goal"))}
              />
            </Field>
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={props.show_count}
                onChange={(ev) =>
                  setProps({ ...props, show_count: ev.target.checked })
                }
                style={{ width: "1.1rem", height: "1.1rem" }}
              />
              Show signature count publicly
            </label>
          </>
        )}

        {kind === "gotv" && (
          <>
            <Field
              label="Pledge text"
              htmlFor={`${prefix}_pledge_text`}
              helper={`Optional. e.g. "I pledge to vote on Election Day."`}
            >
              <input
                id={`${prefix}_pledge_text`}
                type="text"
                value={props.pledge_text}
                onChange={(ev) =>
                  setProps({ ...props, pledge_text: ev.target.value })
                }
                style={inputStyle()}
              />
            </Field>
            <Field
              label="Election date"
              htmlFor={`${prefix}_election_date`}
              required
              error={e("election_date")}
            >
              <input
                id={`${prefix}_election_date`}
                type="date"
                value={props.election_date}
                onChange={(ev) =>
                  setProps({ ...props, election_date: ev.target.value })
                }
                onBlur={onBlurValidate(`${prefix}_election_date`)}
                style={inputStyle(!!e("election_date"))}
              />
            </Field>
          </>
        )}

        {kind === "signup" && (
          <>
            <Field
              label="List name"
              htmlFor={`${prefix}_list_name`}
              required
              helper="Internal label for the email list (e.g. main, volunteers)."
              error={e("list_name")}
            >
              <input
                id={`${prefix}_list_name`}
                type="text"
                value={props.list_name}
                onChange={(ev) =>
                  setProps({ ...props, list_name: ev.target.value })
                }
                onBlur={onBlurValidate(`${prefix}_list_name`)}
                style={inputStyle(!!e("list_name"))}
              />
            </Field>
            <Field
              label="CTA text"
              htmlFor={`${prefix}_cta_text`}
              required
              error={e("cta_text")}
            >
              <input
                id={`${prefix}_cta_text`}
                type="text"
                value={props.cta_text}
                onChange={(ev) =>
                  setProps({ ...props, cta_text: ev.target.value })
                }
                onBlur={onBlurValidate(`${prefix}_cta_text`)}
                style={inputStyle(!!e("cta_text"))}
              />
            </Field>
          </>
        )}

        {kind === "letter" && (
          <>
            <Field label="Subject line" htmlFor={`${prefix}_letter_subject`} required helper="Email subject line for the letter.">
              <input
                id={`${prefix}_letter_subject`}
                type="text"
                value={props.letter_subject}
                onChange={(ev) => setProps({ ...props, letter_subject: ev.target.value })}
                maxLength={200}
                style={inputStyle()}
              />
            </Field>
            <Field label="Letter template" htmlFor={`${prefix}_letter_template`} required helper="Merge fields: {{rep_name}}, {{rep_names}}. User can edit before sending.">
              <textarea
                id={`${prefix}_letter_template`}
                value={props.letter_template}
                onChange={(ev) => setProps({ ...props, letter_template: ev.target.value })}
                rows={8}
                maxLength={5000}
                style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5, padding: "0.75rem" }}
              />
            </Field>
            <Field label="Representative level" htmlFor={`${prefix}_rep_level`} helper="Which chambers to surface for the letter recipients.">
              <select
                id={`${prefix}_rep_level`}
                value={props.rep_level}
                onChange={(ev) => setProps({ ...props, rep_level: ev.target.value as "senate" | "house" | "both" })}
                style={inputStyle()}
              >
                <option value="both">Both (House + Senate)</option>
                <option value="house">House only</option>
                <option value="senate">Senate only</option>
              </select>
            </Field>
            <Field label="Talking points" htmlFor={`${prefix}_talking_points`} helper="One bullet per line. Optional — shown alongside the letter.">
              <textarea
                id={`${prefix}_talking_points`}
                value={props.talking_points}
                onChange={(ev) => setProps({ ...props, talking_points: ev.target.value })}
                rows={4}
                style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5, padding: "0.75rem" }}
              />
            </Field>
          </>
        )}

        {kind === "event" && (
          <>
            <Field label="Event name" htmlFor={`${prefix}_event_name`} required>
              <input
                id={`${prefix}_event_name`}
                type="text"
                value={props.event_name}
                onChange={(ev) => setProps({ ...props, event_name: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
            <Field label="Event date + time" htmlFor={`${prefix}_event_date`} required helper="ISO date-time (e.g. 2026-05-15T18:30:00-05:00).">
              <input
                id={`${prefix}_event_date`}
                type="datetime-local"
                value={props.event_date}
                onChange={(ev) => setProps({ ...props, event_date: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
            <Field label="Location" htmlFor={`${prefix}_event_location`} required>
              <input
                id={`${prefix}_event_location`}
                type="text"
                value={props.event_location}
                onChange={(ev) => setProps({ ...props, event_location: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
            <Field label="Description" htmlFor={`${prefix}_event_description`} helper="Optional. Accessibility notes, parking info, childcare availability.">
              <textarea
                id={`${prefix}_event_description`}
                value={props.event_description}
                onChange={(ev) => setProps({ ...props, event_description: ev.target.value })}
                rows={3}
                style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5, padding: "0.75rem" }}
              />
            </Field>
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={props.allow_guests}
                onChange={(ev) => setProps({ ...props, allow_guests: ev.target.checked })}
                style={{ width: "1.1rem", height: "1.1rem" }}
              />
              Allow guests on the RSVP form
            </label>
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={props.offer_calendar}
                onChange={(ev) => setProps({ ...props, offer_calendar: ev.target.checked })}
                style={{ width: "1.1rem", height: "1.1rem" }}
              />
              Offer .ics calendar download after RSVP
            </label>
            <Field label="Mobilize event ID" htmlFor={`${prefix}_mobilize_event_id`} helper="Optional. Syncs RSVPs to Mobilize. Format: eventId or eventId:timeslotId.">
              <input
                id={`${prefix}_mobilize_event_id`}
                type="text"
                value={props.mobilize_event_id}
                onChange={(ev) => setProps({ ...props, mobilize_event_id: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
            <Field label="Eventbrite event ID" htmlFor={`${prefix}_eventbrite_event_id`} helper="Optional. Syncs to Eventbrite.">
              <input
                id={`${prefix}_eventbrite_event_id`}
                type="text"
                value={props.eventbrite_event_id}
                onChange={(ev) => setProps({ ...props, eventbrite_event_id: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
            <Field label="Facebook event ID" htmlFor={`${prefix}_facebook_event_id`} helper="Optional. Syncs to Facebook Events via Graph API.">
              <input
                id={`${prefix}_facebook_event_id`}
                type="text"
                value={props.facebook_event_id}
                onChange={(ev) => setProps({ ...props, facebook_event_id: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
          </>
        )}

        {kind === "call" && (
          <>
            <Field label="Target" htmlFor={`${prefix}_target`} helper="Who is being called? e.g. Congress, your Senator.">
              <input
                id={`${prefix}_target`}
                type="text"
                value={props.target}
                onChange={(ev) => setProps({ ...props, target: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
            <Field label="Script" htmlFor={`${prefix}_script`} required helper="What to say on the call. Use [NAME], [CITY, STATE], [BILL] placeholders.">
              <textarea
                id={`${prefix}_script`}
                value={props.script}
                onChange={(ev) => setProps({ ...props, script: ev.target.value })}
                rows={5}
                style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5, padding: "0.75rem" }}
              />
            </Field>
            <Field label="Representative level" htmlFor={`${prefix}_rep_level`}>
              <select
                id={`${prefix}_rep_level`}
                value={props.rep_level}
                onChange={(ev) => setProps({ ...props, rep_level: ev.target.value as "senate" | "house" | "both" })}
                style={inputStyle()}
              >
                <option value="both">Both (House + Senate)</option>
                <option value="house">House only</option>
                <option value="senate">Senate only</option>
              </select>
            </Field>
            <Field label="Talking points" htmlFor={`${prefix}_talking_points`} helper="One bullet per line. Shown alongside the script.">
              <textarea
                id={`${prefix}_talking_points`}
                value={props.talking_points}
                onChange={(ev) => setProps({ ...props, talking_points: ev.target.value })}
                rows={4}
                style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5, padding: "0.75rem" }}
              />
            </Field>
          </>
        )}

        {kind === "step" && (
          <>
            <Field label="Submit button label" htmlFor={`${prefix}_submit_label`}>
              <input
                id={`${prefix}_submit_label`}
                type="text"
                value={props.submit_label}
                onChange={(ev) => setProps({ ...props, submit_label: ev.target.value })}
                style={inputStyle()}
              />
            </Field>
            <Field
              label="Steps (JSON)"
              htmlFor={`${prefix}_steps_json`}
              required
              helper='Array of {id, heading, body, fields[], next_if[]}. See docs for the schema. Example: [{"id":"s1","heading":"Welcome","fields":[{"type":"email","name":"email","label":"Email","required":true}]}]'
            >
              <textarea
                id={`${prefix}_steps_json`}
                value={props.steps_json}
                onChange={(ev) => setProps({ ...props, steps_json: ev.target.value })}
                rows={10}
                style={{ ...inputStyle(), resize: "vertical", lineHeight: 1.5, padding: "0.75rem", fontFamily: "monospace", fontSize: "0.85rem" }}
              />
            </Field>
          </>
        )}
      </div>
    );
  };

  /* ---------- Render ---------- */

  return (
    <div style={pageStyle}>
      <style>{`
        @media (max-width: 768px) {
          .crafted-pb-sticky-inner button { flex: 1 1 auto; }
        }
        .crafted-pb input::placeholder,
        .crafted-pb textarea::placeholder { color: var(--page-secondary); opacity: 0.7; }
        .crafted-pb input:focus,
        .crafted-pb textarea:focus,
        .crafted-pb select:focus { border-bottom-color: var(--page-text); }
      `}</style>

      <div className="crafted-pb" style={containerStyle}>
        <p style={eyebrowStyle}>Action Pages</p>
        <h1 style={titleStyle}>New action page</h1>
        <p style={leadStyle}>
          Pick a template, configure the ask, and publish. You can save a draft
          at any time and come back to it.
        </p>

        {submitError && <div style={errorBannerStyle}>{submitError}</div>}

        {/* ---------- Section 1 ---------- */}
        <Section
          step={1}
          title="Basics"
          description="The page name, the URL, and (optionally) the campaign it belongs to."
        >
          <Field
            label="Page title"
            htmlFor="page_title"
            required
            helper="Used as the default headline. You can override it in the template fields."
            error={showError("pageTitle")}
          >
            <input
              id="page_title"
              type="text"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              onBlur={onBlurValidate("pageTitle")}
              style={inputStyle(!!showError("pageTitle"))}
              placeholder="e.g. Stand with us on Election Day"
            />
          </Field>

          <Field
            label="Slug"
            htmlFor="slug"
            required
            helper={
              slugAuto
                ? "Auto-generated from the page title. Click to edit."
                : "Lowercase letters, numbers, and hyphens only."
            }
            error={slugTouched ? showError("slug") : undefined}
            rightLabel={
              !slugAuto && (
                <button
                  type="button"
                  onClick={() => setSlugAuto(true)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--page-font-mono)",
                    fontSize: "0.7rem",
                    color: "var(--page-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Reset to auto
                </button>
              )
            }
          >
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugAuto(false);
                setSlug(e.target.value);
              }}
              onBlur={() => {
                setSlugTouched(true);
                onBlurValidate("slug")();
              }}
              style={inputStyle(slugTouched && !!showError("slug"))}
            />
            <div style={previewBoxStyle}>
              /action/<strong>{slug || "your-slug"}</strong>
            </div>
          </Field>

          {campaigns.length > 0 && (
            <Field
              label="Campaign"
              htmlFor="campaign_id"
              helper="Optional. Group this page under an existing campaign."
            >
              <select
                id="campaign_id"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                style={inputStyle()}
              >
                <option value="">— None —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </Section>

        {/* ---------- Section 2 ---------- */}
        <Section
          step={2}
          title="Template"
          description="The story. How the page introduces itself."
        >
          <TemplatePicker value={template} onChange={setTemplate} />
          {showError("template") && (
            <p
              style={{
                fontFamily: "var(--page-font-mono)",
                fontSize: "0.75rem",
                color: "#b91c1c",
                margin: 0,
              }}
            >
              {showError("template")}
            </p>
          )}
          {renderTemplateFields()}
        </Section>

        {/* ---------- Section 3 ---------- */}
        <Section
          step={3}
          title="Action"
          description="The ask. What you want the visitor to do."
        >
          <ActionPicker value={action} onChange={setAction} />
          {showError("action") && (
            <p
              style={{
                fontFamily: "var(--page-font-mono)",
                fontSize: "0.75rem",
                color: "#b91c1c",
                margin: 0,
              }}
            >
              {showError("action")}
            </p>
          )}
          {action &&
            renderActionFields(action, actionProps, setActionProps, "ap")}

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={hasFollowup}
              onChange={(e) => setHasFollowup(e.target.checked)}
              style={{ width: "1.1rem", height: "1.1rem" }}
            />
            Add a follow-up action
          </label>

          {hasFollowup && (
            <>
              <ActionPicker
                value={followup}
                onChange={(id) => setFollowup(id as FollowupId)}
                allowed={["fundraise", "signup"]}
              />
              {showError("followup") && (
                <p
                  style={{
                    fontFamily: "var(--page-font-mono)",
                    fontSize: "0.75rem",
                    color: "#b91c1c",
                    margin: 0,
                  }}
                >
                  {showError("followup")}
                </p>
              )}
              {followup &&
                renderActionFields(
                  followup,
                  followupProps,
                  setFollowupProps,
                  "fu",
                )}
              <Field
                label="Follow-up message"
                htmlFor="followup_message"
                helper="Shown right after the primary action completes."
              >
                <input
                  id="followup_message"
                  type="text"
                  value={followupMessage}
                  onChange={(e) => setFollowupMessage(e.target.value)}
                  style={inputStyle()}
                />
              </Field>
            </>
          )}
        </Section>

        {/* ---------- Section 4 ---------- */}
        <Section
          step={4}
          title="Style & compliance"
          description="Pick a look and confirm your disclaimer info."
        >
          <Field label="Theme" helper="Drives colors and typography on the page.">
            <ThemeSwatch value={theme} onChange={setTheme} />
          </Field>

          <Field
            label="Committee name"
            htmlFor="committee_name"
            required
            helper="Required for FEC disclaimers (e.g. 'Peña for Congress')."
            error={showError("committeeName")}
          >
            <input
              id="committee_name"
              type="text"
              value={committeeName}
              onChange={(e) => setCommitteeName(e.target.value)}
              onBlur={onBlurValidate("committeeName")}
              style={inputStyle(!!showError("committeeName"))}
            />
          </Field>

          <Field
            label="Treasurer name"
            htmlFor="treasurer_name"
            helper="Optional. Appears in the disclaimer line if provided."
          >
            <input
              id="treasurer_name"
              type="text"
              value={treasurerName}
              onChange={(e) => setTreasurerName(e.target.value)}
              style={inputStyle()}
            />
          </Field>
        </Section>
      </div>

      {/* ---------- Sticky actions bar ---------- */}
      <div style={stickyBarStyle}>
        <div className="crafted-pb-sticky-inner" style={stickyInnerStyle}>
          <button
            type="button"
            onClick={handlePreview}
            disabled={!slug || !!validationErrors.slug}
            style={buttonStyle("ghost", !slug || !!validationErrors.slug)}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={savingDraft || publishing}
            style={buttonStyle("secondary", savingDraft || publishing)}
          >
            {savingDraft ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => submit("published")}
            disabled={!isValid || savingDraft || publishing}
            style={buttonStyle(
              "primary",
              !isValid || savingDraft || publishing,
            )}
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PageBuilder;
