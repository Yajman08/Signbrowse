/**
 * POPUP SCRIPT — popup/popup.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the SignBrowse Settings Popup.
 * Handles loading, saving, and validating preferences (AI Provider, Signer, API keys).
 * Displays a live status indicator for the local Ollama instance.
 */

document.addEventListener("DOMContentLoaded", () => {
  console.log("[SignBrowse Settings] Initializing settings popup...");

  // ═══════════════════════════════════════════════════════════════════════════
  //  1. DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const saveBtn = document.getElementById("save-keys-btn");
  const aiProviderSelect = document.getElementById("ai-provider");
  const signerSelect = document.getElementById("signer-select");
  const translationModeSelect = document.getElementById("translation-mode");
  const providerStatus = document.getElementById("provider-status");

  const keyInputs = {
    nvidiaApiKey: document.getElementById("nvidia-key"),
    geminiApiKey: document.getElementById("gemini-key"),
    ollamaModel: document.getElementById("ollama-model"),
    ollamaEndpoint: document.getElementById("ollama-endpoint"),
    json2videoApiKey: document.getElementById("json2video-key"),
    veoApiKey: document.getElementById("veo-key"),
    veoProjectId: document.getElementById("veo-project"),
    veoStorageUri: document.getElementById("veo-storage"),
    runwayApiKey: document.getElementById("runway-key"),
    klingApiKey: document.getElementById("kling-key"),
    lumaApiKey: document.getElementById("luma-key"),
    pikaApiKey: document.getElementById("pika-key")
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  2. LOAD CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([...Object.keys(keyInputs), "aiProvider", "selectedSigner", "translationMode"], (saved) => {
      // Load input values
      Object.keys(keyInputs).forEach(key => {
        if (saved[key] !== undefined && keyInputs[key]) {
          keyInputs[key].value = saved[key];
        }
      });

      // Load AI Provider
      if (saved.aiProvider && aiProviderSelect) {
        aiProviderSelect.value = saved.aiProvider;
      }

      // Load Signer
      if (saved.selectedSigner && signerSelect) {
        signerSelect.value = saved.selectedSigner;
      }

      // Load Translation Mode
      if (saved.translationMode && translationModeSelect) {
        translationModeSelect.value = saved.translationMode;
      }

      // Apply Ollama settings to the service if saved
      applyOllamaConfiguration();

      // Apply NVIDIA settings if saved
      applyNvidiaConfiguration();

      // Check provider status
      checkProviderStatus();
    });
  }

  function applyOllamaConfiguration() {
    if (typeof OllamaService !== "undefined") {
      const model = keyInputs.ollamaModel?.value?.trim() || "llama3.2";
      const endpoint = keyInputs.ollamaEndpoint?.value?.trim() || "http://localhost:11434/api/generate";
      OllamaService.setModel(model);
      OllamaService.setEndpoint(endpoint);
    }
  }

  function applyNvidiaConfiguration() {
    if (typeof NvidiaLLMService !== "undefined") {
      const key = keyInputs.nvidiaApiKey?.value?.trim() || "";
      if (key) {
        NvidiaLLMService.setApiKey(key);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  3. LIVE STATUS CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  async function checkProviderStatus() {
    if (!providerStatus) return;

    const selectedProvider = aiProviderSelect?.value || "nvidia";

    if (selectedProvider === "nvidia") {
      if (typeof NvidiaLLMService !== "undefined") {
        applyNvidiaConfiguration();
        const available = await NvidiaLLMService.isAvailable();
        if (available) {
          providerStatus.textContent = "Key Set";
          providerStatus.className = "provider-status online";
        } else {
          providerStatus.textContent = "No Key";
          providerStatus.className = "provider-status offline";
        }
      }
    } else if (selectedProvider === "ollama") {
      if (typeof OllamaService !== "undefined") {
        applyOllamaConfiguration();
        const running = await OllamaService.isAvailable();
        if (running) {
          providerStatus.textContent = "Online";
          providerStatus.className = "provider-status online";
        } else {
          providerStatus.textContent = "Offline";
          providerStatus.className = "provider-status offline";
        }
      }
    } else if (selectedProvider === "gemini") {
      const key = keyInputs.geminiApiKey?.value?.trim();
      providerStatus.textContent = key ? "Key Set" : "No Key";
      providerStatus.className = key ? "provider-status online" : "provider-status offline";
    }
  }

  // Check status on select change and periodically
  if (aiProviderSelect) {
    aiProviderSelect.addEventListener("change", () => {
      const selectedProvider = aiProviderSelect.value;
      if (typeof AIProviderManager !== "undefined") {
        AIProviderManager.setProvider(selectedProvider);
      }
      checkProviderStatus();
    });
  }

  setInterval(checkProviderStatus, 5000);

  // ═══════════════════════════════════════════════════════════════════════════
  //  4. SAVE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const updatedSettings = {};
      Object.keys(keyInputs).forEach(key => {
        if (keyInputs[key]) {
          updatedSettings[key] = keyInputs[key].value.trim();
        }
      });

      if (aiProviderSelect) updatedSettings.aiProvider = aiProviderSelect.value;
      if (signerSelect) updatedSettings.selectedSigner = signerSelect.value;
      if (translationModeSelect) updatedSettings.translationMode = translationModeSelect.value;

      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(updatedSettings, () => {
          console.log("[SignBrowse Settings] Settings saved successfully.");

          // Apply immediately
          applyOllamaConfiguration();
          applyNvidiaConfiguration();

          // Clear caches
          if (typeof GeminiService !== "undefined" && GeminiService.clearCache) {
            GeminiService.clearCache();
          }
          if (typeof AIProviderManager !== "undefined") {
            AIProviderManager.clearCache();
            if (updatedSettings.aiProvider) {
              AIProviderManager.setProvider(updatedSettings.aiProvider);
            }
          }

          checkProviderStatus();

          // Visual feedback on save button
          const originalText = saveBtn.textContent;
          saveBtn.textContent = "Saved ✓";
          saveBtn.style.background = "#10b981";
          setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = "";
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
  }
});
