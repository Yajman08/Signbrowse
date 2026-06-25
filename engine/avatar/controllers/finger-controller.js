/**
 * FINGER CONTROLLER — engine/avatar/controllers/finger-controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Controls individual finger bone rotations for handshape rendering.
 * Maps ISL handshape names (from MotionInterpreter finger presets)
 * to per-finger curl values on the 3D avatar skeleton.
 *
 * Each hand has 15 finger bones (3 joints × 5 fingers):
 *   Thumb:  Proximal, Intermediate, Distal
 *   Index:  Proximal, Intermediate, Distal
 *   Middle: Proximal, Intermediate, Distal
 *   Ring:   Proximal, Intermediate, Distal
 *   Pinky:  Proximal, Intermediate, Distal
 */

const FingerController = (() => {

  // Bone references per hand
  const fingerBones = {
    right: { thumb: [], index: [], middle: [], ring: [], pinky: [] },
    left:  { thumb: [], index: [], middle: [], ring: [], pinky: [] }
  };

  // Mixamo bone name patterns
  const FINGER_BONE_NAMES = {
    thumb:  ["ThumbProximal", "ThumbIntermediate", "ThumbDistal"],
    index:  ["IndexProximal", "IndexIntermediate", "IndexDistal"],
    middle: ["MiddleProximal", "MiddleIntermediate", "MiddleDistal"],
    ring:   ["RingProximal", "RingIntermediate", "RingDistal"],
    pinky:  ["LittleProximal", "LittleIntermediate", "LittleDistal"]
  };

  // Max curl angles per joint type (in radians)
  const MAX_CURL = {
    proximal: Math.PI * 0.45,     // ~80 degrees
    intermediate: Math.PI * 0.5,  // ~90 degrees
    distal: Math.PI * 0.35        // ~63 degrees
  };

  const THUMB_MAX_CURL = {
    proximal: Math.PI * 0.25,
    intermediate: Math.PI * 0.35,
    distal: Math.PI * 0.2
  };


  /**
   * Initializes finger bone references from the loaded model.
   * @param {Object} boneMap — Map of bone name → THREE.Bone.
   */
  function init(boneMap) {
    const sides = ["Right", "Left"];
    const sideKeys = ["right", "left"];

    sides.forEach((sideName, si) => {
      const sideKey = sideKeys[si];

      Object.entries(FINGER_BONE_NAMES).forEach(([finger, jointNames]) => {
        fingerBones[sideKey][finger] = jointNames.map(jointName => {
          const fullName = `${sideName}Hand${jointName}`;
          const mixamoName = `mixamorig${fullName}`;
          return boneMap[fullName] || boneMap[mixamoName] || null;
        });
      });
    });

    // Count found bones
    let foundCount = 0;
    Object.values(fingerBones).forEach(side => {
      Object.values(side).forEach(joints => {
        joints.forEach(bone => { if (bone) foundCount++; });
      });
    });

    console.log(`[FingerController] Initialized: ${foundCount}/30 finger bones mapped.`);
  }


  /**
   * Applies finger curl values from the motion interpreter.
   *
   * @param {Object} fingerPreset — { thumb, index, middle, ring, pinky } curl values (0-1).
   * @param {"right"|"left"} side — Which hand.
   */
  function applyFingerPose(fingerPreset, side) {
    if (!fingerPreset) return;

    const sideBones = fingerBones[side];
    if (!sideBones) return;

    // Apply each finger
    _curlFinger(sideBones.thumb,  fingerPreset.thumb  || 0, true);
    _curlFinger(sideBones.index,  fingerPreset.index  || 0, false);
    _curlFinger(sideBones.middle, fingerPreset.middle || 0, false);
    _curlFinger(sideBones.ring,   fingerPreset.ring   || 0, false);
    _curlFinger(sideBones.pinky,  fingerPreset.pinky  || 0, false);
  }


  /**
   * Curls a single finger to the specified amount.
   * @param {Array} joints — [proximal, intermediate, distal] bones.
   * @param {number} amount — 0 (extended) to 1 (fully closed).
   * @param {boolean} isThumb — Thumb has different max angles.
   * @private
   */
  function _curlFinger(joints, amount, isThumb) {
    if (!joints || joints.length < 3) return;
    amount = Math.max(0, Math.min(1, amount));

    const maxAngles = isThumb ? THUMB_MAX_CURL : MAX_CURL;
    const angleKeys = ["proximal", "intermediate", "distal"];

    joints.forEach((bone, i) => {
      if (!bone) return;
      const maxAngle = maxAngles[angleKeys[i]];
      // Curl is applied on the X axis (flexion/extension)
      bone.rotation.x = amount * maxAngle;
    });
  }


  /**
   * Resets all finger bones to extended (0 curl).
   */
  function reset() {
    Object.values(fingerBones).forEach(side => {
      Object.values(side).forEach(joints => {
        joints.forEach(bone => {
          if (bone) bone.rotation.set(0, 0, 0);
        });
      });
    });
  }


  return { init, applyFingerPose, reset };

})();

// Expose globally
if (typeof window !== "undefined") {
  window.FingerController = FingerController;
}
