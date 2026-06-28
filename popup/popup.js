/**
 * POPUP SCRIPT — popup/popup.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the extension popup UI:
 *   - API key management (Gemini + legacy video providers)
 *   - Translation input → GeminiService → ISL results display
 *   - Gloss pills, JSON viewer, avatar placeholder
 *
 * Depends on (loaded before this script in popup.html):
 *   - services/gemini-service.js   → GeminiService
 *   - models/isl-parser.js         → ISLParser
 *   - controllers/translation-controller.js → TranslationController
 */

document.addEventListener("DOMContentLoaded", () => {
  console.log("[SignBrowse Popup] Initialized — Phase 8 (LLM-Driven ISL)");

  // ═══════════════════════════════════════════════════════════════════════════
  //  1. API KEY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const providerSelect = document.getElementById("ai-provider");
  const providerStatus = document.getElementById("provider-status");

  const keyInputs = {
    geminiApiKey: document.getElementById("gemini-key"),
    veoApiKey: document.getElementById("veo-key"),
    veoProjectId: document.getElementById("veo-project"),
    veoStorageUri: document.getElementById("veo-storage"),
    runwayApiKey: document.getElementById("runway-key"),
    klingApiKey: document.getElementById("kling-key"),
    lumaApiKey: document.getElementById("luma-key"),
    pikaApiKey: document.getElementById("pika-key")
  };

  const statusBadges = {
    geminiApiKey: document.getElementById("gemini-status"),
    veoApiKey: document.getElementById("veo-status"),
    runwayApiKey: document.getElementById("runway-status"),
    klingApiKey: document.getElementById("kling-status"),
    lumaApiKey: document.getElementById("luma-status"),
    pikaApiKey: document.getElementById("pika-status")
  };

  const saveBtn = document.getElementById("save-keys-btn");

  // Load saved credentials & provider
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([...Object.keys(keyInputs), "aiProvider"], (saved) => {
      // Load keys
      Object.keys(keyInputs).forEach(key => {
        if (saved[key] && keyInputs[key]) {
          keyInputs[key].value = saved[key];
          updateBadge(key, true);
        } else {
          updateBadge(key, false);
        }
      });

      // Load provider selection
      if (saved.aiProvider && providerSelect) {
        providerSelect.value = saved.aiProvider;
      }
      
      updateTranslateButtonState();
      checkOllamaStatus();
    });
  }

  function updateBadge(key, isConnected) {
    const badge = statusBadges[key];
    if (!badge) return;
    if (isConnected) {
      badge.textContent = "Connected";
      badge.className = "api-status connected";
    } else {
      badge.textContent = "Missing Key";
      badge.className = "api-status missing";
    }
  }

  // Live status check for Ollama when selected
  async function checkOllamaStatus() {
    if (!providerSelect || !providerStatus) return;
    if (providerSelect.value === "ollama") {
      providerStatus.textContent = "Checking...";
      providerStatus.className = "provider-status checking";
      if (typeof OllamaService !== "undefined") {
        const running = await OllamaService.isAvailable();
        if (running) {
          providerStatus.textContent = "Online";
          providerStatus.className = "provider-status online";
        } else {
          providerStatus.textContent = "Offline";
          providerStatus.className = "provider-status offline";
        }
      }
    } else {
      providerStatus.textContent = "";
      providerStatus.className = "provider-status";
    }
  }

  if (providerSelect) {
    providerSelect.addEventListener("change", () => {
      updateTranslateButtonState();
      checkOllamaStatus();
    });
  }

  // Save Settings
  saveBtn.addEventListener("click", () => {
    const updatedSettings = {};
    Object.keys(keyInputs).forEach(key => {
      if (keyInputs[key]) {
        updatedSettings[key] = keyInputs[key].value.trim();
      }
    });

    if (providerSelect) {
      updatedSettings.aiProvider = providerSelect.value;
    }

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(updatedSettings, () => {
        console.log("[SignBrowse Popup] Settings saved.");

        // Refresh badge displays
        Object.keys(keyInputs).forEach(key => {
          updateBadge(key, !!updatedSettings[key]);
        });

        // Clear service caches
        if (typeof GeminiService !== "undefined" && GeminiService.clearCache) {
          GeminiService.clearCache();
        }
        if (typeof AIProviderManager !== "undefined") {
          AIProviderManager.clearCache();
          if (updatedSettings.aiProvider) {
            AIProviderManager.setProvider(updatedSettings.aiProvider);
          }
        }

        updateTranslateButtonState();
        checkOllamaStatus();

        // Button Save Feedback
        const originalText = saveBtn.textContent;
        saveBtn.textContent = "Saved ✓";
        saveBtn.style.background = "#10b981";
        saveBtn.style.boxShadow = "0 4px 10px rgba(16, 185, 129, 0.4)";
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.background = "";
          saveBtn.style.boxShadow = "";
        }, 1500);

        // Broadcast change event to active tabs
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: "UPDATE_API_STATUS" }).catch(() => {});
          });
        });
      });
    }
  });


  // ═══════════════════════════════════════════════════════════════════════════
  //  2. TRANSLATION PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  const translateInput = document.getElementById("translate-input");
  const translateBtn = document.getElementById("translate-btn");
  const translateBtnText = document.querySelector(".translate-btn-text");
  const loadingEl = document.getElementById("translate-loading");
  const loadingText = loadingEl?.querySelector(".loading-text");
  const errorEl = document.getElementById("translate-error");
  const errorMsg = document.getElementById("translate-error-msg");
  const resultsEl = document.getElementById("translate-results");
  const resultOriginal = document.getElementById("result-original");
  const resultGloss = document.getElementById("result-gloss");
  const resultJson = document.getElementById("result-json");
  const resultElapsed = document.getElementById("result-elapsed");
  const avatarPanel = document.getElementById("avatar-panel");

  function updateTranslateButtonState() {
    const provider = providerSelect ? providerSelect.value : "ollama";
    
    if (provider === "gemini") {
      const geminiKey = keyInputs.geminiApiKey?.value?.trim();
      if (!geminiKey) {
        translateBtn.title = "Set your Gemini API key first";
      } else {
        translateBtn.title = "Translate text to ISL using Gemini";
      }
    } else {
      translateBtn.title = "Translate text to ISL using local Ollama (llama3.2)";
    }
  }

  // Handle Translate button click
  translateBtn.addEventListener("click", async () => {
    const text = translateInput.value.trim();
    if (!text) {
      showError("Please enter some text to translate.");
      return;
    }

    const provider = providerSelect ? providerSelect.value : "ollama";

    // Check Gemini API key if Gemini is selected
    if (provider === "gemini") {
      const geminiKey = keyInputs.geminiApiKey?.value?.trim();
      if (!geminiKey) {
        showError("Gemini API key is not configured. Please add it in API Settings below and click Save.");
        return;
      }
    }

    // Set provider in manager before running translation just in case
    if (typeof AIProviderManager !== "undefined") {
      await AIProviderManager.setProvider(provider);
    }

    await runTranslation(text);
  });

  // Allow Ctrl+Enter to trigger translation
  translateInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      translateBtn.click();
    }
  });

  async function runTranslation(text) {
    // Reset UI states
    hideError();
    hideResults();
    
    const provider = providerSelect ? providerSelect.value : "ollama";
    const providerLabel = provider === "gemini" ? "Gemini API" : "Ollama (Local)";
    
    showLoading(`Translating via ${providerLabel}...`);
    translateBtn.disabled = true;

    try {
      // Use TranslationController which calls AIProviderManager + ISLParser
      const result = await TranslationController.process(text, {
        onStart: () => {
          console.log(`[Popup] Translation started via ${provider}`);
        },
        onProgress: (stage, message) => {
          if (loadingText) loadingText.textContent = message;
        }
      });

      hideLoading();
      translateBtn.disabled = false;

      if (result.success) {
        showResults(result);
      } else {
        const errMessage = result.errors.length > 0
          ? result.errors.join("\n")
          : "Translation failed — unknown error.";
        showError(errMessage);
      }

    } catch (err) {
      hideLoading();
      translateBtn.disabled = false;
      showError(err.message || "An unexpected error occurred.");
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  3. UI STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function showLoading(message) {
    if (loadingEl) loadingEl.classList.remove("hidden");
    if (loadingText) loadingText.textContent = message || "Processing...";
  }

  function hideLoading() {
    if (loadingEl) loadingEl.classList.add("hidden");
  }

  function showError(message) {
    if (errorEl) errorEl.classList.remove("hidden");
    if (errorMsg) errorMsg.textContent = message;
  }

  function hideError() {
    if (errorEl) errorEl.classList.add("hidden");
  }

  function hideResults() {
    if (resultsEl) resultsEl.classList.add("hidden");
    if (avatarPanel) avatarPanel.classList.add("hidden");
  }

  function showResults(result) {
    if (!resultsEl) return;

    // Original text
    if (resultOriginal) {
      resultOriginal.textContent = result.inputText || "";
    }

    // Gloss pills
    if (resultGloss) {
      resultGloss.innerHTML = "";
      if (result.gloss && result.gloss.length > 0) {
        result.gloss.forEach((word, i) => {
          const pill = document.createElement("span");
          pill.className = "gloss-pill";
          pill.innerHTML = `<span class="gloss-pill-index">${i + 1}</span>${word}`;
          resultGloss.appendChild(pill);
        });
      } else {
        resultGloss.innerHTML = '<span style="color:#666;font-size:11px;">No gloss data returned.</span>';
      }
    }

    // JSON viewer
    if (resultJson) {
      try {
        resultJson.textContent = JSON.stringify(result.raw, null, 2);
      } catch (e) {
        resultJson.textContent = "Unable to display JSON response.";
      }
    }

    // Elapsed time badge
    if (resultElapsed) {
      resultElapsed.textContent = `${result.elapsed}s`;
    }

    // Show results
    resultsEl.classList.remove("hidden");

    // Show avatar panel
    if (avatarPanel) avatarPanel.classList.remove("hidden");

    // Log warnings if any
    if (result.warnings && result.warnings.length > 0) {
      console.warn("[Popup] Translation warnings:", result.warnings);
    }
  }
});
