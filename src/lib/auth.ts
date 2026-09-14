import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedUser = { id: string; email: string };
export type ReacherAccount = {
  userId: string;
  username: string;
  displayName: string;
  role: "admin" | "buyer";
  status: "active" | "disabled";
  mustChangePassword: boolean;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (error || !subject || !email) return null;
  return { id: subject, email };
}

export async function getReacherAccount(userId?: string): Promise<ReacherAccount | null> {
  const resolvedUserId = userId ?? (await getAuthenticatedUser())?.id;
  if (!resolvedUserId) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("reacher_accounts")
    .select("user_id, username, display_name, role, status, must_change_password")
    .eq("user_id", resolvedUserId)
    .maybeSingle();

  if (error) {
    console.error("Account lookup failed", { code: error.code, message: error.message });
    return null;
  }

  if (!data) return null;
  return {
    userId: data.user_id,
    username: data.username,
    displayName: data.display_name,
    role: data.role,
    status: data.status,
    mustChangePassword: data.must_change_password,
  };
}

export function hasReacherAccess(account: ReacherAccount | null): account is ReacherAccount {
  return Boolean(account && account.status === "active" && !account.mustChangePassword);
}
