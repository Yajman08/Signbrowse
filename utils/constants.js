/**
 * UTILITIES — utils/constants.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central place for shared values. Import or reference these across
 * content.js, service-worker.js, and popup.js to avoid "magic strings".
 *
 * In a Chrome Extension (non-module context), these are loaded via
 * the manifest's "js" array or imported as ES modules (Phase 3+).
 */

const SIGNBROWSE = {
  VERSION: "1.0.0",

  // ── Message types (service worker ↔ content script) ──────────────────────
  MESSAGES: {
    SHOW_OVERLAY:      "SHOW_SIGN_OVERLAY",
    TRANSLATE_REQUEST: "TRANSLATE_REQUEST",   // Phase 3
    TRANSLATE_RESULT:  "TRANSLATE_RESULT",    // Phase 3
    PING:              "PING",
  },

  // ── Storage keys (chrome.storage.local) ──────────────────────────────────
  STORAGE_KEYS: {
    HISTORY:    "signbrowse_history",         // Phase 2+
    SETTINGS:   "signbrowse_settings",        // Phase 3+
    LANGUAGE:   "signbrowse_language",        // Phase 3+
  },

  // ── Supported sign languages (Phase 3+) ──────────────────────────────────
  LANGUAGES: {
    ISL: "Indian Sign Language",
    ASL: "American Sign Language",
    BSL: "British Sign Language",
  },

  // ── UI defaults ───────────────────────────────────────────────────────────
  UI: {
    MAX_TEXT_LENGTH: 500,    // Truncate if text is very long
    OVERLAY_WIDTH:   300,    // px
  },
};
