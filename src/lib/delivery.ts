import type { DeliveryDetails } from "./api";

export type DeliveryErrors = Partial<Record<keyof DeliveryDetails, string>>;

// Mirrors the website's checkout rules (src/lib/validations/checkout.ts in the
// shop repo). The server checks again, so this only gives quick feedback.
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{9,14}$/;

export function validateDelivery(details: DeliveryDetails): DeliveryErrors {
  const errors: DeliveryErrors = {};

  if (details.fullName.trim().length < 2) {
    errors.fullName = "Enter your full name";
  }

  if (!PHONE_PATTERN.test(details.phone.trim())) {
    errors.phone = "Enter a valid phone number";
  }

  if (details.address.trim().length < 5) {
    errors.address = "Enter your delivery address";
  }

  if (details.city.trim().length < 2) {
    errors.city = "Enter your city";
  }

  if (details.state.trim().length < 2) {
    errors.state = "Enter your state";
  }

  return errors;
}