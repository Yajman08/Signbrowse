/**
 * AVATAR LIGHTING — avatar/lighting.js
 * Configures ambient and directional lights for the avatar scene.
 */
const AvatarLighting = (() => {
  function setup(scene) {
    // Ambient light for general illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Directional light (main key light) representing sun/spot light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 4, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Subtle fill light from opposite side (purple tint matching theme)
    const fillLight = new THREE.DirectionalLight(0xa89bfe, 0.35);
    fillLight.position.set(-2, 2, 2);
    scene.add(fillLight);

    // Subtle rim light from behind for silhouette definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, 3, -5);
    scene.add(rimLight);
  }

  return {
    setup
  };
})();

// Expose globally
window.AvatarLighting = AvatarLighting;
