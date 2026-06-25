/**
 * BACKGROUND / SERVICE WORKER
 * ─────────────────────────────────────────────────────────────────────────────
 * In Manifest V3, the traditional "background page" is replaced by a
 * Service Worker. It wakes up only when needed (e.g. when a message arrives
 * or a browser event fires), does its work, then goes back to sleep.
 *
 * This file is responsible for:
 *  1. Creating the right-click context menu item.
 *  2. Listening for a click on that menu item.
 *  3. Sending a message to the content script on the active tab.
 */

// Load AI video providers and other modules required by background logic
try {
  importScripts(
    "../video-providers/base-provider.js",
    "../video-providers/veo-provider.js",
    "../video-providers/runway-provider.js",
    "../video-providers/kling-provider.js",
    "../video-providers/luma-provider.js",
    "../video-providers/pika-provider.js"
  );
} catch (e) {
  console.warn("[SignBrowse SW] importScripts not available in current execution context:", e);
}

// ─── 1. CREATE CONTEXT MENU ──────────────────────────────────────────────────
// We create the menu item once — when the extension is first installed or
// updated — to avoid duplicate entries appearing every time the service
// worker restarts.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "signbrowse-translate",          // Unique ID we'll reference later
    title: "🤟 Translate to Sign Language", // Text shown in the right-click menu
    contexts: ["selection"]              // Only appears when text is selected
  });

  console.log("[SignBrowse] Extension installed. Context menu created.");
});


// ─── 2. LISTEN FOR CONTEXT MENU CLICK ────────────────────────────────────────
// `chrome.contextMenus.onClicked` fires whenever our menu item is clicked.
// `info` contains details about the click (e.g. which text was selected).
// `tab`  contains details about the browser tab where it happened.

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "signbrowse-translate") return; // Guard: only our item

  const selectedText = info.selectionText?.trim();

  if (!selectedText) {
    console.warn("[SignBrowse] No text selected.");
    return;
  }

  console.log(`[SignBrowse] Text selected: "${selectedText}"`);

  // ─── 3. SEND MESSAGE TO CONTENT SCRIPT ─────────────────────────────────────
  // The service worker cannot directly manipulate the DOM of a webpage.
  // Instead, we send a message to our content script (which *is* injected
  // into the page) and let it handle showing the overlay.
  //
  // chrome.tabs.sendMessage(tabId, message, callback)

  function sendMessageToTab(text) {
    chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_SIGN_OVERLAY",
      payload: {
        text: text
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        console.warn(`[SignBrowse] Message sending failed: ${errorMsg}`);

        // If connection fails, inject script dynamically and retry
        if (errorMsg.includes("Could not establish connection") || errorMsg.includes("Receiving end does not exist")) {
          console.log("[SignBrowse] Attempting dynamic content script injection...");

          chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["styles/overlay.css"]
          }).then(() => {
            return chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: [
                "engine/isl-dictionary.js",
                "engine/grammar.js",
                "engine/translator.js",
                "engine/prompt-generator/signer-profile.js",
                "engine/prompt-generator/prompt-templates.js",
                "engine/prompt-generator/prompt-builder.js",
                "video-providers/base-provider.js",
                "video-providers/veo-provider.js",
                "video-providers/runway-provider.js",
                "video-providers/kling-provider.js",
                "video-providers/luma-provider.js",
                "video-providers/pika-provider.js",
                "engine/prompt-generator/video-request.js",
                "engine/prompt-generator/prompt-generator.js",
                "content/content.js"
              ]
            });
          }).then(() => {
            console.log("[SignBrowse] Content script dynamically injected. Retrying message...");
            // Small timeout to allow script initialization
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, {
                type: "SHOW_SIGN_OVERLAY",
                payload: { text: text }
              });
            }, 100);
          }).catch(err => {
            console.error("[SignBrowse] Dynamic injection failed:", err);
          });
        }
      }
    });
  }

  sendMessageToTab(selectedText);
});


// ─── 4. LISTEN FOR MESSAGES FROM CONTENT SCRIPT ──────────────────────────────
// In future phases, the content script may need to ask the service worker
// for things (e.g. fetch translation from an API). We set up the listener
// now as a clean extension point.

// Active jobs dictionary
const activeJobs = {};

// Research metrics logging helper
function logResearchMetric(model, promptLength, duration, status, error = null) {
  chrome.storage.local.get({ researchLogs: [] }, (result) => {
    let logs = result.researchLogs;
    if (!Array.isArray(logs)) {
      logs = [];
    }
    logs.push({
      timestamp: new Date().toISOString(),
      model: model,
      promptLength: promptLength,
      durationMs: duration,
      status: status,
      error: error
    });
    chrome.storage.local.set({ researchLogs: logs });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ status: "PONG" }); // Health-check handshake
  } else if (message.type === "PROXY_FETCH_ASSET") {
    const url = message.url;
    console.log("Proxy URL:", url);
    fetch(url)
      .then(response => {
        console.log("Fetch Response:", response);
        console.log("Response Status:", response?.status);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.blob();
      })
      .then(blob => {
        return blob.arrayBuffer().then(buffer => {
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const len = bytes.byteLength;
          const chunk = 8192;
          for (let i = 0; i < len; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
          }
          const base64 = btoa(binary);
          const dataUrl = `data:${blob.type || 'image/gif'};base64,${base64}`;
          return dataUrl;
        });
      })
      .then(dataUrl => {
        sendResponse({ status: "success", dataUrl: dataUrl });
      })
      .catch(error => {
        console.error("[SignBrowse SW] Proxy fetch failed:", error);
        sendResponse({ status: "error", message: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "START_VIDEO_JOB") {
    const { model, prompt, signer } = message.payload;
    console.log(`[SignBrowse SW] START_VIDEO_JOB: model=${model}, promptLength=${prompt.length}`);
    
    chrome.storage.local.get([
      "veoApiKey",
      "veoProjectId",
      "veoStorageUri",
      "runwayApiKey",
      "klingApiKey",
      "lumaApiKey",
      "pikaApiKey"
    ], async (keys) => {
      try {
        let providerInstance = null;
        
        switch (model) {
          case "google-veo":
            providerInstance = new VeoVideoProvider(keys.veoApiKey || "mock", keys.veoProjectId, keys.veoStorageUri);
            break;
          case "runway-gen3":
          case "runway-gen4":
            providerInstance = new RunwayVideoProvider(keys.runwayApiKey || "mock");
            break;
          case "kling-ai":
            providerInstance = new KlingVideoProvider(keys.klingApiKey || "mock");
            break;
          case "luma-dream-machine":
            providerInstance = new LumaVideoProvider(keys.lumaApiKey || "mock");
            break;
          case "pika":
            providerInstance = new PikaVideoProvider(keys.pikaApiKey || "mock");
            break;
          default:
            throw new Error(`Unsupported model selected: ${model}`);
        }

        console.log(`[SignBrowse SW] Instantiated provider for ${model}. Creating job...`);
        const jobResult = await providerInstance.createJob(prompt, signer);
        
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        activeJobs[jobId] = {
          jobId: jobId,
          model: model,
          providerJobId: jobResult.jobId,
          provider: providerInstance,
          promptLength: prompt.length,
          startTime: Date.now()
        };

        console.log(`[SignBrowse SW] Job created: jobId=${jobId}, providerJobId=${jobResult.jobId}`);
        sendResponse({ status: "success", jobId: jobId, state: "queued" });
      } catch (err) {
        console.error("[SignBrowse SW] Failed to start video job:", err);
        logResearchMetric(model, prompt.length, 0, "failed", err.message);
        sendResponse({ status: "error", message: err.message });
      }
    });
    return true; // async response
  } else if (message.type === "GET_VIDEO_JOB_STATUS") {
    const { jobId } = message.payload;
    const job = activeJobs[jobId];
    
    if (!job) {
      sendResponse({ status: "error", message: `Job ${jobId} not found in active jobs.` });
      return;
    }

    job.provider.getJobStatus(job.providerJobId)
      .then(result => {
        if (result.status === "completed") {
          const duration = Date.now() - job.startTime;
          logResearchMetric(job.model, job.promptLength, duration, "completed");
          delete activeJobs[jobId];
        } else if (result.status === "failed") {
          const duration = Date.now() - job.startTime;
          logResearchMetric(job.model, job.promptLength, duration, "failed", result.error);
          delete activeJobs[jobId];
        }
        sendResponse({ status: "success", ...result });
      })
      .catch(err => {
        console.error(`[SignBrowse SW] Failed to check status for job ${jobId}:`, err);
        const duration = Date.now() - job.startTime;
        logResearchMetric(job.model, job.promptLength, duration, "failed", err.message);
        delete activeJobs[jobId];
        sendResponse({ status: "error", message: err.message });
      });
    return true; // async response
  }
  // Phase 3+: handle "TRANSLATE_REQUEST" here
});
