import assert from "node:assert/strict";
import "./public/logic.js";
import program from "./program-data.js";

const logic = globalThis.RebuildLogic;

assert.equal(logic.phaseForWeek(1), 1);
assert.equal(logic.phaseForWeek(12), 1);
assert.equal(logic.phaseForWeek(13), 2);
assert.equal(logic.phaseForWeek(32), 2);
assert.equal(logic.phaseForWeek(33), 3);
assert.equal(logic.phaseForWeek(36), 3);

assert.equal(logic.scheduledDeload(6, []), true);
assert.equal(logic.scheduledDeload(7, [7]), true);
assert.equal(logic.scheduledDeload(7, []), false);

const development = { id: "x", name: "Raise", tag: "D", sets: 4, min: 12, max: 15, category: "upper" };
assert.equal(logic.effectiveExercise(development, 3, false).sets, 3);
assert.equal(logic.effectiveExercise(development, 3, true).sets, 2);

const logs = [{
  exerciseId: "x", actualName: "Raise", date: "2026-09-01", savedAt: 1,
  sets: [{ weight: 20, reps: 15 }, { weight: 20, reps: 15 }, { weight: 20, reps: 15 }, { weight: 20, reps: 15 }]
}];
assert.deepEqual(
  logic.progressionSuggestion(logs, development, "Raise", { upper: 5, lower: 10 }, false, 2),
  { weight: 25, action: "up", note: "Every set reached 15. Add 5 lb and return to the bottom of the range." }
);
assert.equal(logic.progressionSuggestion(logs, development, "Raise", { upper: 5, lower: 10 }, true, 2).weight, 12);
assert.equal(logic.progressionSuggestion(logs, development, "Raise", { upper: 5, lower: 10 }, false, 1).weight, 20);

const targets = logic.nutritionTargets({ weight: 220, heightIn: 72, age: 35, sex: "male", activity: "moderate", bodyFat: null }, 1, false);
assert.ok(targets.maintenance >= 3000 && targets.maintenance <= 3070);
assert.ok(targets.calories >= 2340 && targets.calories <= 2400);
assert.equal(targets.protein, 220);
assert.equal(targets.fat, 77);

const nutritionWeight = logic.nutritionWeight([
  { date: "2026-09-01", value: 220 },
  { date: "2026-09-02", value: 218 },
  { date: "2026-09-03", value: 216 }
], 225, "2026-09-03");
assert.deepEqual(nutritionWeight, { weight: 218, label: "7-day average", count: 3 });
assert.equal(logic.nutritionWeight([{ date: "2026-09-03", value: 210 }], 225, "2026-09-03").weight, 210);
assert.equal(logic.nutritionTargets({ weight: 220, heightIn: 72, age: 35, sex: "male", activity: "moderate" }, 1, false, 200).protein, 200);
assert.equal(logic.restSeconds("60 seconds between paired exercises"), 60);
assert.equal(logic.restSeconds("90-120 sec"), 120);
assert.equal(logic.restSeconds("2 min"), 120);
assert.equal(logic.formatTimer(90500, false), "01:30");
assert.equal(logic.formatTimer(3723000, true), "01:02:03");

const averages = logic.weeklyAverages([
  ...Array.from({ length: 7 }, (_, i) => ({ date: `2026-08-${String(25 + i).padStart(2, "0")}`, value: 200 })),
  ...Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-${String(1 + i).padStart(2, "0")}`, value: 198 }))
], "2026-09-07");
assert.equal(averages.current, 198);
assert.equal(averages.previous, 200);
assert.equal(averages.change, -2);

assert.deepEqual(Object.keys(program.phases).map(Number), [1, 2, 3]);
assert.equal(program.phases[1].workouts.length, 4);
assert.equal(program.phases[2].workouts.length, 5);
assert.equal(program.phases[3].workouts.length, 5);
assert.deepEqual(program.deloadWeeks, [6, 12, 18, 24, 30]);
assert.equal(program.phases[1].workouts[0].exercises[0].name, "Barbell bench press");
assert.equal(program.phases[2].workouts[4].exercises.at(-1).name, "Weighted plank");

console.log("All Reacher Build logic and program-data checks passed.");
