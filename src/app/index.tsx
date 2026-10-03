import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchCart } from "@/lib/api";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Temporary screen for testing sign-in, the shop's cart API and live updates.
// The real shop screens replace it later.
export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [cartText, setCartText] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>("not connected");

  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadCart = useCallback(async () => {
    try {
      const cart = await fetchCart();
      const lines = cart.items.map(
        (item) => `${item.quantity} x ${item.product.name}`
      );
      setCartText(
        lines.length > 0
          ? `${lines.join("\n")}\n(${cart.totals.itemCount} items)`
          : "Your cart is empty."
      );
    } catch (error) {
      setCartText(error instanceof Error ? error.message : "Something went wrong.");
    }
  }, []);

  // Load the cart on sign-in, then reload it whenever Supabase announces a
  // change to the cart_items table.
  useEffect(() => {
    if (!userId) {
      setCartText(null);
      setLiveStatus("not connected");
      return;
    }

    loadCart();

    const channel = supabase
      .channel("cart-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cart_items" },
        () => {
          loadCart();
        }
      )
      .subscribe((status) => setLiveStatus(status));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadCart]);

  async function handleSignIn() {
    setMessage(null);
    const result = await signInWithGoogle();
    if (!result.ok) {
      setMessage(result.message);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">Crafted</ThemedText>

          {loading ? (
            <ActivityIndicator />
          ) : session ? (
            <>
              <ThemedText>Signed in as {session.user.email}</ThemedText>
              <ThemedText type="small">Live updates: {liveStatus}</ThemedText>
              <Pressable style={styles.button} onPress={loadCart}>
                <ThemedText>Reload my cart</ThemedText>
              </Pressable>
              <Pressable style={styles.button} onPress={signOut}>
                <ThemedText>Sign out</ThemedText>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.button} onPress={handleSignIn}>
              <ThemedText>Sign in with Google</ThemedText>
            </Pressable>
          )}

          {message && <ThemedText type="small">{message}</ThemedText>}
          {cartText && <ThemedText>{cartText}</ThemedText>}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#888",
  },
});