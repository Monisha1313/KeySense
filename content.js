/**
 * KeySense — content.js
 * Collects keystroke timing events and computes a rolling stress score.
 * Sends score updates to the background service worker every 30 seconds.
 *
 * WHAT WE MEASURE (none of it is what you type):
 *  - dwell     : how long a key is held down (ms)
 *  - flight    : gap between one keydown and the next keydown (ms)
 *  - pause     : gap > 2s (cognitive hesitation / freeze)
 *  - backspace : error / second-guessing rate
 *
 * PRIVACY: No key values, words, or characters are ever recorded.
 *          Only timing deltas are stored locally in chrome.storage.
 */

// ── Constants ──────────────────────────────────────────────────────────────
const PAUSE_THRESHOLD_MS   = 2000;        // gap > 2 s = cognitive pause
const ROLLING_WINDOW_MS    = 5 * 60 * 1000; // 5-minute rolling window
const SCORE_BROADCAST_MS   = 30_000;      // push score to background every 30 s
const MIN_EVENTS_FOR_SCORE = 20;          // don't score if too little data

// ── State ──────────────────────────────────────────────────────────────────
let keyDownTime = {};  // { code: timestamp } — tracks keydown start per key
let lastKeyDownTime = 0; // timestamp of the most recent keydown (for flight)
let events = [];         // { type, value, timestamp }

// ── Helpers ────────────────────────────────────────────────────────────────
function now() { return Date.now(); }

function trimWindow() {
  const cutoff = now() - ROLLING_WINDOW_MS;
  events = events.filter(e => e.timestamp >= cutoff);
}

function record(type, value) {
  events.push({ type, value, timestamp: now() });
  // Keep memory bounded (max 2000 events in memory)
  if (events.length > 2000) events.shift();
}

// ── Event listeners ────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  // Skip modifier-only, function keys, arrows — they skew dwell times
  if (["Meta", "Control", "Alt", "Shift", "CapsLock", "Tab",
       "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
       "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"
      ].includes(e.key)) return;

  // Ignore key repeat (held-down key fires repeated keydown events)
  if (e.repeat) return;

  const t = now();

  // Backspace = sign of error / second-guessing
  if (e.code === "Backspace") {
    record("backspace", 1);
  }

  // Flight time: gap between this keydown and the previous keydown
  if (lastKeyDownTime !== 0) {
    const diff = t - lastKeyDownTime;

    if (diff > PAUSE_THRESHOLD_MS) {
      // Long gap = cognitive pause (zoning out, hesitating, staring at screen)
      record("pause", diff);
    } else {
      // Only record flight when it's a plausible typing interval (not a pause)
      record("flight", diff);
    }
  }

  keyDownTime[e.code] = t;
  lastKeyDownTime = t;

}, true); // capture phase — catches events in shadow DOMs and iframes

document.addEventListener("keyup", (e) => {
  if (!keyDownTime[e.code]) return;

  const dwell = now() - keyDownTime[e.code];

  // Ignore implausible values (held > 2 s means user walked away with key pressed)
  if (dwell > 0 && dwell < PAUSE_THRESHOLD_MS) {
    record("dwell", dwell);
  }

  delete keyDownTime[e.code];
}, true);

// ── Stress Score Computation ───────────────────────────────────────────────
/**
 * Returns a stress score 0–100 and a human-readable label.
 *
 * Score = weighted combination of:
 *   - Flight time deviation (slower = higher stress)
 *   - Dwell time deviation  (harder/longer press = higher stress)
 *   - Backspace rate        (more errors = higher stress)
 *   - Pause frequency       (more freezes = higher stress)
 *
 * If a baseline is stored, we score relative to YOUR personal calm state.
 * Without a baseline, we use population-level heuristic thresholds.
 */
function computeStressScore(baseline) {
  trimWindow();

  const dwells     = events.filter(e => e.type === "dwell").map(e => e.value);
  const flights    = events.filter(e => e.type === "flight").map(e => e.value);
  const pauses     = events.filter(e => e.type === "pause").length;
  const backspaces = events.filter(e => e.type === "backspace").length;
  const totalKeys  = dwells.length + flights.length;

  if (totalKeys < MIN_EVENTS_FOR_SCORE) {
    return {
      score: null,
      label: "Collecting data… (type more)",
      events: totalKeys
    };
  }

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const avgDwell       = avg(dwells);
  const avgFlight      = avg(flights);
  const backspaceRate  = totalKeys > 0 ? backspaces / totalKeys : 0;
  const pauseRate      = totalKeys > 0 ? pauses / totalKeys : 0;

  let score;

  if (baseline && baseline.avgDwell > 0 && baseline.avgFlight > 0) {
    // ── Baseline-relative scoring ──────────────────────────────────────────
    // Each metric is a ratio vs YOUR personal baseline.
    // ratio > 1 means slower / more errors vs your calm state = more stress.
    const dwellRatio  = avgDwell  / baseline.avgDwell;
    const flightRatio = avgFlight / baseline.avgFlight;
    const bkspRatio   = baseline.backspaceRate > 0
      ? backspaceRate / baseline.backspaceRate
      : backspaceRate * 10;
    const pauseRatio  = baseline.pauseRate > 0
      ? pauseRate / baseline.pauseRate
      : pauseRate * 10;

    // Weighted sum — flight change is most predictive, then dwell, then errors
    const raw = (
      flightRatio * 0.35 +
      dwellRatio  * 0.25 +
      bkspRatio   * 0.25 +
      pauseRatio  * 0.15
    );

    // Map: ratio of 1.0 (at baseline) → score 25 (calm)
    //      ratio of 2.0 (double stress signals) → score 75 (elevated)
    score = Math.min(100, Math.max(0, Math.round((raw - 1) * 50 + 25)));

  } else {
    // ── Heuristic absolute scoring (no personal baseline yet) ─────────────
    // Population averages: calm flight ~150ms, dwell ~80ms
    let s = 20; // default resting score

    if (avgFlight > 300)      s += 20;  // noticeably slow typing
    if (avgFlight > 500)      s += 15;  // very slow — hesitation/freeze
    if (avgDwell  > 150)      s += 15;  // heavy pressing
    if (backspaceRate > 0.10) s += 15;  // >10% error rate
    if (backspaceRate > 0.20) s += 10;  // >20% error rate
    if (pauseRate > 0.05)     s += 10;  // frequent pauses

    score = Math.min(100, s);
  }

  const label =
    score < 30 ? "😌 Calm"         :
    score < 50 ? "🙂 Normal"       :
    score < 65 ? "😐 Mild stress"  :
    score < 80 ? "😟 Elevated"     :
                 "🚨 High stress";

  return {
    score,
    label,
    events: totalKeys,
    metrics: {
      avgDwell:      Math.round(avgDwell),
      avgFlight:     Math.round(avgFlight),
      backspaceRate: +(backspaceRate * 100).toFixed(1),
      pauseRate:     +(pauseRate * 100).toFixed(1),
      pauseCount:    pauses,
      windowEvents:  events.length
    }
  };
}

// ── Periodic broadcast to background ──────────────────────────────────────
setInterval(() => {
  chrome.storage.local.get(["baseline"], ({ baseline }) => {
    const result = computeStressScore(baseline || null);
    if (result.score === null) return;

    // Cache latest score for popup to read
    chrome.storage.local.set({
      latestScore: {
        ...result,
        url:  location.hostname,
        time: now()
      }
    });

    // Trigger alert check in background
    chrome.runtime.sendMessage({
      type: "SCORE_UPDATE",
      payload: result
    }).catch(() => {}); // suppress error when no popup is open
  });
}, SCORE_BROADCAST_MS);

// ── Message API for popup ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  // Popup requesting an immediate (fresh) score
  if (msg.type === "GET_SCORE") {
    chrome.storage.local.get(["baseline"], ({ baseline }) => {
      sendResponse(computeStressScore(baseline || null));
    });
    return true; // keep channel open for async response
  }

  // Popup requesting baseline save from current typing state
  if (msg.type === "SAVE_BASELINE") {
    trimWindow();

    const dwells     = events.filter(e => e.type === "dwell").map(e => e.value);
    const flights    = events.filter(e => e.type === "flight").map(e => e.value);
    const backspaces = events.filter(e => e.type === "backspace").length;
    const pauses     = events.filter(e => e.type === "pause").length;
    const total      = dwells.length + flights.length;

    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    if (total < MIN_EVENTS_FOR_SCORE) {
      sendResponse({ ok: false, reason: "Not enough data — type more first." });
      return true;
    }

    const baseline = {
      avgDwell:      Math.round(avg(dwells)),
      avgFlight:     Math.round(avg(flights)),
      backspaceRate: total > 0 ? backspaces / total : 0,
      pauseRate:     total > 0 ? pauses / total : 0,
      capturedAt:    now(),
      sampleSize:    total
    };

    chrome.storage.local.set({ baseline }, () => {
      sendResponse({ ok: true, baseline });
    });
    return true;
  }

});
