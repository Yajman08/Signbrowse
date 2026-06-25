/**
 * PROMPT GENERATOR COORDINATOR — engine/prompt-generator/prompt-generator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central orchestrator for Phase 6. Integrates profiles, templates, building,
 * and simulations. Exposes the window.SignBrowsePromptGenerator API.
 */

const SignBrowsePromptGenerator = (() => {

  /**
   * Generates a compiled generative prompt for a given gloss sequence.
   * @param {string} islGloss - The parsed ISL gloss string.
   * @param {string} signerId - The selected signer profile ID.
   * @param {string} templateId - The selected prompt template ID.
   * @returns {string} The fully compiled text prompt.
   */
  function generate(islGloss, signerId, templateId) {
    // Required Diagnostics Log
    console.log("Generative prompt requested for engine:", templateId);

    const profiles = window.SignBrowseSignerProfiles;
    const templates = window.SignBrowsePromptTemplates;
    const builder = window.SignBrowsePromptBuilder;

    if (!profiles || !templates || !builder) {
      console.warn("[SignBrowse] Prompt generator submodules missing.");
      return islGloss;
    }

    const profile = profiles.getProfile(signerId);
    const template = templates.getTemplate(templateId);

    return builder.build(islGloss, profile, template);
  }

  return {
    generate,
    getProfiles: () => window.SignBrowseSignerProfiles ? window.SignBrowseSignerProfiles.getProfiles() : [],
    getTemplates: () => window.SignBrowsePromptTemplates ? window.SignBrowsePromptTemplates.getTemplates() : [],
    buildPayload: (engineId, prompt) => window.SignBrowseVideoRequest ? window.SignBrowseVideoRequest.buildApiPayload(engineId, prompt) : {},
    submitRequest: (engineId, prompt, gloss, onProgress) => window.SignBrowseVideoRequest
      ? window.SignBrowseVideoRequest.submitVideoRequest(engineId, prompt, gloss, onProgress)
      : Promise.resolve({ status: "error", error: "Video request module not loaded." })
  };
})();

// Expose globally
if (typeof window !== "undefined") {
  window.SignBrowsePromptGenerator = SignBrowsePromptGenerator;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SignBrowsePromptGenerator;
}
