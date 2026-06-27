/**
 * GEMINI SERVICE — services/gemini-service.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Core service module for communicating with the Google Gemini API.
 * Handles ISL translation: English text → structured ISL gloss + motions JSON.
 *
 * API key is loaded from chrome.storage.local (key: "geminiApiKey").
 * Never hardcoded. Calls go through the background service worker which has
 * unrestricted fetch access.
 *
 * Public API:
 *   GeminiService.translate(text) → Promise<{ gloss, motions }>
 *   GeminiService.setApiKey(key)
 *   GeminiService.getApiKey() → Promise<string>
 *   GeminiService.hasApiKey() → Promise<boolean>
 */

const GeminiService = (() => {

  // ── Configuration ──────────────────────────────────────────────────────
  const MODEL = "gemini-2.0-flash";
  const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
  const TEMPERATURE = 0.3;          // Lower for more deterministic ISL output
  const MAX_OUTPUT_TOKENS = 4096;

  // In-memory cache (cleared on service worker restart)
  let _cachedApiKey = null;

  // ── System Prompt ──────────────────────────────────────────────────────
  const SYSTEM_PROMPT = `You are an Indian Sign Language (ISL) assistant and linguistic expert.

Your task is to convert English sentences into ISL representation with two outputs:
1. ISL Gloss — an ordered array of sign glosses in ISL word order (SOV structure, dropping articles/prepositions where ISL does).
2. Motions — a structured array describing how each sign is physically performed.

IMPORTANT RULES:
- ISL follows Subject-Object-Verb (SOV) word order, NOT English SVO.
- Drop articles (a, an, the), linking verbs (is, are, am), and prepositions where ISL omits them.
- Use UPPERCASE for all gloss entries.
- For each gloss word, provide a corresponding motion entry.
- If a word has no standard ISL sign, use fingerspelling (set handShape to "Fingerspell").

Return ONLY a valid JSON object with this exact structure:
{
  "gloss": ["WORD1", "WORD2", ...],
  "motions": [
    {
      "gloss": "WORD1",
      "handShape": "<shape name>",
      "location": "<body location>",
      "movement": "<movement description>",
      "expression": "<facial expression>",
      "handedness": "one" | "two",
      "notes": "<optional signing note>"
    }
  ]
}

Valid handShape values: FlatB, OpenB, SpreadC, OpenA, Fist, FistThumbUp, FistThumbOut, IndexPoint, IndexHook, IndexMiddle, Pinch, PinchOpen, FlatO, Claw, ILY, Horn, Relaxed, Fingerspell
Valid location values: Neutral, Forehead, Chin, Chest, Shoulder, Waist, Side, AboveHead, InFront
Valid movement values: None, Forward, Backward, Up, Down, Left, Right, Circular, Arc, Zigzag, Shake, Twist, Wave, Tap, Slide
Valid expression values: Neutral, Happy, Sad, Surprised, Questioning, Negative, Emphasis, Thinking, Affirm

Do NOT include any text, markdown, or explanation outside the JSON object.`;


  // ── API Key Management ─────────────────────────────────────────────────

  /**
   * Loads the Gemini API key from chrome.storage.local.
   * Caches it in memory for subsequent calls within the same session.
   * @returns {Promise<string>} — The API key, or empty string if not set.
   */
  function getApiKey() {
    return new Promise((resolve) => {
      if (_cachedApiKey) {
        resolve(_cachedApiKey);
        return;
      }
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get("geminiApiKey", (result) => {
          _cachedApiKey = result.geminiApiKey || "";
          resolve(_cachedApiKey);
        });
      } else {
        resolve("");
      }
    });
  }

  /**
   * Saves the Gemini API key to chrome.storage.local and updates cache.
   * @param {string} key
   * @returns {Promise<void>}
   */
  function setApiKey(key) {
    return new Promise((resolve) => {
      _cachedApiKey = key || "";
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ geminiApiKey: _cachedApiKey }, resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * Checks whether a Gemini API key is configured.
   * @returns {Promise<boolean>}
   */
  async function hasApiKey() {
    const key = await getApiKey();
    return !!(key && key.length > 10);
  }

  /**
   * Clears the in-memory API key cache (forces reload from storage).
   */
  function clearCache() {
    _cachedApiKey = null;
  }


  // ── Translation ────────────────────────────────────────────────────────

  /**
   * Translates English text to structured ISL representation via Gemini.
   *
   * @param {string} text — English sentence to translate.
   * @returns {Promise<{gloss: string[], motions: object[]}>}
   * @throws {Error} On missing API key, network failure, rate limit, or parse error.
   */
  async function translate(text) {
    if (!text || typeof text !== "string" || !text.trim()) {
      throw new GeminiServiceError("EMPTY_INPUT", "No text provided for translation.");
    }

    const apiKey = await getApiKey();
    if (!apiKey || apiKey.length < 10) {
      throw new GeminiServiceError("MISSING_API_KEY", "Gemini API key is not configured. Please add it in SignBrowse settings.");
    }

    const userPrompt = `Sentence:\n${text.trim()}`;
    const endpoint = `${BASE_URL}/models/${MODEL}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      generationConfig: {
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json"
      }
    };

    console.log(`[GeminiService] Translating: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
    const startTime = performance.now();

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
    } catch (networkErr) {
      throw new GeminiServiceError("NETWORK_ERROR", `Network request failed: ${networkErr.message}`);
    }

    // ── Handle HTTP errors ──
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      
      if (response.status === 401 || response.status === 403) {
        throw new GeminiServiceError("INVALID_API_KEY", `Authentication failed (${response.status}). Check your Gemini API key.`);
      }
      if (response.status === 429) {
        throw new GeminiServiceError("RATE_LIMIT", "Rate limit exceeded. Please wait a moment and try again.");
      }
      if (response.status >= 500) {
        throw new GeminiServiceError("SERVER_ERROR", `Gemini server error (${response.status}). Try again later.`);
      }
      throw new GeminiServiceError("API_ERROR", `Gemini API error ${response.status}: ${errorText.substring(0, 200)}`);
    }

    // ── Parse response ──
    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      throw new GeminiServiceError("PARSE_ERROR", "Failed to parse Gemini API response as JSON.");
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`[GeminiService] Response received in ${elapsed}s`);

    // ── Extract text from candidates ──
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new GeminiServiceError("EMPTY_RESPONSE", "Gemini returned no candidates.");
    }

    const content = candidates[0].content;
    if (!content || !content.parts || content.parts.length === 0) {
      throw new GeminiServiceError("EMPTY_RESPONSE", "Gemini candidate has no content.");
    }

    const textOutput = content.parts[0].text;
    if (!textOutput || !textOutput.trim()) {
      throw new GeminiServiceError("EMPTY_RESPONSE", "Gemini returned an empty text response.");
    }

    // ── Parse the ISL JSON output ──
    let islData;
    try {
      islData = JSON.parse(textOutput);
    } catch (parseErr) {
      // Try extracting from markdown code fences
      const jsonMatch = textOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          islData = JSON.parse(jsonMatch[1].trim());
        } catch (innerErr) {
          throw new GeminiServiceError("PARSE_ERROR", `Failed to parse ISL JSON from Gemini response: ${parseErr.message}`);
        }
      } else {
        throw new GeminiServiceError("PARSE_ERROR", `Failed to parse ISL JSON: ${parseErr.message}\nRaw: ${textOutput.substring(0, 300)}`);
      }
    }

    console.log("[GeminiService] Successfully parsed ISL response:", islData);
    return islData;
  }


  // ── Custom Error Class ─────────────────────────────────────────────────

  class GeminiServiceError extends Error {
    /**
     * @param {string} code — Error code: EMPTY_INPUT, MISSING_API_KEY, NETWORK_ERROR,
     *                        INVALID_API_KEY, RATE_LIMIT, SERVER_ERROR, API_ERROR,
     *                        EMPTY_RESPONSE, PARSE_ERROR
     * @param {string} message — Human-readable error message.
     */
    constructor(code, message) {
      super(message);
      this.name = "GeminiServiceError";
      this.code = code;
    }
  }


  // ── Public API ─────────────────────────────────────────────────────────
  return {
    translate,
    getApiKey,
    setApiKey,
    hasApiKey,
    clearCache,
    GeminiServiceError,
    // Exposed for research/debugging
    SYSTEM_PROMPT,
    MODEL
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.GeminiService = GeminiService;
}
if (typeof self !== "undefined" && typeof window === "undefined") {
  // Service worker context
  self.GeminiService = GeminiService;
}
