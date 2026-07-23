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

          // ── Enable shadows & REPLACE materials with fresh MeshStandardMaterials ──
          // Creating new materials entirely (not modifying old ones) guarantees colors show correctly
          const SKIN_COLOR = 0xE0B08A;
          const HAIR_COLOR = 0x0a0a0a;
          const KURTA_COLOR = 0x1e3a8a;
          const BORDER_COLOR = 0xd97706;
          const PANT_COLOR = 0xf5f5f4;
          const TEETH_COLOR = 0xfafafa;
          const EYE_WHITE_COLOR = 0xfafafa;
          const PUPIL_COLOR = 0x0a0a0a;

          model.traverse((node) => {
            if (node.isMesh || node.isSkinnedMesh) {
              node.castShadow = true;
              node.receiveShadow = true;

              // Remove vertex colors from geometry
              if (node.geometry && node.geometry.attributes && node.geometry.attributes.color) {
                node.geometry.deleteAttribute('color');
              }

              if (node.material) {
                const oldMats = Array.isArray(node.material) ? node.material : [node.material];
                const newMats = oldMats.map(mat => {
                  const matName = (mat.name || '').toLowerCase();
                  const nodeName = (node.name || '').toLowerCase();

                  console.log(`[AvatarLoader] Mesh: "${node.name}" | Material: "${mat.name}"`);

                  let color, roughness, metalness;

                  // ── Classify by name ──
                  if (matName.includes("hair") || nodeName.includes("hair") || matName.includes("top") || matName.includes("cap") || matName.includes("sides") || matName.includes("scalp")) {
                    color = HAIR_COLOR; roughness = 0.85; metalness = 0.0;
                    console.log(`[AvatarLoader]   → HAIR`);
                  } else if (matName.includes("kurta")) {
                    color = KURTA_COLOR; roughness = 0.7; metalness = 0.1;
                    console.log(`[AvatarLoader]   → KURTA`);
                  } else if (matName.includes("border")) {
                    color = BORDER_COLOR; roughness = 0.45; metalness = 0.35;
                    console.log(`[AvatarLoader]   → BORDER`);
                  } else if (matName.includes("pant")) {
                    color = PANT_COLOR; roughness = 0.8; metalness = 0.1;
                    console.log(`[AvatarLoader]   → PANT`);
                  } else if (matName.includes("teeth")) {
                    color = TEETH_COLOR; roughness = 0.3; metalness = 0.0;
                    console.log(`[AvatarLoader]   → TEETH`);
                  } else if (matName.includes("pupil")) {
                    color = PUPIL_COLOR; roughness = 0.1; metalness = 0.0;
                    console.log(`[AvatarLoader]   → PUPIL`);
                  } else if (matName.includes("eye")) {
                    color = EYE_WHITE_COLOR; roughness = 0.1; metalness = 0.0;
                    console.log(`[AvatarLoader]   → EYE`);
                  } else if (matName.includes("plastic") || matName.includes("body") || matName.includes("head") || nodeName.includes("body") || nodeName.includes("head") || matName.includes("skin") || nodeName.includes("skin")) {
                    // Explicit skin matches (high-poly head uses "plastic" material)
                    color = SKIN_COLOR; roughness = 0.55; metalness = 0.1;
                    console.log(`[AvatarLoader]   → SKIN (explicit match)`);
                  } else {
                    // EVERYTHING ELSE = SKIN (fallback)
                    color = SKIN_COLOR; roughness = 0.55; metalness = 0.1;
                    console.log(`[AvatarLoader]   → SKIN (fallback)`);
                  }

                  // Create a brand new material (no old state to fight)
                  const newMat = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: roughness,
                    metalness: metalness,
                    skinning: node.isSkinnedMesh || false,
                    vertexColors: false,
                  });
                  newMat.name = mat.name; // preserve original name for debugging

                  return newMat;
                });

                // Assign the new material(s)
                node.material = newMats.length === 1 ? newMats[0] : newMats;
              }
            }
          });

          // ── 4. Automatically Center & Scale the Avatar ──
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

          // Raise it so bottom is at y=0, top at y=1.8
          model.position.y += 0.9;

          // ── 5. Position the Camera (Waist-Up Professional Interpreter Framing) ──
          model.updateMatrixWorld(true);

          let headY = 1.6;
          let chestY = 1.35;
          let hipsY = 0.95;

          const headBone = model.getObjectByName("head") || model.getObjectByName("Head");
          const chestBone = model.getObjectByName("upper-chest") || model.getObjectByName("chest") || model.getObjectByName("Chest");
          const hipsBone = model.getObjectByName("hips") || model.getObjectByName("Hips");

          const tempV = new THREE.Vector3();
          if (headBone) {
            headBone.getWorldPosition(tempV);
            headY = tempV.y;
          }
          if (chestBone) {
            chestBone.getWorldPosition(tempV);
            chestY = tempV.y;
          }
          if (hipsBone) {
            hipsBone.getWorldPosition(tempV);
            hipsY = tempV.y;
          }

          // Frame from waist (hipsY + 0.15) up to top of head (headY + 0.15)
          const bottomY = Math.min(hipsY + 0.15, chestY - 0.25);
          const topY = headY + 0.15;
          const targetY = (topY + bottomY) / 2;
          const frameHeight = topY - bottomY;

          // Estimate signing width (arm span/movement box)
          const frameWidth = frameHeight * 1.25;

          const fovRad = THREE.MathUtils.degToRad(camera.fov || 45);
          const aspect = camera.aspect || 1.0;

          // Distance required for height & width
          const distHeight = (frameHeight / 2) / Math.tan(fovRad / 2);
          const distWidth = (frameWidth / 2) / (aspect * Math.tan(fovRad / 2));

          // Use the maximum distance with a smaller safety margin (1.05) to fill the viewport better
          const distance = Math.max(distHeight, distWidth) * 1.05;

          console.log(`[AvatarLoader] Camera Framing: headY=${headY.toFixed(2)}, chestY=${chestY.toFixed(2)}, targetY=${targetY.toFixed(2)}, distance=${distance.toFixed(2)}`);

          // Position camera centered on the avatar
          camera.position.set(0, targetY + 0.15, distance);
          camera.lookAt(0, targetY + 0.05, 0);

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
