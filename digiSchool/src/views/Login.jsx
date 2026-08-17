import { useState } from 'react';
import { signInWithUsername, supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, CheckCircle2, Mail, Phone, User, Lock, ArrowLeft } from 'lucide-react';
import Modal from '../components/Modal';

// Read school config set by the Setup Wizard
const schoolConfig = (() => {
  try {
    const raw = localStorage.getItem('eduone_school_config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();

const schoolName = schoolConfig?.school?.name || 'EduOne School Portal';
const schoolLogo = schoolConfig?.school?.logo || null;
const isCustomSchool = !!schoolConfig?.school?.name;

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Modal states
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const [contactModalOpen, setContactModalOpen] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) { setForgotError('Please enter your email address.'); return; }
    setForgotError('');
    setForgotBusy(true);

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin + '/reset-password',
    });

    setForgotBusy(false);

    if (error) {
      if (error.message.includes('Error sending recovery email') || error.message.includes('rate limit')) {
        setForgotError('Email service is currently unavailable or rate-limited. Please contact your system administrator to reset your password manually, or configure a custom SMTP server in Supabase settings.');
      } else {
        setForgotError(error.message);
      }
    } else {
      setForgotSuccess(true);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Please enter your username and password.'); return; }
    setError('');
    setBusy(true);
    const { data, error: signInError } = await signInWithUsername(username.trim(), password.trim());
    setBusy(false);

    console.log('[Login] signInWithUsername returned:', { data, signInError });

    if (signInError) {
      setError(signInError.message || 'Invalid credentials. Please try again.');
      return;
    }

    console.log('[Login] Real Supabase user detected. Redirecting to portal...');
    navigate('/portal');
  };

  const goHome = (e) => { e.preventDefault(); navigate('/'); };

  return (
    <div className="lg-root">
      {/* Brand panel (photo) */}
      <aside className="lg-brand">
        <div className="lg-brand-inner">
          <a href="/" className="lg-brand-logo" onClick={goHome} aria-label="EduOne home">
            <img src="/logo.png" alt="EduOne" />
          </a>
          <div className="lg-brand-body">
            <h2>Welcome back.</h2>
            <p>Run your whole school from one simple dashboard - fees, CBC grading and parent communication, even when the internet is down.</p>
            <ul className="lg-points">
              <li><CheckCircle2 size={18} /> Works offline, syncs later</li>
              <li><CheckCircle2 size={18} /> CBC-compliant reporting</li>
              <li><CheckCircle2 size={18} /> Bank-grade security &amp; backups</li>
            </ul>
          </div>
          <div className="lg-brand-foot">© 2026 EduOne · Offline-first · CBC compliant</div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="lg-main">
        <a href="/" className="lg-back" onClick={goHome}><ArrowLeft size={16} /> Back to site</a>

        <div className="lg-card">
          <div className="lg-head">
            <div className="lg-head-logo">
              {schoolLogo
                ? <img src={schoolLogo} alt="School logo" className="lg-school-logo" />
                : <img src="/logo.png" alt="EduOne" className="lg-eduone-logo" />}
            </div>
            <h1>Sign in</h1>
            <p>{isCustomSchool ? `to ${schoolName}` : 'For administrators, teachers and parents'}</p>
          </div>

          <form onSubmit={submit} className="lg-form">
            {error && (
              <div className="lg-error"><Shield size={18} style={{ flexShrink: 0 }} /> {error}</div>
            )}

            <div className="lg-field">
              <label htmlFor="login-username">Username or email</label>
              <div className="lg-input-wrap">
                <User size={18} className="lg-input-ico" />
                <input
                  id="login-username"
                  className="lg-input"
                  autoFocus
                  autoComplete="username"
                  placeholder="e.g. jane.otieno"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="lg-field">
              <label htmlFor="login-password">Password</label>
              <div className="lg-input-wrap">
                <Lock size={18} className="lg-input-ico" />
                <input
                  id="login-password"
                  className="lg-input"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="lg-eye"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <div className="lg-row-end">
              <a className="lg-link" onClick={() => { setForgotModalOpen(true); setForgotSuccess(false); setForgotError(''); setForgotEmail(''); }}>Forgot password?</a>
            </div>

            <button className="lg-btn" type="submit" disabled={busy}>
              {busy ? <span className="lg-spinner" /> : 'Log in'}
            </button>
          </form>

          <div className="lg-alt">
            Don&apos;t have an account? <a className="lg-link lg-strong" onClick={() => setContactModalOpen(true)}>Contact administration</a>
          </div>
        </div>
      </main>

      {/* Modals */}
      {forgotModalOpen && (
        <Modal title="Reset password" onClose={() => setForgotModalOpen(false)} footer={null}>
          {forgotSuccess ? (
            <div style={{ textAlign: 'center', padding: '24px 8px' }}>
              <CheckCircle2 size={48} color="#16a34a" style={{ marginBottom: 14 }} />
              <h3 style={{ margin: '0 0 10px' }}>Reset link sent!</h3>
              <p style={{ color: '#64748b' }}>We&apos;ve sent a secure password reset link to <strong>{forgotEmail}</strong>. Please check your inbox.</p>
              <button className="lg-btn" style={{ marginTop: 22 }} onClick={() => setForgotModalOpen(false)}>Back to login</button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
                Enter the email associated with your account and we&apos;ll send you a link to reset your password.
              </p>
              {forgotError && (
                <div className="lg-error" style={{ marginBottom: 0 }}><Shield size={16} /> {forgotError}</div>
              )}
              <div className="lg-field">
                <label htmlFor="forgot-email">Email address</label>
                <div className="lg-input-wrap">
                  <Mail size={18} className="lg-input-ico" />
                  <input
                    id="forgot-email"
                    type="email"
                    className="lg-input"
                    placeholder="your@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="lg-btn lg-btn-ghost" onClick={() => setForgotModalOpen(false)}>Cancel</button>
                <button type="submit" className="lg-btn" disabled={forgotBusy}>
                  {forgotBusy ? 'Sending...' : 'Send reset link'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {contactModalOpen && (
        <Modal title="Contact administration" onClose={() => setContactModalOpen(false)} footer={
          <button className="lg-btn" onClick={() => setContactModalOpen(false)}>Close</button>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              To get an account or resolve login issues, contact the school administration using the details below.
            </p>

            <button type="button" onClick={() => navigate('/parent-signup')} className="lg-btn lg-btn-ghost" style={{ justifyContent: 'center', gap: 8 }}>
              <User size={16} /> Parent registration
            </button>

            <div style={{ background: '#f6f8fc', padding: 16, borderRadius: 12, border: '1px solid #e6eaf1' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 16 }}>{schoolName}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Mail size={18} color="#64748b" />
                <a href={`mailto:${schoolConfig?.school?.email || 'admin@school.edu'}`} className="lg-link lg-strong">
                  {schoolConfig?.school?.email || 'admin@school.edu'}
                </a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Phone size={18} color="#64748b" />
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {schoolConfig?.school?.phone || '+254 (0) 700 000 000'}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        .lg-root {
          --blue: #2563eb; --blue-700: #1d4ed8;
          --grad: linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #3b82f6 100%);
          --ink: #0b1220; --slate: #475569; --muted: #64748b;
          --border: #e6eaf1; --border-strong: #d3dbe8;
          display: flex; min-height: 100vh; background: #fff;
          font-family: 'Inter', system-ui, sans-serif; color: var(--ink);
          -webkit-font-smoothing: antialiased;
        }
        .lg-root * { box-sizing: border-box; }

        /* ---- brand panel ---- */
        .lg-brand {
          display: none; position: relative; flex: 1.05; overflow: hidden;
          background:
            linear-gradient(155deg, rgba(9,15,28,.9) 0%, rgba(23,54,138,.78) 55%, rgba(37,99,235,.55) 100%),
            url('/gallery_3.png') center / cover no-repeat;
        }
        @media (min-width: 940px) { .lg-brand { display: block; } }
        .lg-brand-inner {
          position: relative; z-index: 1; height: 100%;
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 48px; color: #fff;
        }
        .lg-brand-logo img { height: 34px; width: auto; background: #fff; border-radius: 10px; padding: 6px 12px; box-shadow: 0 10px 30px rgba(0,0,0,.2); }
        .lg-brand-body { max-width: 30ch; }
        .lg-brand-body h2 { font-family: 'Outfit', sans-serif; font-size: clamp(2rem, 3vw, 2.9rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 16px; }
        .lg-brand-body p { font-size: 1.05rem; color: rgba(255,255,255,.85); line-height: 1.55; margin: 0 0 26px; }
        .lg-points { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
        .lg-points li { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: .96rem; color: rgba(255,255,255,.94); }
        .lg-points svg { color: #5eead4; flex-shrink: 0; }
        .lg-brand-foot { font-size: .8rem; color: rgba(255,255,255,.7); }

        /* ---- form panel ---- */
        .lg-main { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
        .lg-back { position: absolute; top: 24px; left: 24px; display: inline-flex; align-items: center; gap: 6px; font-size: .88rem; font-weight: 600; color: var(--muted); text-decoration: none; cursor: pointer; }
        .lg-back:hover { color: var(--blue); }
        .lg-card { width: 100%; max-width: 400px; }

        .lg-head { margin-bottom: 28px; }
        .lg-head-logo { margin-bottom: 20px; }
        .lg-eduone-logo { height: 38px; width: auto; }
        .lg-school-logo { max-height: 52px; width: auto; object-fit: contain; }
        @media (min-width: 940px) { .lg-eduone-logo { display: none; } }
        .lg-head h1 { font-family: 'Outfit', sans-serif; font-size: 1.9rem; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px; }
        .lg-head p { color: var(--muted); font-size: .96rem; margin: 0; }

        .lg-form { display: flex; flex-direction: column; }
        .lg-field { margin-bottom: 16px; }
        .lg-field label { display: block; font-size: .82rem; font-weight: 700; color: var(--slate); margin-bottom: 7px; }
        .lg-input-wrap { position: relative; display: flex; align-items: center; }
        .lg-input-ico { position: absolute; left: 13px; color: #94a3b8; pointer-events: none; }
        .lg-input {
          width: 100%; font-family: inherit; font-size: .96rem; color: var(--ink);
          padding: 12px 14px 12px 42px; border: 1px solid var(--border-strong); border-radius: 11px;
          background: #fff; transition: border-color .15s ease, box-shadow .15s ease;
        }
        .lg-input::placeholder { color: #9aa7b8; }
        .lg-input:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.14); }
        .lg-eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; display: flex; padding: 6px; border-radius: 8px; }
        .lg-eye:hover { color: var(--ink); background: #f1f5f9; }
        .lg-row-end { display: flex; justify-content: flex-end; margin: 2px 0 20px; }

        .lg-btn {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          font-family: inherit; font-weight: 700; font-size: .98rem; color: #fff;
          background: var(--grad); border: 1px solid transparent; border-radius: 11px;
          padding: 13px 18px; cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 8px 20px rgba(37,99,235,.28);
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
        }
        .lg-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 14px 30px rgba(37,99,235,.4); }
        .lg-btn:disabled { opacity: .75; cursor: not-allowed; }
        .lg-btn-ghost { background: #fff; color: var(--ink); border-color: var(--border-strong); box-shadow: none; }
        .lg-btn-ghost:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(37,99,235,.12); }

        .lg-link { color: var(--blue); font-size: .9rem; cursor: pointer; text-decoration: none; }
        .lg-link:hover { text-decoration: underline; }
        .lg-link.lg-strong { font-weight: 700; }

        .lg-error { display: flex; align-items: center; gap: 10px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 12px 14px; border-radius: 11px; font-size: .88rem; margin-bottom: 18px; }
        .lg-alt { text-align: center; color: var(--muted); font-size: .9rem; margin-top: 30px; }

        .lg-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: lg-spin .8s linear infinite; }
        @keyframes lg-spin { to { transform: rotate(360deg); } }

        @media (prefers-reduced-motion: reduce) { .lg-btn, .lg-back { transition: none; } .lg-spinner { animation-duration: 1.4s; } }
      `}</style>
    </div>
  );
}
