# The Reacher Build Tracker

Private, mobile-first companion tracker for the 36-week **Reacher Build** blueprint by Jon Crist Fit.

## Access model

- The owner creates buyer accounts in the private `/admin` console.
- Each account receives a generated username and one-time temporary password.
- A buyer must replace the temporary password before the tracker unlocks.
- Supabase Auth hashes and verifies passwords; plaintext passwords are never stored in the application database.
- There is no public registration, email magic-link dependency, or Stripe integration.
- The program definition is delivered only by `/api/program` after authentication and an active account check.
- Progress is saved locally for resilience and synced to the buyer's Supabase account.
- The owner can disable accounts or issue a new one-time temporary password.

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

## Legacy data migration

On a buyer's first authenticated load, any existing `jcf-reacher-build-v1` browser save is uploaded to their account when no cloud state exists. Offline service-worker caching remains disabled because disabled accounts must not retain access through a cached application shell.
