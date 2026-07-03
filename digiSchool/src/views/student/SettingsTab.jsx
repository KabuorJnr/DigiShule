import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import { supabase } from '../../lib/supabaseClient';
import GalleryViewer from '../../components/GalleryViewer';

export default function SettingsTab() {
  const { store, notify } = useOutletContext();
  const [tab, setTab] = useState('settings');
  const [pwForm, setPwForm] = useState({ newPw: '', confirmPw: '' });
  const [pwBusy, setPwBusy] = useState(false);

  const { notifications } = store;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPw.length < 6) return notify('Password must be at least 6 characters long', 'warning');
    if (pwForm.newPw !== pwForm.confirmPw) return notify('Passwords do not match', 'warning');
    
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    setPwBusy(false);
    
    if (error) {
      notify(`Failed to update password: ${error.message}`, 'error');
    } else {
      notify('Password successfully updated!', 'success');
      setPwForm({ newPw: '', confirmPw: '' });
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {['settings', 'notices', 'gallery'].map(t => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'settings' ? 'Profile & Settings' : t === 'notices' ? 'School Notices' : 'Media Gallery'}
          </button>
        ))}
      </div>

      {tab === 'notices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(notifications || []).filter(n => (n.audience || []).includes('all') || (n.audience || []).includes('students')).map(n => (
            <div key={n.id} className="card card-pad">
              <h4 style={{ margin: 0, fontSize: 14 }}>{n.title}</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
                <span className="muted" style={{ fontSize: 12 }}>{(n.created_at || '').slice(0, 10)}</span>
                <Badge color="blue">{n.role}</Badge>
                <span className="muted" style={{ fontSize: 12 }}>by {n.posted_by}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{n.body}</p>
            </div>
          ))}
          {(!notifications || notifications.length === 0) && (
            <div className="card card-pad muted" style={{ textAlign: 'center', padding: 40 }}>
              No notices at this time.
            </div>
          )}
        </div>
      )}

      {tab === 'gallery' && (
        <GalleryViewer />
      )}

      {tab === 'settings' && (
        <div className="card card-pad" style={{ maxWidth: 500, margin: '0 auto' }}>
          <h3 className="section-title">Change Password</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
            Enter a new password below. It must be at least 6 characters long.
          </p>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">New Password</label>
              <input 
                type="password" 
                className="input" 
                placeholder="Minimum 6 characters" 
                value={pwForm.newPw} 
                onChange={e => setPwForm({...pwForm, newPw: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label className="field-label">Confirm New Password</label>
              <input 
                type="password" 
                className="input" 
                placeholder="Re-type new password" 
                value={pwForm.confirmPw} 
                onChange={e => setPwForm({...pwForm, confirmPw: e.target.value})} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={pwBusy}>
              {pwBusy ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
