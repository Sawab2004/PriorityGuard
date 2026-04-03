// =========================================
// PriorityGuard — content.js
// Economic Ticker + AI Gatekeeper Overlay
// Injected into every page
// =========================================

(function () {
  'use strict';

  // Avoid double injection
  if (window.__pgInjected) return;
  window.__pgInjected = true;

  let tickerEl = null;
  let gatekeeperEl = null;
  let tickInterval = null;
  let currentSession = null;
  let isOnBadSite = false;
  let leakPerMin = 0;
  let lostThisVisit = 0;
  let badSiteEnteredAt = null;

  // ---- UTILITIES ----

  function formatTime(ms) {
    const totalSecs = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function formatMoney(val) {
    return '$' + Math.abs(val).toFixed(2);
  }

  function getDomain() {
    return window.location.hostname.replace('www.', '');
  }

  // ---- TICKER ----

  function createTicker(session) {
    if (tickerEl) tickerEl.remove();

    tickerEl = document.createElement('div');
    tickerEl.id = 'pg-ticker';
    tickerEl.innerHTML = `
      <div id="pg-ticker-inner">
        <span id="pg-ticker-icon">🛡</span>
        <span id="pg-ticker-task"></span>
        <div id="pg-ticker-divider"></div>
        <span id="pg-ticker-timer"></span>
        <div id="pg-ticker-divider2"></div>
        <span id="pg-ticker-money"></span>
        <button id="pg-ticker-end" title="End session">✕</button>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'pg-ticker-style';
    style.textContent = `
      #pg-ticker {
        position: fixed;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        animation: pgSlideDown 0.3s ease;
      }
      @keyframes pgSlideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
      }
      #pg-ticker-inner {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #1A1A1A;
        color: #FDFCF8;
        padding: 6px 16px;
        border-radius: 0 0 12px 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.3);
        transition: background 0.4s ease;
      }
      #pg-ticker-inner.bad-site {
        background: #B71C1C;
        animation: pgPulse 1.5s infinite;
      }
      @keyframes pgPulse {
        0%,100% { box-shadow: 0 4px 24px rgba(183,28,28,0.4); }
        50%      { box-shadow: 0 4px 36px rgba(183,28,28,0.8); }
      }
      #pg-ticker-task {
        font-weight: 600;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.9;
      }
      #pg-ticker-divider, #pg-ticker-divider2 {
        width: 1px;
        height: 14px;
        background: rgba(255,255,255,0.2);
      }
      #pg-ticker-timer {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        letter-spacing: 0.5px;
        min-width: 45px;
      }
      #pg-ticker-money {
        font-weight: 700;
        min-width: 80px;
        text-align: right;
      }
      #pg-ticker-end {
        background: none;
        border: none;
        color: rgba(255,255,255,0.4);
        cursor: pointer;
        font-size: 11px;
        padding: 0 4px;
        line-height: 1;
        transition: color 0.2s;
      }
      #pg-ticker-end:hover { color: #fff; }
    `;

    if (!document.getElementById('pg-ticker-style')) {
      document.head.appendChild(style);
    }
    document.body.appendChild(tickerEl);

    document.getElementById('pg-ticker-end').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'END_SESSION' });
      removeTicker();
    });

    currentSession = session;
    startTicking();
  }

  function startTicking() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(updateTicker, 1000);
    updateTicker();
  }

  function updateTicker() {
    if (!currentSession || !tickerEl) return;

    const now = Date.now();
    const elapsed = now - currentSession.startTime;
    const totalDuration = currentSession.sessionMins * 60 * 1000;
    const remaining = totalDuration - elapsed;

    if (remaining <= 0) {
      // Session complete
      removeTicker();
      showCompletionToast(currentSession);
      return;
    }

    const taskEl = document.getElementById('pg-ticker-task');
    const timerEl = document.getElementById('pg-ticker-timer');
    const moneyEl = document.getElementById('pg-ticker-money');
    const inner = document.getElementById('pg-ticker-inner');

    if (taskEl) taskEl.textContent = currentSession.taskTitle;
    if (timerEl) timerEl.textContent = formatTime(remaining);

    if (isOnBadSite && badSiteEnteredAt) {
      const minsOnBad = (now - badSiteEnteredAt) / 1000 / 60;
      lostThisVisit = Math.round(minsOnBad * leakPerMin * 100) / 100;
      const totalLost = (currentSession.totalLost || 0) + lostThisVisit;

      if (moneyEl) moneyEl.textContent = '- ' + formatMoney(totalLost) + ' lost';
      if (inner) inner.className = 'bad-site';
    } else {
      const potentialEarned = formatMoney(currentSession.taskValue || (currentSession.hourlyRate * currentSession.sessionMins / 60));
      if (moneyEl) moneyEl.textContent = '⚡ ' + potentialEarned + ' potential';
      if (inner) inner.className = '';
    }
  }

  function removeTicker() {
    if (tickInterval) clearInterval(tickInterval);
    if (tickerEl) {
      tickerEl.remove();
      tickerEl = null;
    }
  }

  // ---- GATEKEEPER ----

  function showGatekeeper(session, lpm) {
    if (gatekeeperEl) return; // Already visible

    const domain = getDomain();
    const moneyPerMin = formatMoney(lpm);

    gatekeeperEl = document.createElement('div');
    gatekeeperEl.id = 'pg-gatekeeper';
    gatekeeperEl.innerHTML = `
      <div id="pg-gk-inner">
        <div id="pg-gk-header">
          <span id="pg-gk-icon">🛡</span>
          <span id="pg-gk-title">Your AI Gatekeeper</span>
          <button id="pg-gk-close">✕</button>
        </div>
        <div id="pg-gk-body">
          <p id="pg-gk-message">
            Hey, I see you're on <strong>${domain}</strong>.<br>
            You're leaking <span id="pg-gk-rate">${moneyPerMin}/min</span> from your
            <strong id="pg-gk-task">${session.taskTitle}</strong> task.
          </p>
          <p id="pg-gk-sub">What do you want to do?</p>
        </div>
        <div id="pg-gk-actions">
          <button id="pg-gk-back">🎯 Go Back to My Task</button>
          <button id="pg-gk-pause">⏸ Pause Timer</button>
        </div>
        <div id="pg-gk-ticker">
          <span id="pg-gk-lost-label">Lost so far this visit:</span>
          <span id="pg-gk-lost-amount"></span>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'pg-gk-style';
    style.textContent = `
      #pg-gatekeeper {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: pgSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        max-width: 320px;
      }
      @keyframes pgSlideIn {
        from { transform: translateX(120%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
      #pg-gk-inner {
        background: #1A1A1A;
        color: #FDFCF8;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        border: 1px solid rgba(255,255,255,0.1);
      }
      #pg-gk-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: rgba(255,255,255,0.05);
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      #pg-gk-icon { font-size: 16px; }
      #pg-gk-title {
        flex: 1;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        opacity: 0.7;
      }
      #pg-gk-close {
        background: none;
        border: none;
        color: rgba(255,255,255,0.3);
        cursor: pointer;
        font-size: 12px;
        padding: 2px 4px;
        transition: color 0.2s;
      }
      #pg-gk-close:hover { color: #fff; }
      #pg-gk-body {
        padding: 16px 16px 8px;
      }
      #pg-gk-message {
        font-size: 13px;
        line-height: 1.6;
        margin: 0 0 8px;
        opacity: 0.9;
      }
      #pg-gk-rate {
        color: #FF5252;
        font-weight: 700;
      }
      #pg-gk-sub {
        font-size: 11px;
        opacity: 0.5;
        margin: 0;
      }
      #pg-gk-actions {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      #pg-gk-back {
        background: #FDFCF8;
        color: #1A1A1A;
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.1s, opacity 0.2s;
        text-align: center;
      }
      #pg-gk-back:hover { opacity: 0.9; transform: scale(1.02); }
      #pg-gk-pause {
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.7);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 10px 16px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s;
        text-align: center;
      }
      #pg-gk-pause:hover { background: rgba(255,255,255,0.12); }
      #pg-gk-ticker {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        background: rgba(183,28,28,0.2);
        border-top: 1px solid rgba(183,28,28,0.3);
      }
      #pg-gk-lost-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.6;
      }
      #pg-gk-lost-amount {
        font-size: 16px;
        font-weight: 800;
        color: #FF5252;
      }
    `;

    if (!document.getElementById('pg-gk-style')) {
      document.head.appendChild(style);
    }
    document.body.appendChild(gatekeeperEl);

    // Update the "lost" counter in real time
    const lostInterval = setInterval(() => {
      if (!gatekeeperEl) { clearInterval(lostInterval); return; }
      const el = document.getElementById('pg-gk-lost-amount');
      if (el && badSiteEnteredAt) {
        const mins = (Date.now() - badSiteEnteredAt) / 1000 / 60;
        el.textContent = '- ' + formatMoney(mins * lpm);
      }
    }, 1000);

    document.getElementById('pg-gk-close').addEventListener('click', removeGatekeeper);

    document.getElementById('pg-gk-back').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'REDIRECT_TO_FOCUS' });
      removeGatekeeper();
    });

    document.getElementById('pg-gk-pause').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'PAUSE_SESSION' });
      removeGatekeeper();
      showPausedBanner();
    });
  }

  function removeGatekeeper() {
    if (gatekeeperEl) {
      gatekeeperEl.remove();
      gatekeeperEl = null;
    }
  }

  // ---- PAUSED BANNER ----

  function showPausedBanner() {
    const banner = document.createElement('div');
    banner.id = 'pg-paused-banner';
    banner.innerHTML = `
      <div id="pg-paused-inner">
        <span>⏸ PriorityGuard timer paused.</span>
        <button id="pg-resume-btn">Resume</button>
      </div>
    `;
    const s = document.createElement('style');
    s.textContent = `
      #pg-paused-banner {
        position: fixed; top: 0; left: 50%; transform: translateX(-50%);
        z-index: 2147483647; font-family: -apple-system, sans-serif;
      }
      #pg-paused-inner {
        display: flex; align-items: center; gap: 12px;
        background: #5C6BC0; color: #fff;
        padding: 8px 20px; border-radius: 0 0 12px 12px;
        font-size: 13px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      #pg-resume-btn {
        background: #fff; color: #5C6BC0; border: none;
        border-radius: 6px; padding: 4px 12px; font-size: 12px;
        font-weight: 700; cursor: pointer;
      }
    `;
    document.head.appendChild(s);
    document.body.appendChild(banner);

    document.getElementById('pg-resume-btn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'RESUME_SESSION' });
      banner.remove();
    });
  }

  // ---- COMPLETION TOAST ----

  function showCompletionToast(session) {
    const toast = document.createElement('div');
    toast.innerHTML = `
      <div style="
        position:fixed; top:20px; right:20px; z-index:2147483647;
        background:#1A1A1A; color:#FDFCF8;
        padding:20px 24px; border-radius:16px;
        font-family:-apple-system,sans-serif;
        box-shadow:0 20px 60px rgba(0,0,0,0.4);
        max-width:280px; animation:pgSlideIn 0.4s ease;
      ">
        <div style="font-size:24px;margin-bottom:8px;">🏆</div>
        <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Session Complete!</div>
        <div style="font-size:12px;opacity:0.7;">${session.taskTitle}</div>
        <div style="font-size:11px;color:#FF5252;margin-top:8px;">
          $${session.totalLost.toFixed(2)} lost to distractions
        </div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // ---- MESSAGE LISTENER ----

  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'SESSION_STARTED':
        currentSession = message.session;
        isOnBadSite = false;
        createTicker(message.session);
        break;

      case 'SESSION_ENDED':
        removeTicker();
        removeGatekeeper();
        currentSession = null;
        break;

      case 'SESSION_COMPLETE':
        if (currentSession) showCompletionToast(currentSession);
        removeTicker();
        removeGatekeeper();
        currentSession = null;
        break;

      case 'SESSION_PAUSED':
        currentSession = message.session;
        // Ticker stays but grayed
        break;

      case 'SESSION_RESUMED':
        currentSession = message.session;
        isOnBadSite = false;
        badSiteEnteredAt = null;
        lostThisVisit = 0;
        break;

      case 'ON_BAD_SITE':
        currentSession = message.session;
        isOnBadSite = true;
        leakPerMin = message.leakPerMin;
        if (!badSiteEnteredAt) badSiteEnteredAt = Date.now();
        if (!tickerEl && currentSession) createTicker(currentSession);
        break;

      case 'ON_SAFE_SITE':
        isOnBadSite = false;
        badSiteEnteredAt = null;
        lostThisVisit = 0;
        currentSession = message.session;
        removeGatekeeper();
        if (!tickerEl && currentSession) createTicker(currentSession);
        break;

      case 'SHOW_GATEKEEPER':
        currentSession = message.session;
        leakPerMin = message.leakPerMin;
        showGatekeeper(message.session, message.leakPerMin);
        break;

      case 'TICK':
        currentSession = message.session;
        break;
    }
  });

  // ---- INIT: Check if a session is already active on page load ----
  chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
    if (response && response.session && response.session.active) {
      currentSession = response.session;
      createTicker(response.session);

      // Check if this page is a bad site
      const DOMAINS = [
        "twitter.com", "x.com", "youtube.com", "reddit.com",
        "linkedin.com", "news.ycombinator.com", "tiktok.com",
        "facebook.com", "instagram.com"
      ];
      const domain = getDomain();
      if (DOMAINS.some(d => domain === d || domain.endsWith("." + d))) {
        isOnBadSite = true;
        leakPerMin = response.session.leakPerMin;
        if (!badSiteEnteredAt) badSiteEnteredAt = Date.now();
      }
    }
  });

})();
