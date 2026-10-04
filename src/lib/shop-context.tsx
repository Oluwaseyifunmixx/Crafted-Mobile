import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import type { Session } from "@supabase/supabase-js";

import {
  addToCart,
  fetchCart,
  removeCartItem,
  setCartQuantity,
  type Cart,
} from "./api";
import { supabase } from "./supabase";

type ShopContextValue = {
  session: Session | null;
  // True while the app checks whether a login was saved on the phone.
  loading: boolean;
  cart: Cart | null;
  cartError: string | null;
  liveStatus: string;
  refreshCart: () => Promise<void>;
  add: (productId: string) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
};

const ShopContext = createContext<ShopContextValue | null>(null);

// One shared copy of the login and the cart, so every screen (and the badge on
// the tab bar) shows the same thing and there is only one live connection.
export function ShopProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState("not connected");
  const latestRequest = useRef(0);

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

  const refreshCart = useCallback(async () => {
    // If two reloads overlap, only the newest answer is kept.
    const requestId = ++latestRequest.current;

    try {
      const next = await fetchCart();
      if (requestId === latestRequest.current) {
        setCart(next);
        setCartError(null);
      }
    } catch (error) {
      if (requestId === latestRequest.current) {
        setCartError(
          error instanceof Error ? error.message : "Something went wrong."
        );
      }
    }
  }, []);

  // Load the cart on sign-in, then reload it whenever Supabase announces a
  // change to the cart_items table.
  useEffect(() => {
    if (!userId) {
      latestRequest.current += 1;
      setCart(null);
      setCartError(null);
      setLiveStatus("not connected");
      return;
    }

    refreshCart();

    const channel = supabase
      .channel("shop-cart-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cart_items" },
        () => {
          refreshCart();
        }
      )
      .subscribe((status) => setLiveStatus(status));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshCart]);

    // Reload the cart when the app comes back to the front. While the app was in
  // the background (for example on Paystack's page), the live connection may
  // have paused and missed changes, such as the cart being emptied by a payment.
  useEffect(() => {
    if (!userId) {
      return;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshCart();
      }
    });

    return () => subscription.remove();
  }, [userId, refreshCart]);

  const add = useCallback(
    async (productId: string) => {
      await addToCart(productId);
      await refreshCart();
    },
    [refreshCart]
  );

  const setQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      await setCartQuantity(itemId, quantity);
      await refreshCart();
    },
    [refreshCart]
  );

  const remove = useCallback(
    async (itemId: string) => {
      await removeCartItem(itemId);
      await refreshCart();
    },
    [refreshCart]
  );

  const value = useMemo(
    () => ({
      session,
      loading,
      cart,
      cartError,
      liveStatus,
      refreshCart,
      add,
      setQuantity,
      remove,
    }),
    [session, loading, cart, cartError, liveStatus, refreshCart, add, setQuantity, remove]
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const value = useContext(ShopContext);

  if (!value) {
    throw new Error("useShop must be used inside <ShopProvider>.");
  }

  return value;
}