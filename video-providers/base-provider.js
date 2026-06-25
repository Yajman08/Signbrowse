/**
 * BASE VIDEO PROVIDER — video-providers/base-provider.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Abstract class representing a target AI video generation service provider.
 * Implements base properties, interface checks, and shared prompt optimization.
 */

class BaseVideoProvider {
  /**
   * @param {string} apiKey - API key from settings.
   * @param {string} apiBaseUrl - Custom base URL (optional).
   */
  constructor(apiKey, apiBaseUrl) {
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl || "";
  }

  /**
   * Submits a video generation task to the external API.
   * @param {string} prompt - Fully compiled prompt.
   * @param {string} signer - Target signer ID.
   * @returns {Promise<{jobId: string, status: string}>}
   */
  async createJob(prompt, signer) {
    throw new Error("createJob must be implemented by sub-provider class.");
  }

  /**
   * Fetches the current execution status of a task from the API.
   * @param {string} jobId - The tracking ID returned by createJob.
   * @returns {Promise<{status: string, progress: number, videoUrl?: string, error?: string}>}
   */
  async getJobStatus(jobId) {
    throw new Error("getJobStatus must be implemented by sub-provider class.");
  }

  /**
   * Refines a prompt specifically for the target model.
   * @param {string} gloss - The ISL gloss text (e.g. "TODAY I COLLEGE GO").
   * @param {object} signerProfile - Active character parameters.
   * @returns {string} The final optimized prompt string.
   */
  optimizePrompt(gloss, signerProfile) {
    // Default fallback prompt construction
    return `Generate video of signer signing: ${gloss}`;
  }
}

// Expose globally
if (typeof window !== "undefined") {
  window.BaseVideoProvider = BaseVideoProvider;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = BaseVideoProvider;
}
