# 🤟 SignBrowse — Chrome Extension

> Translate any selected webpage text into Sign Language using an interactive avatar.

---

## Project Status

| Phase | Feature                       | Status      |
|-------|-------------------------------|-------------|
| 1     | UI Shell + Context Menu       | ✅ Complete |
| 2     | Dummy Sign Output             | 🔜 Next     |
| 3     | ISL Translation Engine        | ⏳ Planned  |
| 4     | Avatar Animation              | ⏳ Planned  |
| 5     | LLM Context Understanding     | ⏳ Planned  |
| 6     | Educational Content Adaptation| ⏳ Planned  |
| 7     | YouTube Caption Support       | ⏳ Planned  |

---

## Folder Structure

```
SignBrowse/
├── manifest.json            ← Extension config (Manifest V3)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── background/
│   └── service-worker.js    ← Context menu + message routing
├── content/
│   └── content.js           ← Injected into every webpage; renders overlay
├── popup/
│   ├── popup.html           ← Toolbar popup UI
│   ├── popup.css
│   └── popup.js
├── styles/
│   └── overlay.css          ← Styles for the floating sign panel
└── utils/
    └── constants.js         ← Shared constants across all scripts
```

---

## How to Load in Chrome (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer Mode** ON (top-right)
3. Click **Load unpacked**
4. Select the `SignBrowse/` folder
5. The extension icon (🤟) appears in your toolbar

---

## How It Works (Phase 1)

```
User selects text on any webpage
         ↓
Right-click → "🤟 Translate to Sign Language"
         ↓
service-worker.js catches the click
         ↓
Sends message → content.js (which lives inside the page)
         ↓
content.js builds & shows the draggable overlay
         ↓
User can drag the panel or close it
```

---

## Key Concepts Explained

### Manifest V3
The latest Chrome extension format. Key change: **no persistent background pages** — instead, a **Service Worker** that wakes up on demand and sleeps when idle. This is more performant and secure.

### Content Script
A JavaScript file injected into webpages. It can read and change the DOM, but it can't use most Chrome APIs directly — it must message the service worker.

### Service Worker (Background Script)
Handles browser-level events: context menu clicks, tab events, alarms, network requests. Cannot touch the DOM of a webpage directly.

### Message Passing
Content scripts and the service worker communicate via `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`. Think of it as a walkie-talkie system.

---

## Next: Phase 2

Phase 2 will:
- Parse the selected text word by word
- Show a "dummy" sign output (e.g., fingerspelling letters or placeholder signs)
- Lay the groundwork for connecting a real ISL translation API in Phase 3
