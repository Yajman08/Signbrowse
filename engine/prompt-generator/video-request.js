/**
 * VIDEO REQUEST — engine/prompt-generator/video-request.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages text-to-video generation job lifecycle by proxying API requests
 * and long-polling via the extension background script.
 * 
 * Supports fallback mock simulation for Node.js unit tests.
 */

const SignBrowseVideoRequest = (() => {

  /**
   * Returns the current API connection status.
   * Leverages cached status loaded from settings.
   */
  function getApiStatus() {
    if (typeof window !== "undefined" && window.__signBrowseApiStatus) {
      return window.__signBrowseApiStatus;
    }
    return "mock"; // Default fallback
  }

  /**
   * Legacy payload builder — maps engine IDs to their real API model names.
   */
  function buildApiPayload(engineId, prompt) {
    const modelMap = {
      "google-veo": "veo-video-1.0-ultra",
      "runway-gen3": "gen3a-alpha-turbo",
      "runway-gen4": "gen4-turbo",
      "luma-dream-machine": "luma-photon-1",
      "kling-ai": "kling-v1-5",
      "pika": "pika-2.0"
    };
    return {
      model: modelMap[engineId] || engineId,
      prompt: prompt,
      aspectRatio: "16:9"
    };
  }

  /**
   * Dispatches text-to-video generation to the background service worker.
   * Long-polls for updates and resolves with the generated video URL.
   */
  function submitVideoRequest(engineId, prompt, gloss, onProgress) {
    console.log("[SignBrowse VideoRequest] Submitting model:", engineId);
    console.log("[SignBrowse VideoRequest] Prompt:", prompt.substring(0, 100) + "...");

    const isExtension = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage;

    if (!isExtension) {
      return Promise.reject(new Error("Chrome Extension runtime environment is required for real video generation."));
    }

    // Chrome Extension context: Route via background proxy
    return new Promise((resolve, reject) => {
      onProgress(5, "Contacting background service worker...");

      chrome.runtime.sendMessage({
        type: "START_VIDEO_JOB",
        payload: {
          model: engineId,
          prompt: prompt,
          signer: gloss
        }
      }, response => {
        if (!response) {
          reject(new Error("Unable to connect to the background service worker."));
          return;
        }

        if (response.status === "error") {
          reject(new Error(response.message || "Failed to initiate video generation job."));
          return;
        }

        const jobId = response.jobId;
        console.log("[SignBrowse VideoRequest] Job started. Local ID:", jobId);
        onProgress(15, "Job queued. Waiting for remote server...");

        // Polling loop every 2 seconds
        const pollInterval = setInterval(() => {
          chrome.runtime.sendMessage({
            type: "GET_VIDEO_JOB_STATUS",
            payload: { jobId: jobId }
          }, pollResponse => {
            if (!pollResponse || pollResponse.status === "error") {
              clearInterval(pollInterval);
              reject(new Error((pollResponse && pollResponse.message) || "Job status check failed."));
              return;
            }

            const { status, progress, videoUrl, error } = pollResponse;
            console.log(`[SignBrowse VideoRequest] Poll update: status=${status}, progress=${progress}%`);

            if (status === "completed") {
              clearInterval(pollInterval);
              resolve({
                status: "success",
                mode: "real",
                engineId: engineId,
                engineName: getEngineDisplayName(engineId),
                prompt: prompt,
                gloss: gloss,
                videoUrl: videoUrl,
                timestamp: new Date().toISOString()
              });
            } else if (status === "failed") {
              clearInterval(pollInterval);
              reject(new Error(error || "Remote video generation job failed."));
            } else {
              let statusText = "Generating signer video...";
              if (status === "queued") {
                statusText = "Waiting in remote API task queue...";
              } else if (status === "processing") {
                statusText = "Model pipeline initialized...";
              } else if (status === "generating") {
                statusText = "Rendering temporal motion frames...";
              }
              onProgress(progress || 40, statusText);
            }
          });
        }, 2000);
      });
    });
  }

  function getEngineDisplayName(engineId) {
    const names = {
      "google-veo": "Google Veo",
      "runway-gen3": "Runway Gen-3",
      "runway-gen4": "Runway Gen-4",
      "luma-dream-machine": "Luma Dream",
      "kling-ai": "Kling AI",
      "pika": "Pika Labs"
    };
    return names[engineId] || engineId;
  }

  return {
    getApiStatus,
    buildApiPayload,
    submitVideoRequest
  };
})();

// Expose globally
if (typeof window !== "undefined") {
  window.SignBrowseVideoRequest = SignBrowseVideoRequest;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = SignBrowseVideoRequest;
}
