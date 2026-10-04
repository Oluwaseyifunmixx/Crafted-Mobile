import { supabase } from "./supabase";

// The live Crafted website. This is the shop's public address, not a secret.
export const API_URL = "https://shop-checkout-six.vercel.app";

export type Product = {
  id: string;
  name: string;
  description: string;
  priceKobo: number;
  imageUrl: string | null;
};

export type CartItem = {
  id: string;
  quantity: number;
  product: Product;
};

export type CartTotals = {
  itemCount: number;
  subtotalKobo: number;
};

export type Cart = {
  items: CartItem[];
  totals: CartTotals;
};

// Every call to the shop goes through here, so the login token is attached in
// one place. Throws an Error with the server's message when something fails.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: Record<string, string> = {};
  if (init.body) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body.error === "string"
        ? body.error
        : `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return body as T;
}

export async function fetchProducts(): Promise<Product[]> {
  const body = await request<{ products: Product[] }>("/api/products");
  return body.products;
}

export function fetchCart(): Promise<Cart> {
  return request<Cart>("/api/cart");
}

export async function addToCart(productId: string): Promise<void> {
  await request("/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
}

export async function setCartQuantity(
  itemId: string,
  quantity: number
): Promise<void> {
  await request(`/api/cart/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export async function removeCartItem(itemId: string): Promise<void> {
  await request(`/api/cart/${itemId}`, { method: "DELETE" });
}


export type OrderStatus = "paid" | "pending" | "failed";

export type OrderItem = {
  id: string;
  productName: string;
  unitPriceKobo: number;
  quantity: number;
};

export type Order = {
  id: string;
  reference: string;
  status: OrderStatus;
  totalKobo: number;
  createdAt: string;
  items: OrderItem[];
};

export async function fetchOrders(): Promise<Order[]> {
  const body = await request<{ orders: Order[] }>("/api/orders");
  return body.orders;
}

export type DeliveryDetails = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
};

export type CheckoutStart = { paymentUrl: string; orderId: string };

// Creates a pending order from the cart and returns Paystack's payment page.
export function startCheckout(details: DeliveryDetails): Promise<CheckoutStart> {
  return request<CheckoutStart>("/api/checkout", {
    method: "POST",
    body: JSON.stringify(details),
  });
}

// Asks the shop to re-check an order's payment with Paystack. Safe to repeat.
export async function confirmOrder(orderId: string): Promise<OrderStatus> {
  const body = await request<{ status: OrderStatus }>(
    `/api/orders/${orderId}/confirm`,
    { method: "POST" }
  );
  return body.status;
}