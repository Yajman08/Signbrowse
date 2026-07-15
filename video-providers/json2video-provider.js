/**
 * JSON2VIDEO PROVIDER — video-providers/json2video-provider.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Concrete implementation of BaseVideoProvider for JSON2Video API.
 * Integrates with POST/GET /v2/movies workflow.
 */

class JSON2VideoProvider extends BaseVideoProvider {
  constructor(apiKey, apiBaseUrl) {
    super(apiKey, apiBaseUrl || "https://api.json2video.com/v2");
  }

  /**
   * Refines a prompt specifically for JSON2Video elements.
   */
  optimizePrompt(gloss, signerProfile) {
    const name = signerProfile.name || "Aanya";
    const gender = signerProfile.gender === "male" ? "male" : "female";
    return `Generate sign language video for: ${gloss} (Signer: ${name}, Gender: ${gender})`;
  }

  /**
   * Creates a video rendering project using JSON2Video movies API.
   */
  async createJob(prompt, signer) {
    if (!this.apiKey || this.apiKey === "mock" || this.apiKey.startsWith("mock_")) {
      throw new Error("Invalid API key: JSON2Video API Key is missing. Configure it in settings.");
    }

    const endpoint = `${this.apiBaseUrl}/movies`;
    console.log("[JSON2Video Provider] Creating job at:", endpoint);

    // Build the movie project payload
    const payload = {
      resolution: "square",
      quality: "high",
      cache: false, // Force render to avoid stale cache
      scenes: [
        {
          duration: 5,
          elements: [
            {
              type: "html",
              html: `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; width:100%; background:linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); color:#ffffff; font-family:system-ui, -apple-system, sans-serif; font-size:36px; font-weight:bold; text-align:center; padding:30px; box-sizing:border-box; border:6px solid #4f46e5; border-radius:16px; text-shadow:0 4px 6px rgba(0,0,0,0.3);"><div style="font-size:18px; text-transform:uppercase; letter-spacing:2px; color:#a5b4fc; margin-bottom:15px;">Indian Sign Language</div><div>${signer.toUpperCase()}</div></div>`
            },
            {
              type: "voice",
              text: `Indian Sign Language translation: ${signer}`
            }
          ]
        }
      ]
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`JSON2Video API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      console.log("[JSON2Video Provider] Job created response:", data);

      // JSON2Video returns project id in "project" or "movie.project"
      const projectId = data.project || data.movie?.project;
      
      if (projectId) {
        return {
          jobId: projectId,
          status: "queued"
        };
      } else {
        throw new Error("Invalid response format received from JSON2Video movies API.");
      }
    } catch (error) {
      console.error("[JSON2Video Provider] Job creation failed:", error);
      throw error;
    }
  }

  /**
   * Retrieves the current rendering status of a movie project.
   */
  async getJobStatus(jobId) {
    const endpoint = `${this.apiBaseUrl}/movies?project=${jobId}`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`JSON2Video Status Error: ${response.status}`);
      }

      const data = await response.json();
      console.log("[JSON2Video Provider] Status query response:", data);

      // Check status from data or data.movie
      const status = data.status || data.movie?.status;
      const url = data.url || data.movie?.url;
      const errorMsg = data.message || data.movie?.message;

      // Status values: "queued", "running", "done", "error"
      switch (status) {
        case "done":
          if (url) {
            return {
              status: "completed",
              progress: 100,
              videoUrl: url
            };
          } else {
            return {
              status: "failed",
              progress: 100,
              error: "Movie finished rendering but no video URL was returned."
            };
          }
        case "error":
          return {
            status: "failed",
            progress: 100,
            error: errorMsg || "JSON2Video rendering failed."
          };
        case "running":
          return {
            status: "generating",
            progress: 50
          };
        case "queued":
        default:
          return {
            status: "queued",
            progress: 10
          };
      }
    } catch (error) {
      console.error("[JSON2Video Provider] Status check failed:", error);
      throw error;
    }
  }
}

// Expose globally
if (typeof window !== "undefined") {
  window.JSON2VideoProvider = JSON2VideoProvider;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = JSON2VideoProvider;
}
