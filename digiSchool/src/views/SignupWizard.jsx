import { useState } from 'react';
import { Building, CheckCircle2, User, Shield, Sparkles } from 'lucide-react';
import { addOnboardingRequest, PLANS } from '../lib/superadmin';

export default function SignupWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // School Profile
  const [school, setSchool] = useState({
    name: '', motto: '', logo: '', phone: '', email: '', levels: 'JSS, Senior Secondary'
  });

  // Principal Profile
  const [principal, setPrincipal] = useState({
    name: '', email: '', password: ''
  });

  // Selected subscription plan. No payment is taken now — an EduOne administrator
  // reviews the request and onboards (or rejects) the school.
  const [selectedPlan, setSelectedPlan] = useState('standard');

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

  const submitRequest = async () => {
    setError('');
    setSaving(true);
    try {
      await addOnboardingRequest({
        name: school.name,
        principal: principal.name,
        email: principal.email,
        phone: school.phone,
        plan: selectedPlan,
        students: 0,
        county: null,
      });
      setStep(4);
    } catch (e) {
      setError(e.message || 'Could not submit your request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const planBlurb = { starter: 'Up to 250 learners', standard: 'Up to 800 learners', premium: 'Unlimited learners' };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 600, width: '100%', background: '#fff', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>

        <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: '#fff', padding: '30px 40px', position: 'relative' }}>
          <button
            onClick={() => (onCancel ? onCancel() : (window.location.href = '/'))}
            style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Building size={32} color="#bfdbfe" />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Commission Your School</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>Join EduOne and digitize your institution in minutes — no upfront payment.</p>
        </div>

        <div style={{ padding: '40px' }}>
          {/* Progress Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 12, left: 20, right: 20, height: 2, background: '#e2e8f0', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: 12, left: 20, width: `${(step - 1) * 33}%`, height: 2, background: '#2563eb', zIndex: 0, transition: '0.3s' }} />

            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{
                width: 26, height: 26, borderRadius: '50%', background: step >= s ? '#2563eb' : '#e2e8f0',
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
                <Building size={20} color="#2563eb" /> Institutional Profile
              </h3>

              <div>
                <label className="field-label">Institution Name *</label>
                <input className="input" value={school.name} onChange={e => setSchool({ ...school, name: e.target.value })} placeholder="e.g. Alliance High School" />
              </div>

              <div>
                <label className="field-label">Institution Motto</label>
                <input className="input" value={school.motto} onChange={e => setSchool({ ...school, motto: e.target.value })} placeholder="e.g. Strong to Serve" />
              </div>

              <div>
                <label className="field-label">Levels / Grades Offered *</label>
                <input className="input" value={school.levels} onChange={e => setSchool({ ...school, levels: e.target.value })} placeholder="e.g. JSS, Senior Secondary" />
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>Comma separated.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label className="field-label">Official Phone</label>
                  <input className="input" value={school.phone} onChange={e => setSchool({ ...school, phone: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Official Email</label>
                  <input className="input" value={school.email} onChange={e => setSchool({ ...school, email: e.target.value })} />
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
                <User size={20} color="#2563eb" /> Principal's Administrator Account
              </h3>
              <p style={{ margin: '-10px 0 10px 0', fontSize: 14, color: '#64748b' }}>This account will be the master administrator for {school.name || 'your school'}.</p>

              <div>
                <label className="field-label">Full Name *</label>
                <input className="input" value={principal.name} onChange={e => setPrincipal({ ...principal, name: e.target.value })} placeholder="e.g. Jane Doe" />
              </div>

              <div>
                <label className="field-label">Email Address (Username) *</label>
                <input className="input" type="email" value={principal.email} onChange={e => setPrincipal({ ...principal, email: e.target.value })} placeholder="principal@school.com" />
              </div>

              <div>
                <label className="field-label">Secure Password *</label>
                <input className="input" type="password" value={principal.password} onChange={e => setPrincipal({ ...principal, password: e.target.value })} placeholder="Minimum 6 characters" />
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn" onClick={() => { setError(''); setStep(1); }}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={nextStep} style={{ background: '#0f172a', padding: '12px 24px' }}>Choose a plan →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.3s ease' }}>
              <h3 style={{ margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={20} color="#2563eb" /> Choose your plan
              </h3>
              <p style={{ margin: '-10px 0 0 0', fontSize: 14, color: '#64748b' }}>
                No payment now. Pick the plan that fits your school — our team reviews every application and onboards you, usually within a day.
              </p>

              <div style={{ display: 'grid', gap: 12 }}>
                {Object.values(PLANS).map(p => {
                  const active = selectedPlan === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlan(p.id)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left',
                        border: active ? '2px solid #2563eb' : '1px solid #e2e8f0', background: active ? '#eff4ff' : '#fff',
                        borderRadius: 12, padding: '16px 18px', cursor: 'pointer'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>{planBlurb[p.id]}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>
                        KES {p.price.toLocaleString()}<span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>/mo</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn" onClick={() => { setError(''); setStep(2); }}>← Back</button>
                <button type="button" className="btn btn-primary" onClick={submitRequest} disabled={saving} style={{ background: '#2563eb', borderColor: '#2563eb', padding: '12px 24px', color: '#fff', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Submitting…' : 'Submit for onboarding →'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', padding: '30px 0', animation: 'fadeIn 0.3s ease', textAlign: 'center' }}>
              <CheckCircle2 size={64} color="#16a34a" style={{ margin: '10px 0' }} />
              <h2 style={{ margin: 0, color: '#0f172a' }}>Request submitted!</h2>
              <p className="muted" style={{ marginBottom: 6 }}>
                Thank you. <strong>{school.name}</strong> has been sent to the EduOne team for onboarding on the <strong>{PLANS[selectedPlan].name}</strong> plan
                (KES {PLANS[selectedPlan].price.toLocaleString()}/mo).
              </p>
              <p className="muted" style={{ fontSize: 14 }}>We&apos;ll review and activate your account shortly — you&apos;ll be notified at {principal.email || 'your email'}.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => (onComplete ? onComplete() : (window.location.href = '/'))}
                style={{ background: '#2563eb', borderColor: '#2563eb', color: '#fff', padding: '12px 24px', marginTop: 10 }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
