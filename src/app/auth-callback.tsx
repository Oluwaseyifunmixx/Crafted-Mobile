import { Redirect } from "expo-router";

// The sign-in link brings the user back to /auth-callback. The login itself is
// picked up in lib/auth.ts, so this screen only sends them on to the home screen.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
