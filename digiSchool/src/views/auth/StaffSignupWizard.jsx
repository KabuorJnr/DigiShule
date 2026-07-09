import { useState } from 'react';
import { UserCircle2, ArrowRight, Shield, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

export default function StaffSignupWizard() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Verification State
  const [verifyForm, setVerifyForm] = useState({ email: '', pin: '' });
  const [verifiedStaff, setVerifiedStaff] = useState(null);
  
  // Account State
  const [accountForm, setAccountForm] = useState({ password: '', confirmPassword: '' });

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verifyForm.email || !verifyForm.pin) return setError('Please enter both Email and Access PIN.');
    
    setError('');
    setSaving(true);
    
    try {
      // Lookup pending staff via RPC
      const { data, error: lookupErr } = await supabase.rpc('lookup_staff_for_signup', {
        p_email: verifyForm.email.trim(),
        p_pin: verifyForm.pin.trim()
      });
      
      if (lookupErr) throw lookupErr;
      if (!data || data.length === 0) throw new Error('Invalid Email or Access PIN, or account is already active.');
      
      setVerifiedStaff(data[0]);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (accountForm.password.length < 6) return setError('Password must be at least 6 characters.');
    if (accountForm.password !== accountForm.confirmPassword) return setError('Passwords do not match.');
    
    setError('');
    setSaving(true);
    
    try {
      // 1. Create Supabase Auth User
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: verifyForm.email.trim(),
        password: accountForm.password,
        options: {
          data: { role: verifiedStaff.role, full_name: verifiedStaff.name }
        }
      });
      
      if (authErr) throw authErr;
      if (!authData?.user) throw new Error('Failed to create credentials.');
      
      // 2. Create Profile Record
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        username: verifyForm.email.trim(),
        full_name: verifiedStaff.name,
        role: verifiedStaff.role,
        school_id: verifiedStaff.school_id
      });
      
      if (profileErr) throw profileErr;
      
      // 3. Update Staff Record (Change status to Active and set real UUID)
      // Since staff.id is currently the email, we should ideally migrate it, 
      // but for now we just mark it active.
      const { error: staffErr } = await supabase.from('staff')
        .update({ status: 'Active', pin: null })
        .eq('id', verifyForm.email.trim());
        
      if (staffErr) throw staffErr;
      
      // 4. Also store school config in local storage if missing
      localStorage.setItem('eduone_school_id', verifiedStaff.school_id);
      
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: 500, background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          
          <div style={{ background: '#0f172a', padding: '30px 40px', color: '#fff', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: '50%' }}>
                <Shield size={32} color="#fff" />
              </div>
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Staff Activation</h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Complete your school staff profile</p>
          </div>

          <div style={{ padding: 40 }}>
            {error && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14, border: '1px solid #f87171' }}>
                {error}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleVerify}>
                <div style={{ marginBottom: 20 }}>
                  <label className="field-label">Registered Email</label>
                  <input 
                    type="email" 
                    className="input" 
                    placeholder="e.g. teacher@school.com"
                    value={verifyForm.email}
                    onChange={e => setVerifyForm({...verifyForm, email: e.target.value})}
                    required
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label className="field-label">Access PIN</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="6-digit PIN from Administrator"
                    value={verifyForm.pin}
                    onChange={e => setVerifyForm({...verifyForm, pin: e.target.value})}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
                  {saving ? 'Verifying...' : 'Verify Access'} <ArrowRight size={16} style={{ marginLeft: 8 }} />
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleCreateAccount}>
                <div style={{ marginBottom: 24, background: '#f1f5f9', padding: 16, borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <UserCircle2 size={24} color="#64748b" />
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{verifiedStaff?.name}</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>Role: {verifiedStaff?.role}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} /> Identity Verified
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="field-label">Create Password</label>
                  <input 
                    type="password" 
                    className="input" 
                    placeholder="Min 6 characters"
                    value={accountForm.password}
                    onChange={e => setAccountForm({...accountForm, password: e.target.value})}
                    required
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label className="field-label">Confirm Password</label>
                  <input 
                    type="password" 
                    className="input" 
                    value={accountForm.confirmPassword}
                    onChange={e => setAccountForm({...accountForm, confirmPassword: e.target.value})}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
                  {saving ? 'Creating Account...' : 'Complete Account Setup'}
                </button>
              </form>
            )}

            {step === 3 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <CheckCircle2 size={64} color="#10b981" />
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: 20, color: '#0f172a' }}>Account Activated!</h3>
                <p style={{ margin: '0 0 24px', color: '#64748b', lineHeight: 1.5 }}>
                  Your staff account has been successfully created and linked to the school.
                </p>
                <button className="btn btn-primary" onClick={() => window.location.href = '/login'} style={{ width: '100%' }}>
                  Go to Login
                </button>
              </div>
            )}
            
            {step === 1 && (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <a href="/login" style={{ fontSize: 14, color: '#0284c7', textDecoration: 'none' }}>Return to Login</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
