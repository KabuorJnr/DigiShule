import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, CheckCircle2, User, CreditCard, Loader, Shield, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function ParentSignupWizard({ onComplete, onCancel }) {
  const navigate = useNavigate();
  const cancel = onCancel || (() => navigate('/login'));
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

  const stepTitles = ['Find your child', 'Parent details', 'Account activation', 'All done'];

  return (
    <div className="psw-page">
      <div className="psw-card">
        <div className="psw-header">
          <button className="psw-cancel" onClick={cancel}>Cancel</button>
          <div className="psw-brand">
            <span className="psw-brandicon"><Users size={22} /></span>
            <div>
              <h1>Parent Portal Activation</h1>
              <p>Link your account to your child and track their academic journey.</p>
            </div>
          </div>
        </div>

        <div className="psw-body">
          {/* Progress */}
          <div className="psw-steps" aria-label={`Step ${step} of 4: ${stepTitles[step - 1]}`}>
            <div className="psw-steptrack"><span style={{ width: `${((step - 1) / 3) * 100}%` }} /></div>
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`psw-dot${step > s ? ' done' : step === s ? ' on' : ''}`}>
                {step > s ? <Check /> : s}
              </div>
            ))}
          </div>

          {error && <div className="psw-error"><Shield size={16} /> {error}</div>}

          {step === 1 && (
            <div className="psw-step">
              <h3><Search size={19} /> Find your child</h3>
              <p className="psw-hint">Enter your child&apos;s official admission number as provided by the school.</p>

              <div className="psw-field">
                <label className="field-label">Select school *</label>
                <select className="select" value={selectedSchool} onChange={e => setSelectedSchool(e.target.value)}>
                  <option value="" disabled>-- Select your school --</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="psw-field">
                <label className="field-label">Admission number *</label>
                <input className="input" value={admNumber} onChange={e => setAdmNumber(e.target.value)} placeholder="e.g. ADM/2026/9027" style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="psw-field">
                <label className="field-label">Parent access PIN *</label>
                <input className="input" type="password" inputMode="numeric" maxLength={6} value={parentPin} onChange={e => setParentPin(e.target.value)} placeholder="6-digit PIN" />
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>This secret PIN is provided by the school.</p>
              </div>

              <div className="psw-actions">
                <button type="button" className="psw-btn" onClick={handleLookupStudent} disabled={saving}>
                  {saving ? 'Searching…' : <>Search <ArrowRight size={18} /></>}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="psw-step">
              <h3><User size={19} /> Parent details</h3>
              <p className="psw-hint">Student found: <strong style={{ color: '#0f172a' }}>{foundStudent?.name} ({foundStudent?.adm})</strong></p>

              <div className="psw-field">
                <label className="field-label">Your full name *</label>
                <input className="input" value={parent.name} onChange={e => setParent({ ...parent, name: e.target.value })} placeholder="e.g. Jane Doe" />
              </div>
              <div className="psw-field">
                <label className="field-label">Email address *</label>
                <input className="input" type="email" value={parent.email} onChange={e => setParent({ ...parent, email: e.target.value })} placeholder="you@example.com" />
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>This will be your login username.</p>
              </div>
              <div className="psw-field">
                <label className="field-label">Create password *</label>
                <input className="input" type="password" value={parent.password} onChange={e => setParent({ ...parent, password: e.target.value })} placeholder="Minimum 6 characters" />
              </div>

              <div className="psw-actions">
                <button type="button" className="psw-btn-ghost" onClick={() => { setError(''); setStep(1); }}><ArrowLeft size={17} /> Back</button>
                <button type="button" className="psw-btn" onClick={nextStep}>Continue <ArrowRight size={18} /></button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="psw-step">
              <h3><CreditCard size={19} /> Account activation</h3>

              <div className="psw-plan">
                <div className="psw-plan-label">MONTHLY SUBSCRIPTION</div>
                <div className="psw-plan-amt">KES 250</div>
                <ol className="psw-plan-steps">
                  <li>Open M-Pesa on your phone</li>
                  <li>Select <strong>Lipa na M-Pesa</strong> &rarr; <strong>Paybill</strong></li>
                  <li>Business number: <strong>123456</strong></li>
                  <li>Account number: <strong>{foundStudent?.adm || 'EDUONE'}</strong></li>
                  <li>Amount: <strong>250</strong></li>
                </ol>
              </div>

              <div className="psw-field">
                <label className="field-label">M-Pesa transaction code *</label>
                <input className="input" value={payment.transactionCode}
                  onChange={e => setPayment({ ...payment, transactionCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. SAJ1234XYZ" style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600 }} maxLength={10} />
              </div>

              <div className="psw-actions">
                <button type="button" className="psw-btn-ghost" onClick={() => { setError(''); setStep(2); }}><ArrowLeft size={17} /> Back</button>
                <button type="button" className="psw-btn" onClick={handleVerifyPayment} disabled={saving}>{saving ? 'Verifying…' : 'Verify & activate'}</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="psw-step" style={{ alignItems: 'center', textAlign: 'center', padding: '30px 0' }}>
              {saving ? (
                <>
                  <Loader size={46} color="#1E5FE0" className="spin" style={{ margin: '16px 0' }} />
                  <h3 style={{ margin: 0 }}>Activating account…</h3>
                  <p className="muted">Linking your account to {foundStudent?.name}.</p>
                </>
              ) : (
                <>
                  <span className="psw-success"><CheckCircle2 size={40} /></span>
                  <h2 style={{ margin: '6px 0 0', color: '#0f172a' }}>Activation successful!</h2>
                  <p className="muted" style={{ margin: '4px 0 0' }}>Your Parent Portal is securely linked and activated.</p>
                  <p className="muted" style={{ fontSize: 13 }}>Redirecting to your dashboard…</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .psw-page { min-height: 100dvh; background: #eef2f8; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; overflow-y: auto; -webkit-overflow-scrolling: touch; padding-bottom: max(24px, env(safe-area-inset-bottom)); font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        @media (min-width: 640px) { .psw-page { justify-content: center; padding: 28px 20px max(28px, env(safe-area-inset-bottom)); } }
        .psw-card { width: 100%; max-width: 540px; background: #fff; overflow: hidden; }
        @media (min-width: 640px) { .psw-card { border-radius: 22px; box-shadow: 0 30px 70px -24px rgba(15,30,70,.35); } }

        .psw-header { position: relative; color: #fff; background: linear-gradient(150deg, #12306E 0%, #142C63 52%, #1E5FE0 100%); padding: calc(env(safe-area-inset-top, 0px) + 34px) 22px 26px; }
        html.platform-android .psw-header, html.capacitor .psw-header { padding-top: calc(env(safe-area-inset-top, 0px) + 46px); }
        .psw-cancel { position: absolute; top: calc(env(safe-area-inset-top, 0px) + 16px); right: 16px; background: rgba(255,255,255,.16); border: 0; color: #fff; font: inherit; font-weight: 600; font-size: 13px; padding: 7px 13px; border-radius: 10px; cursor: pointer; }
        html.platform-android .psw-cancel, html.capacitor .psw-cancel { top: calc(env(safe-area-inset-top, 0px) + 28px); }
        .psw-cancel:hover { background: rgba(255,255,255,.26); }
        .psw-brand { display: flex; gap: 13px; align-items: flex-start; padding-right: 68px; }
        .psw-brandicon { width: 44px; height: 44px; border-radius: 13px; background: rgba(255,255,255,.16); display: grid; place-items: center; flex: 0 0 auto; }
        .psw-brand h1 { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2; }
        .psw-brand p { margin: 6px 0 0; font-size: 13px; opacity: .85; line-height: 1.5; }

        .psw-body { padding: 26px 22px; }
        .psw-steps { position: relative; display: flex; justify-content: space-between; margin-bottom: 28px; }
        .psw-steptrack { position: absolute; top: 13px; left: 14px; right: 14px; height: 3px; border-radius: 9px; background: #e2e8f0; }
        .psw-steptrack > span { display: block; height: 100%; border-radius: 9px; background: #1E5FE0; transition: width .3s ease; }
        .psw-dot { position: relative; z-index: 1; width: 28px; height: 28px; border-radius: 50%; background: #e2e8f0; color: #64748b; display: grid; place-items: center; font-size: 12.5px; font-weight: 700; transition: .3s; }
        .psw-dot.on { background: #1E5FE0; color: #fff; box-shadow: 0 6px 14px -6px #1E5FE0; }
        .psw-dot.done { background: #1E5FE0; color: #fff; }
        .psw-dot svg { width: 15px; height: 15px; }

        .psw-step { display: flex; flex-direction: column; gap: 16px; animation: fadeIn .3s ease; }
        .psw-step h3 { margin: 0; font-size: 17px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px; }
        .psw-step h3 svg { color: #1E5FE0; }
        .psw-hint { margin: -6px 0 2px; font-size: 13.5px; color: #64748b; line-height: 1.5; }
        .psw-field { display: flex; flex-direction: column; }
        .psw-field .field-label { margin-bottom: 6px; }

        .psw-actions { margin-top: 8px; display: flex; gap: 10px; }
        .psw-btn { flex: 1; min-height: 50px; border: 0; border-radius: 13px; background: linear-gradient(135deg, #1E5FE0, #142C63); color: #fff; font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 12px 24px -12px #1E5FE0; transition: transform .12s; }
        .psw-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .psw-btn:disabled { opacity: .7; cursor: not-allowed; }
        .psw-btn-ghost { min-height: 50px; padding: 0 18px; border: 1.5px solid #d7deea; border-radius: 13px; background: #fff; color: #334155; font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
        .psw-btn-ghost:hover { border-color: #1E5FE0; color: #1E5FE0; }

        .psw-error { display: flex; gap: 8px; align-items: center; background: #fee2e2; color: #b91c1c; padding: 12px 14px; border-radius: 11px; font-size: 13.5px; margin-bottom: 16px; }

        .psw-plan { background: linear-gradient(160deg, #EEF4FE, #DEE9FD); border: 1px solid #cfe0fb; border-radius: 16px; padding: 20px; text-align: center; }
        .psw-plan-label { font-size: 12px; letter-spacing: .08em; font-weight: 700; color: #1E5FE0; }
        .psw-plan-amt { font-size: 34px; font-weight: 800; color: #142C63; margin: 4px 0 14px; letter-spacing: -.02em; }
        .psw-plan-steps { margin: 0; padding: 0; list-style: none; counter-reset: p; display: flex; flex-direction: column; gap: 9px; text-align: left; }
        .psw-plan-steps li { counter-increment: p; position: relative; padding-left: 30px; font-size: 13.5px; color: #334155; line-height: 1.5; }
        .psw-plan-steps li::before { content: counter(p); position: absolute; left: 0; top: 0; width: 21px; height: 21px; border-radius: 50%; background: #1E5FE0; color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; }
        .psw-plan-steps strong { color: #0f172a; }

        .psw-success { width: 74px; height: 74px; border-radius: 50%; background: #D1FAE5; color: #059669; display: grid; place-items: center; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
