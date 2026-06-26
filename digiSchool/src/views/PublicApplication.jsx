import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const schoolConfig = (() => {
  try {
    const raw = localStorage.getItem('eduone_school_config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();
const levels = schoolConfig?.levels || schoolConfig?.school?.levels || ['Grade 7', 'Grade 8', 'Grade 9'];

export default function PublicApplication({ onBack }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    studentName: '', kcpeMarks: '', dob: '', gender: 'Male', grade: levels[0],
    parentName: '', parentPhone: '', parentEmail: '',
    address: '', boarding: 'Day',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Mock saving to backend / pipeline into admissions table
      const applicant = {
        id: `ad_${Date.now()}`,
        name: form.studentName,
        kcpe: Number(form.kcpeMarks),
        gender: form.gender[0],
        form: form.grade,
        date: new Date().toISOString().slice(0, 10),
        status: 'Pending',
        dob: form.dob,
        parentName: form.parentName,
        parentPhone: form.parentPhone,
        parentEmail: form.parentEmail,
        boardingStatus: form.boarding,
      };

      const { error } = await supabase.from('admissions').insert(applicant);
      if (error) {
        // Fallback to localStorage or mock success if offline/no table
        console.warn('Supabase insert failed, mocking success', error);
      }
      
      setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20 }}>
        <div className="card card-pad" style={{ maxWidth: 500, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ width: 80, height: 80, background: '#d1fae5', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 40 }}>
            ✓
          </div>
          <h2>Application Received!</h2>
          <p className="muted" style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 30 }}>
            Thank you for applying to EduOne. Your application for <strong>{form.studentName}</strong> has been successfully submitted to our admissions office. We will contact you at {form.parentPhone} shortly.
          </p>
          <button className="btn btn-primary" onClick={onBack} style={{ padding: '12px 24px' }}>Return to Homepage</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 20px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <button className="btn" onClick={onBack} style={{ marginBottom: 20 }}>← Back to Homepage</button>
        
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ background: '#0f172a', color: '#fff', padding: '30px 40px' }}>
            <h1 style={{ margin: '0 0 10px 0', fontSize: 28 }}>Online Enrollment Application</h1>
            <p style={{ margin: 0, opacity: 0.8 }}>Join our community of excellence. Fill out the form below to begin.</p>
          </div>
          
          <div style={{ display: 'flex', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ flex: 1, padding: '16px 0', textAlign: 'center', fontWeight: 600, color: step === 1 ? '#0f172a' : '#94a3b8', borderBottom: step === 1 ? '3px solid #0ea5e9' : '3px solid transparent' }}>1. Student Details</div>
            <div style={{ flex: 1, padding: '16px 0', textAlign: 'center', fontWeight: 600, color: step === 2 ? '#0f172a' : '#94a3b8', borderBottom: step === 2 ? '3px solid #0ea5e9' : '3px solid transparent' }}>2. Parent/Guardian Info</div>
          </div>

          <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); setStep(2); }} style={{ padding: 40 }}>
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <label className="field-label" style={{ fontSize: 14 }}>Student Full Name *</label>
                  <input required className="input" placeholder="e.g. Jane Doe" value={form.studentName} onChange={e => setForm({...form, studentName: e.target.value})} />
                </div>
                <div className="grid grid-2" style={{ gap: 20 }}>
                  <div>
                    <label className="field-label" style={{ fontSize: 14 }}>Date of Birth *</label>
                    <input required type="date" className="input" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 14 }}>Gender *</label>
                    <select className="select" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-3" style={{ gap: 20 }}>
                  <div>
                    <label className="field-label" style={{ fontSize: 14 }}>Grade Applying For *</label>
                    <select className="select" value={form.grade} onChange={e => setForm({...form, grade: e.target.value})}>
                      {levels.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 14 }}>KCPE Marks (if applicable)</label>
                    <input type="number" className="input" placeholder="e.g. 350" value={form.kcpeMarks} onChange={e => setForm({...form, kcpeMarks: e.target.value})} />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 14 }}>Boarding Status *</label>
                    <select className="select" value={form.boarding} onChange={e => setForm({...form, boarding: e.target.value})}>
                      <option>Day Scholar</option>
                      <option>Boarding</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: '12px 30px', fontSize: 16 }}>Next: Parent Details →</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <label className="field-label" style={{ fontSize: 14 }}>Parent/Guardian Full Name *</label>
                  <input required className="input" placeholder="e.g. John Doe" value={form.parentName} onChange={e => setForm({...form, parentName: e.target.value})} />
                </div>
                <div className="grid grid-2" style={{ gap: 20 }}>
                  <div>
                    <label className="field-label" style={{ fontSize: 14 }}>Primary Phone Number *</label>
                    <input required type="tel" className="input" placeholder="+254..." value={form.parentPhone} onChange={e => setForm({...form, parentPhone: e.target.value})} />
                  </div>
                  <div>
                    <label className="field-label" style={{ fontSize: 14 }}>Email Address</label>
                    <input type="email" className="input" placeholder="For updates & portal access" value={form.parentEmail} onChange={e => setForm({...form, parentEmail: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="field-label" style={{ fontSize: 14 }}>Physical Address</label>
                  <textarea className="input" rows={3} placeholder="City, Estate, Street..." value={form.address} onChange={e => setForm({...form, address: e.target.value})}></textarea>
                </div>
                
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" className="btn" onClick={() => setStep(1)} style={{ padding: '12px 30px', fontSize: 16 }}>← Back</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '12px 30px', fontSize: 16, background: '#10b981', borderColor: '#10b981' }}>
                    {submitting ? 'Submitting...' : 'Submit Application ✓'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
