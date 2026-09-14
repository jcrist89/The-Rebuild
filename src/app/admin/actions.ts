"use server";

import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedUser, getReacherAccount } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CredentialState = {
  error?: string;
  credentials?: { username: string; password: string; displayName: string };
};

const createSchema = z.object({
  displayName: z.string().trim().min(2, "Enter the buyer's name").max(80),
  username: z.string().trim().max(32).optional(),
});

const accountIdSchema = z.string().uuid();
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const passwordAlphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%+-_";

async function requireAdmin() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const account = await getReacherAccount(user.id);
  if (!account || account.status !== "active" || account.role !== "admin") redirect("/");
  return { user, account };
}

function normalizeUsername(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24);
}

function generatePassword() {
  const required = [
    "abcdefghijkmnopqrstuvwxyz"[randomInt(25)],
    "ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(24)],
    "23456789"[randomInt(8)],
    "!@#$%+-_"[randomInt(8)],
  ];
  const extra = Array.from(randomBytes(12), (byte) => passwordAlphabet[byte % passwordAlphabet.length]);
  const characters = [...required, ...extra];
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

async function availableUsername(base: string, requested: boolean) {
  const admin = createSupabaseAdminClient();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 27)}.${randomInt(1000, 10000)}`;
    const { data, error } = await admin.from("reacher_accounts").select("user_id").eq("username", candidate).maybeSingle();
    if (error) throw new Error(`Could not check username availability: ${error.message}`);
    if (!data) return candidate;
    if (requested) return null;
  }
  return null;
}

export async function createManagedAccount(_previous: CredentialState, formData: FormData): Promise<CredentialState> {
  const { user } = await requireAdmin();
  const parsed = createSchema.safeParse({
    displayName: formData.get("displayName"),
    username: formData.get("username") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the account details" };

  const requested = Boolean(parsed.data.username);
  const base = normalizeUsername(parsed.data.username || parsed.data.displayName);
  if (!usernamePattern.test(base)) return { error: "Use at least 3 letters or numbers for the username" };

  try {
    const username = await availableUsername(base, requested);
    if (!username) return { error: requested ? "That username is already in use" : "Could not generate a unique username" };

    const password = generatePassword();
    const authEmail = `${randomUUID().replaceAll("-", "")}@accounts.reacher-build.invalid`;
    const admin = createSupabaseAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: parsed.data.displayName },
      app_metadata: { product: "REACHER_BUILD" },
    });
    if (createError || !created.user) throw new Error(createError?.message ?? "Supabase did not create the user");

    const { error: insertError } = await admin.from("reacher_accounts").insert({
      user_id: created.user.id,
      username,
      auth_email: authEmail,
      display_name: parsed.data.displayName,
      role: "buyer",
      status: "active",
      must_change_password: true,
      created_by: user.id,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(insertError.message);
    }

    revalidatePath("/admin");
    return { credentials: { username, password, displayName: parsed.data.displayName } };
  } catch (error) {
    console.error("Managed account creation failed", error instanceof Error ? error.message : String(error));
    return { error: "The account could not be created. Try again." };
  }
}

export async function resetManagedPassword(_previous: CredentialState, formData: FormData): Promise<CredentialState> {
  await requireAdmin();
  const parsed = accountIdSchema.safeParse(formData.get("userId"));
  if (!parsed.success) return { error: "Invalid account" };

  const admin = createSupabaseAdminClient();
  const { data: account, error: findError } = await admin
    .from("reacher_accounts")
    .select("username, display_name, role")
    .eq("user_id", parsed.data)
    .maybeSingle();
  if (findError || !account || account.role === "admin") return { error: "That account cannot be reset here" };

  const password = generatePassword();
  const { error: authError } = await admin.auth.admin.updateUserById(parsed.data, { password });
  if (authError) return { error: "The temporary password could not be created" };

  const { error: updateError } = await admin
    .from("reacher_accounts")
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq("user_id", parsed.data);
  if (updateError) return { error: "The password changed, but the account could not be marked for setup" };

  revalidatePath("/admin");
  return { credentials: { username: account.username, password, displayName: account.display_name } };
}

export async function setAccountStatus(formData: FormData) {
  const { user } = await requireAdmin();
  const userId = accountIdSchema.safeParse(formData.get("userId"));
  const status = z.enum(["active", "disabled"]).safeParse(formData.get("status"));
  if (!userId.success || !status.success || userId.data === user.id) return;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("reacher_accounts")
    .update({ status: status.data, updated_at: new Date().toISOString() })
    .eq("user_id", userId.data)
    .eq("role", "buyer");
  if (error) console.error("Account status update failed", { code: error.code, message: error.message });
  revalidatePath("/admin");
}
