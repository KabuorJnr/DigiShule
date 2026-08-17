import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, User, Sparkles, CheckCircle2, Shield, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { addOnboardingRequest, PLANS } from '../lib/superadmin';

const STEPS = ['School', 'Administrator', 'Plan', 'Confirm'];

// Africa-themed background: the generated Kenyan-classroom illustration.
const SIGNUP_BG = '/login-classroom.svg';

export default function SignupWizard({ onComplete, onCancel }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [school, setSchool] = useState({ name: '', motto: '', logo: '', phone: '', email: '', levels: 'JSS, Senior Secondary' });
  const [principal, setPrincipal] = useState({ name: '', email: '', password: '' });
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

  const goHome = (e) => { if (e) e.preventDefault(); if (onCancel) onCancel(); else navigate('/'); };
  const finish = () => { if (onComplete) onComplete(); else navigate('/'); };
  const planBlurb = { starter: 'Up to 250 learners', standard: 'Up to 800 learners', premium: 'Unlimited learners' };

  return (
    <div className="su">
      <div className="su-bg" aria-hidden="true" />
      <a href="/" className="su-back" onClick={goHome}><ArrowLeft size={16} /> Back to site</a>

      <div className="su-shell">
        <div className="su-card">
          <a href="/" className="su-brandmark" onClick={goHome} aria-label="EduOne home">
            <img src="/logo.png" alt="EduOne" />
          </a>

          <div className="su-head">
            <h1>Commission your school</h1>
            <p>A few details and our team will onboard you — usually within a day.</p>
          </div>

          {/* Stepper */}
          <div className="su-steps">
            <div className="su-steps-track" />
            <div className="su-steps-fill" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
            {STEPS.map((label, i) => {
              const n = i + 1;
              const state = step > n ? 'done' : step === n ? 'active' : 'todo';
              return (
                <div key={label} className={`su-stepitem ${state}`}>
                  <div className="su-stepdot">{state === 'done' ? <Check size={15} /> : n}</div>
                  <span className="su-steplabel">{label}</span>
                </div>
              );
            })}
          </div>

          {error && <div className="su-error"><Shield size={16} /> {error}</div>}

          {/* Step 1 — School */}
          {step === 1 && (
            <div className="su-step">
              <h3><Building2 size={18} /> Institutional profile</h3>
              <div className="su-field">
                <label>Institution name *</label>
                <input className="su-input" value={school.name} onChange={e => setSchool({ ...school, name: e.target.value })} placeholder="e.g. Alliance High School" autoFocus />
              </div>
              <div className="su-field">
                <label>Motto</label>
                <input className="su-input" value={school.motto} onChange={e => setSchool({ ...school, motto: e.target.value })} placeholder="e.g. Strong to Serve" />
              </div>
              <div className="su-field">
                <label>Levels / grades offered *</label>
                <input className="su-input" value={school.levels} onChange={e => setSchool({ ...school, levels: e.target.value })} placeholder="e.g. JSS, Senior Secondary" />
                <span className="su-hint">Comma separated.</span>
              </div>
              <div className="su-grid2">
                <div className="su-field">
                  <label>Official phone</label>
                  <input className="su-input" value={school.phone} onChange={e => setSchool({ ...school, phone: e.target.value })} placeholder="+254 7xx xxx xxx" />
                </div>
                <div className="su-field">
                  <label>Official email</label>
                  <input className="su-input" value={school.email} onChange={e => setSchool({ ...school, email: e.target.value })} placeholder="info@school.ac.ke" />
                </div>
              </div>
              <div className="su-actions">
                <span />
                <button type="button" className="su-btn su-btn-primary" onClick={nextStep}>Continue <ArrowRight size={17} /></button>
              </div>
            </div>
          )}

          {/* Step 2 — Administrator */}
          {step === 2 && (
            <div className="su-step">
              <h3><User size={18} /> Principal&apos;s administrator account</h3>
              <p className="su-substep">The master administrator for {school.name || 'your school'}.</p>
              <div className="su-field">
                <label>Full name *</label>
                <input className="su-input" value={principal.name} onChange={e => setPrincipal({ ...principal, name: e.target.value })} placeholder="e.g. Jane Otieno" autoFocus />
              </div>
              <div className="su-field">
                <label>Email address (username) *</label>
                <input className="su-input" type="email" value={principal.email} onChange={e => setPrincipal({ ...principal, email: e.target.value })} placeholder="principal@school.ac.ke" />
              </div>
              <div className="su-field">
                <label>Secure password *</label>
                <input className="su-input" type="password" value={principal.password} onChange={e => setPrincipal({ ...principal, password: e.target.value })} placeholder="Minimum 6 characters" />
              </div>
              <div className="su-actions">
                <button type="button" className="su-btn su-btn-ghost" onClick={() => { setError(''); setStep(1); }}><ArrowLeft size={16} /> Back</button>
                <button type="button" className="su-btn su-btn-primary" onClick={nextStep}>Continue <ArrowRight size={17} /></button>
              </div>
            </div>
          )}

          {/* Step 3 — Plan */}
          {step === 3 && (
            <div className="su-step">
              <h3><Sparkles size={18} /> Choose your plan</h3>
              <p className="su-substep">No payment now — pick the plan that fits. Our team reviews and onboards you.</p>
              <div className="su-plans">
                {Object.values(PLANS).map(p => {
                  const active = selectedPlan === p.id;
                  return (
                    <button key={p.id} type="button" className={`su-plan ${active ? 'active' : ''}`} onClick={() => setSelectedPlan(p.id)}>
                      <span className="su-plan-check">{active && <Check size={14} />}</span>
                      <div className="su-plan-info">
                        <div className="su-plan-name">{p.name}</div>
                        <div className="su-plan-blurb">{planBlurb[p.id]}</div>
                      </div>
                      <div className="su-plan-price">KES {p.price.toLocaleString()}<span>/mo</span></div>
                    </button>
                  );
                })}
              </div>
              <div className="su-actions">
                <button type="button" className="su-btn su-btn-ghost" onClick={() => { setError(''); setStep(2); }}><ArrowLeft size={16} /> Back</button>
                <button type="button" className="su-btn su-btn-primary" onClick={submitRequest} disabled={saving}>
                  {saving ? 'Submitting…' : <>Submit for onboarding <ArrowRight size={17} /></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Confirmation */}
          {step === 4 && (
            <div className="su-step su-done">
              <span className="su-done-ico"><CheckCircle2 size={40} /></span>
              <h2>Request submitted!</h2>
              <p><strong>{school.name}</strong> has been sent to the EduOne team for onboarding on the <strong>{PLANS[selectedPlan].name}</strong> plan (KES {PLANS[selectedPlan].price.toLocaleString()}/mo).</p>
              <p className="su-done-sub">We&apos;ll review and activate your account shortly — you&apos;ll be notified at {principal.email || 'your email'}.</p>
              <button type="button" className="su-btn su-btn-primary su-done-btn" onClick={finish}>Done</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        .su {
          --blue:#2563eb; --blue-700:#1d4ed8;
          --grad: linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #3b82f6 100%);
          --ink:#0b1220; --slate:#475569; --muted:#64748b;
          --border:#e6eaf1; --border-strong:#d7deea;
          position:relative; min-height:100vh; display:flex; align-items:center; justify-content:center;
          padding:56px 20px; overflow:hidden;
          background:#0b1220 url('${SIGNUP_BG}') center / cover no-repeat;
          font-family:'Inter',system-ui,sans-serif; color:var(--ink); -webkit-font-smoothing:antialiased;
        }
        .su * { box-sizing:border-box; }
        .su-bg { position:absolute; inset:0; z-index:0; pointer-events:none;
          background: linear-gradient(135deg, rgba(9,15,28,.82) 0%, rgba(19,44,108,.7) 55%, rgba(37,99,235,.5) 100%); }
        .su-bg::after { content:''; position:absolute; inset:0; opacity:.4;
          -webkit-mask-image:linear-gradient(to bottom,#000,transparent 78%); mask-image:linear-gradient(to bottom,#000,transparent 78%);
          background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px); background-size:46px 46px; }
        .su-back { position:absolute; top:22px; left:22px; z-index:3; display:inline-flex; align-items:center; gap:6px; font-size:.88rem; font-weight:600; color:rgba(255,255,255,.9); text-shadow:0 1px 8px rgba(0,0,0,.4); text-decoration:none; cursor:pointer; }
        .su-back:hover { color:#fff; }

        .su-shell { position:relative; z-index:1; width:100%; max-width:520px; }
        .su-card { background:#fff; border:1px solid var(--border); border-radius:22px; padding:30px 32px; box-shadow:0 1px 2px rgba(16,24,40,.04), 0 24px 60px rgba(16,24,40,.18); }
        .su-brandmark { display:flex; justify-content:center; margin-bottom:18px; }
        .su-brandmark img { height:34px; width:auto; display:block; }
        .su-head { text-align:center; margin-bottom:22px; }
        .su-head h1 { font-family:'Outfit',sans-serif; font-size:1.55rem; font-weight:800; letter-spacing:-0.02em; margin:0 0 6px; }
        .su-head p { color:var(--muted); font-size:.93rem; margin:0; }

        /* stepper */
        .su-steps { position:relative; display:flex; justify-content:space-between; margin-bottom:26px; }
        .su-steps-track, .su-steps-fill { position:absolute; top:15px; left:16px; right:16px; height:2px; background:var(--border); border-radius:2px; }
        .su-steps-fill { right:auto; background:var(--grad); transition:width .35s cubic-bezier(.16,1,.3,1); }
        .su-stepitem { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; gap:7px; flex:1; }
        .su-stepdot { display:grid; place-items:center; width:32px; height:32px; border-radius:50%; background:#fff; border:2px solid var(--border); color:var(--muted); font-family:'Outfit',sans-serif; font-weight:700; font-size:.85rem; transition:.25s ease; }
        .su-stepitem.active .su-stepdot { border-color:var(--blue); color:var(--blue); box-shadow:0 0 0 4px rgba(37,99,235,.12); }
        .su-stepitem.done .su-stepdot { background:var(--grad); border-color:transparent; color:#fff; }
        .su-steplabel { font-size:.76rem; font-weight:600; color:var(--muted); }
        .su-stepitem.active .su-steplabel, .su-stepitem.done .su-steplabel { color:var(--ink); }
        @media (max-width:440px){ .su-steplabel{ display:none; } }

        .su-error { display:flex; align-items:center; gap:9px; background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:11px 14px; border-radius:11px; font-size:.86rem; margin-bottom:18px; }

        .su-step { animation:suIn .3s ease; }
        @keyframes suIn { from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
        .su-step h3 { display:flex; align-items:center; gap:8px; font-family:'Outfit',sans-serif; font-size:1.1rem; font-weight:700; margin:0 0 14px; }
        .su-step h3 svg { color:var(--blue); }
        .su-substep { color:var(--muted); font-size:.9rem; margin:-8px 0 18px; }
        .su-field { margin-bottom:15px; }
        .su-field label { display:block; font-size:.82rem; font-weight:700; color:var(--slate); margin-bottom:7px; }
        .su-input { width:100%; font-family:inherit; font-size:.95rem; color:var(--ink); padding:12px 14px; border:1px solid var(--border-strong); border-radius:11px; background:#fff; transition:border-color .15s ease, box-shadow .15s ease; }
        .su-input::placeholder { color:#9aa7b8; }
        .su-input:focus { outline:none; border-color:var(--blue); box-shadow:0 0 0 3px rgba(37,99,235,.14); }
        .su-hint { display:block; font-size:.76rem; color:var(--muted); margin-top:5px; }
        .su-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media (max-width:460px){ .su-grid2{ grid-template-columns:1fr; } }

        /* plan cards */
        .su-plans { display:flex; flex-direction:column; gap:11px; margin-top:2px; }
        .su-plan { display:flex; align-items:center; gap:14px; text-align:left; width:100%; padding:15px 16px; border:1px solid var(--border-strong); border-radius:13px; background:#fff; cursor:pointer; transition:border-color .15s ease, background .15s ease, box-shadow .15s ease; }
        .su-plan:hover { border-color:#b9c4d6; }
        .su-plan.active { border:2px solid var(--blue); background:#eff4ff; box-shadow:0 6px 18px rgba(37,99,235,.12); }
        .su-plan-check { display:grid; place-items:center; width:22px; height:22px; border-radius:50%; border:2px solid var(--border-strong); color:#fff; flex-shrink:0; }
        .su-plan.active .su-plan-check { background:var(--grad); border-color:transparent; }
        .su-plan-info { flex:1; }
        .su-plan-name { font-family:'Outfit',sans-serif; font-weight:700; }
        .su-plan-blurb { font-size:.82rem; color:var(--muted); }
        .su-plan-price { font-family:'Outfit',sans-serif; font-weight:800; font-size:1.05rem; }
        .su-plan-price span { font-size:.74rem; color:var(--muted); font-weight:600; }

        /* actions & buttons */
        .su-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:24px; }
        .su-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; font-family:inherit; font-weight:700; font-size:.94rem; border:1px solid transparent; border-radius:11px; padding:12px 20px; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease, color .18s ease; }
        .su-btn-primary { background:var(--grad); color:#fff; box-shadow:inset 0 1px 0 rgba(255,255,255,.22), 0 8px 20px rgba(37,99,235,.28); }
        .su-btn-primary:hover:not(:disabled) { transform:translateY(-2px); box-shadow:inset 0 1px 0 rgba(255,255,255,.22), 0 14px 30px rgba(37,99,235,.4); }
        .su-btn-primary:disabled { opacity:.7; cursor:not-allowed; }
        .su-btn-ghost { background:#fff; color:var(--ink); border-color:var(--border-strong); }
        .su-btn-ghost:hover { border-color:var(--blue); color:var(--blue); }

        /* done */
        .su-done { text-align:center; padding:6px 0; }
        .su-done-ico { display:grid; place-items:center; width:74px; height:74px; border-radius:50%; background:#eafaef; color:#16a34a; margin:6px auto 16px; }
        .su-done h2 { font-family:'Outfit',sans-serif; font-size:1.5rem; font-weight:800; margin:0 0 10px; }
        .su-done p { color:var(--slate); font-size:.95rem; margin:0 auto 6px; max-width:42ch; }
        .su-done-sub { color:var(--muted); font-size:.88rem; }
        .su-done-btn { width:100%; margin-top:22px; }

        @media (prefers-reduced-motion: reduce){ .su-step{ animation:none; } .su-btn, .su-steps-fill, .su-stepdot{ transition:none; } }
      `}</style>
    </div>
  );
}
