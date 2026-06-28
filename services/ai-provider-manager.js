/**
 * AI PROVIDER MANAGER — services/ai-provider-manager.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages swappable AI providers for ISL translation.
 * Routes translate() calls to the currently selected provider.
 *
 * Supported providers:
 *   - gemini   → GeminiService  (cloud, requires API key)
 *   - ollama   → OllamaService  (local, requires Ollama running)
 *   - groq     → (future)
 *
 * Provider selection is persisted in chrome.storage.local (key: "aiProvider").
 *
 * Public API:
 *   AIProviderManager.translate(text) → Promise<{ gloss, motions }>
 *   AIProviderManager.setProvider(id)
 *   AIProviderManager.getProvider() → Promise<string>
 *   AIProviderManager.getProviderInfo() → { id, name, description, requiresKey }
 *   AIProviderManager.listProviders() → ProviderInfo[]
 */

const AIProviderManager = (() => {

  // ── Provider Registry ──────────────────────────────────────────────────
  const PROVIDERS = {
    gemini: {
      id: "gemini",
      name: "Google Gemini",
      description: "Cloud API · gemini-2.0-flash",
      requiresKey: true,
      icon: "✨"
    },
    ollama: {
      id: "ollama",
      name: "Ollama (Local)",
      description: "Local LLM · llama3.2",
      requiresKey: false,
      icon: "🦙"
    }
    // Future:
    // groq: {
    //   id: "groq",
    //   name: "Groq",
    //   description: "Cloud API · fast inference",
    //   requiresKey: true,
    //   icon: "⚡"
    // }
  };

  // Default provider
  const DEFAULT_PROVIDER = "ollama";

  // In-memory cache
  let _activeProvider = null;


  // ── Provider Selection ─────────────────────────────────────────────────

  /**
   * Gets the currently selected provider ID from storage.
   * @returns {Promise<string>}
   */
  function getProvider() {
    return new Promise((resolve) => {
      if (_activeProvider) {
        resolve(_activeProvider);
        return;
      }
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get("aiProvider", (result) => {
          _activeProvider = result.aiProvider || DEFAULT_PROVIDER;
          resolve(_activeProvider);
        });
      } else {
        _activeProvider = DEFAULT_PROVIDER;
        resolve(_activeProvider);
      }
    });
  }

  /**
   * Sets the active AI provider and persists to storage.
   * @param {string} providerId — "gemini", "ollama", etc.
   * @returns {Promise<void>}
   */
  function setProvider(providerId) {
    return new Promise((resolve) => {
      if (!PROVIDERS[providerId]) {
        console.warn(`[AIProviderManager] Unknown provider "${providerId}", falling back to "${DEFAULT_PROVIDER}".`);
        providerId = DEFAULT_PROVIDER;
      }
      _activeProvider = providerId;
      console.log(`[AIProviderManager] Active provider set to: ${providerId} (${PROVIDERS[providerId].name})`);

      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ aiProvider: providerId }, resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * Returns info about the currently active provider.
   * @returns {Promise<Object>}
   */
  async function getProviderInfo() {
    const id = await getProvider();
    return PROVIDERS[id] || PROVIDERS[DEFAULT_PROVIDER];
  }

  /**
   * Lists all available providers.
   * @returns {Object[]}
   */
  function listProviders() {
    return Object.values(PROVIDERS);
  }

  /**
   * Clears cached provider selection (forces reload from storage).
   */
  function clearCache() {
    _activeProvider = null;
  }


  // ── Translation Router ─────────────────────────────────────────────────

  /**
   * Translates text using the currently selected AI provider.
   * This is the main entry point — the rest of the app calls this
   * instead of GeminiService or OllamaService directly.
   *
   * @param {string} text — English sentence to translate.
   * @returns {Promise<{gloss: string[], motions: object[]}>}
   * @throws {Error} On provider-specific errors.
   */
  async function translate(text) {
    const providerId = await getProvider();
    console.log(`[AIProviderManager] Routing to provider: ${providerId}`);

    switch (providerId) {
      case "gemini": {
        const service = _resolve("GeminiService");
        if (!service) throw new Error("GeminiService module is not loaded.");
        return service.translate(text);
      }

      case "ollama": {
        const service = _resolve("OllamaService");
        if (!service) throw new Error("OllamaService module is not loaded.");
        return service.translate(text);
      }

      // case "groq": { ... }

      default:
        throw new Error(`Unknown AI provider: "${providerId}". Available: ${Object.keys(PROVIDERS).join(", ")}`);
    }
  }


  // ── Helpers ────────────────────────────────────────────────────────────

  /**
   * Resolves a global service by name across contexts.
   * @private
   */
  function _resolve(name) {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof self !== "undefined" && self[name]) return self[name];
    return null;
  }


  // ── Public API ─────────────────────────────────────────────────────────
  return {
    translate,
    getProvider,
    setProvider,
    getProviderInfo,
    listProviders,
    clearCache,
    PROVIDERS,
    DEFAULT_PROVIDER
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.AIProviderManager = AIProviderManager;
}
if (typeof self !== "undefined" && typeof window === "undefined") {
  self.AIProviderManager = AIProviderManager;
}
