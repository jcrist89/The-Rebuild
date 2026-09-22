# The Rebuild Tracker

Private, mobile-first companion tracker for the 36-week **Rebuild** blueprint by Jon Crist Fit.

## Access model

- The owner creates buyer accounts in the private `/admin` console.
- Each account receives a generated username and one-time temporary password.
- A buyer must replace the temporary password before the tracker unlocks.
- Supabase Auth hashes and verifies passwords; plaintext passwords are never stored in the application database.
- There is no public registration, email magic-link dependency, or Stripe integration.
- The program definition is delivered only by `/api/program` after authentication and an active account check.
- Progress is saved locally for resilience and synced to the buyer's Supabase account.
- The owner can disable accounts or issue a new one-time temporary password.
- Each buyer has a direct message thread with the owner (`/api/messages`, `public.reacher_messages`), visible to that buyer in the tracker and to the owner in `/admin`.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in the Supabase publishable and secret keys.
3. Apply all migrations in `supabase/migrations`.
4. In Supabase Auth, leave email/password authentication enabled and disable public user signups.

```powershell
npm.cmd install
npm.cmd run dev
```

## Create the first owner

The first owner is created from the command line because no untrusted visitor should be able to make themselves an administrator.

```powershell
npm.cmd run create-admin -- --username jon --name "Jon Crist Fit Owner"
```

The command prints a generated temporary password once. Sign in at `/login`, replace it, then open `/admin`. From that point forward, buyer accounts are managed in the app.

## Verify

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## Local storage and account isolation

Browser local storage is scoped per signed-in account (`jcf-the-rebuild-v1:<user id>`), set server-side from the session in `tracker/page.tsx` and never read from anything client-editable. This exists so a device used by more than one account — a shared or demo browser, a buyer whose account is disabled and replaced — never lets a new session inherit a previous account's cached progress. Supabase is authoritative: a signed-in buyer's saved remote state always wins over local storage, and local storage is used only as an offline cache for that same account and a short-lived upload buffer before the first sync completes.

Offline service-worker caching remains disabled because disabled accounts must not retain access through a cached application shell.
