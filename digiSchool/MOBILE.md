# EduOne — Native Mobile Apps (iOS & Android)

The mobile apps are the **same React/Vite web app** wrapped in a native shell with
[Capacitor](https://capacitorjs.com). There is no second codebase: every screen,
route, Supabase call and PDF export is shared. Capacitor bundles the production
web build (`dist/`) inside a native container and exposes native APIs (status bar,
splash screen, hardware back button, keyboard) through plugins.

- **App name:** EduOne
- **Bundle / Application ID:** `com.eduone.app`
- **Native projects:** `android/` (Gradle) and `ios/` (Xcode, Swift Package Manager)

---

## Prerequisites

| Target | Needs |
|--------|-------|
| Android | [Android Studio](https://developer.android.com/studio) + Android SDK, JDK 17–21 (Android Studio bundles a JBR 21) |
| iOS | A **Mac** with Xcode 15+ and CocoaPods-free SPM (Capacitor 8 uses Swift Package Manager) |
| Both | Node 20+, `npm install` already run in `digiSchool/` |

> iOS **cannot** be built on Windows/Linux — Apple requires macOS + Xcode. The
> `ios/` project is committed and ready; open it on a Mac to build and ship.

---

## The one command you need

Any time you change web code, rebuild and push it into the native projects:

```bash
npm run mobile:build
```

That runs `vite build` then `cap sync` (copies `dist/` into both native projects
and updates native plugins). Then open the platform you want:

```bash
npm run android:open   # opens Android Studio
npm run ios:open       # opens Xcode (Mac only)
```

Or build + run on a connected device/emulator in one step:

```bash
npm run android:run
npm run ios:run        # Mac only
```

---

## Backend configuration (important)

On the web the app calls its server functions at same-origin `/api/*`
(`send-email`, `send-pin`, `send-message`). Inside the native shell the page is
served from Capacitor's local server (`https://localhost`), so those relative
paths would 404.

Set the deployed backend origin for **release builds** via an env var before
`mobile:build`:

```bash
# digiSchool/.env  (or .env.production)
VITE_API_BASE_URL=https://your-deployed-app.vercel.app
```

When set, `src/lib/apiBase.js` prefixes every `/api/*` call with it. When unset,
behaviour is unchanged (relative, same-origin) so the **web build is identical**.

Supabase (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) already works over the
network from the device — nothing extra needed there.

---

## App icons & splash screen

Source art lives in `assets/` (1024² icon layers + 2732² splash on brand navy
`#0f172a`). Regenerate all platform densities after changing the source:

```bash
npm run mobile:assets
```

This regenerates Android adaptive icons + splash and the iOS `AppIcon` /
`Splash` image sets.

---

## Building a release

### Android (APK / AAB)
1. `npm run mobile:build`
2. `npm run android:open`
3. In Android Studio: **Build → Generate Signed Bundle / APK**, create/select a
   keystore, choose **release**. Upload the `.aab` to the Play Console.
   (Bump `versionCode`/`versionName` in `android/app/build.gradle`.)

### iOS (App Store)
1. `npm run mobile:build`
2. `npm run ios:open` (on a Mac)
3. In Xcode: set your Team under **Signing & Capabilities**, pick **Any iOS
   Device**, then **Product → Archive** and distribute via the Organizer.
   (Bump the version/build under the target's **General** tab.)

---

## Native behaviour wired up

`src/lib/native.js` (a no-op on web) configures the shell on launch:

- **Status bar** — dark navy, light content, sits above the web view (no overlap).
- **Splash screen** — brand navy, hidden once the app has painted.
- **Android back button** — walks SPA history; exits the app at the root.
- **Safe areas** — `index.html` uses `viewport-fit=cover`; `index.css` applies
  `env(safe-area-inset-*)` only under `html.capacitor`, so the web build is untouched.
- **Service worker** — the PWA service worker is **not** registered natively
  (Capacitor already serves assets locally), avoiding double-caching.

---

## Troubleshooting

- **Android `Invalid file path` / SDK not found** — ensure
  `android/local.properties` has `sdk.dir=C:/path/to/Android/Sdk` (forward
  slashes). This file is machine-specific and git-ignored.
- **Gradle JDK error** — build with JDK 17–21. Point `JAVA_HOME` at Android
  Studio's bundled JBR, e.g. `C:/Program Files/Android/Android Studio/jbr`.
- **White screen on device** — you forgot `cap sync`; run `npm run mobile:build`.
- **`/api/*` calls fail on device** — set `VITE_API_BASE_URL` (see above).
