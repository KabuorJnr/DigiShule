// Native (Capacitor) runtime wiring.
//
// Everything here is a no-op on the web build: `Capacitor.isNativePlatform()`
// returns false in a browser, so `initNative()` returns early and the web app
// behaves exactly as before. Only inside the iOS/Android shell do the native
// plugins get touched, and each is imported lazily so the web bundle never
// pulls native-only code onto the critical path.
import { Capacitor } from '@capacitor/core';

export const isNative = () => {
  try {
    return Capacitor?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
};

export const nativePlatform = () => {
  try {
    return Capacitor?.getPlatform?.() ?? 'web';
  } catch {
    return 'web';
  }
};

// Configure the native shell once the web app has mounted: status bar,
// hardware back button, keyboard behaviour, then dismiss the splash screen.
export async function initNative() {
  if (!isNative()) return;

  // Lets CSS target the app shell (safe-area insets, etc.) without affecting web.
  document.documentElement.classList.add('capacitor', `platform-${nativePlatform()}`);

  // Status bar: dark navy background with light content, sitting above the app.
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    if (nativePlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0B1B3E' });
    }
  } catch { /* status bar plugin unavailable — ignore */ }

  // Android hardware back button: walk the SPA history, exit at the root.
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
  } catch { /* app plugin unavailable — ignore */ }

  // Dismiss the splash once the first paint is done.
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* splash plugin unavailable — ignore */ }
}
