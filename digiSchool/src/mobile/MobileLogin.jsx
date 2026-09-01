import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithUsername, supabase } from '../lib/supabaseClient';
import { Mail, Lock, Eye, EyeOff, Check, ArrowRight, ShieldAlert, ArrowLeft } from 'lucide-react';
import './mobile.css';

// School branding, read from the Setup Wizard config (same source the desktop
// login uses) so a custom-branded school shows its own name.
const schoolConfig = (() => {
  try { const raw = localStorage.getItem('eduone_school_config'); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
})();
const schoolName = schoolConfig?.school?.name || 'your school';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6Z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.4-2.6c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.4-3.9H3.1v2.6A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.6 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.6L6.6 14Z" />
    <path fill="#EA4335" d="M12 6.1c1.4 0 2.7.5 3.7 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.6 10c.8-2.2 2.9-3.9 5.4-3.9Z" />
  </svg>
);

// The EduOne mobile sign-in. Reuses the exact auth path as the desktop Login
// (username/email + password, or Google OAuth) and lands on /portal, where the
// mobile shell takes over for phones.
export default function MobileLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [keep, setKeep] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);

  // Inline forgot-password mode.
  const [mode, setMode] = useState('signin'); // 'signin' | 'forgot'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    setError(''); setBusy(true);
    const { data, error: signInError } = await signInWithUsername(username.trim(), password.trim());
    if (signInError) {
      setBusy(false);
      setError(signInError.message || 'Invalid credentials. Please try again.');
      return;
    }
    let isAdmin = false;
    try {
      const { data: adminRow } = await supabase
        .from('platform_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
      isAdmin = !!adminRow;
    } catch { /* default to portal */ }
    setBusy(false);
    navigate(isAdmin ? '/admin' : '/portal');
  };

  const oauth = async () => {
    setError(''); setOauthBusy(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/portal' },
    });
    if (oauthError) {
      setOauthBusy(false);
      setError(oauthError.message || 'Could not continue with Google.');
    }
  };

  const sendReset = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) { setForgotMsg('Enter your email address.'); return; }
    setForgotBusy(true); setForgotMsg('');
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: window.location.origin + '/reset-password',
    });
    setForgotBusy(false);
    setForgotMsg(resetErr ? (resetErr.message || 'Could not send reset link.') : `Reset link sent to ${forgotEmail.trim()}.`);
  };

  return (
    <div className="eo-m">
      <div className="eo-login eo-active">
        <div className="eo-login-hero">
          <span className="eo-halo" style={{ width: 230, height: 230, background: '#7FA8F2', right: -80, top: -90 }} />
          <span className="eo-halo" style={{ width: 150, height: 150, background: '#fff', left: -40, top: 70, opacity: 0.1 }} />
          <div className="eo-login-grid" />
          <div className="eo-login-center">
            <img className="eo-logo eo-logo--on-dark" src="/eduone-logo.png" alt="EduOne" />
            <div className="eo-tag">School management, simplified</div>
          </div>
        </div>

        {mode === 'signin' ? (
          <form className="eo-sheet" onSubmit={submit}>
            <div className="eo-sheet-head">
              <h3>Sign in</h3>
              <p>Welcome back to {schoolName}</p>
            </div>

            {error && <div className="eo-error"><ShieldAlert size={18} /> {error}</div>}

            <div className="eo-field">
              <label htmlFor="eo-user">Email or admission number</label>
              <div className="eo-input">
                <Mail />
                <input id="eo-user" type="text" autoComplete="username" placeholder="you@example.com"
                  value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
            </div>

            <div className="eo-field">
              <label htmlFor="eo-pw">Password</label>
              <div className="eo-input">
                <Lock />
                <input id="eo-pw" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="eo-eye" onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            <div className="eo-row-between">
              <button type="button" className={`eo-check${keep ? ' eo-on' : ''}`} role="checkbox" aria-checked={keep}
                onClick={() => setKeep((k) => !k)}>
                <span className="eo-box"><Check /></span>Keep me signed in
              </button>
              <button type="button" className="eo-link" onClick={() => { setMode('forgot'); setForgotMsg(''); }}>Forgot password?</button>
            </div>

            <button className="eo-btn" type="submit" disabled={busy || oauthBusy}>
              {busy ? <span className="eo-spin" /> : <>Sign in <ArrowRight /></>}
            </button>

            <div className="eo-or">or continue with</div>
            <div className="eo-social">
              <button type="button" onClick={oauth} disabled={busy || oauthBusy}>
                {oauthBusy ? <span className="eo-spin eo-spin--blue" /> : <GoogleIcon />} Google
              </button>
            </div>

            <div className="eo-foot">New to {schoolName}? <button type="button" className="eo-link" onClick={() => navigate('/parent-signup')}>Register here</button></div>
          </form>
        ) : (
          <form className="eo-sheet" onSubmit={sendReset}>
            <div className="eo-sheet-head">
              <h3>Reset password</h3>
              <p>We&apos;ll email you a secure reset link.</p>
            </div>
            {forgotMsg && <div className="eo-error" style={{ background: 'var(--eo-blue-50)', color: 'var(--eo-blue-deep)' }}>{forgotMsg}</div>}
            <div className="eo-field">
              <label htmlFor="eo-forgot">Email address</label>
              <div className="eo-input">
                <Mail />
                <input id="eo-forgot" type="email" placeholder="your@email.com"
                  value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} autoFocus />
              </div>
            </div>
            <button className="eo-btn" type="submit" disabled={forgotBusy}>
              {forgotBusy ? <span className="eo-spin" /> : 'Send reset link'}
            </button>
            <button type="button" className="eo-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
              onClick={() => setMode('signin')}>
              <ArrowLeft size={15} /> Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
