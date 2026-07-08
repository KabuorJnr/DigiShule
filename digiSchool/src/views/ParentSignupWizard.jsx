import { useState, useEffect } from 'react';
import { Users, Search, CheckCircle2, User, CreditCard, Loader, Shield } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function ParentSignupWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1: Student Lookup
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [admNumber, setAdmNumber] = useState('');
  const [parentPin, setParentPin] = useState('');
  const [foundStudent, setFoundStudent] = useState(null);

  useEffect(() => {
    supabase.rpc('get_public_schools').then(({ data, error }) => {
      if (!error && data) setSchools(data);
    });
  }, []);
  
  // Step 2: Parent Profile
  const [parent, setParent] = useState({
    name: '', email: '', password: ''
  });

  // Step 3: Payment Verification
  const [payment, setPayment] = useState({
    transactionCode: ''
  });

  const handleLookupStudent = async () => {
    setError('');
    if (!selectedSchool) return setError('Please select your school.');
    if (!admNumber.trim()) return setError('Please enter your child\'s admission number.');
    if (!parentPin.trim()) return setError('Please enter the Parent Access PIN provided by the school.');
    
    setSaving(true);
    try {
      const { data, error: fetchErr } = await supabase
        .rpc('lookup_student_for_signup', { 
          p_school_id: selectedSchool, 
          p_adm: admNumber.trim().toUpperCase(),
          p_parent_pin: parentPin.trim()
        });

      if (fetchErr) throw fetchErr;
      const student = Array.isArray(data) ? data[0] : data;
      if (!student) throw new Error('Student not found. Please verify the Admission Number and Parent Access PIN.');

      setFoundStudent(student);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to locate student.');
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    setError('');
    if (step === 2) {
      if (!parent.name || !parent.email || !parent.password) return setError('Please fill in all required fields.');
      if (parent.password.length < 6) return setError('Password must be at least 6 characters.');
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(parent.email.trim())) {
        return setError('Please enter a valid email address.');
      }

      setStep(3);
    }
  };

  const handleVerifyPayment = () => {
    setError('');
    if (payment.transactionCode.trim().length < 10) {
      return setError('Invalid M-Pesa Transaction Code. Must be exactly 10 characters.');
    }
    // Simulate payment verification success
    setStep(4);
    provisionAccount();
  };

  const provisionAccount = async () => {
    setSaving(true);
    setError('');
    
    try {
      // 1. Create Parent Auth Account
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: parent.email.trim(),
        password: parent.password,
        options: {
          data: {
            full_name: parent.name,
            role: 'parent',
            school_id: foundStudent.school_id
          }
        }
      });
      
      if (authErr) {
        if (authErr.message.includes('already registered')) {
          throw new Error('An account with this email is already registered.');
        }
        throw new Error(`Auth Error: ${authErr.message}`);
      }
      
      if (!authData?.user) throw new Error('Failed to create authentication credentials.');

      // 2. Update Parent Profile linked to the Student (upsert since trigger may have created it)
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        username: parent.email, // using email as username
        full_name: parent.name,
        role: 'parent',
        student_id: foundStudent.id,
        school_id: foundStudent.school_id
      });

      if (profileErr) {
        throw new Error(`Profile linking failed. Error: ${profileErr.message}`);
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
      setError(err.message || 'An unexpected error occurred during account provisioning.');
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
            <Users size={32} color="#10B981" />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Parent Portal Activation</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>Link your account to your child to track their academic journey.</p>
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
                <Search size={20} color="#10B981" /> Find Your Child
              </h3>
              <p style={{ margin: '-10px 0 10px 0', fontSize: 14, color: '#64748b' }}>Enter your child's official Admission Number as provided by the school.</p>
              
              <div>
                <label className="field-label">Select School *</label>
                <select className="select" value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}>
                  <option value="" disabled>-- Select Your School --</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">Admission Number *</label>
                <input className="input" value={admNumber} onChange={e => setAdmNumber(e.target.value)} placeholder="e.g. ADM/2026/9027" style={{ textTransform: 'uppercase' }} />
              </div>

              <div>
                <label className="field-label">Parent Access PIN *</label>
                <input className="input" type="password" maxLength={6} value={parentPin} onChange={e => setParentPin(e.target.value)} placeholder="6-digit PIN" />
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>This secret PIN is provided by the school.</p>
              </div>
              
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={handleLookupStudent} disabled={saving} style={{ background: '#0f172a', padding: '12px 24px' }}>
                  {saving ? 'Searching...' : 'Search →'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.3s ease' }}>
              <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={20} color="#10B981" /> Parent Details
              </h3>
              <p style={{ margin: '-10px 0 10px 0', fontSize: 14, color: '#64748b' }}>
                Student Found: <strong>{foundStudent?.name} ({foundStudent?.adm})</strong>
              </p>
              
              <div>
                <label className="field-label">Your Full Name *</label>
                <input className="input" value={parent.name} onChange={e => setParent({...parent, name: e.target.value})} placeholder="e.g. Jane Doe" />
              </div>

              <div>
                <label className="field-label">Email Address *</label>
                <input className="input" type="email" value={parent.email} onChange={e => setParent({...parent, email: e.target.value})} placeholder="you@example.com" />
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>This will be your login username.</p>
              </div>
              
              <div>
                <label className="field-label">Create Password *</label>
                <input className="input" type="password" value={parent.password} onChange={e => setParent({...parent, password: e.target.value})} placeholder="Minimum 6 characters" />
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
                <CreditCard size={20} color="#10B981" /> Account Activation
              </h3>
              
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 20, borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: '#166534', fontWeight: 600, marginBottom: 8 }}>MONTHLY SUBSCRIPTION</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#14532d', marginBottom: 16 }}>KES 250</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15, color: '#166534' }}>
                  <div>1. Go to M-Pesa on your phone</div>
                  <div>2. Select <strong>Lipa na M-Pesa</strong> → <strong>Paybill</strong></div>
                  <div>3. Enter Business Number: <strong style={{ fontSize: 18, color: '#000' }}>123456</strong></div>
                  <div>4. Enter Account Number: <strong style={{ fontSize: 18, color: '#000' }}>{foundStudent?.adm || 'EDUONE'}</strong></div>
                  <div>5. Enter Amount: <strong>250</strong></div>
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
                  maxLength={10}
                />
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn" onClick={() => { setError(''); setStep(2); }}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={handleVerifyPayment} disabled={saving} style={{ background: '#10B981', borderColor: '#10B981', padding: '12px 24px', color: '#fff' }}>
                  {saving ? 'Verifying...' : 'Verify & Activate'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', padding: '40px 0', animation: 'fadeIn 0.3s ease', textAlign: 'center' }}>
              {saving ? (
                <>
                  <Loader size={48} color="#10B981" className="spin" style={{ margin: '20px 0' }} />
                  <h3 style={{ margin: 0 }}>Activating Account...</h3>
                  <p className="muted">Please wait while we link your account to {foundStudent?.name}.</p>
                </>
              ) : (
                <>
                  <CheckCircle2 size={64} color="#10B981" style={{ margin: '20px 0' }} />
                  <h2 style={{ margin: 0, color: '#0f172a' }}>Activation Successful!</h2>
                  <p className="muted" style={{ marginBottom: 20 }}>Your Parent Portal has been securely linked and activated.</p>
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
