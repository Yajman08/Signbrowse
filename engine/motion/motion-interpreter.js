/**
 * MOTION INTERPRETER — engine/motion/motion-interpreter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts ISL Motion Language JSON into concrete avatar bone transforms.
 * Acts as the bridge between the abstract motion description and the
 * Three.js avatar controller.
 *
 * Responsibilities:
 *   - Parse motion data into a playable timeline
 *   - Interpolate between keyframes (cubic easing)
 *   - Map handshape names to finger bone rotation presets
 *   - Emit events for sign boundaries
 *
 * Public API:
 *   MotionInterpreter.loadMotionData(motionData)
 *   MotionInterpreter.getFrameAtTime(globalTime) → interpolated frame
 *   MotionInterpreter.getTotalDuration() → seconds
 *   MotionInterpreter.getCurrentSignIndex() → number
 *   MotionInterpreter.reset()
 *
 * Depends on:
 *   - engine/motion/motion-schema.js → ISLMotionSchema
 */

const MotionInterpreter = (() => {

  // ─── Internal State ─────────────────────────────────────────────────────
  let motionData = null;
  let timeline = [];         // Flattened array of { startTime, endTime, sign, keyframes }
  let totalDuration = 0;
  let currentSignIndex = -1;

  // ─── Event callbacks ──────────────────────────────────────────────────
  let onSignStart = null;
  let onSignComplete = null;
  let onSequenceComplete = null;


  // ─── Finger Bone Rotation Presets ─────────────────────────────────────
  // Maps handshape names → per-finger curl/spread values.
  // Each finger has: curl (0=extended, 1=fully closed), spread (degrees)
  // Fingers: thumb, index, middle, ring, pinky
  const FINGER_PRESETS = {
    "Relaxed":      { thumb: 0.15, index: 0.2,  middle: 0.25, ring: 0.3,  pinky: 0.35 },
    "FlatB":        { thumb: 0.1,  index: 0.0,  middle: 0.0,  ring: 0.0,  pinky: 0.0  },
    "OpenB":        { thumb: 0.8,  index: 0.0,  middle: 0.0,  ring: 0.0,  pinky: 0.0  },
    "SpreadC":      { thumb: 0.3,  index: 0.4,  middle: 0.4,  ring: 0.4,  pinky: 0.4  },
    "OpenA":        { thumb: 0.5,  index: 0.7,  middle: 0.7,  ring: 0.7,  pinky: 0.7  },
    "Fist":         { thumb: 0.9,  index: 1.0,  middle: 1.0,  ring: 1.0,  pinky: 1.0  },
    "FistThumbUp":  { thumb: 0.0,  index: 1.0,  middle: 1.0,  ring: 1.0,  pinky: 1.0  },
    "FistThumbOut": { thumb: 0.0,  index: 1.0,  middle: 1.0,  ring: 1.0,  pinky: 1.0  },
    "IndexPoint":   { thumb: 0.7,  index: 0.0,  middle: 1.0,  ring: 1.0,  pinky: 1.0  },
    "IndexHook":    { thumb: 0.7,  index: 0.5,  middle: 1.0,  ring: 1.0,  pinky: 1.0  },
    "IndexMiddle":  { thumb: 0.7,  index: 0.0,  middle: 0.0,  ring: 1.0,  pinky: 1.0  },
    "Pinch":        { thumb: 0.5,  index: 0.5,  middle: 1.0,  ring: 1.0,  pinky: 1.0  },
    "PinchOpen":    { thumb: 0.5,  index: 0.5,  middle: 0.0,  ring: 0.0,  pinky: 0.0  },
    "FlatO":        { thumb: 0.5,  index: 0.6,  middle: 0.6,  ring: 0.6,  pinky: 0.6  },
    "Claw":         { thumb: 0.4,  index: 0.5,  middle: 0.5,  ring: 0.5,  pinky: 0.5  },
    "ILY":          { thumb: 0.0,  index: 0.0,  middle: 1.0,  ring: 1.0,  pinky: 0.0  },
    "Horn":         { thumb: 0.8,  index: 0.0,  middle: 1.0,  ring: 1.0,  pinky: 0.0  }
  };


  // ─── Easing Function ──────────────────────────────────────────────────
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }


  // ─── Load Motion Data ─────────────────────────────────────────────────

  /**
   * Loads and prepares motion data for playback.
   * Builds a flattened timeline with absolute timestamps.
   *
   * @param {Object} data — ISL Motion Language JSON.
   */
  function loadMotionData(data) {
    motionData = data;
    timeline = [];
    totalDuration = 0;
    currentSignIndex = -1;

    if (!data || !data.signs || data.signs.length === 0) {
      console.warn("[MotionInterpreter] No signs in motion data.");
      return;
    }

    let cumulativeTime = 0;

    data.signs.forEach((sign, index) => {
      const duration = sign.duration || 1.0;
      const entry = {
        index: index,
        gloss: sign.gloss,
        startTime: cumulativeTime,
        endTime: cumulativeTime + duration,
        duration: duration,
        keyframes: sign.keyframes || [],
        isTransition: sign.gloss === "_TRANSITION"
      };
      timeline.push(entry);
      cumulativeTime += duration;
    });

    totalDuration = cumulativeTime;
    console.log(`[MotionInterpreter] Loaded ${timeline.length} signs, total duration: ${totalDuration.toFixed(2)}s`);
  }


  /**
   * Returns the interpolated frame data at a given global time.
   *
   * @param {number} globalTime — Time in seconds from the start of the sequence.
   * @returns {Object|null} — Interpolated keyframe data, or null if past the end.
   */
  function getFrameAtTime(globalTime) {
    if (timeline.length === 0) return null;
    if (globalTime >= totalDuration) {
      if (onSequenceComplete && currentSignIndex !== -2) {
        currentSignIndex = -2; // Sentinel to fire only once
        onSequenceComplete();
      }
      return null;
    }

    // Find the active sign
    let activeEntry = null;
    for (let i = 0; i < timeline.length; i++) {
      if (globalTime >= timeline[i].startTime && globalTime < timeline[i].endTime) {
        activeEntry = timeline[i];

        // Emit sign boundary events
        if (currentSignIndex !== i) {
          if (currentSignIndex >= 0 && onSignComplete) {
            onSignComplete(currentSignIndex, timeline[currentSignIndex].gloss);
          }
          currentSignIndex = i;
          if (!activeEntry.isTransition && onSignStart) {
            onSignStart(i, activeEntry.gloss);
          }
        }
        break;
      }
    }

    if (!activeEntry || activeEntry.keyframes.length === 0) return null;

    // Normalize time within the sign (0 to 1)
    const localT = (globalTime - activeEntry.startTime) / activeEntry.duration;

    // Interpolate between keyframes
    return _interpolateKeyframes(activeEntry.keyframes, localT);
  }


  /**
   * Interpolates between keyframes at a normalized time t (0-1).
   * @private
   */
  function _interpolateKeyframes(keyframes, t) {
    if (keyframes.length === 0) return null;
    if (keyframes.length === 1) return _expandKeyframe(keyframes[0]);

    // Clamp t
    t = Math.max(0, Math.min(1, t));

    // Find the two keyframes surrounding t
    let kfA = keyframes[0];
    let kfB = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (t >= keyframes[i].t && t <= keyframes[i + 1].t) {
        kfA = keyframes[i];
        kfB = keyframes[i + 1];
        break;
      }
    }

    // Compute interpolation factor
    const range = kfB.t - kfA.t;
    const localFactor = range > 0 ? (t - kfA.t) / range : 0;
    const easedFactor = easeInOutCubic(localFactor);

    // Interpolate all channels
    return {
      rightHand: _interpolateHand(kfA.rightHand, kfB.rightHand, easedFactor),
      leftHand: _interpolateHand(kfA.leftHand, kfB.leftHand, easedFactor),
      face: _interpolateFace(kfA.face, kfB.face, easedFactor),
      head: _interpolateHead(kfA.head, kfB.head, easedFactor),
      fingerPresets: {
        right: _getFingerPreset(kfA.rightHand?.shape, kfB.rightHand?.shape, easedFactor),
        left: _getFingerPreset(kfA.leftHand?.shape, kfB.leftHand?.shape, easedFactor)
      }
    };
  }


  function _interpolateHand(a, b, t) {
    const defaultHand = { shape: "Relaxed", position: [0.3, 0.9, 0.1], rotation: [0, 0, 0] };
    a = a || defaultHand;
    b = b || defaultHand;

    return {
      shape: t < 0.5 ? (a.shape || "Relaxed") : (b.shape || "Relaxed"),
      position: _lerpArray(a.position || defaultHand.position, b.position || defaultHand.position, t),
      rotation: _lerpArray(a.rotation || [0, 0, 0], b.rotation || [0, 0, 0], t),
      movement: b.movement || a.movement || "linear"
    };
  }


  function _interpolateFace(a, b, t) {
    const defaultFace = { expression: "neutral", mouthShape: "closed", eyeGaze: [0, 0] };
    a = a || defaultFace;
    b = b || defaultFace;

    return {
      expression: t < 0.5 ? (a.expression || "neutral") : (b.expression || "neutral"),
      mouthShape: t < 0.5 ? (a.mouthShape || "closed") : (b.mouthShape || "closed"),
      eyeGaze: _lerpArray(a.eyeGaze || [0, 0], b.eyeGaze || [0, 0], t)
    };
  }


  function _interpolateHead(a, b, t) {
    const defaultHead = { tilt: [0, 0, 0] };
    a = a || defaultHead;
    b = b || defaultHead;

    return {
      tilt: _lerpArray(a.tilt || [0, 0, 0], b.tilt || [0, 0, 0], t)
    };
  }


  function _getFingerPreset(shapeA, shapeB, t) {
    const presetA = FINGER_PRESETS[shapeA] || FINGER_PRESETS["Relaxed"];
    const presetB = FINGER_PRESETS[shapeB] || FINGER_PRESETS["Relaxed"];

    return {
      thumb:  presetA.thumb  + (presetB.thumb  - presetA.thumb)  * t,
      index:  presetA.index  + (presetB.index  - presetA.index)  * t,
      middle: presetA.middle + (presetB.middle - presetA.middle) * t,
      ring:   presetA.ring   + (presetB.ring   - presetA.ring)   * t,
      pinky:  presetA.pinky  + (presetB.pinky  - presetA.pinky)  * t
    };
  }


  function _lerpArray(a, b, t) {
    return a.map((v, i) => v + ((b[i] || 0) - v) * t);
  }


  function _expandKeyframe(kf) {
    return {
      rightHand: kf.rightHand || { shape: "Relaxed", position: [0.3, 0.9, 0.1], rotation: [0, 0, 0] },
      leftHand: kf.leftHand || { shape: "Relaxed", position: [-0.3, 0.9, 0.1], rotation: [0, 0, 0] },
      face: kf.face || { expression: "neutral", mouthShape: "closed", eyeGaze: [0, 0] },
      head: kf.head || { tilt: [0, 0, 0] },
      fingerPresets: {
        right: FINGER_PRESETS[kf.rightHand?.shape] || FINGER_PRESETS["Relaxed"],
        left: FINGER_PRESETS[kf.leftHand?.shape] || FINGER_PRESETS["Relaxed"]
      }
    };
  }


  // ─── Getters ──────────────────────────────────────────────────────────

  function getTotalDuration() { return totalDuration; }
  function getCurrentSignIndex() { return currentSignIndex; }
  function getTimeline() { return timeline; }
  function getMotionData() { return motionData; }


  // ─── Event Registration ───────────────────────────────────────────────

  function setOnSignStart(cb) { onSignStart = cb; }
  function setOnSignComplete(cb) { onSignComplete = cb; }
  function setOnSequenceComplete(cb) { onSequenceComplete = cb; }


  // ─── Reset ────────────────────────────────────────────────────────────

  function reset() {
    motionData = null;
    timeline = [];
    totalDuration = 0;
    currentSignIndex = -1;
  }


  return {
    FINGER_PRESETS,
    loadMotionData,
    getFrameAtTime,
    getTotalDuration,
    getCurrentSignIndex,
    getTimeline,
    getMotionData,
    setOnSignStart,
    setOnSignComplete,
    setOnSequenceComplete,
    reset
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.MotionInterpreter = MotionInterpreter;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = MotionInterpreter;
}
