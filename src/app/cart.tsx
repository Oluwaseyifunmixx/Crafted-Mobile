import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CheckoutPanel } from "@/components/checkout-panel";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Accent } from "@/constants/brand";
import type { CartItem } from "@/lib/api";
import { signInWithGoogle } from "@/lib/auth";
import { formatNaira } from "@/lib/format";
import { useShop } from "@/lib/shop-context";

// Same limit as the website: the server refuses more than 20 of one item.
const MAX_QUANTITY = 20;

type CartRowProps = {
  item: CartItem;
  busy: boolean;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
};

function CartRow({ item, busy, onChangeQuantity, onRemove }: CartRowProps) {
  const { product, quantity } = item;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.row, busy && styles.rowBusy]}
    >
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.thumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}

      <View style={styles.rowBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {product.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatNaira(product.priceKobo)} each
        </ThemedText>

        <View style={styles.controls}>
          <Pressable
            style={[styles.stepButton, quantity <= 1 && styles.stepDisabled]}
            disabled={busy || quantity <= 1}
            onPress={() => onChangeQuantity(quantity - 1)}
          >
            <Text style={styles.stepLabel}>−</Text>
          </Pressable>

          <ThemedText type="smallBold" style={styles.quantity}>
            {quantity}
          </ThemedText>

          <Pressable
            style={[
              styles.stepButton,
              quantity >= MAX_QUANTITY && styles.stepDisabled,
            ]}
            disabled={busy || quantity >= MAX_QUANTITY}
            onPress={() => onChangeQuantity(quantity + 1)}
          >
            <Text style={styles.stepLabel}>+</Text>
          </Pressable>

          <Pressable
            style={styles.removeButton}
            disabled={busy}
            onPress={onRemove}
          >
            <Text style={styles.removeLabel}>Remove</Text>
          </Pressable>
        </View>
      </View>

      <ThemedText type="smallBold">
        {formatNaira(product.priceKobo * quantity)}
      </ThemedText>
    </ThemedView>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const {
    session,
    loading: authLoading,
    cart,
    cartError,
    refreshCart,
    setQuantity,
    remove,
  } = useShop();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  // The cart total when checkout was opened. While this is set, the checkout
  // panel replaces the cart, even after the cart empties on payment.
  const [checkoutTotal, setCheckoutTotal] = useState<number | null>(null);

  async function handleSignIn() {
    setSignInError(null);
    const result = await signInWithGoogle();

    if (!result.ok) {
      setSignInError(result.message);
    }
  }

  async function runForItem(
    itemId: string,
    action: () => Promise<void>,
    failureTitle: string
  ) {
    setBusyId(itemId);

    try {
      await action();
    } catch (error) {
      Alert.alert(
        failureTitle,
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setBusyId(null);
    }
  }

  function renderBody() {
    if (authLoading) {
      return <ActivityIndicator style={styles.centered} />;
    }

    if (!session) {
      return (
        <View style={styles.centered}>
          <ThemedText type="smallBold">Sign in to see your cart</ThemedText>
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

    if (checkoutTotal !== null) {
      return (
        <CheckoutPanel
          subtotalKobo={checkoutTotal}
          onClose={() => setCheckoutTotal(null)}
        />
      );
    }

    if (!cart) {
      if (cartError) {
        return (
          <View style={styles.centered}>
            <ThemedText>{cartError}</ThemedText>
            <Pressable style={styles.primaryButton} onPress={refreshCart}>
              <Text style={styles.primaryLabel}>Try again</Text>
            </Pressable>
          </View>
        );
      }

      return <ActivityIndicator style={styles.centered} />;
    }

    if (cart.items.length === 0) {
      return (
        <View style={styles.centered}>
          <ThemedText type="smallBold">Your cart is empty</ThemedText>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.navigate("/")}
          >
            <Text style={styles.primaryLabel}>Browse the shop</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        {cartError && (
          <ThemedText type="small" style={styles.error}>
            {cartError}
          </ThemedText>
        )}

        <FlatList
          data={cart.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <CartRow
              item={item}
              busy={busyId === item.id}
              onChangeQuantity={(quantity) =>
                runForItem(
                  item.id,
                  () => setQuantity(item.id, quantity),
                  "Could not update quantity"
                )
              }
              onRemove={() =>
                runForItem(item.id, () => remove(item.id), "Could not remove item")
              }
            />
          )}
        />

        <ThemedView type="backgroundElement" style={styles.footer}>
          <View>
            <ThemedText type="small" themeColor="textSecondary">
              Subtotal ({cart.totals.itemCount}{" "}
              {cart.totals.itemCount === 1 ? "item" : "items"})
            </ThemedText>
            <ThemedText type="title" style={styles.total}>
              {formatNaira(cart.totals.subtotalKobo)}
            </ThemedText>
          </View>

          <Pressable
            style={styles.checkoutButton}
            onPress={() => setCheckoutTotal(cart.totals.subtotalKobo)}
          >
            <Text style={styles.primaryLabel}>Checkout</Text>
          </Pressable>
        </ThemedView>
      </>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.heading}>
            {checkoutTotal !== null ? "Checkout" : "Cart"}
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
  error: { color: "#DC2626", paddingHorizontal: 16, paddingBottom: 8 },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Accent,
  },
  primaryLabel: { color: "#ffffff", fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
  },
  rowBusy: { opacity: 0.5 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbPlaceholder: { backgroundColor: "#9CA3AF" },
  rowBody: { flex: 1, gap: 4 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Accent,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDisabled: { opacity: 0.35 },
  stepLabel: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  quantity: { minWidth: 24, textAlign: "center" },
  removeButton: { marginLeft: 8, paddingVertical: 6, paddingHorizontal: 4 },
  removeLabel: { color: "#DC2626", fontWeight: "600" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  total: { fontSize: 26, lineHeight: 32 },
  checkoutButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Accent,
  },
});