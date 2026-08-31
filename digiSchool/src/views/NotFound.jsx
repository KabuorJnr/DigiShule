import { useNavigate } from 'react-router-dom';
import { useSEO } from '../lib/seo';

export default function NotFound() {
  const navigate = useNavigate();
  useSEO({
    title: 'Page not found — EduOne',
    description: 'The page you are looking for could not be found.',
    noindex: true,
  });

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src="/logo.png" alt="EduOne" style={styles.logo} />
        <div style={styles.code}>404</div>
        <h1 style={styles.h1}>This page took a day off</h1>
        <p style={styles.p}>
          The link may be broken or the page may have moved. Let&rsquo;s get you back on track.
        </p>
        <div style={styles.actions}>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => navigate('/')}>Go to homepage</button>
          <button style={{ ...styles.btn, ...styles.btnGhost }} onClick={() => navigate('/login')}>Sign in</button>
          <button style={{ ...styles.btn, ...styles.btnGhost }} onClick={() => navigate('/book-demo')}>Contact us</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: 24, fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a' },
  card: { textAlign: 'center', maxWidth: 460 },
  logo: { height: 40, marginBottom: 20 },
  code: { fontSize: 72, fontWeight: 900, lineHeight: 1, background: 'linear-gradient(135deg, #047857, #0ea5e9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  h1: { fontSize: 26, fontWeight: 800, margin: '12px 0 8px' },
  p: { color: '#64748b', fontSize: 15.5, lineHeight: 1.6, margin: '0 0 24px' },
  actions: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  btn: { borderRadius: 10, padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent' },
  btnPrimary: { background: '#047857', color: '#fff' },
  btnGhost: { background: '#fff', color: '#334155', borderColor: '#cbd5e1' },
};
