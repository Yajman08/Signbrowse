/**
 * AVATAR SCENE — avatar/scene.js
 * Creates and manages the Three.js scene.
 */
const AvatarScene = (() => {
  let scene = null;

  function init() {
    scene = new THREE.Scene();
    // Dark background matching the popup theme
    scene.background = new THREE.Color(0x0f0f1a);
    return scene;
  }

  function getScene() {
    if (!scene) {
      return init();
    }
    return scene;
  }

  return {
    init,
    getScene
  };
})();

// Expose globally
window.AvatarScene = AvatarScene;
