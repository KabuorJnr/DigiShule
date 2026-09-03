import { useState } from 'react';
import { signInWithUsername, supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../lib/seo';
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

// Background for the login page: a generated illustration of a teacher tutoring
// students in a Kenyan classroom. Swap for a real photo by dropping it in
// /public and updating this path.
const LOGIN_BG = '/login-classroom.svg';

/* ---- brand icons ---- */
const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);
const GithubIcon = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58C20.56 22.29 24 17.8 24 12.5 24 5.87 18.63.5 12 .5z" />
  </svg>
);
const MicrosoftIcon = () => (
  <svg viewBox="0 0 21 21" width="18" height="18" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  useSEO({ title: 'Sign in — EduOne', description: 'Sign in to your EduOne school portal.', path: '/login', noindex: true });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState('');

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
    localStorage.setItem('eduone_preferred_username', username.trim());
    const { data, error: signInError } = await signInWithUsername(username.trim(), password.trim());

    if (signInError) {
      setBusy(false);
      localStorage.removeItem('eduone_preferred_username');
      setError(signInError.message || 'Invalid credentials. Please try again.');
      return;
    }

    // Platform super-admins go to the admin console; everyone else to their portal.
    let isAdmin = false;
    try {
      const { data: adminRow } = await supabase
        .from('platform_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
      isAdmin = !!adminRow;
    } catch { /* default to portal */ }
    setBusy(false);

    navigate(isAdmin ? '/admin' : '/portal');
  };

  // Social sign-in / sign-up via Supabase OAuth. The provider must be enabled
  // in the Supabase dashboard (Authentication -> Providers) for this to work;
  // a first-time OAuth login creates the account, so this covers sign-up too.
  const oauth = async (provider) => {
    setError('');
    setOauthBusy(provider);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/portal' },
    });
    if (oauthError) {
      setOauthBusy('');
      setError(oauthError.message || `Could not continue with ${provider}. It may not be enabled yet.`);
    }
    // On success the browser is redirected to the provider, so no further work here.
  };

  const goHome = (e) => { e.preventDefault(); navigate('/'); };

  return (
    <div className="lg-root">
      <div className="lg-bg" aria-hidden="true" />

      <a href="/" className="lg-back" onClick={goHome}><ArrowLeft size={16} /> Back to site</a>

      <div className="lg-shell">
        <div className="lg-card">
          <a href="/" className="lg-brandmark" onClick={goHome} aria-label="EduOne home">
            {schoolLogo
              ? <img src={schoolLogo} alt="School logo" className="lg-school-logo" />
              : <img src="/logo.png" alt="EduOne" className="lg-eduone-logo" />}
          </a>
          <div className="lg-head">
            <h1>Welcome back</h1>
            <p>{isCustomSchool ? `Sign in to ${schoolName}` : 'Sign in to your EduOne account'}</p>
          </div>

          {error && (
            <div className="lg-error"><Shield size={18} style={{ flexShrink: 0 }} /> {error}</div>
          )}

          {/* Social sign-in */}
          <div className="lg-social">
            <button type="button" className="lg-soc lg-soc-primary" onClick={() => oauth('google')} disabled={!!oauthBusy}>
              {oauthBusy === 'google' ? <span className="lg-spinner dark" /> : <GoogleIcon />}
              <span>Continue with Google</span>
            </button>
            <div className="lg-soc-row">
              <button type="button" className="lg-soc" onClick={() => oauth('github')} disabled={!!oauthBusy} aria-label="Continue with GitHub">
                {oauthBusy === 'github' ? <span className="lg-spinner dark" /> : <GithubIcon />}
                <span>GitHub</span>
              </button>
              <button type="button" className="lg-soc" onClick={() => oauth('azure')} disabled={!!oauthBusy} aria-label="Continue with Microsoft">
                {oauthBusy === 'azure' ? <span className="lg-spinner dark" /> : <MicrosoftIcon />}
                <span>Microsoft</span>
              </button>
            </div>
          </div>

          <div className="lg-divider"><span>or continue with email</span></div>

          {/* Email / username sign-in */}
          <form onSubmit={submit} className="lg-form">
            <div className="lg-field">
              <label htmlFor="login-username">Username or email</label>
              <div className="lg-input-wrap">
                <User size={18} className="lg-input-ico" />
                <input
                  id="login-username"
                  className="lg-input"
                  autoComplete="username"
                  placeholder="e.g. jane.otieno"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="lg-field">
              <div className="lg-label-row">
                <label htmlFor="login-password">Password</label>
                <a className="lg-link" onClick={() => { setForgotModalOpen(true); setForgotSuccess(false); setForgotError(''); setForgotEmail(''); }}>Forgot?</a>
              </div>
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

            <button className="lg-btn" type="submit" disabled={busy || !!oauthBusy}>
              {busy ? <span className="lg-spinner" /> : 'Log in'}
            </button>
          </form>

          <div className="lg-alt">
            Don&apos;t have an account? <a className="lg-link lg-strong" onClick={() => setContactModalOpen(true)}>Contact administration</a>
          </div>
        </div>

        <p className="lg-below">
          Registering a new school? <a className="lg-link lg-strong" onClick={() => navigate('/signup')}>Create an account</a>
        </p>
      </div>

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
          --border: #e6eaf1; --border-strong: #d7deea;
          position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 56px 20px; overflow: hidden;
          background: #0b1220 url('${LOGIN_BG}') center / cover no-repeat;
          font-family: 'Inter', system-ui, sans-serif; color: var(--ink);
          -webkit-font-smoothing: antialiased;
        }
        .lg-root * { box-sizing: border-box; }
        .lg-bg {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background: linear-gradient(135deg, rgba(9,15,28,.78) 0%, rgba(19,44,108,.66) 55%, rgba(37,99,235,.5) 100%);
        }
        .lg-bg::after {
          content: ''; position: absolute; inset: 0; opacity: .4;
          -webkit-mask-image: linear-gradient(to bottom, #000, transparent 78%);
          mask-image: linear-gradient(to bottom, #000, transparent 78%);
          background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 46px 46px;
        }

        .lg-back { position: absolute; top: 22px; left: 22px; z-index: 3; display: inline-flex; align-items: center; gap: 6px; font-size: .88rem; font-weight: 600; color: rgba(255,255,255,.9); text-shadow: 0 1px 8px rgba(0,0,0,.4); text-decoration: none; cursor: pointer; }
        .lg-back:hover { color: #fff; }

        .lg-shell { position: relative; z-index: 1; width: 100%; max-width: 440px; }
        .lg-brandmark { display: flex; justify-content: center; margin-bottom: 20px; }
        .lg-eduone-logo { height: 40px; width: auto; }
        .lg-school-logo { max-height: 56px; width: auto; object-fit: contain; }

        .lg-card {
          background: #fff; border: 1px solid var(--border); border-radius: 20px;
          padding: 34px 32px; box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 24px 60px rgba(16,24,40,.10);
        }
        .lg-head { text-align: center; margin-bottom: 24px; }
        .lg-head h1 { font-family: 'Outfit', sans-serif; font-size: 1.72rem; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px; }
        .lg-head p { color: var(--muted); font-size: .95rem; margin: 0; }

        .lg-social { display: flex; flex-direction: column; gap: 10px; }
        .lg-soc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lg-soc {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; font-family: inherit; font-weight: 600; font-size: .94rem; color: var(--ink);
          background: #fff; border: 1px solid var(--border-strong); border-radius: 11px; padding: 11px 14px;
          cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease, background .15s ease, transform .15s ease;
        }
        .lg-soc:hover:not(:disabled) { border-color: #b9c4d6; box-shadow: 0 4px 14px rgba(16,24,40,.08); transform: translateY(-1px); background: #fcfdff; }
        .lg-soc:disabled { opacity: .6; cursor: not-allowed; }

        .lg-divider { display: flex; align-items: center; gap: 14px; margin: 20px 0; color: var(--muted); font-size: .8rem; }
        .lg-divider::before, .lg-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

        .lg-form { display: flex; flex-direction: column; }
        .lg-field { margin-bottom: 15px; }
        .lg-field label { display: block; font-size: .82rem; font-weight: 700; color: var(--slate); margin-bottom: 7px; }
        .lg-label-row { display: flex; align-items: baseline; justify-content: space-between; }
        .lg-label-row .lg-link { font-size: .8rem; }
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

        .lg-btn {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          font-family: inherit; font-weight: 700; font-size: .98rem; color: #fff;
          background: var(--grad); border: 1px solid transparent; border-radius: 11px;
          padding: 13px 18px; margin-top: 6px; cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 8px 20px rgba(37,99,235,.28);
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .lg-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 14px 30px rgba(37,99,235,.4); }
        .lg-btn:disabled { opacity: .7; cursor: not-allowed; }
        .lg-btn-ghost { background: #fff; color: var(--ink); border-color: var(--border-strong); box-shadow: none; }
        .lg-btn-ghost:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(37,99,235,.12); }

        .lg-link { color: var(--blue); font-size: .9rem; cursor: pointer; text-decoration: none; }
        .lg-link:hover { text-decoration: underline; }
        .lg-link.lg-strong { font-weight: 700; }

        .lg-error { display: flex; align-items: center; gap: 10px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 12px 14px; border-radius: 11px; font-size: .88rem; margin-bottom: 18px; }
        .lg-alt { text-align: center; color: var(--muted); font-size: .9rem; margin-top: 22px; }
        .lg-below { text-align: center; color: rgba(255,255,255,.85); font-size: .88rem; margin: 22px 0 0; text-shadow: 0 1px 8px rgba(0,0,0,.4); }
        .lg-below .lg-link { color: #fff; }

        .lg-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: lg-spin .8s linear infinite; }
        .lg-spinner.dark { border-color: rgba(37,99,235,.25); border-top-color: var(--blue); }
        @keyframes lg-spin { to { transform: rotate(360deg); } }

        @media (max-width: 400px) { .lg-card { padding: 28px 22px; } .lg-soc-row { grid-template-columns: 1fr; } }
        @media (prefers-reduced-motion: reduce) { .lg-btn, .lg-soc, .lg-back { transition: none; } .lg-spinner { animation-duration: 1.4s; } }
      `}</style>
    </div>
  );
}
