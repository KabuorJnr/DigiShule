import { useState } from 'react';
import { School, Users, BookOpen, Calendar, CheckCircle, ChevronRight, ChevronLeft, Upload } from 'lucide-react';

const SCHOOL_TYPES = ['National School', 'Extra-County School', 'County School', 'Sub-County School', 'Private School', 'International School'];
const COUNTIES = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Kiambu', 'Machakos', 'Meru', 'Nyeri', 'Kakamega', 'Kisii', 'Bungoma', 'Garissa', 'Embu', 'Other'];
const DEFAULT_SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography'];
const DEFAULT_DEPTS = { Mathematics: 'Math', English: 'Languages', Kiswahili: 'Languages', Biology: 'Sciences', Chemistry: 'Sciences', Physics: 'Sciences', History: 'Humanities', Geography: 'Humanities' };

const STEPS = [
  { id: 1, icon: School, label: 'School Identity' },
  { id: 2, icon: BookOpen, label: 'Academic Structure' },
  { id: 3, icon: Users, label: 'Staff & Admin' },
  { id: 4, icon: Calendar, label: 'Terms & Dates' },
  { id: 5, icon: CheckCircle, label: 'Review & Launch' },
];

const TYPE_COLOR = { academic: '#0078D4', exam: '#D13438', event: '#107C10', holiday: '#FFB900', meeting: '#7C3AED' };

function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', align: 'center', gap: 0, marginBottom: 40 }}>
      {STEPS.map((s, i) => {
        const done = current > s.id;
        const active = current === s.id;
        const Icon = s.icon;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'unset' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#107C10' : active ? '#0078D4' : '#e2e8f0',
                color: done || active ? '#fff' : '#94a3b8',
                transition: 'all 0.3s'
              }}>
                {done ? <CheckCircle size={18} /> : <Icon size={18} />}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? '#0078D4' : done ? '#107C10' : '#94a3b8', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#107C10' : '#e2e8f0', margin: '0 8px', marginBottom: 24, transition: 'all 0.3s' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1);

  // Step 1: School Identity
  const [school, setSchool] = useState({
    name: '', motto: '', type: 'National School', county: 'Nairobi',
    address: '', phone: '', email: '', website: '', logo: null,
  });

  // Step 2: Academic
  const [forms, setForms] = useState(4);
  const [streamsPerForm, setStreamsPerForm] = useState(2);
  const [streamNames, setStreamNames] = useState(['A', 'B', 'C', 'D']);
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS.map(s => ({ name: s, dept: DEFAULT_DEPTS[s] })));
  const [newSubj, setNewSubj] = useState('');

  // Step 3: Staff
  const [principal, setPrincipal] = useState('');
  const [depAcademic, setDepAcademic] = useState('');
  const [depAdmin, setDepAdmin] = useState('');
  const [financeOfficer, setFinanceOfficer] = useState('');
  const [registrar, setRegistrar] = useState('');

  // Step 4: Terms
  const [terms, setTerms] = useState([
    { term: 'Term 1', start: '2026-01-06', end: '2026-04-03' },
    { term: 'Term 2', start: '2026-04-27', end: '2026-07-30' },
    { term: 'Term 3', start: '2026-08-24', end: '2026-11-20' },
  ]);
  const [currentTerm, setCurrentTerm] = useState('Term 2');

  function handleLogo(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setSchool(s => ({ ...s, logo: String(e.target.result) }));
    reader.readAsDataURL(file);
  }

  function handleLaunch() {
    const streamList = streamNames.slice(0, streamsPerForm);
    const classes = [];
    for (let f = 1; f <= forms; f++) {
      for (const stream of streamList) classes.push(`${f}${stream}`);
    }
    const config = {
      school: { ...school },
      classes,
      subjects: subjects.map(s => s.name),
      departments: Object.fromEntries(subjects.map(s => [s.name, s.dept])),
      terms,
      currentTerm,
      staff: { principal, depAcademic, depAdmin, financeOfficer, registrar },
    };
    localStorage.setItem('eduone_school_config', JSON.stringify(config));
    localStorage.setItem('eduone_setup_done', '1');
    onComplete(config);
  }

  const genClasses = () => {
    const sl = streamNames.slice(0, streamsPerForm);
    const result = [];
    for (let f = 1; f <= forms; f++) {
      for (const s of sl) result.push(`Form ${f}${s}`);
    }
    return result;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0078D4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 780 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32, color: '#fff' }}>
          <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>Edu<span style={{ color: '#60a5fa' }}>One</span></div>
          <div style={{ fontSize: 16, opacity: 0.8, marginTop: 4 }}>School Management Platform — One-Time Setup</div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 48px', boxShadow: '0 32px 64px rgba(0,0,0,0.4)' }}>
          <StepIndicator current={step} />

          {/* ─── STEP 1: SCHOOL IDENTITY ─── */}
          {step === 1 && (
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>School Identity</h2>
              <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Tell us about your school. This will appear on all reports and student documents.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">School Name *</label>
                  <input className="input" placeholder="e.g. Starehe Boys' Centre" value={school.name} onChange={e => setSchool(s => ({ ...s, name: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Motto</label>
                  <input className="input" placeholder="e.g. Excellence in all" value={school.motto} onChange={e => setSchool(s => ({ ...s, motto: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">School Type</label>
                  <select className="select" value={school.type} onChange={e => setSchool(s => ({ ...s, type: e.target.value }))}>
                    {SCHOOL_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">County</label>
                  <select className="select" value={school.county} onChange={e => setSchool(s => ({ ...s, county: e.target.value }))}>
                    {COUNTIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input className="input" placeholder="+254 7XX XXX XXX" value={school.phone} onChange={e => setSchool(s => ({ ...s, phone: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="field-label">Address</label>
                  <input className="input" placeholder="P.O. Box, Town, County" value={school.address} onChange={e => setSchool(s => ({ ...s, address: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Email</label>
                  <input className="input" placeholder="admin@school.ac.ke" value={school.email} onChange={e => setSchool(s => ({ ...s, email: e.target.value }))} />
                </div>
                <div>
                  <label className="field-label">Website (optional)</label>
                  <input className="input" placeholder="https://yourschool.ac.ke" value={school.website} onChange={e => setSchool(s => ({ ...s, website: e.target.value }))} />
                </div>
              </div>
              {/* Logo Upload */}
              <div style={{ marginBottom: 24 }}>
                <label className="field-label">School Logo</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 12, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f8fafc' }}>
                    {school.logo ? <img src={school.logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Upload size={24} color="#94a3b8" />}
                  </div>
                  <div>
                    <label style={{ cursor: 'pointer' }}>
                      <span className="btn btn-sm">Upload Logo</span>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleLogo(e.target.files[0])} />
                    </label>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>PNG or JPG, recommended 200×200px</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 2: ACADEMIC STRUCTURE ─── */}
          {step === 2 && (
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Academic Structure</h2>
              <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Configure your forms, streams, and subjects.</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label className="field-label">Number of Forms</label>
                  <select className="select" value={forms} onChange={e => setForms(Number(e.target.value))}>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} Form{n>1?'s':''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Streams per Form</label>
                  <select className="select" value={streamsPerForm} onChange={e => setStreamsPerForm(Number(e.target.value))}>
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n} Stream{n>1?'s':''}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 24, fontSize: 13 }}>
                <strong>Generated Classes:</strong>{' '}{genClasses().join(', ')}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="field-label">Stream Names</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['A','B','C','D'].map((s, i) => (
                    <input key={i} className="input" style={{ width: 48, textAlign: 'center' }} value={streamNames[i] || ''} onChange={e => { const n = [...streamNames]; n[i] = e.target.value.toUpperCase(); setStreamNames(n); }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="field-label">Subjects ({subjects.length})</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {subjects.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#e8f0fe', color: '#0078D4', borderRadius: 16, padding: '4px 10px', fontSize: 12 }}>
                      {s.name}
                      <button onClick={() => setSubjects(ss => ss.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#64748b', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" placeholder="Add subject..." style={{ maxWidth: 220 }} value={newSubj} onChange={e => setNewSubj(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newSubj.trim()) { setSubjects(ss => [...ss, { name: newSubj.trim(), dept: 'Sciences' }]); setNewSubj(''); }}} />
                  <button className="btn btn-sm btn-primary" disabled={!newSubj.trim()} onClick={() => { setSubjects(ss => [...ss, { name: newSubj.trim(), dept: 'Sciences' }]); setNewSubj(''); }}>+ Add</button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 3: STAFF ─── */}
          {step === 3 && (
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Staff & Administration</h2>
              <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Enter the names of key staff. These will appear on reports and documents.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[['Principal / Head Teacher *', principal, setPrincipal, 'Dr. Jane Kamau'], ['Deputy Principal (Academics)', depAcademic, setDepAcademic, 'Mr. Peter Mwangi'], ['Deputy Principal (Administration)', depAdmin, setDepAdmin, 'Mrs. Lucy Wambui'], ['Finance Officer', financeOfficer, setFinanceOfficer, 'Mr. Daniel Kerubo'], ['Registrar', registrar, setRegistrar, 'Ms. Agnes Chebet']].map(([label, val, setter, placeholder]) => (
                  <div key={label}>
                    <label className="field-label">{label}</label>
                    <input className="input" placeholder={placeholder} value={val} onChange={e => setter(e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── STEP 4: TERMS ─── */}
          {step === 4 && (
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Academic Calendar</h2>
              <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Set your school's term dates for the academic year.</p>
              <div style={{ marginBottom: 16 }}>
                <label className="field-label">Current Term</label>
                <select className="select" style={{ maxWidth: 200 }} value={currentTerm} onChange={e => setCurrentTerm(e.target.value)}>
                  {terms.map(t => <option key={t.term}>{t.term}</option>)}
                </select>
              </div>
              {terms.map((t, i) => (
                <div key={t.term} style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>{t.term}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="field-label">Start Date</label>
                      <input type="date" className="input" value={t.start} onChange={e => setTerms(ts => ts.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} />
                    </div>
                    <div>
                      <label className="field-label">End Date</label>
                      <input type="date" className="input" value={t.end} onChange={e => setTerms(ts => ts.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── STEP 5: REVIEW & LAUNCH ─── */}
          {step === 5 && (
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Review & Launch</h2>
              <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Everything looks good! Review your settings and launch the portal.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="card card-pad" style={{ background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: '#0078D4' }}>School Identity</div>
                  <div style={{ fontSize: 13 }}><strong>{school.name || 'Unnamed School'}</strong> — {school.type}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{school.county} · {school.phone} · {school.email}</div>
                  {school.motto && <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>"{school.motto}"</div>}
                </div>

                <div className="card card-pad" style={{ background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: '#0078D4' }}>Academic Structure</div>
                  <div style={{ fontSize: 13 }}>{forms} forms · {streamsPerForm} stream{streamsPerForm > 1 ? 's' : ''} per form</div>
                  <div className="muted" style={{ fontSize: 12 }}>Classes: {genClasses().join(', ')}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{subjects.length} subjects: {subjects.map(s => s.name).join(', ')}</div>
                </div>

                <div className="card card-pad" style={{ background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: '#0078D4' }}>Key Staff</div>
                  <div style={{ fontSize: 13 }}>Principal: {principal || 'Not set'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Dep. Academics: {depAcademic || 'Not set'} · Dep. Admin: {depAdmin || 'Not set'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Finance: {financeOfficer || 'Not set'} · Registrar: {registrar || 'Not set'}</div>
                </div>

                <div className="card card-pad" style={{ background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: '#0078D4' }}>Terms</div>
                  {terms.map(t => (
                    <div key={t.term} style={{ fontSize: 13 }}>
                      <strong>{t.term}</strong>: {t.start} → {t.end} {t.term === currentTerm && <span style={{ color: '#107C10', fontSize: 11 }}>(Current)</span>}
                    </div>
                  ))}
                </div>

                <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: 14, fontSize: 13, color: '#065f46' }}>
                  <strong>You can always change these settings</strong> from the Settings panel after launching. You can also reset the setup wizard by clearing the app data.
                </div>
              </div>
            </div>
          )}

          {/* ─── NAVIGATION ─── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
            <button
              className="btn"
              style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
              onClick={() => setStep(s => s - 1)}
            >
              <ChevronLeft size={16} /> Back
            </button>

            <div className="muted" style={{ fontSize: 13 }}>Step {step} of {STEPS.length}</div>

            {step < STEPS.length ? (
              <button
                className="btn btn-primary"
                disabled={step === 1 && !school.name.trim()}
                onClick={() => setStep(s => s + 1)}
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button className="btn btn-primary" style={{ background: '#107C10', borderColor: '#107C10' }} onClick={handleLaunch}>
                <CheckCircle size={16} /> Launch School Portal
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          EduOne — Built for every school in Kenya and beyond
        </div>
      </div>
    </div>
  );
}
