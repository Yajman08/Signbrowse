/**
 * OLLAMA SERVICE — services/ollama-service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Service module for communicating with a local Ollama instance.
 * Handles ISL translation: English text → structured ISL gloss + motions JSON.
 *
 * Endpoint: POST http://localhost:11434/api/generate
 * Model: llama3.2 (configurable)
 * No API key required — runs locally.
 *
 * Implements the same translate(text) interface as GeminiService
 * so providers are interchangeable via AIProviderManager.
 *
 * Public API:
 *   OllamaService.translate(text) → Promise<{ gloss, motions }>
 *   OllamaService.isAvailable() → Promise<boolean>
 *   OllamaService.setEndpoint(url)
 *   OllamaService.setModel(model)
 */

const OllamaService = (() => {

  // ── Configuration ──────────────────────────────────────────────────────
  let _endpoint = "http://localhost:11434/api/generate";
  let _model = "llama3.2";

  // ── Prompt ─────────────────────────────────────────────────────────────
  const ISL_PROMPT_PREFIX = `You are an Indian Sign Language (ISL) assistant and linguistic expert.

Convert the following English sentence into Indian Sign Language gloss and return ONLY a valid JSON object.

RULES:
- ISL follows Subject-Object-Verb (SOV) word order, NOT English SVO.
- Drop articles (a, an, the), linking verbs (is, are, am), and prepositions where ISL omits them.
- Use UPPERCASE for all gloss entries.
- For each gloss word, provide a corresponding motion entry.

Return this exact JSON structure and NOTHING else (no markdown, no explanation):
{
  "gloss": ["WORD1", "WORD2"],
  "motions": [
    {
      "gloss": "WORD1",
      "handShape": "<shape>",
      "location": "<location>",
      "movement": "<movement>",
      "expression": "Neutral"
    }
  ]
}

Valid handShape: FlatB, OpenB, SpreadC, OpenA, Fist, FistThumbUp, IndexPoint, Pinch, Claw, ILY, Relaxed, Fingerspell
Valid location: Neutral, Forehead, Chin, Chest, Shoulder, Waist, Side, AboveHead, InFront
Valid movement: None, Forward, Backward, Up, Down, Circular, Arc, Shake, Twist, Wave, Tap

Sentence:
`;


  // ── Configuration Methods ──────────────────────────────────────────────

  /**
   * Sets the Ollama API endpoint.
   * @param {string} url
   */
  function setEndpoint(url) {
    _endpoint = url || "http://localhost:11434/api/generate";
  }

  /**
   * Sets the Ollama model to use.
   * @param {string} model
   */
  function setModel(model) {
    _model = model || "llama3.2";
  }

  /**
   * Gets current endpoint.
   */
  function getEndpoint() {
    return _endpoint;
  }

  /**
   * Gets current model.
   */
  function getModel() {
    return _model;
  }


  // ── Availability Check ─────────────────────────────────────────────────

  /**
   * Checks if Ollama is running and reachable.
   * @returns {Promise<boolean>}
   */
  async function isAvailable() {
    try {
      // Ollama's base URL returns a simple response when running
      const baseUrl = _endpoint.replace("/api/generate", "");
      const response = await fetch(baseUrl, {
        method: "GET",
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  }


  // ── Translation ────────────────────────────────────────────────────────

  /**
   * Translates English text to structured ISL representation via Ollama.
   *
   * @param {string} text — English sentence to translate.
   * @returns {Promise<{gloss: string[], motions: object[]}>}
   * @throws {OllamaServiceError} On connection failure, parse error, etc.
   */
  async function translate(text) {
    if (!text || typeof text !== "string" || !text.trim()) {
      throw new OllamaServiceError("EMPTY_INPUT", "No text provided for translation.");
    }

    const cleanText = text.trim();
    const fullPrompt = ISL_PROMPT_PREFIX + cleanText;

    const requestBody = {
      model: _model,
      prompt: fullPrompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 2048
      }
    };

    console.log(`[OllamaService] Translating via ${_model}: "${cleanText.substring(0, 80)}${cleanText.length > 80 ? '...' : ''}"`);
    const startTime = performance.now();

    let response;
    try {
      response = await fetch(_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
    } catch (networkErr) {
      // Most common: Ollama not running
      if (networkErr.message.includes("Failed to fetch") ||
          networkErr.message.includes("NetworkError") ||
          networkErr.message.includes("ERR_CONNECTION_REFUSED") ||
          networkErr.name === "TypeError") {
        throw new OllamaServiceError(
          "OLLAMA_NOT_RUNNING",
          "Cannot connect to Ollama. Please ensure Ollama is running on your machine.\n\n" +
          "Start it with: ollama serve\n" +
          `Expected at: ${_endpoint}`
        );
      }
      throw new OllamaServiceError("NETWORK_ERROR", `Network request failed: ${networkErr.message}`);
    }

    // ── Handle HTTP errors ──
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");

      if (response.status === 404) {
        throw new OllamaServiceError(
          "MODEL_NOT_FOUND",
          `Model "${_model}" not found. Pull it with: ollama pull ${_model}`
        );
      }
      if (response.status >= 500) {
        throw new OllamaServiceError("SERVER_ERROR", `Ollama server error (${response.status}): ${errorText.substring(0, 200)}`);
      }
      throw new OllamaServiceError("API_ERROR", `Ollama API error ${response.status}: ${errorText.substring(0, 200)}`);
    }

    // ── Parse response ──
    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      throw new OllamaServiceError("PARSE_ERROR", "Failed to parse Ollama API response.");
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`[OllamaService] Response received in ${elapsed}s`);

    // Ollama returns { response: "...", done: true, ... }
    const textOutput = data.response;
    if (!textOutput || !textOutput.trim()) {
      throw new OllamaServiceError("EMPTY_RESPONSE", "Ollama returned an empty response.");
    }

    // ── Extract JSON from the response text ──
    let islData;
    try {
      islData = JSON.parse(textOutput.trim());
    } catch (parseErr) {
      // Try to find JSON in the response (LLMs sometimes add extra text)
      const jsonMatch = textOutput.match(/\{[\s\S]*"gloss"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          islData = JSON.parse(jsonMatch[0]);
        } catch (innerErr) {
          // Try extracting from code fences
          const fenceMatch = textOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (fenceMatch && fenceMatch[1]) {
            try {
              islData = JSON.parse(fenceMatch[1].trim());
            } catch (fenceErr) {
              throw new OllamaServiceError("PARSE_ERROR",
                `Failed to parse ISL JSON from Ollama response.\nRaw: ${textOutput.substring(0, 400)}`
              );
            }
          } else {
            throw new OllamaServiceError("PARSE_ERROR",
              `Failed to parse ISL JSON from Ollama response.\nRaw: ${textOutput.substring(0, 400)}`
            );
          }
        }
      } else {
        throw new OllamaServiceError("PARSE_ERROR",
          `No JSON found in Ollama response.\nRaw: ${textOutput.substring(0, 400)}`
        );
      }
    }

    console.log("[OllamaService] Successfully parsed ISL response:", islData);
    return islData;
  }


  // ── Custom Error Class ─────────────────────────────────────────────────

  class OllamaServiceError extends Error {
    /**
     * @param {string} code — EMPTY_INPUT, OLLAMA_NOT_RUNNING, NETWORK_ERROR,
     *                        MODEL_NOT_FOUND, SERVER_ERROR, API_ERROR,
     *                        EMPTY_RESPONSE, PARSE_ERROR
     * @param {string} message
     */
    constructor(code, message) {
      super(message);
      this.name = "OllamaServiceError";
      this.code = code;
    }
  }


  // ── Public API ─────────────────────────────────────────────────────────
  return {
    translate,
    isAvailable,
    setEndpoint,
    setModel,
    getEndpoint,
    getModel,
    OllamaServiceError,
    ISL_PROMPT_PREFIX
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.OllamaService = OllamaService;
}
if (typeof self !== "undefined" && typeof window === "undefined") {
  self.OllamaService = OllamaService;
}
