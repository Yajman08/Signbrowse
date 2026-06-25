/**
 * SIGNER PROFILES — engine/prompt-generator/signer-profile.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuration module that stores profiles for AI sign language interpreters.
 * Maintains character consistency across generative video prompt outputs.
 */

const SignBrowseSignerProfiles = (() => {
  const profiles = {
    "aanya": {
      id: "aanya",
      name: "Aanya (Female)",
      gender: "female",
      ethnicity: "Indian",
      clothing: "a traditional royal blue Kurta with gold accents",
      background: "a neutral solid matte-white studio background",
      camera: "static frontal eye-level camera angle",
      framing: "waist-up medium framing, keeping hands, arms, and face fully visible and centered",
      lighting: "soft, professional high-key studio lighting with no harsh shadows",
      style: "clear, friendly, educational, and professional Indian Sign Language interpretation"
    },
    "kabir": {
      id: "kabir",
      name: "Kabir (Male)",
      gender: "male",
      ethnicity: "Indian",
      clothing: "a dark grey linen Nehru jacket over a white mandarin-collar shirt",
      background: "a minimalist light grey studio backdrop",
      camera: "static frontal eye-level camera angle",
      framing: "waist-up medium framing, keeping hands, arms, and face fully visible and centered",
      lighting: "even, soft three-point studio lighting to maximize hand shape clarity",
      style: "precise, professional, clear, and educational Indian Sign Language interpretation"
    }
  };

  return {
    getProfile: (id) => profiles[id] || profiles["aanya"],
    getProfiles: () => Object.values(profiles),
    getProfileIds: () => Object.keys(profiles)
  };
})();

// Expose globally
if (typeof window !== "undefined") {
  window.SignBrowseSignerProfiles = SignBrowseSignerProfiles;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SignBrowseSignerProfiles;
}
