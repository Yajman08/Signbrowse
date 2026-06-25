/**
 * ISL GRAMMAR ENGINE — engine/grammar.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts natural English sentences into Indian Sign Language (ISL) order.
 * 
 * ISL Sentence Structure Rules:
 *   1. Time-Subject-Object-Verb (TSOV) order.
 *   2. Stop words (articles, helper copulas: is, am, are, a, an, the) are removed.
 *   3. Adjectives precede the nouns they qualify.
 *   4. Negations (not, no, never) are placed after the verb.
 *   5. Question words (what, why, who, etc.) are placed at the end of the sentence.
 *
 * Public API:
 *   SignBrowseGrammar.tokenizeSentence(sentence)
 *   SignBrowseGrammar.removeStopWords(tokens)
 *   SignBrowseGrammar.applyISLGrammarRules(tokens)
 *   SignBrowseGrammar.generateISLSequence(sentence)
 */

const SignBrowseGrammar = (() => {

  // ─── Word Class lists for Rule-based POS Tagging ───────────────────────────
  
  const STOP_WORDS = new Set([
    "a", "an", "the",
    "is", "am", "are", "was", "were", "be", "been", "being",
    "do", "does", "did",
    "has", "have", "had",
    "to", "of", "for", "by", "at", "on", "in",
    "will", "would", "shall", "should", "can", "could", "may", "might", "must"
  ]);

  const TIME_WORDS = new Set([
    "today", "tomorrow", "yesterday", "now", "tonight",
    "morning", "afternoon", "evening", "night",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "soon", "later", "daily", "always", "sometimes", "never", "early", "late"
  ]);

  const QUESTION_WORDS = new Set([
    "what", "why", "where", "who", "when", "how", "which", "whose", "whom"
  ]);

  const NEGATION_WORDS = new Set([
    "not", "no", "never", "dont", "cant", "cannot", "neither", "nor", "havent", "hasnt", "wasnt", "werent"
  ]);

  const PRONOUNS = new Set([
    "i", "me", "my", "mine", "myself",
    "you", "your", "yours", "yourself",
    "he", "him", "his", "himself",
    "she", "her", "hers", "herself",
    "it", "its", "itself",
    "we", "us", "our", "ours", "ourselves",
    "they", "them", "their", "theirs", "themselves"
  ]);

  const ADJECTIVES = new Set([
    "good", "bad", "happy", "sad", "angry", "big", "small", "beautiful", "deaf", "hearing",
    "new", "old", "hot", "cold", "great", "funny", "easy", "hard", "little", "tall", "short",
    "red", "blue", "green", "yellow", "black", "white"
  ]);

  const VERBS = new Set([
    "go", "going", "went", "like", "likes", "liked", "want", "wants", "wanted",
    "help", "helps", "helped", "run", "running", "ran", "eat", "eating", "ate",
    "thank", "thanks", "thanked", "please", "read", "reading", "write", "writing", "wrote",
    "see", "seeing", "saw", "say", "saying", "said", "come", "coming", "came",
    "make", "making", "made", "take", "taking", "took", "think", "thinking", "thought",
    "know", "knowing", "knew", "love", "loves", "loved", "learn", "learning", "learned",
    "play", "playing", "played", "work", "working", "worked", "sleep", "sleeping", "slept"
  ]);


  // ─── 1. Tokenize Sentence ──────────────────────────────────────────────────
  function tokenizeSentence(sentence) {
    if (!sentence || typeof sentence !== "string") return [];

    // Normalize: lowercase, split on whitespace, keep hyphens, clean punctuation
    return sentence
      .toLowerCase()
      .replace(/[^a-z\s\-']/g, "")
      .split(/\s+/)
      .filter(w => w.length > 0);
  }


  // ─── 2. Remove Stop Words ──────────────────────────────────────────────────
  function removeStopWords(tokens) {
    return tokens.filter(token => !STOP_WORDS.has(token));
  }


  // ─── 3. Apply ISL Grammar Tagging ──────────────────────────────────────────
  function applyISLGrammarRules(tokens) {
    const tagged = [];
    
    for (let i = 0; i < tokens.length; i++) {
      const word = tokens[i];
      let pos = "NOUN"; // Default category

      if (TIME_WORDS.has(word)) {
        pos = "TIME";
      } else if (QUESTION_WORDS.has(word)) {
        pos = "QUESTION";
      } else if (NEGATION_WORDS.has(word)) {
        pos = "NEGATION";
      } else if (PRONOUNS.has(word)) {
        pos = "PRONOUN";
      } else if (ADJECTIVES.has(word)) {
        pos = "ADJECTIVE";
      } else if (VERBS.has(word) || word.endsWith("ing") || word.endsWith("ed")) {
        // Simple heuristic: verbs list plus word morphology
        pos = "VERB";
      }

      tagged.push({ word, pos });
    }

    return tagged;
  }


  // ─── 4. Generate ISL Restructured Word Sequence ─────────────────────────────
  function generateISLSequence(sentence) {
    const rawTokens = tokenizeSentence(sentence);
    const cleanedTokens = removeStopWords(rawTokens);
    const tagged = applyISLGrammarRules(cleanedTokens);

    if (tagged.length === 0) return "";

    const times = [];
    const questions = [];
    const negations = [];
    const verbs = [];
    const subjects = [];
    const objects = [];
    const adjectives = [];

    // Helper to determine if we've encountered the main verb
    let verbSeen = false;

    // Scan for verbs first to set correct boundaries
    const firstVerbIndex = tagged.findIndex(t => t.pos === "VERB");

    for (let i = 0; i < tagged.length; i++) {
      const item = tagged[i];

      if (item.pos === "TIME") {
        times.push(item.word);
      } else if (item.pos === "QUESTION") {
        questions.push(item.word);
      } else if (item.pos === "NEGATION") {
        negations.push(item.word);
      } else if (item.pos === "VERB") {
        verbs.push(item.word);
      } else if (item.pos === "ADJECTIVE") {
        // If an adjective is immediately followed by a noun/pronoun, group them
        if (i + 1 < tagged.length && (tagged[i+1].pos === "NOUN" || tagged[i+1].pos === "PRONOUN")) {
          // Keep it adjacent, it will be added when we parse that noun
          adjectives.push({ adj: item.word, targetIdx: i + 1 });
        } else {
          // Standalone adjective
          objects.push(item.word);
        }
      } else {
        // It's a Noun/Pronoun
        // Find if there is an adjective pointing to this index
        const adjObj = adjectives.find(a => a.targetIdx === i);
        const wordCombo = adjObj ? `${adjObj.adj} ${item.word}` : item.word;

        if (firstVerbIndex === -1 || i < firstVerbIndex) {
          subjects.push(wordCombo);
        } else {
          objects.push(wordCombo);
        }
      }
    }

    // Assemble components in standard ISL order:
    // Time -> Subject -> Object (with adjective) -> Verb -> Negation -> Question
    const sequence = [];

    times.forEach(w => sequence.push(...w.split(" ")));
    subjects.forEach(w => sequence.push(...w.split(" ")));
    objects.forEach(w => sequence.push(...w.split(" ")));
    verbs.forEach(w => sequence.push(...w.split(" ")));
    negations.forEach(w => sequence.push(...w.split(" ")));
    questions.forEach(w => sequence.push(...w.split(" ")));

    // Return capitalized ISL gloss sentence
    return sequence.join(" ").toUpperCase();
  }


  return {
    tokenizeSentence,
    removeStopWords,
    applyISLGrammarRules,
    generateISLSequence
  };

})();

// Expose globally
if (typeof window !== "undefined") {
  window.SignBrowseGrammar = SignBrowseGrammar;
}
