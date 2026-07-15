/**
 * SIGNBROWSE GESTURE MAPPER — avatar/gestureMapper.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Maps ISL gloss words returned by the translation engine to 3D avatar gestures.
 * Handles sequential playback, unknown words, and smooth transitions.
 */
const SignBrowseGestureMapper = (() => {

  /**
   * Helper to wait for a specified duration.
   */
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Gesture Mapping ───
  const gestureMap = {
    "I": "pointToSelf",
    "GO": "moveForward",
    "HELLO": "hello",
    "YES": "yes",
    "NO": "no",
    "TODAY": "todayGesture",
    "COLLEGE": "collegeGesture"
  };

  // Flag to prevent overlapping sentence playbacks
  let isPlayingSentence = false;

  /**
   * Plays a list of gloss words sequentially (VirtualISLInterpreter adapter).
   *
   * @param {string|string[]} glossWords — A space-separated gloss string or an array of gloss words.
   * @returns {Promise<void>}
   */
  async function playGloss(glossWords) {
    if (isPlayingSentence) {
      console.warn("[GestureMapper] An animation sequence is already playing. Ignoring new playback request.");
      return;
    }

    isPlayingSentence = true;
    console.log("Animation Started");

    // Resolve input to array of words
    let words = [];
    if (typeof glossWords === "string") {
      words = glossWords.trim().split(/\s+/);
    } else if (Array.isArray(glossWords)) {
      words = glossWords;
    }

    console.log(`[GestureMapper] playGloss:`, words);

    try {
      for (const word of words) {
        // Run gesture / FBX animation
        await window.playAnimation(word);

        // 9. Add a small delay (300–500 ms) between gestures
        await wait(400);
      }
    } catch (error) {
      console.error("[GestureMapper] Error during gloss sentence playback:", error);
    } finally {
      // 10. After the last gesture: Call resetPose().
      if (window.AvatarController) {
        window.AvatarController.resetPose();
      }
      isPlayingSentence = false;
      console.log("[GestureMapper] Gloss playback complete. Pose reset.");
    }
  }

  /**
   * Alias of playGloss to preserve backward compatibility.
   */
  function playSentence(input) {
    return playGloss(input);
  }

  /**
   * Gets the mapped gesture name for a gloss word.
   * @param {string} word
   * @returns {string|undefined}
   */
  function getMappedGesture(word) {
    return gestureMap[word.toUpperCase().trim()];
  }

  return {
    playGloss,
    playSentence,
    getMappedGesture,
    gestureMap
  };
})();

// Expose globally
window.SignBrowseGestureMapper = SignBrowseGestureMapper;
window.playGloss = SignBrowseGestureMapper.playGloss;
window.playSentence = SignBrowseGestureMapper.playSentence;

