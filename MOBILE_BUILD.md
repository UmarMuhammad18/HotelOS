# HotelOS Mobile — build & release

The app lives in **`hotelos-mobile/`** (Expo SDK **51**, TypeScript, React Navigation 6, Zustand, React Native Paper, Reanimated, Lottie, Expo Notifications).

## Prerequisites

- Node 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) via `npx expo`
- For device testing: Expo Go, or a dev client from EAS

## Environment

1. **Build-time**: copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to your API origin (no trailing slash).
2. **Runtime** (especially on real devices): open **Settings** in the app and set **API base URL** (persisted with AsyncStorage). This overrides the default localhost URL so phones can reach your LAN IP or cloud host.

WebSockets are derived from the HTTP URL (`http` → `ws`, `https` → `wss`) unless you add `EXPO_PUBLIC_WS_URL`.

## Run locally

```bash
cd hotelos-mobile
npm install
npx expo start
```

Press `i` / `a` for iOS simulator or Android emulator, or scan the QR code with Expo Go.

## Charts note

The web dashboard uses **Recharts** (DOM). React Native does not run Recharts directly. This project uses **metric cards + Lottie** on the home screen; you can add **Victory Native**, **react-native-skia**, or **gifted-charts** in a follow-up if you need parity with web charts.

## EAS Build — Android APK / AAB

1. Install EAS CLI: `npm i -g eas-cli`
2. In `hotelos-mobile`, run `eas login` then `eas build:configure`
3. Update `app.json` / `eas.json` with your **Apple** / **Google** bundle identifiers and signing.
4. Android APK (side-load / internal testing):

```bash
cd hotelos-mobile
eas build -p android --profile preview
```

Use a profile in `eas.json` with `"android": { "buildType": "apk" }` for a direct APK artifact.

5. **Play Store** (AAB): use `"buildType": "app-bundle"` in the `production` profile.

## EAS Build — iOS

```bash
eas build -p ios --profile production
```

Requires Apple Developer membership and credentials configured in EAS.

## Stripe in the mobile app

Purchases call **`POST /api/create-checkout-session`** and open the returned URL in **`expo-web-browser`**. Your API must have **`STRIPE_SECRET_KEY`** set and publicly reachable **`successUrl` / `cancelUrl`** hosts (Expo linking URLs work for returns when using a dev client with the `hotelos` scheme).

For **PaymentIntent + native payment sheet**, add `@stripe/stripe-react-native`, run `expo prebuild`, and use an EAS **development build** (Expo Go does not include all native Stripe modules).

## Push notifications (Expo)

The app requests notification permissions on launch. To obtain a usable **Expo push token**, configure **`expo.extra.eas.projectId`** after running `eas init`, then rebuild with EAS. Push delivery from the Node API can be added later with `expo-server-sdk`.

## Offline mode

Recent **rooms**, **tasks**, and a slice of **events** are cached via Zustand + AsyncStorage. When the feed socket drops, an **offline** banner appears on the home screen until the connection returns.
