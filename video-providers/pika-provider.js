/**
 * PIKA LABS VIDEO PROVIDER — video-providers/pika-provider.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Concrete implementation of BaseVideoProvider for Pika Labs' API.
 */

class PikaVideoProvider extends BaseVideoProvider {
  constructor(apiKey, apiBaseUrl) {
    super(apiKey, apiBaseUrl || "https://api.pika.art/v1");
  }

  /**
   * Refines a prompt specifically for Pika's model parameters.
   */
  optimizePrompt(gloss, signerProfile) {
    const name = signerProfile.name || "Kabir";
    const gender = signerProfile.gender === "male" ? "male" : "female";
    const clothing = signerProfile.clothing || "dark grey linen Nehru jacket over a white mandarin-collar shirt";
    const backdrop = "minimalist light grey studio backdrop";
    
    return `Waist-up medium portrait of an Indian ${gender} signer named ${name} performing sign language. The signer is wearing a ${clothing}. Backdrop is a flat ${backdrop}. Static camera shot with three-point studio lighting to maximize finger shape clarity. Sign language interpretation loop of ISL gloss: "${gloss}". Sharp focus on hand configurations, high fidelity, 4k, 24fps.`;
  }

  /**
   * Submits a video generation task.
   */
  async createJob(prompt, signer) {
    if (!this.apiKey || this.apiKey === "mock" || this.apiKey.startsWith("mock_")) {
      throw new Error("Pika Labs API Key is missing. Configure it in settings.");
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
          options: {
            frameRate: 24,
            motion: 1,
            guidanceScale: 12,
            camera: {
              zoom: "none",
              pan: "none"
            }
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Pika API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      
      if (data && data.id) {
        return {
          jobId: data.id,
          status: "queued"
        };
      } else {
        throw new Error("Invalid response format received from Pika Labs API.");
      }
    } catch (error) {
      console.error("[Pika Provider] Job creation failed:", error);
      throw error;
    }
  }

  /**
   * Retrieves status of Pika generation.
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
        throw new Error(`Pika Status Error: ${response.status}`);
      }

      const data = await response.json();
      
      const status = data.status; // queued | rendering | completed | failed
      
      switch (status) {
        case "completed":
          if (data.videoUrl) {
            return {
              status: "completed",
              progress: 100,
              videoUrl: data.videoUrl
            };
          } else {
            return {
              status: "failed",
              progress: 100,
              error: "Task completed but output video URL is missing."
            };
          }
        case "failed":
          return {
            status: "failed",
            progress: 100,
            error: data.error || "Pika generation failed"
          };
        case "rendering":
          return {
            status: "generating",
            progress: 60
          };
        case "queued":
        default:
          return {
            status: "queued",
            progress: 20
          };
      }
    } catch (error) {
      console.error("[Pika Provider] Status check failed:", error);
      throw error;
    }
  }
}

// Expose globally
if (typeof window !== "undefined") {
  window.PikaVideoProvider = PikaVideoProvider;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = PikaVideoProvider;
}
