/**
 * TRANSLATION ENGINE — engine/translator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Modular ISL translation engine. Processes input text word-by-word, looks up
 * each word in the ISL dictionary, and falls back to fingerspelling for
 * unknown words.
 *
 * Public API:
 *   SignBrowseTranslator.translateText(text)
 *   SignBrowseTranslator.lookupWord(word)
 *   SignBrowseTranslator.fallbackToFingerspelling(word)
 *
 * Depends on:
 *   - window.ISL_DICTIONARY  (from engine/isl-dictionary.js)
 */

const SignBrowseTranslator = (() => {

  // ── Handshape vectors (carried forward from Phase 2 for fingerspelling) ──
  const HANDSHAPES = {
    A: { thumb:{x2:20,y2:55}, index:{x2:42,y2:48}, middle:{x2:50,y2:46}, ring:{x2:58,y2:48}, pinky:{x2:65,y2:52} },
    B: { thumb:{x2:25,y2:60}, index:{x2:38,y2:15}, middle:{x2:48,y2:12}, ring:{x2:58,y2:15}, pinky:{x2:68,y2:20} },
    C: { thumb:{x2:22,y2:45}, index:{x2:30,y2:25}, middle:{x2:42,y2:20}, ring:{x2:55,y2:25}, pinky:{x2:62,y2:35} },
    D: { thumb:{x2:35,y2:52}, index:{x2:45,y2:12}, middle:{x2:52,y2:48}, ring:{x2:58,y2:50}, pinky:{x2:64,y2:54} },
    E: { thumb:{x2:28,y2:55}, index:{x2:38,y2:42}, middle:{x2:48,y2:40}, ring:{x2:58,y2:42}, pinky:{x2:66,y2:46} },
    F: { thumb:{x2:32,y2:40}, index:{x2:35,y2:38}, middle:{x2:48,y2:15}, ring:{x2:58,y2:18}, pinky:{x2:68,y2:25} },
    G: { thumb:{x2:20,y2:45}, index:{x2:15,y2:40}, middle:{x2:50,y2:48}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    H: { thumb:{x2:25,y2:55}, index:{x2:18,y2:38}, middle:{x2:22,y2:32}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    I: { thumb:{x2:30,y2:55}, index:{x2:42,y2:48}, middle:{x2:50,y2:46}, ring:{x2:58,y2:48}, pinky:{x2:75,y2:22} },
    J: { thumb:{x2:30,y2:55}, index:{x2:42,y2:48}, middle:{x2:50,y2:46}, ring:{x2:58,y2:48}, pinky:{x2:72,y2:28} },
    K: { thumb:{x2:30,y2:45}, index:{x2:35,y2:15}, middle:{x2:55,y2:18}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    L: { thumb:{x2:18,y2:50}, index:{x2:42,y2:12}, middle:{x2:50,y2:48}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    M: { thumb:{x2:35,y2:58}, index:{x2:35,y2:42}, middle:{x2:48,y2:40}, ring:{x2:60,y2:42}, pinky:{x2:66,y2:50} },
    N: { thumb:{x2:38,y2:56}, index:{x2:38,y2:42}, middle:{x2:52,y2:40}, ring:{x2:60,y2:50}, pinky:{x2:66,y2:54} },
    O: { thumb:{x2:30,y2:38}, index:{x2:35,y2:30}, middle:{x2:42,y2:28}, ring:{x2:50,y2:30}, pinky:{x2:55,y2:38} },
    P: { thumb:{x2:28,y2:50}, index:{x2:25,y2:65}, middle:{x2:38,y2:68}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    Q: { thumb:{x2:25,y2:60}, index:{x2:20,y2:65}, middle:{x2:50,y2:48}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    R: { thumb:{x2:30,y2:55}, index:{x2:42,y2:15}, middle:{x2:46,y2:18}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    S: { thumb:{x2:35,y2:45}, index:{x2:40,y2:46}, middle:{x2:48,y2:44}, ring:{x2:56,y2:46}, pinky:{x2:62,y2:50} },
    T: { thumb:{x2:40,y2:42}, index:{x2:38,y2:46}, middle:{x2:50,y2:44}, ring:{x2:58,y2:48}, pinky:{x2:65,y2:52} },
    U: { thumb:{x2:28,y2:55}, index:{x2:40,y2:12}, middle:{x2:52,y2:12}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    V: { thumb:{x2:28,y2:55}, index:{x2:32,y2:12}, middle:{x2:58,y2:12}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    W: { thumb:{x2:25,y2:58}, index:{x2:30,y2:12}, middle:{x2:48,y2:10}, ring:{x2:65,y2:12}, pinky:{x2:68,y2:52} },
    X: { thumb:{x2:30,y2:55}, index:{x2:40,y2:30}, middle:{x2:50,y2:48}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    Y: { thumb:{x2:15,y2:45}, index:{x2:42,y2:48}, middle:{x2:50,y2:46}, ring:{x2:58,y2:48}, pinky:{x2:80,y2:25} },
    Z: { thumb:{x2:30,y2:55}, index:{x2:38,y2:18}, middle:{x2:50,y2:48}, ring:{x2:58,y2:50}, pinky:{x2:65,y2:54} },
    SPACE: { thumb:{x2:20,y2:52}, index:{x2:32,y2:22}, middle:{x2:48,y2:18}, ring:{x2:64,y2:22}, pinky:{x2:78,y2:32} },
  };


  // ─── translateText(text) ─────────────────────────────────────────────────
  // Main entry point. Takes raw text, returns an ordered array of tokens.
  //
  // Each token is either:
  //   { word, type: "sign", data: { svg, description, category } }
  //   { word, type: "fingerspell", letters: [...], handshapes: [...] }
  //
  function translateText(text) {
    if (!text || typeof text !== "string") return [];

    // Normalize: lowercase, split on whitespace, strip non-alpha except hyphens
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s\-']/g, "")
      .split(/\s+/)
      .filter(w => w.length > 0);

    const tokens = [];

    for (const rawWord of words) {
      // Strip trailing punctuation artifacts
      const word = rawWord.replace(/[^a-z]/g, "");
      if (!word) continue;

      const signData = lookupWord(word);

      if (signData) {
        tokens.push({
          word: word,
          type: "sign",
          data: signData
        });
      } else {
        tokens.push(fallbackToFingerspelling(word));
      }
    }

    return tokens;
  }


  // ─── lookupWord(word) ────────────────────────────────────────────────────
  // Checks the ISL dictionary for a word. Returns the sign data object
  // ({ svg, description, category }) or null if not found.
  //
  // Also handles common morphological variations:
  //   "running" → try "run", "helping" → try "help", etc.
  //
  function lookupWord(word) {
    const dict = window.ISL_DICTIONARY;
    if (!dict) {
      console.warn("[SignBrowse] ISL_DICTIONARY not loaded.");
      return null;
    }

    // Direct lookup
    if (dict[word]) return dict[word];

    // Try common suffix stripping (simple stemming)
    const stems = _simpleStem(word);
    for (const stem of stems) {
      if (dict[stem]) return dict[stem];
    }

    return null;
  }


  // ─── fallbackToFingerspelling(word) ──────────────────────────────────────
  // Returns a fingerspelling token for words not found in the dictionary.
  //
  function fallbackToFingerspelling(word) {
    const upper = word.toUpperCase();
    const letters = [];
    const shapes = [];

    for (const ch of upper) {
      if (HANDSHAPES[ch]) {
        letters.push(ch);
        shapes.push(HANDSHAPES[ch]);
      }
    }

    return {
      word: word,
      type: "fingerspell",
      letters: letters,
      handshapes: shapes
    };
  }


  // ─── _simpleStem(word) ───────────────────────────────────────────────────
  // Very basic English stemmer. Returns possible root forms to try.
  //
  function _simpleStem(word) {
    const candidates = [];

    // -ing removal: "running" → "run", "going" → "go"
    if (word.endsWith("ing")) {
      const base = word.slice(0, -3);
      candidates.push(base);
      // doubled consonant: "running" → "runn" → "run"
      if (base.length > 1 && base[base.length - 1] === base[base.length - 2]) {
        candidates.push(base.slice(0, -1));
      }
      // "e" restoration: "making" → "mak" → "make"
      candidates.push(base + "e");
    }

    // -s / -es removal: "books" → "book", "teaches" → "teach"
    if (word.endsWith("es") && word.length > 3) {
      candidates.push(word.slice(0, -2));
    }
    if (word.endsWith("s") && !word.endsWith("ss") && word.length > 2) {
      candidates.push(word.slice(0, -1));
    }

    // -ed removal: "wanted" → "want", "loved" → "love"
    if (word.endsWith("ed") && word.length > 3) {
      candidates.push(word.slice(0, -2));
      candidates.push(word.slice(0, -1)); // "loved" → "love"
      // doubled consonant: "stopped" → "stopp" → "stop"
      const base = word.slice(0, -2);
      if (base.length > 1 && base[base.length - 1] === base[base.length - 2]) {
        candidates.push(base.slice(0, -1));
      }
    }

    // -ly removal: "happily" → "happy", "sadly" → "sad"
    if (word.endsWith("ly") && word.length > 3) {
      candidates.push(word.slice(0, -2));
      // "happily" → "happi" → "happy"
      const base = word.slice(0, -2);
      if (base.endsWith("i")) {
        candidates.push(base.slice(0, -1) + "y");
      }
    }

    // -er / -est removal: "bigger" → "big"
    if (word.endsWith("er") && word.length > 3) {
      candidates.push(word.slice(0, -2));
      const base = word.slice(0, -2);
      if (base.length > 1 && base[base.length - 1] === base[base.length - 2]) {
        candidates.push(base.slice(0, -1));
      }
    }
    if (word.endsWith("est") && word.length > 4) {
      candidates.push(word.slice(0, -3));
    }

    return candidates;
  }


  // ─── getHandshapes() ─────────────────────────────────────────────────────
  // Expose handshapes for the content script's fingerspelling renderer.
  //
  function getHandshapes() {
    return HANDSHAPES;
  }


  // ─── getDictionaryStats() ────────────────────────────────────────────────
  // Returns stats about the loaded dictionary.
  //
  function getDictionaryStats() {
    const dict = window.ISL_DICTIONARY;
    if (!dict) return { total: 0, categories: {} };

    const categories = {};
    let total = 0;

    for (const [word, entry] of Object.entries(dict)) {
      total++;
      const cat = entry.category || "other";
      categories[cat] = (categories[cat] || 0) + 1;
    }

    return { total, categories };
  }


  // ── Public API ───────────────────────────────────────────────────────────
  return {
    translateText,
    lookupWord,
    fallbackToFingerspelling,
    getHandshapes,
    getDictionaryStats
  };

})();


// Expose globally
if (typeof window !== "undefined") {
  window.SignBrowseTranslator = SignBrowseTranslator;
}
