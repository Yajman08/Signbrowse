/**
 * SIGNBROWSE GESTURE LIBRARY — avatar/gestureLibrary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * A collection of reusable, modular sign language gestures built on top
 * of the low-level AvatarController bone animation primitives.
 *
 * Every gesture returns a Promise, allowing them to be chained sequentially.
 */
const SignBrowseGestureLibrary = (() => {

  /**
   * Helper to wait for a specified duration (useful for chaining promises).
   */
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 1. pointToSelf()
   * Raises the right arm, points the hand toward the chest,
   * and rotates the wrist naturally.
   */
  async function pointToSelf() {
    console.log("[GestureLibrary] Point to self");
    
    // Get original rotations
    const shoulder = AvatarController.getBone("RightShoulder");
    const arm = AvatarController.getBone("RightArm");
    const forearm = AvatarController.getBone("RightForeArm");
    const hand = AvatarController.getBone("RightHand");

    if (!shoulder || !arm || !forearm || !hand) return;

    const origShoulder = AvatarController.getOriginalRotation(shoulder.name);
    const origArm = AvatarController.getOriginalRotation(arm.name);
    const origForearm = AvatarController.getOriginalRotation(forearm.name);
    const origHand = AvatarController.getOriginalRotation(hand.name);

    // Point to chest pose
    const shoulderTarget = { x: origShoulder.x, y: origShoulder.y, z: origShoulder.z + THREE.MathUtils.degToRad(-5) };
    const armTarget = { x: origArm.x + THREE.MathUtils.degToRad(30), y: origArm.y - THREE.MathUtils.degToRad(20), z: origArm.z + THREE.MathUtils.degToRad(-35) };
    const forearmTarget = { x: origForearm.x, y: origForearm.y + THREE.MathUtils.degToRad(75), z: origForearm.z };
    const handTarget = { x: origHand.x, y: origHand.y - THREE.MathUtils.degToRad(40), z: origHand.z };

    // Finger pointing shape (close fist but keep index extended)
    closeFistFingerBones(800);
    // Extend index finger
    extendFingerBones("Index", 800);

    // Animate arm joints
    AvatarController.animateBone(shoulder.name, shoulderTarget, 800);
    AvatarController.animateBone(arm.name, armTarget, 800);
    AvatarController.animateBone(forearm.name, forearmTarget, 800);
    AvatarController.animateBone(hand.name, handTarget, 800);

    await wait(800);
  }

  /**
   * 2. openPalm()
   * Opens all fingers of the right hand.
   */
  async function openPalm() {
    console.log("[GestureLibrary] Open palm");
    extendFingerBones("Thumb", 500);
    extendFingerBones("Index", 500);
    extendFingerBones("Middle", 500);
    extendFingerBones("Ring", 500);
    extendFingerBones("Pinky", 500);
    await wait(500);
  }

  /**
   * 3. closeFist()
   * Curls every finger of the right hand smoothly.
   */
  async function closeFist() {
    console.log("[GestureLibrary] Close fist");
    closeFistFingerBones(500);
    await wait(500);
  }

  /**
   * 4. moveForward()
   * Moves the right hand forward (push gesture).
   */
  async function moveForward() {
    console.log("[GestureLibrary] Move forward");

    const arm = AvatarController.getBone("RightArm");
    const forearm = AvatarController.getBone("RightForeArm");
    const hand = AvatarController.getBone("RightHand");

    if (!arm || !forearm || !hand) return;

    const origArm = AvatarController.getOriginalRotation(arm.name);
    const origForearm = AvatarController.getOriginalRotation(forearm.name);
    const origHand = AvatarController.getOriginalRotation(hand.name);

    // Push forward pose
    const armTarget = { x: origArm.x + THREE.MathUtils.degToRad(45), y: origArm.y, z: origArm.z + THREE.MathUtils.degToRad(-25) };
    const forearmTarget = { x: origForearm.x, y: origForearm.y + THREE.MathUtils.degToRad(15), z: origForearm.z };
    const handTarget = { x: origHand.x + THREE.MathUtils.degToRad(-20), y: origHand.y, z: origHand.z };

    AvatarController.animateBone(arm.name, armTarget, 600);
    AvatarController.animateBone(forearm.name, forearmTarget, 600);
    AvatarController.animateBone(hand.name, handTarget, 600);

    await wait(600);
  }

  /**
   * 5. hello()
   * Raises right hand and waves twice.
   */
  async function hello() {
    console.log("[GestureLibrary] Hello (Wave)");

    const arm = AvatarController.getBone("RightArm");
    const forearm = AvatarController.getBone("RightForeArm");
    const hand = AvatarController.getBone("RightHand");

    if (!arm || !forearm || !hand) return;

    const origArm = AvatarController.getOriginalRotation(arm.name);
    const origForearm = AvatarController.getOriginalRotation(forearm.name);
    const origHand = AvatarController.getOriginalRotation(hand.name);

    // Raise hand position
    const armRaise = { x: origArm.x + THREE.MathUtils.degToRad(30), y: origArm.y, z: origArm.z + THREE.MathUtils.degToRad(-75) };
    const forearmRaise = { x: origForearm.x, y: origForearm.y + THREE.MathUtils.degToRad(90), z: origForearm.z };

    // Raise arm and open palm
    AvatarController.animateBone(arm.name, armRaise, 500);
    AvatarController.animateBone(forearm.name, forearmRaise, 500);
    openPalm();

    await wait(500);

    // Wave 1: Right
    AvatarController.animateBone(hand.name, { x: origHand.x, y: origHand.y, z: origHand.z + THREE.MathUtils.degToRad(-25) }, 200);
    await wait(200);

    // Wave 2: Left
    AvatarController.animateBone(hand.name, { x: origHand.x, y: origHand.y, z: origHand.z + THREE.MathUtils.degToRad(25) }, 200);
    await wait(200);

    // Wave 3: Right
    AvatarController.animateBone(hand.name, { x: origHand.x, y: origHand.y, z: origHand.z + THREE.MathUtils.degToRad(-25) }, 200);
    await wait(200);

    // Wave 4: Center
    AvatarController.animateBone(hand.name, { x: origHand.x, y: origHand.y, z: origHand.z }, 200);
    await wait(200);
  }

  /**
   * 6. yes()
   * Head nod (yes).
   */
  async function yes() {
    console.log("[GestureLibrary] Yes (Nod)");
    const head = AvatarController.getBone("Head");
    if (!head) return;

    const origHead = AvatarController.getOriginalRotation(head.name);

    // Nod down
    AvatarController.animateBone(head.name, { x: origHead.x + THREE.MathUtils.degToRad(15), y: origHead.y, z: origHead.z }, 300);
    await wait(300);

    // Nod up
    AvatarController.animateBone(head.name, { x: origHead.x + THREE.MathUtils.degToRad(-5), y: origHead.y, z: origHead.z }, 300);
    await wait(300);

    // Nod down
    AvatarController.animateBone(head.name, { x: origHead.x + THREE.MathUtils.degToRad(15), y: origHead.y, z: origHead.z }, 300);
    await wait(300);

    // Return to center
    AvatarController.animateBone(head.name, { x: origHead.x, y: origHead.y, z: origHead.z }, 300);
    await wait(300);
  }

  /**
   * 7. no()
   * Head shake (no).
   */
  async function no() {
    console.log("[GestureLibrary] No (Shake)");
    const head = AvatarController.getBone("Head");
    if (!head) return;

    const origHead = AvatarController.getOriginalRotation(head.name);

    // Shake left
    AvatarController.animateBone(head.name, { x: origHead.x, y: origHead.y + THREE.MathUtils.degToRad(20), z: origHead.z }, 250);
    await wait(250);

    // Shake right
    AvatarController.animateBone(head.name, { x: origHead.x, y: origHead.y + THREE.MathUtils.degToRad(-20), z: origHead.z }, 250);
    await wait(250);

    // Shake left
    AvatarController.animateBone(head.name, { x: origHead.x, y: origHead.y + THREE.MathUtils.degToRad(20), z: origHead.z }, 250);
    await wait(250);

    // Return to center
    AvatarController.animateBone(head.name, { x: origHead.x, y: origHead.y, z: origHead.z }, 250);
    await wait(250);
  }

  /**
   * 8. reset()
   * Returns every bone to its default pose smoothly.
   */
  async function reset(durationMs = 500) {
    console.log("[GestureLibrary] Reset to T-Pose");
    const bones = AvatarController.listBones();
    bones.forEach(name => {
      const orig = AvatarController.getOriginalRotation(name);
      if (orig) {
        AvatarController.animateBone(name, orig, durationMs);
      }
    });
    await wait(durationMs);
  }

  /**
   * 9. todayGesture()
   * Push right hand down and forward with open palm.
   */
  async function todayGesture() {
    console.log("[GestureLibrary] Today");
    const arm = AvatarController.getBone("RightArm");
    const forearm = AvatarController.getBone("RightForeArm");
    const hand = AvatarController.getBone("RightHand");

    if (!arm || !forearm || !hand) return;

    const origArm = AvatarController.getOriginalRotation(arm.name);
    const origForearm = AvatarController.getOriginalRotation(forearm.name);
    const origHand = AvatarController.getOriginalRotation(hand.name);

    const armTarget = { x: origArm.x + THREE.MathUtils.degToRad(30), y: origArm.y, z: origArm.z + THREE.MathUtils.degToRad(-30) };
    const forearmTarget = { x: origForearm.x, y: origForearm.y + THREE.MathUtils.degToRad(45), z: origForearm.z };
    const handTarget = { x: origHand.x + THREE.MathUtils.degToRad(-15), y: origHand.y, z: origHand.z };

    openPalm();
    AvatarController.animateBone(arm.name, armTarget, 600);
    AvatarController.animateBone(forearm.name, forearmTarget, 600);
    AvatarController.animateBone(hand.name, handTarget, 600);

    await wait(600);
  }

  /**
   * 10. collegeGesture()
   * Bring hand near chest/left shoulder and tap twice.
   */
  async function collegeGesture() {
    console.log("[GestureLibrary] College (Tap)");
    const arm = AvatarController.getBone("RightArm");
    const forearm = AvatarController.getBone("RightForeArm");
    const hand = AvatarController.getBone("RightHand");

    if (!arm || !forearm || !hand) return;

    const origArm = AvatarController.getOriginalRotation(arm.name);
    const origForearm = AvatarController.getOriginalRotation(forearm.name);
    const origHand = AvatarController.getOriginalRotation(hand.name);

    // Bring hand to chest
    const armTarget = { x: origArm.x + THREE.MathUtils.degToRad(40), y: origArm.y - THREE.MathUtils.degToRad(30), z: origArm.z + THREE.MathUtils.degToRad(-45) };
    const forearmTarget = { x: origForearm.x, y: origForearm.y + THREE.MathUtils.degToRad(85), z: origForearm.z };

    closeFistFingerBones(300);
    AvatarController.animateBone(arm.name, armTarget, 300);
    AvatarController.animateBone(forearm.name, forearmTarget, 300);
    await wait(300);

    // Tap 1
    AvatarController.animateBone(hand.name, { x: origHand.x + THREE.MathUtils.degToRad(20), y: origHand.y, z: origHand.z }, 150);
    await wait(150);
    AvatarController.animateBone(hand.name, { x: origHand.x, y: origHand.y, z: origHand.z }, 150);
    await wait(150);

    // Tap 2
    AvatarController.animateBone(hand.name, { x: origHand.x + THREE.MathUtils.degToRad(20), y: origHand.y, z: origHand.z }, 150);
    await wait(150);
    AvatarController.animateBone(hand.name, { x: origHand.x, y: origHand.y, z: origHand.z }, 150);
    await wait(150);
  }

  // ─── Internal Helper Functions for Finger Control ──────────────────────────

  /**
   * Extends the joints of a specific finger.
   */
  function extendFingerBones(fingerPrefix, durationMs) {
    // Fingers typically have joints 1, 2, 3
    for (let j = 1; j <= 3; j++) {
      const boneName = `RightHand${fingerPrefix}${j}`;
      const orig = AvatarController.getOriginalRotation(boneName);
      if (orig) {
        AvatarController.animateBone(boneName, orig, durationMs);
      }
    }
  }

  /**
   * Curls all finger joints to form a closed fist.
   */
  function closeFistFingerBones(durationMs) {
    const fingers = ["Index", "Middle", "Ring", "Pinky"];
    
    // Curl index, middle, ring, pinky
    fingers.forEach(prefix => {
      for (let j = 1; j <= 3; j++) {
        const boneName = `RightHand${prefix}${j}`;
        const bone = AvatarController.getBone(boneName);
        if (bone) {
          const orig = AvatarController.getOriginalRotation(boneName);
          // Bend around Z axis (standard Mixamo finger bending axis)
          const bendRad = THREE.MathUtils.degToRad(-75);
          AvatarController.animateBone(boneName, {
            x: orig.x,
            y: orig.y,
            z: orig.z + bendRad
          }, durationMs);
        }
      }
    });

    // Curl Thumb
    const thumb1 = `RightHandThumb1`;
    const thumb2 = `RightHandThumb2`;
    const thumb3 = `RightHandThumb3`;

    if (AvatarController.getBone(thumb1)) {
      const orig1 = AvatarController.getOriginalRotation(thumb1);
      AvatarController.animateBone(thumb1, { x: orig1.x, y: orig1.y + THREE.MathUtils.degToRad(-30), z: orig1.z }, durationMs);
    }
    if (AvatarController.getBone(thumb2)) {
      const orig2 = AvatarController.getOriginalRotation(thumb2);
      AvatarController.animateBone(thumb2, { x: orig2.x, y: orig2.y + THREE.MathUtils.degToRad(-30), z: orig2.z }, durationMs);
    }
  }

  // ─── Diagnostic Tests ───

  async function testHead() {
    const head = AvatarController.getBone("Head");
    if (!head) return;
    const orig = AvatarController.getOriginalRotation(head.name);
    
    const rad20 = THREE.MathUtils.degToRad(20);
    // Rotate head 20 degrees left (on Y axis)
    AvatarController.animateBone(head.name, { x: orig.x, y: orig.y + rad20, z: orig.z }, 1000);
    await wait(2000);
    AvatarController.animateBone(head.name, { x: orig.x, y: orig.y, z: orig.z }, 1000);
    await wait(1000);
  }

  async function testRightArm() {
    const shoulder = AvatarController.getBone("RightShoulder");
    const arm = AvatarController.getBone("RightArm");
    const forearm = AvatarController.getBone("RightForeArm");

    if (!shoulder || !arm || !forearm) return;

    const origShoulder = AvatarController.getOriginalRotation(shoulder.name);
    const origArm = AvatarController.getOriginalRotation(arm.name);
    const origForearm = AvatarController.getOriginalRotation(forearm.name);

    // Raise arm
    AvatarController.animateBone(shoulder.name, { x: origShoulder.x, y: origShoulder.y, z: origShoulder.z + THREE.MathUtils.degToRad(-10) }, 1000);
    AvatarController.animateBone(arm.name, { x: origArm.x, y: origArm.y, z: origArm.z + THREE.MathUtils.degToRad(-75) }, 1000);
    AvatarController.animateBone(forearm.name, { x: origForearm.x, y: origForearm.y + THREE.MathUtils.degToRad(30), z: origForearm.z }, 1000);

    await wait(3000);

    // Return
    AvatarController.animateBone(shoulder.name, { x: origShoulder.x, y: origShoulder.y, z: origShoulder.z }, 1000);
    AvatarController.animateBone(arm.name, { x: origArm.x, y: origArm.y, z: origArm.z }, 1000);
    AvatarController.animateBone(forearm.name, { x: origForearm.x, y: origForearm.y, z: origForearm.z }, 1000);
    await wait(1000);
  }

  async function testRightHand() {
    const hand = AvatarController.getBone("RightHand");
    const thumb = AvatarController.getBone("RightHandThumb1");
    const index = AvatarController.getBone("RightHandIndex1");

    if (!hand || !thumb || !index) return;

    const origHand = AvatarController.getOriginalRotation(hand.name);
    const origThumb = AvatarController.getOriginalRotation(thumb.name);
    const origIndex = AvatarController.getOriginalRotation(index.name);

    // Move
    AvatarController.animateBone(hand.name, { x: origHand.x + THREE.MathUtils.degToRad(25), y: origHand.y, z: origHand.z }, 1000);
    AvatarController.animateBone(thumb.name, { x: origThumb.x, y: origThumb.y + THREE.MathUtils.degToRad(-30), z: origThumb.z }, 1000);
    AvatarController.animateBone(index.name, { x: origIndex.x, y: origIndex.y, z: origIndex.z + THREE.MathUtils.degToRad(-45) }, 1000);

    await wait(2000);

    // Return
    AvatarController.animateBone(hand.name, { x: origHand.x, y: origHand.y, z: origHand.z }, 1000);
    AvatarController.animateBone(thumb.name, { x: origThumb.x, y: origThumb.y, z: origThumb.z }, 1000);
    AvatarController.animateBone(index.name, { x: origIndex.x, y: origIndex.y, z: origIndex.z }, 1000);
    await wait(1000);
  }

  return {
    pointToSelf,
    openPalm,
    closeFist,
    moveForward,
    hello,
    yes,
    no,
    reset,
    todayGesture,
    collegeGesture,
    testHead,
    testRightArm,
    testRightHand
  };
})();

// Expose globally
window.SignBrowseGestureLibrary = SignBrowseGestureLibrary;

const gltfLoader = new THREE.GLTFLoader();
const animationCache = {};

/**
 * Normalizes animation track names so they target bone names directly.
 * Cleans up hierarchical prefixes like "metarig/" or "Armature/".
 */
function normalizeAnimationTracks(clip, model) {
  if (!clip || !clip.tracks) return clip;
  
  clip.tracks.forEach(track => {
    const parts = track.name.split('.');
    let path = parts[0];
    const property = parts[1];
    
    // Clean up any path separators (e.g. "metarig/shoulderR" -> "shoulderR")
    if (path.includes('/')) {
      const pathParts = path.split('/');
      const boneName = pathParts[pathParts.length - 1];
      track.name = `${boneName}.${property}`;
    }
  });
  return clip;
}

/**
 * Loads and plays a GLB animation dynamically, falling back to manual gestures if unavailable.
 * Returns a Promise that resolves when the animation is finished playing.
 */
window.playAnimation = async function(word) {
  const normWord = word.toLowerCase().trim();
  console.log(`[SignBrowse Animation Engine] playAnimation: "${normWord}"`);

  try {
    let clip = animationCache[normWord];
    if (!clip) {
      const url = chrome.runtime.getURL(`assets/animations/${normWord}.glb`);
      console.log(`[SignBrowse Animation Engine] Loading GLB animation: ${url}`);
      
      const gltf = await new Promise((resolve, reject) => {
        gltfLoader.load(url, resolve, undefined, reject);
      });
      
      if (gltf.animations && gltf.animations.length > 0) {
        clip = gltf.animations[0];
        const avatarModel = window.AvatarController ? window.AvatarController.getAvatarModel() : null;
        clip = normalizeAnimationTracks(clip, avatarModel);
        animationCache[normWord] = clip;
      } else {
        throw new Error("No animations found in GLB file.");
      }
    }

    if (clip) {
      const mixer = window.AvatarController ? window.AvatarController.getMixer() : null;
      const avatarModel = window.AvatarController ? window.AvatarController.getAvatarModel() : null;
      
      if (mixer && avatarModel) {
        // Stop any active procedural bone transitions or mixer actions
        mixer.stopAllAction();
        
        const action = mixer.clipAction(clip);
        action.reset();
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
        action.play();
        
        console.log(`[SignBrowse Animation Engine] Playing GLB animation for "${normWord}" (${clip.duration.toFixed(2)}s)`);
        
        // Wait for the duration of the clip
        await new Promise(resolve => setTimeout(resolve, clip.duration * 1000));
        action.stop();
        return;
      }
    }
  } catch (err) {
    console.warn(`[SignBrowse Animation Engine] GLB animation not found or failed for "${normWord}":`, err.message || err);
  }

  // Fallback to gestureLibrary if GLB is not available or failed
  console.log(`[SignBrowse Animation Engine] Falling back to gestureLibrary for "${normWord}"`);
  
  let gestureName = normWord;
  // Map standard glosses to their respective custom gesture names
  if (normWord === "i" || normWord === "self") gestureName = "pointToSelf";
  else if (normWord === "go") gestureName = "moveForward";
  else if (normWord === "today") gestureName = "todayGesture";
  else if (normWord === "college") gestureName = "collegeGesture";

  if (SignBrowseGestureLibrary[gestureName]) {
    await SignBrowseGestureLibrary[gestureName]();
  } else {
    console.warn(`[SignBrowse Animation Engine] No gesture or GLB found for word: "${word}"`);
    // Wait standard delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};

/**
 * Global playGesture(name) wrapper.
 * Links to the new playAnimation method.
 */
window.playGesture = function(name) {
  return window.playAnimation(name);
};

