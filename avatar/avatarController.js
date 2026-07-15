/**
 * AVATAR CONTROLLER — avatar/avatarController.js
 * Orchestrates the Three.js lifecycle: initialization, loading,
 * rendering, slow rotation, play/pause controls, reset pose, and live FPS tracking.
 *
 * Implements Phase 4: Reusable Bone Animation Engine with Original Pose Preservation.
 */
const AvatarController = (() => {
  let scene = null;
  let camera = null;
  let renderer = null;
  let avatarModel = null;
  let boneMap = {};
  let mixer = null;
  let animations = [];
  const clock = new THREE.Clock();
  
  // Store the original binding rotations of every bone to preserve the default T-pose
  const originalRotations = {};

  // State variables
  let isAnimating = false;
  let isPaused = false;
  let rotationSpeed = 0.005;

  // FPS tracking variables
  let lastFpsUpdateTime = 0;
  let frameCount = 0;
  let resizeObserver = null;

  // Bone transition animations registry
  const activeTransitions = [];

  /**
   * Initializes the 3D avatar scene and loads the avatar model.
   * Can accept DOM elements directly (useful for content scripts to avoid ID collisions).
   */
  async function initializeAvatar(elements = {}) {
    console.log("[AvatarController] Initializing avatar rendering...");

    // Resolve elements (either passed in or looked up by ID)
    const canvas = elements.canvas || document.getElementById("avatar-canvas");
    const loadingOverlay = elements.loadingOverlay || document.getElementById("avatar-loading");
    const errorOverlay = elements.errorOverlay || document.getElementById("avatar-error");
    const loadedStatus = elements.loadedStatus || document.getElementById("status-avatar-loaded");
    const container = elements.container || canvas?.parentElement;

    if (!canvas) {
      console.error("[AvatarController] Canvas element not found.");
      return;
    }

    try {
      // Show loading overlay, hide error overlay
      if (loadingOverlay) loadingOverlay.classList.remove("sb-hidden", "hidden");
      if (errorOverlay) errorOverlay.classList.add("sb-hidden", "hidden");
      if (loadedStatus) {
        loadedStatus.textContent = "Loading...";
        loadedStatus.className = "status-indicator loading";
      }

      // 1. Initialize core Three.js components
      scene = AvatarScene.getScene();
      camera = AvatarCamera.init(canvas.clientWidth, canvas.clientHeight);
      renderer = AvatarRenderer.init(canvas);

      // Make sure the renderer size matches the actual display size of the canvas
      resizeCanvasToDisplaySize(canvas, container);

      // 2. Setup lighting
      AvatarLighting.setup(scene);

      // 3. Resolve the absolute path to the GLB model using Chrome Extension API
      const avatarUrl = chrome.runtime.getURL("assets/bingo.glb");
      console.log("Avatar URL:", avatarUrl);

      // 4. Remove and dispose of previous avatar if it exists
      if (avatarModel) {
        scene.remove(avatarModel);
        avatarModel.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        avatarModel = null;
        console.log("Avatar removed");
      }

      // Verify no other avatar groups exist in the scene
      const groupCount = scene.children.filter(child => child.type === "Group").length;
      if (groupCount >= 1) {
        console.warn("An avatar group already exists in the scene. Stopping duplicate load.");
        console.log("Scene children count", scene.children.length);
        return;
      }

      // 5. Load the avatar model (will throw if fetch or load fails)
      const loadResult = await AvatarLoader.load(avatarUrl, scene, camera);
      avatarModel = loadResult.model;
      boneMap = loadResult.bones;
      animations = loadResult.animations || [];

      // Initialize AnimationMixer for FBX animations
      mixer = new THREE.AnimationMixer(avatarModel);

      // ── 6. Store the original binding rotations of every bone ──
      Object.keys(boneMap).forEach(name => {
        originalRotations[name] = boneMap[name].rotation.clone();
      });
      console.log(`[AvatarController] Cached original rotations for ${Object.keys(originalRotations).length} bones.`);

      // Add to scene and log
      scene.add(avatarModel);
      console.log("Avatar loaded");
      console.log("Scene children count", scene.children.length);

      // Hide loading overlay on success
      if (loadingOverlay) loadingOverlay.classList.add("sb-hidden", "hidden");
      if (loadedStatus) {
        loadedStatus.textContent = "Loaded";
        loadedStatus.className = "status-indicator online";
      }

      // Start the animation loop if not already running
      isPaused = false;
      if (!isAnimating) {
        isAnimating = true;
        lastFpsUpdateTime = performance.now();
        animate();
      }

      // Setup ResizeObserver for robust container-based responsiveness
      if (container && typeof ResizeObserver !== "undefined") {
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        resizeObserver = new ResizeObserver(() => {
          resizeCanvasToDisplaySize(canvas, container);
        });
        resizeObserver.observe(container);
      } else {
        window.addEventListener("resize", onWindowResize);
      }

    } catch (error) {
      console.error("[AvatarController] Initialization failed:", error);
      
      // Hide loading, show error overlay
      if (loadingOverlay) loadingOverlay.classList.add("sb-hidden", "hidden");
      if (errorOverlay) errorOverlay.classList.remove("sb-hidden", "hidden");
      if (loadedStatus) {
        loadedStatus.textContent = "Error";
        loadedStatus.className = "status-indicator offline";
      }
    }
  }

  /**
   * The main animation loop.
   */
  function animate() {
    if (!isAnimating) return;

    requestAnimationFrame(animate);

    const now = performance.now();
    frameCount++;

    // Update FPS indicator every second if element exists
    if (now >= lastFpsUpdateTime + 1000) {
      const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
      const fpsEl = document.getElementById("status-fps") || document.querySelector(".sb-fps-text");
      if (fpsEl) {
        fpsEl.textContent = `FPS: ${fps}`;
      }
      frameCount = 0;
      lastFpsUpdateTime = now;
    }

    // ── Update Bone Transitions (Easing) ──
    for (let i = activeTransitions.length - 1; i >= 0; i--) {
      const t = activeTransitions[i];
      const elapsed = now - t.startTime;
      const progress = Math.min(elapsed / t.durationMs, 1);

      // Simple ease-in-out interpolation
      const ease = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      t.bone.rotation.x = THREE.MathUtils.lerp(t.startEuler.x, t.targetEuler.x, ease);
      t.bone.rotation.y = THREE.MathUtils.lerp(t.startEuler.y, t.targetEuler.y, ease);
      t.bone.rotation.z = THREE.MathUtils.lerp(t.startEuler.z, t.targetEuler.z, ease);

      if (progress >= 1) {
        activeTransitions.splice(i, 1);
      }
    }

    // Update AnimationMixer if it exists
    if (mixer) {
      mixer.update(clock.getDelta());
    }



    // Render the scene
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  /**
   * Resizes the canvas to match its display size.
   */
  function resizeCanvasToDisplaySize(canvas, container) {
    if (!renderer || !camera) return;
    
    const targetCanvas = canvas || renderer.domElement;
    const width = container ? container.clientWidth : targetCanvas.clientWidth;
    const height = container ? container.clientHeight : targetCanvas.clientHeight;

    if (targetCanvas.width !== width || targetCanvas.height !== height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Handles window resize events (fallback).
   */
  function onWindowResize() {
    if (renderer && camera) {
      resizeCanvasToDisplaySize();
    }
  }

  // ─── Bone Control APIs ─────────────────────────────────────────────────────

  const boneNameMap = {
    "rightshoulder": "shoulderR",
    "leftshoulder": "shoulderL",
    "rightarm": "upperarmR",
    "leftarm": "upperarmL",
    "rightforearm": "forearmR",
    "leftforearm": "forearmL",
    "righthand": "handR",
    "lefthand": "handL",
    "head": "head",
    "neck": "neck",
    "righthandthumb1": "thumb01R",
    "righthandthumb2": "thumb02R",
    "righthandthumb3": "thumb03R",
    "righthandindex1": "index01R",
    "righthandindex2": "index02R",
    "righthandindex3": "index03R",
    "righthandmiddle1": "middle01R",
    "righthandmiddle2": "middle02R",
    "righthandmiddle3": "middle03R",
    "righthandring1": "ring01R",
    "righthandring2": "ring02R",
    "righthandring3": "ring03R",
    "righthandpinky1": "little01R",
    "righthandpinky2": "little02R",
    "righthandpinky3": "little03R",
    "lefthandthumb1": "thumb01L",
    "lefthandthumb2": "thumb02L",
    "lefthandthumb3": "thumb03L",
    "lefthandindex1": "index01L",
    "lefthandindex2": "index02L",
    "lefthandindex3": "index03L",
    "lefthandmiddle1": "middle01L",
    "lefthandmiddle2": "middle02L",
    "lefthandmiddle3": "middle03L",
    "lefthandring1": "ring01L",
    "lefthandring2": "ring02L",
    "lefthandring3": "ring03L",
    "lefthandpinky1": "little01L",
    "lefthandpinky2": "little02L",
    "lefthandpinky3": "little03L"
  };

  /**
   * Gets a bone by its exact name or suffix (case-insensitive).
   * Maps legacy standard names to the current model naming system automatically.
   *
   * @param {string} name — The bone name.
   * @returns {THREE.Bone|null}
   */
  function getBone(name) {
    if (boneMap[name]) return boneMap[name];
    
    let targetName = name.toLowerCase().replace("mixamorig:", "");
    if (boneNameMap[targetName]) {
      targetName = boneNameMap[targetName];
    }

    if (boneMap[targetName]) return boneMap[targetName];
    
    const matchedKey = Object.keys(boneMap).find(key => {
      const lowerKey = key.toLowerCase();
      return lowerKey === targetName || 
             lowerKey.endsWith(":" + targetName) || 
             lowerKey.endsWith(targetName);
    });
    
    return matchedKey ? boneMap[matchedKey] : null;
  }

  /**
   * Gets the cached original binding rotation of a bone by name.
   * @param {string} name
   * @returns {THREE.Euler|null}
   */
  function getOriginalRotation(name) {
    const bone = getBone(name);
    return bone ? (originalRotations[bone.name] || null) : null;
  }

  /**
   * Rotates a bone immediately.
   * @param {string} name — Bone name.
   * @param {number} x — Rotation in radians.
   * @param {number} y — Rotation in radians.
   * @param {number} z — Rotation in radians.
   */
  function rotateBone(name, x, y, z) {
    const bone = getBone(name);
    if (bone) {
      bone.rotation.set(x, y, z);
    } else {
      console.warn(`[AvatarController] Bone "${name}" not found.`);
    }
  }

  /**
   * Smoothly animates a bone to a target rotation over a duration.
   * Reusable, low-level primitive for building high-level gestures.
   *
   * @param {string} name — Bone name.
   * @param {Object} targetRotation — Target rotation object {x, y, z} in radians.
   * @param {number} durationMs — Animation duration in milliseconds.
   */
  function animateBone(name, targetRotation, durationMs) {
    const bone = getBone(name);
    if (!bone) {
      console.warn(`[AvatarController] Cannot animate: bone "${name}" not found.`);
      return;
    }

    const targetEuler = new THREE.Euler(
      targetRotation.x !== undefined ? targetRotation.x : bone.rotation.x,
      targetRotation.y !== undefined ? targetRotation.y : bone.rotation.y,
      targetRotation.z !== undefined ? targetRotation.z : bone.rotation.z
    );

    // Remove any existing transitions for this specific bone
    const existingIndex = activeTransitions.findIndex(t => t.bone === bone);
    if (existingIndex !== -1) {
      activeTransitions.splice(existingIndex, 1);
    }

    activeTransitions.push({
      bone,
      startEuler: bone.rotation.clone(),
      targetEuler,
      startTime: performance.now(),
      durationMs
    });
  }

  /**
   * Resets the avatar's model rotation and all bone rotations to their original binding pose.
   */
  function resetPose() {
    // Clear any active transitions
    activeTransitions.length = 0;

    // Restore original bone rotations
    Object.keys(boneMap).forEach(name => {
      const bone = boneMap[name];
      const original = originalRotations[name];
      if (bone && original) {
        bone.rotation.copy(original);
      }
    });

    // Reset base model rotation
    if (avatarModel) {
      avatarModel.rotation.set(0, 0, 0);
    }
    console.log("[AvatarController] Pose and skeleton reset to original T-pose.");
  }

  /**
   * Returns a list of all bone names in the skeleton.
   * @returns {string[]}
   */
  function listBones() {
    return Object.keys(boneMap);
  }

  // ─── Phase 4: Diagnostic Testing Methods ───────────────────────────────────

  /**
   * Test 1: Rotate Head 20° left. Wait 1 second. Return smoothly.
   */
  function testHead() {
    console.log("[AvatarController] Running Head Test...");
    const headBone = getBone("Head");
    if (!headBone) {
      console.error("[AvatarController] Head bone not found.");
      return;
    }

    // Get original rotation for reference
    const name = headBone.name;
    const original = originalRotations[name] || new THREE.Euler(0, 0, 0);

    const rad20 = THREE.MathUtils.degToRad(20);
    // Rotate head 20 degrees left (on Y axis) relative to its original rotation
    const targetRotation = {
      x: original.x,
      y: original.y + rad20,
      z: original.z
    };

    // Turn head over 1 second
    animateBone(name, targetRotation, 1000);

    // Hold for 1 second, then return smoothly to original rotation over 1 second
    setTimeout(() => {
      animateBone(name, { x: original.x, y: original.y, z: original.z }, 1000);
    }, 2000);
  }

  /**
   * Test 2: Raise the right arm naturally using RightShoulder, RightArm, and RightForeArm.
   * Return after 2 seconds.
   */
  function testRightArm() {
    console.log("[AvatarController] Running Right Arm Test...");
    
    const shoulder = getBone("RightShoulder");
    const arm = getBone("RightArm");
    const forearm = getBone("RightForeArm");

    if (!shoulder || !arm || !forearm) {
      console.error("[AvatarController] One or more arm bones not found.");
      return;
    }

    const origShoulder = originalRotations[shoulder.name] || new THREE.Euler(0, 0, 0);
    const origArm = originalRotations[arm.name] || new THREE.Euler(0, 0, 0);
    const origForearm = originalRotations[forearm.name] || new THREE.Euler(0, 0, 0);

    // Natural arm raise rotations relative to original pose
    const shoulderTarget = {
      x: origShoulder.x,
      y: origShoulder.y,
      z: origShoulder.z + THREE.MathUtils.degToRad(-10)
    };
    const armTarget = {
      x: origArm.x,
      y: origArm.y,
      z: origArm.z + THREE.MathUtils.degToRad(-75)
    };
    const forearmTarget = {
      x: origForearm.x,
      y: origForearm.y + THREE.MathUtils.degToRad(30),
      z: origForearm.z
    };

    // Raise arm over 1 second
    animateBone(shoulder.name, shoulderTarget, 1000);
    animateBone(arm.name, armTarget, 1000);
    animateBone(forearm.name, forearmTarget, 1000);

    // Return after 2 seconds (start at 3000ms) over 1 second
    setTimeout(() => {
      animateBone(shoulder.name, { x: origShoulder.x, y: origShoulder.y, z: origShoulder.z }, 1000);
      animateBone(arm.name, { x: origArm.x, y: origArm.y, z: origArm.z }, 1000);
      animateBone(forearm.name, { x: origForearm.x, y: origForearm.y, z: origForearm.z }, 1000);
    }, 3000);
  }

  /**
   * Test 3: Rotate RightHand, RightHandThumb1, and RightHandIndex1.
   * Return after 1 second.
   */
  function testRightHand() {
    console.log("[AvatarController] Running Right Hand Test...");

    const hand = getBone("RightHand");
    const thumb = getBone("RightHandThumb1");
    const index = getBone("RightHandIndex1");

    if (!hand || !thumb || !index) {
      console.error("[AvatarController] One or more hand/finger bones not found.");
      return;
    }

    const origHand = originalRotations[hand.name] || new THREE.Euler(0, 0, 0);
    const origThumb = originalRotations[thumb.name] || new THREE.Euler(0, 0, 0);
    const origIndex = originalRotations[index.name] || new THREE.Euler(0, 0, 0);

    // Finger flex/move targets relative to original pose
    const handTarget = {
      x: origHand.x + THREE.MathUtils.degToRad(25),
      y: origHand.y,
      z: origHand.z
    };
    const thumbTarget = {
      x: origThumb.x,
      y: origThumb.y + THREE.MathUtils.degToRad(-30),
      z: origThumb.z
    };
    const indexTarget = {
      x: origIndex.x,
      y: origIndex.y,
      z: origIndex.z + THREE.MathUtils.degToRad(-45)
    };

    // Move hand and fingers over 1 second
    animateBone(hand.name, handTarget, 1000);
    animateBone(thumb.name, thumbTarget, 1000);
    animateBone(index.name, indexTarget, 1000);

    // Hold for 1 second, then return over 1 second (start at 2000ms)
    setTimeout(() => {
      animateBone(hand.name, { x: origHand.x, y: origHand.y, z: origHand.z }, 1000);
      animateBone(thumb.name, { x: origThumb.x, y: origThumb.y, z: origThumb.z }, 1000);
      animateBone(index.name, { x: origIndex.x, y: origIndex.y, z: origIndex.z }, 1000);
    }, 2000);
  }

  // ─── Play/Pause Controls ───────────────────────────────────────────────────

  /**
   * Pauses the avatar rotation.
   */
  function pause() {
    isPaused = true;
    console.log("[AvatarController] Rotation paused.");
  }

  /**
   * Resumes the avatar rotation.
   */
  function play() {
    isPaused = false;
    console.log("[AvatarController] Rotation resumed.");
  }

  /**
   * Plays an animation clip embedded in the GLTF model.
   *
   * @param {string} clipName - The name of the animation clip.
   */
  function playAnimation(clipName) {
    if (animations.length === 0) {
      console.log("No animation clips found in bingo.glb.");
      return;
    }
    if (!mixer) {
      console.warn("[AvatarController] Mixer not initialized.");
      return;
    }
    const clip = THREE.AnimationClip.findByName(animations, clipName);
    if (!clip) {
      console.warn(`[AvatarController] Animation clip "${clipName}" not found.`);
      return;
    }
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce);
    action.clampWhenFinished = true;
    action.play();
    console.log(`[AvatarController] Playing clip: ${clipName}`);
  }

  /**
   * Stops the animation loop and cleans up resources.
   */
  function dispose() {
    isAnimating = false;
    activeTransitions.length = 0;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    window.removeEventListener("resize", onWindowResize);
    scene = null;
    camera = null;
    renderer = null;
    avatarModel = null;
    boneMap = {};
    mixer = null;
    // Clear cached rotations
    Object.keys(originalRotations).forEach(key => delete originalRotations[key]);
  }

  return {
    initializeAvatar,
    play,
    pause,
    resetPose,
    getBone,
    getOriginalRotation,
    rotateBone,
    animateBone,
    listBones,
    getMixer: () => mixer,
    getAvatarModel: () => avatarModel,
    playAnimation,
    testHead,
    testRightArm,
    testRightHand,
    dispose
  };
})();

// Expose globally
if (typeof window !== "undefined") {
  window.AvatarController = AvatarController;
  window.initializeAvatar = AvatarController.initializeAvatar;
  window.playAvatar = AvatarController.play;
  window.pauseAvatar = AvatarController.pause;
  window.resetAvatarPose = AvatarController.resetPose;
  window.playAvatarAnimation = AvatarController.playAnimation;
  window.disposeAvatar = AvatarController.dispose;
}
if (typeof self !== "undefined" && typeof window === "undefined") {
  self.AvatarController = AvatarController;
}
