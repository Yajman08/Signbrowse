/**
 * AVATAR LOADER — avatar/avatarLoader.js
 * Loads the rigged GLTF/GLB avatar, scales and centers it,
 * detects the armature, and logs every bone in the skeleton.
 */
const AvatarLoader = (() => {

  /**
   * Loads the avatar GLB from the specified path.
   *
   * @param {string} avatarUrl — Path to the GLB file.
   * @param {THREE.Scene} scene — The Three.js scene to add the avatar to.
   * @param {THREE.PerspectiveCamera} camera — The camera to adjust framing.
   * @returns {Promise<{model: THREE.Group, bones: Object}>} — The loaded model and bone map.
   */
  async function load(avatarUrl, scene, camera) {
    console.log("Loading avatar:", avatarUrl);

    // ── 1. Fetch the file before loading ──
    try {
      const response = await fetch(avatarUrl);
      if (!response.ok) {
        console.error("bingo.glb not found");
        throw new Error(`bingo.glb not found (HTTP status ${response.status})`);
      }
    } catch (fetchErr) {
      console.error("bingo.glb not found");
      throw fetchErr;
    }

    // ── 2. Load the file using GLTFLoader ──
    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();

      loader.load(
        avatarUrl,
        (gltf) => {
          const model = gltf.scene;

          console.log("Avatar Loaded");

          // ── 3. Detect Armature and Extract Bones ──
          let meshCount = 0;
          let hasArmature = false;
          const boneMap = {};
          const boneList = [];

          model.traverse((node) => {
            if (node.isMesh || node.isSkinnedMesh) {
              meshCount++;
            }
            if (node.isBone) {
              boneMap[node.name] = node;
              boneList.push(node.name);
            }
            if (node.name.toLowerCase() === "armature" || node.name.toLowerCase() === "root") {
              hasArmature = true;
            }
          });

          console.log("Avatar Loaded");
          console.log("Meshes", meshCount);
          console.log("Bone Count", boneList.length);
          
          console.log(gltf.animations);
          console.log("Animation Count:", gltf.animations ? gltf.animations.length : 0);

          let hasSkinning = false;
          let hasMorphTargets = false;
          model.traverse((node) => {
            if (node.isSkinnedMesh) {
              hasSkinning = true;
            }
            if (node.isMesh && node.morphTargetInfluences) {
              hasMorphTargets = true;
            }
          });

          console.log("Model Analysis:");
          console.log("- Skeleton: Yes (" + boneList.length + " bones)");
          console.log("- Skinning: " + (hasSkinning ? "Yes" : "No"));
          console.log("- Animation clips: " + (gltf.animations && gltf.animations.length > 0 ? "Yes (" + gltf.animations.length + ")" : "No"));
          console.log("- Morph targets: " + (hasMorphTargets ? "Yes" : "No"));

          if (gltf.animations && gltf.animations.length > 0) {
            console.log("Animation Clips:");
            gltf.animations.forEach(clip => {
              console.log(clip.name);
            });
          } else {
            console.log("No animation clips found in bingo.glb.");
          }

          console.log("Bone Names");
          boneList.forEach(name => {
            console.log(name);
          });

          // Enable shadows on all meshes
          model.traverse((node) => {
            if (node.isMesh || node.isSkinnedMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });

          // ── 4. Automatically Center, Scale, and Frame the Avatar ──
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());

          // Scale the avatar to a standard height of 1.8 units (meters)
          const desiredHeight = 1.8;
          let scale = 1.0;
          if (size.y > 0) {
            scale = desiredHeight / size.y;
          }
          model.scale.setScalar(scale);

          // Recompute bounding box and center after scaling
          const scaledBox = new THREE.Box3().setFromObject(model);
          const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

          // Move avatar so it's centered
          model.position.sub(scaledCenter);

          // Raise it so chest is centered
          model.position.y += 0.9;

          // ── 5. Position the Camera (Waist Up Framing) ──
          camera.position.set(0, 1.45, 2.2);
          camera.lookAt(0, 1.35, 0);

          resolve({ model, bones: boneMap, animations: gltf.animations || [] });
        },
        undefined,
        (error) => {
          console.error("Error loading avatar from URL:", avatarUrl);
          console.error(error.stack || error);
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
