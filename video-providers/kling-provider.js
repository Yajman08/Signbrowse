/**
 * KLING AI VIDEO PROVIDER — video-providers/kling-provider.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Concrete implementation of BaseVideoProvider for Kling AI's text-to-video API.
 */

class KlingVideoProvider extends BaseVideoProvider {
  constructor(apiKey, apiBaseUrl) {
    super(apiKey, apiBaseUrl || "https://api.klingai.com/v1");
  }

  /**
   * Refines a prompt specifically for Kling's high motion fidelity capabilities.
   */
  optimizePrompt(gloss, signerProfile) {
    const name = signerProfile.name || "Aanya";
    const gender = signerProfile.gender === "male" ? "male" : "female";
    const clothing = signerProfile.clothing || "traditional royal blue Kurta with gold accents";
    const backdrop = "neutral solid matte-white studio background";
    
    return `Instructional sign language video. Model: kling-v1.5-pro. Waist-up medium portrait framing of a professional Indian ${gender} signer, ${name}, wearing ${clothing}. Background is ${backdrop}. Shoot with high motion clarity and zero hand-motion blur. The interpreter must perform the following Indian Sign Language (ISL) gloss: "${gloss}". Maintain strict temporal continuity of face and hands. Flat lighting, front facing, static camera, sharp focus, 1080p, 60fps.`;
  }

  /**
   * Submits a video generation task.
   */
  async createJob(prompt, signer) {
    if (!this.apiKey || this.apiKey === "mock" || this.apiKey.startsWith("mock_")) {
      throw new Error("Kling AI API Key is missing. Configure it in settings.");
    }

    const endpoint = `${this.apiBaseUrl}/videos/text2video`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "kling-v1.5-pro",
          prompt: prompt,
          cfg: 0.8,
          mode: "high_fidelity",
          duration: 5,
          camera_control: {
            type: "static"
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Kling API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      
      if (data.data && data.data.task_id) {
        return {
          jobId: data.data.task_id,
          status: "queued"
        };
      } else {
        throw new Error(data.message || "Invalid response format received from Kling AI API.");
      }
    } catch (error) {
      console.error("[Kling Provider] Job creation failed:", error);
      throw error;
    }
  }

  /**
   * Retrieves status of Kling generation.
   */
  async getJobStatus(jobId) {
    const endpoint = `${this.apiBaseUrl}/videos/text2video/${jobId}`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Kling Status Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.data) {
        throw new Error("Empty data block returned in Kling status query.");
      }

      const status = data.data.task_status; // QUEUED | PROCESSING | COMPLETED | FAILED
      const errorMsg = data.data.task_status_msg;

      switch (status) {
        case "COMPLETED":
          if (data.data.video && data.data.video.url) {
            return {
              status: "completed",
              progress: 100,
              videoUrl: data.data.video.url
            };
          } else {
            return {
              status: "failed",
              progress: 100,
              error: "Task completed but video URL is missing."
            };
          }
        case "FAILED":
          return {
            status: "failed",
            progress: 100,
            error: errorMsg || "Kling generation task failed"
          };
        case "PROCESSING":
          return {
            status: "generating",
            progress: 60
          };
        case "QUEUED":
        default:
          return {
            status: "queued",
            progress: 15
          };
      }
    } catch (error) {
      console.error("[Kling Provider] Status check failed:", error);
      throw error;
    }
  }
}

// Expose globally
if (typeof window !== "undefined") {
  window.KlingVideoProvider = KlingVideoProvider;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = KlingVideoProvider;
}
