/**
 * ISL MOTION LANGUAGE SCHEMA — engine/motion/motion-schema.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Defines the structured intermediate representation between LLM output
 * and avatar animation. This is the core research contribution of SignBrowse v4.
 *
 * The ISL Motion Language (IML) is a JSON schema that describes sign language
 * gestures as a sequence of timed keyframes, each specifying:
 *   - Hand shape (from a defined ISL handshape vocabulary)
 *   - Hand position (3D coordinates relative to avatar torso)
 *   - Hand orientation (Euler angles)
 *   - Facial expression and mouth shape
 *   - Head tilt and eye gaze direction
 *
 * Public API:
 *   ISLMotionSchema.HANDSHAPES         — Set of valid handshape names
 *   ISLMotionSchema.EXPRESSIONS        — Set of valid facial expressions
 *   ISLMotionSchema.MOUTH_SHAPES       — Set of valid mouth shapes
 *   ISLMotionSchema.validate(json)     — Validates motion data, returns {valid, errors}
 *   ISLMotionSchema.createEmptySign()  — Returns a template sign object
 *   ISLMotionSchema.REST_POSE          — Default rest pose keyframe
 */

const ISLMotionSchema = (() => {

  // ─── Schema Version ───────────────────────────────────────────────────────
  const VERSION = "1.0";

  // ─── ISL Handshape Vocabulary ─────────────────────────────────────────────
  // Based on Indian Sign Language handshape classification.
  // Each name maps to a specific finger bone configuration in the avatar.
  const HANDSHAPES = new Set([
    // Core flat/open shapes
    "FlatB",        // All fingers extended, flat palm
    "OpenB",        // Fingers extended, thumb tucked
    "SpreadC",      // Open C-shape, fingers spread
    "OpenA",        // Loose fist with thumb alongside

    // Fist/closed shapes
    "Fist",         // Full closed fist
    "FistThumbUp",  // Fist with thumb extended upward
    "FistThumbOut",  // Fist with thumb extended outward

    // Index pointing shapes
    "IndexPoint",   // Index extended, others closed
    "IndexHook",    // Index bent/hooked, others closed
    "IndexMiddle",  // Index + middle extended (V-shape)

    // Pinch/contact shapes
    "Pinch",        // Thumb and index touching
    "PinchOpen",    // Thumb and index touching, others extended
    "FlatO",        // Fingertips touching thumb (bunched)

    // Special ISL shapes
    "Claw",         // All fingers curled like a claw
    "ILY",          // I-Love-You handshape (thumb, index, pinky out)
    "Horn",         // Index and pinky extended (horn shape)
    "Relaxed",      // Natural relaxed hand at side

    // Fingerspelling support (A-Z mapped shapes)
    "FS_A", "FS_B", "FS_C", "FS_D", "FS_E", "FS_F", "FS_G", "FS_H",
    "FS_I", "FS_J", "FS_K", "FS_L", "FS_M", "FS_N", "FS_O", "FS_P",
    "FS_Q", "FS_R", "FS_S", "FS_T", "FS_U", "FS_V", "FS_W", "FS_X",
    "FS_Y", "FS_Z"
  ]);


  // ─── Facial Expression Vocabulary ─────────────────────────────────────────
  // Non-manual markers (NMMs) are critical in ISL grammar.
  const EXPRESSIONS = new Set([
    "neutral",          // Default resting face
    "happy",            // Slight smile, raised cheeks
    "sad",              // Downturned mouth, lowered brows
    "surprised",        // Raised eyebrows, wide eyes
    "questioning",      // Furrowed brows (WH-question marker)
    "yesno_question",   // Raised eyebrows (yes/no question marker)
    "negative",         // Head shake accompaniment, furrowed brows
    "emphasis",         // Widened eyes, tense expression
    "thinking",         // Eyes looking up/side, slight squint
    "affirm"            // Slight nod accompaniment, relaxed brow
  ]);


  // ─── Mouth Shape Vocabulary ───────────────────────────────────────────────
  // Mouthing is a key visual cue in ISL.
  const MOUTH_SHAPES = new Set([
    "closed",           // Lips together, neutral
    "open_slight",      // Slightly parted
    "open_wide",        // Wide open (emphasis)
    "pursed",           // Lips pushed forward
    "smile",            // Corners up
    "frown",            // Corners down
    "rounded",          // Rounded O-shape
    "teeth_visible",    // Upper teeth showing
    "tongue_out",       // Tongue slightly visible (some signs)
    "puff_cheeks"       // Cheeks puffed (adverbial marker)
  ]);


  // ─── Movement Types ───────────────────────────────────────────────────────
  // Optional tag describing the nature of the motion between keyframes.
  const MOVEMENT_TYPES = new Set([
    "linear",           // Straight line between positions
    "arc",              // Curved path
    "circular",         // Circular/looping motion
    "zigzag",           // Back-and-forth
    "bounce",           // Quick up-down
    "wave",             // Wavelike fluid motion
    "hold",             // No movement, hold position
    "shake",            // Rapid small oscillation
    "twist"             // Wrist rotation
  ]);


  // ─── Default Rest Pose ────────────────────────────────────────────────────
  // The neutral "at rest" position the avatar returns to between signs.
  const REST_POSE = Object.freeze({
    t: 0.0,
    rightHand: {
      shape: "Relaxed",
      position: [0.35, 0.85, 0.05],    // Right side, waist height, slightly forward
      rotation: [0, 0, 0],
      movement: "linear"
    },
    leftHand: {
      shape: "Relaxed",
      position: [-0.35, 0.85, 0.05],    // Left side, waist height, slightly forward
      rotation: [0, 0, 0],
      movement: "linear"
    },
    face: {
      expression: "neutral",
      mouthShape: "closed",
      eyeGaze: [0, 0]                   // [horizontal, vertical] normalized -1 to 1
    },
    head: {
      tilt: [0, 0, 0]                   // [pitch, yaw, roll] in degrees
    }
  });


  // ─── Validation ───────────────────────────────────────────────────────────

  /**
   * Validates an ISL Motion Language JSON object.
   * @param {Object} data — The parsed motion data to validate.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validate(data) {
    const errors = [];

    if (!data || typeof data !== "object") {
      return { valid: false, errors: ["Motion data must be a non-null object."] };
    }

    // Check version
    if (data.version && data.version !== VERSION) {
      errors.push(`Unsupported schema version: "${data.version}" (expected "${VERSION}").`);
    }

    // Check glossSequence
    if (!data.glossSequence || typeof data.glossSequence !== "string") {
      errors.push("Missing or invalid 'glossSequence' (must be a non-empty string).");
    }

    // Check signs array
    if (!Array.isArray(data.signs) || data.signs.length === 0) {
      errors.push("Missing or empty 'signs' array.");
      return { valid: false, errors };
    }

    // Validate each sign
    data.signs.forEach((sign, si) => {
      const prefix = `signs[${si}]`;

      if (!sign.gloss || typeof sign.gloss !== "string") {
        errors.push(`${prefix}: Missing or invalid 'gloss'.`);
      }

      if (typeof sign.duration !== "number" || sign.duration <= 0) {
        errors.push(`${prefix}: 'duration' must be a positive number (got ${sign.duration}).`);
      }

      if (!Array.isArray(sign.keyframes) || sign.keyframes.length === 0) {
        errors.push(`${prefix}: Missing or empty 'keyframes' array.`);
        return;
      }

      // Validate each keyframe
      sign.keyframes.forEach((kf, ki) => {
        const kfPrefix = `${prefix}.keyframes[${ki}]`;
        _validateKeyframe(kf, kfPrefix, errors);
      });
    });

    return { valid: errors.length === 0, errors };
  }


  /**
   * Validates a single keyframe object.
   * @private
   */
  function _validateKeyframe(kf, prefix, errors) {
    // t (time) — required
    if (typeof kf.t !== "number" || kf.t < 0 || kf.t > 1) {
      errors.push(`${prefix}: 't' must be a number between 0.0 and 1.0 (got ${kf.t}).`);
    }

    // Right hand
    if (kf.rightHand) {
      _validateHandData(kf.rightHand, `${prefix}.rightHand`, errors);
    }

    // Left hand
    if (kf.leftHand) {
      _validateHandData(kf.leftHand, `${prefix}.leftHand`, errors);
    }

    // Face
    if (kf.face) {
      const f = kf.face;
      if (f.expression && !EXPRESSIONS.has(f.expression)) {
        errors.push(`${prefix}.face.expression: Unknown expression "${f.expression}".`);
      }
      if (f.mouthShape && !MOUTH_SHAPES.has(f.mouthShape)) {
        errors.push(`${prefix}.face.mouthShape: Unknown mouth shape "${f.mouthShape}".`);
      }
      if (f.eyeGaze) {
        if (!Array.isArray(f.eyeGaze) || f.eyeGaze.length !== 2) {
          errors.push(`${prefix}.face.eyeGaze: Must be [horizontal, vertical] array.`);
        }
      }
    }

    // Head
    if (kf.head) {
      if (kf.head.tilt) {
        if (!Array.isArray(kf.head.tilt) || kf.head.tilt.length !== 3) {
          errors.push(`${prefix}.head.tilt: Must be [pitch, yaw, roll] array.`);
        }
      }
    }
  }


  /**
   * Validates hand data within a keyframe.
   * @private
   */
  function _validateHandData(hand, prefix, errors) {
    if (hand.shape && !HANDSHAPES.has(hand.shape)) {
      errors.push(`${prefix}.shape: Unknown handshape "${hand.shape}".`);
    }

    if (hand.position) {
      if (!Array.isArray(hand.position) || hand.position.length !== 3) {
        errors.push(`${prefix}.position: Must be [x, y, z] array.`);
      } else {
        hand.position.forEach((v, i) => {
          if (typeof v !== "number") {
            errors.push(`${prefix}.position[${i}]: Must be a number.`);
          }
        });
      }
    }

    if (hand.rotation) {
      if (!Array.isArray(hand.rotation) || hand.rotation.length !== 3) {
        errors.push(`${prefix}.rotation: Must be [x, y, z] Euler angles array.`);
      }
    }

    if (hand.movement && !MOVEMENT_TYPES.has(hand.movement)) {
      errors.push(`${prefix}.movement: Unknown movement type "${hand.movement}".`);
    }
  }


  // ─── Helper: Create Empty Sign Template ───────────────────────────────────

  /**
   * Returns a template sign object with a single rest-pose keyframe.
   * @param {string} gloss — The ISL gloss word.
   * @param {number} duration — Duration in seconds.
   * @returns {Object}
   */
  function createEmptySign(gloss = "UNKNOWN", duration = 1.0) {
    return {
      gloss: gloss,
      duration: duration,
      keyframes: [
        JSON.parse(JSON.stringify(REST_POSE))
      ]
    };
  }


  /**
   * Creates a complete empty motion data structure.
   * @param {string} glossSequence — The full ISL gloss sequence.
   * @returns {Object}
   */
  function createEmptyMotionData(glossSequence = "") {
    return {
      version: VERSION,
      glossSequence: glossSequence,
      signs: []
    };
  }


  /**
   * Returns the list of valid handshape names.
   * @returns {string[]}
   */
  function getHandshapeList() {
    return Array.from(HANDSHAPES);
  }


  /**
   * Returns the list of valid facial expression names.
   * @returns {string[]}
   */
  function getExpressionList() {
    return Array.from(EXPRESSIONS);
  }


  // ─── Public API ─────────────────────────────────────────────────────────
  return {
    VERSION,
    HANDSHAPES,
    EXPRESSIONS,
    MOUTH_SHAPES,
    MOVEMENT_TYPES,
    REST_POSE,
    validate,
    createEmptySign,
    createEmptyMotionData,
    getHandshapeList,
    getExpressionList
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.ISLMotionSchema = ISLMotionSchema;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = ISLMotionSchema;
}
