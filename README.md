# Crafted Mobile

The mobile app for **Crafted**, a small online shop for handmade Nigerian goods.
It talks to the same API as the website and signs in with the same Google
account, so you have **one cart on both**. Add something on the website and it
appears on your phone straight away.

- **Website:** https://shop-checkout-six.vercel.app
- **Website code:** https://github.com/Oluwaseyifunmixx/shop-checkout

## What it does

- Browse the products, with photos and prices in naira.
- Sign in with Google. It is the same Supabase account as the website.
- Add to cart, change quantities and remove items, from the phone.
- **Live cart sync:** changes made on the website show up on the phone
  instantly, with no refresh. The Cart tab shows a live item count.
- Account tab with your details and a sign-out that signs out **this phone
  only**, not the website.
  - Search to shop: the product list filters by name or description as you type.
  - Your orders: the Orders tab lists your orders with a Paid, Awaiting payment or
  Payment failed badge, like the website's My orders page.

## Tech stack

- Expo SDK 57 (React Native), Expo Router, TypeScript
- Supabase (Auth and Realtime) via `@supabase/supabase-js`
- `@react-native-async-storage/async-storage` to keep the login on the phone
- `expo-web-browser` and `expo-linking` for the Google sign-in round trip

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

**One login on both.** The app signs in with Google through Supabase, so the
phone and the website share one user and one cart. The API checks the token
with Supabase, and the database's Row Level Security still applies, so a shopper
can only ever reach their own cart.

**Instant sync.** The app subscribes to changes on the `cart_items` table. When
anything changes, it reloads the cart from `GET /api/cart`. The notification
only says *something changed*; the API gives the real answer, so there is one
source of truth and no merging logic. The cart lives in a single shared
provider (`src/lib/shop-context.tsx`), so the Cart screen and the tab badge
always agree and only one live connection is open.

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
│   ├── index.tsx          Shop: product grid
│   ├── cart.tsx           Cart: quantities, totals, remove
│   ├── orders.tsx         Orders: your orders and their payment status
│   ├── account.tsx        Account: details and sign out
│   └── auth-callback.tsx  Where the Google sign-in link lands
├── components/            Tab bar and shared UI from the Expo template
├── constants/             Theme and brand colour
└── lib/
    ├── supabase.ts        The Supabase client, with the login saved on the phone
    ├── auth.ts            Google sign-in and sign-out
    ├── api.ts             Calls to the website API, with the login token attached
    ├── shop-context.tsx   Shared login and cart, plus the live subscription
    └── format.ts          Kobo to naira
```

## Security notes

- The app only holds Supabase's **publishable** key, which is public by design.
  The secret key is never in this app.
- Every cart request carries the user's own token, so Row Level Security protects
  each shopper's data.
- Prices come from the server. The app only displays them.
- Signing out uses Supabase's `local` scope, so it only signs out this phone.

## Known limitations

- **Sign-in is sometimes flaky.** Occasionally the Google sign-in ends on a
  window showing raw text that starts with `<a href=`, and the app is not signed
  in. Tap the **X**, reopen Crafted from Expo Go, and sign in again. This
  usually works on the next attempt. The cause is not identified.
- Live sync runs **website to phone**. A change made on the phone shows on the
  website after a refresh, because the website does not listen for changes.
- The live subscription is not filtered by user. Each notification just reloads
  your own cart through the API.
- The tab bar uses Expo Router's native tabs, which Expo still marks as alpha.
- Only Android with Expo Go has been tested. iOS has not.
- Orders load when you open the tab or pull down to refresh, not live. An
  awaiting-payment order can only be re-checked on the website.
- Not built yet: checkout from the phone, and product categories.