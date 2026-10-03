import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Accent } from "@/constants/brand";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { useShop } from "@/lib/shop-context";

export default function AccountScreen() {
  const { session, loading, liveStatus } = useShop();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignIn() {
    setSignInError(null);
    const result = await signInWithGoogle();

    if (!result.ok) {
      setSignInError(result.message);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);

    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const metadata = session?.user.user_metadata;
  const name =
    typeof metadata?.full_name === "string" ? metadata.full_name : null;
  const email = session?.user.email ?? "";
  const initial = (name ?? email)[0]?.toUpperCase() ?? "?";

  function renderBody() {
    if (loading) {
      return <ActivityIndicator style={styles.centered} />;
    }

    if (!session) {
      return (
        <View style={styles.centered}>
          <ThemedText type="smallBold">You are not signed in</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Sign in to keep your cart in sync with the website.
          </ThemedText>
          {signInError && (
            <ThemedText type="small" style={styles.error}>
              {signInError}
            </ThemedText>
          )}
          <Pressable style={styles.primaryButton} onPress={handleSignIn}>
            <Text style={styles.primaryLabel}>Sign in with Google</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{initial}</Text>
        </View>

        {name && <ThemedText type="title" style={styles.name}>{name}</ThemedText>}
        <ThemedText themeColor="textSecondary">{email}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.syncPill}>
          <ThemedText type="small">
            Cart sync: {liveStatus === "SUBSCRIBED" ? "live" : "connecting..."}
          </ThemedText>
        </ThemedView>

        <Pressable
          style={[styles.signOutButton, signingOut && styles.disabled]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.signOutLabel}>Sign out</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.heading}>
            Account
          </ThemedText>
        </View>

        {renderBody()}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  heading: { fontSize: 28, lineHeight: 34 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  error: { color: "#DC2626", textAlign: "center" },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Accent,
  },
  primaryLabel: { color: "#ffffff", fontWeight: "600" },
  profile: {
    flex: 1,
    alignItems: "center",
    paddingTop: 32,
    paddingHorizontal: 24,
    gap: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarLabel: { color: "#ffffff", fontSize: 40, fontWeight: "700" },
  name: { fontSize: 24, lineHeight: 30, textAlign: "center" },
  syncPill: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  signOutButton: {
    marginTop: 24,
    minWidth: 160,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutLabel: { color: "#DC2626", fontWeight: "600" },
  disabled: { opacity: 0.6 },
});