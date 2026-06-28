/**
 * AVATAR RENDERER — avatar/renderer.js
 * Creates and manages the Three.js WebGLRenderer.
 */
const AvatarRenderer = (() => {
  let renderer = null;

  function init(canvas) {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setSize(400, 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    return renderer;
  }

  function getRenderer() {
    return renderer;
  }

  return {
    init,
    getRenderer
  };
})();

// Expose globally
window.AvatarRenderer = AvatarRenderer;
