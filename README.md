# Crafted Mobile

The mobile app for **Crafted**, a small online shop for handmade Nigerian goods.
It talks to the same API as the website and signs in with the same Google
account, so you have **one cart on both**. Add something on the website and it
appears on your phone straight away, and you can check out from the phone.

- **Website:** https://shop-checkout-six.vercel.app
- **Website code:** https://github.com/Oluwaseyifunmixx/shop-checkout

## What it does

- Browse the products, with photos and prices in naira.
- Search the shop: the product list filters by name or description as you type.
- Sign in with Google. It is the same Supabase account as the website.
- Add to cart, change quantities and remove items, from the phone.
- **Live cart sync:** changes made on the website show up on the phone
  instantly, with no refresh. The Cart tab shows a live item count.
- **Checkout from the phone:** enter delivery details, pay through Paystack in
  the phone's browser, and come back to a confirmed order.
- Your orders: the Orders tab lists your orders with a Paid, Awaiting payment or
  Payment failed badge, like the website's My orders page. Awaiting orders have
  a **Check payment status** button.
- Account tab with your details and a sign-out that signs out **this phone
  only**, not the website.

## Tech stack

- Expo SDK 57 (React Native), Expo Router, TypeScript
- Supabase (Auth and Realtime) via `@supabase/supabase-js`
- `@react-native-async-storage/async-storage` to keep the login on the phone
- `expo-linking` for the Google sign-in round trip and for opening Paystack

## How it works

```
Phone ──(HTTPS, Bearer token)──> Crafted website API ──> Supabase (Row Level Security)
Phone <──────── Realtime: "cart_items changed" ───────── Supabase
```

**Same endpoints as the website.** The app calls the website's route handlers
and sends the user's login token in the `Authorization` header:

| Endpoint | Used for |
| --- | --- |
| `GET /api/products` | The shop screen (public) |
| `GET /api/cart` | The cart and its totals |
| `POST /api/cart` | Add one of a product |
| `PATCH /api/cart/[itemId]` | Set a quantity |
| `DELETE /api/cart/[itemId]` | Remove an item |
| `GET /api/orders` | The Orders tab |
| `POST /api/checkout` | Start a payment for the cart. Body: the delivery details |
| `POST /api/orders/[orderId]/confirm` | Re-check an order's payment with Paystack |

**One login on both.** The app signs in with Google through Supabase, so the
phone and the website share one user and one cart. The API checks the token
with Supabase, and the database's Row Level Security still applies, so a shopper
can only ever reach their own cart.

**Signing in on a phone.** The app asks Supabase for Google's sign-in address and
opens it with `Linking.openURL`, so Android chooses the app that shows the page
(normally the default browser). When Google finishes, Supabase sends a link that
reopens the app, and the app turns it into a saved login. That link must be on
Supabase's Redirect URLs list.

**Instant sync.** The app subscribes to changes on the `cart_items` table. When
anything changes, it reloads the cart from `GET /api/cart`. The notification
only says *something changed*; the API gives the real answer, so there is one
source of truth and no merging logic. The cart lives in a single shared
provider (`src/lib/shop-context.tsx`), so the Cart screen and the tab badge
always agree and only one live connection is open. The cart is also reloaded
whenever the app comes back to the front, because the live connection can pause
while the app is in the background (for example, on Paystack's page).

**Checking out from the phone.**

1. The **Checkout** button on the Cart screen opens a delivery form with the same
   five fields and rules as the website.
2. **Pay** calls `POST /api/checkout`. The server builds the order from the
   shopper's cart using **database prices**, so the phone only ever sends
   delivery details, never prices or a total. It starts a Paystack payment and
   returns the payment page address and the order id.
3. The app opens Paystack in the phone's browser. After paying, Paystack sends
   the browser to a small page on the website (`/checkout/mobile-return`). That
   page confirms the payment on the server, which marks the order paid, empties
   the cart and sends the confirmation email, once, and then tells the shopper
   to go back to the app.
4. The shopper returns to the app by hand (the back button, or recent apps). The
   app re-checks the payment by itself with `POST /api/orders/[orderId]/confirm`
   and shows **Payment received**. An order that is still awaiting payment can
   be re-checked later from the Orders tab. The check is safe to repeat, because
   an order can only be marked paid once.

Paystack runs in **test mode**. To pay, use Paystack's test card
**4084 0840 8408 4081**, any future expiry date and CVV **408**. If asked, the
PIN is **0000** and the OTP is **123456**. No real money is taken.

## Run it

You need Node.js, and **Expo Go** on an Android phone. It was built and tested
on a Samsung Android phone through Expo Go.

```bash
git clone <this repository>
cd crafted-mobile
npm install
cp .env.example .env.local     # then fill in the two values
npx expo start --tunnel
```

Scan the QR code with Expo Go.

**Use `--tunnel`.** In our testing, Supabase did not send the Google sign-in back
to the app when the return link used a raw IP address (what Expo uses on Wi-Fi),
even though the link was on its allowed list. A tunnel link
(`exp://<name>.exp.direct/...`) worked.

## Use your own Supabase project

The app only needs the website's API and the same Supabase project:

1. Deploy the website, and put its address in `API_URL` in `src/lib/api.ts`.
   Paystack and Mailgun are configured on the website. The app never holds
   their keys.
2. Put your project's URL and publishable key in `.env.local`.
3. Supabase, **Authentication → URL Configuration → Redirect URLs**: add
   `exp://**` (this is loose and for development only; for a real release use
   the app's own scheme, or at least `exp://*.exp.direct/**`).
4. Switch Realtime on for the cart table (SQL editor):

```sql
   alter publication supabase_realtime add table public.cart_items;
```

## Project structure

```
src/
├── app/
│   ├── _layout.tsx        Wraps the app in the shared cart provider and tabs
│   ├── index.tsx          Shop: product grid and search
│   ├── cart.tsx           Cart: quantities, totals, remove, and the checkout panel
│   ├── orders.tsx         Orders: your orders, their status and payment re-check
│   ├── account.tsx        Account: details and sign out
│   └── auth-callback.tsx  Where the Google sign-in link lands
├── components/
│   ├── checkout-panel.tsx Delivery form, payment and the result screens
│   └── ...                Tab bar and shared UI from the Expo template
├── constants/             Theme and brand colour
└── lib/
    ├── supabase.ts        The Supabase client, with the login saved on the phone
    ├── auth.ts            Google sign-in and sign-out
    ├── api.ts             Calls to the website API, with the login token attached
    ├── shop-context.tsx   Shared login and cart, plus the live subscription
    ├── delivery.ts        Delivery form checks (the server checks again)
    └── format.ts          Kobo to naira, and order dates
```

## Security notes

- The app only holds Supabase's **publishable** key, which is public by design.
  The secret key is never in this app, and neither are any Paystack keys.
- Every cart and checkout request carries the user's own token, so Row Level
  Security protects each shopper's data. On the website side, the routes that
  change data accept the token only, not a browser cookie.
- Prices and totals come from the server. The phone sends delivery details only,
  and the website confirms a payment with Paystack, including the amount and
  currency, before an order is marked paid.
- The checkout response contains the order id, never the payment reference.
- Signing out uses Supabase's `local` scope, so it only signs out this phone.
- The sign-in link carries the login token itself (Supabase's default flow).
  The safer PKCE flow needs a SHA-256 function that React Native does not
  provide, so without a shim it falls back to a weaker check. For a real release,
  use a development build with the app's own link scheme and a narrow Redirect
  URLs entry.

## Known limitations

- **Sign-in and the tunnel.** Supabase rejected return links that use a raw IP
  address in our testing, so run Expo with `--tunnel`.
- **Sign-in history.** An earlier version opened Google in Expo's in-app browser
  window. On Android it sometimes left a stale window showing raw redirect text,
  and sign-in failed about every other attempt. Opening the link with
  `Linking.openURL` instead gave about ten sign-ins in a row without a failure.
  That is a small sample and the cause was inferred, not proven. If a sign-in
  ever stalls, return to the app and tap Sign in again. Each sign-in leaves one
  browser tab behind, because an app cannot close a browser tab on Android.
  Those pages contain a login token in their address, so close them.
- **Returning from Paystack is manual.** The payment confirmation page on the
  website cannot reopen the app. A "back to the app" button was tried and did
  nothing on the tested phone, so the page tells the shopper to use the back
  button or recent apps, and the app re-checks the payment when it returns.
- **Orders are created when you tap Pay.** If you leave without paying, the
  order stays under Awaiting payment, as on the website.
- Confirmation emails are sent by the website through Mailgun's free sandbox,
  so they only reach authorised addresses.
- Live sync runs **website to phone**. A change made on the phone shows on the
  website after a refresh, because the website does not listen for changes.
- The live subscription is not filtered by user. Each notification just reloads
  your own cart through the API.
- Orders load when you open the tab or pull down to refresh, not live.
- The tab bar uses Expo Router's native tabs, which Expo still marks as alpha.
- Only Android with Expo Go has been tested, and only in Paystack's test mode.
  iOS has not been tested.
- Not built yet: product categories.