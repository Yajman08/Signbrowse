/**
 * RUNWAY VIDEO PROVIDER — video-providers/runway-provider.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Concrete implementation of BaseVideoProvider for RunwayML's text-to-video API.
 * Integrates with /v1/tasks tasks workflow.
 */

class RunwayVideoProvider extends BaseVideoProvider {
  constructor(apiKey, apiBaseUrl) {
    super(apiKey, apiBaseUrl || "https://api.runwayml.com/v1");
  }

  /**
   * Refines a prompt specifically for Runway's high-temporal model dynamics.
   */
  optimizePrompt(gloss, signerProfile) {
    const name = signerProfile.name || "Kabir";
    const gender = signerProfile.gender === "male" ? "male" : "female";
    const clothing = signerProfile.clothing || "dark grey linen Nehru jacket over a white mandarin-collar shirt";
    const backdrop = "minimalist light grey studio backdrop";
    
    return `Photorealistic 4K resolution. Waist-up medium shot of an Indian ${gender} signer named ${name} translating sign language in front of a ${backdrop}. The signer wears a ${clothing}. Shot from a static frontal eye-level camera angle with even, soft three-point studio lighting to maximize hand shape clarity and a precise, professional, clear, and educational Indian Sign Language interpretation. The signer performs this exact Indian Sign Language (ISL) gloss: "${gloss}". Perfect hand configuration, fluid arm movement, no morphing artifacts, high temporal consistency, 60fps.`;
  }

  /**
   * Creates a text-to-video generation task.
   */
  async createJob(prompt, signer) {
    if (!this.apiKey || this.apiKey === "mock" || this.apiKey.startsWith("mock_")) {
      throw new Error("Runway API Key is missing. Configure it in settings.");
    }

    const endpoint = `${this.apiBaseUrl}/tasks`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06"
        },
        body: JSON.stringify({
          taskType: "text_to_video",
          prompt: prompt,
          model: "gen3a_turbo",
          duration: 5,
          options: {
            cfg: 7.5,
            motion_strength: 5,
            upscale: true,
            watermark: false
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Runway API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      
      // Runway returns task object with an id
      if (data.task && data.task.id) {
        return {
          jobId: data.task.id,
          status: "queued"
        };
      } else {
        throw new Error("Invalid response format received from Runway tasks API.");
      }
    } catch (error) {
      console.error("[Runway Provider] Job creation failed:", error);
      throw error;
    }
  }

  /**
   * Retrieves the task status.
   */
  async getJobStatus(jobId) {
    const endpoint = `${this.apiBaseUrl}/tasks/${jobId}`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-Runway-Version": "2024-11-06"
        }
      });

      if (!response.ok) {
        throw new Error(`Runway Status Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.task) {
        throw new Error("Empty task object returned in Runway status query.");
      }

      const status = data.task.status; // PENDING | RUNNING | SUCCEEDED | FAILED
      const progress = Math.round((data.task.progress || 0) * 100);

      switch (status) {
        case "SUCCEEDED":
          if (data.task.output && data.task.output[0]) {
            return {
              status: "completed",
              progress: 100,
              videoUrl: data.task.output[0]
            };
          } else {
            return {
              status: "failed",
              progress: 100,
              error: "Task succeeded but output video array is empty."
            };
          }
        case "FAILED":
          return {
            status: "failed",
            progress: 100,
            error: data.task.error || "Runway task generation failed"
          };
        case "RUNNING":
          return {
            status: "generating",
            progress: progress || 50
          };
        case "PENDING":
        default:
          return {
            status: "queued",
            progress: progress || 10
          };
      }
    } catch (error) {
      console.error("[Runway Provider] Status check failed:", error);
      throw error;
    }
  }
}

// Expose globally
if (typeof window !== "undefined") {
  window.RunwayVideoProvider = RunwayVideoProvider;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = RunwayVideoProvider;
}
