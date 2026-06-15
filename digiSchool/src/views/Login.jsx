import { useState } from 'react';
import { signInWithUsername } from '../lib/supabaseClient';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: signInError } = await signInWithUsername(username, password);
    setBusy(false);
    if (signInError) {
      setError(signInError.message || 'Invalid username or password. Please try again.');
      return;
    }
    // On success the App's auth listener loads the profile and navigates.
  };

  return (
    <div className="login-shell">
      <div className="login-brand">
        <div className="login-brand-inner">
          <img src="/logo.png" alt="EduOne Logo" className="login-logo-img" style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 16 }} />
          <h1>Westlands Secondary School</h1>
          <p className="login-motto">“Knowledge is Power”</p>
          <p className="login-tagline">
            EduOne — one secure portal for principals, teachers, students,
            parents and support staff.
          </p>
          <ul className="login-points">
            <li>📊 Real-time academics & gradebook</li>
            <li>💰 Fee collection & finance tracking</li>
            <li>📚 Library, admissions & health records</li>
          </ul>
        </div>
      </div>

      <div className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-head">
            <img src="/logo.png" alt="EduOne Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            <div>
              <h2 style={{ fontSize: 20 }}>Sign in</h2>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                Welcome back. Please enter your credentials.
              </p>
            </div>
          </div>

          {error && <div className="login-error">⛔ {error}</div>}

          <label className="field-label" htmlFor="login-username">Username</label>
          <input
            id="login-username"
            className="input"
            autoFocus
            autoComplete="username"
            placeholder="e.g. Principal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label className="field-label" htmlFor="login-password" style={{ marginTop: 14 }}>
            Password
          </label>
          <div className="login-pw">
            <input
              id="login-password"
              className="input"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="login-pw-toggle"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>

          <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
