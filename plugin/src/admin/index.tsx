import { PageBuilder } from "./PageBuilder";
import { NotificationConfig } from "./NotificationConfig";

export { PageBuilder } from "./PageBuilder";
export type { PageBuilderProps, Campaign, PluginSettings } from "./PageBuilder";
export { NotificationConfig } from "./NotificationConfig";

export { Section } from "./components/Section";
export { Field, inputStyle } from "./components/Field";
export {
  TemplatePicker,
  TEMPLATE_OPTIONS,
  type TemplateId,
} from "./components/TemplatePicker";
export {
  ActionPicker,
  ACTION_OPTIONS,
  type ActionId,
} from "./components/ActionPicker";
export {
  ThemeSwatch,
  THEME_OPTIONS,
  type ThemeId,
} from "./components/ThemeSwatch";

/**
 * Submissions placeholder -- rendered at /_emdash/admin/plugins/action-pages/submissions.
 * Placeholder: submissions viewer with filtering, export, and campaign drill-down.
 */
function SubmissionsPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
        Submissions
      </h1>
      <p style={{ color: "#6b7280" }}>
        Submissions viewer coming soon. Use the plugin API at{" "}
        <code>/api/_plugin/action-pages/stats</code> to query submission data.
      </p>
    </div>
  );
}

/**
 * Action Stats dashboard widget.
 * Rendered in the emdash dashboard when the "action-stats" widget is configured.
 */
function ActionStatsWidget() {
  return (
    <div style={{ padding: "1rem" }}>
      <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
        Action page statistics widget coming soon.
      </p>
    </div>
  );
}

/**
 * Admin page registry -- keyed by the `path` declared in adminPages.
 * The emdash admin panel looks up pluginAdmins["action-pages"].pages[path]
 * to render the React component for each admin page.
 */
export const pages: Record<string, React.ComponentType> = {
  "/action-pages": PageBuilder,
  "/submissions": SubmissionsPage,
  "/notifications": NotificationConfig,
};

/**
 * Dashboard widget registry -- keyed by widget `id`.
 * The emdash admin panel looks up pluginAdmins["action-pages"].widgets[id].
 */
export const widgets: Record<string, React.ComponentType> = {
  "action-stats": ActionStatsWidget,
};

export default PageBuilder;
