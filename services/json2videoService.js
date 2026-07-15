/**
 * JSON2VIDEO SERVICE — services/json2videoService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side service coordinating AI video translation.
 * Interacts with background service worker to create and poll video rendering jobs,
 * and dynamically swaps the 3D avatar viewport with an HTML5 video player.
 */

const JSON2VideoService = (() => {

  /**
   * Helper to wait for a specified duration.
   */
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generates a sign language video using JSON2Video API and displays it in the viewport.
   *
   * @param {string} rawText - Original selected text.
   * @param {string} glossText - Translated ISL gloss sentence.
   * @param {HTMLElement} viewportContainer - The overlay container wrapping the canvas/video.
   */
  async function generateSignVideo(rawText, glossText, viewportContainer) {
    if (!viewportContainer) {
      console.error("[JSON2VideoService] Viewport container is missing.");
      return;
    }

    console.log(`[JSON2VideoService] Starting video generation for gloss: "${glossText}"`);

    // 1. Show loading spinner with specific message
    let loadingDiv = viewportContainer.querySelector("#sb-video-loading");
    if (!loadingDiv) {
      loadingDiv = document.createElement("div");
      loadingDiv.className = "sb-viewport-overlay";
      loadingDiv.id = "sb-video-loading";
      viewportContainer.appendChild(loadingDiv);
    }
    loadingDiv.innerHTML = `
      <div class="sb-loading-spinner"></div>
      <span style="margin-top: 10px; font-weight: 500; font-size: 13px; color: #e2e8f0; text-align: center;">Generating Sign Language Video...</span>
    `;
    loadingDiv.classList.remove("sb-hidden", "hidden");

    // Hide canvas and other overlays
    const canvas = viewportContainer.querySelector("#sb-avatar-canvas");
    if (canvas) canvas.style.display = "none";
    const oldVideo = viewportContainer.querySelector("#sb-video-player");
    if (oldVideo) oldVideo.remove();
    const avatarLoading = viewportContainer.querySelector("#sb-avatar-loading");
    if (avatarLoading) avatarLoading.classList.add("sb-hidden", "hidden");
    const errorOverlay = viewportContainer.querySelector("#sb-avatar-error");
    if (errorOverlay) errorOverlay.classList.add("sb-hidden", "hidden");
    const videoErrorOverlay = viewportContainer.querySelector("#sb-video-error");
    if (videoErrorOverlay) videoErrorOverlay.classList.add("sb-hidden", "hidden");

    try {
      // 2. Fetch the JSON2Video API Key from local storage
      const settings = await new Promise((resolve) => {
        chrome.storage.local.get(["json2videoApiKey", "selectedSigner"], resolve);
      });

      const apiKey = settings.json2videoApiKey;
      if (!apiKey || apiKey.trim() === "") {
        throw new Error("JSON2Video API Key is missing. Configure it in settings popup.");
      }

      // 3. Compile prompt
      let prompt = `Waist-up medium shot of a signer translating: "${glossText}"`;
      if (window.SignBrowsePromptGenerator) {
        const signerId = settings.selectedSigner || "aanya";
        prompt = window.SignBrowsePromptGenerator.generate(glossText, signerId, "json2video");
      }

      // 4. Submit video request via background script
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: "START_VIDEO_JOB",
          payload: {
            model: "json2video",
            prompt: prompt,
            signer: glossText
          }
        }, response => {
          if (!response) {
            reject(new Error("Unable to connect to service worker."));
            return;
          }
          if (response.status === "error") {
            reject(new Error(response.message || "Failed to start rendering job."));
            return;
          }
          resolve(response);
        });
      });

      const jobId = result.jobId;
      console.log(`[JSON2VideoService] Rendering job started. Local ID: ${jobId}`);

      // 5. Poll for video completion
      const videoUrl = await pollJobStatus(jobId, loadingDiv);

      // 6. Replace viewport with HTML5 video player
      loadingDiv.classList.add("sb-hidden", "hidden");
      
      const videoPlayer = document.createElement("video");
      videoPlayer.id = "sb-video-player";
      videoPlayer.src = videoUrl;
      videoPlayer.controls = true;
      videoPlayer.autoplay = true;
      videoPlayer.loop = true;
      videoPlayer.style.width = "100%";
      videoPlayer.style.height = "100%";
      videoPlayer.style.objectFit = "cover";
      videoPlayer.style.borderRadius = "8px";

      viewportContainer.appendChild(videoPlayer);
      console.log(`[JSON2VideoService] Video rendering complete! Playing: ${videoUrl}`);

    } catch (err) {
      console.error("[JSON2VideoService] Error generating video:", err);
      loadingDiv.classList.add("sb-hidden", "hidden");
      
      // Display user-friendly error overlay
      let errOverlay = viewportContainer.querySelector("#sb-video-error");
      if (!errOverlay) {
        errOverlay = document.createElement("div");
        errOverlay.className = "sb-viewport-overlay error-overlay";
        errOverlay.id = "sb-video-error";
        viewportContainer.appendChild(errOverlay);
      }
      errOverlay.innerHTML = `<span style="color:#ff6b6b; font-size:12px; padding:20px; text-align:center; font-weight:500;">⚠️ ${err.message}</span>`;
      errOverlay.classList.remove("sb-hidden", "hidden");
    }
  }

  /**
   * Polls the background service worker for the status of a job.
   */
  function pollJobStatus(jobId, loadingDiv) {
    return new Promise((resolve, reject) => {
      const timeoutLimit = 180000; // 3 minutes timeout
      const startTime = Date.now();

      const interval = setInterval(() => {
        if (Date.now() - startTime > timeoutLimit) {
          clearInterval(interval);
          reject(new Error("API timeout: Video generation took too long."));
          return;
        }

        chrome.runtime.sendMessage({
          type: "GET_VIDEO_JOB_STATUS",
          payload: { jobId }
        }, response => {
          if (!response || response.status === "error") {
            clearInterval(interval);
            reject(new Error((response && response.message) || "Job status check failed."));
            return;
          }

          const { status, progress, videoUrl, error } = response;
          console.log(`[JSON2VideoService] Polling status: ${status} (${progress || 0}%)`);

          if (status === "completed") {
            clearInterval(interval);
            resolve(videoUrl);
          } else if (status === "failed") {
            clearInterval(interval);
            reject(new Error(error || "Generation failure on remote video compiler."));
          } else {
            // Update loading message with progress if available
            const progressPct = progress !== undefined ? ` (${progress}%)` : "";
            const spinnerSpan = loadingDiv.querySelector("span");
            if (spinnerSpan) {
              spinnerSpan.textContent = `Generating Sign Language Video...${progressPct}`;
            }
          }
        });
      }, 3000);
    });
  }

  return {
    generateSignVideo
  };

})();

// Expose globally
if (typeof window !== "undefined") {
  window.JSON2VideoService = JSON2VideoService;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = JSON2VideoService;
}
