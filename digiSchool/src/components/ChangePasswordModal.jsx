import { useState } from 'react';
import Modal from './Modal';
import { supabase } from '../lib/supabaseClient';
import { Lock } from 'lucide-react';

export default function ChangePasswordModal({ onClose, notify, forced = false }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      notify('Please enter a new password.', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      notify('Password must be at least 6 characters long.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Update both the password and the "must change" flag in user_metadata
      // in a single call. The flag lets PortalLayout stop forcing this modal.
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      });
      if (error) throw error;

      notify('Password updated successfully.', 'success', 'Security');
      onClose();
    } catch (err) {
      notify(`Failed to update password: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={forced ? 'Set your password' : 'Change Password'} onClose={forced ? undefined : onClose} width={400}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ background: '#f8fafc', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Lock size={24} color="#64748b" />
          </div>
          <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
            {forced
              ? 'For security, please replace the initial password (your phone number) with a private one before continuing.'
              : 'Enter your new password below. You will remain logged in on this device.'}
          </p>
        </div>
        
        <div>
          <label className="field-label">New Password *</label>
          <input 
            type="password" 
            className="input" 
            placeholder="At least 6 characters"
            value={newPassword} 
            onChange={e => setNewPassword(e.target.value)} 
          />
        </div>
        
        <div>
          <label className="field-label">Confirm Password *</label>
          <input 
            type="password" 
            className="input" 
            placeholder="Re-enter new password"
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)} 
          />
        </div>
        
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          {!forced && <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>}
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
            {loading ? 'Updating...' : (forced ? 'Save & Continue' : 'Update Password')}
          </button>
        </div>
      </form>
    </Modal>
  );
}



