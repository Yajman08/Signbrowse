/**
 * GEMINI LLM PROVIDER — engine/llm/gemini-provider.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements LLMProviderBase for Google's Gemini API.
 * Uses the generativelanguage.googleapis.com REST endpoint with
 * structured JSON output (responseMimeType: "application/json").
 *
 * Model: gemini-2.0-flash (free tier: 15 RPM, 1M tokens/min)
 *
 * Depends on:
 *   - engine/llm/llm-provider-base.js → LLMProviderBase
 */

class GeminiProvider extends LLMProviderBase {
  /**
   * @param {string} apiKey — Gemini API key from Google AI Studio.
   * @param {Object} config — Optional config overrides.
   * @param {string} config.model — Model ID (default: "gemini-2.0-flash").
   * @param {number} config.temperature — Generation temperature (default: 0.4).
   * @param {number} config.maxOutputTokens — Max response tokens (default: 8192).
   */
  constructor(apiKey, config = {}) {
    super(apiKey, config);
    this.model = config.model || "gemini-2.0-flash";
    this.temperature = config.temperature ?? 0.4;
    this.maxOutputTokens = config.maxOutputTokens || 8192;
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  }

  get name() {
    return "gemini";
  }

  /**
   * Sends a prompt to Gemini and returns structured JSON.
   *
   * @param {string} systemPrompt — System instruction for motion planning.
   * @param {string} userPrompt — The ISL gloss sequence to animate.
   * @param {Object|null} jsonSchema — Optional response schema (for structured output).
   * @returns {Promise<Object>} — Parsed JSON motion data.
   */
  async complete(systemPrompt, userPrompt, jsonSchema) {
    const validation = this.validateConfig();
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    // ── Build request body ──
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens,
        responseMimeType: "application/json"
      }
    };

    // Add response schema if provided (enforces JSON structure)
    if (jsonSchema) {
      requestBody.generationConfig.responseSchema = jsonSchema;
    }

    console.log(`[Gemini Provider] Endpoint: ${this.baseUrl}/models/${this.model}:generateContent`);
    console.log(`[Gemini Provider] System prompt length: ${systemPrompt.length} chars`);
    console.log(`[Gemini Provider] User prompt: "${userPrompt}"`);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      // ── Extract text from Gemini response ──
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error("Gemini returned no candidates.");
      }

      const content = candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        throw new Error("Gemini candidate has no content parts.");
      }

      const textOutput = content.parts[0].text;
      if (!textOutput) {
        throw new Error("Gemini response text is empty.");
      }

      // ── Parse JSON output ──
      let parsedJson;
      try {
        parsedJson = JSON.parse(textOutput);
      } catch (parseErr) {
        // Try to extract JSON from markdown code fences if present
        const jsonMatch = textOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          parsedJson = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error(`Failed to parse Gemini response as JSON: ${parseErr.message}\nRaw: ${textOutput.substring(0, 500)}`);
        }
      }

      console.log("[Gemini Provider] Successfully parsed JSON response.");
      return parsedJson;

    } catch (error) {
      console.error("[Gemini Provider] Request failed:", error);
      throw error;
    }
  }
}


// Expose globally
if (typeof window !== "undefined") {
  window.GeminiProvider = GeminiProvider;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = GeminiProvider;
}
