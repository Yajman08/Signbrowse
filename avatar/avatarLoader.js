/**
 * AVATAR LOADER — avatar/avatarLoader.js
 * Loads the rigged GLTF/GLB avatar, scales and centers it,
 * and logs structural details.
 */
const AvatarLoader = (() => {

  /**
   * Loads the avatar GLB from the specified path.
   *
   * @param {string} path — Path to the GLB file.
   * @param {THREE.Scene} scene — The Three.js scene to add the avatar to.
   * @param {THREE.PerspectiveCamera} camera — The camera to adjust framing.
   * @returns {Promise<THREE.Group>} — The loaded avatar scene group.
   */
  function load(path, scene, camera) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();

      loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;

          // ── 1. Analyze and Log Structural Details ──
          console.log("Avatar loaded.");

          let meshCount = 0;
          let boneCount = 0;
          let hasArmature = false;

          model.traverse((node) => {
            if (node.isMesh || node.isSkinnedMesh) {
              meshCount++;
            }
            if (node.isBone) {
              boneCount++;
            }
            if (node.name.toLowerCase() === "armature" || node.name.toLowerCase() === "root") {
              hasArmature = true;
            }
          });

          console.log(`Meshes found: ${meshCount}`);
          console.log(`Armature detected: ${hasArmature ? "Yes" : "No"}`);
          console.log(`Bone count: ${boneCount}`);
          console.log(`Animations found: ${gltf.animations ? gltf.animations.length : 0}`);

          // Enable shadows on all meshes
          model.traverse((node) => {
            if (node.isMesh || node.isSkinnedMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });

          // ── 2. Automatically Center and Scale the Avatar ──
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          // Scale the avatar to a standard height of 1.8 units (meters)
          const desiredHeight = 1.8;
          let scale = 1.0;
          if (size.y > 0) {
            scale = desiredHeight / size.y;
          }
          model.scale.setScalar(scale);

          // Center on X and Z, place feet on Y = 0
          // We must recalculate the box after scaling to get accurate bounds
          const scaledBox = new THREE.Box3().setFromObject(model);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
          
          model.position.x = -scaledCenter.x;
          model.position.z = -scaledCenter.z;
          model.position.y = -scaledBox.min.y;

          // ── 3. Position the Camera (Waist Up Framing) ──
          // Waist is roughly at Y = 0.9, Chest at Y = 1.2, Head at Y = 1.6
          // Place camera slightly back and look at chest/head level
          camera.position.set(0, 1.3, 1.2);
          camera.lookAt(0, 1.35, 0);

          // Add to scene
          scene.add(model);

          resolve(model);
        },
        (xhr) => {
          // Progress logging if needed
          if (xhr.total > 0) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            console.log(`Loading avatar: ${pct}%`);
          }
        },
        (error) => {
          console.error("Error loading avatar:", error);
          reject(error);
        }
      );
    });
  }

  return {
    load
  };
})();

// Expose globally
window.AvatarLoader = AvatarLoader;
