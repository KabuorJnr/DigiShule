import { useState } from 'react';
import { Building, Settings, CheckCircle2, User, CreditCard, Loader, Shield } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { registerSchool } from '../lib/api';

export default function SignupWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // School Profile
  const [school, setSchool] = useState({
    name: '', motto: '', logo: '', phone: '', email: '', levels: 'JSS, Senior Secondary'
  });
  
  // Principal Profile
  const [principal, setPrincipal] = useState({
    name: '', email: '', password: ''
  });

  // Payment Verification
  const [payment, setPayment] = useState({
    transactionCode: ''
  });

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!school.name || !school.levels) return setError('Please fill in all required school fields.');
      setStep(2);
    } else if (step === 2) {
      if (!principal.name || !principal.email || !principal.password) return setError('Please fill in all required principal fields.');
      if (principal.password.length < 6) return setError('Password must be at least 6 characters.');
      setStep(3);
    }
  };

  const handleVerifyPayment = () => {
    setError('');
    if (payment.transactionCode.trim().length < 8) {
      return setError('Invalid M-Pesa Transaction Code. Must be at least 8 characters.');
    }
    // Simulate payment verification success
    setStep(4);
    provisionAccount();
  };

  const provisionAccount = async () => {
    setSaving(true);
    setError('');
    
    try {
      // 1. Create Principal Auth Account First (so we have auth.uid() for the RPC)
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: principal.email,
        password: principal.password,
        options: {
          data: { role: 'principal', full_name: principal.name }
        }
      });
      
      if (authErr) {
        if (authErr.message.includes('already registered')) {
          throw new Error('An account with this email is already registered.');
        }
        throw new Error(`Auth Error: ${authErr.message}`);
      }
      
      if (!authData?.user) throw new Error('Failed to create authentication credentials.');

      // 2. Register the School Record (calls RPC with the new auth.uid)
      const parsedLevels = school.levels.split(',').map(s => s.trim()).filter(Boolean);
      
      const schoolId = await registerSchool({
        name: school.name,
        motto: school.motto,
        type: null,
        county: null,
        address: null,
        phone: school.phone,
        email: school.email,
        website: null,
        logoUrl: school.logo
      });
      
      if (!schoolId) throw new Error('Failed to commission school in database.');

      // Also persist to localStorage for the App's legacy fallback config
      const config = {
        school: {
          name: school.name, motto: school.motto, logo: school.logo, phone: school.phone, email: school.email,
          levels: parsedLevels.length > 0 ? parsedLevels : ['Grade 7', 'Grade 8']
        }
      };
      localStorage.setItem('eduone_school_config', JSON.stringify(config));
      localStorage.setItem('eduone_school_id', schoolId);

      // 3. Create/Update Principal Profile
      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username: principal.email, // using email as username for principal
        full_name: principal.name,
        role: 'principal',
        school_id: schoolId
      });

      if (profileErr) {
        throw new Error(`Profile creation failed. RLS might be enabled. Error: ${profileErr.message}`);
      }

      // Success! Complete wizard and log them in
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        } else {
          window.location.href = '/portal';
        }
      }, 1500);

    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred during provisioning.');
      setStep(3); // push back to payment screen so they can retry without paying again
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 600, width: '100%', background: '#fff', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        
        <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#fff', padding: '30px 40px', position: 'relative' }}>
          <button 
            onClick={onCancel}
            style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Building size={32} color="#10B981" />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Commission Your School</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>Join EduOne and digitize your institution in minutes.</p>
        </div>

        <div style={{ padding: '40px' }}>
          {/* Progress Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 12, left: 20, right: 20, height: 2, background: '#e2e8f0', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: 12, left: 20, width: `${(step - 1) * 33}%`, height: 2, background: '#10B981', zIndex: 0, transition: '0.3s' }} />
            
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{ 
                width: 26, height: 26, borderRadius: '50%', background: step >= s ? '#10B981' : '#e2e8f0', 
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
                <Building size={20} color="#10B981" /> Institutional Profile
              </h3>
              
              <div>
                <label className="field-label">Institution Name *</label>
                <input className="input" value={school.name} onChange={e => setSchool({...school, name: e.target.value})} placeholder="e.g. Alliance High School" />
              </div>
              
              <div>
                <label className="field-label">Institution Motto</label>
                <input className="input" value={school.motto} onChange={e => setSchool({...school, motto: e.target.value})} placeholder="e.g. Strong to Serve" />
              </div>

              <div>
                <label className="field-label">Levels / Grades Offered *</label>
                <input className="input" value={school.levels} onChange={e => setSchool({...school, levels: e.target.value})} placeholder="e.g. JSS, Senior Secondary" />
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>Comma separated.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="field-label">Official Phone</label>
                  <input className="input" value={school.phone} onChange={e => setSchool({...school, phone: e.target.value})} />
                </div>
                <div>
                  <label className="field-label">Official Email</label>
                  <input className="input" value={school.email} onChange={e => setSchool({...school, email: e.target.value})} />
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={nextStep} style={{ background: '#0f172a', padding: '12px 24px' }}>Continue →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.3s ease' }}>
              <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={20} color="#10B981" /> Principal's Administrator Account
              </h3>
              <p style={{ margin: '-10px 0 10px 0', fontSize: 14, color: '#64748b' }}>This account will be the master administrator for {school.name || 'your school'}.</p>
              
              <div>
                <label className="field-label">Full Name *</label>
                <input className="input" value={principal.name} onChange={e => setPrincipal({...principal, name: e.target.value})} placeholder="e.g. Jane Doe" />
              </div>

              <div>
                <label className="field-label">Email Address (Username) *</label>
                <input className="input" type="email" value={principal.email} onChange={e => setPrincipal({...principal, email: e.target.value})} placeholder="principal@school.com" />
              </div>
              
              <div>
                <label className="field-label">Secure Password *</label>
                <input className="input" type="password" value={principal.password} onChange={e => setPrincipal({...principal, password: e.target.value})} placeholder="Minimum 6 characters" />
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn" onClick={() => { setError(''); setStep(1); }}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={nextStep} style={{ background: '#0f172a', padding: '12px 24px' }}>Continue to Payment →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.3s ease' }}>
              <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={20} color="#10B981" /> Commissioning Payment
              </h3>
              
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 20, borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#166534', fontWeight: 600, marginBottom: 8 }}>ACCOUNT ACTIVATION FEE</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#14532d', marginBottom: 16 }}>KES 5,000</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15, color: '#166534' }}>
                  <div>1. Go to M-Pesa on your phone</div>
                  <div>2. Select <strong>Lipa na M-Pesa</strong> → <strong>Paybill</strong></div>
                  <div>3. Enter Business Number: <strong style={{ fontSize: 18, color: '#000' }}>123456</strong></div>
                  <div>4. Enter Account Number: <strong style={{ fontSize: 18, color: '#000' }}>EDUONE</strong></div>
                  <div>5. Enter Amount: <strong>5000</strong></div>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label className="field-label">Enter M-Pesa Transaction Code *</label>
                <input 
                  className="input" 
                  value={payment.transactionCode} 
                  onChange={e => setPayment({...payment, transactionCode: e.target.value.toUpperCase()})} 
                  placeholder="e.g. SAJ1234XYZ" 
                  style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600 }}
                />
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn" onClick={() => { setError(''); setStep(2); }}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={handleVerifyPayment} disabled={saving} style={{ background: '#10B981', borderColor: '#10B981', padding: '12px 24px', color: '#fff' }}>
                  {saving ? 'Verifying...' : 'Verify Payment & Commission'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', padding: '40px 0', animation: 'fadeIn 0.3s ease', textAlign: 'center' }}>
              {saving ? (
                <>
                  <Loader size={48} color="#10B981" className="spin" style={{ margin: '20px 0' }} />
                  <h3 style={{ margin: 0 }}>Commissioning School...</h3>
                  <p className="muted">Please wait while we provision your secure multi-tenant environment.</p>
                </>
              ) : (
                <>
                  <CheckCircle2 size={64} color="#10B981" style={{ margin: '20px 0' }} />
                  <h2 style={{ margin: 0, color: '#0f172a' }}>School Commissioned Successfully!</h2>
                  <p className="muted" style={{ marginBottom: 20 }}>Your Principal account has been created and your school is now active on EduOne.</p>
                  <p className="muted" style={{ fontSize: 14 }}>Redirecting to your dashboard...</p>
                </>
              )}
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
