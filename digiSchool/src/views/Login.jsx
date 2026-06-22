import { useState } from 'react';
import { signInWithUsername } from '../lib/supabaseClient';
import { Eye, EyeOff, Shield, GraduationCap } from 'lucide-react';

// Read school config set by the Setup Wizard
const schoolConfig = (() => {
  try {
    const raw = localStorage.getItem('eduone_school_config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();

const schoolName  = schoolConfig?.school?.name  || 'EduOne School Portal';
const schoolLogo  = schoolConfig?.school?.logo  || null;

export default function Login({ onDemoLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

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
    
    // Seed / demo login — call App.jsx directly via prop
    if (data?.demoUser) {
      console.log('[Login] Found demo user, calling onDemoLogin:', data.demoUser);
      if (onDemoLogin) {
        onDemoLogin(data.demoUser);
      } else {
        console.error('[Login] ERROR: onDemoLogin prop is undefined!');
        setError('System error: login handler missing. Please refresh the page.');
      }
    } else {
      console.log('[Login] Real Supabase user detected, waiting for onAuthStateChange to fire.');
    }
  };

  return (
    <div className="spotify-login-wrap">
      <div className="spotify-login-container">
        
        {/* Header / Logo */}
        <div className="spotify-login-header">
          <div className="spotify-login-logo">
            {schoolLogo ? (
              <img src={schoolLogo} alt="School Logo" />
            ) : (
              <GraduationCap size={28} color="#000" />
            )}
          </div>
          <h1>Log in to {schoolName}</h1>
        </div>

        {/* Divider */}
        <div className="spotify-divider">Continue with EduOne</div>

        <form onSubmit={submit}>
          
          {/* Error Message */}
          {error && (
            <div className="spotify-error">
              <Shield size={18} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Username */}
          <div className="spotify-Grade-group">
            <label className="spotify-label" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              className="spotify-input"
              autoFocus
              autoComplete="username"
              placeholder="Username or email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="spotify-form-group">
            <label className="spotify-label" htmlFor="login-password">
              Password
            </label>
            <div className="spotify-pw-wrap">
              <input
                id="login-password"
                className="spotify-input"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="spotify-pw-toggle"
                onClick={() => setShowPw(s => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            className="spotify-btn"
            type="submit"
            disabled={busy}
          >
            {busy ? (
              <div style={{ width: 24, height: 24, border: '3px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              'Log In'
            )}
          </button>
        </form>

        <a className="spotify-link">Forgot your password?</a>
        <div className="spotify-divider"></div>
        <div style={{ textAlign: 'center', color: '#a7a7a7', fontSize: 14 }}>
          Don't have an account? <a className="spotify-link" style={{ display: 'inline', marginTop: 0 }}>Contact Administration</a>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
