import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Accent } from "@/constants/brand";
import { fetchProducts, type Product } from "@/lib/api";
import { signInWithGoogle } from "@/lib/auth";
import { formatNaira } from "@/lib/format";
import { useShop } from "@/lib/shop-context";

type ProductCardProps = {
  product: Product;
  busy: boolean;
  onAdd: () => void;
};

function ProductCard({ product, busy, onAdd }: ProductCardProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}

      <View style={styles.cardBody}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {product.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatNaira(product.priceKobo)}
        </ThemedText>

        <Pressable
          style={[styles.addButton, busy && styles.addButtonBusy]}
          onPress={onAdd}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.addButtonLabel}>Add to cart</Text>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const { session, loading: authLoading, add } = useShop();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadError(null);

    try {
      setProducts(await fetchProducts());
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load products."
      );
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }

  async function handleSignIn() {
    setSignInError(null);
    const result = await signInWithGoogle();

    if (!result.ok) {
      setSignInError(result.message);
    }
  }

  async function handleAdd(product: Product) {
    // Signed-out shoppers sign in first, like on the website.
    if (!session) {
      await handleSignIn();
      return;
    }

    setAddingId(product.id);

    try {
      await add(product.id);
    } catch (error) {
      Alert.alert(
        "Could not add to cart",
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setAddingId(null);
    }
  }

  const initial = session?.user.email?.[0]?.toUpperCase() ?? "?";

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.brand}>
            Crafted
          </ThemedText>

          {authLoading ? null : session ? (
            <Pressable
              style={styles.avatar}
              onPress={() => router.navigate("/account")}
            >
              <Text style={styles.avatarLabel}>{initial}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.signInPill} onPress={handleSignIn}>
              <Text style={styles.signInLabel}>Sign in</Text>
            </Pressable>
          )}
        </View>

        {signInError && (
          <ThemedText type="small" style={styles.error}>
            {signInError}
          </ThemedText>
        )}

        {loadingProducts ? (
          <ActivityIndicator style={styles.centered} />
        ) : loadError ? (
          <View style={styles.centered}>
            <ThemedText>{loadError}</ThemedText>
            <Pressable style={styles.retryButton} onPress={loadProducts}>
              <Text style={styles.addButtonLabel}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(product) => product.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                busy={addingId === item.id}
                onAdd={() => handleAdd(item)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brand: { fontSize: 28, lineHeight: 34 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: { color: "#ffffff", fontWeight: "700" },
  signInPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Accent,
  },
  signInLabel: { color: "#ffffff", fontWeight: "600" },
  error: { color: "#DC2626", paddingHorizontal: 16, paddingBottom: 8 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Accent,
  },
    list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 20 },
  row: { gap: 20 },
  card: { flex: 1, borderRadius: 16, overflow: "hidden" },
  image: { width: "100%", aspectRatio: 1 },
  imagePlaceholder: { backgroundColor: "#9CA3AF" },
  cardBody: { padding: 12, gap: 6 },
  addButton: {
    marginTop: 4,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: Accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonBusy: { opacity: 0.7 },
  addButtonLabel: { color: "#ffffff", fontWeight: "600" },
});