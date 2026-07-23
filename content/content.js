/**
 * SIGNBROWSE CONTENT SCRIPT — content/content.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Injects and manages the 3D Translation Console overlay directly on the webpage.
 *
 * Workflow:
 *   1. Listen for "SHOW_SIGN_OVERLAY" message.
 *   2. Create a draggable, resizable floating window near the cursor/selected text.
 *   3. Automatically trigger the Ollama/Gemini translation pipeline.
 *   4. Render the 3D avatar using Three.js inside the window's viewport.
 *   5. Provide playback controls (Play, Pause, Reset) and live status tracking.
 */

if (typeof window.SignBrowseOverlay === "undefined") {

  const SignBrowseOverlay = (() => {

    let overlayEl = null;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let isMinimized = false;
    let currentGlossWords = [];

    /**
     * Initializes the content script message listeners.
     */
    function init() {
      console.log("[SignBrowse Content] Initializing content script overlay...");

      // Listen for show overlay messages from the background service worker
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "SHOW_SIGN_OVERLAY") {
          const text = message.payload.text;
          
          const existingOverlay = document.getElementById("signbrowse-overlay");
          if (existingOverlay) {
            console.log("[SignBrowse Content] Overlay already exists. Updating translation in place.");
            
            // Update selected English text
            const selectedTextEl = existingOverlay.querySelector(".sb-selected-text");
            if (selectedTextEl) {
              selectedTextEl.textContent = text;
            }
            
            // Reset gloss output
            const glossOutput = existingOverlay.querySelector("#sb-gloss-output");
            if (glossOutput) {
              glossOutput.innerHTML = '<span class="sb-placeholder">Translating...</span>';
            }
            
            // Reset avatar pose
            if (window.AvatarController) {
              window.AvatarController.resetPose();
            }
            
            // Trigger translation again (without reloading Three.js)
            triggerTranslation(text, existingOverlay);
            
            sendResponse({ status: "updated" });
            return true;
          }

          showOverlay(text);
          sendResponse({ status: "success" }); // Cleanly respond to close the message port
        }
        return true;
      });
    }

    /**
     * Creates and displays the floating translation window.
     */
    function showOverlay(text) {
      // 7. Log overlay creation
      console.log("[SignBrowse Content] Overlay Created");

      // 1. Build the DOM structure
      overlayEl = buildOverlayDOM(text);
      document.body.appendChild(overlayEl);
      console.log("[SignBrowse Content] Overlay Added to DOM");

      // 2. Position the window near the mouse or selection
      positionOverlay(overlayEl);

      // 3. Attach drag, control, and keyboard handlers
      attachDragHandlers(overlayEl);
      attachControlHandlers(overlayEl);
      attachKeyboardHandlers();

      // 4. Trigger the translation pipeline & load 3D avatar
      runTranslationAndRender(text, overlayEl);
    }

    /**
     * Builds the floating window DOM elements.
     */
    function buildOverlayDOM(originalText) {
      const wrapper = document.createElement("div");
      wrapper.id = "signbrowse-overlay";
      wrapper.className = "sb-overlay-console";

      // ── Header ──
      const header = document.createElement("div");
      header.className = "sb-header";

      const logo = document.createElement("span");
      logo.className = "sb-logo";
      logo.textContent = "SignBrowse";

      const headerControls = document.createElement("div");
      headerControls.className = "sb-header-controls";

      const minBtn = document.createElement("button");
      minBtn.className = "sb-min-btn";
      minBtn.title = "Minimize";
      minBtn.textContent = "─";

      const closeBtn = document.createElement("button");
      closeBtn.className = "sb-close-btn";
      closeBtn.title = "Close";
      closeBtn.textContent = "✕";

      headerControls.appendChild(minBtn);
      headerControls.appendChild(closeBtn);
      header.appendChild(logo);
      header.appendChild(headerControls);
      wrapper.appendChild(header);

      // ── Console Body (Contains everything else) ──
      const consoleBody = document.createElement("div");
      consoleBody.className = "sb-console-body";
      consoleBody.id = "sb-console-body";

      // ── Main Three.js Viewport ──
      const viewportPanel = document.createElement("div");
      viewportPanel.className = "sb-panel sb-viewport-panel";

      const viewportContainer = document.createElement("div");
      viewportContainer.className = "sb-viewport-container";
      viewportContainer.id = "sb-viewport-container";

      // Loading Overlay
      const loadingOverlay = document.createElement("div");
      loadingOverlay.className = "sb-viewport-overlay";
      loadingOverlay.id = "sb-avatar-loading";
      loadingOverlay.innerHTML = `
        <div class="sb-loading-spinner"></div>
        <span>Syncing 3D Avatar...</span>
      `;

      // Error Overlay
      const errorOverlay = document.createElement("div");
      errorOverlay.className = "sb-viewport-overlay sb-hidden error-overlay";
      errorOverlay.id = "sb-avatar-error";
      errorOverlay.innerHTML = `<span>⚠️ Unable to load avatar.</span>`;

      // Canvas
      const canvas = document.createElement("canvas");
      canvas.id = "sb-avatar-canvas";

      viewportContainer.appendChild(loadingOverlay);
      viewportContainer.appendChild(errorOverlay);
      viewportContainer.appendChild(canvas);
      viewportPanel.appendChild(viewportContainer);
      consoleBody.appendChild(viewportPanel);

      // ── Playback Controls ──
      const playbackPanel = document.createElement("div");
      playbackPanel.className = "sb-panel sb-playback-panel";
      playbackPanel.innerHTML = `
        <div class="sb-playback-row">
          <button id="sb-play" class="sb-playback-btn" title="Play">▶ Play</button>
          <button id="sb-pause" class="sb-playback-btn" title="Pause">⏸ Pause</button>
        </div>
      `;
      consoleBody.appendChild(playbackPanel);

      wrapper.appendChild(consoleBody);
      return wrapper;
    }

    /**
     * Positions the overlay nicely on the viewport, near the selection if possible.
     */
    function positionOverlay(el) {
      // Default to top-right of the window
      el.style.top = "80px";
      el.style.right = "32px";
      el.style.left = "auto";
      el.style.bottom = "auto";

      // Try placing near the selection bounds
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Place 16px below selection or to the right
          const targetTop = rect.bottom + window.scrollY + 16;
          const targetLeft = Math.min(
            rect.left + window.scrollX,
            window.innerWidth - 360
          );
          
          // Verify bounds
          if (targetTop + 540 < window.innerHeight + window.scrollY) {
            el.style.top = `${targetTop}px`;
            el.style.left = `${targetLeft}px`;
            el.style.right = "auto";
          }
        }
      }
    }

    /**
     * Attaches mouse drag event handlers to the header.
     */
    function attachDragHandlers(el) {
      const header = el.querySelector(".sb-header");

      header.addEventListener("mousedown", (e) => {
        // Prevent dragging if clicking buttons
        if (e.target.tagName === "BUTTON") return;

        isDragging = true;
        const rect = el.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        el.style.transition = "none";
        header.style.cursor = "grabbing";
        e.preventDefault();
      });

      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const newX = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - el.offsetWidth));
        const newY = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - el.offsetHeight));
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        el.style.right = "auto";
        el.style.bottom = "auto";
      });

      document.addEventListener("mouseup", () => {
        if (!isDragging) return;
        isDragging = false;
        header.style.cursor = "grab";
        el.style.transition = "";
      });
    }

    /**
     * Attaches close, minimize, and playback button handlers.
     */
    function attachControlHandlers(el) {
      const closeBtn = el.querySelector(".sb-close-btn");
      const minBtn = el.querySelector(".sb-min-btn");
      const consoleBody = el.querySelector(".sb-console-body");

      // Close console
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          closeOverlay();
        });
      }

      // Minimize/Maximize console
      if (minBtn && consoleBody) {
        minBtn.addEventListener("click", () => {
          isMinimized = !isMinimized;
          if (isMinimized) {
            consoleBody.style.display = "none";
            el.style.height = "auto";
            minBtn.textContent = "🗖";
            minBtn.title = "Restore Console";
          } else {
            consoleBody.style.display = "flex";
            el.style.height = "";
            minBtn.textContent = "🗕";
            minBtn.title = "Minimize Console";
          }
        });
      }

      // Playback Controls
      const playBtn = el.querySelector("#sb-play");
      const pauseBtn = el.querySelector("#sb-pause");
      const resetBtn = el.querySelector("#sb-reset");
      const testHeadBtn = el.querySelector("#sb-test-head");
      const testArmBtn = el.querySelector("#sb-test-arm");
      const testHandBtn = el.querySelector("#sb-test-hand");

      if (playBtn) {
        playBtn.addEventListener("click", () => {
          chrome.storage.local.get(["translationMode"], (saved) => {
            const mode = saved.translationMode || "avatar";
            if (mode === "video") {
              const video = el.querySelector("#sb-video-player");
              if (video) video.play();
            } else {
              if (window.SignBrowseGestureMapper && currentGlossWords.length > 0) {
                window.SignBrowseGestureMapper.playSentence(currentGlossWords);
              } else if (window.AvatarController) {
                window.AvatarController.play();
              }
            }
          });
        });
      }
      if (pauseBtn) {
        pauseBtn.addEventListener("click", () => {
          chrome.storage.local.get(["translationMode"], (saved) => {
            const mode = saved.translationMode || "avatar";
            if (mode === "video") {
              const video = el.querySelector("#sb-video-player");
              if (video) video.pause();
            } else {
              if (window.AvatarController) window.AvatarController.pause();
            }
          });
        });
      }
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          chrome.storage.local.get(["translationMode"], (saved) => {
            const mode = saved.translationMode || "avatar";
            if (mode === "video") {
              const video = el.querySelector("#sb-video-player");
              if (video) {
                video.currentTime = 0;
                video.play();
              }
            } else {
              if (window.SignBrowseGestureLibrary) {
                window.SignBrowseGestureLibrary.reset();
              } else if (window.AvatarController) {
                window.AvatarController.resetPose();
              }
            }
          });
        });
      }
      if (testHeadBtn) {
        testHeadBtn.addEventListener("click", () => {
          if (window.SignBrowseGestureLibrary) {
            window.SignBrowseGestureLibrary.testHead();
          }
        });
      }
      if (testArmBtn) {
        testArmBtn.addEventListener("click", () => {
          if (window.SignBrowseGestureLibrary) {
            window.SignBrowseGestureLibrary.testRightArm();
          }
        });
      }
      if (testHandBtn) {
        testHandBtn.addEventListener("click", () => {
          if (window.SignBrowseGestureLibrary) {
            window.SignBrowseGestureLibrary.testRightHand();
          }
        });
      }
    }

    /**
     * Triggers the translation pipeline and initializes Three.js.
     */
    async function runTranslationAndRender(text, el) {
      const canvas = el.querySelector("#sb-avatar-canvas");
      const loadingOverlay = el.querySelector("#sb-avatar-loading");
      const errorOverlay = el.querySelector("#sb-avatar-error");
      const loadedStatus = el.querySelector("#sb-status-avatar");
      const container = el.querySelector("#sb-viewport-container");
      const statusLLM = el.querySelector("#sb-status-llm");

      // 1. Initialize the 3D Avatar only if we are in avatar translation mode
      chrome.storage.local.get(["translationMode"], (saved) => {
        const mode = saved.translationMode || "avatar";
        if (mode === "avatar") {
          if (window.AvatarController) {
            window.AvatarController.initializeAvatar({
              canvas,
              loadingOverlay,
              errorOverlay,
              loadedStatus,
              container
            });
          }
        } else {
          // Hide avatar overlays and canvas
          if (loadingOverlay) loadingOverlay.classList.add("sb-hidden", "hidden");
          if (canvas) canvas.style.display = "none";
          
          // Hide the manual bone test button row in video mode
          const testRow = el.querySelector(".sb-playback-panel .sb-playback-row:nth-child(2)");
          if (testRow) {
            testRow.style.display = "none";
          }
          
          if (loadedStatus) {
            loadedStatus.textContent = "AI Video";
            loadedStatus.className = "sb-status-indicator online";
          }
        }
      });

      // 2. Check LLM provider status
      if (statusLLM && typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get(["aiProvider", "nvidiaApiKey", "ollamaEndpoint"], async (saved) => {
          const provider = saved.aiProvider || "nvidia";
          
          if (provider === "nvidia") {
            if (saved.nvidiaApiKey && saved.nvidiaApiKey.trim()) {
              statusLLM.textContent = "NVIDIA";
              statusLLM.className = "sb-status-indicator online";
            } else {
              statusLLM.textContent = "No Key";
              statusLLM.className = "sb-status-indicator offline";
            }
          } else if (provider === "ollama") {
            try {
              const endpoint = saved.ollamaEndpoint || "http://localhost:11434/api/generate";
              const baseUrl = endpoint.replace("/api/generate", "");
              const response = await fetch(baseUrl, { method: "GET" });
              if (response.ok) {
                statusLLM.textContent = "Ollama";
                statusLLM.className = "sb-status-indicator online";
              } else {
                statusLLM.textContent = "Offline";
                statusLLM.className = "sb-status-indicator offline";
              }
            } catch (e) {
              statusLLM.textContent = "Offline";
              statusLLM.className = "sb-status-indicator offline";
            }
          } else {
            statusLLM.textContent = "Cloud";
            statusLLM.className = "sb-status-indicator online";
          }
        });
      }

      // 3. Trigger translation
      triggerTranslation(text, el);
    }

    /**
     * Triggers the translation pipeline via the background script.
     */
    function triggerTranslation(text, el) {
      console.log("═══════════════════════════════════════════════════════════");
      console.log("[SignBrowse Content] ▶ Step 1: triggerTranslation() called");
      console.log("[SignBrowse Content]   Selected text:", JSON.stringify(text));

      const glossOutput = el.querySelector("#sb-gloss-output");
      const loadingOverlay = el.querySelector("#sb-avatar-loading");
      const errorOverlay = el.querySelector("#sb-avatar-error");

      if (glossOutput) {
        glossOutput.innerHTML = '<span class="sb-placeholder">Translating...</span>';
      }

      /**
       * Helper: clears ALL loading spinners / overlays regardless of outcome.
       */
      function clearLoadingStates() {
        console.log("[SignBrowse Content]   Clearing loading states...");
        if (loadingOverlay) {
          loadingOverlay.classList.add("sb-hidden");
        }
      }

      /**
       * Helper: shows an error message in the viewport overlay.
       */
      function showError(message) {
        clearLoadingStates();
        const errOverlay = el.querySelector("#sb-avatar-error");
        if (errOverlay) {
          errOverlay.innerHTML = `<span style="padding: 12px; text-align: center; line-height: 1.4; color: #ff6b6b;">⚠️ ${message}</span>`;
          errOverlay.classList.remove("sb-hidden", "hidden");
        }
      }

      console.log("[SignBrowse Content] ▶ Step 2: Sending TRANSLATE_TO_ISL message to background...");

      try {
        chrome.runtime.sendMessage(
          { type: "TRANSLATE_TO_ISL", payload: { text: text } },
          (response) => {
            console.log("[SignBrowse Content] ▶ Step 3: Background response received");

            // Check for chrome runtime errors first
            if (chrome.runtime.lastError) {
              console.error("[SignBrowse Content] ✖ Step 3: chrome.runtime.lastError:", chrome.runtime.lastError.message);
              showError(`Communication error: ${chrome.runtime.lastError.message}`);
              return;
            }

            // Check if response is null/undefined (service worker may have died)
            if (!response) {
              console.error("[SignBrowse Content] ✖ Step 3: Response is null/undefined — service worker may have crashed");
              showError("No response from background service. Try reloading the extension.");
              return;
            }

            console.log("[SignBrowse Content]   response.status:", response.status);
            console.log("[SignBrowse Content]   response.result:", response.result ? "present" : "missing");
            console.log("[SignBrowse Content]   response.message:", response.message);
            console.log("[SignBrowse Content]   response.errorCode:", response.errorCode);

            if (response.status === "success" && response.result) {
              const result = response.result;
              console.log("[SignBrowse Content] ▶ Step 4: Translation success");
              console.log("[SignBrowse Content]   result.success:", result.success);
              console.log("[SignBrowse Content]   result.gloss:", JSON.stringify(result.gloss));
              console.log("[SignBrowse Content]   result.provider:", result.provider);
              console.log("[SignBrowse Content]   result.elapsed:", result.elapsed);

              // Store the gloss words for replay
              currentGlossWords = result.gloss || [];

              // Render gloss pills
              if (glossOutput) {
                glossOutput.innerHTML = "";
                if (currentGlossWords.length > 0) {
                  console.log(`[SignBrowse Content] ▶ Step 5: Rendering ${currentGlossWords.length} gloss pills`);
                  currentGlossWords.forEach((word) => {
                    const pill = document.createElement("span");
                    pill.className = "sb-gloss-pill";
                    pill.textContent = word.toUpperCase();
                    glossOutput.appendChild(pill);
                  });

                  // ─── Step 6: Play the sentence ───
                  console.log("[SignBrowse Content] ▶ Step 6: Dispatching to gesture engine / video...");
                  try {
                    chrome.storage.local.get(["translationMode"], (saved) => {
                      const mode = saved.translationMode || "avatar";
                      console.log("[SignBrowse Content]   translationMode:", mode);

                      if (mode === "video") {
                        if (window.JSON2VideoService) {
                          console.log("[SignBrowse Content]   → Calling JSON2VideoService.generateSignVideo()");
                          const container = el.querySelector("#sb-viewport-container");
                          window.JSON2VideoService.generateSignVideo(text, currentGlossWords.join(" "), container);
                        } else {
                          console.warn("[SignBrowse Content]   ⚠ JSON2VideoService not available");
                        }
                      } else {
                        if (window.SignBrowseGestureMapper) {
                          console.log("[SignBrowse Content] ▶ Step 7: Calling playSentence():", currentGlossWords);
                          console.log("Animation Started");
                          window.SignBrowseGestureMapper.playSentence(currentGlossWords);
                          console.log("[SignBrowse Content] ✔ Step 7: playSentence() dispatched");
                        } else {
                          console.warn("[SignBrowse Content]   ⚠ SignBrowseGestureMapper not available");
                        }
                      }
                    });
                  } catch (playErr) {
                    console.error("[SignBrowse Content] ✖ Step 6/7: Error starting playback:", playErr);
                  }
                } else {
                  console.warn("[SignBrowse Content]   ⚠ Gloss array is empty");
                  glossOutput.innerHTML = '<span class="sb-placeholder">No glosses returned.</span>';
                }
              }
              // Clear loading even on success
              clearLoadingStates();

            } else {
              // Error response from background
              const err = response.message || "Translation failed.";
              console.error("[SignBrowse Content] ✖ Step 4: Translation error:", err);
              console.error("[SignBrowse Content]   errorCode:", response.errorCode);
              showError(err);
            }

            console.log("═══════════════════════════════════════════════════════════");
          }
        );
      } catch (sendErr) {
        console.error("[SignBrowse Content] ✖ Step 2: chrome.runtime.sendMessage threw:", sendErr);
        showError(`Failed to send message: ${sendErr.message}`);
      }
    }

    /**
     * Attaches keyboard event handlers (Escape key to close).
     */
    function attachKeyboardHandlers() {
      const handleKeyDown = (e) => {
        if (e.key === "Escape") {
          closeOverlay("Escape key pressed");
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      
      // Store reference on overlay element for cleanup
      if (overlayEl) {
        overlayEl._keyboardHandler = handleKeyDown;
      }
    }

    /**
     * Closes the overlay and disposes of Three.js resources.
     */
    function closeOverlay(reason = "Explicit close action") {
      if (overlayEl) {
        if (overlayEl._keyboardHandler) {
          document.removeEventListener("keydown", overlayEl._keyboardHandler);
        }
        overlayEl.remove();
        console.log(`[SignBrowse Content] Overlay Removed. Reason: ${reason}`);
        overlayEl = null;
      }
      if (window.AvatarController && window.AvatarController.dispose) {
        window.AvatarController.dispose();
      }
    }

    return {
      init
    };

  })();

  // Run on injection
  SignBrowseOverlay.init();
}
