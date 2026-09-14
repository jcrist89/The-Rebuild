import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser, getReacherAccount } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CreateAccountForm } from "./CreateAccountForm";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { setAccountStatus } from "./actions";

export const dynamic = "force-dynamic";

type ManagedAccount = {
  user_id: string;
  username: string;
  display_name: string;
  role: "admin" | "buyer";
  status: "active" | "disabled";
  must_change_password: boolean;
  created_at: string;
};

export default async function AdminPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const currentAccount = await getReacherAccount(user.id);
  if (!currentAccount || currentAccount.status !== "active" || currentAccount.role !== "admin") redirect("/");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("reacher_accounts")
    .select("user_id, username, display_name, role, status, must_change_password, created_at")
    .order("created_at", { ascending: false });
  const accounts = (data ?? []) as ManagedAccount[];

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <div className="brand"><strong>JON CRIST</strong> <em>FIT</em></div>
          <p className="eyebrow">OWNER CONSOLE</p>
          <h1>REACHER <span>ACCOUNTS</span></h1>
        </div>
        <div className="admin-nav"><Link href="/tracker">Tracker</Link><form action="/auth/signout" method="post"><button type="submit">Sign out</button></form></div>
      </header>

      <CreateAccountForm />

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div><p className="eyebrow">ACCESS</p><h2>Managed accounts</h2></div>
          <span className="account-count">{accounts.length}</span>
        </div>
        {error ? <div className="notice error">Accounts could not be loaded.</div> : null}
        {!error && accounts.length === 0 ? <div className="empty">No accounts have been created.</div> : null}
        <div className="account-list">
          {accounts.map((account) => (
            <article className="account-row" key={account.user_id}>
              <div className="account-identity">
                <strong>{account.display_name}</strong>
                <span>@{account.username}</span>
                <small>{account.role === "admin" ? "Owner" : account.must_change_password ? "Temporary password not changed" : "Password set"}</small>
              </div>
              <div className="account-controls">
                <span className={`status-pill ${account.status}`}>{account.status}</span>
                {account.role === "buyer" ? (
                  <>
                    <ResetPasswordForm userId={account.user_id} />
                    <form action={setAccountStatus}>
                      <input type="hidden" name="userId" value={account.user_id} />
                      <input type="hidden" name="status" value={account.status === "active" ? "disabled" : "active"} />
                      <button type="submit" className="small-action">{account.status === "active" ? "Disable" : "Enable"}</button>
                    </form>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
