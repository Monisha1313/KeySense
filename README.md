# ⌨️ KeySense — Silent Burnout Alarm

> A browser extension that passively listens to **how** you type — not **what** — and alerts you before a mental health crisis escalates.

---

## 🧠 What is KeySense?

Mental health crises — panic attacks, burnout collapses, depressive episodes — rarely appear from nowhere. They build up over hours. But people don't notice their own deterioration while it's happening, and no tool today catches it passively without a camera or an explicit self-report.

KeySense runs silently in your browser and monitors your **typing rhythm** (timing only — never content) to detect signs of cognitive overload, burnout, or stress. When your pattern deviates significantly from your personal baseline, it alerts you to take a break before things escalate.

---

## 🔒 Privacy First

**KeySense never records what you type.** Zero. It only measures timing intervals between keystrokes:

| What we measure | What we never touch |
|---|---|
| How long you hold a key (dwell time) | Which keys you press |
| Gap between keystrokes (flight time) | Words or characters typed |
| Frequency of pauses > 2 seconds | Passwords, emails, messages |
| Backspace / correction rate | Anything sent to a server |

All data is stored **locally** in your browser via `chrome.storage`. Nothing leaves your device.

---

## 🚀 Installation

KeySense is not on the Chrome Web Store — it runs as an unpacked developer extension.

### Step 1 — Download
Download and extract `keysense_v3.zip`. You should have a folder containing:
```
keysense/
├── manifest.json
├── content.js
├── background.js
├── popup.html
├── popup.js
├── style.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Step 2 — Load in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** ON (top-right corner)
3. Click **Load unpacked**
4. Select the extracted `keysense/` folder (the one that directly contains `manifest.json`)

### Step 3 — Verify
The KeySense icon (⌨️) should appear in your Chrome toolbar. If you don't see it, click the puzzle-piece Extensions icon and pin KeySense.

---

## 📖 How to Use

### First time setup
1. Navigate to any webpage where you normally type (Gmail, Notion, Google Docs, etc.)
2. Type naturally for **1–2 minutes** — KeySense is silently collecting your rhythm
3. Click the KeySense toolbar icon
4. When you're feeling **calm and relaxed**, click **📐 Save Baseline**

Saving a baseline locks in your personal calm-state typing pattern. Every score after this is measured *relative to you*, not a generic population average.

### Reading your score

| Score | Label | What it means |
|---|---|---|
| 0 – 29 | 😌 Calm | Typing is fluid, confident, relaxed |
| 30 – 49 | 🙂 Normal | Typical working state |
| 50 – 64 | 😐 Mild stress | Slightly slower, more corrections |
| 65 – 79 | 😟 Elevated | Noticeable hesitation, harder keypresses |
| 80 – 100 | 🚨 High stress | Strong signal — consider a break |

### Automatic alerts
If your score reaches **80 or above**, KeySense fires a Chrome desktop notification. Alerts are rate-limited to once every **5 minutes** so they don't become noise.

### Buttons
| Button | What it does |
|---|---|
| 📐 Save Baseline | Saves your current typing rhythm as your personal calm state |
| 🔄 Refresh | Requests a fresh score from the current tab immediately |
| 🗑 Clear All | Wipes all stored scores, history, and your baseline |

---

## ⚙️ How It Works

### Metrics collected (per 5-minute rolling window)

**Dwell time** — how long each key is physically held down (milliseconds). Stress often causes people to press harder and hold longer.

**Flight time** — the gap between one keydown and the next. Cognitive overload slows inter-key intervals as the brain struggles to formulate thoughts.

**Pause rate** — gaps longer than 2 seconds are counted as cognitive pauses (zoning out, freezing, staring at the screen).

**Backspace rate** — the ratio of corrections to total keystrokes. Second-guessing and errors increase under stress and fatigue.

### Scoring formula

If a **personal baseline exists**, each metric is expressed as a ratio vs. your calm-state value. A weighted sum is computed:

```
raw = (flight_ratio × 0.35) + (dwell_ratio × 0.25) + (backspace_ratio × 0.25) + (pause_ratio × 0.15)
score = clamp((raw - 1) × 50 + 25, 0, 100)
```

A ratio of 1.0 (identical to your baseline) maps to score 25 (calm). A ratio of 2.0 (double the stress signals) maps to score 75 (elevated).

If **no baseline is saved**, the extension uses population-level heuristic thresholds (calm flight ~150ms, calm dwell ~80ms) until enough data is collected.

### Architecture

```
content.js          — runs on every webpage, captures timing events, computes score
background.js       — service worker, receives score updates, fires notifications
popup.js / html     — the toolbar UI, requests live scores, manages baseline
chrome.storage      — local-only persistence for scores, baseline, and history
```

---

## 🐛 Troubleshooting

**Popup shows "—" and no score**
Type at least 20 keystrokes on the current page, then click Refresh. The extension needs a minimum sample to produce a meaningful score.

**"Extension active — type on this page to begin"**
The content script just injected itself (the tab was open before the extension was loaded). Type for 30–60 seconds and hit Refresh.

**Score seems too high/low**
Save a fresh baseline when you're genuinely calm (not during a deadline, first thing in the morning works well). The score is only meaningful relative to your personal baseline.

**Notifications not appearing**
Check that Chrome notifications are allowed: `chrome://settings/content/notifications` → make sure notifications aren't globally blocked.

**Extension stops working after Chrome restart**
Go to `chrome://extensions` and make sure KeySense is still enabled. Unpacked extensions are sometimes disabled after browser updates.

---

## 🗺️ Roadmap

- [ ] Score trend graph (sparkline over the last hour)
- [ ] Trusted contact alerts (email / SMS when score stays high for 15+ minutes)
- [ ] Per-site breakdown (see which websites correlate with high stress)
- [ ] Exportable session reports (PDF/CSV)
- [ ] Firefox support (WebExtensions API port)
- [ ] Configurable alert threshold and cooldown period

---

## 📚 Research Background

KeySense is grounded in the field of **keystroke dynamics**, which has been studied since the 1980s as a biometric and physiological signal. Key references:

- Epp, C., Lippold, M., & Mandryk, R. (2011). *Identifying emotional states using keystroke dynamics.* CHI '11.
- Vizer, L. et al. (2009). *Automated stress detection using keystroke and linguistic features.* IJMI.
- Fairclough, S. & Gilleade, K. (2012). *Advances in Physiological Computing.* Springer.

Typing rhythm is not a clinical diagnostic tool. KeySense is an **early warning nudge**, not a replacement for professional mental health support.

---

## ⚠️ Disclaimer

KeySense is a personal wellness tool and an academic/portfolio project. It is not a medical device and should not be used as a substitute for professional mental health diagnosis or treatment. If you are experiencing a mental health crisis, please contact a qualified professional or a crisis helpline.

---

## 👤 Author

Built by Monisha as part of a mental health technology project exploring passive, privacy-respecting stress detection.

---

*KeySense — because burnout doesn't announce itself.*
