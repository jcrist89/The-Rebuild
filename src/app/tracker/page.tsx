import Script from "next/script";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser, getReacherAccount, hasReacherAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const account = await getReacherAccount(user.id);
  if (account?.status === "active" && account.mustChangePassword) redirect("/account/password");
  if (!hasReacherAccess(account)) redirect("/access");

  return (
    <>
      <div id="setupView" className="setup hidden" aria-live="polite" />

      <div id="appShell" className="hidden">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand-row">
              <div className="brand"><strong>JON CRIST</strong> <em>FIT</em></div>
              <div className="account-actions">
                {account.role === "admin" ? <Link href="/admin">Manage users</Link> : null}
                <Link href="/account/password">Account</Link>
                <form action="/auth/signout" method="post"><button type="submit" className="signout-button">Sign out</button></form>
              </div>
            </div>
            <div className="title-row">
              <h1 id="pageTitle">THE <span>BUILD</span></h1>
              <div className="phase-pill"><span className="dot" /><span id="phaseText">Week 1 - Strip</span></div>
            </div>
          </div>
        </header>

        <main>
          <section id="view-today" className="view active" />
          <section id="view-train" className="view" />
          <section id="view-fuel" className="view" />
          <section id="view-body" className="view" />
          <section id="view-plan" className="view" />
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <button type="button" data-tab="today" className="active" aria-current="page">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg><span>Today</span>
          </button>
          <button type="button" data-tab="train">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/></svg><span>Train</span>
          </button>
          <button type="button" data-tab="fuel">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v8a2.5 2.5 0 0 0 5 0V3M7.5 11v10"/><path d="M17 3c-1.7 1.6-2.5 3.6-2.5 6s.8 3 2.5 3 2.5-.6 2.5-3-.8-4.4-2.5-6ZM17 12v9"/></svg><span>Fuel</span>
          </button>
          <button type="button" data-tab="body">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.5 9 11l4 4 8-8.5"/><path d="M15 6.5h6v6"/></svg><span>Check-in</span>
          </button>
          <button type="button" data-tab="plan">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h11l4 4V20.5H5z"/><path d="M15.5 3.5V8H20M8.5 12.5h7M8.5 16.5h7"/></svg><span>36 Weeks</span>
          </button>
        </nav>
      </div>

      <div id="scrim" className="scrim" />
      <section id="sheet" className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" aria-hidden="true" inert>
        <div className="grab" />
        <div id="sheetBody" />
      </section>
      <div id="toast" className="toast" role="status" aria-live="polite" />

      <Script src="/logic.js" strategy="beforeInteractive" />
      <Script src="/tracker.js" strategy="afterInteractive" />
    </>
  );
}
