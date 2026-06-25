/**
 * PROMPT BUILDER — engine/prompt-generator/prompt-builder.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Compiles signer profiles, prompt templates, and the active ISL gloss string
 * into a single high-quality video generation prompt.
 */

const SignBrowsePromptBuilder = (() => {

  /**
   * Compiles the dynamic prompt.
   * @param {string} gloss - The restructured ISL gloss sequence.
   * @param {object} profile - The selected signer profile.
   * @param {object} templateObj - The selected prompt template structure.
   * @returns {string} The fully compiled generative prompt.
   */
  function build(gloss, profile, templateObj) {
    if (!gloss) return "";
    
    const activeProfile = profile || {};
    const activeTemplate = templateObj || {};
    const templateStr = activeTemplate.template || "{gloss}";

    return templateStr
      .replace(/{gloss}/g, gloss.toUpperCase().trim())
      .replace(/{name}/g, activeProfile.name ? activeProfile.name.split(" ")[0] : "Aanya")
      .replace(/{gender}/g, activeProfile.gender || "female")
      .replace(/{ethnicity}/g, activeProfile.ethnicity || "Indian")
      .replace(/{clothing}/g, activeProfile.clothing || "a blue Kurta")
      .replace(/{background}/g, activeProfile.background || "a solid grey studio backdrop")
      .replace(/{camera}/g, activeProfile.camera || "frontal eye-level angle")
      .replace(/{framing}/g, activeProfile.framing || "waist-up framing")
      .replace(/{lighting}/g, activeProfile.lighting || "soft studio lighting")
      .replace(/{style}/g, activeProfile.style || "clear educational presentation");
  }

  return {
    build
  };
})();

// Expose globally
if (typeof window !== "undefined") {
  window.SignBrowsePromptBuilder = SignBrowsePromptBuilder;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SignBrowsePromptBuilder;
}
