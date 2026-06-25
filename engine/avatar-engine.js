/**
 * AVATAR ENGINE — engine/avatar-engine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the registry of pluggable avatar renderers and controls playback.
 * Coordinates play, pause, speed, stop, and handles loading sequences.
 */

const SignBrowseAvatar = (() => {

  const engines = {};
  let currentEngineId = "skeletal-2d";
  let activeContainer = null;
  let currentSpeed = 1.0;
  let isPaused = false;
  let isInitializing = false;
  let pendingPlay = null;

  // ─── Pluggable Registry APIs ───────────────────────────────────────────────

  function registerEngine(id, engine) {
    engines[id] = engine;
  }

  function init(container) {
    if (!container) return;
    activeContainer = container;
    isInitializing = true;
    pendingPlay = null;

    // 1. Show Loading Indicator
    showLoadingIndicator(activeContainer);

    // 2. Simulate Model Loading state
    setTimeout(() => {
      // Clear container (removes loading indicator)
      activeContainer.innerHTML = "";

      const engine = engines[currentEngineId];
      if (engine) {
        engine.init(activeContainer);
        engine.setSpeed(currentSpeed);
        if (isPaused) engine.pause();

        // Required Diagnostics Logs
        console.log("Avatar Initialized");
        console.log("Avatar Model Loaded");

        isInitializing = false;

        // If there was a playToken call while initializing, execute it now!
        if (pendingPlay) {
          const { token, speedMultiplier, onDone } = pendingPlay;
          pendingPlay = null;
          playToken(token, speedMultiplier, onDone);
        }
      } else {
        console.warn(`[SignBrowseAvatar] Active engine "${currentEngineId}" not found.`);
        isInitializing = false;
      }
    }, 350); // Short timeout to simulate loading visually and procedurally
  }

  function showLoadingIndicator(container) {
    container.innerHTML = `
      <div class="sb-avatar-loader">
        <div class="sb-loader-spinner"></div>
        <span class="sb-loader-text">Loading Signer...</span>
      </div>
    `;
  }

  function playToken(token, speedMultiplier, onDone) {
    currentSpeed = speedMultiplier;
    
    if (isInitializing) {
      pendingPlay = { token, speedMultiplier, onDone };
      return;
    }

    const engine = engines[currentEngineId];
    if (engine) {
      engine.setSpeed(currentSpeed);
      
      // Required Diagnostics Log
      console.log("Animation Started");
      
      engine.playToken(token, currentSpeed, onDone);
    } else {
      setTimeout(onDone, 1000 / speedMultiplier);
    }
  }

  function pause() {
    isPaused = true;
    const engine = engines[currentEngineId];
    if (engine) engine.pause();
  }

  function resume() {
    isPaused = false;
    const engine = engines[currentEngineId];
    if (engine) engine.resume();
  }

  function setPaused(paused) {
    isPaused = paused;
    const engine = engines[currentEngineId];
    if (engine) {
      if (paused) engine.pause();
      else engine.resume();
    }
  }

  function setSpeed(speed) {
    currentSpeed = speed;
    const engine = engines[currentEngineId];
    if (engine) engine.setSpeed(speed);
  }

  function stop() {
    const engine = engines[currentEngineId];
    if (engine) engine.stop();
  }

  function useEngine(id) {
    if (engines[id]) {
      if (engines[currentEngineId]) {
        engines[currentEngineId].stop();
      }
      currentEngineId = id;
      
      // Required Diagnostics Log
      console.log("Avatar Engine Selected");
      
      if (activeContainer) {
        init(activeContainer);
      }
    }
  }

  return {
    registerEngine,
    init,
    playToken,
    pause,
    resume,
    setPaused,
    setSpeed,
    stop,
    useEngine,
    getEngines: () => Object.keys(engines),
    getActiveEngineId: () => currentEngineId
  };

})();

// Expose globally
if (typeof window !== "undefined") {
  window.SignBrowseAvatar = SignBrowseAvatar;
}
