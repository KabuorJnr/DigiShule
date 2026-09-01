import { useState, useEffect } from 'react';
import { isNative } from '../lib/native';

// The mobile app shell activates on phones: any Capacitor native build, or a
// narrow browser viewport (<= 768px). Everything else keeps the desktop web
// dashboard exactly as before. Kept as a hook so the UI re-evaluates live when
// the window is resized (e.g. a developer toggling device emulation).
const MOBILE_MAX = 768;

export function isMobileNow() {
  if (isNative()) return true;
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
}

export function useIsMobile() {
  const [mobile, setMobile] = useState(isMobileNow);

  useEffect(() => {
    if (isNative()) return; // native is always mobile — no listener needed
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const onChange = () => setMobile(mq.matches);
    onChange();
    // Safari <14 uses addListener; modern uses addEventListener.
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return mobile;
}
