/**
 * TRANSLATION CONTROLLER — controllers/translation-controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates the full ISL translation pipeline:
 *   1. Receives raw English text
 *   2. Calls GeminiService.translate(text)
 *   3. Validates result through ISLParser.validate()
 *   4. Returns validated result with status callbacks
 *
 * Designed for use from both popup.js and the content-script overlay.
 * In the content script context, it delegates to the background service worker
 * via chrome.runtime.sendMessage (since content scripts can't call external APIs).
 *
 * Public API:
 *   TranslationController.process(text, callbacks) → Promise<result>
 *   TranslationController.processViaBackground(text, callbacks) → Promise<result>
 */

const TranslationController = (() => {

  /**
   * Process text directly (for use in service worker / popup with direct API access).
   *
   * @param {string} text — English sentence to translate.
   * @param {Object} callbacks — Optional progress callbacks.
   * @param {Function} callbacks.onStart — Called when translation begins.
   * @param {Function} callbacks.onProgress — Called with (stage, message) during processing.
   * @param {Function} callbacks.onComplete — Called with the final result.
   * @param {Function} callbacks.onError — Called with error details.
   * @returns {Promise<{success, gloss, motions, raw, errors, warnings, elapsed}>}
   */
  async function process(text, callbacks = {}) {
    const { onStart, onProgress, onError, onComplete } = callbacks;
    const startTime = performance.now();

    try {
      // ── Stage 1: Validation ──
      if (onStart) onStart();
      if (onProgress) onProgress("validate", "Validating input...");

      if (!text || typeof text !== "string" || !text.trim()) {
        throw { code: "EMPTY_INPUT", message: "No text provided for translation." };
      }

      const cleanText = text.trim();
      console.log(`[TranslationController] Processing: "${cleanText.substring(0, 60)}..."`);

      // ── Stage 2: Gemini API Call ──
      if (onProgress) onProgress("api_call", "Sending to Gemini API...");

      // Check if GeminiService is available
      const geminiService = _getGeminiService();
      if (!geminiService) {
        throw { code: "SERVICE_UNAVAILABLE", message: "GeminiService module is not loaded." };
      }

      const rawResult = await geminiService.translate(cleanText);

      // ── Stage 3: Parse & Validate ──
      if (onProgress) onProgress("parse", "Parsing ISL response...");

      const parser = _getISLParser();
      let validation;
      if (parser) {
        validation = parser.validate(rawResult);
      } else {
        // If parser not available, do basic validation
        validation = {
          valid: !!(rawResult && rawResult.gloss),
          data: rawResult,
          errors: [],
          warnings: ["ISLParser not loaded — skipping full validation."]
        };
      }

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

      const result = {
        success: true,
        gloss: validation.data?.gloss || [],
        motions: validation.data?.motions || [],
        raw: rawResult,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
        elapsed: elapsed,
        inputText: cleanText,
        timestamp: new Date().toISOString()
      };

      // Log any validation issues
      if (validation.errors.length > 0) {
        console.warn("[TranslationController] Validation had errors:", validation.errors);
        result.success = validation.valid;
      }

      console.log(`[TranslationController] Done in ${elapsed}s — ${result.gloss.length} glosses`);

      if (onComplete) onComplete(result);
      return result;

    } catch (error) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const errorResult = {
        success: false,
        gloss: [],
        motions: [],
        raw: null,
        errors: [error.message || error.toString()],
        warnings: [],
        errorCode: error.code || "UNKNOWN",
        elapsed: elapsed,
        inputText: text,
        timestamp: new Date().toISOString()
      };

      console.error("[TranslationController] Failed:", error);

      if (onError) onError(errorResult);
      return errorResult;
    }
  }


  /**
   * Process text via the background service worker (for use in content scripts / popup).
   * Sends a TRANSLATE_TO_ISL message and waits for the response.
   *
   * @param {string} text — English sentence to translate.
   * @param {Object} callbacks — Optional progress callbacks.
   * @returns {Promise<{success, gloss, motions, raw, errors, warnings, elapsed}>}
   */
  function processViaBackground(text, callbacks = {}) {
    const { onStart, onProgress, onError, onComplete } = callbacks;

    return new Promise((resolve) => {
      if (onStart) onStart();
      if (onProgress) onProgress("sending", "Sending to background service...");

      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
        const err = {
          success: false,
          gloss: [],
          motions: [],
          raw: null,
          errors: ["Chrome runtime not available."],
          warnings: [],
          errorCode: "RUNTIME_UNAVAILABLE",
          elapsed: "0",
          inputText: text,
          timestamp: new Date().toISOString()
        };
        if (onError) onError(err);
        resolve(err);
        return;
      }

      chrome.runtime.sendMessage(
        {
          type: "TRANSLATE_TO_ISL",
          payload: { text: text }
        },
        (response) => {
          if (chrome.runtime.lastError) {
            const err = {
              success: false,
              gloss: [],
              motions: [],
              raw: null,
              errors: [chrome.runtime.lastError.message],
              warnings: [],
              errorCode: "MESSAGE_ERROR",
              elapsed: "0",
              inputText: text,
              timestamp: new Date().toISOString()
            };
            if (onError) onError(err);
            resolve(err);
            return;
          }

          if (response && response.status === "success") {
            const result = response.result;
            if (onComplete) onComplete(result);
            resolve(result);
          } else {
            const err = {
              success: false,
              gloss: [],
              motions: [],
              raw: null,
              errors: [response?.message || "Unknown error from background service."],
              warnings: [],
              errorCode: response?.errorCode || "BACKGROUND_ERROR",
              elapsed: "0",
              inputText: text,
              timestamp: new Date().toISOString()
            };
            if (onError) onError(err);
            resolve(err);
          }
        }
      );
    });
  }


  // ── Helpers ────────────────────────────────────────────────────────────

  function _getGeminiService() {
    if (typeof GeminiService !== "undefined") return GeminiService;
    if (typeof window !== "undefined" && window.GeminiService) return window.GeminiService;
    if (typeof self !== "undefined" && self.GeminiService) return self.GeminiService;
    return null;
  }

  function _getISLParser() {
    if (typeof ISLParser !== "undefined") return ISLParser;
    if (typeof window !== "undefined" && window.ISLParser) return window.ISLParser;
    if (typeof self !== "undefined" && self.ISLParser) return self.ISLParser;
    return null;
  }


  // ── Public API ─────────────────────────────────────────────────────────
  return {
    process,
    processViaBackground
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.TranslationController = TranslationController;
}
if (typeof self !== "undefined" && typeof window === "undefined") {
  self.TranslationController = TranslationController;
}
