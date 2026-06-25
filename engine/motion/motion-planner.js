/**
 * MOTION PLANNER — engine/motion/motion-planner.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridges the ISL Grammar Engine output with the LLM Service.
 * Takes raw English text, converts to ISL gloss, then generates
 * motion instructions via the LLM.
 *
 * Also handles:
 *   - Adding smooth transition keyframes between signs
 *   - Ensuring rest-pose bookends for natural animation
 *   - Caching repeated gloss sequences
 *
 * Public API:
 *   MotionPlanner.planFromText(englishText) → Promise<Object>
 *   MotionPlanner.planFromGloss(glossSequence) → Promise<Object>
 *   MotionPlanner.addTransitions(motionData) → Object
 *
 * Depends on:
 *   - engine/grammar.js             → SignBrowseGrammar
 *   - engine/llm/llm-service.js     → LLMService
 *   - engine/motion/motion-schema.js → ISLMotionSchema
 */

const MotionPlanner = (() => {

  // Simple cache for repeated translations
  const motionCache = new Map();
  const MAX_CACHE_SIZE = 50;


  /**
   * Full pipeline: English text → ISL gloss → LLM → motion instructions.
   *
   * @param {string} englishText — Raw English text from the user.
   * @returns {Promise<Object>} — ISL Motion Language JSON with transitions.
   */
  async function planFromText(englishText) {
    if (!englishText || typeof englishText !== "string") {
      throw new Error("[MotionPlanner] Input text must be a non-empty string.");
    }

    console.log(`[MotionPlanner] Input: "${englishText}"`);

    // Step 1: Convert English to ISL gloss using the grammar engine
    let glossSequence = "";
    if (typeof SignBrowseGrammar !== "undefined") {
      glossSequence = SignBrowseGrammar.generateISLSequence(englishText);
      console.log(`[MotionPlanner] ISL Gloss: "${glossSequence}"`);
    } else {
      // Fallback: simple uppercase conversion
      glossSequence = englishText.toUpperCase();
      console.warn("[MotionPlanner] Grammar engine not loaded, using raw text as gloss.");
    }

    if (!glossSequence) {
      throw new Error("[MotionPlanner] Grammar engine produced empty gloss.");
    }

    // Step 2: Generate motion via LLM
    return planFromGloss(glossSequence, { originalText: englishText });
  }


  /**
   * Generate motion instructions from an ISL gloss sequence.
   *
   * @param {string} glossSequence — ISL gloss (e.g., "TODAY I COLLEGE GO").
   * @param {Object} context — Optional context for the LLM.
   * @returns {Promise<Object>} — ISL Motion Language JSON with transitions.
   */
  async function planFromGloss(glossSequence, context = {}) {
    if (!glossSequence || typeof glossSequence !== "string") {
      throw new Error("[MotionPlanner] Gloss sequence must be a non-empty string.");
    }

    // Check cache
    const cacheKey = glossSequence.trim().toUpperCase();
    if (motionCache.has(cacheKey)) {
      console.log("[MotionPlanner] Cache hit — returning cached motion data.");
      return JSON.parse(JSON.stringify(motionCache.get(cacheKey)));
    }

    // Generate via LLM
    console.log(`[MotionPlanner] Requesting LLM motion generation for: "${glossSequence}"`);
    
    let motionData;
    if (typeof LLMService !== "undefined") {
      motionData = await LLMService.generateMotionInstructions(glossSequence, context);
    } else {
      throw new Error("[MotionPlanner] LLMService not loaded.");
    }

    // Add smooth transitions between signs
    motionData = addTransitions(motionData);

    // Cache the result
    if (motionCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = motionCache.keys().next().value;
      motionCache.delete(firstKey);
    }
    motionCache.set(cacheKey, JSON.parse(JSON.stringify(motionData)));

    return motionData;
  }


  /**
   * Adds smooth transition keyframes between signs in the motion data.
   * Ensures the avatar doesn't snap between sign poses.
   *
   * @param {Object} motionData — Raw motion data from LLM.
   * @returns {Object} — Motion data with transition signs inserted.
   */
  function addTransitions(motionData) {
    if (!motionData || !motionData.signs || motionData.signs.length <= 1) {
      return motionData;
    }

    const restPose = typeof ISLMotionSchema !== "undefined"
      ? JSON.parse(JSON.stringify(ISLMotionSchema.REST_POSE))
      : {
          t: 0.0,
          rightHand: { shape: "Relaxed", position: [0.35, 0.85, 0.05], rotation: [0, 0, 0] },
          leftHand: { shape: "Relaxed", position: [-0.35, 0.85, 0.05], rotation: [0, 0, 0] },
          face: { expression: "neutral", mouthShape: "closed", eyeGaze: [0, 0] },
          head: { tilt: [0, 0, 0] }
        };

    const enhancedSigns = [];

    for (let i = 0; i < motionData.signs.length; i++) {
      const sign = motionData.signs[i];

      // Ensure sign has at least start and end keyframes
      if (!sign.keyframes || sign.keyframes.length === 0) {
        sign.keyframes = [
          { ...restPose, t: 0.0 },
          { ...restPose, t: 1.0 }
        ];
      }

      enhancedSigns.push(sign);

      // Add a brief transition "rest" between signs (except after the last one)
      if (i < motionData.signs.length - 1) {
        enhancedSigns.push({
          gloss: "_TRANSITION",
          duration: 0.3,
          keyframes: [
            { ...restPose, t: 0.0 },
            { ...restPose, t: 1.0 }
          ]
        });
      }
    }

    motionData.signs = enhancedSigns;
    return motionData;
  }


  /**
   * Clears the motion cache.
   */
  function clearCache() {
    motionCache.clear();
    console.log("[MotionPlanner] Cache cleared.");
  }


  /**
   * Returns cache statistics.
   * @returns {{ size: number, maxSize: number }}
   */
  function getCacheStats() {
    return {
      size: motionCache.size,
      maxSize: MAX_CACHE_SIZE
    };
  }


  return {
    planFromText,
    planFromGloss,
    addTransitions,
    clearCache,
    getCacheStats
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.MotionPlanner = MotionPlanner;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = MotionPlanner;
}
