import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser, getReacherAccount } from "@/lib/auth";
import { changePassword } from "./actions";

export const dynamic = "force-dynamic";

type PasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function PasswordPage({ searchParams }: PasswordPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const account = await getReacherAccount(user.id);
  if (!account || account.status !== "active") redirect("/access");
  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand"><strong>JON CRIST</strong> <em>FIT</em></div>
        <p className="eyebrow">ACCOUNT SECURITY</p>
        <h1>{account.mustChangePassword ? <>CREATE YOUR <span>PASSWORD</span></> : <>CHANGE YOUR <span>PASSWORD</span></>}</h1>
        <p className="auth-lead">
          {account.mustChangePassword
            ? "Replace the temporary password before opening your 36-week tracker."
            : `Signed in as ${account.username}. Enter your current password to choose a new one.`}
        </p>

        <form action={changePassword} className="auth-form">
          <label htmlFor="currentPassword">Current password</label>
          <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
          <label htmlFor="newPassword">New password</label>
          <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} required />
          <label htmlFor="confirmation">Confirm new password</label>
          <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} required />
          <p className="field-help">Use 12+ characters with uppercase, lowercase, a number, and a symbol.</p>
          {params.error ? <p className="form-error" role="alert">{params.error}</p> : null}
          <button type="submit" className="auth-primary">Save new password</button>
        </form>

        {!account.mustChangePassword ? <p className="auth-footnote"><Link href="/tracker">Return to tracker</Link></p> : null}
      </section>
    </main>
  );
}
