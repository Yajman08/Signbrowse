/**
 * AVATAR RENDERERS — engine/avatar-renderer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders avatar engines (Skeletal 2D Canvas, Three.js 3D Mock, and SiGML).
 * Registers themselves automatically with the core SignBrowseAvatar engine.
 */

(() => {
  if (typeof window === "undefined" || !window.SignBrowseAvatar) {
    console.error("[SignBrowseAvatar] Core engine not found.");
    return;
  }

  const SignBrowseAvatar = window.SignBrowseAvatar;

  // ===========================================================================
  // 1. ENGINE: 2D SKELETAL CANVAS (DEFAULT)
  // ===========================================================================
  const Skeletal2DEngine = (() => {
    let canvas = null;
    let ctx = null;
    let animId = null;
    let speed = 1.0;
    let paused = false;

    // Dimensions
    const width = 200;
    const height = 185;

    // Torso Coordinates
    const leftShoulder = { x: 50, y: 155 };
    const rightShoulder = { x: 150, y: 155 };
    const neck = { x: 100, y: 125 };
    const head = { x: 100, y: 80, r: 24 };

    // Hand Home/Rest Coordinates
    const lHandHome = { x: 45, y: 160 };
    const rHandHome = { x: 155, y: 160 };

    // Active coordinates interpolated over time
    const state = {
      lHand: { x: 45, y: 160 },
      rHand: { x: 155, y: 160 },
      lShape: "SPACE",
      rShape: "SPACE",
      headOffset: { x: 0, y: 0 },
      mouthSize: 0.1
    };

    // Animation Keyframe state
    let keyframes = [];
    let currentKeyframeIdx = 0;
    let keyframeProgress = 0; // 0 to 1
    let onPlaybackDone = null;

    function init(container) {
      canvas = document.createElement("canvas");
      canvas.className = "sb-avatar-canvas";
      canvas.width = width;
      canvas.height = height;
      canvas.style.display = "block";
      canvas.style.margin = "0 auto";
      canvas.style.borderRadius = "10px";
      canvas.style.background = "#070712";
      canvas.style.boxShadow = "inset 0 0 10px rgba(0,0,0,0.5)";

      container.appendChild(canvas);
      ctx = canvas.getContext("2d");

      paused = false;
      resetState();
      
      // Start Render loop
      if (animId) cancelAnimationFrame(animId);
      renderLoop();
    }

    function resetState() {
      state.lHand.x = lHandHome.x;
      state.lHand.y = lHandHome.y;
      state.rHand.x = rHandHome.x;
      state.rHand.y = rHandHome.y;
      state.lShape = "SPACE";
      state.rShape = "SPACE";
      state.headOffset.x = 0;
      state.headOffset.y = 0;
      state.mouthSize = 0.1;
      keyframes = [];
      currentKeyframeIdx = 0;
      keyframeProgress = 0;
      lastTime = 0;
    }

    function playToken(token, speedMultiplier, onDone) {
      onPlaybackDone = onDone;
      keyframes = buildKeyframesForToken(token);
      currentKeyframeIdx = 0;
      keyframeProgress = 0;
    }

    function pause() { paused = true; }
    function resume() { paused = false; }
    function setSpeed(s) { speed = s; }
    function stop() {
      if (animId) cancelAnimationFrame(animId);
      resetState();
    }

    // ── Keyframe Generator ──
    function buildKeyframesForToken(token) {
      const list = [];
      
      if (token.type === "sign") {
        const word = token.word.toLowerCase();
        
        if (word === "hello") {
          list.push(
            { lHand: lHandHome, rHand: { x: 135, y: 90 }, rShape: "B", duration: 300 }, // prep
            { lHand: lHandHome, rHand: { x: 155, y: 65 }, rShape: "B", headOffset: { x: 3, y: 0 }, duration: 250 }, // wave out
            { lHand: lHandHome, rHand: { x: 125, y: 65 }, rShape: "B", headOffset: { x: -3, y: 0 }, duration: 250 }, // wave in
            { lHand: lHandHome, rHand: { x: 155, y: 65 }, rShape: "B", headOffset: { x: 3, y: 0 }, duration: 250 }, // wave out
            { lHand: lHandHome, rHand: rHandHome, rShape: "SPACE", duration: 300 } // rest
          );
        } else if (word === "thank") {
          list.push(
            { lHand: lHandHome, rHand: { x: 100, y: 90 }, rShape: "B", mouthSize: 0.6, duration: 350 }, // chin touch
            { lHand: lHandHome, rHand: { x: 100, y: 135 }, rShape: "B", mouthSize: 0.2, duration: 450 }, // bow out
            { lHand: lHandHome, rHand: rHandHome, rShape: "SPACE", duration: 350 } // rest
          );
        } else if (word === "world") {
          list.push(
            { lHand: { x: 85, y: 120 }, rHand: { x: 115, y: 120 }, lShape: "C", rShape: "C", duration: 350 }, // meet
            { lHand: { x: 60, y: 95 }, rHand: { x: 140, y: 95 }, lShape: "C", rShape: "C", duration: 400 }, // split arcs
            { lHand: { x: 100, y: 145 }, rHand: { x: 100, y: 145 }, lShape: "B", rShape: "B", duration: 400 }, // meet bottom
            { lHand: lHandHome, rHand: rHandHome, lShape: "SPACE", rShape: "SPACE", duration: 350 } // rest
          );
        } else if (word === "college") {
          list.push(
            { lHand: { x: 85, y: 125 }, rHand: { x: 115, y: 125 }, lShape: "B", rShape: "B", duration: 300 }, // prep
            { lHand: { x: 100, y: 125 }, rHand: { x: 100, y: 125 }, lShape: "B", rShape: "B", duration: 200 }, // clap 1
            { lHand: { x: 90, y: 125 }, rHand: { x: 110, y: 125 }, lShape: "B", rShape: "B", duration: 150 }, // separate
            { lHand: { x: 100, y: 125 }, rHand: { x: 100, y: 125 }, lShape: "B", rShape: "B", duration: 200 }, // clap 2
            { lHand: lHandHome, rHand: rHandHome, lShape: "SPACE", rShape: "SPACE", duration: 300 } // rest
          );
        } else if (word === "good") {
          list.push(
            { lHand: lHandHome, rHand: { x: 100, y: 120 }, rShape: "A", mouthSize: 0.5, duration: 350 }, // thumbs up chest
            { lHand: lHandHome, rHand: rHandHome, rShape: "SPACE", mouthSize: 0.1, duration: 350 } // rest
          );
        } else if (word === "like") {
          list.push(
            { lHand: lHandHome, rHand: { x: 100, y: 125 }, rShape: "B", duration: 300 }, // touch chest
            { lHand: lHandHome, rHand: { x: 100, y: 135 }, rShape: "A", duration: 300 }, // pinch pull
            { lHand: lHandHome, rHand: rHandHome, rShape: "SPACE", duration: 300 } // rest
          );
        } else if (word === "want") {
          list.push(
            { lHand: { x: 75, y: 135 }, rHand: { x: 125, y: 135 }, lShape: "B", rShape: "B", duration: 300 }, // palms up out
            { lHand: { x: 60, y: 145 }, rHand: { x: 140, y: 145 }, lShape: "A", rShape: "A", duration: 300 }, // pull back
            { lHand: lHandHome, rHand: rHandHome, lShape: "SPACE", rShape: "SPACE", duration: 300 } // rest
          );
        } else if (word === "not") {
          list.push(
            { lHand: lHandHome, rHand: { x: 100, y: 110 }, rShape: "B", headOffset: { x: -3, y: 0 }, duration: 250 }, // shake head left
            { lHand: lHandHome, rHand: { x: 100, y: 110 }, rShape: "B", headOffset: { x: 3, y: 0 }, duration: 250 }, // shake right
            { lHand: lHandHome, rHand: rHandHome, rShape: "SPACE", headOffset: { x: 0, y: 0 }, duration: 300 } // rest
          );
        } else if (word === "what") {
          list.push(
            { lHand: { x: 70, y: 130 }, rHand: { x: 130, y: 130 }, lShape: "B", rShape: "B", duration: 300 }, // shrug palms up
            { lHand: { x: 75, y: 130 }, rHand: { x: 125, y: 130 }, lShape: "B", rShape: "B", duration: 300 }, // small wave
            { lHand: lHandHome, rHand: rHandHome, lShape: "SPACE", rShape: "SPACE", duration: 300 } // rest
          );
        } else {
          // Generic sign path: Trace a circle
          list.push(
            { lHand: lHandHome, rHand: { x: 120, y: 110 }, rShape: "B", duration: 300 },
            { lHand: lHandHome, rHand: { x: 140, y: 100 }, rShape: "B", duration: 300 },
            { lHand: lHandHome, rHand: { x: 110, y: 100 }, rShape: "B", duration: 300 },
            { lHand: lHandHome, rHand: rHandHome, rShape: "SPACE", duration: 300 }
          );
        }
      } else if (token.type === "fingerspell") {
        list.push({ lHand: lHandHome, rHand: { x: 130, y: 95 }, rShape: "SPACE", duration: 300 }); // prep
        
        token.letters.forEach(letter => {
          list.push({
            lHand: lHandHome,
            rHand: { x: 130, y: 95 },
            rShape: letter,
            duration: 400
          });
        });

        list.push({ lHand: lHandHome, rHand: rHandHome, rShape: "SPACE", duration: 300 }); // rest
      }

      return list;
    }

    // ─── Render Engine Loop ──────────────────────────────────────────────────
    let lastTime = 0;
    
    function renderLoop(timestamp) {
      if (!timestamp) timestamp = performance.now();
      if (!lastTime) lastTime = timestamp;
      const delta = timestamp - lastTime;
      lastTime = timestamp;

      if (!paused && keyframes.length > 0) {
        advanceAnimation(delta);
      }

      draw();
      animId = requestAnimationFrame(renderLoop);
    }

    function advanceAnimation(delta) {
      const activeKF = keyframes[currentKeyframeIdx];
      if (!activeKF) return;

      const stepDuration = activeKF.duration / speed;
      keyframeProgress += delta / stepDuration;

      const startKF = currentKeyframeIdx === 0
        ? {
            lHand: { x: state.lHand.x, y: state.lHand.y },
            rHand: { x: state.rHand.x, y: state.rHand.y },
            lShape: state.lShape,
            rShape: state.rShape,
            headOffset: { x: state.headOffset.x, y: state.headOffset.y },
            mouthSize: state.mouthSize
          }
        : keyframes[currentKeyframeIdx - 1];

      if (keyframeProgress >= 1.0) {
        state.lHand.x = activeKF.lHand?.x ?? lHandHome.x;
        state.lHand.y = activeKF.lHand?.y ?? lHandHome.y;
        state.rHand.x = activeKF.rHand?.x ?? rHandHome.x;
        state.rHand.y = activeKF.rHand?.y ?? rHandHome.y;
        state.lShape = activeKF.lShape ?? "SPACE";
        state.rShape = activeKF.rShape ?? "SPACE";
        state.headOffset.x = activeKF.headOffset?.x ?? 0;
        state.headOffset.y = activeKF.headOffset?.y ?? 0;
        state.mouthSize = activeKF.mouthSize ?? 0.1;

        currentKeyframeIdx++;
        keyframeProgress = 0;

        if (currentKeyframeIdx >= keyframes.length) {
          keyframes = [];
          if (onPlaybackDone) {
            onPlaybackDone();
          }
        }
      } else {
        const t = easeInOutCubic(keyframeProgress);

        const targetL = activeKF.lHand ?? lHandHome;
        const targetR = activeKF.rHand ?? rHandHome;
        const targetHead = activeKF.headOffset ?? { x: 0, y: 0 };
        const targetMouth = activeKF.mouthSize ?? 0.1;

        const startL = startKF.lHand ?? lHandHome;
        const startR = startKF.rHand ?? rHandHome;
        const startHead = startKF.headOffset ?? { x: 0, y: 0 };
        const startMouth = startKF.mouthSize ?? 0.1;

        // Defensive checks for joints and coordinates
        if (!targetL || typeof targetL.x !== "number" || typeof targetL.y !== "number") return;
        if (!targetR || typeof targetR.x !== "number" || typeof targetR.y !== "number") return;
        if (!targetHead || typeof targetHead.x !== "number" || typeof targetHead.y !== "number") return;
        if (!startL || typeof startL.x !== "number" || typeof startL.y !== "number") return;
        if (!startR || typeof startR.x !== "number" || typeof startR.y !== "number") return;
        if (!startHead || typeof startHead.x !== "number" || typeof startHead.y !== "number") return;

        state.lHand.x = startL.x + (targetL.x - startL.x) * t;
        state.lHand.y = startL.y + (targetL.y - startL.y) * t;
        state.rHand.x = startR.x + (targetR.x - startR.x) * t;
        state.rHand.y = startR.y + (targetR.y - startR.y) * t;

        state.headOffset.x = startHead.x + (targetHead.x - startHead.x) * t;
        state.headOffset.y = startHead.y + (targetHead.y - startHead.y) * t;
        state.mouthSize = startMouth + (targetMouth - startMouth) * t;

        state.lShape = activeKF.lShape ?? startKF.lShape ?? "SPACE";
        state.rShape = activeKF.rShape ?? startKF.rShape ?? "SPACE";
      }
    }

    function easeInOutCubic(x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    // ─── Drawing Canvas ──────────────────────────────────────────────────────
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Shoulders
      ctx.beginPath();
      ctx.moveTo(35, height);
      ctx.quadraticCurveTo(100, 140, 165, height);
      ctx.fillStyle = "rgba(26, 26, 60, 0.8)";
      ctx.strokeStyle = "rgba(108, 99, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Neck
      ctx.beginPath();
      ctx.moveTo(neck.x - 8, neck.y);
      ctx.lineTo(neck.x - 8, head.y + head.r - 5);
      ctx.lineTo(neck.x + 8, head.y + head.r - 5);
      ctx.lineTo(neck.x + 8, neck.y);
      ctx.fillStyle = "#1e1e3f";
      ctx.fill();

      // Head (Face)
      const hx = head.x + state.headOffset.x;
      const hy = head.y + state.headOffset.y;
      ctx.beginPath();
      ctx.arc(hx, hy, head.r, 0, Math.PI * 2);
      ctx.fillStyle = "#1b1b38";
      ctx.strokeStyle = "#6c63ff";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Eyes
      ctx.beginPath();
      ctx.arc(hx - 8, hy - 4, 2, 0, Math.PI * 2);
      ctx.arc(hx + 8, hy - 4, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#ff65a3";
      ctx.fill();

      // Nose
      ctx.beginPath();
      ctx.moveTo(hx, hy - 1);
      ctx.lineTo(hx - 2, hy + 4);
      ctx.lineTo(hx + 2, hy + 4);
      ctx.strokeStyle = "rgba(108, 99, 255, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mouth
      ctx.beginPath();
      if (state.mouthSize > 0.2) {
        ctx.arc(hx, hy + 10, state.mouthSize * 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ff65a3";
        ctx.fill();
      } else {
        ctx.arc(hx, hy + 10, 5, 0, Math.PI);
        ctx.strokeStyle = "#ff65a3";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Arms & Hands
      drawArmAndHand(leftShoulder, state.lHand, state.lShape, true);
      drawArmAndHand(rightShoulder, state.rHand, state.rShape, false);
    }

    function drawArmAndHand(shoulder, hand, shapeName, isLeft) {
      if (!shoulder || !hand) return;
      if (typeof shoulder.x !== "number" || typeof hand.x !== "number") return;
      if (typeof shoulder.y !== "number" || typeof hand.y !== "number") return;

      const elbow = {
        x: (shoulder.x + hand.x) / 2 + (isLeft ? -15 : 15),
        y: (shoulder.y + hand.y) / 2 + 10
      };

      ctx.beginPath();
      ctx.moveTo(shoulder.x, shoulder.y);
      ctx.lineTo(elbow.x, elbow.y);
      ctx.lineTo(hand.x, hand.y);
      ctx.strokeStyle = isLeft ? "rgba(108, 99, 255, 0.5)" : "rgba(255, 101, 163, 0.5)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(elbow.x, elbow.y, 3, 0, Math.PI * 2);
      ctx.arc(hand.x, hand.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isLeft ? "#6c63ff" : "#ff65a3";
      ctx.fill();

      const shape = window.SignBrowseTranslator ? window.SignBrowseTranslator.getHandshapes()[shapeName] : null;
      if (shape) {
        const fingers = ["thumb", "index", "middle", "ring", "pinky"];
        const handScale = 0.4;

        fingers.forEach(finger => {
          const pt = shape[finger];
          if (pt) {
            const rx = (pt.x2 - 50) * handScale * (isLeft ? -1 : 1);
            const ry = (pt.y2 - 78) * handScale;

            ctx.beginPath();
            ctx.moveTo(hand.x, hand.y);
            ctx.lineTo(hand.x + rx, hand.y + ry);
            ctx.strokeStyle = isLeft ? "#6c63ff" : "#ff65a3";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(hand.x + rx, hand.y + ry, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = isLeft ? "#9f97ff" : "#ffa1c6";
            ctx.fill();
          }
        });
      }
    }

    return { init, playToken, pause, resume, setSpeed, stop };
  })();

  // ===========================================================================
  // 2. ENGINE: THREE.JS 3D MOCKUP (PLUGGABLE PROOF)
  // ===========================================================================
  const ThreeJSMockEngine = (() => {
    let container = null;
    let textEl = null;
    let canvasMock = null;
    let onDoneCallback = null;
    let interval = null;
    let speed = 1.0;
    let mockGridAngle = 0;

    function init(activeContainer) {
      container = activeContainer;

      const wrapper = document.createElement("div");
      wrapper.style.width = "100%";
      wrapper.style.height = "185px";
      wrapper.style.background = "#050f1a";
      wrapper.style.borderRadius = "10px";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "center";
      wrapper.style.border = "1px dashed #0088ff";
      wrapper.style.position = "relative";
      wrapper.style.overflow = "hidden";

      canvasMock = document.createElement("canvas");
      canvasMock.className = "sb-3d-canvas";
      canvasMock.width = 200;
      canvasMock.height = 185;
      canvasMock.style.position = "absolute";
      canvasMock.style.top = "0";
      canvasMock.style.left = "0";
      canvasMock.style.width = "100%";
      canvasMock.style.height = "100%";
      canvasMock.style.opacity = "0.35";
      wrapper.appendChild(canvasMock);

      // Create a visual 3D mannequin placeholder (Three.js Mockup wireframe avatar)
      const mannequin = document.createElement("div");
      mannequin.style.position = "absolute";
      mannequin.style.width = "60px";
      mannequin.style.height = "100px";
      mannequin.style.border = "2px solid #00bbff";
      mannequin.style.borderRadius = "30px";
      mannequin.style.background = "rgba(0, 187, 255, 0.05)";
      mannequin.style.boxShadow = "0 0 15px rgba(0, 187, 255, 0.3)";
      mannequin.style.display = "flex";
      mannequin.style.flexDirection = "column";
      mannequin.style.alignItems = "center";
      mannequin.style.paddingTop = "10px";
      mannequin.style.gap = "6px";
      mannequin.style.zIndex = "1";
      
      const headMock = document.createElement("div");
      headMock.style.width = "24px";
      headMock.style.height = "24px";
      headMock.style.border = "2px solid #00bbff";
      headMock.style.borderRadius = "50%";
      
      const lineMock = document.createElement("div");
      lineMock.style.width = "30px";
      lineMock.style.height = "2px";
      lineMock.style.background = "#00bbff";
      
      mannequin.appendChild(headMock);
      mannequin.appendChild(lineMock);
      wrapper.appendChild(mannequin);

      textEl = document.createElement("div");
      textEl.style.fontSize = "10px";
      textEl.style.color = "#00bbff";
      textEl.style.fontWeight = "bold";
      textEl.style.fontFamily = "monospace";
      textEl.style.zIndex = "2";
      textEl.style.marginTop = "60px";
      textEl.innerHTML = "THREE.JS 3D puppet active";
      textEl.style.textAlign = "center";
      wrapper.appendChild(textEl);

      container.appendChild(wrapper);

      drawMockGrid();
    }

    function drawMockGrid() {
      if (!canvasMock) return;
      const ctx = canvasMock.getContext("2d");
      ctx.clearRect(0, 0, 200, 185);

      mockGridAngle += 0.02;

      ctx.strokeStyle = "#0066aa";
      ctx.lineWidth = 1;

      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 100 + i * 10);
        ctx.lineTo(200, 100 + i * 10);
        ctx.stroke();
      }

      const cx = 100, cy = 130;
      for (let i = 0; i < 8; i++) {
        const theta = mockGridAngle + (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(theta) * 120, cy + Math.sin(theta) * 60);
        ctx.stroke();
      }

      requestAnimationFrame(drawMockGrid);
    }

    function playToken(token, speedMultiplier, onDone) {
      onDoneCallback = onDone;
      textEl.innerHTML = `THREE.JS 3D puppet active<br>[WebGL nodes morphing]<br><span style="color:#ff65a3">${token.word.toUpperCase()}</span>`;
      
      if (interval) clearInterval(interval);
      interval = setTimeout(() => {
        if (onDoneCallback) onDoneCallback();
      }, 1500 / speedMultiplier);
    }

    function pause() {}
    function resume() {}
    function setSpeed(s) { speed = s; }
    function stop() {
      if (interval) clearInterval(interval);
    }

    return { init, playToken, pause, resume, setSpeed, stop };
  })();

  // ===========================================================================
  // 3. ENGINE: SIGML/HAMNOSYS INTERPRETER (PLUGGABLE PROOF)
  // ===========================================================================
  const SiGMLMockEngine = (() => {
    let container = null;
    let xmlDisplay = null;
    let onDoneCallback = null;
    let timeoutId = null;
    let speed = 1.0;

    function init(activeContainer) {
      container = activeContainer;

      const wrapper = document.createElement("div");
      wrapper.style.width = "100%";
      wrapper.style.height = "185px";
      wrapper.style.background = "#180f12";
      wrapper.style.borderRadius = "10px";
      wrapper.style.border = "1px dashed #e15f41";
      wrapper.style.padding = "10px";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";

      const title = document.createElement("div");
      title.style.fontSize = "9px";
      title.style.color = "#e15f41";
      title.style.textTransform = "uppercase";
      title.style.fontWeight = "bold";
      title.textContent = "SiGML/HamNoSys Parser v1.2";
      wrapper.appendChild(title);

      xmlDisplay = document.createElement("pre");
      xmlDisplay.style.margin = "8px 0 0 0";
      xmlDisplay.style.flexGrow = "1";
      xmlDisplay.style.fontSize = "9px";
      xmlDisplay.style.color = "#f5cd79";
      xmlDisplay.style.fontFamily = "monospace";
      xmlDisplay.style.overflow = "auto";
      xmlDisplay.style.whiteSpace = "pre-wrap";
      xmlDisplay.textContent = "<sigml>\n  <!-- Waiting for gesture input -->\n</sigml>";
      wrapper.appendChild(xmlDisplay);

      container.appendChild(wrapper);
    }

    function playToken(token, speedMultiplier, onDone) {
      onDoneCallback = onDone;
      
      const word = token.word.toUpperCase();
      let hnsGesture = "hamchest, hamingerspelling";
      
      if (word === "HELLO") hnsGesture = "hamfinger, hamwave, hamheadnod";
      else if (word === "THANK") hnsGesture = "hamchin, hamtouch, hamforward";
      
      xmlDisplay.textContent = `<sigml>\n  <hns_sign gloss="${word}">\n    <sign_nonmanual>\n      <mouthing_tier val="${token.word}"/>\n    </sign_nonmanual>\n    <sign_manual>\n      <handconfig_${hnsGesture}/>\n    </sign_manual>\n  </hns_sign>\n</sigml>`;

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (onDoneCallback) onDoneCallback();
      }, 1600 / speedMultiplier);
    }

    function pause() {}
    function resume() {}
    function setSpeed(s) { speed = s; }
    function stop() {
      if (timeoutId) clearTimeout(timeoutId);
    }

    return { init, playToken, pause, resume, setSpeed, stop };
  })();

  // Register all engines automatically
  SignBrowseAvatar.registerEngine("skeletal-2d", Skeletal2DEngine);
  SignBrowseAvatar.registerEngine("three-js-mock", ThreeJSMockEngine);
  SignBrowseAvatar.registerEngine("sigml-mock", SiGMLMockEngine);

})();
