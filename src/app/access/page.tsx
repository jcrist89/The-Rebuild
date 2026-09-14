import { redirect } from "next/navigation";
import { getAuthenticatedUser, getReacherAccount, hasReacherAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const account = await getReacherAccount(user.id);
  if (account?.status === "active" && account.mustChangePassword) redirect("/account/password");
  if (hasReacherAccess(account)) redirect("/tracker");

  return (
    <main className="auth-page">
      <section className="auth-card access-card">
        <div className="brand"><strong>JON CRIST</strong> <em>FIT</em></div>
        <p className="eyebrow">ACCOUNT STATUS</p>
        <h1>ACCESS <span>UNAVAILABLE</span></h1>
        <p className="auth-lead">This account is not currently enabled for The Reacher Build.</p>

        <div className="access-actions">
          <div className="notice"><strong>Need access restored?</strong><span>Contact Jon Crist Fit and include your username if you have one.</span></div>
          <a className="auth-secondary" href="mailto:support@joncristfit.com?subject=Reacher%20Build%20access">Contact support</a>
          <form action="/auth/signout" method="post"><button className="text-button" type="submit">Sign out</button></form>
        </div>
      </section>
    </main>
  );
}
