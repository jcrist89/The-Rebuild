(function () {
  "use strict";

  let PROGRAM = null;
  const L = window.RebuildLogic;
  // Local storage must be scoped per authenticated account: without the account id in the
  // key, one browser used by two accounts (a coach demoing the app, a shared family device,
  // a buyer who is later disabled and replaced) would read and silently adopt whatever the
  // previous account left behind. The account id is rendered server-side in tracker/page.tsx
  // as a data attribute on #accountScope, from the signed-in session — never from anything
  // client-editable. It's a DOM attribute rather than a window global set by a separate
  // beforeInteractive script because this page is often reached by client-side navigation
  // (the landing page's link, the login redirect), and next/script's beforeInteractive
  // strategy only runs reliably on a full document load, not a soft navigation.
  const ACCOUNT_ID = typeof document !== "undefined" ? (document.getElementById("accountScope")?.dataset.accountId ?? null) : null;
  const STORAGE_KEY = ACCOUNT_ID ? `jcf-the-rebuild-v1:${ACCOUNT_ID}` : null;
  const TITLES = {
    today: ["THE ", "BUILD"], train: ["THE ", "WORK"], fuel: ["THE ", "FUEL"],
    body: ["THE ", "CHECK-IN"], plan: ["36 WEEK ", "MAP"]
  };
  const QUICK_FOODS = [
    ["Protein shake", 170, 30, 6, 2], ["Chicken + rice", 620, 55, 70, 12],
    ["Beef + potatoes", 690, 52, 64, 24], ["Greek yogurt + berries", 220, 28, 24, 2]
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[char]);
  const fmt = (value, digits = 0) => value == null || Number.isNaN(Number(value)) ? "-" : Number(value).toFixed(digits);
  const pct = (value, total) => total ? L.clamp(value / total * 100, 0, 100) : 0;

  function freshState() {
    return {
      version: 1,
      onboarded: false,
      profile: {
        name: "", sex: "male", age: 35, heightIn: 72, weight: 220, bodyFat: null,
        activity: "moderate", startDate: L.localISO(), startWeek: 1, upperIncrement: 5, lowerIncrement: 10, buildSplit: "five"
      },
      program: { currentWeek: 1, selectedWorkout: "", completed: {}, manualDeloadWeeks: [] },
      timers: { workoutStartedAt: null, workoutElapsedMs: 0, restEndsAt: null, restDuration: 90 },
      substitutions: {},
      logs: [],
      weights: [],
      waists: [],
      measurements: [],
      daily: {},
      food: {}
    };
  }

  function normalizeState(input) {
    const base = freshState();
    if (!input || typeof input !== "object") return base;
    const out = {
      ...base,
      ...input,
      version: 1,
      profile: { ...base.profile, ...(input.profile || {}) },
      program: { ...base.program, ...(input.program || {}) },
      timers: { ...base.timers, ...(input.timers || {}) },
      substitutions: input.substitutions && typeof input.substitutions === "object" ? input.substitutions : {},
      logs: Array.isArray(input.logs) ? input.logs.slice(-5000) : [],
      weights: Array.isArray(input.weights) ? input.weights.slice(-1000) : [],
      waists: Array.isArray(input.waists) ? input.waists.slice(-1000) : [],
      measurements: Array.isArray(input.measurements) ? input.measurements.slice(-250) : [],
      daily: input.daily && typeof input.daily === "object" ? input.daily : {},
      food: input.food && typeof input.food === "object" ? input.food : {}
    };
    out.program.currentWeek = L.clamp(Number(out.program.currentWeek) || 1, 1, 36);
    out.program.manualDeloadWeeks = Array.isArray(out.program.manualDeloadWeeks) ? out.program.manualDeloadWeeks.map(Number).filter((n) => n >= 1 && n <= 36) : [];
    out.timers.workoutStartedAt = Number.isFinite(Number(out.timers.workoutStartedAt)) && Number(out.timers.workoutStartedAt) > 0 ? Number(out.timers.workoutStartedAt) : null;
    out.timers.workoutElapsedMs = L.clamp(Number(out.timers.workoutElapsedMs) || 0, 0, 604800000);
    out.timers.restEndsAt = Number.isFinite(Number(out.timers.restEndsAt)) && Number(out.timers.restEndsAt) > 0 ? Number(out.timers.restEndsAt) : null;
    out.timers.restDuration = L.clamp(Number(out.timers.restDuration) || 90, 15, 600);
    return out;
  }

  function loadState() {
    if (!STORAGE_KEY) return freshState();
    try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
    catch (error) { return freshState(); }
  }

  let state = freshState();
  let tab = "today";
  let sheetContext = null;
  let sheetCompletedSets = new Set();
  let sheetSetEntryTimers = new Map();
  let toastTimer = null;
  let remoteSyncTimer = null;
  let remoteSyncReady = false;
  let timerAudioContext = null;
  let messages = [];
  let messagesLoaded = false;
  let messagesSending = false;

  function nutritionContext() {
    const basis = L.nutritionWeight(state.weights, state.profile.weight, L.localISO());
    return {
      basis,
      targets: L.nutritionTargets(state.profile, phaseNumber(), trainedToday(), basis.weight)
    };
  }

  function workoutElapsed(now = Date.now()) {
    const running = state.timers.workoutStartedAt ? Math.max(0, now - state.timers.workoutStartedAt) : 0;
    return state.timers.workoutElapsedMs + running;
  }

  function restRemaining(now = Date.now()) {
    return state.timers.restEndsAt ? Math.max(0, state.timers.restEndsAt - now) : state.timers.restDuration * 1000;
  }

  function primeTimerAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!timerAudioContext) timerAudioContext = new AudioContext();
      if (timerAudioContext.state === "suspended") void timerAudioContext.resume();
    } catch (error) { console.warn("Timer sound unavailable", error); }
  }

  function signalRestComplete() {
    try { if (navigator.vibrate) navigator.vibrate([180, 90, 260]); } catch (error) { console.warn("Timer vibration unavailable", error); }
    try {
      if (!timerAudioContext || timerAudioContext.state !== "running") return;
      const oscillator = timerAudioContext.createOscillator();
      const gain = timerAudioContext.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.12, timerAudioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, timerAudioContext.currentTime + 0.45);
      oscillator.connect(gain).connect(timerAudioContext.destination);
      oscillator.start();
      oscillator.stop(timerAudioContext.currentTime + 0.45);
    } catch (error) { console.warn("Timer sound unavailable", error); }
  }

  function updateTimerDisplays() {
    if (!state?.timers) return;
    const now = Date.now();
    const workout = L.formatTimer(workoutElapsed(now), true);
    document.querySelectorAll("[data-workout-clock]").forEach((element) => { element.textContent = workout; });
    document.querySelectorAll("[data-workout-toggle]").forEach((element) => { element.textContent = state.timers.workoutStartedAt ? "Pause" : "Start"; });

    const wasResting = Boolean(state.timers.restEndsAt);
    const remaining = restRemaining(now);
    if (wasResting && remaining <= 0) {
      state.timers.restEndsAt = null;
      saveState("Rest complete — next set");
      signalRestComplete();
    }
    const rest = L.formatTimer(wasResting ? remaining : state.timers.restDuration * 1000, false);
    document.querySelectorAll("[data-rest-clock]").forEach((element) => { element.textContent = rest; });
    document.querySelectorAll("[data-rest-status]").forEach((element) => { element.textContent = wasResting && remaining > 0 ? "Counting down" : "Ready"; });
  }

  function toggleWorkoutTimer() {
    if (state.timers.workoutStartedAt) {
      state.timers.workoutElapsedMs = workoutElapsed();
      state.timers.workoutStartedAt = null;
      saveState("Workout timer paused");
    } else {
      state.timers.workoutStartedAt = Date.now();
      saveState("Workout timer started");
    }
    updateTimerDisplays();
  }

  function resetWorkoutTimer() {
    state.timers.workoutStartedAt = null;
    state.timers.workoutElapsedMs = 0;
    saveState("Workout timer reset");
    updateTimerDisplays();
  }

  function startRestTimer(seconds, persist = true) {
    primeTimerAudio();
    const duration = L.clamp(Number(seconds) || state.timers.restDuration || 90, 15, 600);
    state.timers.restDuration = duration;
    state.timers.restEndsAt = Date.now() + duration * 1000;
    if (persist) saveState(`${duration}-second rest started`);
    updateTimerDisplays();
  }

  function adjustRestTimer(seconds) {
    const now = Date.now();
    if (state.timers.restEndsAt) {
      state.timers.restEndsAt = Math.max(now, state.timers.restEndsAt + Number(seconds) * 1000);
    } else {
      state.timers.restDuration = L.clamp(state.timers.restDuration + Number(seconds), 15, 600);
    }
    saveState(seconds > 0 ? "Rest time added" : "Rest time reduced");
    updateTimerDisplays();
  }

  function cancelRestTimer() {
    state.timers.restEndsAt = null;
    saveState("Rest timer cleared");
    updateTimerDisplays();
  }

  function timerControls(compact = false) {
    return `<div class="timer-grid ${compact ? "compact" : ""}">
      <div class="timer-panel"><div class="label">Workout clock</div><div class="timer-display orange" data-workout-clock>${L.formatTimer(workoutElapsed(), true)}</div>
        <div class="button-row"><button class="button small" data-action="workout-timer-toggle" data-workout-toggle>${state.timers.workoutStartedAt ? "Pause" : "Start"}</button><button class="button secondary small" data-action="workout-timer-reset">Reset</button></div></div>
      <div class="timer-panel"><div class="row"><div class="label">Rest timer</div><span class="timer-status" data-rest-status>${state.timers.restEndsAt ? "Counting down" : "Ready"}</span></div><div class="timer-display blue" data-rest-clock>${L.formatTimer(restRemaining(), false)}</div>
        <div class="timer-presets">${[60, 90, 120].map((seconds) => `<button data-action="rest-timer-start" data-seconds="${seconds}" aria-label="Start ${seconds} second rest">${seconds}s</button>`).join("")}</div>
        <div class="button-row"><button class="button secondary small" data-action="rest-timer-adjust" data-seconds="-15">−15</button><button class="button secondary small" data-action="rest-timer-cancel">Clear</button><button class="button secondary small" data-action="rest-timer-adjust" data-seconds="15">+15</button></div></div>
    </div>`;
  }

  function redirectForAccess(status) {
    window.location.assign(status === 401 ? "/login" : "/access");
  }

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function protectedJson(url, options) {
    const isInitialTrackerLoad = !remoteSyncReady && (url === "/api/program" || url === "/api/state");
    const attempts = isInitialTrackerLoad ? 2 : 1;
    let response;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      response = await fetch(url, { cache: "no-store", ...options });
      if (response.status !== 401 || attempt === attempts - 1) break;
      // Right after password sign-in, Safari and some embedded browsers can
      // start this request before the Set-Cookie response has been committed.
      await wait(300);
    }
    if (response.status === 401 || response.status === 403) {
      redirectForAccess(response.status);
      throw new Error("Access required");
    }
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  function syncRemoteState(keepalive) {
    if (!remoteSyncReady) return Promise.resolve();
    return fetch("/api/state", {
      method: "PUT",
      cache: "no-store",
      keepalive: Boolean(keepalive),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    }).then((response) => {
      if (response.status === 401 || response.status === 403) redirectForAccess(response.status);
      if (!response.ok) throw new Error(`Progress sync failed (${response.status})`);
    }).catch((error) => console.warn(error.message));
  }

  function scheduleRemoteSync() {
    if (!remoteSyncReady) return;
    clearTimeout(remoteSyncTimer);
    remoteSyncTimer = setTimeout(() => syncRemoteState(false), 650);
  }

  function saveState(message) {
    try {
      if (STORAGE_KEY) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      scheduleRemoteSync();
      if (message) toast(message);
      return true;
    } catch (error) {
      toast("Could not save on this device. Export a backup now.");
      return false;
    }
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("on"), 2200);
  }

  function phaseNumber() { return L.phaseForWeek(state.program.currentWeek); }
  function phase() { return PROGRAM.phases[phaseNumber()]; }
  function workouts() {
    if (phaseNumber() === 2 && state.profile.buildSplit === "four") {
      return PROGRAM.phases[1].workouts.map((workout) => ({
        ...workout,
        id: `build-four-${workout.id}`,
        subtitle: `${workout.subtitle} · recovery-limited Build variant`,
        exercises: workout.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets + 2 }))
      }));
    }
    return phase().workouts;
  }
  function workoutById(id) { return workouts().find((workout) => workout.id === id); }
  function workoutKey(workoutId, week = state.program.currentWeek) { return `${week}:${workoutId}`; }
  function isWorkoutComplete(workoutId, week = state.program.currentWeek) { return Boolean(state.program.completed[workoutKey(workoutId, week)]); }
  function isDeload() { return L.scheduledDeload(state.program.currentWeek, state.program.manualDeloadWeeks); }
  function effectiveExercises(workout) { return workout.exercises.map((exercise) => L.effectiveExercise(exercise, phaseNumber(), isDeload())); }
  function nextWorkout() { return workouts().find((workout) => !isWorkoutComplete(workout.id)) || workouts()[0]; }
  function selectedWorkout() {
    return workoutById(state.program.selectedWorkout) || nextWorkout();
  }
  function todayData() {
    const date = L.localISO();
    if (!state.daily[date]) state.daily[date] = { steps: 0, sleep: 0, water: 0, conditioning: 0, habits: {} };
    if (!state.daily[date].habits) state.daily[date].habits = {};
    return state.daily[date];
  }
  function foodsToday() {
    const date = L.localISO();
    if (!state.food[date]) state.food[date] = [];
    return state.food[date];
  }
  function trainedToday() {
    const today = L.localISO();
    return state.logs.some((log) => log.date === today) || Object.values(state.program.completed).some((item) => item && item.date === today);
  }
  function logsFor(week, workoutId, exerciseId) {
    return state.logs.filter((log) => Number(log.week) === Number(week) && log.workoutId === workoutId && (!exerciseId || log.exerciseId === exerciseId));
  }
  function exerciseLogged(workoutId, exerciseId) { return logsFor(state.program.currentWeek, workoutId, exerciseId).length > 0; }
  function weekComplete(week) {
    const p = PROGRAM.phases[L.phaseForWeek(week)];
    return p.workouts.every((workout) => isWorkoutComplete(workout.id, week));
  }

  function weekStartISO(week = state.program.currentWeek) {
    const start = L.parseLocalDate(state.profile.startDate) || new Date();
    start.setDate(start.getDate() + (Number(week) - Number(state.profile.startWeek || 1)) * 7);
    return L.localISO(start);
  }

  function progressStats() {
    const ws = workouts();
    const done = ws.filter((workout) => isWorkoutComplete(workout.id)).length;
    return { done, total: ws.length };
  }

  function renderSetup() {
    $("appShell").classList.add("hidden");
    const view = $("setupView");
    view.classList.remove("hidden");
    view.innerHTML = `
      <div class="setup-logo">
        <div class="brand"><strong>JON CRIST</strong> <em>FIT</em></div>
        <h1>THE <span>REBUILD</span></h1>
        <div class="muted">Your 36-week blueprint, carried into every session.</div>
      </div>
      <form id="setupForm" class="card accent">
        <div class="section-title" style="margin-top:2px"><h2>Set your baseline</h2><span>about 60 seconds</span></div>
        <div class="field"><label class="label" for="setupName">First name</label><input class="input" id="setupName" autocomplete="given-name" placeholder="Your name"></div>
        <div class="form-grid three">
          <div class="field"><label class="label" for="setupWeight">Weight (lb)</label><input class="input" id="setupWeight" type="number" min="80" max="600" step="0.1" value="220" required></div>
          <div class="field"><label class="label" for="setupHeight">Height (in)</label><input class="input" id="setupHeight" type="number" min="48" max="90" step="0.5" value="72" required></div>
          <div class="field"><label class="label" for="setupAge">Age</label><input class="input" id="setupAge" type="number" min="18" max="90" value="35" required></div>
        </div>
        <div class="form-grid" style="margin-top:12px">
          <div class="field"><label class="label" for="setupSex">Sex for calorie estimate</label><select class="input" id="setupSex"><option value="male">Male</option><option value="female">Female</option></select></div>
          <div class="field"><label class="label" for="setupBf">Body fat % (optional)</label><input class="input" id="setupBf" type="number" min="3" max="60" step="0.1" placeholder="e.g. 18"></div>
        </div>
        <div class="field" style="margin-top:12px"><label class="label" for="setupActivity">Daily activity</label><select class="input" id="setupActivity">
          <option value="desk">Desk job, under 5,000 steps</option><option value="moderate" selected>Moderate, 5,000-8,000 steps</option>
          <option value="active">On your feet, 8,000-12,000 steps</option><option value="physical">Physical job, 12,000+ steps</option>
        </select></div>
        <div class="field"><label class="label" for="setupWeek">Starting point</label><select class="input" id="setupWeek">
          <option value="1">Phase 1, Week 1 - above 20% body fat</option>
          <option value="5">Phase 1, Week 5 - 15-20% body fat</option>
          <option value="13">Phase 2, Week 13 - 15% or leaner</option>
        </select></div>
        <div class="callout blue" style="margin:14px 0">The app advances only when you choose to advance. Missed weeks do not move the program forward.</div>
        <button class="button" type="submit">Start the blueprint</button>
      </form>`;
    $("setupForm").addEventListener("submit", finishSetup);
    $("setupBf").addEventListener("input", (event) => {
      const bf = Number(event.target.value);
      if (!bf) return;
      $("setupWeek").value = bf > 20 ? "1" : bf >= 15 ? "5" : "13";
    });
  }

  function finishSetup(event) {
    event.preventDefault();
    const profile = {
      ...state.profile,
      name: $("setupName").value.trim().slice(0, 60),
      weight: Number($("setupWeight").value), heightIn: Number($("setupHeight").value),
      age: Number($("setupAge").value), sex: $("setupSex").value,
      bodyFat: Number($("setupBf").value) || null, activity: $("setupActivity").value,
      startDate: L.localISO(), startWeek: Number($("setupWeek").value)
    };
    if (profile.weight < 80 || profile.weight > 600 || profile.heightIn < 48 || profile.heightIn > 90) return toast("Check your starting measurements.");
    state.profile = profile;
    state.program.currentWeek = profile.startWeek;
    state.onboarded = true;
    saveState();
    $("setupView").classList.add("hidden");
    $("appShell").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "auto" });
    refresh();
  }

  function heroProgress() {
    const stats = progressStats();
    const p = phase();
    return `
      <div class="hero">
        <div class="eyebrow">Phase ${p.number} - ${esc(p.name)} · Week ${state.program.currentWeek} of 36</div>
        <h2>${esc(p.goal)}</h2>
        <div class="muted small">${esc(p.change)}</div>
        <div class="metric-grid">
          <div class="metric-box"><span class="metric orange">${state.program.currentWeek}</span><div class="label">Program week</div></div>
          <div class="metric-box"><span class="metric blue">${stats.done}/${stats.total}</span><div class="label">Sessions</div></div>
          <div class="metric-box"><span class="metric green">${Math.round(state.program.currentWeek / 36 * 100)}%</span><div class="label">Blueprint</div></div>
        </div>
        <div class="progress" style="margin-top:12px"><span style="width:${state.program.currentWeek / 36 * 100}%"></span></div>
      </div>`;
  }

  function renderToday() {
    const p = phase();
    const daily = todayData();
    const workout = nextWorkout();
    const stats = progressStats();
    const habitCount = PROGRAM.habits.filter((key) => daily.habits[key]).length;
    const { targets } = nutritionContext();
    const foodTotals = foodsToday().reduce((sum, item) => ({ calories: sum.calories + item.calories, protein: sum.protein + item.protein }), { calories: 0, protein: 0 });
    let html = heroProgress();

    if (stats.done === stats.total) {
      html += `<div class="card accent-green"><div class="row"><div><div class="label green">Week complete</div><div style="font-weight:800;margin-top:3px">All ${stats.total} sessions are in.</div></div><button class="button green inline small" data-action="advance-week">Advance</button></div></div>`;
    } else {
      html += `<div class="card accent">
        <div class="row"><div><div class="label">Next session</div><div class="cond" style="font-size:25px;font-weight:800">${esc(workout.name)}</div><div class="muted small">${esc(workout.subtitle)} · ${workout.exercises.length} exercises</div></div><div class="metric orange">${stats.done + 1}/${stats.total}</div></div>
        ${isDeload() ? `<div class="callout blue" style="margin:12px 0">Deload protocol active: half the sets, 60% of the load, same movements.</div>` : ""}
        <button class="button" style="margin-top:13px" data-action="open-next-workout" data-id="${workout.id}">Open session</button>
      </div>`;
    }

    html += `<div class="section-title"><h2>Daily inputs</h2><span>today</span></div>
      <div class="card">
        <div class="form-grid three">
          <div class="field"><label class="label" for="todaySteps">Steps</label><input class="input" id="todaySteps" type="number" min="0" step="100" value="${Number(daily.steps) || ""}" placeholder="${p.steps}"></div>
          <div class="field"><label class="label" for="todaySleep">Sleep</label><input class="input" id="todaySleep" type="number" min="0" max="24" step="0.1" value="${Number(daily.sleep) || ""}" placeholder="hours"></div>
          <div class="field"><label class="label" for="todayWater">Water</label><input class="input" id="todayWater" type="number" min="0" step="1" value="${Number(daily.water) || ""}" placeholder="${targets.water} oz"></div>
        </div>
        <div class="form-grid" style="margin-top:10px">
          <div class="field"><label class="label" for="quickWeight">Weight (lb)</label><input class="input" id="quickWeight" type="number" min="50" max="700" step="0.1" placeholder="morning"></div>
          <div class="field"><label class="label" for="quickWaist">Waist (in)</label><input class="input" id="quickWaist" type="number" min="15" max="90" step="0.1" placeholder="at navel"></div>
        </div>
        <button class="button blue small" style="margin-top:11px" data-action="save-daily">Save today's numbers</button>
      </div>

      <div class="section-title"><h2>Daily ten</h2><span>${habitCount}/10 today</span></div>
      <div class="card"><div class="habit-grid">${PROGRAM.habits.map((key) => `<button type="button" class="habit ${daily.habits[key] ? "on" : ""}" data-action="toggle-habit" data-key="${key}">${esc(PROGRAM.habitLabels[key])}</button>`).join("")}</div>
        <div class="progress green" style="margin-top:13px"><span style="width:${habitCount * 10}%"></span></div>
        <div class="muted fine" style="margin-top:7px">Eight out of ten is the daily pass mark. Consistency over perfection.</div>
      </div>

      <div class="section-title"><h2>Targets</h2><span>Phase ${p.number}</span></div>
      <div class="card">
        ${macroBar("Calories", foodTotals.calories, targets.calories, "", "")}
        ${macroBar("Protein", foodTotals.protein, targets.protein, "g", "blue")}
        ${macroBar("Steps", Number(daily.steps) || 0, p.steps, "", "green")}
      </div>
      <div class="card accent-blue"><div class="row"><div><div style="font-weight:800">Conditioning</div><div class="muted small">${p.conditioning.sessions} x ${p.conditioning.minutes} min · ${esc(p.conditioning.label)}</div></div><button class="button secondary inline small" data-action="toggle-conditioning">${daily.conditioning ? `${daily.conditioning} min ✓` : "Log"}</button></div></div>`;
    $("view-today").innerHTML = html;
  }

  function renderTrain() {
    const p = phase();
    const workout = selectedWorkout();
    state.program.selectedWorkout = workout.id;
    const exercises = effectiveExercises(workout);
    const completed = isWorkoutComplete(workout.id);
    const logged = exercises.filter((exercise) => exerciseLogged(workout.id, exercise.id)).length;
    let html = `<div class="card">
      <div class="row"><button class="button secondary inline small" data-action="week-back" ${state.program.currentWeek <= 1 ? "disabled" : ""}>Previous</button>
      <div style="text-align:center"><div class="label">Current week</div><div class="cond" style="font-size:27px;font-weight:800">${state.program.currentWeek} · ${esc(p.name)}</div></div>
      <button class="button secondary inline small" data-action="week-forward" ${state.program.currentWeek >= 36 ? "disabled" : ""}>Next</button></div>
    </div>`;
    if (isDeload()) html += `<div class="callout blue" style="margin-bottom:13px"><strong>Deload week.</strong> The app has cut working sets in half and recommends 60% of the previous load.</div>`;

    html += `<div class="section-title"><h2>Session timers</h2><span>saved if you leave</span></div>${timerControls()}
      <div class="section-title"><h2>Session order</h2><span>keep the order, not the days</span></div>
      <div class="button-row" style="overflow-x:auto;padding-bottom:5px">${workouts().map((item) => `<button class="button small ${item.id === workout.id ? "" : "secondary"}" style="min-width:100px" data-action="select-workout" data-id="${item.id}">${isWorkoutComplete(item.id) ? "✓ " : ""}${esc(item.name)}</button>`).join("")}</div>
      <div class="section-title"><h2>${esc(workout.name)}</h2><span>${logged}/${exercises.length} logged</span></div>
      <div class="card workout-card">
        <div class="workout-head ${completed ? "current" : ""}"><div class="row"><div><div class="label">${esc(workout.day)} · ${esc(workout.subtitle)}</div><div style="font-weight:800;margin-top:3px">${completed ? "Session complete" : "Working sets below"}</div></div><div class="metric ${completed ? "green" : "orange"}">${completed ? "DONE" : `${logged}/${exercises.length}`}</div></div></div>
        ${exercises.map((exercise) => exerciseRow(workout, exercise)).join("")}
        <div class="session-note">Warm up the first exercise only: 3 minutes easy, band pull-aparts, a dead hang, then 40% x 8, 60% x 5, 80% x 3. Alternate A1/A2, B1/B2, and C1/C2 pairs with 60 seconds between exercises.</div>
      </div>
      <button class="button ${completed ? "secondary" : "green"}" data-action="toggle-workout" data-id="${workout.id}">${completed ? "Mark session incomplete" : "Finish session"}</button>
      <div class="section-title"><h2>S.T.D. method</h2><span>execution standard</span></div>
      ${Object.entries(PROGRAM.tags).map(([tag, item]) => `<div class="card"><div class="row"><span class="tag tag-${tag}">${tag}</span><div style="flex:1"><div style="font-weight:800">${esc(item.name)}</div><div class="muted small">${esc(item.cue)}</div></div></div></div>`).join("")}`;
    $("view-train").innerHTML = html;
  }

  function exerciseRow(workout, exercise) {
    const actualName = state.substitutions[exercise.id] || exercise.name;
    const suggestion = L.progressionSuggestion(state.logs, exercise, actualName, state.profile, isDeload(), phaseNumber());
    const done = exerciseLogged(workout.id, exercise.id);
    const unit = exercise.unit === "reps" ? "" : ` ${exercise.unit}`;
    const range = exercise.min === exercise.max ? `${exercise.min}${unit}` : `${exercise.min}-${exercise.max}${unit}`;
    return `<div class="exercise">
      <span class="tag tag-${exercise.tag}">${exercise.tag}</span>
      <div><div class="exercise-name">${exercise.group ? `<span class="orange">${esc(exercise.group)}.</span> ` : ""}${esc(actualName)}</div>
        <div class="prescription">${exercise.sets} x ${range} · RPE ${esc(exercise.rpe)} · ${esc(exercise.rest)}</div>
        <div class="exercise-note ${suggestion.action === "up" ? "green" : suggestion.action === "deload" ? "blue" : "muted"}">${esc(suggestion.note)}</div>
      </div>
      <div><div class="weight ${suggestion.weight ? "orange" : "muted"}">${suggestion.weight ? `${fmt(suggestion.weight, suggestion.weight % 1 ? 1 : 0)} lb` : "SET WT"}</div>
        <button class="log-button ${done ? "done" : ""}" data-action="open-exercise" data-workout="${workout.id}" data-exercise="${exercise.id}">${done ? "Edit" : "Log"}</button></div>
    </div>`;
  }

  function openExercise(workoutId, exerciseId) {
    const workout = workoutById(workoutId);
    const exercise = effectiveExercises(workout).find((item) => item.id === exerciseId);
    if (!workout || !exercise) return;
    sheetContext = { workoutId, exerciseId };
    const priorWeekLogs = state.logs.filter((log) => log.exerciseId === exercise.id);
    const current = logsFor(state.program.currentWeek, workoutId, exerciseId).slice(-1)[0];
    const selectedName = current?.actualName || state.substitutions[exercise.id] || exercise.name;
    const options = [exercise.name, ...(PROGRAM.substitutions[exercise.id] || [])];
    if (!options.includes(selectedName)) options.push(selectedName);
    const suggestion = L.progressionSuggestion(priorWeekLogs.filter((log) => log !== current), exercise, selectedName, state.profile, isDeload(), phaseNumber());
    const unitLabel = exercise.unit === "sec" ? "Seconds" : exercise.unit === "yd" ? "Yards" : "Reps";
    const rows = Array.from({ length: exercise.sets }, (_, index) => {
      const set = current?.sets?.[index] || {};
      return `<div class="set-row"><div class="label" style="padding-bottom:11px">Set ${index + 1}</div>
        <div class="field"><label class="label" for="setWeight${index}">Weight</label><input class="input set-weight" id="setWeight${index}" data-set-index="${index}" type="number" min="0" step="0.5" value="${set.weight ?? suggestion.weight ?? ""}" inputmode="decimal"></div>
        <div class="field"><label class="label" for="setReps${index}">${unitLabel}</label><input class="input set-reps" id="setReps${index}" data-set-index="${index}" type="number" min="0" step="1" value="${set.reps ?? ""}" inputmode="numeric"></div>
        <div class="field"><label class="label" for="setRpe${index}">RPE</label><input class="input set-rpe" id="setRpe${index}" type="number" min="1" max="10" step="0.5" value="${set.rpe ?? ""}" inputmode="decimal"></div></div>`;
    }).join("");
    $("sheetBody").innerHTML = `<h2 id="sheetTitle">${esc(exercise.name)}</h2>
      <div class="muted small" style="margin:3px 0 14px">${exercise.sets} sets · ${exercise.min}${exercise.min === exercise.max ? "" : `-${exercise.max}`} ${exercise.unit} · RPE ${esc(exercise.rpe)} · ${esc(exercise.rest)}</div>
      ${isDeload() ? `<div class="callout blue" style="margin-bottom:12px">Deload: ${exercise.sets} sets at about 60% of your previous load.</div>` : ""}
      <div class="field"><label class="label" for="actualExercise">Exercise or substitution</label><select class="input" id="actualExercise">${options.map((name) => `<option ${name === selectedName ? "selected" : ""}>${esc(name)}</option>`).join("")}<option value="__custom">Custom substitution...</option></select></div>
      <div id="customExerciseBox" class="field hidden"><label class="label" for="customExercise">Custom exercise</label><input class="input" id="customExercise" maxlength="100" placeholder="Same movement pattern and rep range"></div>
      <div class="callout" style="margin-bottom:14px">${esc(exercise.notes)}</div>
      ${timerControls(true)}
      ${rows}
      <div class="button-row" style="margin-top:15px"><button class="button secondary" data-action="close-sheet">Cancel</button><button class="button" data-action="save-exercise">Save sets</button></div>
      ${current ? `<button class="button danger small" style="margin-top:9px" data-action="delete-exercise-log">Delete this log</button>` : ""}`;
    $("actualExercise").addEventListener("change", (event) => $("customExerciseBox").classList.toggle("hidden", event.target.value !== "__custom"));
    clearSheetEntryTimers();
    sheetCompletedSets = new Set((current?.sets || []).flatMap((set, index) => L.setEntryComplete(set.weight, set.reps) ? [index] : []));
    const prescribedRest = L.restSeconds(exercise.rest);
    document.querySelectorAll(".set-weight, .set-reps").forEach((input) => input.addEventListener("input", () => {
      const index = Number(input.dataset.setIndex);
      const weight = $(`setWeight${index}`).value;
      const reps = $(`setReps${index}`).value;
      clearTimeout(sheetSetEntryTimers.get(index));
      sheetSetEntryTimers.delete(index);
      if (!L.setEntryComplete(weight, reps)) {
        sheetCompletedSets.delete(index);
        return;
      }
      if (sheetCompletedSets.has(index)) return;
      const pending = setTimeout(() => {
        if (!sheetContext || !L.setEntryComplete($(`setWeight${index}`)?.value, $(`setReps${index}`)?.value)) return;
        sheetCompletedSets.add(index);
        sheetSetEntryTimers.delete(index);
        startRestTimer(prescribedRest);
      }, 500);
      sheetSetEntryTimers.set(index, pending);
    }));
    $("scrim").classList.add("on");
    $("sheet").classList.add("on");
    $("sheet").removeAttribute("inert");
    $("sheet").setAttribute("aria-hidden", "false");
    $("appShell").setAttribute("inert", "");
    setTimeout(() => $("actualExercise").focus(), 50);
  }

  function closeSheet() {
    clearSheetEntryTimers();
    $("scrim").classList.remove("on");
    $("sheet").classList.remove("on");
    $("sheet").setAttribute("aria-hidden", "true");
    $("sheet").setAttribute("inert", "");
    $("appShell").removeAttribute("inert");
    sheetContext = null;
  }

  function clearSheetEntryTimers() {
    sheetSetEntryTimers.forEach((timer) => clearTimeout(timer));
    sheetSetEntryTimers.clear();
  }

  function unreadCoachMessages() {
    return messages.filter((item) => item.author === "admin" && !item.read).length;
  }

  function updateMessagesBadge() {
    const count = unreadCoachMessages();
    document.querySelectorAll("[data-messages-badge]").forEach((element) => {
      element.textContent = count > 9 ? "9+" : String(count);
      element.classList.toggle("hidden", count === 0);
    });
  }

  async function loadMessages({ markRead } = {}) {
    try {
      messages = (await protectedJson("/api/messages")).messages || [];
      messagesLoaded = true;
      updateMessagesBadge();
      if (markRead && unreadCoachMessages() > 0) {
        await fetch("/api/messages", { method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json" }, body: "{}" });
        messages = messages.map((item) => (item.author === "admin" ? { ...item, read: true } : item));
        updateMessagesBadge();
      }
    } catch (error) {
      console.warn("Messages unavailable", error.message);
    }
  }

  function messageBubble(item) {
    const mine = item.author === "buyer";
    const when = new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `<div class="message-bubble ${mine ? "mine" : "theirs"}">${esc(item.message)}<span class="message-meta">${mine ? "You" : "Coach"} · ${when}</span></div>`;
  }

  function renderMessagesSheet() {
    const thread = messages.length
      ? `<div class="message-thread" id="messageThread">${messages.map(messageBubble).join("")}</div>`
      : `<div class="message-thread"><div class="message-empty">No messages yet. Send your coach a note below.</div></div>`;
    $("sheetBody").innerHTML = `<h2 id="sheetTitle">Messages</h2>
      <div class="muted small" style="margin:3px 0 14px">Direct line to your coach. Replies land here, not in your regular inbox.</div>
      ${thread}
      <div class="message-compose"><textarea id="messageInput" maxlength="2000" placeholder="Write a message..." aria-label="Message"></textarea><button class="button" data-action="send-message" ${messagesSending ? "disabled" : ""}>Send</button></div>
      <div class="button-row" style="margin-top:15px"><button class="button secondary" data-action="close-sheet">Close</button></div>`;
    const scrollEl = $("messageThread");
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  async function openMessages() {
    sheetContext = { messages: true };
    renderMessagesSheet();
    $("scrim").classList.add("on");
    $("sheet").classList.add("on");
    $("sheet").removeAttribute("inert");
    $("sheet").setAttribute("aria-hidden", "false");
    $("appShell").setAttribute("inert", "");
    setTimeout(() => $("messageInput")?.focus(), 50);
    await loadMessages({ markRead: true });
    if (sheetContext && sheetContext.messages) renderMessagesSheet();
  }

  async function sendMessage() {
    const input = $("messageInput");
    const text = input ? input.value.trim() : "";
    if (!text) return toast("Enter a message first.");
    if (messagesSending) return;
    messagesSending = true;
    renderMessagesSheet();
    try {
      const response = await fetch("/api/messages", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      if (response.status === 401 || response.status === 403) return redirectForAccess(response.status);
      if (!response.ok) throw new Error(`Send failed (${response.status})`);
      messagesSending = false;
      await loadMessages();
      if (sheetContext && sheetContext.messages) renderMessagesSheet();
    } catch (error) {
      messagesSending = false;
      renderMessagesSheet();
      toast("Could not send that message. Try again.");
    }
  }

  function saveExercise() {
    if (!sheetContext) return;
    const workout = workoutById(sheetContext.workoutId);
    const exercise = effectiveExercises(workout).find((item) => item.id === sheetContext.exerciseId);
    let actualName = $("actualExercise").value;
    if (actualName === "__custom") actualName = $("customExercise").value.trim();
    if (!actualName || actualName.length > 100) return toast("Choose or enter a valid exercise.");
    const weights = [...document.querySelectorAll(".set-weight")];
    const reps = [...document.querySelectorAll(".set-reps")];
    const rpes = [...document.querySelectorAll(".set-rpe")];
    const sets = weights.map((input, index) => ({ weight: Number(input.value), reps: Number(reps[index].value), rpe: Number(rpes[index].value) }));
    if (sets.some((set) => !(set.weight >= 0) || !(set.reps > 0) || !(set.rpe >= 1 && set.rpe <= 10))) return toast("Log reps and an RPE from 1-10 for every set.");
    state.substitutions[exercise.id] = actualName;
    state.logs = state.logs.filter((log) => !(Number(log.week) === state.program.currentWeek && log.workoutId === workout.id && log.exerciseId === exercise.id));
    state.logs.push({ week: state.program.currentWeek, phase: phaseNumber(), workoutId: workout.id, exerciseId: exercise.id, actualName, date: L.localISO(), savedAt: Date.now(), sets });
    saveState("Sets saved");
    closeSheet();
    refresh();
  }

  function deleteExerciseLog() {
    if (!sheetContext) return;
    state.logs = state.logs.filter((log) => !(Number(log.week) === state.program.currentWeek && log.workoutId === sheetContext.workoutId && log.exerciseId === sheetContext.exerciseId));
    saveState("Exercise log removed");
    closeSheet();
    refresh();
  }

  function macroBar(label, value, target, unit, color) {
    const over = value > target * 1.05;
    return `<div class="macro"><div class="row"><span class="label">${label}</span><strong>${Math.round(value)}${unit} <span class="muted small">/ ${target}${unit}</span></strong></div><div class="progress ${over ? "red" : color}"><span style="width:${pct(value, target)}%"></span></div></div>`;
  }

  function renderFuel() {
    const { targets, basis } = nutritionContext();
    const foods = foodsToday();
    const totals = foods.reduce((sum, item) => ({
      calories: sum.calories + item.calories, protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    $("view-fuel").innerHTML = `<div class="hero"><div class="eyebrow">Phase ${phaseNumber()} - ${esc(phase().name)}</div><h2>Your numbers, not someone else's</h2>
      <div class="muted small">Maintenance estimate ${targets.maintenance} · Based on your ${basis.label}: ${fmt(basis.weight, 1)} lb.</div>
      <div class="metric-grid"><div class="metric-box"><span class="metric orange">${targets.calories}</span><div class="label">Calories</div></div><div class="metric-box"><span class="metric blue">${targets.protein}g</span><div class="label">Protein</div></div><div class="metric-box"><span class="metric green">${targets.fiber}g</span><div class="label">Fiber floor</div></div></div></div>
      <div class="section-title"><h2>Today's macros</h2><span>${Math.max(0, targets.calories - totals.calories)} calories left</span></div>
      <div class="card">${macroBar("Calories", totals.calories, targets.calories, "", "")}${macroBar("Protein", totals.protein, targets.protein, "g", "blue")}${macroBar("Carbs", totals.carbs, targets.carbs, "g", "green")}${macroBar("Fat", totals.fat, targets.fat, "g", "")}</div>
      <div class="card accent-blue"><div class="row"><div><div class="label">Daily support</div><div style="font-weight:800">${targets.water} oz water · ${targets.fiber} g fiber</div></div><div class="metric blue">4x</div></div><div class="muted small" style="margin-top:6px">Targets update automatically after a weigh-in. Three or more entries use a 7-day average. Split protein across four feedings and put 40-50% of carbs around training.</div></div>
      <div class="section-title"><h2>Quick add</h2><span>editable estimates</span></div>
      <div class="button-row" style="overflow-x:auto">${QUICK_FOODS.map((food, index) => `<button class="button secondary small" style="min-width:120px" data-action="quick-food" data-index="${index}">${esc(food[0])}<br><span class="muted fine">${food[1]} cal</span></button>`).join("")}</div>
      <div class="card" style="margin-top:13px"><div class="field"><label class="label" for="foodName">Food or meal</label><input class="input" id="foodName" maxlength="100" placeholder="Honest estimate"></div>
        <div class="form-grid three"><div class="field"><label class="label" for="foodCalories">Calories</label><input class="input" id="foodCalories" type="number" min="0"></div><div class="field"><label class="label" for="foodProtein">Protein</label><input class="input" id="foodProtein" type="number" min="0"></div><div class="field"><label class="label" for="foodCarbs">Carbs</label><input class="input" id="foodCarbs" type="number" min="0"></div></div>
        <div class="field" style="margin-top:10px"><label class="label" for="foodFat">Fat</label><input class="input" id="foodFat" type="number" min="0"></div><button class="button small" data-action="add-food">Add to today</button></div>
      <div class="section-title"><h2>Today's log</h2><span>${foods.length} items</span></div><div class="card">${foods.length ? foods.map((item, index) => `<div class="food-item"><div><div style="font-weight:700">${esc(item.name)}</div><div class="muted fine">${item.protein}p · ${item.carbs}c · ${item.fat}f</div></div><div class="row"><span class="cond" style="font-size:19px">${item.calories}</span><button class="icon-button" aria-label="Delete ${esc(item.name)}" data-action="delete-food" data-index="${index}">×</button></div></div>`).join("") : `<div class="empty">No food logged yet. The log is data, not a report card.</div>`}</div>`;
  }

  function sparkline(entries, key, color) {
    const data = entries.filter((entry) => Number.isFinite(Number(entry[key]))).slice(-30);
    if (data.length < 2) return `<div class="empty">Log at least two entries to see the trend.</div>`;
    const width = 320, height = 132, pad = 9;
    const values = data.map((item) => Number(item[key]));
    const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
    const points = values.map((value, index) => [pad + index / (values.length - 1) * (width - pad * 2), height - pad - (value - min) / range * (height - pad * 2)]);
    const line = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
    return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend from ${fmt(values[0], 1)} to ${fmt(values[values.length - 1], 1)}"><path d="${line}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="4" fill="${color}"/></svg><div class="row muted fine"><span>${fmt(min, 1)} low</span><span>${fmt(max, 1)} high</span></div>`;
  }

  function renderBody() {
    const averages = L.weeklyAverages(state.weights, L.localISO());
    const score = L.habitScore(state.daily, weekStartISO(), PROGRAM.habits);
    const sortedWaists = [...state.waists].sort((a, b) => a.date.localeCompare(b.date));
    const lastWaist = sortedWaists.at(-1);
    const priorWaist = sortedWaists.at(-2);
    const waistChange = lastWaist && priorWaist ? lastWaist.value - priorWaist.value : 0;
    const advice = L.phaseAdvice(phaseNumber(), averages, score.score, waistChange);
    const recentMeasurements = [...state.measurements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    $("view-body").innerHTML = `<div class="hero"><div class="eyebrow">Sunday check-in · Week ${state.program.currentWeek}</div><h2>The weekly average is the signal</h2>
      <div class="metric-grid"><div class="metric-box"><span class="metric orange">${fmt(averages.current, 1)}</span><div class="label">7-day avg</div></div><div class="metric-box"><span class="metric blue">${lastWaist ? fmt(lastWaist.value, 1) : "-"}</span><div class="label">Waist</div></div><div class="metric-box"><span class="metric green">${score.score}/70</span><div class="label">Habits</div></div></div></div>
      <div class="card accent"><div class="label">Decision tree</div><div style="font-weight:700;margin-top:5px">${esc(advice)}</div><div class="muted fine" style="margin-top:7px">One change at a time, then wait two weeks.</div></div>
      <div class="section-title"><h2>Log check-in</h2><span>same conditions</span></div>
      <div class="card"><div class="form-grid"><div class="field"><label class="label" for="bodyWeight">Bodyweight</label><input class="input" id="bodyWeight" type="number" min="50" max="700" step="0.1"></div><div class="field"><label class="label" for="bodyWaist">Waist at navel</label><input class="input" id="bodyWaist" type="number" min="15" max="90" step="0.1"></div></div><button class="button small" data-action="log-body">Save today's check-in</button></div>
      <div class="section-title"><h2>Weight trend</h2><span>${state.weights.length} entries</span></div><div class="card">${sparkline(state.weights, "value", "#F26B21")}</div>
      <div class="section-title"><h2>Waist trend</h2><span>weekly</span></div><div class="card">${sparkline(state.waists, "value", "#29A9E0")}</div>
      <div class="section-title"><h2>Measurements</h2><span>every 4 weeks</span></div>
      <div class="card"><div class="form-grid three">${["neck", "chest", "waist", "armL", "armR", "thighL", "thighR", "calfL", "calfR"].map((key) => `<div class="field"><label class="label" for="measure-${key}">${key.replace(/([A-Z])/g, " $1")}</label><input class="input measure-input" id="measure-${key}" data-key="${key}" type="number" min="5" max="100" step="0.1"></div>`).join("")}</div><button class="button secondary small" style="margin-top:12px" data-action="save-measurements">Save measurements</button>
      ${recentMeasurements.length ? `<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Date</th><th>Chest</th><th>Waist</th><th>Arms</th><th>Thighs</th></tr></thead><tbody>${recentMeasurements.map((item) => `<tr><td>${esc(item.date.slice(5))}</td><td>${fmt(item.chest, 1)}</td><td>${fmt(item.waist, 1)}</td><td>${fmt(item.armL, 1)}/${fmt(item.armR, 1)}</td><td>${fmt(item.thighL, 1)}/${fmt(item.thighR, 1)}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>`;
  }

  function renderPlan() {
    const p = phase();
    const completedWeeks = Array.from({ length: 36 }, (_, index) => index + 1).filter(weekComplete).length;
    $("view-plan").innerHTML = `${heroProgress()}
      <div class="section-title"><h2>36-week map</h2><span>${completedWeeks} complete</span></div>
      <div class="card"><div class="week-grid">${Array.from({ length: 36 }, (_, index) => index + 1).map((week) => `<button class="week-button ${week === state.program.currentWeek ? "current" : ""} ${weekComplete(week) ? "complete" : ""} ${PROGRAM.deloadWeeks.includes(week) ? "deload" : ""}" data-action="go-week" data-week="${week}">${week}</button>`).join("")}</div><div class="muted fine" style="margin-top:10px">D marks scheduled deloads. Tap any week to review or resume it.</div></div>
      <div class="section-title"><h2>Current phase</h2><span>Phase ${p.number}</span></div>
      <div class="card accent"><div class="label">${esc(p.name)} · Weeks ${esc(p.weeks)}</div><div class="cond" style="font-size:27px;font-weight:800;margin-top:3px">${esc(p.goal)}</div><div class="metric-grid"><div class="metric-box"><span class="metric">${p.steps.toLocaleString()}</span><div class="label">Daily steps</div></div><div class="metric-box"><span class="metric blue">${workouts().length}</span><div class="label">Lift days</div></div><div class="metric-box"><span class="metric green">${p.conditioning.sessions}x</span><div class="label">Conditioning</div></div></div></div>
      <div class="card accent-blue"><div class="row"><div><div style="font-weight:800">Early deload</div><div class="muted small">Half the sets, 60% load, same exercises.</div></div><button class="button secondary inline small" data-action="toggle-deload">${isDeload() ? "Active ✓" : "Apply"}</button></div></div>
      <div class="section-title"><h2>Profile & targets</h2><span>recalculate every 10-12 lb</span></div>
      <div class="card"><div class="form-grid three"><div class="field"><label class="label" for="profileWeight">Weight</label><input class="input" id="profileWeight" type="number" min="80" max="600" step="0.1" value="${state.profile.weight}"></div><div class="field"><label class="label" for="profileHeight">Height</label><input class="input" id="profileHeight" type="number" min="48" max="90" step="0.5" value="${state.profile.heightIn}"></div><div class="field"><label class="label" for="profileAge">Age</label><input class="input" id="profileAge" type="number" min="18" max="90" value="${state.profile.age}"></div></div>
        <div class="form-grid" style="margin-top:10px"><div class="field"><label class="label" for="profileBf">Body fat %</label><input class="input" id="profileBf" type="number" min="3" max="60" step="0.1" value="${state.profile.bodyFat || ""}" placeholder="optional"></div><div class="field"><label class="label" for="profileActivity">Activity</label><select class="input" id="profileActivity"><option value="desk" ${state.profile.activity === "desk" ? "selected" : ""}>Desk job</option><option value="moderate" ${state.profile.activity === "moderate" ? "selected" : ""}>Moderate</option><option value="active" ${state.profile.activity === "active" ? "selected" : ""}>On your feet</option><option value="physical" ${state.profile.activity === "physical" ? "selected" : ""}>Physical job</option></select></div></div>
        <div class="form-grid" style="margin-top:10px"><div class="field"><label class="label" for="upperIncrement">Upper increment</label><select class="input" id="upperIncrement"><option value="5" ${state.profile.upperIncrement === 5 ? "selected" : ""}>5 lb</option><option value="10" ${state.profile.upperIncrement === 10 ? "selected" : ""}>10 lb</option></select></div><div class="field"><label class="label" for="lowerIncrement">Lower increment</label><select class="input" id="lowerIncrement"><option value="10" ${state.profile.lowerIncrement === 10 ? "selected" : ""}>10 lb</option><option value="20" ${state.profile.lowerIncrement === 20 ? "selected" : ""}>20 lb</option></select></div></div>
        <div class="field" style="margin-top:10px"><label class="label" for="buildSplit">Phase 2 schedule</label><select class="input" id="buildSplit"><option value="five" ${state.profile.buildSplit !== "four" ? "selected" : ""}>5-day standard</option><option value="four" ${state.profile.buildSplit === "four" ? "selected" : ""}>4-day recovery variant (+2 sets per exercise)</option></select></div>
        <button class="button small" style="margin-top:12px" data-action="save-profile">Recalculate targets</button></div>
      <div class="section-title"><h2>Backup</h2><span>saved on this device</span></div>
      <div class="card"><div class="muted small" style="margin-bottom:12px">Download a backup before clearing browser data or changing phones. Each browser and hostname has separate storage.</div><div class="button-row"><button class="button secondary small" data-action="download-backup">Download</button><label class="button secondary small" for="restoreFile" style="cursor:pointer">Restore<input id="restoreFile" class="hidden" type="file" accept="application/json"></label></div></div>
      <div class="card"><div class="label">Blueprint access</div><div class="muted small" style="margin-top:5px">This companion tracks the program but does not replace the full blueprint's coaching context, recovery guidance, and nutrition education.</div></div>`;
    $("restoreFile").addEventListener("change", restoreBackup);
  }

  function renderCurrentTab() {
    ({ today: renderToday, train: renderTrain, fuel: renderFuel, body: renderBody, plan: renderPlan })[tab]();
  }

  function refresh() {
    if (!state.onboarded) return renderSetup();
    $("setupView").classList.add("hidden");
    $("appShell").classList.remove("hidden");
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === `view-${tab}`));
    document.querySelectorAll(".bottom-nav button").forEach((button) => {
      const active = button.dataset.tab === tab;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    const title = TITLES[tab];
    $("pageTitle").innerHTML = `${title[0]}<span>${title[1]}</span>`;
    $("phaseText").textContent = `Week ${state.program.currentWeek} - ${phase().name}`;
    renderCurrentTab();
  }

  function selectTab(next) {
    tab = next;
    window.scrollTo({ top: 0, behavior: "auto" });
    refresh();
  }

  function saveDaily() {
    const daily = todayData();
    daily.steps = Math.max(0, Number($("todaySteps").value) || 0);
    daily.sleep = L.clamp(Number($("todaySleep").value) || 0, 0, 24);
    daily.water = Math.max(0, Number($("todayWater").value) || 0);
    const weight = Number($("quickWeight").value);
    const waist = Number($("quickWaist").value);
    if (weight && (weight < 50 || weight > 700)) return toast("Weight must be between 50 and 700 lb.");
    if (waist && (waist < 15 || waist > 90)) return toast("Waist must be between 15 and 90 inches.");
    if (weight) upsertDateValue(state.weights, "value", weight);
    if (waist) upsertDateValue(state.waists, "value", waist);
    saveState("Today's numbers saved");
    refresh();
  }

  function upsertDateValue(list, key, value) {
    const date = L.localISO();
    const found = list.find((item) => item.date === date);
    if (found) found[key] = value; else list.push({ date, [key]: value });
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  function changeWeek(next) {
    state.program.currentWeek = L.clamp(Number(next), 1, 36);
    state.program.selectedWorkout = "";
    saveState();
    refresh();
  }

  function toggleWorkout(workoutId) {
    const key = workoutKey(workoutId);
    if (state.program.completed[key]) delete state.program.completed[key];
    else state.program.completed[key] = { date: L.localISO(), savedAt: Date.now() };
    saveState(state.program.completed[key] ? "Session complete" : "Session reopened");
    refresh();
  }

  function toggleDeload() {
    const week = state.program.currentWeek;
    if (PROGRAM.deloadWeeks.includes(week)) return toast("This is a scheduled deload week.");
    const list = state.program.manualDeloadWeeks;
    state.program.manualDeloadWeeks = list.includes(week) ? list.filter((item) => item !== week) : [...list, week];
    saveState(state.program.manualDeloadWeeks.includes(week) ? "Early deload applied" : "Deload removed");
    refresh();
  }

  function addFood(item) {
    if (!item.name || !(item.calories > 0) || [item.protein, item.carbs, item.fat].some((value) => value < 0)) return toast("Enter a name, calories, and non-negative macros.");
    foodsToday().push({ ...item, name: item.name.slice(0, 100) });
    todayData().habits.foodLog = true;
    saveState("Food added");
    refresh();
  }

  function logBody() {
    const weight = Number($("bodyWeight").value), waist = Number($("bodyWaist").value);
    if (!weight && !waist) return toast("Enter weight or waist.");
    if (weight && (weight < 50 || weight > 700)) return toast("Check the weight entry.");
    if (waist && (waist < 15 || waist > 90)) return toast("Check the waist entry.");
    if (weight) upsertDateValue(state.weights, "value", weight);
    if (waist) upsertDateValue(state.waists, "value", waist);
    saveState(weight ? "Check-in saved — nutrition targets updated" : "Check-in saved");
    refresh();
  }

  function saveMeasurements() {
    const entry = { date: L.localISO(), week: state.program.currentWeek };
    document.querySelectorAll(".measure-input").forEach((input) => { if (Number(input.value)) entry[input.dataset.key] = Number(input.value); });
    if (Object.keys(entry).length === 2) return toast("Enter at least one measurement.");
    if (Object.entries(entry).some(([key, value]) => !["date", "week"].includes(key) && (value < 5 || value > 100))) return toast("Check your measurement values.");
    state.measurements = state.measurements.filter((item) => item.date !== entry.date);
    state.measurements.push(entry);
    saveState("Measurements saved");
    refresh();
  }

  function saveProfile() {
    const weight = Number($("profileWeight").value), height = Number($("profileHeight").value), age = Number($("profileAge").value), bodyFat = Number($("profileBf").value) || null;
    if (weight < 80 || weight > 600 || height < 48 || height > 90 || age < 18 || age > 90 || (bodyFat && (bodyFat < 3 || bodyFat > 60))) return toast("Check your profile values.");
    state.profile = { ...state.profile, weight, heightIn: height, age, bodyFat, activity: $("profileActivity").value, upperIncrement: Number($("upperIncrement").value), lowerIncrement: Number($("lowerIncrement").value), buildSplit: $("buildSplit").value };
    saveState("Targets recalculated");
    refresh();
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `the-rebuild-backup-${L.localISO()}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }

  async function restoreBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || file.size > 5000000) return toast("Choose a backup smaller than 5 MB.");
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.version !== 1 || !data.profile || !data.program) throw new Error("Invalid backup");
      state = normalizeState(data);
      saveState("Backup restored");
      refresh();
    } catch (error) { toast("That is not a valid Rebuild backup."); }
    event.target.value = "";
  }

  document.querySelectorAll(".bottom-nav button").forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab)));
  $("scrim").addEventListener("click", closeSheet);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && sheetContext) closeSheet(); });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "open-next-workout") { state.program.selectedWorkout = button.dataset.id; selectTab("train"); }
    else if (action === "select-workout") { state.program.selectedWorkout = button.dataset.id; saveState(); refresh(); }
    else if (action === "open-exercise") openExercise(button.dataset.workout, button.dataset.exercise);
    else if (action === "close-sheet") closeSheet();
    else if (action === "open-messages") openMessages();
    else if (action === "send-message") sendMessage();
    else if (action === "save-exercise") saveExercise();
    else if (action === "delete-exercise-log") deleteExerciseLog();
    else if (action === "workout-timer-toggle") toggleWorkoutTimer();
    else if (action === "workout-timer-reset") resetWorkoutTimer();
    else if (action === "rest-timer-start") startRestTimer(Number(button.dataset.seconds));
    else if (action === "rest-timer-adjust") adjustRestTimer(Number(button.dataset.seconds));
    else if (action === "rest-timer-cancel") cancelRestTimer();
    else if (action === "toggle-workout") toggleWorkout(button.dataset.id);
    else if (action === "week-back") changeWeek(state.program.currentWeek - 1);
    else if (action === "week-forward" || action === "advance-week") changeWeek(state.program.currentWeek + 1);
    else if (action === "go-week") changeWeek(Number(button.dataset.week));
    else if (action === "toggle-deload") toggleDeload();
    else if (action === "toggle-habit") { const daily = todayData(); daily.habits[button.dataset.key] = !daily.habits[button.dataset.key]; saveState(); refresh(); }
    else if (action === "save-daily") saveDaily();
    else if (action === "toggle-conditioning") { const daily = todayData(); daily.conditioning = daily.conditioning ? 0 : phase().conditioning.minutes; saveState(daily.conditioning ? "Conditioning logged" : "Conditioning removed"); refresh(); }
    else if (action === "quick-food") { const f = QUICK_FOODS[Number(button.dataset.index)]; addFood({ name: f[0], calories: f[1], protein: f[2], carbs: f[3], fat: f[4] }); }
    else if (action === "add-food") addFood({ name: $("foodName").value.trim(), calories: Number($("foodCalories").value), protein: Number($("foodProtein").value) || 0, carbs: Number($("foodCarbs").value) || 0, fat: Number($("foodFat").value) || 0 });
    else if (action === "delete-food") { foodsToday().splice(Number(button.dataset.index), 1); saveState("Food removed"); refresh(); }
    else if (action === "log-body") logBody();
    else if (action === "save-measurements") saveMeasurements();
    else if (action === "save-profile") saveProfile();
    else if (action === "download-backup") downloadBackup();
  });

  window.addEventListener("pagehide", () => {
    try { if (STORAGE_KEY) localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { console.warn("Local progress save failed", error); }
    void syncRemoteState(true);
  });

  async function initialize() {
    try {
      const [program, remote] = await Promise.all([
        protectedJson("/api/program"),
        protectedJson("/api/state")
      ]);
      void loadMessages();
      PROGRAM = program;
      // Supabase is authoritative: an account with saved remote progress always wins over
      // whatever sits in this browser's local storage, so a device that was previously used
      // by a different account (or reused after a password reset) can never surface stale
      // local data for this session. Local storage is only a same-account offline cache and
      // an upload buffer for the brief window before the first sync completes.
      const local = loadState();
      state = remote.state ? normalizeState(remote.state) : local;
      remoteSyncReady = true;
      if (!remote.state && STORAGE_KEY && localStorage.getItem(STORAGE_KEY)) scheduleRemoteSync();
      refresh();
      updateTimerDisplays();
    } catch (error) {
      console.error("The protected tracker could not start", error);
      const setup = $("setupView");
      setup.classList.remove("hidden");
      setup.innerHTML = '<div class="card"><h2>Unable to load your tracker</h2><p class="muted">Check your connection, then refresh this page.</p><button class="primary" onclick="location.reload()">Try again</button></div>';
    }
  }

  void initialize();
  window.setInterval(updateTimerDisplays, 250);
  document.addEventListener("visibilitychange", updateTimerDisplays);
})();
