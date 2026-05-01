/**
 * KeySense — popup.js
 *
 * Communicates with the active tab's content.js via chrome.tabs.sendMessage.
 * Falls back to the cached latestScore in chrome.storage if messaging fails
 * (e.g. the tab is a chrome:// page where content scripts can't run).
 */

// ── DOM refs ───────────────────────────────────────────────────────────────
const scoreNumber  = document.getElementById("scoreNumber");
const scoreLabel   = document.getElementById("scoreLabel");
const scoreCard    = document.getElementById("scoreCard");
const metricsGrid  = document.getElementById("metricsGrid");
const baselineInfo = document.getElementById("baselineInfo");

const btnBaseline  = document.getElementById("btnBaseline");
const btnRefresh   = document.getElementById("btnRefresh");
const btnClear     = document.getElementById("btnClear");

// ── Colour palette ─────────────────────────────────────────────────────────
function scoreColour(score) {
  if (score < 30) return "#22c55e";   // green  — calm
  if (score < 50) return "#84cc16";   // lime   — normal
  if (score < 65) return "#f59e0b";   // amber  — mild
  if (score < 80) return "#f97316";   // orange — elevated
  return "#ef4444";                   // red    — high
}

// ── Render score data ──────────────────────────────────────────────────────
function renderScore(data) {
  if (!data || data.score === null) {
    scoreNumber.textContent = "—";
    scoreLabel.textContent  = data?.label || "Type to start measuring…";
    scoreCard.style.borderColor = "#4b5563";
    metricsGrid.style.display = "none";
    return;
  }

  scoreNumber.textContent = data.score;
  scoreLabel.textContent  = data.label;

  const colour = scoreColour(data.score);
  scoreCard.style.borderColor = colour;
  scoreNumber.style.color     = colour;

  if (data.metrics) {
    document.getElementById("mDwell").textContent   = data.metrics.avgDwell + " ms";
    document.getElementById("mFlight").textContent  = data.metrics.avgFlight + " ms";
    document.getElementById("mBksp").textContent    = data.metrics.backspaceRate + "%";
    document.getElementById("mEvents").textContent  = data.events;
    metricsGrid.style.display = "grid";
  }
}

// ── Render baseline info ───────────────────────────────────────────────────
function renderBaseline(baseline) {
  if (!baseline) {
    baselineInfo.textContent = "No baseline — using population defaults";
    return;
  }
  const d = new Date(baseline.capturedAt);
  baselineInfo.textContent =
    `Baseline: dwell ${baseline.avgDwell}ms · flight ${baseline.avgFlight}ms` +
    ` · saved ${d.toLocaleTimeString()}`;
}

// ── Request live score from content script ─────────────────────────────────
function fetchScore() {
  scoreLabel.textContent = "Fetching…";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];

    if (!tab || !tab.id) {
      useCachedScore();
      return;
    }

    // Check it's a normal http/https page (content scripts don't run on chrome://)
    if (!tab.url || (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))) {
      scoreLabel.textContent = "Open a webpage to start measuring.";
      scoreNumber.textContent = "—";
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "GET_SCORE" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script may not have loaded yet — fallback to cache
        useCachedScore();
        return;
      }
      renderScore(response);
    });
  });
}

function useCachedScore() {
  chrome.storage.local.get(["latestScore"], ({ latestScore }) => {
    if (latestScore) {
      renderScore(latestScore);
      scoreLabel.textContent += " (cached)";
    } else {
      scoreLabel.textContent = "Start typing on any webpage.";
    }
  });
}

// ── Save baseline ──────────────────────────────────────────────────────────
btnBaseline.addEventListener("click", () => {
  btnBaseline.disabled = true;
  btnBaseline.textContent = "Saving…";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];

    if (!tab || !tab.id) {
      alert("No active tab — open a webpage and type first.");
      btnBaseline.disabled = false;
      btnBaseline.textContent = "📐 Save Baseline";
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "SAVE_BASELINE" }, (response) => {
      btnBaseline.disabled = false;
      btnBaseline.textContent = "📐 Save Baseline";

      if (chrome.runtime.lastError || !response) {
        alert("Could not reach the page. Make sure you're on an http/https page and have typed some text first.");
        return;
      }

      if (!response.ok) {
        alert("Not enough data yet: " + (response.reason || "type more first."));
        return;
      }

      renderBaseline(response.baseline);
      // Refresh score immediately so it re-scores vs new baseline
      fetchScore();
    });
  });
});

// ── Refresh button ─────────────────────────────────────────────────────────
btnRefresh.addEventListener("click", fetchScore);

// ── Clear all data ─────────────────────────────────────────────────────────
btnClear.addEventListener("click", () => {
  if (!confirm("Clear all stored scores and your baseline?")) return;
  chrome.storage.local.clear(() => {
    scoreNumber.textContent = "—";
    scoreLabel.textContent  = "Data cleared. Start typing.";
    metricsGrid.style.display = "none";
    baselineInfo.textContent  = "No baseline — using population defaults";
    scoreCard.style.borderColor = "#4b5563";
  });
});

// ── Init ───────────────────────────────────────────────────────────────────
chrome.storage.local.get(["baseline"], ({ baseline }) => {
  renderBaseline(baseline || null);
});

fetchScore();
