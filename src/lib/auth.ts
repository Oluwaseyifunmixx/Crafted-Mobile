import * as Linking from "expo-linking";
import { AppState } from "react-native";
import { supabase } from "./supabase";

export type AuthResult = { ok: true } | { ok: false; message: string };

// Where Google's answer should land: a link that opens this app. It must be on
// Supabase's Redirect URLs list.
export const AUTH_REDIRECT_URL = Linking.createURL("auth-callback");

// After the shopper returns to the app without the sign-in link (for example
// they closed the browser), wait this long for the link, then give up.
const RETURN_GRACE_MS = 3000;
const SIGN_IN_TIMEOUT_MS = 2 * 60 * 1000;

// Opens the sign-in page in the phone's normal browser and waits for the link
// that brings the shopper back. A normal browser opens a fresh tab each time,
// so an old sign-in window cannot be reused.
function waitForSignInLink(authUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let leftApp = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (url: string | null) => {
      if (settled) {
        return;
      }

      settled = true;
      linkSubscription.remove();
      stateSubscription.remove();
      clearTimeout(graceTimer);
      clearTimeout(timeoutTimer);
      resolve(url);
    };

    const linkSubscription = Linking.addEventListener("url", ({ url }) => {
      if (url.startsWith(AUTH_REDIRECT_URL)) {
        finish(url);
      }
    });

    const stateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        leftApp = true;
        return;
      }

      if (leftApp) {
        clearTimeout(graceTimer);
        graceTimer = setTimeout(() => finish(null), RETURN_GRACE_MS);
      }
    });

    const timeoutTimer = setTimeout(() => finish(null), SIGN_IN_TIMEOUT_MS);

    Linking.openURL(authUrl).catch(() => finish(null));
  });
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: AUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
      // Always show Google's account picker.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    return { ok: false, message: error?.message ?? "Could not start sign-in." };
  }

  const returnedUrl = await waitForSignInLink(data.url);

  if (!returnedUrl) {
    return { ok: false, message: "Sign-in did not finish. Please try again." };
  }

  // The answer can come back in the query (?code=...) or the fragment
  // (#access_token=...), so look in both.
  const returned = new URL(returnedUrl);
  const hashParams = new URLSearchParams(returned.hash.replace(/^#/, ""));
  const read = (key: string) =>
    returned.searchParams.get(key) ?? hashParams.get(key);

  const code = read("code");
  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    return exchangeError
      ? { ok: false, message: exchangeError.message }
      : { ok: true };
  }

  const accessToken = read("access_token");
  const refreshToken = read("refresh_token");
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return sessionError
      ? { ok: false, message: sessionError.message }
      : { ok: true };
  }

  return {
    ok: false,
    message: read("error_description") ?? "Sign-in did not return a session.",
  };
}

export async function signOut() {
  // "local" signs out this phone only, not the website or other devices.
  await supabase.auth.signOut({ scope: "local" });
}