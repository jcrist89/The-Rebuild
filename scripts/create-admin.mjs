import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normalizeUsername(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 32);
}

function generatePassword() {
  const groups = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%+-_"];
  const alphabet = groups.join("");
  const characters = groups.map((group) => group[randomInt(group.length)]);
  characters.push(...Array.from(randomBytes(12), (byte) => alphabet[byte % alphabet.length]));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const username = normalizeUsername(argument("username") || "jon");
const displayName = (argument("name") || "Jon Crist Fit Owner").trim();
const password = argument("password") || generatePassword();

if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required in .env.local");
if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw new Error("Use a username with 3-32 letters, numbers, dots, underscores, or hyphens");
if (password.length < 12) throw new Error("The admin password must contain at least 12 characters");

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: existing } = await admin.from("reacher_accounts").select("user_id").eq("username", username).maybeSingle();
if (existing) throw new Error(`The username ${username} already exists`);

const authEmail = `${randomUUID().replaceAll("-", "")}@accounts.reacher-build.invalid`;
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email: authEmail,
  password,
  email_confirm: true,
  user_metadata: { display_name: displayName },
  app_metadata: { role: "reacher_admin", product: "REACHER_BUILD" },
});
if (createError || !created.user) throw new Error(createError?.message || "Supabase did not create the admin user");

const { error: insertError } = await admin.from("reacher_accounts").insert({
  user_id: created.user.id,
  username,
  auth_email: authEmail,
  display_name: displayName,
  role: "admin",
  status: "active",
  must_change_password: true,
});
if (insertError) {
  await admin.auth.admin.deleteUser(created.user.id);
  throw new Error(insertError.message);
}

console.log("Owner account created. Copy these credentials now; the temporary password is not stored in the app.");
console.log(`Username: ${username}`);
console.log(`Temporary password: ${password}`);
