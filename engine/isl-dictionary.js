/**
 * ISL DICTIONARY — engine/isl-dictionary.js
 * ─────────────────────────────────────────────────────────────────────────────
 * A local dictionary mapping common English words to their ISL (Indian Sign
 * Language) sign representations as inline SVG illustrations.
 *
 * Each entry contains:
 *   svg         — An SVG string showing the hand gesture (120×120 viewBox)
 *   description — How to physically perform the sign
 *   category    — Word classification (greeting, pronoun, verb, noun, etc.)
 *
 * The SVGs use a consistent visual language:
 *   • Purple (#6c63ff) = primary hand / dominant hand
 *   • Pink (#ff65a3)   = secondary hand / thumb / motion
 *   • Dashed arrows    = direction of movement
 *   • Dotted arcs      = repeated / circular motion
 *
 * NOTE: These are simplified, stylized illustrations — not exact ISL notation.
 * Future phases will replace these with avatar animations (Phase 5).
 */

// Helper: builds a consistent SVG wrapper around inner content
function _svg(inner, motionArrow) {
  const arrow = motionArrow || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <radialGradient id="sbg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgba(108,99,255,0.08)"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <rect width="120" height="120" fill="url(#sbg)" rx="12"/>
    ${inner}
    ${arrow}
  </svg>`;
}

// Helper: a simple open palm shape centered at (cx, cy) with scale
function _palm(cx, cy, scale, color) {
  const s = scale || 1;
  const c = color || "#6c63ff";
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <ellipse cx="0" cy="0" rx="14" ry="18" fill="${c}" opacity="0.85"/>
    <line x1="-8" y1="-16" x2="-14" y2="-38" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="-2" y1="-18" x2="-4" y2="-42" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="4" y1="-18" x2="4" y2="-42" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="10" y1="-16" x2="14" y2="-38" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <line x1="-12" y1="-6" x2="-26" y2="-14" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

// Helper: a fist shape
function _fist(cx, cy, scale, color) {
  const s = scale || 1;
  const c = color || "#6c63ff";
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    <ellipse cx="0" cy="0" rx="14" ry="16" fill="${c}" opacity="0.85"/>
    <line x1="-12" y1="-4" x2="-22" y2="-10" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="0" cy="-10" rx="12" ry="6" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/>
  </g>`;
}

// Helper: motion arrow
function _arrow(x1, y1, x2, y2, color) {
  const c = color || "#ff65a3";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arrowhead)"/>
  <defs><marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
    <polygon points="0 0, 6 2, 0 4" fill="${c}"/>
  </marker></defs>`;
}

// Helper: curved/wave motion
function _wave(cx, cy, color) {
  const c = color || "#ff65a3";
  return `<path d="M ${cx-18} ${cy} Q ${cx-9} ${cy-10} ${cx} ${cy} Q ${cx+9} ${cy+10} ${cx+18} ${cy}" stroke="${c}" stroke-width="2" fill="none" stroke-dasharray="3,2" opacity="0.7"/>`;
}


const ISL_DICTIONARY = {

  // ═══════════════════════════════════════════════════════════════════════════
  // GREETINGS & COMMON PHRASES
  // ═══════════════════════════════════════════════════════════════════════════

  "hello": {
    svg: _svg(
      _palm(60, 65, 1, "#6c63ff") +
      _wave(60, 108, "#ff65a3"),
      _arrow(75, 60, 95, 45, "#ff65a3")
    ),
    description: "Open palm, wave side to side",
    category: "greeting"
  },

  "hi": {
    svg: _svg(
      _palm(60, 65, 1, "#6c63ff") +
      _wave(60, 108, "#ff65a3"),
      _arrow(75, 60, 95, 45, "#ff65a3")
    ),
    description: "Open palm, small wave",
    category: "greeting"
  },

  "goodbye": {
    svg: _svg(
      _palm(60, 60, 1, "#6c63ff"),
      _arrow(60, 45, 60, 20, "#ff65a3") +
      _wave(60, 105, "#ff65a3")
    ),
    description: "Open palm facing forward, wave away",
    category: "greeting"
  },

  "bye": {
    svg: _svg(
      _palm(60, 60, 1, "#6c63ff"),
      _arrow(60, 45, 60, 20, "#ff65a3")
    ),
    description: "Open palm, wave up-down",
    category: "greeting"
  },

  "welcome": {
    svg: _svg(
      _palm(45, 65, 0.8, "#6c63ff") +
      _palm(75, 65, 0.8, "#ff65a3"),
      _arrow(45, 50, 35, 35, "#ff65a3") +
      _arrow(75, 50, 85, 35, "#ff65a3")
    ),
    description: "Both palms open, sweep inward toward body",
    category: "greeting"
  },

  "please": {
    svg: _svg(
      `<ellipse cx="60" cy="65" rx="16" ry="20" fill="#6c63ff" opacity="0.85"/>
       <circle cx="60" cy="45" r="4" fill="#ff65a3"/>`,
      _arrow(60, 80, 60, 100, "#ff65a3")
    ),
    description: "Flat hand on chest, move downward",
    category: "greeting"
  },

  "thank": {
    svg: _svg(
      `<ellipse cx="60" cy="55" rx="14" ry="18" fill="#6c63ff" opacity="0.85"/>
       <line x1="60" y1="37" x2="60" y2="20" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
       <rect x="48" y="75" width="24" height="4" rx="2" fill="#ff65a3" opacity="0.5"/>`,
      _arrow(60, 55, 60, 85, "#ff65a3")
    ),
    description: "Touch chin with fingertips, move hand forward",
    category: "greeting"
  },

  "thanks": {
    svg: _svg(
      `<ellipse cx="60" cy="55" rx="14" ry="18" fill="#6c63ff" opacity="0.85"/>
       <line x1="60" y1="37" x2="60" y2="20" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>`,
      _arrow(60, 55, 60, 85, "#ff65a3")
    ),
    description: "Touch chin, move hand outward",
    category: "greeting"
  },

  "sorry": {
    svg: _svg(
      _fist(60, 60, 1, "#6c63ff") +
      `<circle cx="60" cy="90" r="12" fill="none" stroke="#ff65a3" stroke-width="2" stroke-dasharray="4,3" opacity="0.6"/>`,
      ""
    ),
    description: "Fist circles on chest",
    category: "greeting"
  },

  "yes": {
    svg: _svg(
      _fist(60, 55, 1, "#6c63ff"),
      _arrow(60, 40, 60, 25, "#ff65a3") +
      _arrow(60, 65, 60, 80, "#ff65a3")
    ),
    description: "Fist nods up and down (like nodding head)",
    category: "response"
  },

  "no": {
    svg: _svg(
      `<g transform="translate(60,55)">
        <line x1="-8" y1="-20" x2="0" y2="-36" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="4" y1="-20" x2="10" y2="-36" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="14" ry="18" fill="#6c63ff" opacity="0.85"/>
        <line x1="-10" y1="-4" x2="-22" y2="-8" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
      </g>`,
      _arrow(48, 45, 72, 45, "#ff65a3")
    ),
    description: "Index and middle finger snap against thumb",
    category: "response"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PRONOUNS
  // ═══════════════════════════════════════════════════════════════════════════

  "i": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <line x1="0" y1="-18" x2="0" y2="-40" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-40" r="3" fill="#ff65a3"/>
      </g>`,
      _arrow(60, 65, 60, 85, "#ff65a3")
    ),
    description: "Point index finger to own chest",
    category: "pronoun"
  },

  "me": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <line x1="0" y1="-18" x2="0" y2="-40" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-40" r="3" fill="#ff65a3"/>
      </g>`,
      _arrow(60, 65, 60, 85, "#ff65a3")
    ),
    description: "Point index finger to own chest",
    category: "pronoun"
  },

  "you": {
    svg: _svg(
      `<g transform="translate(55,62)">
        <line x1="0" y1="-18" x2="12" y2="-40" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="12" cy="-40" r="3" fill="#ff65a3"/>
      </g>`,
      _arrow(67, 22, 80, 15, "#ff65a3")
    ),
    description: "Point index finger toward the other person",
    category: "pronoun"
  },

  "he": {
    svg: _svg(
      `<g transform="translate(50,62)">
        <line x1="0" y1="-18" x2="20" y2="-35" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="20" cy="-35" r="3" fill="#ff65a3"/>
      </g>`,
      ""
    ),
    description: "Point to the side (toward male person)",
    category: "pronoun"
  },

  "she": {
    svg: _svg(
      `<g transform="translate(50,62)">
        <line x1="0" y1="-18" x2="20" y2="-35" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="20" cy="-35" r="3" fill="#ff65a3"/>
      </g>`,
      ""
    ),
    description: "Point to the side (toward female person)",
    category: "pronoun"
  },

  "we": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <line x1="0" y1="-18" x2="0" y2="-38" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-38" r="3" fill="#ff65a3"/>
      </g>`,
      _arrow(50, 50, 30, 50, "#ff65a3") +
      _arrow(70, 50, 90, 50, "#ff65a3")
    ),
    description: "Point to self, then sweep finger to include others",
    category: "pronoun"
  },

  "they": {
    svg: _svg(
      `<g transform="translate(55,60)">
        <line x1="0" y1="-18" x2="15" y2="-35" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="15" cy="-35" r="3" fill="#ff65a3"/>
      </g>`,
      _arrow(70, 30, 95, 30, "#ff65a3")
    ),
    description: "Sweep pointing finger across multiple people",
    category: "pronoun"
  },

  "my": {
    svg: _svg(
      _palm(60, 60, 0.9, "#6c63ff"),
      _arrow(60, 70, 60, 90, "#ff65a3")
    ),
    description: "Flat palm on chest",
    category: "pronoun"
  },

  "your": {
    svg: _svg(
      _palm(60, 60, 0.9, "#6c63ff"),
      _arrow(60, 50, 75, 35, "#ff65a3")
    ),
    description: "Push flat palm toward the other person",
    category: "pronoun"
  },

  "this": {
    svg: _svg(
      `<g transform="translate(60,60)">
        <line x1="0" y1="-16" x2="0" y2="-38" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-38" r="3" fill="#ff65a3"/>
      </g>`,
      _arrow(60, 22, 60, 10, "#ff65a3")
    ),
    description: "Point index finger downward at object",
    category: "pronoun"
  },

  "that": {
    svg: _svg(
      `<g transform="translate(50,60)">
        <line x1="0" y1="-16" x2="20" y2="-36" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="20" cy="-36" r="3" fill="#ff65a3"/>
      </g>`,
      ""
    ),
    description: "Point index finger away at distant object",
    category: "pronoun"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMON VERBS
  // ═══════════════════════════════════════════════════════════════════════════

  "go": {
    svg: _svg(
      `<g transform="translate(45,60)">
        <line x1="0" y1="-16" x2="8" y2="-38" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="6" y1="-16" x2="16" y2="-38" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
      </g>`,
      _arrow(55, 45, 90, 35, "#ff65a3")
    ),
    description: "Both index fingers bend forward simultaneously",
    category: "verb"
  },

  "come": {
    svg: _svg(
      `<g transform="translate(75,60)">
        <line x1="0" y1="-16" x2="-8" y2="-38" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
      </g>`,
      _arrow(70, 40, 40, 50, "#ff65a3")
    ),
    description: "Index finger beckons toward self",
    category: "verb"
  },

  "want": {
    svg: _svg(
      `<g transform="translate(60,55)">
        <ellipse cx="-15" cy="0" rx="13" ry="16" fill="#6c63ff" opacity="0.85"/>
        <ellipse cx="15" cy="0" rx="13" ry="16" fill="#ff65a3" opacity="0.7"/>
      </g>`,
      _arrow(45, 70, 45, 85, "#ff65a3") +
      _arrow(75, 70, 75, 85, "#ff65a3")
    ),
    description: "Clawed hands pull toward body",
    category: "verb"
  },

  "need": {
    svg: _svg(
      `<g transform="translate(60,60)">
        <line x1="0" y1="-16" x2="0" y2="-38" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
      </g>`,
      _arrow(60, 45, 60, 75, "#ff65a3")
    ),
    description: "Bent index finger pulls down",
    category: "verb"
  },

  "help": {
    svg: _svg(
      `<g>
        <ellipse cx="60" cy="75" rx="14" ry="10" fill="#ff65a3" opacity="0.7"/>
        ${_fist(60, 50, 0.9, "#6c63ff")}
      </g>`,
      _arrow(60, 60, 60, 40, "#ff65a3")
    ),
    description: "Fist on flat palm, lift upward",
    category: "verb"
  },

  "like": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <ellipse cx="0" cy="0" rx="14" ry="18" fill="#6c63ff" opacity="0.85"/>
        <line x1="-10" y1="-4" x2="-22" y2="-10" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="4" y1="-18" x2="6" y2="-38" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <circle cx="6" cy="-38" r="3" fill="#ff65a3"/>
      </g>`,
      _arrow(60, 50, 60, 30, "#ff65a3")
    ),
    description: "Middle finger and thumb touch chest, pull away",
    category: "verb"
  },

  "love": {
    svg: _svg(
      `<g>
        ${_fist(40, 60, 0.8, "#6c63ff")}
        ${_fist(80, 60, 0.8, "#ff65a3")}
        <text x="60" y="95" text-anchor="middle" font-size="18" fill="#ff65a3" opacity="0.6">♥</text>
      </g>`,
      ""
    ),
    description: "Cross arms over chest (hug self)",
    category: "verb"
  },

  "eat": {
    svg: _svg(
      `<g transform="translate(60,55)">
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#6c63ff" opacity="0.85"/>
        <line x1="0" y1="-12" x2="0" y2="-28" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="-6" y1="-10" x2="-10" y2="-24" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="6" y1="-10" x2="10" y2="-24" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/>
      </g>` +
      `<ellipse cx="60" cy="90" rx="12" ry="6" fill="none" stroke="#ff65a3" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.5"/>`,
      _arrow(60, 45, 60, 80, "#ff65a3")
    ),
    description: "Bring bunched fingers to mouth repeatedly",
    category: "verb"
  },

  "drink": {
    svg: _svg(
      `<g transform="translate(60,52)">
        <rect x="-10" y="-5" width="20" height="30" rx="4" fill="none" stroke="#6c63ff" stroke-width="2.5"/>
        <ellipse cx="0" cy="-5" rx="10" ry="4" fill="#6c63ff" opacity="0.3"/>
      </g>`,
      _arrow(60, 42, 60, 25, "#ff65a3")
    ),
    description: "Mime holding cup, tilt toward mouth",
    category: "verb"
  },

  "give": {
    svg: _svg(
      _palm(50, 60, 0.85, "#6c63ff"),
      _arrow(55, 55, 85, 45, "#ff65a3")
    ),
    description: "Flat hand moves from body outward",
    category: "verb"
  },

  "take": {
    svg: _svg(
      `<g transform="translate(70,55)">
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <line x1="-8" y1="-12" x2="-10" y2="-30" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="0" y1="-14" x2="0" y2="-32" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="8" y1="-12" x2="10" y2="-30" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
      </g>`,
      _arrow(70, 45, 45, 55, "#ff65a3")
    ),
    description: "Grab toward body",
    category: "verb"
  },

  "see": {
    svg: _svg(
      `<g transform="translate(55,55)">
        <line x1="0" y1="-14" x2="5" y2="-36" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="6" y1="-14" x2="14" y2="-36" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="3" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="5" cy="-36" r="2.5" fill="#ff65a3"/>
        <circle cx="14" cy="-36" r="2.5" fill="#ff65a3"/>
      </g>`,
      _arrow(65, 25, 85, 20, "#ff65a3")
    ),
    description: "V-hand from eyes outward",
    category: "verb"
  },

  "know": {
    svg: _svg(
      _palm(60, 58, 0.9, "#6c63ff") +
      `<circle cx="60" cy="25" r="8" fill="none" stroke="#ff65a3" stroke-width="2" opacity="0.5"/>
       <circle cx="60" cy="25" r="3" fill="#ff65a3" opacity="0.6"/>`,
      ""
    ),
    description: "Tap fingertips to forehead/temple",
    category: "verb"
  },

  "think": {
    svg: _svg(
      `<g transform="translate(60,62)">
        <line x1="0" y1="-16" x2="0" y2="-36" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-36" r="3" fill="#ff65a3"/>
      </g>` +
      `<circle cx="60" cy="18" r="6" fill="none" stroke="#ff65a3" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.5"/>`,
      ""
    ),
    description: "Index finger circles near temple",
    category: "verb"
  },

  "learn": {
    svg: _svg(
      `<g>
        <ellipse cx="60" cy="80" rx="18" ry="8" fill="#ff65a3" opacity="0.3"/>
        ${_palm(60, 55, 0.85, "#6c63ff")}
      </g>`,
      _arrow(60, 50, 60, 25, "#ff65a3")
    ),
    description: "Pick up from flat surface, bring to forehead",
    category: "verb"
  },

  "teach": {
    svg: _svg(
      _palm(42, 55, 0.75, "#6c63ff") +
      _palm(78, 55, 0.75, "#ff65a3"),
      _arrow(42, 42, 42, 28, "#ff65a3") +
      _arrow(78, 42, 78, 28, "#ff65a3")
    ),
    description: "Both hands at temples, move outward",
    category: "verb"
  },

  "work": {
    svg: _svg(
      _fist(45, 55, 0.85, "#6c63ff") +
      _fist(75, 55, 0.85, "#ff65a3"),
      _arrow(45, 68, 45, 80, "#ff65a3") +
      _arrow(75, 68, 75, 80, "#ff65a3")
    ),
    description: "Fist taps on top of other fist repeatedly",
    category: "verb"
  },

  "stop": {
    svg: _svg(
      _palm(60, 55, 1, "#6c63ff") +
      `<line x1="35" y1="80" x2="85" y2="80" stroke="#ff65a3" stroke-width="3" stroke-linecap="round"/>`,
      _arrow(60, 42, 60, 75, "#ff65a3")
    ),
    description: "Sharp downward chop of flat hand onto palm",
    category: "verb"
  },

  "wait": {
    svg: _svg(
      _palm(45, 55, 0.8, "#6c63ff") +
      _palm(75, 55, 0.8, "#ff65a3") +
      _wave(60, 100, "#ff65a3"),
      ""
    ),
    description: "Both hands up, fingers wiggle",
    category: "verb"
  },

  "read": {
    svg: _svg(
      `<g>
        <rect x="38" y="55" width="44" height="35" rx="3" fill="none" stroke="#ff65a3" stroke-width="2" opacity="0.5"/>
        <line x1="45" y1="65" x2="75" y2="65" stroke="#ff65a3" stroke-width="1.5" opacity="0.3"/>
        <line x1="45" y1="72" x2="75" y2="72" stroke="#ff65a3" stroke-width="1.5" opacity="0.3"/>
        <line x1="45" y1="79" x2="65" y2="79" stroke="#ff65a3" stroke-width="1.5" opacity="0.3"/>
        ${_palm(60, 40, 0.7, "#6c63ff")}
      </g>`,
      _arrow(55, 40, 55, 55, "#ff65a3")
    ),
    description: "V-hand sweeps down over flat palm (book)",
    category: "verb"
  },

  "write": {
    svg: _svg(
      `<g>
        <ellipse cx="60" cy="82" rx="22" ry="10" fill="#ff65a3" opacity="0.2"/>
        <g transform="translate(55,50) rotate(-30)">
          <rect x="-3" y="-20" width="6" height="30" rx="2" fill="#6c63ff" opacity="0.85"/>
          <circle cx="0" cy="12" r="2" fill="#ff65a3"/>
        </g>
      </g>`,
      _wave(60, 100, "#ff65a3")
    ),
    description: "Mime writing on flat palm",
    category: "verb"
  },

  "make": {
    svg: _svg(
      _fist(45, 55, 0.85, "#6c63ff") +
      _fist(75, 55, 0.85, "#ff65a3"),
      _arrow(45, 65, 45, 50, "#ff65a3") +
      _arrow(75, 65, 75, 50, "#ff65a3")
    ),
    description: "Fists twist on top of each other",
    category: "verb"
  },

  "do": {
    svg: _svg(
      _palm(45, 58, 0.8, "#6c63ff") +
      _palm(75, 58, 0.8, "#ff65a3"),
      _arrow(45, 55, 30, 55, "#ff65a3") +
      _arrow(75, 55, 90, 55, "#ff65a3")
    ),
    description: "Both hands move side to side",
    category: "verb"
  },

  "say": {
    svg: _svg(
      `<g transform="translate(60,60)">
        <line x1="0" y1="-16" x2="0" y2="-36" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-36" r="3" fill="#ff65a3"/>
      </g>` +
      `<circle cx="60" cy="90" r="5" fill="none" stroke="#ff65a3" stroke-width="1.5" opacity="0.4"/>
       <circle cx="72" cy="88" r="3.5" fill="none" stroke="#ff65a3" stroke-width="1.5" opacity="0.3"/>`,
      _arrow(60, 80, 60, 95, "#ff65a3")
    ),
    description: "Index finger circles near mouth",
    category: "verb"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADJECTIVES & ADVERBS
  // ═══════════════════════════════════════════════════════════════════════════

  "good": {
    svg: _svg(
      _palm(60, 55, 0.9, "#6c63ff"),
      _arrow(60, 50, 60, 30, "#ff65a3")
    ),
    description: "Flat hand from chin moves forward and down",
    category: "adjective"
  },

  "bad": {
    svg: _svg(
      _palm(60, 50, 0.9, "#6c63ff"),
      _arrow(60, 55, 60, 80, "#ff65a3")
    ),
    description: "Flat hand from chin drops down sharply",
    category: "adjective"
  },

  "big": {
    svg: _svg(
      _palm(40, 58, 0.75, "#6c63ff") +
      _palm(80, 58, 0.75, "#ff65a3"),
      _arrow(40, 50, 20, 45, "#ff65a3") +
      _arrow(80, 50, 100, 45, "#ff65a3")
    ),
    description: "Both hands spread apart widely",
    category: "adjective"
  },

  "small": {
    svg: _svg(
      _palm(50, 58, 0.7, "#6c63ff") +
      _palm(70, 58, 0.7, "#ff65a3"),
      _arrow(45, 55, 55, 58, "#ff65a3") +
      _arrow(75, 55, 65, 58, "#ff65a3")
    ),
    description: "Both hands move close together",
    category: "adjective"
  },

  "happy": {
    svg: _svg(
      _palm(60, 55, 0.9, "#6c63ff"),
      _arrow(60, 50, 60, 30, "#ff65a3") +
      _arrow(60, 50, 60, 30, "#ff65a3") +
      `<text x="60" y="100" text-anchor="middle" font-size="14" fill="#ff65a3" opacity="0.5">☺</text>`
    ),
    description: "Flat hand brushes up on chest repeatedly",
    category: "adjective"
  },

  "sad": {
    svg: _svg(
      _palm(60, 48, 0.9, "#6c63ff"),
      _arrow(60, 55, 60, 80, "#ff65a3") +
      `<text x="60" y="100" text-anchor="middle" font-size="14" fill="#ff65a3" opacity="0.5">☹</text>`
    ),
    description: "Open hands in front of face, pull down",
    category: "adjective"
  },

  "new": {
    svg: _svg(
      `<g>
        <ellipse cx="70" cy="72" rx="18" ry="10" fill="#ff65a3" opacity="0.25"/>
        ${_palm(55, 50, 0.8, "#6c63ff")}
      </g>`,
      _arrow(55, 55, 75, 68, "#ff65a3")
    ),
    description: "Curved hand scoops across flat palm",
    category: "adjective"
  },

  "old": {
    svg: _svg(
      _fist(60, 52, 0.9, "#6c63ff"),
      _arrow(60, 45, 60, 80, "#ff65a3")
    ),
    description: "Fist at chin, pull down (imaginary beard)",
    category: "adjective"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NOUNS
  // ═══════════════════════════════════════════════════════════════════════════

  "name": {
    svg: _svg(
      `<g transform="translate(60,55)">
        <line x1="-5" y1="-16" x2="-5" y2="-34" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="5" y1="-16" x2="5" y2="-34" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="14" ry="16" fill="#6c63ff" opacity="0.85"/>
        <circle cx="-5" cy="-34" r="2.5" fill="#ff65a3"/>
        <circle cx="5" cy="-34" r="2.5" fill="#ff65a3"/>
      </g>`,
      _arrow(55, 35, 55, 25, "#ff65a3")
    ),
    description: "H-hand taps on other H-hand (cross-tap)",
    category: "noun"
  },

  "friend": {
    svg: _svg(
      `<g transform="translate(60,55)">
        <line x1="-8" y1="-10" x2="-14" y2="-28" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="8" y1="-10" x2="14" y2="-28" stroke="#ff65a3" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="4" rx="16" ry="10" fill="#6c63ff" opacity="0.6"/>
      </g>`,
      ""
    ),
    description: "Interlocking index fingers, flip over",
    category: "noun"
  },

  "family": {
    svg: _svg(
      `<g>
        <circle cx="45" cy="40" r="8" fill="none" stroke="#6c63ff" stroke-width="2"/>
        <circle cx="75" cy="40" r="8" fill="none" stroke="#ff65a3" stroke-width="2"/>
        <circle cx="60" cy="65" r="6" fill="none" stroke="#6c63ff" stroke-width="1.5" opacity="0.7"/>
        <circle cx="48" cy="72" r="5" fill="none" stroke="#ff65a3" stroke-width="1.5" opacity="0.5"/>
        <circle cx="72" cy="72" r="5" fill="none" stroke="#ff65a3" stroke-width="1.5" opacity="0.5"/>
        <line x1="45" y1="48" x2="55" y2="59" stroke="#6c63ff" stroke-width="1.5" opacity="0.3"/>
        <line x1="75" y1="48" x2="65" y2="59" stroke="#ff65a3" stroke-width="1.5" opacity="0.3"/>
      </g>`,
      ""
    ),
    description: "F-hands circle outward from body",
    category: "noun"
  },

  "home": {
    svg: _svg(
      `<g>
        <path d="M 35 65 L 60 40 L 85 65" fill="none" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="42" y="65" width="36" height="25" rx="3" fill="none" stroke="#6c63ff" stroke-width="2"/>
        <rect x="55" y="75" width="10" height="15" rx="2" fill="#ff65a3" opacity="0.3"/>
      </g>`,
      ""
    ),
    description: "Bunched fingers touch chin then cheek",
    category: "noun"
  },

  "school": {
    svg: _svg(
      _palm(55, 48, 0.75, "#6c63ff") +
      `<ellipse cx="60" cy="80" rx="22" ry="10" fill="#ff65a3" opacity="0.2"/>`,
      _arrow(55, 55, 55, 72, "#ff65a3") +
      _arrow(55, 72, 55, 55, "#6c63ff")
    ),
    description: "Clap hands (teacher clapping for attention)",
    category: "noun"
  },

  "food": {
    svg: _svg(
      `<g transform="translate(60,52)">
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#6c63ff" opacity="0.85"/>
        <line x1="-4" y1="-12" x2="-6" y2="-26" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="4" y1="-12" x2="6" y2="-26" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/>
      </g>`,
      _arrow(60, 42, 60, 25, "#ff65a3") +
      `<circle cx="60" cy="85" r="4" fill="#ff65a3" opacity="0.3"/>
       <circle cx="50" cy="90" r="3" fill="#ff65a3" opacity="0.2"/>
       <circle cx="70" cy="88" r="3" fill="#ff65a3" opacity="0.2"/>`
    ),
    description: "Bring bunched fingers to mouth",
    category: "noun"
  },

  "water": {
    svg: _svg(
      `<g transform="translate(60,52)">
        <line x1="0" y1="-14" x2="0" y2="-34" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="-6" y1="-12" x2="-10" y2="-30" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="6" y1="-12" x2="10" y2="-30" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
      </g>` +
      `<path d="M 35 90 Q 47 82 60 90 Q 73 98 85 90" stroke="#ff65a3" stroke-width="1.5" fill="none" opacity="0.5"/>`,
      _arrow(60, 42, 60, 30, "#ff65a3")
    ),
    description: "W-hand taps chin",
    category: "noun"
  },

  "time": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <circle cx="0" cy="0" r="20" fill="none" stroke="#6c63ff" stroke-width="2"/>
        <line x1="0" y1="0" x2="0" y2="-14" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="0" y1="0" x2="10" y2="-5" stroke="#ff65a3" stroke-width="2" stroke-linecap="round"/>
        <circle cx="0" cy="0" r="2.5" fill="#ff65a3"/>
      </g>`,
      ""
    ),
    description: "Point to wrist (where watch would be)",
    category: "noun"
  },

  "book": {
    svg: _svg(
      `<g transform="translate(60,60)">
        <rect x="-20" y="-12" width="18" height="28" rx="2" fill="#6c63ff" opacity="0.7" transform="rotate(-5)"/>
        <rect x="2" y="-12" width="18" height="28" rx="2" fill="#ff65a3" opacity="0.5" transform="rotate(5)"/>
        <line x1="0" y1="-12" x2="0" y2="16" stroke="#fff" stroke-width="1" opacity="0.3"/>
      </g>`,
      _arrow(40, 55, 30, 50, "#ff65a3") +
      _arrow(80, 55, 90, 50, "#ff65a3")
    ),
    description: "Open palms together like opening a book",
    category: "noun"
  },

  "world": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <circle cx="0" cy="0" r="22" fill="none" stroke="#6c63ff" stroke-width="2"/>
        <ellipse cx="0" cy="0" rx="12" ry="22" fill="none" stroke="#6c63ff" stroke-width="1.5" opacity="0.5"/>
        <line x1="-22" y1="0" x2="22" y2="0" stroke="#ff65a3" stroke-width="1.5" opacity="0.4"/>
        <circle cx="-8" cy="-8" r="4" fill="#6c63ff" opacity="0.2"/>
        <circle cx="10" cy="6" r="5" fill="#ff65a3" opacity="0.15"/>
      </g>`,
      ""
    ),
    description: "W-hands circle around each other",
    category: "noun"
  },

  "people": {
    svg: _svg(
      `<g>
        <circle cx="40" cy="45" r="7" fill="none" stroke="#6c63ff" stroke-width="2"/>
        <line x1="40" y1="52" x2="40" y2="75" stroke="#6c63ff" stroke-width="2"/>
        <circle cx="60" cy="40" r="7" fill="none" stroke="#ff65a3" stroke-width="2"/>
        <line x1="60" y1="47" x2="60" y2="70" stroke="#ff65a3" stroke-width="2"/>
        <circle cx="80" cy="45" r="7" fill="none" stroke="#6c63ff" stroke-width="2" opacity="0.6"/>
        <line x1="80" y1="52" x2="80" y2="75" stroke="#6c63ff" stroke-width="2" opacity="0.6"/>
      </g>`,
      ""
    ),
    description: "P-hands alternate circling",
    category: "noun"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION WORDS
  // ═══════════════════════════════════════════════════════════════════════════

  "what": {
    svg: _svg(
      _palm(60, 55, 0.9, "#6c63ff") +
      `<text x="60" y="100" text-anchor="middle" font-size="20" fill="#ff65a3" opacity="0.5">?</text>`,
      _arrow(48, 50, 35, 40, "#ff65a3") +
      _arrow(72, 50, 85, 40, "#ff65a3")
    ),
    description: "Palms up, shake hands side to side",
    category: "question"
  },

  "where": {
    svg: _svg(
      `<g transform="translate(60,55)">
        <line x1="0" y1="-16" x2="0" y2="-38" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-38" r="3" fill="#ff65a3"/>
      </g>` +
      `<text x="60" y="100" text-anchor="middle" font-size="18" fill="#ff65a3" opacity="0.5">?</text>`,
      _arrow(55, 30, 40, 30, "#ff65a3") +
      _arrow(65, 30, 80, 30, "#ff65a3")
    ),
    description: "Wag index finger side to side",
    category: "question"
  },

  "when": {
    svg: _svg(
      `<g transform="translate(60,55)">
        <line x1="0" y1="-16" x2="0" y2="-38" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-38" r="3" fill="#ff65a3"/>
      </g>` +
      `<text x="60" y="100" text-anchor="middle" font-size="18" fill="#ff65a3" opacity="0.5">?</text>`,
      `<circle cx="60" cy="35" r="8" fill="none" stroke="#ff65a3" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.5"/>`
    ),
    description: "Index finger circles, then points",
    category: "question"
  },

  "who": {
    svg: _svg(
      `<g transform="translate(60,55)">
        <line x1="0" y1="-16" x2="0" y2="-38" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-38" r="3" fill="#ff65a3"/>
      </g>` +
      `<text x="60" y="100" text-anchor="middle" font-size="18" fill="#ff65a3" opacity="0.5">?</text>`,
      `<circle cx="60" cy="90" r="4" fill="none" stroke="#ff65a3" stroke-width="1.5" opacity="0.4"/>`
    ),
    description: "Index finger circles around pursed lips",
    category: "question"
  },

  "why": {
    svg: _svg(
      `<g transform="translate(60,50)">
        <line x1="0" y1="-14" x2="0" y2="-34" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="6" y1="-14" x2="10" y2="-32" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <line x1="12" y1="-10" x2="18" y2="-26" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="14" ry="16" fill="#6c63ff" opacity="0.85"/>
      </g>` +
      `<text x="60" y="100" text-anchor="middle" font-size="18" fill="#ff65a3" opacity="0.5">?</text>`,
      ""
    ),
    description: "Touch forehead, pull away into Y-hand",
    category: "question"
  },

  "how": {
    svg: _svg(
      _fist(45, 55, 0.8, "#6c63ff") +
      _fist(75, 55, 0.8, "#ff65a3"),
      _arrow(45, 50, 45, 35, "#ff65a3") +
      _arrow(75, 50, 75, 35, "#ff65a3") +
      `<text x="60" y="100" text-anchor="middle" font-size="18" fill="#ff65a3" opacity="0.5">?</text>`
    ),
    description: "Knuckles together, roll hands open",
    category: "question"
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTRA COMMON WORDS
  // ═══════════════════════════════════════════════════════════════════════════

  "is": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <line x1="0" y1="-14" x2="0" y2="-34" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-34" r="3" fill="#ff65a3"/>
      </g>`,
      _arrow(60, 55, 80, 50, "#ff65a3")
    ),
    description: "I-hand from chin moves forward",
    category: "verb"
  },

  "are": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <line x1="0" y1="-14" x2="0" y2="-34" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#6c63ff" opacity="0.85"/>
      </g>`,
      _arrow(60, 55, 85, 50, "#ff65a3")
    ),
    description: "R-hand from lips moves forward",
    category: "verb"
  },

  "not": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <line x1="-10" y1="-6" x2="-24" y2="-12" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="14" ry="16" fill="#6c63ff" opacity="0.85"/>
      </g>`,
      _arrow(36, 46, 20, 40, "#ff65a3")
    ),
    description: "Thumb under chin, flick forward",
    category: "adverb"
  },

  "can": {
    svg: _svg(
      _fist(45, 58, 0.85, "#6c63ff") +
      _fist(75, 58, 0.85, "#ff65a3"),
      _arrow(45, 65, 45, 80, "#ff65a3") +
      _arrow(75, 65, 75, 80, "#ff65a3")
    ),
    description: "Both S-fists push down together",
    category: "verb"
  },

  "with": {
    svg: _svg(
      _fist(45, 58, 0.85, "#6c63ff") +
      _fist(75, 58, 0.85, "#ff65a3"),
      _arrow(45, 55, 55, 55, "#ff65a3") +
      _arrow(75, 55, 65, 55, "#ff65a3")
    ),
    description: "Both fists come together",
    category: "preposition"
  },

  "have": {
    svg: _svg(
      _palm(60, 55, 0.9, "#6c63ff"),
      _arrow(60, 55, 60, 75, "#ff65a3")
    ),
    description: "Bent hands touch chest",
    category: "verb"
  },

  "more": {
    svg: _svg(
      `<g>
        <ellipse cx="45" cy="60" rx="10" ry="12" fill="#6c63ff" opacity="0.85"/>
        <ellipse cx="75" cy="60" rx="10" ry="12" fill="#ff65a3" opacity="0.7"/>
      </g>`,
      _arrow(45, 55, 58, 55, "#ff65a3") +
      _arrow(75, 55, 62, 55, "#ff65a3")
    ),
    description: "Fingertips of both hands tap together",
    category: "adjective"
  },

  "very": {
    svg: _svg(
      _palm(45, 58, 0.75, "#6c63ff") +
      _palm(75, 58, 0.75, "#ff65a3"),
      _arrow(50, 48, 55, 35, "#ff65a3") +
      _arrow(70, 48, 65, 35, "#ff65a3")
    ),
    description: "V-hands touch tips, pull apart",
    category: "adverb"
  },

  "all": {
    svg: _svg(
      _palm(55, 55, 0.85, "#6c63ff") +
      _palm(75, 70, 0.7, "#ff65a3"),
      `<circle cx="60" cy="55" r="20" fill="none" stroke="#ff65a3" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.4"/>`
    ),
    description: "One hand circles over the other and clasps",
    category: "adjective"
  },

  "many": {
    svg: _svg(
      _fist(45, 55, 0.8, "#6c63ff") +
      _fist(75, 55, 0.8, "#ff65a3"),
      _arrow(40, 48, 30, 35, "#ff65a3") +
      _arrow(80, 48, 90, 35, "#ff65a3")
    ),
    description: "S-fists flick open repeatedly",
    category: "adjective"
  },

  "today": {
    svg: _svg(
      _palm(45, 55, 0.75, "#6c63ff") +
      _palm(75, 55, 0.75, "#ff65a3"),
      _arrow(45, 60, 45, 80, "#ff65a3") +
      _arrow(75, 60, 75, 80, "#ff65a3")
    ),
    description: "Both bent hands drop in front of body",
    category: "noun"
  },

  "tomorrow": {
    svg: _svg(
      `<g transform="translate(55,55)">
        <line x1="-10" y1="-4" x2="-24" y2="-10" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="14" ry="16" fill="#6c63ff" opacity="0.85"/>
      </g>`,
      _arrow(40, 50, 25, 35, "#ff65a3")
    ),
    description: "Thumb on cheek, arc forward",
    category: "noun"
  },

  "now": {
    svg: _svg(
      _palm(45, 55, 0.75, "#6c63ff") +
      _palm(75, 55, 0.75, "#ff65a3"),
      _arrow(45, 60, 45, 75, "#ff65a3") +
      _arrow(75, 60, 75, 75, "#ff65a3")
    ),
    description: "Both Y-hands drop sharply",
    category: "adverb"
  },

  "here": {
    svg: _svg(
      _palm(45, 55, 0.8, "#6c63ff") +
      _palm(75, 55, 0.8, "#ff65a3"),
      _wave(60, 95, "#ff65a3")
    ),
    description: "Both palms circle horizontally",
    category: "adverb"
  },

  "there": {
    svg: _svg(
      `<g transform="translate(55,58)">
        <line x1="0" y1="-16" x2="15" y2="-36" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="15" cy="-36" r="3" fill="#ff65a3"/>
      </g>`,
      ""
    ),
    description: "Point index finger to a distant location",
    category: "adverb"
  },

  "language": {
    svg: _svg(
      `<g>
        <line x1="40" y1="55" x2="40" y2="35" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <circle cx="40" cy="35" r="3" fill="#ff65a3"/>
        <line x1="80" y1="55" x2="80" y2="35" stroke="#ff65a3" stroke-width="3" stroke-linecap="round"/>
        <circle cx="80" cy="35" r="3" fill="#6c63ff"/>
      </g>`,
      _arrow(40, 50, 55, 60, "#ff65a3") +
      _arrow(80, 50, 65, 60, "#ff65a3")
    ),
    description: "L-hands wiggle outward from center",
    category: "noun"
  },

  "sign": {
    svg: _svg(
      `<g transform="translate(45,55)">
        <line x1="0" y1="-16" x2="0" y2="-36" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-36" r="3" fill="#ff65a3"/>
      </g>` +
      `<g transform="translate(75,55)">
        <line x1="0" y1="-16" x2="0" y2="-36" stroke="#ff65a3" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#ff65a3" opacity="0.7"/>
        <circle cx="0" cy="-36" r="3" fill="#6c63ff"/>
      </g>`,
      `<circle cx="45" cy="30" r="5" fill="none" stroke="#ff65a3" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.4"/>
       <circle cx="75" cy="30" r="5" fill="none" stroke="#6c63ff" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.4"/>`
    ),
    description: "Index fingers alternate circling (signing motion)",
    category: "noun"
  },

  "understand": {
    svg: _svg(
      `<g transform="translate(60,58)">
        <line x1="0" y1="-14" x2="0" y2="-36" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-36" r="3" fill="#ff65a3"/>
      </g>` +
      `<text x="60" y="100" text-anchor="middle" font-size="14" fill="#ff65a3" opacity="0.4">💡</text>`,
      _arrow(60, 28, 60, 18, "#ff65a3")
    ),
    description: "Index finger flicks up near forehead",
    category: "verb"
  },

  "different": {
    svg: _svg(
      `<g transform="translate(45,55)">
        <line x1="0" y1="-14" x2="0" y2="-34" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#6c63ff" opacity="0.85"/>
      </g>` +
      `<g transform="translate(75,55)">
        <line x1="0" y1="-14" x2="0" y2="-34" stroke="#ff65a3" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#ff65a3" opacity="0.7"/>
      </g>`,
      _arrow(45, 45, 30, 45, "#ff65a3") +
      _arrow(75, 45, 90, 45, "#ff65a3")
    ),
    description: "Index fingers crossed, pull apart",
    category: "adjective"
  },

  "same": {
    svg: _svg(
      `<g transform="translate(45,58)">
        <line x1="0" y1="-14" x2="0" y2="-34" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#6c63ff" opacity="0.85"/>
      </g>` +
      `<g transform="translate(75,58)">
        <line x1="0" y1="-14" x2="0" y2="-34" stroke="#ff65a3" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="10" ry="12" fill="#ff65a3" opacity="0.7"/>
      </g>`,
      _arrow(50, 55, 60, 55, "#ff65a3") +
      _arrow(70, 55, 60, 55, "#6c63ff")
    ),
    description: "Both index fingers come together side by side",
    category: "adjective"
  },

  "again": {
    svg: _svg(
      _palm(65, 70, 0.8, "#ff65a3") +
      `<g transform="translate(50,48)">
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <line x1="0" y1="-14" x2="4" y2="-30" stroke="#6c63ff" stroke-width="3" stroke-linecap="round"/>
      </g>`,
      _arrow(50, 50, 65, 65, "#ff65a3")
    ),
    description: "Bent hand arcs into flat palm",
    category: "adverb"
  },

  "always": {
    svg: _svg(
      `<g transform="translate(60,55)">
        <line x1="0" y1="-14" x2="0" y2="-36" stroke="#6c63ff" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="0" rx="12" ry="14" fill="#6c63ff" opacity="0.85"/>
        <circle cx="0" cy="-36" r="3" fill="#ff65a3"/>
      </g>`,
      `<circle cx="60" cy="55" r="22" fill="none" stroke="#ff65a3" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.4"/>`
    ),
    description: "Index finger circles continuously",
    category: "adverb"
  },

  "never": {
    svg: _svg(
      _palm(60, 55, 0.9, "#6c63ff"),
      _arrow(50, 50, 35, 80, "#ff65a3") +
      `<line x1="40" y1="85" x2="80" y2="85" stroke="#ff65a3" stroke-width="2" opacity="0.4"/>`
    ),
    description: "Flat hand sweeps down in zigzag",
    category: "adverb"
  },
};


// Expose globally (Chrome Extension content scripts don't support ES modules)
if (typeof window !== "undefined") {
  window.ISL_DICTIONARY = ISL_DICTIONARY;
}
