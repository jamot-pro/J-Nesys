import { apiBaseUrl } from "./config";

/**
 * Session auth, shared by every web surface.
 *
 * Previously these lived inside apps/web's auth-context, so a second surface
 * had no way to sign a user in. The session is a cookie set by the API
 * (`jamot_session`), which is why every call sends `credentials: "include"`;
 * in production COOKIE_DOMAIN=.jamot.pro shares it across all subdomains, so
 * signing in on one console carries to the cockpit and back.
 */
export interface SignInResult {
  ok: boolean;
  /** Present only on failure — safe to show to the user. */
  error?: string;
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    // The API rate-limits this route; surface that distinctly so a locked-out
    // user isn't told their password is wrong.
    if (res.status === 429) {
      return { ok: false, error: "Too many attempts. Wait a minute and try again." };
    }
    return { ok: false, error: body.error ?? "Sign in failed." };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch(`${apiBaseUrl()}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore transport errors on sign-out: the caller clears local state
    // regardless, and a stale server session expires on its own.
  }
}

/**
 * Creates an account and signs it in.
 *
 * Registration and login are two calls on the API — POST /api/people creates
 * the person, and only /api/auth/login sets the session cookie — so this does
 * both rather than leaving a new account standing at the sign-in screen.
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<SignInResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/people`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName: displayName || undefined }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409) {
        return { ok: false, error: "That email already has an account. Sign in instead." };
      }
      return { ok: false, error: body.error ?? "Could not create the account." };
    }
    return await signIn(email, password);
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}
