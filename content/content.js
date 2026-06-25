/**
 * CONTENT SCRIPT — content/content.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Injected into webpages. Handles:
 *   Phase 1: Message listener, draggable overlay, selected text display.
 *   Phase 4: Sentence restructuring using the ISL grammar conversion engine.
 *   Phase 6: Generative AI Prompt Preview Dashboard & Video Simulator player.
 *            Keeps word-by-word track translation engine with tabs to toggle modes.
 *
 * Depends on (loaded before this script):
 *   - engine/isl-dictionary.js            → window.ISL_DICTIONARY
 *   - engine/grammar.js                   → window.SignBrowseGrammar
 *   - engine/translator.js                → window.SignBrowseTranslator
 *   - engine/prompt-generator/signer-profile.js   → window.SignBrowseSignerProfiles
 *   - engine/prompt-generator/prompt-templates.js → window.SignBrowsePromptTemplates
 *   - engine/prompt-generator/prompt-builder.js   → window.SignBrowsePromptBuilder
 *   - engine/prompt-generator/video-request.js     → window.SignBrowseVideoRequest
 *   - engine/prompt-generator/prompt-generator.js → window.SignBrowsePromptGenerator
 */

if (!window.__signBrowseLoaded) {
  window.__signBrowseLoaded = true;

  const SignBrowseOverlay = (() => {

    // ── State ──────────────────────────────────────────────────────────────
    let overlayEl = null;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Translation playback state
    let tokens = [];           // Array of translated tokens from translator.js
    let currentTokenIndex = 0;
    let isPaused = false;
    let playbackSpeed = 2000;  // ms scale mapping: 1000 = Fast, 2000 = Normal, 3000 = Slow

    // Phase 6 Generative AI state
    let selectedModel = 'google-veo';
    let selectedSigner = 'aanya';
    let activeMode = 'ai-video'; // 'ai-video' or 'word'
    let generatedVideoData = null;
    let isGenerating = false;
    let generationProgress = 0;
    let generationStatus = '';
    let wordPlaybackTimeout = null;
    let fingerspellInterval = null;

    let cachedApiStatus = "disconnected";

    function updateCachedApiStatus() {
      return new Promise((resolve) => {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([
            "veoApiKey",
            "runwayApiKey",
            "klingApiKey",
            "lumaApiKey",
            "pikaApiKey"
          ], (keys) => {
            const hasKeys = keys.veoApiKey || keys.runwayApiKey || keys.klingApiKey || keys.lumaApiKey || keys.pikaApiKey;
            cachedApiStatus = hasKeys ? "connected" : "disconnected";
            if (typeof window !== "undefined") {
              window.__signBrowseApiStatus = cachedApiStatus;
            }
            resolve();
          });
        } else {
          cachedApiStatus = "disconnected";
          if (typeof window !== "undefined") {
            window.__signBrowseApiStatus = cachedApiStatus;
          }
          resolve();
        }
      });
    }

    // ─── init() ────────────────────────────────────────────────────────────
    function init() {
      updateCachedApiStatus();

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "SHOW_SIGN_OVERLAY") {
          updateCachedApiStatus().then(() => {
            showOverlay(message.payload.text);
          });
          sendResponse({ status: "OK" });
        } else if (message.type === "UPDATE_API_STATUS") {
          updateCachedApiStatus().then(() => {
            if (overlayEl && !overlayEl.classList.contains("sb-hidden") && activeMode === "ai-video" && !isGenerating && !generatedVideoData) {
              renderVideoStage();
            }
          });
          sendResponse({ status: "OK" });
        }
      });

      console.log("[SignBrowse] Content script ready (Phase 7 — Real AI Video Integration).");
    }

    // ─── showOverlay(text) ─────────────────────────────────────────────────
    function showOverlay(text) {
      // 1. Process Grammar Conversion first
      const grammarEngine = window.SignBrowseGrammar;
      let islText = "";
      if (grammarEngine) {
        islText = grammarEngine.generateISLSequence(text);
      } else {
        console.warn("[SignBrowse] Grammar engine not loaded.");
        islText = text.toUpperCase();
      }

      // 2. Translate restructured sentence
      const translator = window.SignBrowseTranslator;
      if (!translator) {
        console.error("[SignBrowse] Translator not loaded.");
        return;
      }

      tokens = translator.translateText(islText);
      currentTokenIndex = 0;
      isPaused = false;

      // Reset Generative Video states
      generatedVideoData = null;
      isGenerating = false;
      generationProgress = 0;
      generationStatus = "";

      if (overlayEl) {
        updateSelectedText(text, islText);
        updatePromptText(islText);
        overlayEl.classList.remove("sb-hidden");
        overlayEl.classList.add("sb-visible");

        if (activeMode === "ai-video") {
          renderVideoStage();
        } else {
          startPlayback();
        }
        return;
      }

      overlayEl = buildOverlayDOM(text, islText);
      document.body.appendChild(overlayEl);

      attachDragHandlers(overlayEl);
      attachCloseHandler(overlayEl);

      requestAnimationFrame(() => {
        overlayEl.classList.add("sb-visible");
        switchMode(activeMode); // initial render of active mode stage
      });
    }

    // ─── buildOverlayDOM(originalText, islText) ────────────────────────────
    function buildOverlayDOM(originalText, islText) {
      const wrapper = document.createElement("div");
      wrapper.id = "signbrowse-overlay";
      wrapper.setAttribute("role", "dialog");
      wrapper.setAttribute("aria-label", "SignBrowse Sign Language Overlay");

      // ── Header ──
      const header = document.createElement("div");
      header.className = "sb-header";

      const logo = document.createElement("span");
      logo.className = "sb-logo";
      logo.textContent = "🤟 SignBrowse";

      const closeBtn = document.createElement("button");
      closeBtn.className = "sb-close-btn";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.textContent = "✕";

      header.appendChild(logo);
      header.appendChild(closeBtn);
      wrapper.appendChild(header);

      // ── Mode Tabs ──
      const tabsRow = document.createElement("div");
      tabsRow.className = "sb-tabs-row";

      const videoTabBtn = document.createElement("button");
      videoTabBtn.className = "sb-tab-btn sb-tab-active";
      videoTabBtn.id = "sb-tab-video";
      videoTabBtn.textContent = "🤟 AI Video";

      const wordTabBtn = document.createElement("button");
      wordTabBtn.className = "sb-tab-btn";
      wordTabBtn.id = "sb-tab-word";
      wordTabBtn.textContent = "📖 Word Lookup";

      tabsRow.appendChild(videoTabBtn);
      tabsRow.appendChild(wordTabBtn);
      wrapper.appendChild(tabsRow);

      // Tab Switch Event Listeners
      videoTabBtn.addEventListener("click", () => {
        switchMode("ai-video");
      });
      wordTabBtn.addEventListener("click", () => {
        switchMode("word");
      });

      // ── Main Stage Container ──
      const stage = document.createElement("div");
      stage.className = "sb-sign-stage";
      stage.id = "sb-sign-stage";

      // 1. AI Video Configuration Panel (Models & Signers)
      const aiConfigPanel = document.createElement("div");
      aiConfigPanel.className = "sb-config-grid";
      aiConfigPanel.id = "sb-ai-config-panel";

      // Model Select Group
      const modelGroup = document.createElement("div");
      modelGroup.className = "sb-config-item";
      const modelLabel = document.createElement("span");
      modelLabel.className = "sb-config-label";
      modelLabel.textContent = "Model";
      const modelSelect = document.createElement("select");
      modelSelect.className = "sb-config-select";
      modelSelect.id = "sb-model-select";
      
      const videoModels = [
        { id: "google-veo", name: "Google Veo" },
        { id: "runway-gen3", name: "Runway Gen-3" },
        { id: "luma-dream-machine", name: "Luma Dream" },
        { id: "kling-ai", name: "Kling AI" },
        { id: "pika", name: "Pika Labs" }
      ];
      videoModels.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.id === selectedModel) opt.selected = true;
        modelSelect.appendChild(opt);
      });
      modelSelect.addEventListener("change", (e) => {
        selectedModel = e.target.value;
        updatePromptText(document.getElementById("sb-isl-text").textContent);
      });
      modelGroup.appendChild(modelLabel);
      modelGroup.appendChild(modelSelect);

      // Signer Select Group
      const signerGroup = document.createElement("div");
      signerGroup.className = "sb-config-item";
      const signerLabel = document.createElement("span");
      signerLabel.className = "sb-config-label";
      signerLabel.textContent = "Signer";
      const signerSelect = document.createElement("select");
      signerSelect.className = "sb-config-select";
      signerSelect.id = "sb-signer-select";

      const signerProfiles = [
        { id: "aanya", name: "Aanya (Female)" },
        { id: "kabir", name: "Kabir (Male)" }
      ];
      signerProfiles.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.name;
        if (s.id === selectedSigner) opt.selected = true;
        signerSelect.appendChild(opt);
      });
      signerSelect.addEventListener("change", (e) => {
        selectedSigner = e.target.value;
        updatePromptText(document.getElementById("sb-isl-text").textContent);
      });
      signerGroup.appendChild(signerLabel);
      signerGroup.appendChild(signerSelect);

      aiConfigPanel.appendChild(modelGroup);
      aiConfigPanel.appendChild(signerGroup);
      stage.appendChild(aiConfigPanel);

      // 2. Prompt Textarea Panel
      const promptWrap = document.createElement("div");
      promptWrap.className = "sb-prompt-wrap";
      promptWrap.id = "sb-prompt-wrap";
      
      const promptLabel = document.createElement("span");
      promptLabel.className = "sb-config-label";
      promptLabel.textContent = "AI Prompt (Editable)";

      const promptTextarea = document.createElement("textarea");
      promptTextarea.className = "sb-prompt-textarea";
      promptTextarea.id = "sb-prompt-textarea";
      promptTextarea.value = getCompiledPrompt(islText);

      promptWrap.appendChild(promptLabel);
      promptWrap.appendChild(promptTextarea);
      stage.appendChild(promptWrap);

      // 3. Word label and type badge (Only shown in Word Lookup mode)
      const wordLabel = document.createElement("div");
      wordLabel.className = "sb-word-label";
      wordLabel.id = "sb-word-label";
      wordLabel.style.display = "none";
      wordLabel.textContent = "—";

      const typeBadge = document.createElement("span");
      typeBadge.className = "sb-type-badge";
      typeBadge.id = "sb-type-badge";
      typeBadge.textContent = "READY";
      wordLabel.appendChild(typeBadge);
      stage.appendChild(wordLabel);

      // 4. Center stage card (Sign Card - displays video simulator or word lookup)
      const signCard = document.createElement("div");
      signCard.className = "sb-sign-card";
      signCard.id = "sb-sign-card";
      stage.appendChild(signCard);

      // 5. Sign description (Only shown in Word Lookup mode)
      const signDesc = document.createElement("div");
      signDesc.className = "sb-sign-description";
      signDesc.id = "sb-sign-description";
      signDesc.style.display = "none";
      signDesc.textContent = "";
      stage.appendChild(signDesc);

      wrapper.appendChild(stage);

      // ── Word Track (Breadcrumb) ──
      const wordTrack = document.createElement("div");
      wordTrack.className = "sb-word-track";
      wordTrack.id = "sb-word-track";
      wrapper.appendChild(wordTrack);

      // ── Controls Row ──
      const controlsRow = document.createElement("div");
      controlsRow.className = "sb-controls-row";

      const prevBtn = document.createElement("button");
      prevBtn.className = "sb-ctrl-btn";
      prevBtn.id = "sb-prev-btn";
      prevBtn.textContent = "⏮";
      prevBtn.title = "Previous word";
      prevBtn.addEventListener("click", prevWord);

      const playPauseBtn = document.createElement("button");
      playPauseBtn.className = "sb-ctrl-btn sb-play-pause-btn";
      playPauseBtn.id = "sb-play-pause";
      playPauseBtn.textContent = "⏸";
      playPauseBtn.title = "Pause / Resume";
      playPauseBtn.addEventListener("click", togglePause);

      const nextBtn = document.createElement("button");
      nextBtn.className = "sb-ctrl-btn";
      nextBtn.id = "sb-next-btn";
      nextBtn.textContent = "⏭";
      nextBtn.title = "Next word";
      nextBtn.addEventListener("click", nextWord);

      const speedLabel = document.createElement("span");
      speedLabel.className = "sb-speed-label";
      speedLabel.id = "sb-speed-label";
      speedLabel.textContent = "Normal";

      const speedBtn = document.createElement("button");
      speedBtn.className = "sb-ctrl-btn sb-speed-btn";
      speedBtn.textContent = "⚡";
      speedBtn.title = "Cycle speed";
      speedBtn.addEventListener("click", cycleSpeed);

      controlsRow.appendChild(prevBtn);
      controlsRow.appendChild(playPauseBtn);
      controlsRow.appendChild(nextBtn);
      controlsRow.appendChild(speedLabel);
      controlsRow.appendChild(speedBtn);
      wrapper.appendChild(controlsRow);

      // ── Progress Bar ──
      const progressWrap = document.createElement("div");
      progressWrap.className = "sb-progress-wrap";
      const progressBar = document.createElement("div");
      progressBar.className = "sb-progress-bar";
      progressBar.id = "sb-progress-bar";
      progressWrap.appendChild(progressBar);
      wrapper.appendChild(progressWrap);

      // ── Selected Text Section ──
      const textSection = document.createElement("div");
      textSection.className = "sb-text-section";

      // English
      const engRow = document.createElement("div");
      engRow.className = "sb-text-row";
      const engLabel = document.createElement("span");
      engLabel.className = "sb-text-label";
      engLabel.textContent = "English:";
      const engDisplay = document.createElement("span");
      engDisplay.className = "sb-selected-text";
      engDisplay.id = "sb-selected-text";
      engDisplay.textContent = originalText;
      engRow.appendChild(engLabel);
      engRow.appendChild(engDisplay);
      textSection.appendChild(engRow);

      // ISL
      const islRow = document.createElement("div");
      islRow.className = "sb-text-row";
      const islLabel = document.createElement("span");
      islLabel.className = "sb-text-label";
      islLabel.textContent = "ISL Order:";
      const islDisplay = document.createElement("span");
      islDisplay.className = "sb-isl-text";
      islDisplay.id = "sb-isl-text";
      islDisplay.textContent = islText || "—";
      islRow.appendChild(islLabel);
      islRow.appendChild(islDisplay);
      textSection.appendChild(islRow);

      wrapper.appendChild(textSection);

      // ── Status Bar ──
      const statusBadge = document.createElement("div");
      statusBadge.className = "sb-status";
      statusBadge.id = "sb-status";
      statusBadge.textContent = "Phase 6 — Generative Prompt Engine";
      wrapper.appendChild(statusBadge);

      return wrapper;
    }

    // ─── updateSelectedText(originalText, islText) ─────────────────────────
    function updateSelectedText(originalText, islText) {
      const engEl = document.getElementById("sb-selected-text");
      if (engEl) engEl.textContent = originalText;

      const islEl = document.getElementById("sb-isl-text");
      if (islEl) islEl.textContent = islText || "—";
    }

    // ─── prompt helpers ────────────────────────────────────────────────────
    function getCompiledPrompt(islText) {
      if (window.SignBrowsePromptGenerator) {
        return window.SignBrowsePromptGenerator.generate(islText, selectedSigner, selectedModel);
      }
      return islText || "";
    }

    function updatePromptText(islText) {
      const textarea = document.getElementById("sb-prompt-textarea");
      if (textarea) {
        textarea.value = getCompiledPrompt(islText);
      }
      if (activeMode === "ai-video") {
        renderVideoStage();
      }
    }

    function getMp4Url(gifUrl) {
      if (gifUrl && gifUrl.includes("giphy.gif")) {
        return gifUrl.replace("giphy.gif", "giphy.mp4");
      }
      return gifUrl;
    }

    // ─── switchMode(mode) ──────────────────────────────────────────────────
    function switchMode(mode) {
      activeMode = mode;
      
      const videoTabBtn = document.getElementById("sb-tab-video");
      const wordTabBtn = document.getElementById("sb-tab-word");
      const aiConfigPanel = document.getElementById("sb-ai-config-panel");
      const promptWrap = document.getElementById("sb-prompt-wrap");
      const wordLabel = document.getElementById("sb-word-label");
      const signDesc = document.getElementById("sb-sign-description");

      stopWordPlayback();

      if (mode === "ai-video") {
        if (videoTabBtn) videoTabBtn.classList.add("sb-tab-active");
        if (wordTabBtn) wordTabBtn.classList.remove("sb-tab-active");
        if (aiConfigPanel) aiConfigPanel.style.display = "grid";
        if (promptWrap) promptWrap.style.display = "flex";
        if (wordLabel) wordLabel.style.display = "none";
        if (signDesc) signDesc.style.display = "none";
        
        setStatus("Generative AI Mode active");
        renderVideoStage();
      } else {
        if (videoTabBtn) videoTabBtn.classList.remove("sb-tab-active");
        if (wordTabBtn) wordTabBtn.classList.add("sb-tab-active");
        if (aiConfigPanel) aiConfigPanel.style.display = "none";
        if (promptWrap) promptWrap.style.display = "none";
        if (wordLabel) wordLabel.style.display = "flex";
        if (signDesc) signDesc.style.display = "block";

        setStatus("Word Lookup Mode active");
        startPlayback();
      }
    }

    // ─── renderVideoStage() ────────────────────────────────────────────────
    function renderVideoStage() {
      const card = document.getElementById("sb-sign-card");
      if (!card) return;

      card.innerHTML = "";
      card.className = "sb-sign-card";

      // Get API status
      const apiStatus = window.SignBrowseVideoRequest
        ? window.SignBrowseVideoRequest.getApiStatus()
        : "disconnected";

      if (isGenerating) {
        // ── GENERATING: Spinner & step-by-step progress ──
        const loader = document.createElement("div");
        loader.className = "sb-avatar-loader";
        
        const spinner = document.createElement("div");
        spinner.className = "sb-loader-spinner";
        
        const statusText = document.createElement("div");
        statusText.className = "sb-loader-text";
        statusText.innerHTML = `<div style="text-align:center;padding:0 10px;font-size:9px;line-height:1.4;">${generationStatus}</div><div style="font-size:16px;font-weight:bold;margin-top:6px;text-align:center;color:#ff65a3;">${generationProgress}%</div>`;
        
        // Show progress bar inside loader
        const progressOuter = document.createElement("div");
        progressOuter.style.cssText = "width:80%;height:4px;background:rgba(108,99,255,0.15);border-radius:4px;overflow:hidden;margin-top:4px;";
        const progressInner = document.createElement("div");
        progressInner.style.cssText = `width:${generationProgress}%;height:100%;background:linear-gradient(90deg,#6c63ff,#ff65a3);border-radius:4px;transition:width 0.3s;`;
        progressOuter.appendChild(progressInner);

        loader.appendChild(spinner);
        loader.appendChild(statusText);
        loader.appendChild(progressOuter);
        card.appendChild(loader);

      } else if (generatedVideoData) {
        const videoUrl = generatedVideoData.videoUrl;

        // Debugging logs requested by user
        console.log("generatedVideoData:", generatedVideoData);
        console.log("videoUrl:", videoUrl);

        if (videoUrl) {
          fetch(videoUrl)
            .then(r => console.log("Status:", r.status))
            .catch(console.error);

          renderRealVideo(card, videoUrl);
        } else {
          renderErrorPanel(card, "No Video URL", "The AI video generation completed but returned an empty video resource.");
        }

      } else {
        // ── READY TO GENERATE ──
        renderReadyPanel(card, apiStatus);
      }
    }

    // ─── renderRealVideo(card, videoUrl) ──────────────────────────────────
    function renderRealVideo(card, videoUrl) {
      const optimalUrl = getOptimalVideoUrl(videoUrl);
      const isGif = optimalUrl.toLowerCase().endsWith(".gif");

      const playerContainer = document.createElement("div");
      playerContainer.className = "sb-player-container sb-show-controls";
      playerContainer.style.width = "100%";
      playerContainer.style.height = "100%";

      let mediaElement;
      if (isGif) {
        mediaElement = document.createElement("img");
        mediaElement.className = "sb-video-element";
        mediaElement.referrerPolicy = "no-referrer";
        mediaElement.src = optimalUrl;
        mediaElement.alt = "AI Sign Language translation";
      } else {
        mediaElement = document.createElement("video");
        mediaElement.className = "sb-video-element";
        mediaElement.autoplay = true;
        mediaElement.loop = true;
        mediaElement.muted = true;
        mediaElement.playsInline = true;
        mediaElement.referrerPolicy = "no-referrer";
        mediaElement.src = optimalUrl;
      }

      // Handle loading errors
      mediaElement.addEventListener("error", () => {
        console.warn("[SignBrowse] Direct asset load failed, retrying via proxy:", optimalUrl);
        chrome.runtime.sendMessage({
          type: "PROXY_FETCH_ASSET",
          url: optimalUrl
        }, response => {
          if (response && response.status === "success" && response.dataUrl) {
            console.log("[SignBrowse] Proxy fetch succeeded. Loading base64 asset.");
            mediaElement.src = response.dataUrl;
          } else {
            // If it was a converted MP4 and failed, try falling back to original GIF url
            if (!isGif && videoUrl !== optimalUrl) {
              console.log("[SignBrowse] MP4 load failed, falling back to original GIF:", videoUrl);
              renderRealVideo(card, videoUrl);
            } else {
              const errMsg = response ? response.message : "No background worker response";
              renderErrorPanel(playerContainer, optimalUrl, errMsg);
            }
          }
        });
      });

      playerContainer.appendChild(mediaElement);

      // Play/Pause Overlay indicator
      const overlay = document.createElement("div");
      overlay.className = "sb-player-overlay sb-fade-out";
      const overlayIcon = document.createElement("span");
      overlayIcon.className = "sb-player-overlay-icon";
      overlayIcon.textContent = "▶";
      overlay.appendChild(overlayIcon);
      playerContainer.appendChild(overlay);

      // Controls Bar
      const controls = document.createElement("div");
      controls.className = "sb-player-controls";

      // Play/Pause button
      const playBtn = document.createElement("button");
      playBtn.className = "sb-player-btn sb-play-btn";
      playBtn.textContent = "⏸";
      playBtn.title = "Play / Pause";
      controls.appendChild(playBtn);

      // Replay button
      const replayBtn = document.createElement("button");
      replayBtn.className = "sb-player-btn sb-replay-btn";
      replayBtn.textContent = "⟳";
      replayBtn.title = "Replay";
      controls.appendChild(replayBtn);

      // Seek Slider
      const seekBar = document.createElement("input");
      seekBar.type = "range";
      seekBar.className = "sb-player-seek";
      seekBar.min = "0";
      seekBar.max = "100";
      seekBar.value = "0";
      seekBar.step = "0.1";
      seekBar.title = "Seek";
      controls.appendChild(seekBar);

      // Time Display
      const timeDisplay = document.createElement("span");
      timeDisplay.className = "sb-player-time";
      timeDisplay.textContent = "0:00 / 0:00";
      controls.appendChild(timeDisplay);

      // Speed selector
      const speedSelect = document.createElement("select");
      speedSelect.className = "sb-player-speed";
      speedSelect.title = "Playback Speed";
      const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
      speeds.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = `${s}x`;
        if (s === 1.0) opt.selected = true;
        speedSelect.appendChild(opt);
      });
      controls.appendChild(speedSelect);

      // Download button
      const downloadBtn = document.createElement("button");
      downloadBtn.className = "sb-player-btn sb-download-btn";
      downloadBtn.textContent = "⬇";
      downloadBtn.title = "Download";
      controls.appendChild(downloadBtn);

      // Fullscreen button
      const fullscreenBtn = document.createElement("button");
      fullscreenBtn.className = "sb-player-btn sb-fullscreen-btn";
      fullscreenBtn.textContent = "⛶";
      fullscreenBtn.title = "Fullscreen";
      controls.appendChild(fullscreenBtn);

      playerContainer.appendChild(controls);

      // Behavior for GIF vs Video
      if (isGif) {
        seekBar.disabled = true;
        seekBar.style.opacity = "0.5";
        speedSelect.disabled = true;
        speedSelect.style.opacity = "0.5";
        playBtn.disabled = true;
        playBtn.style.opacity = "0.5";
        replayBtn.disabled = true;
        replayBtn.style.opacity = "0.5";
        timeDisplay.textContent = "GIF Mode";
      } else {
        const togglePlay = (e) => {
          if (e) e.stopPropagation();
          if (mediaElement.paused) {
            mediaElement.play().catch(() => {});
            playBtn.textContent = "⏸";
            overlayIcon.textContent = "▶";
            overlay.classList.add("sb-fade-out");
            overlay.style.opacity = "0";
          } else {
            mediaElement.pause();
            playBtn.textContent = "▶";
            overlayIcon.textContent = "⏸";
            overlay.classList.remove("sb-fade-out");
            overlay.style.opacity = "1";
          }
        };

        mediaElement.addEventListener("click", togglePlay);
        playBtn.addEventListener("click", togglePlay);
        overlay.addEventListener("click", togglePlay);

        replayBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          mediaElement.currentTime = 0;
          mediaElement.play().catch(() => {});
          playBtn.textContent = "⏸";
          overlay.classList.add("sb-fade-out");
          overlay.style.opacity = "0";
        });

        const formatTime = (sec) => {
          if (isNaN(sec) || sec === Infinity) return "0:00";
          const m = Math.floor(sec / 60);
          const s = Math.floor(sec % 60);
          return `${m}:${s < 10 ? '0' : ''}${s}`;
        };

        mediaElement.addEventListener("timeupdate", () => {
          if (!mediaElement.duration) return;
          const pct = (mediaElement.currentTime / mediaElement.duration) * 100;
          seekBar.value = pct;
          timeDisplay.textContent = `${formatTime(mediaElement.currentTime)} / ${formatTime(mediaElement.duration)}`;
        });

        mediaElement.addEventListener("loadedmetadata", () => {
          timeDisplay.textContent = `${formatTime(mediaElement.currentTime)} / ${formatTime(mediaElement.duration)}`;
        });

        seekBar.addEventListener("input", (e) => {
          e.stopPropagation();
          if (!mediaElement.duration) return;
          const time = (seekBar.value / 100) * mediaElement.duration;
          mediaElement.currentTime = time;
        });

        speedSelect.addEventListener("change", (e) => {
          mediaElement.playbackRate = parseFloat(e.target.value);
        });

        updateVideoSpeed(mediaElement);
        if (isPaused) {
          mediaElement.pause();
          playBtn.textContent = "▶";
          overlay.classList.remove("sb-fade-out");
          overlay.style.opacity = "1";
        }
      }

      // Download Handler
      downloadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        downloadBtn.disabled = true;
        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = "⏳";

        const triggerDownload = (url) => {
          const a = document.createElement("a");
          a.href = url;
          a.download = isGif ? "signbrowse-translation.gif" : "signbrowse-translation.mp4";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          downloadBtn.disabled = false;
          downloadBtn.textContent = originalText;
        };

        if (mediaElement.src.startsWith("data:")) {
          triggerDownload(mediaElement.src);
        } else {
          fetch(mediaElement.src)
            .then(res => res.blob())
            .then(blob => {
              const localUrl = URL.createObjectURL(blob);
              triggerDownload(localUrl);
              setTimeout(() => URL.revokeObjectURL(localUrl), 1000);
            })
            .catch(err => {
              console.warn("Direct download failed, trying SW proxy:", err);
              chrome.runtime.sendMessage({
                type: "PROXY_FETCH_ASSET",
                url: optimalUrl
              }, response => {
                if (response && response.status === "success" && response.dataUrl) {
                  triggerDownload(response.dataUrl);
                } else {
                  console.error("Proxy download failed");
                  downloadBtn.disabled = false;
                  downloadBtn.textContent = originalText;
                }
              });
            });
        }
      });

      // Fullscreen Handler
      fullscreenBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
          playerContainer.requestFullscreen().catch(err => {
            console.warn("Fullscreen request failed:", err);
          });
        } else {
          document.exitFullscreen();
        }
      });

      const onFullscreenChange = () => {
        if (document.fullscreenElement === playerContainer) {
          fullscreenBtn.textContent = "✕";
          fullscreenBtn.title = "Exit Fullscreen";
          playerContainer.classList.add("sb-fullscreen-active");
        } else {
          fullscreenBtn.textContent = "⛶";
          fullscreenBtn.title = "Fullscreen";
          playerContainer.classList.remove("sb-fullscreen-active");
        }
      };
      
      document.addEventListener("fullscreenchange", onFullscreenChange);
      
      // Clean up fullscreen listener when player is removed from DOM
      const observer = new MutationObserver(() => {
        if (!document.body.contains(playerContainer)) {
          document.removeEventListener("fullscreenchange", onFullscreenChange);
          observer.disconnect();
        }
      });
      observer.observe(card, { childList: true });

      // Controls visibility timer
      let hideControlsTimeout;
      const resetControlsTimer = () => {
        playerContainer.classList.add("sb-show-controls");
        clearTimeout(hideControlsTimeout);
        const isPlaying = !isGif && !mediaElement.paused;
        if (isPlaying) {
          hideControlsTimeout = setTimeout(() => {
            playerContainer.classList.remove("sb-show-controls");
          }, 2000);
        }
      };

      playerContainer.addEventListener("mousemove", resetControlsTimer);
      playerContainer.addEventListener("mouseenter", resetControlsTimer);
      playerContainer.addEventListener("mouseleave", () => {
        const isPlaying = !isGif && !mediaElement.paused;
        if (isPlaying) {
          playerContainer.classList.remove("sb-show-controls");
        }
      });

      resetControlsTimer();
      card.appendChild(playerContainer);
    }

    function getOptimalVideoUrl(url) {
      if (!url) return "";
      // Convert giphy gif to mp4
      const giphyMatch = url.match(/giphy\.com\/(?:gifs|media|)[^\/]*\/([a-zA-Z0-9]+)\.gif/) || 
                         url.match(/i\.giphy\.com\/([a-zA-Z0-9]+)\.gif/);
      if (giphyMatch && giphyMatch[1]) {
        const id = giphyMatch[1];
        return `https://media.giphy.com/media/${id}/giphy.mp4`;
      }
      return url;
    }

    function renderErrorPanel(container, url, errMsg) {
      container.innerHTML = "";
      const errPanel = document.createElement("div");
      errPanel.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;gap:8px;padding:16px;text-align:center;background:#070712;border-radius:14px;";
      errPanel.innerHTML = `<div style="font-size:28px;">⚠️</div><div style="font-size:11px;font-weight:700;color:#ff6b6b;">Video Failed to Load</div><div style="font-size:9px;color:#8a99ad;line-height:1.4;">Direct loading and background proxy both failed. Verify the file exists and is accessible.</div><div style="font-size:9px;color:#8a99ad;line-height:1.4;text-align:left;width:100%;"><strong>URL:</strong> <code style="font-family:monospace;word-break:break-all;color:#ff65a3;font-size:8px;">${url}</code><br><strong>Proxy Error:</strong> <code style="font-family:monospace;word-break:break-all;color:#ff6b6b;font-size:8px;">${errMsg}</code></div>`;
      container.appendChild(errPanel);
    }

    // ─── renderReadyPanel(card, apiStatus) ────────────────────────────────
    function renderReadyPanel(card, apiStatus) {
      const panel = document.createElement("div");
      panel.className = "sb-video-stage";
      panel.style.cssText = "padding:16px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;";

      // API Status badge
      const statusBadge = document.createElement("div");
      statusBadge.className = "sb-api-status-badge";
      if (apiStatus === "connected") {
        statusBadge.innerHTML = '<span style="color:#10b981;">●</span> API Connected';
        statusBadge.style.color = "#10b981";
      } else {
        statusBadge.innerHTML = '<span style="color:#ff6b6b;">●</span> Disconnected';
        statusBadge.style.color = "#ff6b6b";
      }

      const title = document.createElement("div");
      title.style.cssText = "font-size:11px;font-weight:700;color:#a89bfe;letter-spacing:0.5px;";
      title.textContent = "🎬 AI VIDEO GENERATOR";

      const desc = document.createElement("div");
      desc.style.cssText = "font-size:9px;color:#8a99ad;line-height:1.3;max-width:180px;";
      desc.textContent = "Generate a character-consistent sign language video using the selected model.";

      const btn = document.createElement("button");
      btn.className = "sb-generate-btn";
      btn.textContent = "Generate AI Video";
      btn.addEventListener("click", triggerVideoGeneration);

      panel.appendChild(statusBadge);
      panel.appendChild(title);
      panel.appendChild(desc);
      panel.appendChild(btn);
      card.appendChild(panel);
    }

    // ─── triggerVideoGeneration() ─────────────────────────────────────────
    function triggerVideoGeneration() {
      const textarea = document.getElementById("sb-prompt-textarea");
      const prompt = textarea ? textarea.value : getCompiledPrompt(document.getElementById("sb-isl-text").textContent);
      const islText = document.getElementById("sb-isl-text").textContent;

      if (!prompt) return;

      console.log("[SignBrowse] ═══ Video Generation Triggered ═══");
      console.log("[SignBrowse] Selected Model:", selectedModel);
      console.log("[SignBrowse] Selected Signer:", selectedSigner);
      console.log("[SignBrowse] ISL Gloss:", islText);
      console.log("[SignBrowse] Generated Prompt:", prompt.substring(0, 150) + "...");

      isGenerating = true;
      generationProgress = 0;
      generationStatus = "Initializing generation pipeline...";
      renderVideoStage();

      if (window.SignBrowsePromptGenerator) {
        window.SignBrowsePromptGenerator.submitRequest(selectedModel, prompt, islText, (progress, status) => {
          generationProgress = progress;
          generationStatus = status;
          renderVideoStage();
        }).then(result => {
          isGenerating = false;
          generatedVideoData = result;
          isPaused = false;

          console.log("[SignBrowse] ═══ Video Generation Complete ═══");
          console.log("[SignBrowse] Video URL:", result.videoUrl);
          console.log("[SignBrowse] Engine:", result.engineName);

          const ppBtn = document.getElementById("sb-play-pause");
          if (ppBtn) ppBtn.textContent = "⏸";

          renderVideoStage();
          setStatus("AI Sign Video generated successfully (" + result.engineName + ")");
        }).catch(err => {
          isGenerating = false;
          generationStatus = "Generation failed";
          console.error("[SignBrowse] Generation error:", err);
          renderVideoStage();
          setStatus("Error: " + err.message);
        });
      } else {
        isGenerating = false;
        renderVideoStage();
        setStatus("Error: Prompt generator module not loaded.");
      }
    }

    // ─── updateVideoSpeed(videoEl) ────────────────────────────────────────
    function updateVideoSpeed(videoEl) {
      if (!videoEl || typeof videoEl.playbackRate === "undefined") return;
      let rate = 1.0;
      if (playbackSpeed === 1000) rate = 1.5; // Fast
      else if (playbackSpeed === 3000) rate = 0.65; // Slow
      videoEl.playbackRate = rate;
    }

    // ─── updateVideoPlayPause(videoEl) ────────────────────────────────────
    function updateVideoPlayPause(videoEl) {
      if (!videoEl || typeof videoEl.play !== "function") return;
      if (isPaused) {
        videoEl.pause();
      } else {
        videoEl.play().catch(() => {});
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PLAYBACK COORDINATOR (Word-by-word sequence playback logic)
    // ═══════════════════════════════════════════════════════════════════════

    function startPlayback() {
      stopWordPlayback();
      isPaused = false;
      currentTokenIndex = 0;

      if (!tokens.length) {
        setStatus("No translatable words found.");
        return;
      }

      buildWordTrack();

      const ppBtn = document.getElementById("sb-play-pause");
      if (ppBtn) ppBtn.textContent = "⏸";

      showCurrentToken();
    }

    function stopWordPlayback() {
      if (wordPlaybackTimeout) {
        clearTimeout(wordPlaybackTimeout);
        wordPlaybackTimeout = null;
      }
      if (fingerspellInterval) {
        clearInterval(fingerspellInterval);
        fingerspellInterval = null;
      }
    }

    function advanceToken() {
      currentTokenIndex++;
      if (currentTokenIndex >= tokens.length) {
        currentTokenIndex = 0; // loop
      }
      showCurrentToken();
    }

    function prevWord() {
      if (!tokens.length) return;
      currentTokenIndex--;
      if (currentTokenIndex < 0) currentTokenIndex = tokens.length - 1;
      showCurrentToken();
    }

    function nextWord() {
      if (!tokens.length) return;
      currentTokenIndex++;
      if (currentTokenIndex >= tokens.length) currentTokenIndex = 0;
      showCurrentToken();
    }

    function showCurrentToken() {
      if (activeMode !== "word" || !tokens.length) return;

      const token = tokens[currentTokenIndex];
      const wordLabel = document.getElementById("sb-word-label");
      const typeBadge = document.getElementById("sb-type-badge");
      const signDesc = document.getElementById("sb-sign-description");
      const progressBar = document.getElementById("sb-progress-bar");

      // Update word label text
      if (wordLabel) {
        wordLabel.childNodes[0].textContent = token.word.toUpperCase() + " ";
      }

      // Update type badges & descriptions
      if (typeBadge) {
        if (token.type === "sign") {
          typeBadge.textContent = "ISL SIGN";
          typeBadge.className = "sb-type-badge sb-badge-sign";
          if (signDesc) {
            signDesc.textContent = (token.data && token.data.description) || "Dictionary looked up sign gesture";
            signDesc.style.display = "block";
          }
        } else {
          typeBadge.textContent = "FINGERSPELL";
          typeBadge.className = "sb-type-badge sb-badge-spell";
          if (signDesc) {
            signDesc.textContent = `Spelling: ${token.letters.join(" → ")}`;
            signDesc.style.display = "block";
          }
        }
      }

      // Update word track highlighted index
      highlightWordTrack(currentTokenIndex);

      // Update progress bar percentage
      if (progressBar) {
        const pct = ((currentTokenIndex + 1) / tokens.length) * 100;
        progressBar.style.width = `${pct}%`;
      }

      // Stop previous playback cycles before executing new ones
      stopWordPlayback();

      // Play token sequence
      if (token.type === "sign") {
        playSignWordToken(token, () => {
          if (!isPaused) advanceToken();
        });
      } else {
        playFingerspellingToken(token, () => {
          if (!isPaused) advanceToken();
        });
      }
    }

    // ─── playSignWordToken(token, onDone) ─────────────────────────────────
    function playSignWordToken(token, onDone) {
      const card = document.getElementById("sb-sign-card");
      if (!card) return;

      card.innerHTML = "";
      card.className = "sb-sign-card sb-card-enter";

      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.padding = "20px";
      container.style.gap = "8px";

      const icon = document.createElement("div");
      icon.style.fontSize = "36px";
      icon.style.filter = "drop-shadow(0 0 8px rgba(108, 99, 255, 0.35))";
      icon.textContent = "✦";

      const wordTitle = document.createElement("div");
      wordTitle.style.fontSize = "22px";
      wordTitle.style.fontWeight = "800";
      wordTitle.style.color = "#fff";
      wordTitle.style.letterSpacing = "1px";
      wordTitle.style.textTransform = "uppercase";
      wordTitle.textContent = token.word;

      const badge = document.createElement("div");
      badge.style.fontSize = "8px";
      badge.style.fontWeight = "700";
      badge.style.color = "#10b981";
      badge.style.background = "rgba(16, 185, 129, 0.1)";
      badge.style.border = "1px solid rgba(16, 185, 129, 0.25)";
      badge.style.borderRadius = "4px";
      badge.style.padding = "3px 8px";
      badge.style.textTransform = "uppercase";
      badge.textContent = "Dictionary Looked Up";

      container.appendChild(icon);
      container.appendChild(wordTitle);
      container.appendChild(badge);
      card.appendChild(container);

      let wordDuration = playbackSpeed;
      wordPlaybackTimeout = setTimeout(() => {
        if (!isPaused) {
          onDone();
        }
      }, wordDuration);
    }

    // ─── playFingerspellingToken(token, onDone) ───────────────────────────
    function playFingerspellingToken(token, onDone) {
      const card = document.getElementById("sb-sign-card");
      if (!card) return;

      const letters = token.letters || [];
      if (!letters.length) {
        onDone();
        return;
      }

      card.innerHTML = "";
      card.className = "sb-sign-card sb-card-enter";

      // Create spelling container
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.gap = "12px";

      // Big letter bubble
      const bubble = document.createElement("div");
      bubble.className = "sb-active-letter sb-letter-pop";
      bubble.style.position = "static";
      bubble.style.width = "64px";
      bubble.style.height = "64px";
      bubble.style.fontSize = "32px";
      bubble.style.borderRadius = "50%";
      bubble.style.background = "linear-gradient(135deg, #6c63ff, #ff65a3)";
      bubble.style.color = "#fff";
      bubble.style.fontWeight = "800";
      bubble.style.display = "flex";
      bubble.style.alignItems = "center";
      bubble.style.justifyContent = "center";
      bubble.style.boxShadow = "0 4px 15px rgba(108, 99, 255, 0.4)";
      bubble.textContent = letters[0];

      // Small tracker bar
      const letterTrack = document.createElement("div");
      letterTrack.className = "sb-letter-track";

      letters.forEach((letChar, idx) => {
        const span = document.createElement("span");
        span.className = "sb-track-letter";
        span.textContent = letChar;
        if (idx === 0) span.className = "sb-track-letter sb-track-active";
        letterTrack.appendChild(span);
      });

      container.appendChild(bubble);
      container.appendChild(letterTrack);
      card.appendChild(container);

      let letterIdx = 0;
      let letterDelay = 600; // Normal
      if (playbackSpeed === 1000) letterDelay = 350; // Fast
      else if (playbackSpeed === 3000) letterDelay = 900; // Slow

      fingerspellInterval = setInterval(() => {
        if (isPaused) return; // Wait if paused

        letterIdx++;
        if (letterIdx < letters.length) {
          // Update bubble
          bubble.textContent = letters[letterIdx];
          bubble.classList.remove("sb-letter-pop");
          void bubble.offsetWidth; // Reflow trigger
          bubble.classList.add("sb-letter-pop");

          // Update letter track
          const chips = letterTrack.querySelectorAll(".sb-track-letter");
          chips.forEach((c, idx) => {
            if (idx === letterIdx) c.className = "sb-track-letter sb-track-active";
            else if (idx < letterIdx) c.className = "sb-track-letter sb-track-done";
            else c.className = "sb-track-letter";
          });
        } else {
          clearInterval(fingerspellInterval);
          fingerspellInterval = null;
          // Finished this word, delay briefly and go next
          wordPlaybackTimeout = setTimeout(() => {
            if (!isPaused) {
              onDone();
            }
          }, letterDelay);
        }
      }, letterDelay);
    }

    // ─── Word Track rendering ──────────────────────────────────────────────
    function buildWordTrack() {
      const track = document.getElementById("sb-word-track");
      if (!track) return;
      track.innerHTML = "";

      tokens.forEach((token, i) => {
        const chip = document.createElement("span");
        chip.className = "sb-word-chip";
        chip.dataset.index = i;

        const icon = token.type === "sign" ? "✦" : "⠿";
        chip.innerHTML = `<span class="sb-chip-icon">${icon}</span>${token.word}`;

        // Jump to chip word index
        chip.addEventListener("click", () => {
          currentTokenIndex = i;
          
          // Switch to word lookup tab automatically when clicking chips
          if (activeMode !== "word") {
            switchMode("word");
          } else {
            showCurrentToken();
          }
        });

        track.appendChild(chip);
      });
    }

    function highlightWordTrack(index) {
      const track = document.getElementById("sb-word-track");
      if (!track) return;

      track.querySelectorAll(".sb-word-chip").forEach((el, i) => {
        el.classList.toggle("sb-chip-active", i === index);
        el.classList.toggle("sb-chip-done", i < index);
      });

      const active = track.querySelector(".sb-chip-active");
      if (active) {
        active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }

    // ─── Playback Controls ───────────────────────────────────────────────────
    function togglePause() {
      isPaused = !isPaused;
      const ppBtn = document.getElementById("sb-play-pause");
      if (ppBtn) ppBtn.textContent = isPaused ? "▶" : "⏸";

      if (activeMode === "ai-video") {
        const video = document.querySelector(".sb-video-element");
        if (video) {
          updateVideoPlayPause(video);
        }
        setStatus(isPaused ? "Paused — click ▶ to resume" : "Phase 6 — Generative Prompt Engine");
      } else {
        setStatus(isPaused ? "Paused — click ▶ to resume" : "Phase 6 — Generative Prompt Engine");
        if (!isPaused) {
          showCurrentToken();
        } else {
          stopWordPlayback();
        }
      }
    }

    function cycleSpeed() {
      if (playbackSpeed === 2000) playbackSpeed = 1000;
      else if (playbackSpeed === 1000) playbackSpeed = 3000;
      else playbackSpeed = 2000;

      const label = document.getElementById("sb-speed-label");
      if (label) {
        const names = { 1000: "Fast", 2000: "Normal", 3000: "Slow" };
        label.textContent = names[playbackSpeed] || "Normal";
      }

      if (activeMode === "ai-video") {
        const video = document.querySelector(".sb-video-element");
        if (video) {
          updateVideoSpeed(video);
        }
      } else {
        if (tokens.length && !isPaused) {
          const token = tokens[currentTokenIndex];
          if (token.type === "spell" && fingerspellInterval) {
            showCurrentToken();
          }
        }
      }
    }

    function setStatus(text) {
      const el = document.getElementById("sb-status");
      if (el) el.textContent = text;
    }

    // ─── Drag & Close ───────────────────────────────────────────────────────
    function attachDragHandlers(el) {
      const header = el.querySelector(".sb-header");

      header.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("sb-close-btn")) return;
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

    function attachCloseHandler(el) {
      const closeBtn = el.querySelector(".sb-close-btn");
      closeBtn.addEventListener("click", () => {
        el.classList.add("sb-hidden");
        el.classList.remove("sb-visible");
        stopWordPlayback();
      });
    }

    return { init };

  })();

  SignBrowseOverlay.init();
}
