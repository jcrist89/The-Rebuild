import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("the protected program is not stored in the public directory", () => {
  assert.equal(existsSync("public/program-data.js"), false);
  assert.equal(existsSync("program-data.js"), true);
});

test("the browser requests protected data and progress through authenticated APIs", () => {
  const source = readFileSync("public/tracker.js", "utf8");
  assert.match(source, /protectedJson\("\/api\/program"\)/);
  assert.match(source, /protectedJson\("\/api\/state"\)/);
  assert.doesNotMatch(source, /register\("\/sw\.js"\)/);
});

test("Stripe checkout and webhook code have been removed", () => {
  assert.equal(existsSync("src/app/api/checkout/route.ts"), false);
  assert.equal(existsSync("src/app/api/stripe/webhook/route.ts"), false);
  assert.equal(existsSync("src/lib/stripe.ts"), false);
  const packageJson = readFileSync("package.json", "utf8");
  assert.doesNotMatch(packageJson, /"stripe"/);
});

test("username login uses Supabase password authentication without public signup", () => {
  const source = readFileSync("src/app/login/actions.ts", "utf8");
  assert.match(source, /reacher_accounts/);
  assert.match(source, /signInWithPassword/);
  assert.doesNotMatch(source, /signUp|signInWithOtp/);
});

test("temporary passwords must be replaced and are never inserted into the account table", () => {
  const adminSource = readFileSync("src/app/admin/actions.ts", "utf8");
  const passwordSource = readFileSync("src/app/account/password/actions.ts", "utf8");
  assert.match(adminSource, /auth\.admin\.createUser/);
  assert.match(adminSource, /must_change_password: true/);
  const accountInsert = adminSource.slice(adminSource.indexOf('.from("reacher_accounts").insert({'), adminSource.indexOf("});", adminSource.indexOf('.from("reacher_accounts").insert({')));
  assert.doesNotMatch(accountInsert, /^\s*password\s*:/m);
  assert.match(passwordSource, /current_password/);
  assert.match(passwordSource, /must_change_password: false/);
});
