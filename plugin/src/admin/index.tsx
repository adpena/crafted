import { PageBuilder } from "./PageBuilder";
import { NotificationConfig } from "./NotificationConfig";
import { SubmissionsViewer } from "./SubmissionsViewer";
import { StatsWidget } from "./StatsWidget";
import { TemplateGallery } from "./TemplateGallery";
import { AIPageGenerator } from "./AIPageGenerator";
import { BrandExtractor } from "./BrandExtractor";
import { EmailBlastComposer } from "./EmailBlastComposer";
import { CsvImportWizard } from "./CsvImportWizard";
import { WebhookInboxViewer } from "./WebhookInboxViewer";
import { AuditLogViewer } from "./AuditLogViewer";
import { LivePagePreview } from "./LivePagePreview";

export { PageBuilder } from "./PageBuilder";
export type { PageBuilderProps, Campaign, PluginSettings } from "./PageBuilder";
export { NotificationConfig } from "./NotificationConfig";
export { SubmissionsViewer } from "./SubmissionsViewer";
export { StatsWidget } from "./StatsWidget";
export { TemplateGallery } from "./TemplateGallery";
export type { TemplateGalleryProps, PageTemplate } from "./TemplateGallery";
export { AIPageGenerator } from "./AIPageGenerator";
export type { AIPageGeneratorProps } from "./AIPageGenerator";
export { BrandExtractor } from "./BrandExtractor";
export type { BrandExtractorProps, BrandKit, BrandThemeVariant } from "./BrandExtractor";
export { EmailBlastComposer } from "./EmailBlastComposer";
export type { EmailBlastComposerProps } from "./EmailBlastComposer";
export { CsvImportWizard } from "./CsvImportWizard";
export type { CsvImportWizardProps } from "./CsvImportWizard";
export { WebhookInboxViewer } from "./WebhookInboxViewer";
export { AuditLogViewer } from "./AuditLogViewer";
export { LivePagePreview } from "./LivePagePreview";
export type { LivePagePreviewProps, LivePagePreviewConfig } from "./LivePagePreview";

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
 * Admin page registry -- keyed by the `path` declared in adminPages.
 * The emdash admin panel looks up pluginAdmins["action-pages"].pages[path]
 * to render the React component for each admin page.
 */
export const pages: Record<string, React.ComponentType> = {
  "/action-pages": PageBuilder,
  "/submissions": SubmissionsViewer,
  "/notifications": NotificationConfig,
  "/templates": TemplateGallery,
  "/brand": BrandExtractor,
  "/generate": AIPageGenerator,
  "/email": EmailBlastComposer,
  "/import": CsvImportWizard,
  "/webhooks": WebhookInboxViewer,
  "/audit": AuditLogViewer,
};

/**
 * Dashboard widget registry -- keyed by widget `id`.
 * The emdash admin panel looks up pluginAdmins["action-pages"].widgets[id].
 */
export const widgets: Record<string, React.ComponentType> = {
  "action-stats": StatsWidget,
};

export default PageBuilder;
