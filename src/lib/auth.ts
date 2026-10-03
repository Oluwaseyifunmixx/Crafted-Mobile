import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export type AuthResult = { ok: true } | { ok: false; message: string };

// Where Google's answer should land: a link that opens this app. It must be on
// Supabase's Redirect URLs list.
export const AUTH_REDIRECT_URL = Linking.createURL("auth-callback");

export async function signInWithGoogle(): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: AUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
      // Always show Google's account picker. The tap on an account is what lets
      // Android hand the sign-in back to the app.
      queryParams: { prompt: "select_account" },
    },  });

    if (error || !data.url) {
    return { ok: false, message: error?.message ?? "Could not start sign-in." };
  }


      const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    AUTH_REDIRECT_URL
  );

     if (result.type !== "success") {
    return { ok: false, message: "Sign-in did not finish. Please try again." };
  }

  // The answer can come back in the query (?code=...) or the fragment
  // (#access_token=...), so look in both.
  const returned = new URL(result.url);
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