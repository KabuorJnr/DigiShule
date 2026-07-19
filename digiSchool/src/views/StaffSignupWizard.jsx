import { useState } from 'react';
import { UserCheck, Shield, CheckCircle2, Loader, Lock, Mail, Key } from 'lucide-react';
import { supabase, signInWithUsername } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { upsertRow } from '../lib/api';

export default function StaffSignupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1: Verification
  const [credentials, setCredentials] = useState({
    email: '', tempPassword: '', pin: ''
  });
  
  // Step 2: New Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [staffRecord, setStaffRecord] = useState(null);

  const handleVerify = async () => {
    setError('');
    if (!credentials.email.trim() || !credentials.tempPassword || !credentials.pin.trim()) {
      return setError('Please fill in all verification fields from your email.');
    }
    
    setSaving(true);
    try {
      // 1. Sign in with temporary credentials
      const { data: authData, error: authErr } = await signInWithUsername(
        credentials.email.trim(), 
        credentials.tempPassword
      );
      
      if (authErr) {
        throw new Error('Invalid email or temporary password. Please check your email and try again.');
      }
      
      // 2. Fetch the staff record to verify the PIN
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Authentication failed.');

      const { data: staffData, error: staffErr } = await supabase
        .from('staff')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (staffErr || !staffData) {
        throw new Error('Could not locate your staff record.');
      }
      
      // 3. Verify PIN
      if (staffData.pin !== credentials.pin.trim()) {
        throw new Error('Invalid Activation PIN. Please check your email.');
      }
      
      setStaffRecord(staffData);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    setError('');
    if (newPassword.length < 6) return setError('New password must be at least 6 characters long.');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    
    setSaving(true);
    try {
      // 1. Update Supabase Auth Password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateErr) throw new Error(`Failed to set new password: ${updateErr.message}`);
      
      // 2. Update staff record (clear PIN and set status to Active)
      const updatedStaff = {
        ...staffRecord,
        pin: null, // Clear the PIN so it can't be reused
        status: 'Active'
      };
      
      await upsertRow('staff', updatedStaff);
      
      // Also update teachers table if applicable
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', staffRecord.id)
        .single();
        
      if (teacherData) {
        await upsertRow('teachers', { ...teacherData, status: 'Active' });
      }
      
      setStep(3);
      
      // 3. Redirect to portal after 2 seconds
      setTimeout(() => {
        navigate('/portal');
      }, 2000);
      
    } catch (err) {
      setError(err.message || 'Activation failed.');
      setSaving(false);
    }
  };

  const handleCancel = () => {
    supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: 500, overflow: 'hidden', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ background: '#0f172a', padding: '30px 40px', color: '#fff', position: 'relative' }}>
          <button 
            onClick={handleCancel}
            style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <UserCheck size={32} color="#3b82f6" />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Staff Onboarding</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>Activate your official school account.</p>
        </div>

        <div style={{ padding: '40px' }}>
          {/* Progress Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30, position: 'relative', maxWidth: 300, margin: '0 auto 30px' }}>
            <div style={{ position: 'absolute', top: 12, left: 20, right: 20, height: 2, background: '#e2e8f0', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: 12, left: 20, width: `${(step - 1) * 50}%`, height: 2, background: '#3b82f6', zIndex: 0, transition: '0.3s' }} />
            
            {[1, 2, 3].map(s => (
              <div key={s} style={{ 
                width: 26, height: 26, borderRadius: '50%', background: step >= s ? '#3b82f6' : '#e2e8f0', 
                color: step >= s ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1, fontSize: 12, fontWeight: 600, transition: '0.3s'
              }}>
                {s}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#b91c1c', borderRadius: 8, marginBottom: 20, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Shield size={16} /> {error}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.3s ease' }}>
              <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key size={20} color="#3b82f6" /> Verify Credentials
              </h3>
              <p style={{ margin: '-10px 0 10px 0', fontSize: 14, color: '#64748b' }}>Enter the details sent to your email by the system administrator.</p>
              
              <div>
                <label className="field-label">Email Address *</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 11 }} />
                  <input className="input" type="email" value={credentials.email} onChange={e => setCredentials({...credentials, email: e.target.value})} placeholder="you@school.com" style={{ paddingLeft: 40 }} />
                </div>
              </div>

              <div>
                <label className="field-label">Temporary Password *</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 11 }} />
                  <input className="input" type="password" value={credentials.tempPassword} onChange={e => setCredentials({...credentials, tempPassword: e.target.value})} placeholder="EduOne@..." style={{ paddingLeft: 40 }} />
                </div>
              </div>

              <div>
                <label className="field-label">Activation PIN *</label>
                <div style={{ position: 'relative' }}>
                  <Shield size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 11 }} />
                  <input className="input" type="password" maxLength={6} value={credentials.pin} onChange={e => setCredentials({...credentials, pin: e.target.value})} placeholder="6-digit PIN" style={{ paddingLeft: 40 }} />
                </div>
              </div>
              
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={handleVerify} disabled={saving} style={{ background: '#0f172a', padding: '12px 24px' }}>
                  {saving ? 'Verifying...' : 'Verify & Continue →'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.3s ease' }}>
              <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={20} color="#3b82f6" /> Secure Your Account
              </h3>
              <p style={{ margin: '-10px 0 10px 0', fontSize: 14, color: '#64748b' }}>
                Welcome, <strong>{staffRecord?.name}</strong>! Please set a permanent password for your account.
              </p>
              
              <div>
                <label className="field-label">New Password *</label>
                <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" />
              </div>

              <div>
                <label className="field-label">Confirm Password *</label>
                <input className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Retype password" />
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn" onClick={() => { setError(''); setStep(1); }}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={handleActivate} disabled={saving} style={{ background: '#3b82f6', borderColor: '#3b82f6', padding: '12px 24px', color: '#fff' }}>
                  {saving ? 'Activating...' : 'Activate Account'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', padding: '40px 0', animation: 'fadeIn 0.3s ease', textAlign: 'center' }}>
              <CheckCircle2 size={64} color="#3b82f6" style={{ margin: '20px 0' }} />
              <h2 style={{ margin: 0, color: '#0f172a' }}>Activation Successful!</h2>
              <p className="muted" style={{ marginBottom: 20 }}>Your official school account has been secured and activated.</p>
              <p className="muted" style={{ fontSize: 14 }}>
                <Loader size={16} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8, color: '#3b82f6' }} />
                Redirecting to your dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
