import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { signIn } from "./actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await getAuthenticatedUser()) redirect("/");
  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand"><strong>JON CRIST</strong> <em>FIT</em></div>
        <p className="eyebrow">MEMBER ACCESS</p>
        <h1>THE REACHER <span>BUILD</span></h1>
        <p className="auth-lead">Use the username and temporary password provided with your Reacher Build access.</p>

        <form action={signIn} className="auth-form">
          <label htmlFor="username">Username</label>
          <input id="username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="your.username" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          {params.error ? <p className="form-error" role="alert">{params.error}</p> : null}
          <button type="submit" className="auth-primary">Sign in</button>
        </form>

        <p className="auth-footnote">Need help? <Link href="mailto:support@joncristfit.com?subject=Reacher%20Build%20login">Contact support</Link></p>
      </section>
    </main>
  );
}
