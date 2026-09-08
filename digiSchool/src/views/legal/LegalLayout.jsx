import { useNavigate } from 'react-router-dom';

// Shared, self-contained shell for the public legal/utility pages (Privacy,
// Terms, 404). Deliberately does NOT pull in the heavy landing-page CSS — it
// carries its own small, readable styling so these pages stay lightweight.
export default function LegalLayout({ title, subtitle, children, footer = true }) {
  const navigate = useNavigate();
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button style={styles.brand} onClick={() => navigate('/')} aria-label="EduOne home">
          <img src="/logo.png" alt="EduOne" style={styles.logo} />
          <span style={styles.brandName}>EduOne</span>
        </button>
        <button style={styles.backBtn} onClick={() => navigate('/')}>← Back to home</button>
      </header>

      <main style={styles.main}>
        {title && <h1 style={styles.h1}>{title}</h1>}
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        <div style={styles.content}>{children}</div>
      </main>

      {footer && (
        <footer style={styles.footer}>
          <span>© {new Date().getFullYear()} EduOne. All rights reserved.</span>
          <span style={styles.footerLinks}>
            <a style={styles.footLink} href="/privacy" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Privacy</a>
            <a style={styles.footLink} href="/terms" onClick={(e) => { e.preventDefault(); navigate('/terms'); }}>Terms</a>
            <a style={styles.footLink} href="/book-demo" onClick={(e) => { e.preventDefault(); navigate('/book-demo'); }}>Contact</a>
          </span>
        </footer>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', position: 'sticky', top: 0, zIndex: 10 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  logo: { height: 32, width: 'auto' },
  brandName: { fontWeight: 800, fontSize: 18 },
  backBtn: { background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 14px', fontSize: 14, cursor: 'pointer', color: '#334155' },
  main: { width: '100%', maxWidth: 800, margin: '0 auto', padding: '40px 24px 64px', flex: 1 },
  h1: { fontSize: 32, fontWeight: 800, margin: '0 0 8px' },
  subtitle: { color: '#64748b', fontSize: 15, margin: '0 0 28px' },
  content: { fontSize: 15.5, lineHeight: 1.75, color: '#1e293b' },
  footer: { borderTop: '1px solid #e2e8f0', background: '#fff', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 13, color: '#64748b' },
  footerLinks: { display: 'flex', gap: 18 },
  footLink: { color: '#334155', textDecoration: 'none' },
};
