/**
 * POPUP SCRIPT — popup/popup.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the extension settings dashboard. Loads and saves API keys for
 * the various video models in chrome.storage.local and updates validation badges.
 */

document.addEventListener("DOMContentLoaded", () => {
  console.log("[SignBrowse Popup] Initialized.");

  const keyInputs = {
    veoApiKey: document.getElementById("veo-key"),
    veoProjectId: document.getElementById("veo-project"),
    veoStorageUri: document.getElementById("veo-storage"),
    runwayApiKey: document.getElementById("runway-key"),
    klingApiKey: document.getElementById("kling-key"),
    lumaApiKey: document.getElementById("luma-key"),
    pikaApiKey: document.getElementById("pika-key")
  };

  const statusBadges = {
    veoApiKey: document.getElementById("veo-status"),
    runwayApiKey: document.getElementById("runway-status"),
    klingApiKey: document.getElementById("kling-status"),
    lumaApiKey: document.getElementById("luma-status"),
    pikaApiKey: document.getElementById("pika-status")
  };

  const saveBtn = document.getElementById("save-keys-btn");

  // Load saved credentials
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(Object.keys(keyInputs), (saved) => {
      Object.keys(keyInputs).forEach(key => {
        if (saved[key]) {
          keyInputs[key].value = saved[key];
          updateBadge(key, true);
        } else {
          updateBadge(key, false);
        }
      });
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

  // Save Settings Clicked
  saveBtn.addEventListener("click", () => {
    const updatedKeys = {};
    Object.keys(keyInputs).forEach(key => {
      updatedKeys[key] = keyInputs[key].value.trim();
    });

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(updatedKeys, () => {
        console.log("[SignBrowse Popup] Settings saved.");

        // Refresh badge displays
        Object.keys(keyInputs).forEach(key => {
          updateBadge(key, !!updatedKeys[key]);
        });

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

        // Broadcast change event to active tabs to refresh cached status
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: "UPDATE_API_STATUS" }).catch(() => {});
          });
        });
      });
    }
  });
});
