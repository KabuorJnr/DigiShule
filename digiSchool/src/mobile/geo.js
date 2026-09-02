import { isNative } from '../lib/native';

// Get the device's current GPS position as { lat, lng }. Uses the Capacitor
// Geolocation plugin on native (handles the runtime permission prompt), and the
// browser Geolocation API on the web. Throws on denial/timeout so callers can
// show a message.
export async function getCurrentPosition() {
  if (isNative()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
          throw new Error('Location permission denied');
        }
      }
    } catch (e) {
      // Some devices throw from checkPermissions before a request — fall through
      // to getCurrentPosition, which will prompt or fail cleanly.
      if (/denied/i.test(e.message || '')) throw e;
    }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location not supported on this device')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message || 'Could not get your location')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// Metres between two lat/lng points (haversine) — same formula as the desktop
// clock-in widget, so the geofence behaves identically.
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
