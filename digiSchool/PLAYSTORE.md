# Publishing EduOne to the Google Play Store

This is the end-to-end checklist to get `com.eduone.app` live on Play. Steps
marked **(you)** require your Google account / payment / legal decisions and
cannot be automated. Everything else is already wired up in this repo.

---

## 0. One-time setup **(you)**
1. Create a **Google Play Developer account** at
   https://play.google.com/console — one-time **$25** fee, plus identity
   verification (can take a few days for individual accounts).
2. Decide on and host a **Privacy Policy URL** — Play requires one because the
   app handles personal data (student/guardian records via Supabase). A simple
   page on your website or a Google Doc set to public works.

---

## 1. Create your upload keystore (once) **(you)**
Your signing key proves every future update comes from you. Keep it safe and
backed up. Run this in `digiSchool/android/` (uses the JDK that ships with
Android Studio):

```bash
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

It will prompt for a password and your name/org. Then create
`digiSchool/android/keystore.properties` (copy from `keystore.properties.example`):

```properties
storeFile=upload-keystore.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=upload
keyPassword=YOUR_KEY_PASSWORD
```

> `upload-keystore.jks` and `keystore.properties` are **git-ignored** — they must
> never be committed. Back them up privately (password manager / secure storage).
> With **Play App Signing** (enabled by default) Google holds the real signing
> key, so a lost *upload* key can be reset — but don't rely on that.

---

## 2. Point the app at your deployed backend **(you)**
So the email/PIN endpoints work on device, set the backend origin before
building (see MOBILE.md):

```properties
# digiSchool/.env.production
VITE_API_BASE_URL=https://your-deployed-app.vercel.app
```

---

## 3. Build the release bundle (the `.aab`)
From `digiSchool/`:

```bash
npm run android:bundle
```

This runs `vite build` → `cap sync` → `gradlew bundleRelease` and produces the
signed **Android App Bundle** at:

```
digiSchool/android/app/build/outputs/bundle/release/app-release.aab
```

That `.aab` is the file you upload to Play. (Play generates per-device APKs from
it.)

---

## 4. Create the app in Play Console **(you)**
1. **Create app** → name **EduOne**, language, type **App**, Free/Paid.
2. **Store listing** — use the ready-made assets in `digiSchool/play/`:
   - **App icon (512×512):** `play/icon-512.png`
   - **Feature graphic (1024×500):** `play/feature-graphic-1024x500.png`
   - **Phone screenshots (min 2):** capture from a running device/emulator —
     see step 5. (Play needs at least two 16:9 or 9:16 screenshots.)
   - Short description (≤80 chars) and full description — draft below.
3. Complete the required **policy** sections:
   - **Privacy Policy** URL (from step 0).
   - **Data safety** form — declare what you collect (names, email, academic
     records) and that it's encrypted in transit. Be accurate.
   - **Content rating** questionnaire.
   - **Target audience** (this is an admin/education tool — not directed at
     children under 13; answer accordingly).
   - **App access** — if sign-in is required, provide test credentials so the
     reviewer can log in.

---

## 5. Screenshots (min 2) **(you or ask me)**
Run the app and capture 2–8 phone screenshots (e.g. the dashboard, class list,
timetable, report card). Easiest path: `npm run android:run` on an emulator,
then use the emulator's camera button. Save them under `digiSchool/play/`.
*(I can capture these from the running web app at phone dimensions if you want.)*

---

## 6. Upload & roll out **(you)**
1. Start with **Testing → Internal testing** (fastest; add your email as a
   tester) to smoke-test the signed build on real devices.
2. Create a release, upload `app-release.aab`, add release notes, review, roll
   out to internal testers.
3. When happy: **Production** → create release → upload the same (or a newer)
   `.aab` → submit for review. First review typically takes a few days.

---

## Updating later
Bump the version in `digiSchool/android/app/build.gradle` every release
(`versionCode` **must** increase; `versionName` is the label users see):

```gradle
versionCode 2
versionName "1.0.2"
```
Then `npm run android:bundle` and upload the new `.aab`.

---

## Draft store text (edit freely)
**Short description:** All-in-one school management — students, timetables,
grades, fees and reports (CBC & 8-4-4).

**Full description:** EduOne is a complete school management system for Kenyan
schools. Manage student records and streams, generate class registers and CBC/
KCSE report cards, build timetables, track attendance, handle fees and finance,
and give parents, teachers and administrators their own secure portals — online
or offline.
