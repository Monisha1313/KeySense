/**
 * KeySense — background.js (Service Worker)
 *
 * Responsibilities:
 *  1. Receive SCORE_UPDATE messages from content.js
 *  2. Fire Chrome notifications when stress is high (with cooldown to avoid spam)
 *  3. Store a rolling score history for trend display
 */

// ── Config ─────────────────────────────────────────────────────────────────
const ALERT_THRESHOLD  = 80;              // score ≥ 80 triggers notification
const ALERT_COOLDOWN   = 5 * 60 * 1000;  // max 1 alert per 5 minutes
const MAX_HISTORY      = 120;            // keep last 120 data points (~1 hr)

// ── State ──────────────────────────────────────────────────────────────────
let lastAlertTime = 0;

// ── Message listener ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "SCORE_UPDATE") return;

  const { score, label, metrics } = msg.payload;
  const t = Date.now();

  // ── 1. Store history ────────────────────────────────────────────────────
  chrome.storage.local.get(["scoreHistory"], ({ scoreHistory = [] }) => {
    scoreHistory.push({ score, label, time: t });
    if (scoreHistory.length > MAX_HISTORY) scoreHistory.shift();
    chrome.storage.local.set({ scoreHistory });
  });

  // ── 2. Alert if high stress and not in cooldown ─────────────────────────
  if (score >= ALERT_THRESHOLD && (t - lastAlertTime) > ALERT_COOLDOWN) {
    lastAlertTime = t;

    const hostname = sender.tab?.url
      ? new URL(sender.tab.url).hostname
      : "your browser";

    chrome.notifications.create(`keysense-alert-${t}`, {
      type:    "basic",
      iconUrl: "icons/icon48.png",
      title:   "KeySense — High Stress Detected",
      message: `Stress score: ${score}/100. Your typing on ${hostname} shows signs of ${label.replace(/^[^ ]+ /, "")}. Take a break.`,
      priority: 2,
      buttons: [{ title: "Dismiss" }]
    });
  }
});

// ── Notification button handler ────────────────────────────────────────────
chrome.notifications.onButtonClicked.addListener((notifId) => {
  chrome.notifications.clear(notifId);
});

// ── Keep-alive alarm (service workers can be terminated after 30s) ─────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("keepAlive", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    // No-op — just keeps the service worker alive
  }
});
