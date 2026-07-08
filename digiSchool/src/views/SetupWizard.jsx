import { useState } from 'react';
import { Building, Settings, CheckCircle2 } from 'lucide-react';

import * as api from '../lib/api';

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: 'My New School',
    motto: 'Excellence in Education',
    logo: '',
    phone: '',
    email: '',
    levels: 'JSS, Senior Secondary'
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    
    // Parse levels from comma separated string
    const parsedLevels = form.levels.split(',').map(s => s.trim()).filter(Boolean);
    
    try {
      // 1. Register the school via API (calls Supabase RPC)
      const schoolId = await api.registerSchool({
        name: form.name,
        motto: form.motto,
        phone: form.phone,
        email: form.email,
        logoUrl: form.logo
      });

      // 2. Set active school ID so subsequent queries are scoped correctly
      api.setActiveSchoolId(schoolId);

      // 3. Keep local config for settings that might not be DB-backed yet
      const config = {
        school: {
          name: form.name,
          motto: form.motto,
          logo: form.logo,
          phone: form.phone,
          email: form.email,
          levels: parsedLevels.length > 0 ? parsedLevels : ['Grade 7', 'Grade 8']
        }
      };
      localStorage.setItem('eduone_school_config', JSON.stringify(config));
      localStorage.setItem('eduone_school_id', schoolId);
      
      onComplete();
    } catch (err) {
      console.error("School registration failed", err);
      setErrorMsg(err.message || 'Failed to initialize school.');
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 600, width: '100%', background: '#fff', overflow: 'hidden' }}>
        
        <div style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', padding: '30px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Building size={32} />
            <h1 style={{ margin: 0, fontSize: 24 }}>System Initialization</h1>
          </div>
          <p style={{ margin: 0, opacity: 0.9 }}>Welcome to <img src="/eduone-logo.png" alt="EduOne" style={{ height: '3.5em', verticalAlign: 'middle', background: 'white', borderRadius: 8, padding: '2px 4px' }} />. Let's pre-configure your school profile before onboarding users.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '40px' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#059669', fontWeight: 600, marginBottom: 10 }}>
                <Settings size={20} /> Step 1: Institutional Profile
              </div>
              
              {errorMsg && (
                <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '14px' }}>
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="field-label">Institution Name *</label>
                <input required className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. EduOne Academy" />
              </div>
              
              <div>
                <label className="field-label">Institution Motto</label>
                <input className="input" value={form.motto} onChange={e => setForm({...form, motto: e.target.value})} placeholder="e.g. Striving for Excellence" />
              </div>

              <div>
                <label className="field-label">Logo URL (Optional)</label>
                <input className="input" value={form.logo} onChange={e => setForm({...form, logo: e.target.value})} placeholder="https://..." />
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>Next Step →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#059669', fontWeight: 600, marginBottom: 10 }}>
                <Settings size={20} /> Step 2: Academic Levels
              </div>

              <div>
                <label className="field-label">Levels / Grades Offered *</label>
                <p className="muted" style={{ fontSize: 13, marginTop: -4, marginBottom: 8 }}>
                  Enter the academic levels your institution offers, separated by commas. The system will dynamically adapt admissions and grading to these levels.
                </p>
                <input 
                  required 
                  className="input" 
                  value={form.levels} 
                  onChange={e => setForm({...form, levels: e.target.value})} 
                  placeholder="e.g. JSS, Senior Secondary, Grade 12" 
                />
              </div>

              <div className="grid grid-2" style={{ gap: 20, marginTop: 10 }}>
                <div>
                  <label className="field-label">Admin Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
                <div>
                  <label className="field-label">Admin Email</label>
                  <input className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn" onClick={() => setStep(1)}>← Back</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Initializing System...' : 'Complete Setup ✓'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
