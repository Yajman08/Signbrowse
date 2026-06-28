/**
 * AVATAR CONTROLLER — avatar/avatarController.js
 * Orchestrates the Three.js lifecycle: initialization, loading,
 * rendering, and slow rotation.
 */
const AvatarController = (() => {
  let scene = null;
  let camera = null;
  let renderer = null;
  let avatarModel = null;
  let isAnimating = false;

  /**
   * Initializes the 3D avatar scene and loads the avatar model.
   */
  async function initializeAvatar() {
    console.log("[AvatarController] Initializing avatar rendering...");

    const canvas = document.getElementById("avatar-canvas");
    const loadingOverlay = document.getElementById("avatar-loading");
    const errorOverlay = document.getElementById("avatar-error");

    if (!canvas) {
      console.error("[AvatarController] Canvas element #avatar-canvas not found.");
      return;
    }

    try {
      // Show loading overlay, hide error overlay
      if (loadingOverlay) loadingOverlay.classList.remove("hidden");
      if (errorOverlay) errorOverlay.classList.add("hidden");

      // 1. Initialize core Three.js components
      scene = AvatarScene.getScene();
      camera = AvatarCamera.init(canvas.width, canvas.height);
      renderer = AvatarRenderer.init(canvas);

      // 2. Setup lighting
      AvatarLighting.setup(scene);

      // 3. Resolve the absolute path to the GLB model using Chrome Extension API
      let modelPath = "../assets/avatar.glb";
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
        modelPath = chrome.runtime.getURL("assets/avatar.glb");
      }

      console.log(`[AvatarController] Loading model from: ${modelPath}`);

      // 4. Load the avatar model
      avatarModel = await AvatarLoader.load(modelPath, scene, camera);

      // 5. Hide loading overlay on success
      if (loadingOverlay) loadingOverlay.classList.add("hidden");

      // 6. Start the animation loop if not already running
      if (!isAnimating) {
        isAnimating = true;
        animate();
      }

    } catch (error) {
      console.error("[AvatarController] Initialization failed:", error);
      
      // Hide loading, show error overlay
      if (loadingOverlay) loadingOverlay.classList.add("hidden");
      if (errorOverlay) errorOverlay.classList.remove("hidden");
    }
  }

  /**
   * The main animation loop.
   */
  function animate() {
    if (!isAnimating) return;

    requestAnimationFrame(animate);

    // Rotate the avatar slowly on the Y axis
    if (avatarModel) {
      avatarModel.rotation.y += 0.005; // 0.005 radians per frame (slow and smooth)
    }

    // Render the scene
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  /**
   * Stops the animation loop and cleans up resources (if popup is closed).
   */
  function dispose() {
    isAnimating = false;
    scene = null;
    camera = null;
    renderer = null;
    avatarModel = null;
  }

  return {
    initializeAvatar,
    dispose
  };
})();

// Expose globally
window.initializeAvatar = AvatarController.initializeAvatar;
