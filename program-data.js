(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  root.REACHER_PROGRAM = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ex = (id, name, tag, sets, min, max, rpe, rest, notes, group, category, unit) => ({
    id, name, tag, sets, min, max, rpe, rest, notes,
    group: group || "",
    category: category || "upper",
    unit: unit || "reps",
  });

  const phase1 = [
    {
      id: "strip-upper-a", name: "Upper A", subtitle: "Push emphasis", day: "Monday",
      exercises: [
        ex("barbell-bench", "Barbell bench press", "S", 4, 4, 6, "7-8", "3 min", "Elbows 45 degrees, touch lower chest, drive feet into floor."),
        ex("weighted-pullup", "Weighted pull-up (or lat pulldown)", "S", 4, 5, 7, "8", "3 min", "Chest to bar, no kip, full hang at bottom."),
        ex("seated-db-press", "Seated dumbbell shoulder press", "T", 3, 8, 10, "8-9", "2 min", "Stop 1 inch short of lockout to keep delts loaded."),
        ex("chest-supported-row", "Chest-supported row", "T", 3, 10, 12, "8-9", "2 min", "Pull to lower ribs, 1-second squeeze."),
        ex("cable-lateral", "Cable lateral raise", "D", 3, 15, 20, "9-10", "60 sec", "Lead with the elbow, no shrugging.", "A1"),
        ex("overhead-cable-triceps", "Overhead cable triceps extension", "D", 3, 12, 15, "9", "60 sec", "Full stretch overhead, elbows tight.", "A2"),
        ex("neck-extension", "Neck harness or plate neck extension", "D", 2, 15, 20, "8", "60 sec", "Slow. No jerking. Start with 10 lb.")
      ]
    },
    {
      id: "strip-lower-a", name: "Lower A", subtitle: "Squat emphasis", day: "Tuesday",
      exercises: [
        ex("back-squat", "Back squat", "S", 4, 4, 6, "7-8", "3 min", "Break at hips and knees together, depth below parallel.", "", "lower"),
        ex("romanian-deadlift", "Romanian deadlift", "T", 3, 8, 10, "8", "2 min", "Bar stays on the legs; stop at the full hamstring stretch.", "", "lower"),
        ex("walking-lunge", "Walking lunge", "T", 3, 10, 12, "8-9", "2 min", "Long stride, torso upright. Reps are per leg.", "", "lower"),
        ex("leg-curl", "Leg curl", "D", 3, 12, 15, "9-10", "75 sec", "3-second lowering, no hip lift.", "", "lower"),
        ex("standing-calf", "Standing calf raise", "D", 4, 12, 15, "9-10", "60 sec", "2-second pause at the bottom stretch.", "", "lower"),
        ex("hanging-leg-raise", "Hanging leg raise", "D", 3, 12, 15, "9", "60 sec", "Curl the pelvis; do not swing the legs.", "", "lower")
      ]
    },
    {
      id: "strip-upper-b", name: "Upper B", subtitle: "Pull emphasis", day: "Thursday",
      exercises: [
        ex("barbell-overhead", "Barbell overhead press", "S", 4, 4, 6, "7-8", "3 min", "Squeeze glutes, ribs down, head through at lockout."),
        ex("barbell-row", "Barbell row (Pendlay or bent)", "S", 4, 6, 8, "8", "3 min", "Torso near parallel, pull to the navel."),
        ex("incline-db-press", "Incline dumbbell press", "T", 3, 8, 10, "8-9", "2 min", "30-degree bench, deep stretch at the bottom."),
        ex("single-arm-pulldown", "Single-arm lat pulldown", "T", 3, 10, 12, "9", "90 sec", "Let the shoulder blade rise at the top; reps per side."),
        ex("reverse-pec-deck", "Reverse pec deck", "D", 3, 15, 20, "10", "60 sec", "Thumbs back, squeeze the rear delts.", "B1"),
        ex("incline-db-curl", "Incline dumbbell curl", "D", 3, 10, 12, "9", "60 sec", "Full stretch behind the torso.", "B2"),
        ex("farmers-carry", "Farmer's carry", "D", 3, 40, 40, "9", "75 sec", "Heaviest dumbbells you can hold. Traps and grip.", "", "upper", "yd")
      ]
    },
    {
      id: "strip-lower-b", name: "Lower B", subtitle: "Hinge emphasis", day: "Friday",
      exercises: [
        ex("conventional-deadlift", "Conventional deadlift", "S", 4, 3, 5, "7-8", "3 min", "Reset every rep. Wedge before you pull.", "", "lower"),
        ex("front-or-hack-squat", "Front squat or hack squat", "T", 3, 8, 10, "8", "2 min", "Upright torso, controlled descent.", "", "lower"),
        ex("bulgarian-split-squat", "Bulgarian split squat", "T", 3, 8, 10, "8-9", "90 sec", "Front foot flat, lean 15 degrees forward; reps per leg.", "", "lower"),
        ex("barbell-shrug", "Barbell shrug", "D", 4, 12, 15, "9-10", "75 sec", "Straight up, 2-second hold at the top."),
        ex("seated-calf", "Seated calf raise", "D", 4, 15, 20, "10", "60 sec", "Soleus work - this is what widens the lower leg.", "", "lower"),
        ex("cable-crunch", "Cable crunch", "D", 3, 15, 20, "9", "60 sec", "Round the spine; do not hinge at the hip.")
      ]
    }
  ];

  const phase2 = [
    {
      id: "build-push", name: "Push", subtitle: "Chest, delts, and triceps", day: "Monday",
      exercises: [
        ex("barbell-bench", "Barbell bench press", "S", 5, 4, 6, "8", "3 min", "Primary strength driver. Add weight when all 5 sets hit 6."),
        ex("incline-db-press", "Incline dumbbell press", "T", 4, 8, 10, "8-9", "2 min", "Upper chest is the shelf under the collarbone."),
        ex("seated-db-press", "Seated dumbbell shoulder press", "T", 4, 8, 12, "9", "2 min", "Last set: drop 30% and rep to failure."),
        ex("weighted-dip", "Weighted dip", "T", 3, 8, 10, "8-9", "2 min", "Slight forward lean. Stop if the front of the shoulder pinches."),
        ex("cable-lateral", "Cable lateral raise", "D", 4, 15, 20, "10", "60 sec", "Highest-value delt exercise in the program."),
        ex("rope-pushdown", "Rope triceps pushdown", "D", 3, 12, 15, "10", "60 sec", "Spread the rope at lockout."),
        ex("neck-both", "Neck extension + flexion", "D", 2, 15, 15, "8", "60 sec", "Both directions. Build slowly over months.")
      ]
    },
    {
      id: "build-pull", name: "Pull", subtitle: "Back width, thickness, and arms", day: "Tuesday",
      exercises: [
        ex("weighted-pullup", "Weighted pull-up", "S", 4, 5, 7, "8", "3 min", "Add 5 lb when you hit 7 on all sets."),
        ex("barbell-row", "Barbell row", "S", 4, 6, 8, "8", "3 min", "Strict. Torso does not rise as you pull."),
        ex("tbar-row", "Chest-supported T-bar row", "T", 4, 10, 12, "9", "2 min", "Pause 1 second at the chest every rep."),
        ex("straight-arm-pulldown", "Straight-arm pulldown", "T", 3, 12, 15, "9", "90 sec", "Lats only, elbows locked soft."),
        ex("dumbbell-shrug", "Dumbbell shrug", "D", 4, 12, 15, "10", "75 sec", "Heavy. Traps frame the neck."),
        ex("face-pull", "Face pull", "D", 4, 15, 20, "9", "60 sec", "High elbows, pull to the forehead."),
        ex("hammer-curl", "Hammer curl", "D", 3, 10, 12, "9-10", "60 sec", "Builds the brachialis - arm width, not just peak.")
      ]
    },
    {
      id: "build-legs", name: "Legs", subtitle: "The base of the build", day: "Wednesday",
      exercises: [
        ex("back-squat", "Back squat", "S", 5, 4, 6, "8", "3 min", "The base of the whole build.", "", "lower"),
        ex("romanian-deadlift", "Romanian deadlift", "T", 4, 8, 10, "8", "2 min", "Hamstrings and glutes, not lower back.", "", "lower"),
        ex("leg-press", "Leg press", "T", 3, 12, 15, "9", "2 min", "Feet mid-platform, knees track over toes.", "", "lower"),
        ex("leg-extension", "Leg extension", "D", 3, 15, 20, "10", "60 sec", "2-second squeeze at lockout.", "", "lower"),
        ex("seated-leg-curl", "Seated leg curl", "D", 3, 12, 15, "10", "60 sec", "Seated beats lying for hamstring growth.", "", "lower"),
        ex("standing-calf", "Standing calf raise", "D", 5, 12, 15, "10", "60 sec", "Pause 2 seconds stretched, 1 second contracted.", "", "lower")
      ]
    },
    {
      id: "build-delts-arms", name: "Delts + Arms", subtitle: "The silhouette day", day: "Thursday",
      exercises: [
        ex("seated-barbell-press", "Seated barbell overhead press", "S", 4, 5, 7, "8", "3 min", "Only pressing of the day - go after it."),
        ex("db-lateral", "Dumbbell lateral raise", "T", 4, 10, 12, "9", "75 sec", "Slight forward lean, pinky slightly high.", "A1"),
        ex("reverse-pec-deck", "Reverse pec deck", "T", 4, 12, 15, "9-10", "75 sec", "Rear delts are the most under-trained muscle.", "A2"),
        ex("single-cable-lateral", "Cable lateral raise (single-arm)", "D", 3, 15, 20, "10", "60 sec", "Constant tension through the full arc."),
        ex("close-grip-bench", "Close-grip bench press", "T", 4, 8, 10, "8-9", "90 sec", "Hands shoulder-width, elbows tucked.", "B1"),
        ex("barbell-ez-curl", "Barbell or EZ curl", "T", 4, 8, 10, "9", "90 sec", "No swinging. Elbows pinned.", "B2"),
        ex("overhead-rope", "Overhead rope extension", "D", 3, 12, 15, "10", "60 sec", "Long head of the triceps - arm thickness.", "C1"),
        ex("cable-curl", "Cable curl", "D", 3, 12, 15, "10", "60 sec", "Last set: 10 partials after failure.", "C2"),
        ex("wrist-roller", "Wrist roller or plate pinch", "D", 3, 45, 45, "9", "60 sec", "Forearms show in every short sleeve.", "", "upper", "sec")
      ]
    },
    {
      id: "build-back-chest", name: "Back + Chest", subtitle: "Second heavy upper exposure", day: "Friday",
      exercises: [
        ex("rack-pull", "Rack pull (below knee)", "S", 4, 5, 6, "8", "3 min", "Straps allowed. Traps and upper back thickness.", "", "lower"),
        ex("incline-barbell", "Incline barbell press", "S", 4, 6, 8, "8", "3 min", "Second heavy chest exposure of the week."),
        ex("wide-lat-pulldown", "Wide-grip lat pulldown", "T", 4, 10, 12, "9", "2 min", "Drive elbows down and back, chest tall."),
        ex("seated-cable-row", "Seated cable row (neutral grip)", "T", 4, 10, 12, "9", "2 min", "Squeeze 1 second; control the return for 3 seconds."),
        ex("low-high-cable-fly", "Cable fly (low to high)", "D", 3, 12, 15, "10", "60 sec", "Upper chest sweep."),
        ex("db-pullover", "Dumbbell pullover", "D", 3, 12, 15, "9", "60 sec", "Deep stretch. Ribcage and lats."),
        ex("weighted-plank", "Weighted plank", "D", 3, 45, 45, "9", "60 sec", "Brace, do not sag. Add a plate on the back.", "", "upper", "sec")
      ]
    }
  ];

  const substitutions = {
    "barbell-bench": ["Dumbbell bench press", "Machine chest press", "Weighted push-up, feet elevated"],
    "back-squat": ["Hack squat", "Safety-bar squat", "Goblet squat, 3-sec down"],
    "conventional-deadlift": ["Trap-bar deadlift", "Rack pull", "Single-leg RDL with dumbbells"],
    "weighted-pullup": ["Lat pulldown", "Assisted pull-up machine", "Band-assisted pull-up"],
    "barbell-row": ["Chest-supported row", "Single-arm dumbbell row", "Inverted row under a table or bar"],
    "barbell-overhead": ["Seated dumbbell press", "Machine shoulder press", "Pike push-up"],
    "seated-barbell-press": ["Seated dumbbell press", "Machine shoulder press", "Pike push-up"],
    "cable-lateral": ["Dumbbell lateral raise", "Machine lateral raise", "Band lateral raise"],
    "single-cable-lateral": ["Dumbbell lateral raise", "Machine lateral raise", "Band lateral raise"],
    "leg-curl": ["Nordic curl", "Stability-ball curl", "Slider hamstring curl"],
    "seated-leg-curl": ["Nordic curl", "Stability-ball curl", "Slider hamstring curl"],
    "weighted-dip": ["Close-grip bench", "Machine dip", "Bench dip, feet elevated"]
  };

  const phases = {
    1: {
      number: 1, key: "strip", name: "Strip", weeks: "1-12", color: "orange",
      goal: "Reach 12-14% body fat while keeping every pound of muscle.",
      calories: 0.78, change: "Down 0.7-1.0% of bodyweight per week",
      steps: 12000, conditioning: { sessions: 2, minutes: 20, label: "Incline walk or conversational bike" },
      workouts: phase1
    },
    2: {
      number: 2, key: "build", name: "Build", weeks: "13-32", color: "blue",
      goal: "Add 8-14 lb of muscle while keeping the waist within one inch.",
      calories: 1.10, change: "Up 0.25-0.5 lb per week",
      steps: 8000, conditioning: { sessions: 1, minutes: 25, label: "Zone 2, nose-breathing pace" },
      workouts: phase2
    },
    3: {
      number: 3, key: "refine", name: "Refine", weeks: "33-36+", color: "green",
      goal: "Strip the final 3-5% while holding the loads earned in Build.",
      calories: 0.85, change: "Down 0.5-0.75% of bodyweight per week",
      steps: 12000, conditioning: { sessions: 2, minutes: 25, label: "One steady session and one interval session" },
      workouts: [
        { ...phase1[0], id: "refine-upper-power", name: "Upper Power", day: "Monday" },
        { ...phase1[1], id: "refine-lower-power", name: "Lower Power", day: "Tuesday" },
        { ...phase2[3], id: "refine-delts-arms", name: "Delts + Arms", day: "Wednesday" },
        { ...phase1[2], id: "refine-upper-pump", name: "Upper Pump", day: "Thursday" },
        { ...phase1[3], id: "refine-lower-pump", name: "Lower Pump + Conditioning", day: "Friday" }
      ]
    }
  };

  return {
    title: "The Reacher Build",
    weeks: 36,
    deloadWeeks: [6, 12, 18, 24, 30],
    phases,
    substitutions,
    tags: {
      S: { name: "Strength", cue: "3-6 reps, RPE 7-8, 3 min rest. Move the bar with intent and leave 2-3 reps in reserve." },
      T: { name: "Tension", cue: "8-12 reps, RPE 8-9, 2 min rest. Use a 3-second lowering phase, full stretch, and no bounce." },
      D: { name: "Development", cue: "12-20 reps, RPE 9-10, 60-90 sec rest. Controlled isolation work taken close to failure." }
    },
    warmup: [
      ["Bike, row, or brisk incline walk", "3 min"],
      ["Band pull-aparts", "2 x 20"],
      ["Dead hang", "1 x 30 sec"],
      ["90/90 hip switches on lower days", "10 per side"],
      ["First-exercise ramping sets", "40% x 8, 60% x 5, 80% x 3"]
    ],
    habits: ["calories", "protein", "water", "steps", "sleep", "movement", "morningLight", "caffeine", "foodLog", "recovery"],
    habitLabels: {
      calories: "Hit calorie target", protein: "Hit protein target", water: "Water target", steps: "Step target",
      sleep: "7+ hours sleep", movement: "Training or walk", morningLight: "Morning light",
      caffeine: "Caffeine cutoff", foodLog: "Logged food", recovery: "Decompression + mobility"
    }
  };
});
