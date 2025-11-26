/*
  ScreenTime MVP - Enhanced Version
  - Simulated per-app usage tracking with start/stop
  - Per-app limits (minutes), total limit
  - Persisted in localStorage
  - Charts: total and per-app
  - AI avatar: mocked responses; placeholder to plug real API
  - Improved UI/UX with toast notifications, better visual feedback
*/

const DEFAULT_APPS = [
  { id: 'youtube', label:'YouTube', color:'#FF0000', iconClass:'fab fa-youtube' },
  { id: 'whatsapp', label:'WhatsApp', color:'#25D366', iconClass:'fab fa-whatsapp' },
  { id: 'tiktok', label:'TikTok', color:'#010101', iconClass:'fab fa-tiktok' },
  { id: 'instagram', label:'Instagram', color:'#C13584', iconClass:'fab fa-instagram' },
  { id: 'games', label:'Games', color:'#8B5CF6', iconClass:'fas fa-gamepad' },
];

const KEY = 'st_mvp_v2';
let state = loadState();
let selectedAppId = null;
let timers = {}; // intervals

// --- helpers
function fmtHMS(seconds){
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = seconds%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function minutesToSeconds(min){ return Math.round(Number(min||0)*60); }
function saveState(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  // default structure
  const apps = {};
  DEFAULT_APPS.forEach(a=>{
    apps[a.id] = {
      id: a.id,
      label: a.label,
      color: a.color,
      iconClass: a.iconClass,
      usedSeconds: 0,
      limitSeconds: minutesToSeconds(60), // default 60 mins per app
      running: false,
      lastStart: null
    };
  });
  return {
    childName: 'Alex',
    totalLimitSeconds: minutesToSeconds(240),
    apps,
    logs: [] // record session events for export
  };
}

// --- Toast notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'check-circle' : 
               type === 'warning' ? 'exclamation-triangle' : 'exclamation-circle';
  
  toast.innerHTML = `
    <i class="fas fa-${icon} toast-icon"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Show toast
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 4000);
}

// --- UI build
const appsContainer = document.getElementById('appsContainer');
const totalUsedEl = document.getElementById('totalUsed');
const totalLimitInput = document.getElementById('totalLimit');
const applyTotalBtn = document.getElementById('applyTotal');
const selectedChild = document.getElementById('childName');
const exportBtn = document.getElementById('exportBtn');
const resetAllBtn = document.getElementById('resetAll');
const messagesEl = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const sampleTipsBtn = document.getElementById('sampleTips');
const clearChatBtn = document.getElementById('clearChat');
const lockAllBtn = document.getElementById('lockAll');
const unlockAllBtn = document.getElementById('unlockAll');
const resetUsageBtn = document.getElementById('resetUsage');
const totalProgress = document.getElementById('totalProgress');
const totalLimitDisplay = document.getElementById('totalLimitDisplay');

function renderApps(){
  appsContainer.innerHTML = '';
  const apps = Object.values(state.apps);
  apps.forEach(a=>{
    const el = document.createElement('div');
    
    // Determine status class
    let statusClass = 'status-stopped';
    let statusText = 'Stopped';
    let cardClass = 'app-card';
    
    if(a.running) {
      statusClass = 'status-running';
      statusText = 'Running';
      cardClass += ' running';
    } else if(a.usedSeconds >= a.limitSeconds && a.limitSeconds > 0) {
      statusClass = 'status-locked';
      statusText = 'Locked';
      cardClass += ' locked';
    }
    
    // Add selected class if this is the selected app
    if(selectedAppId === a.id) {
      cardClass += ' selected';
    }
    
    el.className = cardClass;
    el.dataset.appid = a.id;
    
    el.innerHTML = `
      <div class="app-header">
        <div style="display:flex;align-items:start;gap:12px">
          <div class="app-icon" style="background-color: ${a.color}30; color: ${a.color}">
            <i class="${a.iconClass}"></i>
          </div>
          <div class="app-info">
            <div class="app-name">${a.label}</div>
            <div class="app-limit">Limit: <strong>${a.limitSeconds>0? Math.round(a.limitSeconds/60) + ' min':'Unlimited'}</strong></div>
          </div>
        </div>
        <div class="app-time">${fmtHMS(a.usedSeconds)}</div>
      </div>
      
      <div class="app-status ${statusClass}">
        <i class="fas fa-circle" style="font-size: 8px;"></i>
        ${statusText}
      </div>
      
      <div class="app-controls">
        <button class="btn btn-outline startBtn" data-app="${a.id}">
          ${a.running ? '<i class="fas fa-stop"></i> Stop' : '<i class="fas fa-play"></i> Start'}
        </button>
        <button class="btn btn-outline resetBtn" data-app="${a.id}">
          <i class="fas fa-redo"></i> Reset
        </button>
        <div class="control-group">
          <span class="control-label">Limit (min)</span>
          <input type="number" class="control-input limitInput" data-app="${a.id}" min="0" value="${a.limitSeconds? Math.round(a.limitSeconds/60):0}">
        </div>
      </div>
    `;

    // click to select
    el.addEventListener('click', (ev)=>{
      if(ev.target.closest('.startBtn') || ev.target.closest('.resetBtn') || ev.target.closest('.limitInput')) return;
      selectedAppId = a.id;
      updateSelectedAppPanel();
      renderApps(); // Re-render to update selection
    });

    appsContainer.appendChild(el);
  });

  // attach events
  document.querySelectorAll('.startBtn').forEach(b=>{
    b.onclick = (e)=> {
      e.stopPropagation();
      const id = b.dataset.app;
      toggleApp(id);
    };
  });
  document.querySelectorAll('.resetBtn').forEach(b=>{
    b.onclick = (e)=>{
      e.stopPropagation();
      const id = b.dataset.app;
      resetAppUsage(id);
    };
  });
  document.querySelectorAll('.limitInput').forEach(inp=>{
    inp.onchange = (e)=>{
      const id = inp.dataset.app;
      const v = Number(inp.value) || 0;
      state.apps[id].limitSeconds = minutesToSeconds(v);
      saveState();
      renderApps();
      updateCharts();
      showToast(`${state.apps[id].label} limit updated to ${v} minutes`, 'success');
    };
  });
}

// --- timers & control
function toggleApp(id){
  const app = state.apps[id];
  if(!app) return;
  if(app.running){
    // stop
    stopApp(id);
  } else {
    // start — check limit first
    if(app.limitSeconds>0 && app.usedSeconds >= app.limitSeconds){
      showToast(`${app.label} is locked because the limit is reached.`, 'warning');
      return;
    }
    startApp(id);
  }
}

function startApp(id){
  const app = state.apps[id];
  if(!app) return;
  app.running = true;
  app.lastStart = Date.now();
  state.logs.push({type:'start', app:id, t:Date.now()});
  saveState();
  // set interval tick
  if(timers[id]) clearInterval(timers[id]);
  timers[id] = setInterval(()=>{
    // increment usedSeconds
    const now = Date.now();
    const elapsed = Math.floor((now - app.lastStart)/1000);
    // we track by calculating since lastStart to be robust
    app.usedSeconds = (app._baseUsed||0) + elapsed;
    // if surpass limit, stop and lock
    if(app.limitSeconds>0 && app.usedSeconds >= app.limitSeconds){
      // clamp
      app.usedSeconds = app.limitSeconds;
      stopApp(id, true);
      showToast(`${app.label} limit reached and locked.`, 'warning');
    }
    saveState();
    updateAppUI(id);
    updateCharts();
  }, 1000);
  // set base marker for robust accumulation
  app._baseUsed = app.usedSeconds;
  updateAppUI(id);
  updateSelectedAppPanel();
  showToast(`${app.label} timer started`, 'success');
}

function stopApp(id, reached=false){
  const app = state.apps[id];
  if(!app) return;
  if(!app.running) return;
  // compute final elapsed
  const now = Date.now();
  const elapsedSec = Math.floor((now - app.lastStart)/1000);
  app.usedSeconds = (app._baseUsed || 0) + elapsedSec;
  app.running = false;
  app.lastStart = null;
  app._baseUsed = app.usedSeconds;
  state.logs.push({type: 'stop', app:id, t:Date.now(), reached});
  saveState();
  if(timers[id]){ clearInterval(timers[id]); delete timers[id]; }
  updateAppUI(id);
  updateSelectedAppPanel();
  updateCharts();
  showToast(`${app.label} timer stopped`, 'success');
}

function updateAppUI(id){
  const app = state.apps[id];
  if(!app) return;
  const node = document.querySelector(`[data-appid="${id}"]`);
  if(!node) return;
  
  // Update time
  const timeEl = node.querySelector('.app-time');
  if(timeEl) timeEl.textContent = fmtHMS(app.usedSeconds);
  
  // Update status
  const statusEl = node.querySelector('.app-status');
  if(statusEl) {
    let statusClass = 'status-stopped';
    let statusText = 'Stopped';
    if(app.running) {
      statusClass = 'status-running';
      statusText = 'Running';
    } else if(app.usedSeconds >= app.limitSeconds && app.limitSeconds > 0) {
      statusClass = 'status-locked';
      statusText = 'Locked';
    }
    
    statusEl.className = `app-status ${statusClass}`;
    statusEl.innerHTML = `<i class="fas fa-circle" style="font-size: 8px;"></i> ${statusText}`;
  }
  
  // Update card classes
  node.classList.remove('running', 'locked');
  if(app.running) {
    node.classList.add('running');
  } else if(app.usedSeconds >= app.limitSeconds && app.limitSeconds>0) {
    node.classList.add('locked');
  }
  
  // Update selection
  if(selectedAppId === id) {
    node.classList.add('selected');
  } else {
    node.classList.remove('selected');
  }
}

function resetAppUsage(id){
  const app = state.apps[id];
  if(!app) return;
  if(confirm(`Reset usage for ${app.label}?`)){
    // stop if running
    if(app.running) stopApp(id);
    app.usedSeconds = 0;
    app._baseUsed = 0;
    app.lastStart = null;
    saveState();
    renderApps();
    updateCharts();
    showToast(`${app.label} usage reset`, 'success');
  }
}

function resetAll(){
  if(!confirm('Clear all usage data and settings?')) return;
  localStorage.removeItem(KEY);
  state = loadState();
  selectedAppId = null;
  clearAllTimers();
  renderAll();
  showToast('All data reset to defaults', 'success');
}

function clearAllTimers(){
  Object.keys(timers).forEach(k=>{
    clearInterval(timers[k]);
    delete timers[k];
  });
}

// --- Selected app panel & charts
const totalCtx = document.getElementById('totalChart').getContext('2d');
const appCtx = document.getElementById('appChart').getContext('2d');
let totalChart, appChart;

function createCharts(){
  if(totalChart) totalChart.destroy();
  totalChart = new Chart(totalCtx, {
    type: 'doughnut',
    data: {
      labels: ['Used','Remaining'],
      datasets: [{
        data: [0,100],
        backgroundColor: ['var(--primary)', 'rgba(255,255,255,0.06)'],
        borderWidth:0
      }]
      
    },
    options:{
      plugins:{legend:{display:false}},
      maintainAspectRatio:false,
      cutout: '70%'
    }
  });

  if(appChart) appChart.destroy();
  appChart = new Chart(appCtx, {
    type: 'bar',
    data: {labels:[],datasets:[{label:'Minutes used',data:[],backgroundColor:[]}]},
    options:{
      indexAxis:'y',
      plugins:{legend:{display:false}},
      scales:{
        x:{beginAtZero:true, grid:{color: 'rgba(255,255,255,0.1)'}},
        y:{grid:{display:false}}
      },
      maintainAspectRatio:false
    }
  });
}

function updateCharts(){
  // total
  const totalUsed = Object.values(state.apps).reduce((s,a)=>s + a.usedSeconds,0);
  const totalLimit = state.totalLimitSeconds || 1;
  const usedPct = totalLimit>0? Math.min(100, Math.round((totalUsed/totalLimit)*100)):0;
  
  totalChart.data.datasets[0].data = [totalUsed, Math.max(0, totalLimit - totalUsed)];
  totalChart.update();
  
  // Update progress bar
  totalProgress.style.width = `${usedPct}%`;
  
  // Update progress bar color based on usage
  totalProgress.classList.remove('warning', 'danger');
  if (usedPct >= 80) {
    totalProgress.classList.add('danger');
  } else if (usedPct >= 60) {
    totalProgress.classList.add('warning');
  }
  
  totalUsedEl.textContent = fmtHMS(totalUsed);
  totalLimitDisplay.textContent = `${Math.round(state.totalLimitSeconds/60)} minutes`;

  // per-app bars
  const labels = [];
  const data = [];
  const colors = [];
  Object.values(state.apps).forEach(a=>{
    labels.push(a.label);
    data.push(Math.round(a.usedSeconds/60));
    colors.push(a.color||'#64748b');
  });
  appChart.data.labels = labels;
  appChart.data.datasets[0].data = data;
  appChart.data.datasets[0].backgroundColor = colors;
  appChart.update();
}

function updateSelectedAppPanel(){
  const title = document.getElementById('selectedAppTitle');
  const lim = document.getElementById('selectedAppLimit');
  const status = document.getElementById('selectedAppStatus');
  if(!selectedAppId){
    title.textContent = '—';
    lim.textContent = '—';
    status.textContent = '—';
    return;
  }
  const a = state.apps[selectedAppId];
  title.textContent = a.label;
  lim.textContent = a.limitSeconds? `${Math.round(a.limitSeconds/60)} min` : 'Unlimited';
  
  let statusText = 'Stopped';
  if(a.running) statusText = 'Running';
  else if(a.usedSeconds >= a.limitSeconds && a.limitSeconds>0) statusText = 'Locked';
  
  status.textContent = statusText;
}

// --- Export CSV
function exportCSV(){
  const rows = [['app','label','used_seconds','limit_seconds','date_exported']];
  const t = new Date().toISOString();
  Object.values(state.apps).forEach(a=>{
    rows.push([a.id,a.label,a.usedSeconds,a.limitSeconds,t]);
  });
  let csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `screentime_report_${state.childName}_${(new Date()).toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Report exported successfully', 'success');
}

// --- AI Avatar (mock)
function sendMockChat(){
  const text = chatInput.value.trim();
  if(!text) return;
  appendMsg('user', text);
  chatInput.value = '';
  // very simple rule-based mock responses
  appendMsg('ai','Thinking...');
  setTimeout(()=>{
    const resp = mockAdvice(text);
    // replace last 'Thinking...' with real
    const last = messagesEl.querySelectorAll('.message.ai');
    if(last.length) last[last.length-1].querySelector('p').textContent = resp;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, 600 + Math.random()*1000);
}

function appendMsg(who, text){
  const el = document.createElement('div');
  el.className = `message ${who}`;
  
  const header = document.createElement('div');
  header.className = 'message-header';
  header.innerHTML = who === 'user' 
    ? '<i class="fas fa-user"></i> You' 
    : '<i class="fas fa-robot"></i> AI Advisor';
  
  const content = document.createElement('p');
  content.textContent = text;
  
  el.appendChild(header);
  el.appendChild(content);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function mockAdvice(text){
  const t = text.toLowerCase();
  if(t.includes('schedule') || t.includes('routine')){
    return "For ages 6–12, aim for 1–2 hours of recreational screen time on school days. Use consistent 'no-screen' windows before bed and during family mealtimes. Consider using our full advisor platform for personalized schedules!";
  } else if(t.includes('limit') || t.includes('lock')){
    return "Set clear app-specific limits, and combine them with device-wide rules. Encourage replacement activities (books, play) when limits are reached. Our platform can help you create balanced limits based on your child's age and needs.";
  } else if(t.includes('sleep') || t.includes('bed')){
    return "Avoid screens 1 hour before bed. Night-time blue light and stimulating content both harm sleep onset. Consider a 'no-screen' 9pm rule for younger kids. The full advisor platform offers sleep hygiene recommendations.";
  } else if(t.includes('frustrat') || t.includes('angry')){
    return "Stay calm. Use time limits as a predictable rule, not a surprise punishment. Offer positive reinforcement for following limits. Our platform provides strategies for handling resistance to screen time limits.";
  } else {
    const generic = [
      "Keep rules simple and consistent. Explain why limits exist, and involve your child in creating them.",
      "Gradually adjust limits — start strict, then adapt as you see responsible behaviour.",
      "Use incentives: e.g. extra outdoor time for meeting weekly targets.",
      "For more comprehensive guidance, access our full AI advisor platform with personalized recommendations."
    ];
    return generic[Math.floor(Math.random()*generic.length)];
  }
}

// sample tips
function sampleTips(){
  const texts = [
    "Create a family charging station outside bedrooms to discourage nighttime use.",
    "Designate device-free meals to encourage family conversation.",
    "Replace some screen time with shared activities like board games or outdoor play.",
    "Model healthy device use yourself - children learn by example.",
    "Access our full advisor platform for personalized digital wellbeing strategies."
  ];
  appendMsg('ai', texts[Math.floor(Math.random()*texts.length)]);
}

// Quick actions
function lockAllApps(){
  Object.values(state.apps).forEach(a=>{
    // set used to limit to lock
    if(a.limitSeconds>0) a.usedSeconds = a.limitSeconds;
    if(a.running) stopApp(a.id);
  });
  saveState(); renderApps(); updateCharts();
  showToast('All applications locked', 'success');
}
function unlockAllApps(){
  Object.values(state.apps).forEach(a=>{
    if(a.running) stopApp(a.id);
    a.usedSeconds = Math.min(a.usedSeconds, a.limitSeconds || a.usedSeconds);
  });
  saveState(); renderApps(); updateCharts();
  showToast('All applications unlocked', 'success');
}

// --- Event wiring
applyTotalBtn.onclick = ()=>{
  const mins = Number(totalLimitInput.value) || 0;
  state.totalLimitSeconds = minutesToSeconds(mins);
  saveState(); updateCharts();
  showToast(`Total daily limit set to ${mins} minutes`, 'success');
};
exportBtn.onclick = exportCSV;
resetAllBtn.onclick = resetAll;
sendBtn.onclick = sendMockChat;
sampleTipsBtn.onclick = sampleTips;
clearChatBtn.onclick = ()=>{
  messagesEl.innerHTML = '';
  appendMsg('ai','Hello! I\'m your ScreenTime Guardian advisor. I can help you set healthy screen time limits, create balanced schedules, and provide guidance on digital wellbeing for your child.');
  showToast('Chat cleared', 'success');
};
lockAllBtn.onclick = lockAllApps;
unlockAllBtn.onclick = unlockAllApps;
resetUsageBtn.onclick = ()=>{
  if(!confirm('Reset usage for ALL apps?')) return;
  Object.values(state.apps).forEach(a=>{
    if(a.running) stopApp(a.id);
    a.usedSeconds = 0; a._baseUsed = 0; a.lastStart = null;
  });
  saveState(); renderApps(); updateCharts();
  showToast('All app usage reset', 'success');
};

// Chat input enter key support
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMockChat();
  }
});

// --- Initial render and hydration for running timers (if any)
function renderAll(){
  selectedChild.textContent = state.childName || 'Child';
  totalLimitInput.value = Math.round((state.totalLimitSeconds||0)/60);
  renderApps();
  createCharts();
  updateCharts();
  updateSelectedAppPanel();
  // restart any that were marked running (simulate continuity)
  Object.values(state.apps).forEach(a=>{
    if(a.running && a.lastStart){
      // if lastStart is older than now, compute baseUsed
      a._baseUsed = a.usedSeconds || 0;
      startApp(a.id);
    }
  });
}

// run
renderAll();

// On unload: stop all timers cleanly and persist
window.addEventListener('beforeunload', ()=>{
  Object.keys(timers).forEach(id=>{
    if(state.apps[id] && state.apps[id].running) {
      stopApp(id);
    }
  });
  saveState();
});

/* Button to access the full AI advisor platform */
document.getElementById('askAI').onclick = ()=>{
  // In a real implementation, this would redirect to your AI advisor platform
  window.open('#', '_blank');
};