import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Cookie consent banner. Shown once until the visitor chooses; the choice is
// stored in localStorage and used to opt PostHog analytics in or out, so no
// non-essential tracking happens without consent.
const CONSENT_KEY = 'eo_cookie_consent';

function applyAnalyticsConsent(choice) {
  // Guarded: PostHog may not be initialised (no key configured). Never throw.
  import('posthog-js')
    .then(({ default: posthog }) => {
      if (!posthog || !posthog.__loaded) return;
      if (choice === 'granted') posthog.opt_in_capturing();
      else posthog.opt_out_capturing();
    })
    .catch(() => {});
}

export function getStoredConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getStoredConsent()) setVisible(true);
  }, []);

  const decide = (choice) => {
    try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* private mode */ }
    applyAnalyticsConsent(choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="Cookie consent" style={styles.wrap}>
      <div style={styles.text}>
        We use essential cookies to run EduOne and, with your consent, privacy-friendly analytics to improve it.{' '}
        <a
          href="/privacy"
          style={styles.link}
          onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}
        >
          Learn more
        </a>.
      </div>
      <div style={styles.actions}>
        <button style={{ ...styles.btn, ...styles.decline }} onClick={() => decide('denied')}>Decline</button>
        <button style={{ ...styles.btn, ...styles.accept }} onClick={() => decide('granted')}>Accept</button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 9998,
    maxWidth: 560, margin: '0 auto',
    background: '#0f172a', color: '#e2e8f0',
    borderRadius: 14, padding: '16px 18px',
    boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13.5, lineHeight: 1.5,
  },
  text: { flex: '1 1 240px' },
  link: { color: '#7dd3fc', textDecoration: 'underline' },
  actions: { display: 'flex', gap: 8, marginLeft: 'auto' },
  btn: { borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent' },
  decline: { background: 'transparent', color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.25)' },
  accept: { background: '#10b981', color: '#04241a' },
};
