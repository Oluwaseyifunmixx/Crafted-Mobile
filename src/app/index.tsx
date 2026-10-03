import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Accent } from "@/constants/brand";
import { Colors } from "@/constants/theme";
import { fetchProducts, type Product } from "@/lib/api";
import { signInWithGoogle } from "@/lib/auth";
import { formatNaira } from "@/lib/format";
import { useShop } from "@/lib/shop-context";

// An invisible filler, so a lone card in the last row keeps half width instead
// of stretching across the screen.
type Spacer = { id: string; spacer: true };
type GridItem = Product | Spacer;
const SPACER: Spacer = { id: "spacer", spacer: true };

function matchesQuery(product: Product, query: string): boolean {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return true;
  }

  return (
    product.name.toLowerCase().includes(needle) ||
    product.description.toLowerCase().includes(needle)
  );
}

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
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];
  const { session, loading: authLoading, add } = useShop();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  const visibleProducts = useMemo(
    () => products.filter((product) => matchesQuery(product, query)),
    [products, query]
  );

  const gridItems = useMemo<GridItem[]>(
    () =>
      visibleProducts.length % 2 === 1
        ? [...visibleProducts, SPACER]
        : visibleProducts,
    [visibleProducts]
  );

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
  const searching = query.trim().length > 0;

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
          <>
            <View
              style={[
                styles.searchBar,
                { backgroundColor: colors.backgroundElement },
              ]}
            >
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search to shop"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} hitSlop={12}>
                  <Text
                    style={[styles.clearLabel, { color: colors.textSecondary }]}
                  >
                    ✕
                  </Text>
                </Pressable>
              )}
            </View>

            <FlatList
              data={gridItems}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListEmptyComponent={
                <View style={styles.noResults}>
                  <ThemedText type="smallBold">
                    {searching
                      ? `No products match "${query.trim()}"`
                      : "No products yet"}
                  </ThemedText>
                  {searching && (
                    <Pressable
                      style={styles.retryButton}
                      onPress={() => setQuery("")}
                    >
                      <Text style={styles.addButtonLabel}>Clear search</Text>
                    </Pressable>
                  )}
                </View>
              }
              renderItem={({ item }) =>
                "spacer" in item ? (
                  <View style={styles.spacer} />
                ) : (
                  <ProductCard
                    product={item}
                    busy={addingId === item.id}
                    onAdd={() => handleAdd(item)}
                  />
                )
              }
            />
          </>
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  clearLabel: { fontSize: 16, paddingLeft: 8 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 20 },
  row: { gap: 20 },
  noResults: { paddingTop: 48, alignItems: "center", gap: 12 },
  spacer: { flex: 1 },
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