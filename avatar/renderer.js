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
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(400, 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Use modern outputColorSpace API (fallback to legacy outputEncoding for older Three.js)
    if ('outputColorSpace' in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
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
