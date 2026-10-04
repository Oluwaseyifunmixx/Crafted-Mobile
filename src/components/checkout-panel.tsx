import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Accent } from "@/constants/brand";
import { Colors } from "@/constants/theme";
import {
  confirmOrder,
  startCheckout,
  type DeliveryDetails,
  type OrderStatus,
} from "@/lib/api";
import { validateDelivery, type DeliveryErrors } from "@/lib/delivery";
import { formatNaira } from "@/lib/format";
import { useShop } from "@/lib/shop-context";

type Step = "form" | "waiting" | "paid";

type FieldConfig = {
  key: keyof DeliveryDetails;
  label: string;
  placeholder: string;
  keyboardType?: "default" | "phone-pad";
  autoCapitalize?: "none" | "words";
};

const FIELDS: FieldConfig[] = [
  { key: "fullName", label: "Full name", placeholder: "Ada Okafor", autoCapitalize: "words" },
  { key: "phone", label: "Phone number", placeholder: "08012345678", keyboardType: "phone-pad" },
  { key: "address", label: "Delivery address", placeholder: "12 Allen Avenue", autoCapitalize: "words" },
  { key: "city", label: "City", placeholder: "Ikeja", autoCapitalize: "words" },
  { key: "state", label: "State", placeholder: "Lagos", autoCapitalize: "words" },
];

const EMPTY_DETAILS: DeliveryDetails = {
  fullName: "",
  phone: "",
  address: "",
  city: "",
  state: "",
};

type CheckoutPanelProps = {
  // The cart total when checkout was opened. Kept as given, because the cart
  // empties as soon as the payment is confirmed.
  subtotalKobo: number;
  onClose: () => void;
};

export function CheckoutPanel({ subtotalKobo, onClose }: CheckoutPanelProps) {
  const router = useRouter();
    const { refreshCart } = useShop();
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  const [step, setStep] = useState<Step>("form");
  const [values, setValues] = useState<DeliveryDetails>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<DeliveryErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [order, setOrder] = useState<{ id: string; paymentUrl: string } | null>(
    null
  );

  function openPaymentPage(url: string) {
    Linking.openURL(url).catch(() =>
      setNotice(
        "We couldn't open the payment page. Tap Open payment page to try again."
      )
    );
  }

  function handleStatus(status: OrderStatus) {
    if (status === "paid") {
      setStep("paid");
      return;
    }

    if (status === "failed") {
      setOrder(null);
      setNotice(null);
      setFormError(
        "Your payment didn't go through. You haven't been charged, and your cart is still saved."
      );
      setStep("form");
      return;
    }

    setNotice(
      "We haven't received your payment yet. If you've just paid, wait a few seconds and check again."
    );
  }

  const checkPayment = useCallback(async (orderId: string) => {
    setChecking(true);

    try {
      handleStatus(await confirmOrder(orderId));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "We couldn't check the payment. Please try again."
      );
    } finally {
      setChecking(false);
    }
    // handleStatus only uses state setters, which never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
    // A payment empties the cart on the server. Reload it, in case the live
  // message was missed while the app was in the background.
  useEffect(() => {
    if (step === "paid") {
      refreshCart();
    }
  }, [step, refreshCart]);

  // When the shopper comes back from the browser, check the payment for them.
  useEffect(() => {
    if (step !== "waiting" || !order) {
      return;
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkPayment(order.id);
      }
    });

    return () => subscription.remove();
  }, [step, order, checkPayment]);

  async function handlePay() {
    const found = validateDelivery(values);
    setErrors(found);
    setFormError(null);

    if (Object.keys(found).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const started = await startCheckout(values);
      setOrder({ id: started.orderId, paymentUrl: started.paymentUrl });
      setNotice(null);
      setStep("waiting");
      openPaymentPage(started.paymentUrl);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "paid") {
    return (
      <View style={styles.centered}>
        <Text style={styles.paidIcon}>✓</Text>
        <ThemedText type="title" style={styles.centerText}>
          Payment received
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Thank you! Your order is confirmed.
        </ThemedText>
        {order && (
          <ThemedText type="small" themeColor="textSecondary">
            Order reference: {order.id.slice(0, 8).toUpperCase()}
          </ThemedText>
        )}
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            router.navigate("/orders");
            onClose();
          }}
        >
          <Text style={styles.primaryLabel}>View my orders</Text>
        </Pressable>
        <Pressable
          style={styles.linkButton}
          onPress={() => {
            router.navigate("/");
            onClose();
          }}
        >
          <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>
            Continue shopping
          </Text>
        </Pressable>
      </View>
    );
  }

  if (step === "waiting" && order) {
    return (
      <View style={styles.centered}>
        <ThemedText type="smallBold" style={styles.centerText}>
          Complete your payment in the browser
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.centerText}
        >
          When you have paid, come back to this app. We will check your payment
          automatically.
        </ThemedText>

        {notice && (
          <ThemedText type="small" style={styles.centerText}>
            {notice}
          </ThemedText>
        )}

        <Pressable
          style={[styles.primaryButton, checking && styles.disabled]}
          onPress={() => checkPayment(order.id)}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryLabel}>I&apos;ve paid, check my payment</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.outlineButton}
          onPress={() => openPaymentPage(order.paymentUrl)}
        >
          <Text style={[styles.outlineLabel, { color: colors.text }]}>
            Open payment page
          </Text>
        </Pressable>

        <Pressable style={styles.linkButton} onPress={onClose}>
          <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>
            Back to cart (the order stays under Awaiting payment)
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedText type="small" themeColor="textSecondary">
        Delivery details · {formatNaira(subtotalKobo)} to pay
      </ThemedText>

      {FIELDS.map((field) => (
        <View key={field.key} style={styles.field}>
          <ThemedText type="smallBold">{field.label}</ThemedText>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.backgroundElement, color: colors.text },
              errors[field.key] ? styles.inputError : null,
            ]}
            value={values[field.key]}
            onChangeText={(text) =>
              setValues((current) => ({ ...current, [field.key]: text }))
            }
            placeholder={field.placeholder}
            placeholderTextColor={colors.textSecondary}
            keyboardType={field.keyboardType ?? "default"}
            autoCapitalize={field.autoCapitalize ?? "none"}
            autoCorrect={false}
          />
          {errors[field.key] && (
            <ThemedText type="small" style={styles.error}>
              {errors[field.key]}
            </ThemedText>
          )}
        </View>
      ))}

      {formError && (
        <ThemedText type="small" style={styles.error}>
          {formError}
        </ThemedText>
      )}

      <Pressable
        style={[styles.primaryButton, submitting && styles.disabled]}
        onPress={handlePay}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.primaryLabel}>Pay {formatNaira(subtotalKobo)}</Text>
        )}
      </Pressable>

      <Pressable style={styles.linkButton} onPress={onClose}>
        <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>
          Back to cart
        </Text>
      </Pressable>

      <ThemedView style={styles.testNote}>
        <ThemedText type="small" themeColor="textSecondary">
          Payments run in Paystack&apos;s test mode: no real money is taken.
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  field: { gap: 6 },
  input: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputError: { borderColor: "#DC2626" },
  error: { color: "#DC2626" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  centerText: { textAlign: "center" },
  paidIcon: { fontSize: 56, color: "#16A34A", fontWeight: "700" },
  primaryButton: {
    minWidth: 220,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  outlineButton: {
    minWidth: 220,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineLabel: { fontWeight: "600" },
  linkButton: { paddingVertical: 8, paddingHorizontal: 8 },
  linkLabel: { textAlign: "center" },
  disabled: { opacity: 0.6 },
  testNote: { alignItems: "center", paddingTop: 8 },
});