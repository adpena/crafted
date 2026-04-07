/**
 * Loader entry for <crafted-action-page>.
 *
 * Designed to be served from /api/_plugin/action-pages/web-component.js
 * as an inline IIFE source. Designers can drop one script tag into any HTML
 * page and use the custom element anywhere in the document:
 *
 *   <script src="https://adpena.com/embed/web-component.js" async></script>
 *   <crafted-action-page slug="my-petition"></crafted-action-page>
 *
 * Importing this file from another bundle simply registers the element as a
 * side effect, so it is tree-shake friendly.
 */

import "./action-page.ts";
