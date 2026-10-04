import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Accent } from "@/constants/brand";
import {
  confirmOrder,
  fetchOrders,
  type Order,
  type OrderStatus,
} from "@/lib/api";
import { signInWithGoogle } from "@/lib/auth";
import { formatNaira, formatOrderDate } from "@/lib/format";
import { useShop } from "@/lib/shop-context";

// Same colours as the website's My orders page, with a symbol so the meaning
// does not depend on colour alone.
const STATUS_BADGES: Record<
  OrderStatus,
  { label: string; background: string; color: string }
> = {
  paid: { label: "✓ Paid", background: "#DCFCE7", color: "#166534" },
  pending: {
    label: "… Awaiting payment",
    background: "#FEF3C7",
    color: "#92400E",
  },
  failed: { label: "✕ Payment failed", background: "#FEE2E2", color: "#991B1B" },
};

type OrderCardProps = {
  order: Order;
  checking: boolean;
  notice?: string;
  onCheck: () => void;
};

function OrderCard({ order, checking, notice, onCheck }: OrderCardProps) {
  const badge = STATUS_BADGES[order.status];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerText}>
          <ThemedText type="smallBold">Order {order.reference}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatOrderDate(order.createdAt)}
          </ThemedText>
        </View>

        <View style={[styles.badge, { backgroundColor: badge.background }]}>
          <Text style={[styles.badgeLabel, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      <View style={styles.items}>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <ThemedText type="small" style={styles.itemName}>
              {item.quantity} × {item.productName}
            </ThemedText>
            <ThemedText type="small">
              {formatNaira(item.unitPriceKobo * item.quantity)}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.totalRow}>
        <ThemedText type="smallBold">Total</ThemedText>
        <ThemedText type="smallBold">{formatNaira(order.totalKobo)}</ThemedText>
      </View>

      {order.status === "pending" && (
        <View style={styles.pendingBox}>
          <ThemedText type="small" themeColor="textSecondary">
            Already paid? Check with Paystack to update this order.
          </ThemedText>

          <Pressable
            style={[styles.checkButton, checking && styles.disabled]}
            onPress={onCheck}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color={Accent} />
            ) : (
              <Text style={styles.checkLabel}>Check payment status</Text>
            )}
          </Pressable>

          {notice && (
            <ThemedText type="small" themeColor="textSecondary">
              {notice}
            </ThemedText>
          )}
        </View>
      )}
    </ThemedView>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { session, loading: authLoading, refreshCart } = useShop();
  const userId = session?.user.id;

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [notices, setNotices] = useState<Record<string, string>>({});

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await fetchOrders());
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load your orders."
      );
    }
  }, []);

  // Reload whenever this tab is opened, and when the shopper signs in or out.
  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setOrders(null);
        setError(null);
        return;
      }

      loadOrders();
    }, [userId, loadOrders])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  }

  async function handleSignIn() {
    setSignInError(null);
    const result = await signInWithGoogle();

    if (!result.ok) {
      setSignInError(result.message);
    }
  }

  function setNotice(orderId: string, text: string | null) {
    setNotices((current) => {
      const next = { ...current };

      if (text) {
        next[orderId] = text;
      } else {
        delete next[orderId];
      }

      return next;
    });
  }

  // Asks the shop to re-check the payment with Paystack. The server marks an
  // order paid at most once, so pressing this repeatedly is safe.
  async function handleCheck(order: Order) {
    setCheckingId(order.id);
    setNotice(order.id, null);

    try {
      const status = await confirmOrder(order.id);

      if (status === "pending") {
        setNotice(
          order.id,
          "No payment received yet. If you have just paid, wait a few seconds and check again."
        );
        return;
      }

      // Paid or failed: the order changed, and a payment also empties the cart.
      await Promise.all([loadOrders(), refreshCart()]);
    } catch (caught) {
      setNotice(
        order.id,
        caught instanceof Error
          ? caught.message
          : "We couldn't check the payment. Please try again."
      );
    } finally {
      setCheckingId(null);
    }
  }

  function renderBody() {
    if (authLoading) {
      return <ActivityIndicator style={styles.centered} />;
    }

    if (!session) {
      return (
        <View style={styles.centered}>
          <ThemedText type="smallBold">Sign in to see your orders</ThemedText>
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

    if (!orders) {
      if (error) {
        return (
          <View style={styles.centered}>
            <ThemedText>{error}</ThemedText>
            <Pressable style={styles.primaryButton} onPress={loadOrders}>
              <Text style={styles.primaryLabel}>Try again</Text>
            </Pressable>
          </View>
        );
      }

      return <ActivityIndicator style={styles.centered} />;
    }

    if (orders.length === 0) {
      return (
        <View style={styles.centered}>
          <ThemedText type="smallBold">No orders yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            When you place an order, it will show up here.
          </ThemedText>
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
        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <FlatList
          data={orders}
          extraData={[checkingId, notices]}
          keyExtractor={(order) => order.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              checking={checkingId === item.id}
              notice={notices[item.id]}
              onCheck={() => handleCheck(item)}
            />
          )}
        />
      </>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.heading}>
            Your orders
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
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  card: { padding: 16, borderRadius: 16, gap: 12 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headerText: { flex: 1, gap: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeLabel: { fontSize: 12, fontWeight: "700" },
  items: { gap: 6 },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  itemName: { flex: 1 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#9CA3AF",
  },
  pendingBox: { gap: 8 },
  checkButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Accent,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: { color: Accent, fontWeight: "600" },
  disabled: { opacity: 0.6 },
});