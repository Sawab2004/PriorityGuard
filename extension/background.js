// =========================================
// PriorityGuard — background.js (Service Worker)
// Peak Window Focus Engine v2
// =========================================

const API_BASE = "http://localhost:3001/api";
const FOCUS_URL = "http://localhost:3001/focus";

const PROCRASTINATION_DOMAINS = [
  "twitter.com", "x.com",
  "youtube.com",
  "reddit.com",
  "linkedin.com",
  "news.ycombinator.com",
  "tiktok.com",
  "facebook.com",
  "instagram.com"
];

// Allow side panel to open on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error(e));

// ---- HELPERS ----

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function isProcrastinationSite(url) {
  const domain = getDomain(url);
  return PROCRASTINATION_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
}

function broadcastToAllTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith("chrome://")) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  });
}

// ---- SESSION MANAGEMENT ----

async function getSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get("peakSession", (data) => {
      resolve(data.peakSession || null);
    });
  });
}

async function saveSession(session) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ peakSession: session }, resolve);
  });
}

// Called from sidepanel when user clicks "Lock In"
async function startPeakSession(taskTitle, taskValue, sessionMins, hourlyRate) {
  const leakPerMin = taskValue > 0
    ? taskValue / sessionMins
    : hourlyRate / 60;

  const session = {
    active: true,
    taskTitle,
    taskValue,
    sessionMins,
    hourlyRate,
    leakPerMin: Math.round(leakPerMin * 100) / 100,
    startTime: Date.now(),
    totalLost: 0,
    paused: false,
    pausedAt: null,
    currentBadSiteTab: null,      // tabId of bad site
    badSiteEnteredAt: null,        // timestamp when entered bad site
    gatekeeperShown: false         // has gatekeeper been shown this visit
  };

  await saveSession(session);

  // Alert: period starts in 1min (just use 0.1 for testing / immediately)
  chrome.alarms.create("peakWindowTick", { periodInMinutes: 1 });

  // Update badge and notify content scripts
  updateBadgeFromSession(session);
  broadcastToAllTabs({ type: "SESSION_STARTED", session });

  console.log("🚀 Peak Session Started:", session);
}

async function endPeakSession() {
  const session = await getSession();
  if (!session) return;

  chrome.alarms.clear("peakWindowTick");
  chrome.alarms.clear("gatekeeperAlarm");

  await chrome.storage.local.remove("peakSession");
  broadcastToAllTabs({ type: "SESSION_ENDED", totalLost: session.totalLost });
  chrome.action.setBadgeText({ text: "" });

  console.log("✅ Peak Session Ended. Total lost: $" + session.totalLost);
}

async function pauseSession() {
  const session = await getSession();
  if (!session || session.paused) return;

  session.paused = true;
  session.pausedAt = Date.now();
  await saveSession(session);
  broadcastToAllTabs({ type: "SESSION_PAUSED", session });
}

async function resumeSession() {
  const session = await getSession();
  if (!session || !session.paused) return;

  // Adjust startTime to account for pause duration
  const pauseDuration = Date.now() - session.pausedAt;
  session.startTime += pauseDuration;
  session.paused = false;
  session.pausedAt = null;
  session.badSiteEnteredAt = null;
  session.gatekeeperShown = false;
  await saveSession(session);
  broadcastToAllTabs({ type: "SESSION_RESUMED", session });
}

// ---- BADGE ----

async function updateBadgeFromSession(session) {
  if (session && session.active && !session.paused) {
    const elapsed = (Date.now() - session.startTime) / 1000 / 60;
    const remaining = Math.max(0, session.sessionMins - elapsed);
    const mins = Math.floor(remaining);
    chrome.action.setBadgeText({ text: mins + "m" });
    chrome.action.setBadgeBackgroundColor({ color: "#D32F2F" }); // Red = active lock
    chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
  } else {
    // Default: show high-value task count
    updateBadgeDefault();
  }
}

async function updateBadgeDefault() {
  try {
    const res = await fetch(`${API_BASE}/tasks`);
    if (!res.ok) throw new Error("Failed");
    const { tasks } = await res.json();
    const count = tasks.filter(t =>
      t.status === "pending" && (t.ai_score >= 80 || t.ai_category === "High-Impact")
    ).length;
    chrome.action.setBadgeText({ text: count > 0 ? count.toString() : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#1A1A1A" });
    chrome.action.setBadgeTextColor({ color: "#FDFCF8" });
  } catch {
    chrome.action.setBadgeText({ text: "" });
  }
}

// ---- TAB MONITORING ----

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  const session = await getSession();
  if (!session || !session.active || session.paused) return;

  const elapsed = (Date.now() - session.startTime) / 1000 / 60;
  if (elapsed >= session.sessionMins) {
    // Session expired
    await endPeakSession();
    return;
  }

  const onBadSite = isProcrastinationSite(tab.url);

  if (onBadSite) {
    const domain = getDomain(tab.url);

    // First visit to this bad site?
    if (session.currentBadSiteTab !== tabId || !session.badSiteEnteredAt) {
      session.currentBadSiteTab = tabId;
      session.badSiteEnteredAt = Date.now();
      session.gatekeeperShown = false;
      await saveSession(session);

      // Schedule gatekeeper after 2 minutes
      chrome.alarms.clear("gatekeeperAlarm");
      chrome.alarms.create("gatekeeperAlarm", { delayInMinutes: 2 });
    }

    // Notify content script on this tab
    chrome.tabs.sendMessage(tabId, {
      type: "ON_BAD_SITE",
      domain,
      session,
      leakPerMin: session.leakPerMin
    }).catch(() => {});

  } else {
    // Left bad site
    if (session.badSiteEnteredAt) {
      const minsSpent = (Date.now() - session.badSiteEnteredAt) / 1000 / 60;
      const lost = Math.round(minsSpent * session.leakPerMin * 100) / 100;
      session.totalLost += lost;
      session.badSiteEnteredAt = null;
      session.currentBadSiteTab = null;
      session.gatekeeperShown = false;
      await saveSession(session);
      chrome.alarms.clear("gatekeeperAlarm");
    }

    // Notify content script: back on safe ground
    chrome.tabs.sendMessage(tabId, {
      type: "ON_SAFE_SITE",
      session
    }).catch(() => {});
  }

  updateBadgeFromSession(session);
});

// ---- ALARMS ----

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "peakWindowTick") {
    const session = await getSession();
    if (!session || !session.active) return;

    const elapsed = (Date.now() - session.startTime) / 1000 / 60;
    if (elapsed >= session.sessionMins) {
      await endPeakSession();
      broadcastToAllTabs({ type: "SESSION_COMPLETE" });
      return;
    }

    // If currently on a bad site, add leaked money
    if (session.badSiteEnteredAt && !session.paused) {
      const minsOnBadSite = (Date.now() - session.badSiteEnteredAt) / 1000 / 60;
      const lost = Math.round(minsOnBadSite * session.leakPerMin * 100) / 100;
      session.totalLost = lost; // cumulative tracked per-minute
      await saveSession(session);
    }

    broadcastToAllTabs({ type: "TICK", session });
    updateBadgeFromSession(session);
  }

  if (alarm.name === "gatekeeperAlarm") {
    // 2 minutes on a bad site — trigger gatekeeper
    const session = await getSession();
    if (!session || !session.active || session.paused || !session.currentBadSiteTab) return;

    if (!session.gatekeeperShown) {
      session.gatekeeperShown = true;
      await saveSession(session);

      chrome.tabs.sendMessage(session.currentBadSiteTab, {
        type: "SHOW_GATEKEEPER",
        session,
        domain: "", // will be read from page
        leakPerMin: session.leakPerMin
      }).catch(() => {});
    }
  }
});

// ---- MESSAGE HANDLER ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_SESSION") {
    startPeakSession(
      message.taskTitle,
      message.taskValue,
      message.sessionMins,
      message.hourlyRate
    ).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "END_SESSION") {
    endPeakSession().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "PAUSE_SESSION") {
    pauseSession().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "RESUME_SESSION") {
    resumeSession().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "GET_SESSION") {
    getSession().then((session) => sendResponse({ session }));
    return true;
  }

  if (message.type === "GET_TOP_TASK") {
    fetch(`${API_BASE}/tasks`)
      .then(r => r.json())
      .then(({ tasks }) => {
        const top = (tasks || [])
          .filter(t => t.status === "pending")
          .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))[0];
        sendResponse({ task: top || null });
      })
      .catch(() => sendResponse({ task: null }));
    return true;
  }

  if (message.type === "UPDATE_BADGE") {
    updateBadgeDefault();
  }

  if (message.type === "REDIRECT_TO_FOCUS") {
    chrome.tabs.update(sender.tab.id, { url: FOCUS_URL });
  }
});
