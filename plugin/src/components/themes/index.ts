import { createRegistry } from "../../lib/registry.ts";

export interface Theme {
  "--page-bg": string;
  "--page-text": string;
  "--page-accent": string;
  "--page-secondary": string;
  "--page-border": string;
  "--page-radius": string;
  "--page-font-serif": string;
  "--page-font-mono": string;
}

export const themes = createRegistry<Theme>("themes");

const warm: Theme = {
  "--page-bg": "#f5f5f0",
  "--page-text": "#1a1a1a",
  "--page-accent": "#1a1a1a",
  "--page-secondary": "#6b6b6b",
  "--page-border": "#d4d4c8",
  "--page-radius": "0px",
  "--page-font-serif": "Georgia, 'Times New Roman', serif",
  "--page-font-mono": "'SF Mono', 'Fira Code', monospace",
};

const bold: Theme = {
  "--page-bg": "#0a0a0a",
  "--page-text": "#ffffff",
  "--page-accent": "#ef4444",
  "--page-secondary": "#a1a1a1",
  "--page-border": "#2a2a2a",
  "--page-radius": "8px",
  "--page-font-serif": "Inter, system-ui, sans-serif",
  "--page-font-mono": "'SF Mono', 'Fira Code', monospace",
};

const clean: Theme = {
  "--page-bg": "#ffffff",
  "--page-text": "#1a1a1a",
  "--page-accent": "#2563eb",
  "--page-secondary": "#6b7280",
  "--page-border": "#e5e5e5",
  "--page-radius": "4px",
  "--page-font-serif": "system-ui, -apple-system, sans-serif",
  "--page-font-mono": "'SF Mono', 'Fira Code', monospace",
};

themes.register("warm", warm);
themes.register("bold", bold);
themes.register("clean", clean);

/**
 * Resolve a theme from a registry key or a custom theme object.
 * Falls back to "warm" if the key is not found.
 */
export function resolveTheme(
  input?: string | Record<string, string>,
): Theme {
  if (!input) {
    return themes.get("warm")!;
  }

  if (typeof input === "string") {
    return themes.get(input) ?? themes.get("warm")!;
  }

  // Treat as custom theme object — merge over warm defaults
  const base = { ...themes.get("warm")! };
  for (const [key, value] of Object.entries(input)) {
    if (key.startsWith("--page-")) {
      (base as Record<string, string>)[key] = value;
    }
  }
  return base;
}
