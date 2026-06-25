/**
 * PROMPT TEMPLATES — engine/prompt-generator/prompt-templates.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Configuration module storing prompt structures customized for video models.
 */

const SignBrowsePromptTemplates = (() => {
  const templates = {
    "google-veo": {
      id: "google-veo",
      name: "Google Veo (Spatial & Kinematic)",
      template: "Generate a photorealistic, high-definition 4K video of an {ethnicity} {gender} sign language interpreter performing. The interpreter is {name}, wearing {clothing}. The background is {background}. Framing is {framing}, shot from a {camera}. Lighting is {lighting}. The presentation style is {style}. The interpreter must sign the following Indian Sign Language (ISL) gloss sequence: \"{gloss}\". Ensure all hand configurations, finger positions, and facial expressions are perfectly sharp and accurate in every frame. Educational instructional video loop."
    },
    "runway-gen3": {
      id: "runway-gen3",
      name: "Runway Gen-3 Alpha (High Motion)",
      template: "Photorealistic 4K resolution. Waist-up medium shot of an {ethnicity} {gender} signer named {name} translating sign language in front of {background}. The signer wears {clothing}. Shot from a {camera} with {lighting} and a {style}. The signer performs this exact Indian Sign Language (ISL) gloss: \"{gloss}\". Perfect hand configuration, fluid arm movement, no morphing artifacts, high temporal consistency, 60fps."
    },
    "luma-dream-machine": {
      id: "luma-dream-machine",
      name: "Luma Dream Machine (Cinematic)",
      template: "Cinematic, hyper-realistic video of a {ethnicity} {gender} sign language interpreter named {name}. The interpreter wears {clothing} in front of {background}. Shot from a {camera}, {framing}. Lighting is {lighting}. Style is {style}. The interpreter signs the ISL gloss sequence: \"{gloss}\". Smooth hand movements, highly detailed fingers, arms, and facial expressions. Professional instructional quality."
    },
    "kling-ai": {
      id: "kling-ai",
      name: "Kling AI (High Consistency)",
      template: "A realistic and highly detailed sign language instruction video. Subject: an {ethnicity} {gender} interpreter named {name} wearing {clothing}. Background: {background}. Framing: {framing}. Camera: {camera}. Lighting: {lighting}. Style: {style}. The subject translates the ISL gloss sequence: \"{gloss}\". The gestures are clean, natural, and accurately map to Indian Sign Language. Hand details remain crisp."
    },
    "pika": {
      id: "pika",
      name: "Pika Labs (Clean Loop)",
      template: "High-resolution educational sign language video of an {ethnicity} {gender} interpreter named {name} wearing {clothing}. Setting: {background}. Camera: {camera}. Framing: {framing}. Lighting: {lighting}. Style: {style}. The interpreter performs the ISL gloss string: \"{gloss}\". Clear details, seamless loops, accurate handshapes."
    }
  };

  return {
    getTemplate: (id) => templates[id] || templates["google-veo"],
    getTemplates: () => Object.values(templates),
    getTemplateIds: () => Object.keys(templates)
  };
})();

// Expose globally
if (typeof window !== "undefined") {
  window.SignBrowsePromptTemplates = SignBrowsePromptTemplates;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SignBrowsePromptTemplates;
}
