const API_BASE = "http://localhost:3001/api";

async function loadTopTask() {
  const taskState = document.getElementById('task-state');
  const authState = document.getElementById('auth-state');
  const emptyState = document.getElementById('empty-state');
  const taskTitle = document.getElementById('task-title');
  const taskBreakdown = document.getElementById('task-breakdown');
  const aiSection = document.getElementById('ai-section');

  try {
    const res = await fetch(`${API_BASE}/tasks`);
    if (!res.ok) {
      if (res.status === 401) {
        authState.classList.remove('hidden');
        return;
      }
      throw new Error("Failed to fetch");
    }

    const { tasks } = await res.json();
    
    // Sort by AI score, descending
    const pending = tasks
      .filter(t => t.status === 'pending')
      .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));

    if (pending.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    const top = pending[0];
    taskTitle.innerText = top.title;
    
    if (top.ai_breakdown && Array.isArray(top.ai_breakdown)) {
      taskBreakdown.innerHTML = top.ai_breakdown
        .map(step => `<li>${step}</li>`)
        .join('');
      aiSection.classList.remove('hidden');
    }

    taskState.classList.remove('hidden');
  } catch (err) {
    console.error("New Tab load failed:", err);
    authState.classList.remove('hidden');
  }
}

// Check for session via the dashboard cookies/session
// In a local dev environment, the extension can often read from the domain if permitted
loadTopTask();
