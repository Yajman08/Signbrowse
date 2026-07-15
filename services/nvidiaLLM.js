/**
 * NVIDIA LLM SERVICE — services/nvidiaLLM.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Service module for communicating with the NVIDIA Build API.
 * Uses meta/llama-3.1-8b-instruct for English → ISL Gloss translation.
 *
 * Endpoint: POST https://integrate.api.nvidia.com/v1/chat/completions
 * Auth: Bearer token from chrome.storage.local ("nvidiaApiKey")
 *
 * Implements the same translate(text) interface as OllamaService / GeminiService
 * so providers are interchangeable via AIProviderManager.
 *
 * Public API:
 *   NvidiaLLMService.translate(text) → Promise<{ gloss, motions }>
 *   NvidiaLLMService.isAvailable()   → Promise<boolean>
 *   NvidiaLLMService.setApiKey(key)
 *   NvidiaLLMService.setModel(model)
 */

const NvidiaLLMService = (() => {

  // ── Configuration ──────────────────────────────────────────────────────
  const _endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";
  let _model = "meta/llama-3.1-8b-instruct";
  let _apiKey = "";

  // ── System Prompt ─────────────────────────────────────────────────────
  const ISL_SYSTEM_PROMPT = "You are an expert Indian Sign Language (ISL) translator. Convert English into ISL gloss. Return ONLY valid JSON. Format: {\"gloss\":[\"WORD1\",\"WORD2\"]}. No explanations. No markdown. Use uppercase words.";

  // ── Request Config ─────────────────────────────────────────────────────
  const FETCH_TIMEOUT_MS = 30000;   // 30-second timeout per attempt
  const MAX_RETRIES = 1;            // retry once on 504


  // ── Configuration Methods ──────────────────────────────────────────────

  function setApiKey(key) {
    _apiKey = key || "";
    console.log(`[NvidiaLLM] API key ${_apiKey ? "SET" : "CLEARED"} (length: ${_apiKey.length})`);
  }

  function getApiKey() {
    if (!_apiKey) return "";
    return _apiKey.substring(0, 8) + "..." + _apiKey.substring(_apiKey.length - 4);
  }

  function setModel(model) {
    _model = model || "meta/llama-3.1-8b-instruct";
  }

  function getModel() {
    return _model;
  }

  function getEndpoint() {
    return _endpoint;
  }


  // ── Availability Check ─────────────────────────────────────────────────

  async function isAvailable() {
    try {
      if (!_apiKey) {
        await _loadApiKeyFromStorage();
      }
      return !!_apiKey && _apiKey.trim().length > 0;
    } catch (e) {
      console.error("[NvidiaLLM] isAvailable() error:", e);
      return false;
    }
  }

  function _loadApiKeyFromStorage() {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get("nvidiaApiKey", (result) => {
            if (chrome.runtime.lastError) {
              console.warn("[NvidiaLLM] Storage read error:", chrome.runtime.lastError.message);
              resolve();
              return;
            }
            if (result.nvidiaApiKey) {
              _apiKey = result.nvidiaApiKey;
              console.log(`[NvidiaLLM] Loaded API key from storage (length: ${_apiKey.length})`);
            } else {
              console.warn("[NvidiaLLM] No nvidiaApiKey found in chrome.storage.local");
            }
            resolve();
          });
        } else {
          console.warn("[NvidiaLLM] chrome.storage.local not available");
          resolve();
        }
      } catch (e) {
        console.error("[NvidiaLLM] _loadApiKeyFromStorage exception:", e);
        resolve(); // Never leave pending
      }
    });
  }


  // ── Translation ────────────────────────────────────────────────────────

  async function translate(text) {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("[NvidiaLLM] Request started");
    console.log("[NvidiaLLM] Input text:", JSON.stringify(text));

    if (!text || typeof text !== "string" || !text.trim()) {
      throw new NvidiaServiceError("EMPTY_INPUT", "No text provided for translation.");
    }

    try {
      if (!_apiKey) {
        await _loadApiKeyFromStorage();
      }
    } catch (keyErr) {
      console.error("[NvidiaLLM] Could not load API key:", keyErr);
      throw new NvidiaServiceError("API_KEY_MISSING", "Failed to load NVIDIA API key from storage.");
    }

    if (!_apiKey || !_apiKey.trim()) {
      throw new NvidiaServiceError(
        "API_KEY_MISSING",
        "NVIDIA API Key is not configured. Go to SignBrowse Settings and enter your NVIDIA API Key."
      );
    }

    const cleanText = text.trim();

    const requestBody = {
      model: _model,
      temperature: 0.1,
      top_p: 0.7,
      max_tokens: 128,
      stream: false,
      messages: [
        { role: "system", content: ISL_SYSTEM_PROMPT },
        { role: "user", content: cleanText }
      ]
    };

    const bodyJSON = JSON.stringify(requestBody);
    let response = null;
    let attempt = 0;
    const totalStart = performance.now();

    while (attempt <= MAX_RETRIES) {
      attempt++;
      const attemptStart = performance.now();
      
      console.log("NVIDIA Request Sent");
      console.log(`[NvidiaLLM] Attempt ${attempt}/${MAX_RETRIES + 1} for model ${_model}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        response = await fetch(_endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${_apiKey}`
          },
          body: bodyJSON,
          signal: controller.signal
        });
      } catch (networkErr) {
        clearTimeout(timeoutId);
        const dur = ((performance.now() - attemptStart) / 1000).toFixed(2);
        console.log(`[NvidiaLLM] Attempt ${attempt} finished with exception in ${dur}s`);

        if (networkErr.name === "AbortError") {
          if (attempt <= MAX_RETRIES) {
            console.log("[NvidiaLLM] Request timed out. Retrying in 2 seconds...");
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw new NvidiaServiceError("TIMEOUT", "NVIDIA API temporarily unavailable.");
        }

        if (attempt <= MAX_RETRIES) {
          console.log("[NvidiaLLM] Network error. Retrying in 2 seconds...");
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw new NvidiaServiceError("NETWORK_ERROR", `Network request failed: ${networkErr.message}`);
      }
      clearTimeout(timeoutId);

      const dur = ((performance.now() - attemptStart) / 1000).toFixed(2);
      console.log("[NvidiaLLM] NVIDIA Response Received");
      console.log(`[NvidiaLLM] Request duration: ${dur}s. HTTP Status: ${response.status}`);

      // Retry on 504 Gateway Timeout
      if (response.status === 504) {
        if (attempt <= MAX_RETRIES) {
          console.warn(`[NvidiaLLM] Got 504 on attempt ${attempt} — retrying in 2 seconds...`);
          response = null;
          await new Promise(r => setTimeout(r, 2000));
          continue;
        } else {
          throw new NvidiaServiceError("TIMEOUT", "NVIDIA API temporarily unavailable.");
        }
      }

      break;
    }

    const totalDur = ((performance.now() - totalStart) / 1000).toFixed(2);
    console.log(`[NvidiaLLM] Request completed in ${totalDur}s`);

    if (!response) {
      throw new NvidiaServiceError("TIMEOUT", "NVIDIA API temporarily unavailable.");
    }

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = "Could not read error body";
      }
      console.error("[NvidiaLLM] API Error Details:", errorText);

      let serverMsg = errorText;
      try {
        const errObj = JSON.parse(errorText);
        serverMsg = errObj.message || errObj.error?.message || errorText;
      } catch (_) {}

      if (response.status === 504) {
        throw new NvidiaServiceError("TIMEOUT", "NVIDIA API temporarily unavailable.");
      }
      throw new NvidiaServiceError("API_ERROR", `NVIDIA API error: ${serverMsg}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonErr) {
      throw new NvidiaServiceError("PARSE_ERROR", "Failed to parse NVIDIA API response JSON.");
    }

    const textOutput = data.choices?.[0]?.message?.content;
    console.log("[NvidiaLLM] Raw response:", textOutput);

    if (!textOutput || !textOutput.trim()) {
      throw new NvidiaServiceError("EMPTY_RESPONSE", "NVIDIA API returned an empty response.");
    }

    const islData = _parseISLJson(textOutput);
    console.log("Gloss Parsed");
    console.log("[NvidiaLLM] Parsed JSON:", JSON.stringify(islData));
    console.log("[NvidiaLLM] Final gloss array:", JSON.stringify(islData.gloss));
    console.log("═══════════════════════════════════════════════════════════");
    return islData;
  }


  // ── JSON Extraction Helper ──────────────────────────────────────────────

  function _parseISLJson(raw) {
    const trimmed = raw.trim();
    // 1. Direct parse
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && Array.isArray(parsed.gloss)) return parsed;
    } catch (_) { /* fall through */ }

    // 2. Regex: find {"gloss":...}
    const jsonMatch = trimmed.match(/\{[\s\S]*"gloss"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && Array.isArray(parsed.gloss)) return parsed;
      } catch (_) { /* fall through */ }
    }

    // 3. Code fences
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch && fenceMatch[1]) {
      try {
        const parsed = JSON.parse(fenceMatch[1].trim());
        if (parsed && Array.isArray(parsed.gloss)) return parsed;
      } catch (_) { /* fall through */ }
    }

    console.error("Raw model output:", raw);
    throw new NvidiaServiceError("PARSE_ERROR", "Translation Failed");
  }


  // ── Custom Error Class ─────────────────────────────────────────────────

  class NvidiaServiceError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "NvidiaServiceError";
      this.code = code;
    }
  }


  // ── Public API ─────────────────────────────────────────────────────────
  return {
    translate,
    isAvailable,
    setApiKey,
    getApiKey,
    setModel,
    getModel,
    getEndpoint,
    NvidiaServiceError,
    ISL_SYSTEM_PROMPT
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.NvidiaLLMService = NvidiaLLMService;
}
if (typeof self !== "undefined" && typeof window === "undefined") {
  self.NvidiaLLMService = NvidiaLLMService;
}
