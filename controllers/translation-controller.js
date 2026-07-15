/**
 * TRANSLATION CONTROLLER — controllers/translation-controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates the full ISL translation pipeline:
 *   1. Receives raw English text
 *   2. Routes to the active AI provider via AIProviderManager.translate(text)
 *   3. Validates result through ISLParser.validate()
 *   4. Returns validated result with status callbacks
 *
 * Provider-agnostic — works with Gemini, Ollama, or any future provider.
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
   * @returns {Promise<{success, gloss, motions, raw, errors, warnings, elapsed, provider}>}
   */
  async function process(text, callbacks = {}) {
    const { onStart, onProgress, onError, onComplete } = callbacks;
    const startTime = performance.now();

    try {
      // ── Stage 1: Validation ──
      if (onStart) onStart();
      if (onProgress) onProgress("validate", "Validating input...");
      console.log("[TranslationController] ▶ Stage 1: Validating input...");

      if (!text || typeof text !== "string" || !text.trim()) {
        console.error("[TranslationController] ✖ Stage 1: Empty input");
        throw { code: "EMPTY_INPUT", message: "No text provided for translation." };
      }

      const cleanText = text.trim();
      console.log(`[TranslationController] ✔ Stage 1: Input valid: "${cleanText.substring(0, 60)}..."`);

      // ── Stage 2: Route to active AI provider ──
      console.log("[TranslationController] ▶ Stage 2: Resolving AI provider...");
      const providerManager = _getAIProviderManager();
      let providerName = "unknown";

      if (providerManager) {
        const info = await providerManager.getProviderInfo();
        providerName = info.name || info.id;
        console.log(`[TranslationController] ✔ Stage 2: Provider resolved → ${providerName} (${info.id})`);
        if (onProgress) onProgress("api_call", `Sending to ${providerName}...`);

        console.log("[TranslationController] ▶ Stage 3: Calling providerManager.translate()...");
        let rawResult;
        try {
          rawResult = await providerManager.translate(cleanText);
        } catch (translateErr) {
          console.error("[TranslationController] ✖ Stage 3: translate() threw:", translateErr);
          console.error("[TranslationController]   Error name:", translateErr.name);
          console.error("[TranslationController]   Error code:", translateErr.code);
          console.error("[TranslationController]   Error message:", translateErr.message);
          throw translateErr; // Re-throw to be caught by outer catch
        }

        console.log("[TranslationController] ✔ Stage 3: translate() returned");
        console.log("[TranslationController]   rawResult type:", typeof rawResult);
        console.log("[TranslationController]   rawResult.gloss:", JSON.stringify(rawResult?.gloss));
        console.log("[TranslationController]   rawResult.motions count:", rawResult?.motions?.length);

        // ── Stage 4: Parse & Validate ──
        console.log("[TranslationController] ▶ Stage 4: Validating ISL structure...");
        if (onProgress) onProgress("parse", "Parsing ISL response...");

        const parser = _getISLParser();
        let validation;
        if (parser) {
          validation = parser.validate(rawResult);
          console.log("[TranslationController]   ISLParser.validate() result:", JSON.stringify({
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
            glossCount: validation.data?.gloss?.length
          }));
        } else {
          console.warn("[TranslationController]   ISLParser not loaded — using basic validation");
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
          provider: providerName,
          inputText: cleanText,
          timestamp: new Date().toISOString()
        };

        if (validation.errors.length > 0) {
          console.warn("[TranslationController] ⚠ Validation had errors:", validation.errors);
          result.success = validation.valid;
        }

        console.log(`[TranslationController] ✔ Stage 4: Done in ${elapsed}s via ${providerName} — ${result.gloss.length} glosses, success=${result.success}`);

        if (onComplete) onComplete(result);
        return result;

      } else {
        // Fallback: try GeminiService directly (backward compatibility)
        console.warn("[TranslationController] ⚠ AIProviderManager not found, trying GeminiService fallback...");
        const geminiService = _resolve("GeminiService");
        if (geminiService) {
          providerName = "Gemini (fallback)";
          if (onProgress) onProgress("api_call", "Sending to Gemini API...");
          const rawResult = await geminiService.translate(cleanText);

          if (onProgress) onProgress("parse", "Parsing ISL response...");
          const parser = _getISLParser();
          const validation = parser ? parser.validate(rawResult) : { valid: true, data: rawResult, errors: [], warnings: [] };
          const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

          const result = {
            success: true,
            gloss: validation.data?.gloss || [],
            motions: validation.data?.motions || [],
            raw: rawResult,
            errors: validation.errors || [],
            warnings: validation.warnings || [],
            elapsed: elapsed,
            provider: providerName,
            inputText: cleanText,
            timestamp: new Date().toISOString()
          };

          if (onComplete) onComplete(result);
          return result;
        }

        console.error("[TranslationController] ✖ No AI provider available");
        throw { code: "SERVICE_UNAVAILABLE", message: "No AI provider available. AIProviderManager and GeminiService are both missing." };
      }

    } catch (error) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.error("[TranslationController] ✖ FAILED after " + elapsed + "s:", error);
      console.error("[TranslationController]   Error type:", error?.constructor?.name || typeof error);
      console.error("[TranslationController]   Error code:", error?.code);
      console.error("[TranslationController]   Error message:", error?.message || String(error));

      const errorResult = {
        success: false,
        gloss: [],
        motions: [],
        raw: null,
        errors: [error.message || error.toString()],
        warnings: [],
        errorCode: error.code || "UNKNOWN",
        elapsed: elapsed,
        provider: "unknown",
        inputText: text,
        timestamp: new Date().toISOString()
      };

      if (onError) onError(errorResult);
      return errorResult;
    }
  }


  /**
   * Process text via the background service worker (for content scripts / popup).
   * Sends a TRANSLATE_TO_ISL message and waits for the response.
   *
   * @param {string} text — English sentence to translate.
   * @param {Object} callbacks — Optional progress callbacks.
   * @returns {Promise<{success, gloss, motions, raw, errors, warnings, elapsed, provider}>}
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
          provider: "unknown",
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
              provider: "unknown",
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
              provider: "unknown",
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

  function _getAIProviderManager() {
    return _resolve("AIProviderManager");
  }

  function _getISLParser() {
    return _resolve("ISLParser");
  }

  function _resolve(name) {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof self !== "undefined" && self[name]) return self[name];
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
