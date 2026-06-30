import { useState } from 'react';
import { signInWithUsername, supabase } from '../lib/supabaseClient';
import { Eye, EyeOff, Shield, GraduationCap, CheckCircle2, Mail, Phone } from 'lucide-react';
import Modal from '../components/Modal';

// Read school config set by the Setup Wizard
const schoolConfig = (() => {
  try {
    const raw = localStorage.getItem('eduone_school_config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();

const schoolName  = schoolConfig?.school?.name  || 'EduOne School Portal';
const schoolLogo  = schoolConfig?.school?.logo  || null;

export default function Login({ onSignUp }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

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
      setForgotError(error.message);
    } else {
      setForgotSuccess(true);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Please enter your username and password.'); return; }
    setError('');
    setBusy(true);
    const { data, error: signInError } = await signInWithUsername(username, password);
    setBusy(false);
    
    console.log('[Login] signInWithUsername returned:', { data, signInError });

    if (signInError) {
      setError(signInError.message || 'Invalid credentials. Please try again.');
      return;
    }
    
    console.log('[Login] Real Supabase user detected, waiting for onAuthStateChange to fire.');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fff' }}>
      {/* Left Form Side */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: '#fff' }}>
        <div className="hr-login-container">
          
          {/* Header / Logo */}
          <div className="hr-login-header">
            <div className="hr-login-logo">
              {schoolLogo ? (
                <img src={schoolLogo} alt="School Logo" />
              ) : (
                <GraduationCap size={40} color="#0078D4" />
              )}
            </div>
            <h1>Log in to EduOne</h1>
            <p className="hr-subtitle">For Administrators, Teachers, and Parents</p>
          </div>

          <form onSubmit={submit}>
            {/* Error Message */}
            {error && (
              <div className="hr-error">
                <Shield size={18} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Username */}
            <div className="hr-form-group">
              <input
                id="login-username"
                className="hr-input"
                autoFocus
                autoComplete="username"
                placeholder="Username or email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="hr-form-group">
              <div className="hr-pw-wrap">
                <input
                  id="login-password"
                  className="hr-input"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="hr-pw-toggle"
                  onClick={() => setShowPw(s => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
              <a className="hr-link" onClick={() => { setForgotModalOpen(true); setForgotSuccess(false); setForgotError(''); setForgotEmail(''); }}>Forgot password?</a>
            </div>

            {/* Submit Button */}
            <button
              className="hr-btn"
              type="submit"
              disabled={busy}
            >
              {busy ? (
                <div className="hr-spinner" />
              ) : (
                'Log In'
              )}
            </button>
          </form>

          <div style={{ textAlign: 'center', color: '#576871', fontSize: 14, marginTop: 40 }}>
            <span>Don't have an account? <a className="hr-link" style={{ fontWeight: 600 }} onClick={() => setContactModalOpen(true)}>Contact Administration</a></span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {forgotModalOpen && (
        <Modal title="Reset Password" onClose={() => setForgotModalOpen(false)} footer={null}>
          {forgotSuccess ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <CheckCircle2 size={50} color="#10B981" style={{ marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 10px' }}>Reset Link Sent!</h3>
              <p style={{ color: '#576871' }}>We have sent a secure password reset link to <strong>{forgotEmail}</strong>. Please check your inbox.</p>
              <button className="hr-btn" style={{ marginTop: 24 }} onClick={() => setForgotModalOpen(false)}>Back to Login</button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: '0 0 10px', color: '#576871', fontSize: 14 }}>
                Enter the email address associated with your account and we will send you a link to reset your password.
              </p>
              
              {forgotError && (
                <div className="hr-error" style={{ marginBottom: 0 }}>
                  <Shield size={16} /> {forgotError}
                </div>
              )}
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Email Address</label>
                <input
                  type="email"
                  className="hr-input"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setForgotModalOpen(false)}>Cancel</button>
                <button type="submit" className="hr-btn" style={{ flex: 1, padding: '10px' }} disabled={forgotBusy}>
                  {forgotBusy ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {contactModalOpen && (
        <Modal title="Contact Administration" onClose={() => setContactModalOpen(false)} footer={
          <button className="hr-btn" onClick={() => setContactModalOpen(false)}>Close</button>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ margin: 0, color: '#576871', fontSize: 14 }}>
              To get an account or resolve login issues, please contact the school administration directly using the details below:
            </p>
            
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 16 }}>{schoolName}</h4>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Mail size={18} color="#64748b" />
                <a href={`mailto:${schoolConfig?.school?.email || 'admin@school.edu'}`} className="hr-link" style={{ fontWeight: 600 }}>
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

      {/* Right Image Side */}
      <div className="login-image-side" />

      <style>{`
        .hr-login-container {
          width: 100%;
          max-width: 400px;
          background: transparent;
        }
        .hr-login-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .hr-login-logo {
          margin-bottom: 24px;
        }
        .hr-login-logo img {
          max-height: 50px;
          object-fit: contain;
        }
        .hr-login-header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #0e141e;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }
        .hr-subtitle {
          color: #576871;
          font-size: 15px;
          margin: 0;
        }
        .hr-form-group {
          margin-bottom: 20px;
        }
        .hr-input {
          width: 100%;
          background: #fff;
          border: 1px solid #b7c9cc;
          border-radius: 4px;
          padding: 14px 16px;
          font-size: 15px;
          color: #0e141e;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .hr-input::placeholder {
          color: #8b9a9d;
        }
        .hr-input:focus {
          outline: none;
          border-color: #0078D4;
          box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.2);
        }
        .hr-pw-wrap {
          position: relative;
        }
        .hr-pw-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #8b9a9d;
          cursor: pointer;
          display: flex;
        }
        .hr-pw-toggle:hover {
          color: #0e141e;
        }
        .hr-btn {
          width: 100%;
          background: #0078D4;
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 16px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .hr-btn:hover {
          background: #0062AD;
        }
        .hr-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .hr-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .hr-link {
          color: #0078D4;
          text-decoration: none;
          font-size: 14px;
          cursor: pointer;
        }
        .hr-link:hover {
          text-decoration: underline;
        }
        .hr-error {
          background: #fde8e8;
          color: #c81e1e;
          padding: 12px 16px;
          border-radius: 4px;
          font-size: 14px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .login-image-side {
          flex: 1.2;
          background-image: url(/login_background.png);
          background-size: cover;
          background-position: center;
          display: none;
          border-left: 1px solid #eef2f7;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 900px) {
          .login-image-side { display: block !important; }
        }
        @media (max-width: 500px) {
          .hr-login-container { padding: 0 10px; }
        }
      `}</style>
    </div>
  );
}
