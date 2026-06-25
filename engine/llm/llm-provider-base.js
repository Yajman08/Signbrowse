/**
 * LLM PROVIDER BASE — engine/llm/llm-provider-base.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Abstract base class for LLM providers. Allows swapping between
 * Gemini, DeepSeek, Llama, or any future provider without changing
 * the motion planning logic.
 *
 * Subclasses must implement:
 *   complete(systemPrompt, userPrompt, jsonSchema) → Promise<Object>
 */

class LLMProviderBase {
  /**
   * @param {string} apiKey — API key or auth token.
   * @param {Object} config — Provider-specific configuration.
   */
  constructor(apiKey, config = {}) {
    if (new.target === LLMProviderBase) {
      throw new Error("LLMProviderBase is abstract and cannot be instantiated directly.");
    }
    this.apiKey = apiKey || "";
    this.config = config;
  }

  /**
   * Returns the provider name (e.g., "gemini", "deepseek", "llama").
   * @returns {string}
   */
  get name() {
    return "base";
  }

  /**
   * Sends a prompt to the LLM and returns structured JSON output.
   *
   * @param {string} systemPrompt — System-level instruction.
   * @param {string} userPrompt — User-level input.
   * @param {Object|null} jsonSchema — Optional JSON schema to enforce output format.
   * @returns {Promise<Object>} — Parsed JSON response from the LLM.
   */
  async complete(systemPrompt, userPrompt, jsonSchema) {
    throw new Error(`${this.name}: complete() must be implemented by subclass.`);
  }

  /**
   * Validates that the provider has been configured with required credentials.
   * @returns {{ valid: boolean, error: string|null }}
   */
  validateConfig() {
    if (!this.apiKey || this.apiKey === "mock" || this.apiKey.startsWith("mock_")) {
      return { valid: false, error: `${this.name}: API key is missing or invalid.` };
    }
    return { valid: true, error: null };
  }
}

// Expose globally
if (typeof window !== "undefined") {
  window.LLMProviderBase = LLMProviderBase;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = LLMProviderBase;
}
