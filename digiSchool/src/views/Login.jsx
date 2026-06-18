import { useState } from 'react';
import { signInWithUsername } from '../lib/supabaseClient';
import { Eye, EyeOff, LogIn, BookOpen, GraduationCap, BarChart3, Users, Shield } from 'lucide-react';

// Read school config set by the Setup Wizard
const schoolConfig = (() => {
  try {
    const raw = localStorage.getItem('eduone_school_config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();

const schoolName  = schoolConfig?.school?.name  || 'EduOne School Portal';
const schoolMotto = schoolConfig?.school?.motto  || 'Excellence in Education';
const schoolType  = schoolConfig?.school?.type   || '';
const schoolLogo  = schoolConfig?.school?.logo   || null;

const FEATURES = [
  { icon: BarChart3, text: 'Real-time academics & gradebook' },
  { icon: GraduationCap, text: 'Student registration & admissions' },
  { icon: Users, text: 'Staff, finance & health records' },
  { icon: BookOpen, text: 'Library management & resources' },
  { icon: Shield, text: 'Secure multi-role access control' },
];

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "'Segoe UI', -apple-system, sans-serif",
      background: '#f0f4f8',
    }}>

      {/* ── Left Panel ─────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 480px',
        background: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 45%, #0078D4 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 52px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background rings */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 360, height: 360, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

        {/* School identity */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
            {schoolLogo ? (
              <img src={schoolLogo} alt="School Logo" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,0.1)', padding: 4 }} />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GraduationCap size={28} color="#fff" />
              </div>
            )}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
                EduOne
              </div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
                {schoolName}
              </div>
              {schoolType && (
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{schoolType}</div>
              )}
            </div>
          </div>

          <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1.2, margin: '0 0 12px', letterSpacing: -0.5 }}>
            School Management<br />Made Simple
          </h1>
          {schoolMotto && (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontStyle: 'italic', margin: '0 0 40px' }}>
              "{schoolMotto}"
            </p>
          )}

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color="rgba(255,255,255,0.85)" />
                </div>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 40 }}>
          Powered by <strong style={{ color: 'rgba(255,255,255,0.5)' }}>EduOne</strong> · Multi-school platform
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Card header */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', letterSpacing: -0.3 }}>
              Sign in
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
              Enter your school credentials to access your portal
            </p>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Error */}
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex',
                alignItems: 'center', gap: 8,
              }}>
                <Shield size={14} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Username
              </label>
              <input
                id="login-username"
                className="input"
                autoFocus
                autoComplete="username"
                placeholder="e.g. Principal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ fontSize: 14 }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ fontSize: 14, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: '#94a3b8', display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy}
              style={{
                width: '100%', justifyContent: 'center',
                height: 46, fontSize: 15, fontWeight: 600,
                marginTop: 4, gap: 8,
                opacity: busy ? 0.7 : 1,
                background: 'linear-gradient(135deg, #0078D4, #0369A1)',
                border: 'none',
                boxShadow: busy ? 'none' : '0 4px 12px rgba(0, 120, 212, 0.3)'
              }}
            >
              {busy ? (
                <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Sign In to EduOne</span>
                </>
              )}
            </button>
          </form>

          {/* Help */}
          <div style={{
            marginTop: 28, padding: '14px 16px',
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 8, fontSize: 12, color: '#64748b', lineHeight: 1.6,
          }}>
            <strong style={{ color: '#374151' }}>Need help?</strong><br />
            Contact your school administrator to get your login credentials or reset your password.
          </div>

          <div style={{ marginTop: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
            EduOne School Management Platform
          </div>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
