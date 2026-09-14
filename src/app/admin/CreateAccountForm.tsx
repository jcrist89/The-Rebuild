"use client";

import { useActionState } from "react";
import { createManagedAccount, type CredentialState } from "./actions";

const initialState: CredentialState = {};

export function CreateAccountForm() {
  const [state, formAction, pending] = useActionState(createManagedAccount, initialState);

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <p className="eyebrow">NEW BUYER</p>
          <h2>Generate login</h2>
        </div>
        <span className="status-pill active">Active</span>
      </div>

      <form action={formAction} className="auth-form">
        <label htmlFor="displayName">Buyer name</label>
        <input id="displayName" name="displayName" type="text" autoComplete="off" placeholder="Jane Smith" required />
        <label htmlFor="username">Username <span className="optional">optional</span></label>
        <input id="username" name="username" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Generated from their name" />
        {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
        <button type="submit" className="auth-primary" disabled={pending}>{pending ? "Creating…" : "Generate username and password"}</button>
      </form>

      {state.credentials ? (
        <div className="credential-card" role="status">
          <strong>Copy these credentials now</strong>
          <span>The temporary password is shown only once and is not stored in the app.</span>
          <dl>
            <div><dt>Username</dt><dd>{state.credentials.username}</dd></div>
            <div><dt>Temporary password</dt><dd>{state.credentials.password}</dd></div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
