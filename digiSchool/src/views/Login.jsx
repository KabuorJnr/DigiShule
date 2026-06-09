import { useState } from 'react';
import { USERS, ROLES } from '../data/users';
import { signInWithUsername } from '../lib/supabaseClient';

// Distinct accounts to surface as quick-fill chips (one per role; the second
// librarian login is reachable by typing it manually).
const QUICK = [
  'Principal', 'Deputyacademic', 'Deputyadmin', 'FINANCE', 'Registrar',
  'Librarian', 'STF5169', 'STU2640494', 'PAR90215', 'NURSE001',
];

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

  const quickFill = (uname) => {
    const u = USERS.find((x) => x.username === uname);
    if (!u) return;
    setUsername(u.username);
    setPassword(u.password);
    setError('');
  };

  return (
    <div className="login-shell">
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo">WS</div>
          <h1>Westlands Secondary School</h1>
          <p className="login-motto">“Knowledge is Power”</p>
          <p className="login-tagline">
            DigiShule — one secure portal for principals, teachers, students,
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
            <div className="logo-box" style={{ width: 44, height: 44 }}>WS</div>
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

          <div className="login-quick">
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Demo accounts — click to fill
            </div>
            <div className="login-chips">
              {QUICK.map((uname) => {
                const u = USERS.find((x) => x.username === uname);
                if (!u) return null;
                return (
                  <button
                    type="button"
                    key={uname}
                    className="login-chip"
                    onClick={() => quickFill(uname)}
                    title={`${u.username} · ${ROLES[u.role].label}`}
                  >
                    <span className="login-chip-role">{ROLES[u.role].label}</span>
                    <span className="login-chip-user">{u.username}</span>
                  </button>
                );
              })}
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Principal password is <code>Zulu@254</code>; all other demo accounts use <code>7777</code>.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
