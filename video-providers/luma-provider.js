/**
 * LUMA VIDEO PROVIDER — video-providers/luma-provider.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Concrete implementation of BaseVideoProvider for Luma AI's Dream Machine API.
 */

class LumaVideoProvider extends BaseVideoProvider {
  constructor(apiKey, apiBaseUrl) {
    super(apiKey, apiBaseUrl || "https://api.lumalabs.ai/v1");
  }

  /**
   * Refines a prompt specifically for Luma's lighting and pathing realism.
   */
  optimizePrompt(gloss, signerProfile) {
    const name = signerProfile.name || "Aanya";
    const gender = signerProfile.gender === "male" ? "male" : "female";
    const clothing = signerProfile.clothing || "traditional royal blue Kurta with gold accents";
    const backdrop = "neutral solid matte-white studio background";
    
    return `Generate a text-to-video of a professional Indian ${gender} signer, ${name}, performing sign language in a clean bright studio setting. The signer is wearing a ${clothing}. Background is a flat ${backdrop}. Soft cinematic ambient illumination with high facial and hand detail. Static frontal framing with no camera rotation or translation. The interpreter must perform the following Indian Sign Language (ISL) gloss: "${gloss}". Fluid body motions, fingers spread clearly, high-fidelity frame rendering, 30fps.`;
  }

  /**
   * Submits a video generation task.
   */
  async createJob(prompt, signer) {
    if (!this.apiKey || this.apiKey === "mock" || this.apiKey.startsWith("mock_")) {
      throw new Error("Luma Dream Machine API Key is missing. Configure it in settings.");
    }

    const endpoint = `${this.apiBaseUrl}/generations`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: prompt,
          aspect_ratio: "16:9",
          loop: true
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Luma API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      
      if (data && data.id) {
        return {
          jobId: data.id,
          status: "queued"
        };
      } else {
        throw new Error("Invalid response format received from Luma Dream Machine API.");
      }
    } catch (error) {
      console.error("[Luma Provider] Job creation failed:", error);
      throw error;
    }
  }

  /**
   * Retrieves status of Luma generation.
   */
  async getJobStatus(jobId) {
    const endpoint = `${this.apiBaseUrl}/generations/${jobId}`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Luma Status Error: ${response.status}`);
      }

      const data = await response.json();
      
      const status = data.state; // queued | dreaming | completed | failed
      
      switch (status) {
        case "completed":
          if (data.assets && data.assets.video) {
            return {
              status: "completed",
              progress: 100,
              videoUrl: data.assets.video
            };
          } else {
            return {
              status: "failed",
              progress: 100,
              error: "Task completed but output video asset URL is missing."
            };
          }
        case "failed":
          return {
            status: "failed",
            progress: 100,
            error: data.failure_reason || "Luma generation failed"
          };
        case "dreaming":
          return {
            status: "generating",
            progress: 50
          };
        case "queued":
        default:
          return {
            status: "queued",
            progress: 20
          };
      }
    } catch (error) {
      console.error("[Luma Provider] Status check failed:", error);
      throw error;
    }
  }
}

// Expose globally
if (typeof window !== "undefined") {
  window.LumaVideoProvider = LumaVideoProvider;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = LumaVideoProvider;
}
