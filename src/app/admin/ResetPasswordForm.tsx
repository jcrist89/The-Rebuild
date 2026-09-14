"use client";

import { useActionState } from "react";
import { resetManagedPassword, type CredentialState } from "./actions";

const initialState: CredentialState = {};

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetManagedPassword, initialState);

  return (
    <div className="reset-wrap">
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <button type="submit" className="small-action" disabled={pending}>{pending ? "Resetting…" : "Reset password"}</button>
      </form>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      {state.credentials ? (
        <div className="credential-card compact" role="status">
          <strong>New temporary password</strong>
          <dl>
            <div><dt>Username</dt><dd>{state.credentials.username}</dd></div>
            <div><dt>Password</dt><dd>{state.credentials.password}</dd></div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
