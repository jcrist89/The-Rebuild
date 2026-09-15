(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RebuildLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const round = (value, digits = 0) => {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  };
  const localISO = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const parseLocalDate = (iso) => {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  };
  const daysBetween = (fromISO, toISO) => {
    const a = parseLocalDate(fromISO);
    const b = parseLocalDate(toISO);
    if (!a || !b) return 0;
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  };

  function phaseForWeek(week) {
    const value = Number(week) || 1;
    if (value <= 12) return 1;
    if (value <= 32) return 2;
    return 3;
  }

  function scheduledDeload(week, manualWeeks) {
    const scheduled = [6, 12, 18, 24, 30].includes(Number(week));
    const manual = Array.isArray(manualWeeks) && manualWeeks.map(Number).includes(Number(week));
    return scheduled || manual;
  }

  function effectiveExercise(exercise, phase, isDeload) {
    let sets = Number(exercise.sets) || 1;
    if (Number(phase) === 3 && exercise.tag === "D") sets = Math.max(1, sets - 1);
    if (isDeload) sets = Math.max(1, Math.ceil(sets / 2));
    return { ...exercise, sets, deload: Boolean(isDeload), loadFactor: isDeload ? 0.6 : 1 };
  }

  function progressionSuggestion(logs, exercise, actualName, increments, isDeload, phaseNumber) {
    const matching = (Array.isArray(logs) ? logs : [])
      .filter((log) => log.exerciseId === exercise.id && (log.actualName || exercise.name) === actualName)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(a.savedAt || 0) - Number(b.savedAt || 0));
    const last = matching[matching.length - 1];
    if (!last) return { weight: null, action: "start", note: "Choose a load with about 2 reps in reserve." };

    const workingSets = (last.sets || []).filter((set) => Number(set.reps) > 0 && Number(set.weight) > 0);
    if (!workingSets.length) return { weight: null, action: "start", note: "Enter a working weight to begin progression." };
    const lastWeight = Number(workingSets[workingSets.length - 1].weight);
    if (isDeload) return { weight: round(lastWeight * 0.6, 1), action: "deload", note: "Deload: half the sets at about 60% of the last load." };

    const completedAll = workingSets.length >= Number(exercise.sets);
    const toppedRange = completedAll && workingSets.slice(0, exercise.sets).every((set) => Number(set.reps) >= Number(exercise.max));
    if (toppedRange) {
      if (Number(phaseNumber) === 1 || Number(phaseNumber) === 3) {
        return { weight: lastWeight, action: "hold", note: "Top of the range reached. Hold this load through the cut; keep reps and execution clean." };
      }
      const increment = exercise.category === "lower" ? Number(increments.lower || 10) : Number(increments.upper || 5);
      return { weight: round(lastWeight + increment, 1), action: "up", note: `Every set reached ${exercise.max}. Add ${increment} lb and return to the bottom of the range.` };
    }
    return { weight: lastWeight, action: "hold", note: `Keep the load and build every set toward ${exercise.max}.` };
  }

  function maintenanceCalories(profile) {
    const weightLb = Number(profile.weight) || 0;
    const heightIn = Number(profile.heightIn) || 0;
    const age = Number(profile.age) || 35;
    if (!weightLb || !heightIn) return 0;
    const kg = weightLb * 0.45359237;
    const cm = heightIn * 2.54;
    let bmr;
    if (Number(profile.bodyFat) > 0 && Number(profile.bodyFat) < 70) {
      const leanKg = kg * (1 - Number(profile.bodyFat) / 100);
      bmr = 370 + 21.6 * leanKg;
    } else {
      bmr = 10 * kg + 6.25 * cm - 5 * age + (profile.sex === "female" ? -161 : 5);
    }
    const factors = { desk: 1.395, moderate: 1.55, active: 1.705, physical: 1.86 };
    return Math.round(bmr * (factors[profile.activity] || factors.moderate) / 10) * 10;
  }

  function nutritionWeight(weights, fallbackWeight, endISO) {
    const recent = entriesInDateWindow(weights, endISO || localISO(), 7, "value");
    if (recent.length >= 3) {
      return { weight: round(average(recent, "value"), 1), label: "7-day average", count: recent.length };
    }
    const latest = (Array.isArray(weights) ? weights : [])
      .filter((entry) => Number.isFinite(Number(entry.value)) && Number(entry.value) > 0)
      .filter((entry) => !endISO || String(entry.date) <= endISO)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .at(-1);
    if (latest) return { weight: round(Number(latest.value), 1), label: "latest check-in", count: 1 };
    return { weight: round(Number(fallbackWeight) || 0, 1), label: "starting weight", count: 0 };
  }

  function nutritionTargets(profile, phaseNumber, trainingDay, weightOverride) {
    const weight = Number(weightOverride) || Number(profile.weight) || 0;
    const nutritionProfile = { ...profile, weight };
    const maintenance = maintenanceCalories(nutritionProfile);
    const phaseFactor = { 1: 0.78, 2: 1.10, 3: 0.85 }[Number(phaseNumber)] || 1;
    const calories = Math.round((maintenance * phaseFactor) / 10) * 10;
    const bodyFat = Number(nutritionProfile.bodyFat);
    const leanMass = bodyFat > 0 && bodyFat < 70 ? weight * (1 - bodyFat / 100) : null;
    const protein = Math.round(leanMass ? leanMass * 1.1 : weight);
    const fat = Math.round(weight * (Number(phaseNumber) === 2 ? 0.4 : 0.35));
    const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    const fiber = Math.round(calories / 1000 * 14);
    const water = Math.round(weight * 0.66 + (trainingDay ? 20 : 0));
    return { maintenance, calories, protein, fat, carbs, fiber, water, weight };
  }

  function restSeconds(restText) {
    const text = String(restText || "").toLowerCase();
    const values = (text.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
    if (!values.length) return 90;
    const seconds = Math.max(...values) * (/\bmin/.test(text) ? 60 : 1);
    return clamp(Math.round(seconds), 15, 600);
  }

  function setEntryComplete(weightValue, repsValue) {
    const weightText = String(weightValue ?? "").trim();
    const repsText = String(repsValue ?? "").trim();
    if (!weightText || !repsText) return false;
    const weight = Number(weightText);
    const reps = Number(repsText);
    return Number.isFinite(weight) && weight >= 0 && Number.isFinite(reps) && reps > 0;
  }

  function formatTimer(milliseconds, showHours) {
    const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000) || 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    if (showHours || hours) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function entriesInDateWindow(entries, endISO, days, valueKey) {
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => {
        const delta = daysBetween(entry.date, endISO);
        return delta >= 0 && delta < days && Number.isFinite(Number(entry[valueKey]));
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function average(entries, valueKey) {
    if (!entries.length) return null;
    return entries.reduce((sum, entry) => sum + Number(entry[valueKey]), 0) / entries.length;
  }

  function weeklyAverages(weights, endISO) {
    const end = endISO || localISO();
    const current = entriesInDateWindow(weights, end, 7, "value");
    const priorEndDate = parseLocalDate(end);
    priorEndDate.setDate(priorEndDate.getDate() - 7);
    const prior = entriesInDateWindow(weights, localISO(priorEndDate), 7, "value");
    return {
      current: average(current, "value"),
      previous: average(prior, "value"),
      currentCount: current.length,
      previousCount: prior.length,
      change: current.length && prior.length ? average(current, "value") - average(prior, "value") : null
    };
  }

  function habitScore(daily, weekStartISO, habitKeys) {
    let score = 0;
    const byDay = [];
    const start = parseLocalDate(weekStartISO);
    if (!start) return { score: 0, possible: 70, byDay: [] };
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const iso = localISO(date);
      const habits = (daily && daily[iso] && daily[iso].habits) || {};
      const count = habitKeys.filter((key) => Boolean(habits[key])).length;
      score += count;
      byDay.push({ date: iso, count });
    }
    return { score, possible: habitKeys.length * 7, byDay };
  }

  function phaseAdvice(phase, averages, habitScoreValue, waistChange) {
    if (averages.current == null || averages.previous == null) return "Log daily weight for two full weeks before changing the plan.";
    const change = averages.change;
    const previous = averages.previous || 1;
    const pct = change / previous * 100;
    if (Number(waistChange) < 0 && change > 0) return "Weight is up while waist is down. Keep going - that is recomposition.";
    if (Math.abs(change) >= 3) return "A sudden 3-5 lb change is usually water. Wait a week before reacting.";
    if (Number(phase) === 1) {
      if (pct <= -0.7 && pct >= -1.0) return "The Strip rate is on target. Change nothing.";
      if (pct < -1.2) return "Loss is faster than 1.2%. If lifts are dropping, add about 200 calories.";
      if (Math.abs(pct) < 0.2 && habitScoreValue < 55) return "Hold calories. Bring adherence above 55/70 first.";
      if (Math.abs(pct) < 0.2) return "If this is the second flat week, cut 150-200 calories or add 1,500 daily steps - not both.";
    }
    if (Number(phase) === 2) {
      if (change >= 0.25 && change <= 0.5) return "The Build rate is on target. Change nothing.";
      if (change > 0.75 || Number(waistChange) >= 0.5) return "Gain is above the ceiling. Reduce about 200 calories.";
      if (Math.abs(change) < 0.15) return "If this is the second flat week, add about 200 calories, mostly carbs.";
    }
    if (Number(phase) === 3 && pct <= -0.5 && pct >= -0.75) return "The Refine rate is on target. Hold the plan.";
    return "Hold the plan another week. Change one variable at a time, then wait two weeks.";
  }

  return {
    clamp, round, localISO, parseLocalDate, daysBetween, phaseForWeek, scheduledDeload,
    effectiveExercise, progressionSuggestion, maintenanceCalories, nutritionWeight, nutritionTargets,
    restSeconds, setEntryComplete, formatTimer,
    entriesInDateWindow, weeklyAverages, habitScore, phaseAdvice
  };
});
