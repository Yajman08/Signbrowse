/**
 * HAND CONTROLLER — engine/avatar/controllers/hand-controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Controls wrist position and arm IK for the 3D avatar.
 * Drives the arm bone chain (shoulder → upper arm → forearm → wrist)
 * to place the hand at the target position from motion keyframes.
 *
 * Uses simple analytical IK (two-bone) for natural arm posing.
 */

const HandController = (() => {

  // Bone references (set during init)
  let bones = {
    rightUpperArm: null,
    rightForeArm: null,
    rightHand: null,
    leftUpperArm: null,
    leftForeArm: null,
    leftHand: null
  };

  // Arm segment lengths (calibrated after model load)
  let armLengths = {
    right: { upper: 0.28, lower: 0.25 },
    left:  { upper: 0.28, lower: 0.25 }
  };

  /**
   * Initializes the controller with bone references from the loaded model.
   * @param {Object} boneMap — Map of bone name → THREE.Bone object.
   */
  function init(boneMap) {
    bones.rightUpperArm = boneMap["RightArm"] || boneMap["mixamorigRightArm"] || null;
    bones.rightForeArm = boneMap["RightForeArm"] || boneMap["mixamorigRightForeArm"] || null;
    bones.rightHand = boneMap["RightHand"] || boneMap["mixamorigRightHand"] || null;
    bones.leftUpperArm = boneMap["LeftArm"] || boneMap["mixamorigLeftArm"] || null;
    bones.leftForeArm = boneMap["LeftForeArm"] || boneMap["mixamorigLeftForeArm"] || null;
    bones.leftHand = boneMap["LeftHand"] || boneMap["mixamorigLeftHand"] || null;

    console.log("[HandController] Initialized with bones:", Object.keys(boneMap).filter(k =>
      k.includes("Arm") || k.includes("Hand")
    ));
  }

  /**
   * Applies hand position and rotation from an interpolated frame.
   *
   * @param {Object} handData — { shape, position: [x,y,z], rotation: [rx,ry,rz] }
   * @param {"right"|"left"} side — Which hand to control.
   * @param {Object} THREE — Three.js reference (for math).
   */
  function applyHandPose(handData, side, THREE) {
    if (!handData || !THREE) return;

    const handBone = side === "right" ? bones.rightHand : bones.leftHand;
    const foreArmBone = side === "right" ? bones.rightForeArm : bones.leftForeArm;
    const upperArmBone = side === "right" ? bones.rightUpperArm : bones.leftUpperArm;

    if (!handBone || !foreArmBone || !upperArmBone) return;

    // Apply wrist rotation from motion data
    if (handData.rotation) {
      const [rx, ry, rz] = handData.rotation;
      handBone.rotation.set(
        THREE.MathUtils.degToRad(rx),
        THREE.MathUtils.degToRad(ry),
        THREE.MathUtils.degToRad(rz)
      );
    }

    // Apply arm pose using simple IK-inspired targeting
    if (handData.position) {
      const [tx, ty, tz] = handData.position;
      _applyArmIK(upperArmBone, foreArmBone, tx, ty, tz, side, THREE);
    }
  }

  /**
   * Simple two-bone IK approximation for arm posing.
   * Instead of full CCD/FABRIK, uses geometric approach to bend the elbow.
   * @private
   */
  function _applyArmIK(upperArm, foreArm, tx, ty, tz, side, THREE) {
    // Convert target from avatar-space coordinates to rough bone rotations
    // tx: left(-)/right(+), ty: height, tz: forward/backward
    const isRight = side === "right";

    // Shoulder pitch: how high the arm is raised (0 = down, PI/2 = horizontal, PI = up)
    // Map ty (0.5-1.6) to shoulder pitch
    const heightNorm = Math.max(0, Math.min(1, (ty - 0.5) / 1.1));
    const shoulderPitch = -Math.PI * 0.1 + heightNorm * Math.PI * 0.8;

    // Shoulder yaw: how far out to the side
    const sideNorm = isRight
      ? Math.max(0, Math.min(1, (tx + 0.1) / 0.7))
      : Math.max(0, Math.min(1, (-tx + 0.1) / 0.7));
    const shoulderYaw = sideNorm * Math.PI * 0.3;

    // Forward reach → shoulder roll and elbow bend
    const forwardNorm = Math.max(0, Math.min(1, (tz + 0.2) / 0.6));
    const elbowBend = Math.PI * 0.2 + (1 - forwardNorm) * Math.PI * 0.6;

    // Apply rotations
    upperArm.rotation.x = -shoulderPitch;
    upperArm.rotation.z = isRight ? -shoulderYaw : shoulderYaw;
    foreArm.rotation.x = -elbowBend;
  }

  /**
   * Resets all arm/hand bones to rest position.
   */
  function reset() {
    Object.values(bones).forEach(bone => {
      if (bone) bone.rotation.set(0, 0, 0);
    });
  }

  return { init, applyHandPose, reset };
})();

// Expose globally
if (typeof window !== "undefined") {
  window.HandController = HandController;
}
