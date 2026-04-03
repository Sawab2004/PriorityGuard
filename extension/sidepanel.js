// =========================================
// PriorityGuard — sidepanel.js
// Peak Window Focus Engine — Step 1 & 2
// =========================================

let topTask = null;
let selectedMins = 90;
let sessionInterval = null;
let currentSession = null;

// ---- VIEW MANAGER ----

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ---- FORMAT HELPERS ----

function formatTime(ms) {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatMoney(val) {
  return '$' + Math.abs(val || 0).toFixed(2);
}

// ---- SETUP VIEW ----

function populateSetup(task, hourlyRate) {
  topTask = task;

  const titleEl = document.getElementById('setup-task-title');
  const valueEl = document.getElementById('setup-task-value');
  const scoreEl = document.getElementById('setup-task-score');
  const catEl   = document.getElementById('setup-task-cat');
  const aiMsg   = document.getElementById('setup-ai-message');

  if (titleEl) titleEl.textContent = task.title;

  const value = task.estimated_value || Math.round((hourlyRate || 50) * (selectedMins / 60));
  if (valueEl) valueEl.textContent = value ? `$${value} value` : 'No $ set';
  if (scoreEl) scoreEl.textContent = task.ai_score ? `Score: ${task.ai_score}` : '';
  if (catEl)   catEl.textContent   = task.ai_category || '';

  // Build AI message
  const potentialEarning = value > 0 ? `$${value}` : `~$${Math.round((hourlyRate || 50) * (selectedMins / 60))}`;
  if (aiMsg) {
    aiMsg.innerHTML = `
      You have <strong>${selectedMins} minutes</strong> of peak energy starting now.<br><br>
      Your #1 task is <strong>"${task.title}"</strong> 
      (<strong>${potentialEarning} value</strong>).<br><br>
      Ready to lock in and protect this window?
    `;
  }
}

// ---- ACTIVE SESSION VIEW ----

function startSessionUI(session) {
  currentSession = session;
  showView('view-active');

  const nameEl = document.getElementById('active-task-name');
  const potEl  = document.getElementById('active-potential');
  if (nameEl) nameEl.textContent = session.taskTitle;
  if (potEl) {
    const val = session.taskValue || Math.round(session.hourlyRate * session.sessionMins / 60);
    potEl.textContent = formatMoney(val);
  }

  if (sessionInterval) clearInterval(sessionInterval);
  sessionInterval = setInterval(tickSessionUI, 500);
}

function tickSessionUI() {
  if (!currentSession) return;

  const elapsed = Date.now() - currentSession.startTime;
  const totalDuration = currentSession.sessionMins * 60 * 1000;
  const remaining = totalDuration - elapsed;

  const timerEl = document.getElementById('active-timer');
  const lostEl  = document.getElementById('active-lost');

  if (timerEl) {
    timerEl.textContent = formatTime(remaining);
    timerEl.classList.toggle('danger', remaining < 5 * 60 * 1000);
  }

  // Refresh to get latest totalLost from storage
  chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (res) => {
    if (res && res.session) {
      currentSession = res.session;
      if (lostEl) lostEl.textContent = formatMoney(res.session.totalLost || 0);
    }
  });

  if (remaining <= 0) {
    clearInterval(sessionInterval);
    showView('view-no-task');
  }
}

// ---- EVENT: DURATION BUTTONS ----

document.querySelectorAll('.duration-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedMins = parseInt(btn.dataset.mins);

    // Refresh AI message with new duration
    if (topTask) {
      const hourlyRate = parseInt(localStorage.getItem('pg_hourly_rate') || '50');
      populateSetup(topTask, hourlyRate);
    }
  });
});

// ---- EVENT: LOCK IN ----

document.getElementById('lock-in-btn')?.addEventListener('click', () => {
  if (!topTask) return;

  const hourlyRate = parseInt(localStorage.getItem('pg_hourly_rate') || '50');
  const taskValue  = topTask.estimated_value || Math.round(hourlyRate * selectedMins / 60);

  chrome.runtime.sendMessage({
    type:        'START_SESSION',
    taskTitle:   topTask.title,
    taskValue:   taskValue,
    sessionMins: selectedMins,
    hourlyRate:  hourlyRate
  }, (res) => {
    if (res && res.ok) {
      chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (r) => {
        if (r && r.session) startSessionUI(r.session);
      });
    }
  });
});

// ---- EVENT: PAUSE ----

document.getElementById('pause-btn')?.addEventListener('click', () => {
  if (!currentSession) return;

  const isPaused = currentSession.paused;
  if (isPaused) {
    chrome.runtime.sendMessage({ type: 'RESUME_SESSION' }, () => {
      document.getElementById('pause-btn').textContent = '⏸ Pause';
    });
  } else {
    chrome.runtime.sendMessage({ type: 'PAUSE_SESSION' }, () => {
      document.getElementById('pause-btn').textContent = '▶ Resume';
    });
  }
});

// ---- EVENT: END ----

document.getElementById('end-btn')?.addEventListener('click', () => {
  if (confirm('End your Peak Window session?')) {
    chrome.runtime.sendMessage({ type: 'END_SESSION' }, () => {
      if (sessionInterval) clearInterval(sessionInterval);
      currentSession = null;
      init(); // Reload setup view
    });
  }
});

// ---- INIT ----

async function init() {
  showView('view-loading');

  // Check if a session is already active
  chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (res) => {
    if (res && res.session && res.session.active) {
      startSessionUI(res.session);
      return;
    }

    // No active session — fetch top task
    chrome.runtime.sendMessage({ type: 'GET_TOP_TASK' }, (r) => {
      if (!r || !r.task) {
        showView('view-no-task');
        return;
      }

      showView('view-setup');
      const hourlyRate = parseInt(localStorage.getItem('pg_hourly_rate') || '50');
      populateSetup(r.task, hourlyRate);
    });
  });
}

init();
