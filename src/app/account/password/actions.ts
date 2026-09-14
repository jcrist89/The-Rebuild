"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthenticatedUser, getReacherAccount } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const passwordSchema = z.string()
  .min(12, "Use at least 12 characters")
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a symbol");

function passwordError(message: string): never {
  redirect(`/account/password?error=${encodeURIComponent(message)}`);
}

export async function changePassword(formData: FormData) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const account = await getReacherAccount(user.id);
  if (!account || account.status !== "active") redirect("/access");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (!currentPassword) passwordError("Enter your current password");
  if (newPassword !== confirmation) passwordError("The new passwords do not match");

  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) passwordError(parsed.error.issues[0]?.message ?? "Choose a stronger password");
  if (currentPassword === parsed.data) passwordError("Choose a password you have not used for this login");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data,
    current_password: currentPassword,
  });
  if (error) passwordError("Your current password was not accepted");

  const admin = createSupabaseAdminClient();
  const { error: accountError } = await admin
    .from("reacher_accounts")
    .update({ must_change_password: false, password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "active");
  if (accountError) passwordError("Your password changed, but account setup could not finish. Sign in with the new password and try again");

  redirect("/tracker");
}
