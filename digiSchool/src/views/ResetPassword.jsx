import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Shield, Key, ArrowRight } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the user arrived via a recovery link (hash contains access_token)
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) {
      setError('Invalid or expired reset link. Please request a new one.');
    }
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    
    // Supabase client automatically extracts the access_token from the URL hash 
    // and establishes a session, so we can just update the user.
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      setMsg('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    }
  };

  return (
    <div className="layout" style={{ placeItems: 'center', display: 'grid', minHeight: '100vh', background: '#f8f9fa' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32, boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ background: 'var(--primary)', color: '#fff', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Key size={24} />
          </div>
          <h2 style={{ margin: 0 }}>Reset Password</h2>
          <p className="muted" style={{ marginTop: 8 }}>Enter your new password below.</p>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#991B1B', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} /> {error}
          </div>
        )}
        
        {msg && (
          <div style={{ background: '#d1fae5', color: '#065F46', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
            {msg}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="field-label">New Password</label>
            <input 
              type="password" 
              className="input" 
              placeholder=" |  |  |  |  |  |  |  | " 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label">Confirm New Password</label>
            <input 
              type="password" 
              className="input" 
              placeholder=" |  |  |  |  |  |  |  | " 
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading || msg !== ''}>
            {loading ? 'Updating...' : 'Update Password'} <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </button>
        </form>
      </div>
    </div>
  );
}



