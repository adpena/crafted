/**
 * embed-resize.ts
 *
 * Height-reporting script for action page iframes.
 * Watches for DOM mutations and posts the content height to the parent
 * window via postMessage. The embed widget script listens for these
 * messages and resizes the iframe accordingly.
 *
 * Usage: import { initEmbedResize } from './embed-resize'; initEmbedResize();
 */

const MSG_TYPE = "crafted:resize";
const DEBOUNCE_MS = 100;

let lastHeight = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let targetOrigin = "*";

function reportHeight() {
  const height = document.documentElement.scrollHeight;
  if (height !== lastHeight) {
    lastHeight = height;
    window.parent.postMessage({ type: MSG_TYPE, height }, targetOrigin);
  }
}

function debouncedReport() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(reportHeight, DEBOUNCE_MS);
}

/**
 * Start watching for size changes and reporting height to the parent frame.
 * Safe to call multiple times; only the first call attaches observers.
 */
let initialized = false;

export function initEmbedResize(): void {
  if (initialized) return;
  initialized = true;

  // Only run inside an iframe
  if (window === window.parent) return;

  // Narrow postMessage target to the embedding parent's origin
  try {
    if (document.referrer) targetOrigin = new URL(document.referrer).origin;
  } catch { /* keep wildcard as fallback */ }

  // Initial report once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reportHeight);
  } else {
    reportHeight();
  }

  // Watch for DOM mutations (form reveals, follow-up transitions, etc.)
  const observer = new MutationObserver(debouncedReport);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  // Watch for images/fonts loading that change layout
  window.addEventListener("load", reportHeight);
  window.addEventListener("resize", debouncedReport);
}
