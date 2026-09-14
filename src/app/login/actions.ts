"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  username: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});

function loginError(): never {
  redirect("/login?error=That+username+or+password+is+not+correct");
}

export async function signIn(formData: FormData) {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) loginError();

  const identifier = parsed.data.username.toLowerCase();
  let email = identifier;
  if (!identifier.includes("@")) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("reacher_accounts")
      .select("auth_email, status")
      .eq("username", identifier)
      .maybeSingle();
    if (error || !data || data.status !== "active") loginError();
    email = data.auth_email;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (error || !data.user) loginError();

  const admin = createSupabaseAdminClient();
  const { data: account } = await admin
    .from("reacher_accounts")
    .select("status, must_change_password")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!account || account.status !== "active") {
    await supabase.auth.signOut();
    loginError();
  }

  // Send signed-in members straight to their destination. This avoids a second
  // client-side redirect while the browser is applying the new auth cookies.
  redirect(account.must_change_password ? "/account/password" : "/tracker");
}
