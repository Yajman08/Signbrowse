/**
 * ISL PARSER — models/isl-parser.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates and normalises the structured ISL JSON response from Gemini.
 * Ensures the data conforms to the expected schema before it reaches the UI
 * or (in future) the Motion Interpreter / Three.js avatar pipeline.
 *
 * Public API:
 *   ISLParser.validate(data) → { valid, data, errors, warnings }
 *   ISLParser.toMotionSchema(data) → ISL Motion Language v1.0 format (future)
 */

const ISLParser = (() => {

  // ── Valid enum values (must stay in sync with gemini-service.js prompt) ─
  const VALID_HAND_SHAPES = [
    "FlatB", "OpenB", "SpreadC", "OpenA", "Fist", "FistThumbUp",
    "FistThumbOut", "IndexPoint", "IndexHook", "IndexMiddle", "Pinch",
    "PinchOpen", "FlatO", "Claw", "ILY", "Horn", "Relaxed", "Fingerspell"
  ];

  const VALID_LOCATIONS = [
    "Neutral", "Forehead", "Chin", "Chest", "Shoulder",
    "Waist", "Side", "AboveHead", "InFront"
  ];

  const VALID_MOVEMENTS = [
    "None", "Forward", "Backward", "Up", "Down", "Left", "Right",
    "Circular", "Arc", "Zigzag", "Shake", "Twist", "Wave", "Tap", "Slide"
  ];

  const VALID_EXPRESSIONS = [
    "Neutral", "Happy", "Sad", "Surprised", "Questioning",
    "Negative", "Emphasis", "Thinking", "Affirm"
  ];

  /**
   * Validates and normalises ISL data from Gemini.
   *
   * @param {Object} data — Raw parsed JSON from Gemini.
   * @returns {{ valid: boolean, data: Object, errors: string[], warnings: string[] }}
   */
  function validate(data) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== "object") {
      return { valid: false, data: null, errors: ["Response is not a valid object."], warnings };
    }

    // ── Validate gloss array ──
    if (!data.gloss) {
      errors.push("Missing 'gloss' array.");
    } else if (!Array.isArray(data.gloss)) {
      errors.push("'gloss' must be an array.");
    } else if (data.gloss.length === 0) {
      errors.push("'gloss' array is empty.");
    } else {
      // Normalise: ensure all entries are uppercase strings
      data.gloss = data.gloss.map((g, i) => {
        if (typeof g !== "string") {
          warnings.push(`gloss[${i}] is not a string, converting.`);
          return String(g).toUpperCase();
        }
        return g.toUpperCase();
      });
    }

    // ── Validate motions array ──
    if (!data.motions) {
      // Create empty motions if gloss exists (graceful degradation)
      if (data.gloss && Array.isArray(data.gloss)) {
        warnings.push("Missing 'motions' array — generating defaults from gloss.");
        data.motions = data.gloss.map(g => _defaultMotion(g));
      } else {
        errors.push("Missing 'motions' array.");
      }
    } else if (!Array.isArray(data.motions)) {
      errors.push("'motions' must be an array.");
    } else {
      // Validate each motion entry
      data.motions = data.motions.map((motion, i) => {
        return _validateMotion(motion, i, warnings);
      });

      // Check gloss-motion count alignment
      if (data.gloss && data.motions.length !== data.gloss.length) {
        warnings.push(`Gloss count (${data.gloss.length}) differs from motions count (${data.motions.length}).`);
      }
    }

    const valid = errors.length === 0;

    if (warnings.length > 0) {
      console.warn("[ISLParser] Validation warnings:", warnings);
    }
    if (!valid) {
      console.error("[ISLParser] Validation errors:", errors);
    }

    return { valid, data, errors, warnings };
  }


  /**
   * Validates a single motion entry, filling defaults for missing fields.
   * @private
   */
  function _validateMotion(motion, index, warnings) {
    if (!motion || typeof motion !== "object") {
      warnings.push(`motions[${index}] is not an object — replacing with default.`);
      return _defaultMotion("UNKNOWN");
    }

    const result = { ...motion };

    // gloss
    if (!result.gloss || typeof result.gloss !== "string") {
      result.gloss = `SIGN_${index + 1}`;
      warnings.push(`motions[${index}].gloss missing — defaulted to "${result.gloss}".`);
    }

    // handShape
    if (!result.handShape) {
      result.handShape = "Relaxed";
      warnings.push(`motions[${index}].handShape missing — defaulted to "Relaxed".`);
    } else if (!VALID_HAND_SHAPES.includes(result.handShape)) {
      warnings.push(`motions[${index}].handShape "${result.handShape}" not in valid set — keeping as-is.`);
    }

    // location
    if (!result.location) {
      result.location = "Neutral";
      warnings.push(`motions[${index}].location missing — defaulted to "Neutral".`);
    } else if (!VALID_LOCATIONS.includes(result.location)) {
      warnings.push(`motions[${index}].location "${result.location}" not in valid set — keeping as-is.`);
    }

    // movement
    if (!result.movement) {
      result.movement = "None";
      warnings.push(`motions[${index}].movement missing — defaulted to "None".`);
    } else if (!VALID_MOVEMENTS.includes(result.movement)) {
      warnings.push(`motions[${index}].movement "${result.movement}" not in valid set — keeping as-is.`);
    }

    // expression
    if (!result.expression) {
      result.expression = "Neutral";
      warnings.push(`motions[${index}].expression missing — defaulted to "Neutral".`);
    } else if (!VALID_EXPRESSIONS.includes(result.expression)) {
      warnings.push(`motions[${index}].expression "${result.expression}" not in valid set — keeping as-is.`);
    }

    // handedness (optional, default "one")
    if (!result.handedness) {
      result.handedness = "one";
    }

    return result;
  }


  /**
   * Creates a default motion entry for a given gloss word.
   * @private
   */
  function _defaultMotion(gloss) {
    return {
      gloss: gloss,
      handShape: "Relaxed",
      location: "Neutral",
      movement: "None",
      expression: "Neutral",
      handedness: "one",
      notes: "Auto-generated default"
    };
  }


  /**
   * Converts validated ISL data to ISL Motion Language v1.0 schema format.
   * This bridges the Gemini response format to the existing motion interpreter.
   *
   * @param {Object} islData — Validated ISL data (from validate()).
   * @returns {Object} — ISL Motion Language v1.0 compatible object.
   */
  function toMotionSchema(islData) {
    if (!islData || !islData.gloss || !islData.motions) {
      return null;
    }

    // Map the simplified motion format to the full keyframe-based format
    // that the existing MotionInterpreter expects
    const signs = islData.motions.map(motion => ({
      gloss: motion.gloss,
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
          t: 1.0,
          rightHand: {
            shape: motion.handShape || "Relaxed",
            position: _locationToPosition(motion.location, "right"),
            rotation: [0, 0, 0],
            movement: (motion.movement || "none").toLowerCase()
          },
          leftHand: {
            shape: motion.handedness === "two" ? (motion.handShape || "Relaxed") : "Relaxed",
            position: motion.handedness === "two" ? _locationToPosition(motion.location, "left") : [-0.3, 0.9, 0.1],
            rotation: [0, 0, 0],
            movement: motion.handedness === "two" ? (motion.movement || "none").toLowerCase() : "linear"
          },
          face: {
            expression: (motion.expression || "neutral").toLowerCase(),
            mouthShape: "closed",
            eyeGaze: [0, 0]
          },
          head: { tilt: [0, 0, 0] }
        }
      ]
    }));

    return {
      version: "1.0",
      glossSequence: islData.gloss.join(" "),
      signs: signs
    };
  }


  /**
   * Maps a location name to approximate 3D coordinates.
   * @private
   */
  function _locationToPosition(location, side) {
    const x = side === "right" ? 0.25 : -0.25;
    const positions = {
      "Neutral":    [x, 1.0, 0.2],
      "Forehead":   [x * 0.5, 1.5, 0.15],
      "Chin":       [x * 0.3, 1.3, 0.2],
      "Chest":      [x * 0.6, 1.0, 0.15],
      "Shoulder":   [x * 1.5, 1.1, 0.05],
      "Waist":      [x, 0.7, 0.15],
      "Side":       [x * 2.0, 0.9, 0.1],
      "AboveHead":  [x * 0.4, 1.6, 0.15],
      "InFront":    [x * 0.5, 1.1, 0.35]
    };
    return positions[location] || positions["Neutral"];
  }


  // ── Public API ─────────────────────────────────────────────────────────
  return {
    validate,
    toMotionSchema,
    VALID_HAND_SHAPES,
    VALID_LOCATIONS,
    VALID_MOVEMENTS,
    VALID_EXPRESSIONS
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.ISLParser = ISLParser;
}
if (typeof self !== "undefined" && typeof window === "undefined") {
  self.ISLParser = ISLParser;
}
