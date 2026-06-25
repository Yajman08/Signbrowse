/**
 * LLM SERVICE — engine/llm/llm-service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Orchestrates LLM communication for motion instruction generation.
 * Contains the core system prompt that instructs the LLM to produce
 * ISL Motion Language JSON from gloss sequences.
 *
 * Public API:
 *   LLMService.setProvider(provider)
 *   LLMService.generateMotionInstructions(glossSequence, context) → Promise<Object>
 *
 * Depends on:
 *   - engine/llm/llm-provider-base.js → LLMProviderBase
 *   - engine/motion/motion-schema.js  → ISLMotionSchema
 */

const LLMService = (() => {

  let activeProvider = null;

  // ─── System Prompt for ISL Motion Planning ────────────────────────────────
  // This is the heart of the LLM-driven approach. It instructs the model
  // to produce structured motion data in ISL Motion Language format.

  const SYSTEM_PROMPT = `You are an expert Indian Sign Language (ISL) motion planner and animator. Your task is to convert ISL gloss sequences into precise, structured motion instructions that drive a 3D avatar.

## Output Format
You MUST return valid JSON conforming to the ISL Motion Language v1.0 schema. Do NOT include any text outside the JSON object.

## Schema Structure
{
  "version": "1.0",
  "glossSequence": "<the input gloss>",
  "signs": [
    {
      "gloss": "<single word>",
      "duration": <seconds, typically 0.8-2.0>,
      "keyframes": [
        {
          "t": <0.0 to 1.0, normalized time within this sign>,
          "rightHand": {
            "shape": "<handshape name>",
            "position": [x, y, z],
            "rotation": [rx, ry, rz],
            "movement": "<movement type>"
          },
          "leftHand": { ... same structure ... },
          "face": {
            "expression": "<expression name>",
            "mouthShape": "<mouth shape>",
            "eyeGaze": [horizontal, vertical]
          },
          "head": {
            "tilt": [pitch, yaw, roll]
          }
        }
      ]
    }
  ]
}

## Coordinate System
- Position is relative to the avatar's torso center at approximately chest height.
- X: left(-) / right(+), range -0.6 to 0.6
- Y: down(0.5) / up(1.6), where 1.0 is roughly shoulder height, 1.4 is head height
- Z: behind(-0.2) / in front(0.4)
- Rotation is Euler angles in degrees: [pitch, yaw, roll]

## Valid Handshapes
FlatB, OpenB, SpreadC, OpenA, Fist, FistThumbUp, FistThumbOut, IndexPoint, IndexHook, IndexMiddle, Pinch, PinchOpen, FlatO, Claw, ILY, Horn, Relaxed

## Valid Facial Expressions
neutral, happy, sad, surprised, questioning, yesno_question, negative, emphasis, thinking, affirm

## Valid Mouth Shapes
closed, open_slight, open_wide, pursed, smile, frown, rounded, teeth_visible, tongue_out, puff_cheeks

## Valid Movement Types
linear, arc, circular, zigzag, bounce, wave, hold, shake, twist

## Important Rules
1. Each sign MUST have at least 2 keyframes (start pose at t=0.0 and end pose at t=1.0).
2. Signs typically use 2-4 keyframes. Complex signs may use up to 6.
3. The first keyframe (t=0.0) is the preparation/starting position.
4. The last keyframe (t=1.0) should naturally transition toward a rest position.
5. Use anatomically plausible positions — hands should not clip through the body.
6. ISL is predominantly a one-handed language for many signs. Use leftHand only when the sign requires both hands.
7. For two-handed signs, both hands should move in coordinated, symmetrical or complementary patterns.
8. Facial expressions and head movements are grammatical markers in ISL — use them meaningfully.
9. Question words should have "questioning" or "yesno_question" facial expression.
10. Negation signs should have "negative" expression with slight head shake.
11. Duration should reflect natural signing speed: simple signs ~0.8s, complex signs ~1.5-2.0s.
12. Ensure smooth, natural-looking motion — avoid abrupt position jumps between consecutive keyframes.`;


  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Sets the active LLM provider.
   * @param {LLMProviderBase} provider
   */
  function setProvider(provider) {
    if (!provider || typeof provider.complete !== "function") {
      throw new Error("[LLMService] Provider must implement complete() method.");
    }
    activeProvider = provider;
    console.log(`[LLMService] Provider set: ${provider.name}`);
  }

  /**
   * Returns the currently active provider.
   * @returns {LLMProviderBase|null}
   */
  function getProvider() {
    return activeProvider;
  }

  /**
   * Generates ISL Motion Language instructions from a gloss sequence.
   *
   * @param {string} glossSequence — ISL gloss (e.g., "TODAY I COLLEGE GO").
   * @param {Object} context — Optional context hints.
   * @param {string} context.originalText — The original English text.
   * @param {string} context.sentiment — Detected sentiment (positive/negative/neutral).
   * @returns {Promise<Object>} — Validated ISL Motion Language JSON.
   */
  async function generateMotionInstructions(glossSequence, context = {}) {
    if (!activeProvider) {
      throw new Error("[LLMService] No LLM provider configured. Call setProvider() first.");
    }

    if (!glossSequence || typeof glossSequence !== "string") {
      throw new Error("[LLMService] glossSequence must be a non-empty string.");
    }

    // Build user prompt with context
    let userPrompt = `Generate ISL Motion Language instructions for the following gloss sequence:\n\n"${glossSequence}"`;

    if (context.originalText) {
      userPrompt += `\n\nOriginal English text: "${context.originalText}"`;
    }
    if (context.sentiment) {
      userPrompt += `\nSentiment: ${context.sentiment}`;
    }

    userPrompt += `\n\nReturn ONLY the JSON object. Each word in the gloss sequence should be a separate sign in the "signs" array.`;

    console.log(`[LLMService] Generating motion for: "${glossSequence}"`);
    const startTime = performance.now();

    try {
      // Call the LLM
      const motionData = await activeProvider.complete(SYSTEM_PROMPT, userPrompt, null);

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`[LLMService] LLM responded in ${elapsed}s`);

      // Validate against schema
      if (typeof ISLMotionSchema !== "undefined") {
        const validation = ISLMotionSchema.validate(motionData);
        if (!validation.valid) {
          console.warn("[LLMService] Motion data validation warnings:", validation.errors);
          // Don't throw — try to use the data anyway with best-effort
          // The motion interpreter will handle missing fields gracefully
        } else {
          console.log("[LLMService] Motion data passed schema validation.");
        }
      }

      return motionData;

    } catch (error) {
      console.error("[LLMService] Motion generation failed:", error);

      // ── Fallback: generate minimal motion data ──
      console.warn("[LLMService] Using fallback motion data.");
      return _generateFallbackMotion(glossSequence);
    }
  }


  /**
   * Generates simple fallback motion data when the LLM fails.
   * Creates a basic gesture for each word in the gloss.
   * @private
   */
  function _generateFallbackMotion(glossSequence) {
    const words = glossSequence.split(/\s+/).filter(w => w.length > 0);

    const signs = words.map(word => ({
      gloss: word,
      duration: 1.0,
      keyframes: [
        {
          t: 0.0,
          rightHand: {
            shape: "Relaxed",
            position: [0.3, 0.9, 0.1],
            rotation: [0, 0, 0],
            movement: "linear"
          },
          leftHand: {
            shape: "Relaxed",
            position: [-0.3, 0.9, 0.1],
            rotation: [0, 0, 0],
            movement: "linear"
          },
          face: { expression: "neutral", mouthShape: "closed", eyeGaze: [0, 0] },
          head: { tilt: [0, 0, 0] }
        },
        {
          t: 0.5,
          rightHand: {
            shape: "FlatB",
            position: [0.25, 1.1, 0.2],
            rotation: [0, 0, -15],
            movement: "linear"
          },
          leftHand: {
            shape: "Relaxed",
            position: [-0.3, 0.9, 0.1],
            rotation: [0, 0, 0],
            movement: "linear"
          },
          face: { expression: "neutral", mouthShape: "open_slight", eyeGaze: [0, 0] },
          head: { tilt: [0, 0, 0] }
        },
        {
          t: 1.0,
          rightHand: {
            shape: "Relaxed",
            position: [0.35, 0.85, 0.05],
            rotation: [0, 0, 0],
            movement: "linear"
          },
          leftHand: {
            shape: "Relaxed",
            position: [-0.35, 0.85, 0.05],
            rotation: [0, 0, 0],
            movement: "linear"
          },
          face: { expression: "neutral", mouthShape: "closed", eyeGaze: [0, 0] },
          head: { tilt: [0, 0, 0] }
        }
      ]
    }));

    return {
      version: "1.0",
      glossSequence: glossSequence,
      signs: signs
    };
  }


  return {
    setProvider,
    getProvider,
    generateMotionInstructions,
    SYSTEM_PROMPT  // Exposed for research inspection
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.LLMService = LLMService;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = LLMService;
}
