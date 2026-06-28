/**
 * AVATAR CAMERA — avatar/camera.js
 * Creates and manages the Three.js camera.
 */
const AvatarCamera = (() => {
  let camera = null;

  function init(width = 400, height = 400) {
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // Default position (will be adjusted by loader after model bounds are known)
    camera.position.set(0, 1.2, 1.5);
    return camera;
  }

  function getCamera() {
    if (!camera) {
      return init();
    }
    return camera;
  }

  return {
    init,
    getCamera
  };
})();

// Expose globally
window.AvatarCamera = AvatarCamera;
