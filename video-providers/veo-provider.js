/**
 * GOOGLE VEO 3 VIDEO PROVIDER — video-providers/veo-provider.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Concrete implementation of BaseVideoProvider for Google's Veo 3 video model.
 * Targets the Vertex AI predictLongRunning publisher endpoint and handles
 * Long-Running Operations (LRO) with GCS storageUri output.
 *
 * API Reference:
 *   Endpoint: /publishers/google/models/veo-3.0-generate-001:predictLongRunning
 *   Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos
 */

class VeoVideoProvider extends BaseVideoProvider {
  /**
   * @param {string} apiKey      - OAuth 2.0 Bearer token from gcloud auth print-access-token.
   * @param {string} projectId   - Google Cloud Project ID (required).
   * @param {string} storageUri  - GCS bucket path for output (e.g. gs://my-bucket/output/).
   * @param {string} region      - GCP region (default: us-central1).
   */
  constructor(apiKey, projectId, storageUri, region) {
    const loc = region || "us-central1";
    const baseUrl = `https://${loc}-aiplatform.googleapis.com/v1`;

    super(apiKey, baseUrl);
    this.projectId = projectId || "";
    this.storageUri = storageUri || "";
    this.region = loc;
    this.modelId = "veo-3.1-generate-001";
  }

  /**
   * Converts a GCS URI (gs://bucket/path/file.mp4) to a public HTTPS URL
   * that can be loaded directly in a browser <video> element.
   */
  static gcsToHttps(gcsUri) {
    if (!gcsUri || !gcsUri.startsWith("gs://")) return gcsUri;
    // gs://bucket-name/path/file.mp4 → https://storage.googleapis.com/bucket-name/path/file.mp4
    return gcsUri.replace("gs://", "https://storage.googleapis.com/");
  }

  /**
   * Refines a prompt specifically for Google Veo's spatial-detail alignment.
   */
  optimizePrompt(gloss, signerProfile) {
    const name = signerProfile.name || "Aanya";
    const gender = signerProfile.gender === "male" ? "male" : "female";
    const clothing = signerProfile.clothing || "traditional royal blue Kurta with gold accents";
    const backdrop = "neutral solid matte-white studio background";
    
    return `Generate a photorealistic, high-definition 4K video of an Indian ${gender} sign language interpreter performing. The interpreter is ${name}, wearing a ${clothing}. The background is a ${backdrop}. Framing is waist-up medium framing, keeping hands, arms, and face fully visible and centered, shot from a static frontal eye-level camera angle. Lighting is soft, professional high-key studio lighting with no harsh shadows. The presentation style is clear, friendly, educational, and professional Indian Sign Language interpretation. The interpreter must sign the following Indian Sign Language (ISL) gloss sequence: "${gloss}". Ensure all hand configurations, finger positions, and facial expressions are perfectly sharp and accurate in every frame. Educational instructional video loop.`;
  }

  /**
   * Submits a text-to-video generation request to Vertex AI via predictLongRunning.
   */
  async createJob(prompt, signer) {
    // ── Validate credentials ──
    if (!this.apiKey || this.apiKey === "mock" || this.apiKey.startsWith("mock_")) {
      throw new Error("Google Veo API Key (OAuth Token) is missing. Configure it in the extension settings.");
    }
    if (!this.projectId) {
      throw new Error("Google Cloud Project ID is missing. Configure it in the extension settings.");
    }

    // ── Build endpoint ──
    const endpoint = `${this.apiBaseUrl}/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${this.modelId}:predictLongRunning`;

    // ── Build payload ──
    const payload = {
      instances: [
        {
          prompt: prompt
        }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        durationSeconds: 5
      }
    };

    // Add storageUri if configured
    if (this.storageUri) {
      payload.parameters.storageUri = this.storageUri;
    }

    console.log(`[Veo3 Provider] Endpoint: ${endpoint}`);
    console.log(`[Veo3 Provider] Payload:`, JSON.stringify(payload, null, 2));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Veo 3 API Error: ${response.status} ${response.statusText} — ${errorText}`);
      }

      const data = await response.json();
      console.log("[Veo3 Provider] Response:", JSON.stringify(data, null, 2));

      // Vertex AI predictLongRunning returns an Operation object with a "name" field
      if (data.name) {
        return {
          jobId: data.name, // e.g. projects/{project}/locations/{location}/operations/{id}
          status: "queued"
        };
      } else {
        throw new Error("Unexpected response from Veo 3: no operation name returned.");
      }
    } catch (error) {
      console.error("[Veo3 Provider] Job creation failed:", error);
      throw error;
    }
  }

  /**
   * Polls the LRO status from the Vertex AI operations endpoint.
   * Parses the Veo 3 response structure:
   *   response.generatedVideos[0].video.uri  (GCS path)
   */
  async getJobStatus(jobId) {
    // The jobId IS the full operation resource name
    const endpoint = `${this.apiBaseUrl}/${jobId}`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Veo 3 Status Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // ── Operation complete ──
      if (data.done) {
        // Check for error
        if (data.error) {
          return {
            status: "failed",
            progress: 100,
            error: data.error.message || "Veo 3 operation failed"
          };
        }

        // ── Extract video URI from Veo 3 response ──
        // Try: response.generatedVideos[0].video.uri  (Veo 3 standard)
        const resp = data.response;
        let videoUri = null;

        if (resp) {
          // Veo 3 path: generatedVideos → video → uri
          if (resp.generatedVideos && resp.generatedVideos[0] && resp.generatedVideos[0].video) {
            videoUri = resp.generatedVideos[0].video.uri;
          }
          // Fallback: generated_videos (snake_case variant)
          else if (resp.generated_videos && resp.generated_videos[0] && resp.generated_videos[0].video) {
            videoUri = resp.generated_videos[0].video.uri;
          }
          // Legacy fallback: outputs[0].generatedVideoUri
          else if (resp.outputs && resp.outputs[0]) {
            videoUri = resp.outputs[0].generatedVideoUri;
          }
        }

        if (videoUri) {
          // Convert gs:// to https:// for browser playback
          const playableUrl = VeoVideoProvider.gcsToHttps(videoUri);
          console.log(`[Veo3 Provider] Video URI: ${videoUri}`);
          console.log(`[Veo3 Provider] Playable URL: ${playableUrl}`);
          return {
            status: "completed",
            progress: 100,
            videoUrl: playableUrl
          };
        } else {
          return {
            status: "failed",
            progress: 100,
            error: "Operation completed but no video URI found in response."
          };
        }
      }

      // ── Operation still running ──
      let progress = 30;
      if (data.metadata && data.metadata.percentComplete) {
        progress = data.metadata.percentComplete;
      }

      return {
        status: progress > 80 ? "generating" : "processing",
        progress: progress
      };
    } catch (error) {
      console.error("[Veo3 Provider] Status check failed:", error);
      throw error;
    }
  }
}

// Expose globally
if (typeof window !== "undefined") {
  window.VeoVideoProvider = VeoVideoProvider;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = VeoVideoProvider;
}
