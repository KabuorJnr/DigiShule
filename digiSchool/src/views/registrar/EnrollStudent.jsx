import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { UserPlus, FileText, Upload } from 'lucide-react';
import { fetchTable, upsertStudent } from '../../lib/api';
import { uploadStudentDocument } from '../../lib/fileStore';
import { generateSecurePassword, provisionAccount, generateSequentialUsername } from '../../utils/auth';
import { secondaryAuthClient, supabase } from '../../lib/supabaseClient';
import { getDynamicClasses, expandClassesWithStreams } from '../../data/seed';
import RegistrationLoadingModal from '../../components/RegistrationLoadingModal';

const EMPTY_FORM = {
  name: '', adm: '', class: '7A', gender: 'Male',
  dob: '', birthCertNo: '', guardianName: '', guardianPhone: '', guardianEmail: '',
  address: '', parentAddress: '', medicalNotes: '', previousSchool: '',
  admissionLetterFile: null, admissionLetterName: '',
};

export default function EnrollStudent() {
  const { store } = useOutletContext();
  const { notify } = store;
  const navigate = useNavigate();

  const parentCredsRef = useRef(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [provisionStep, setProvisionStep] = useState(null);
  const [pendingAdmissions, setPendingAdmissions] = useState([]);

  useEffect(() => {
    let active = true;
    fetchTable('admissions')
      .then(rows => {
        if (active) setPendingAdmissions(rows.filter(r => r.status === 'Pending' || r.status === 'Admitted'));
      })
      .catch(e => console.warn('Failed to load pending admissions', e));
    return () => { active = false; };
  }, []);

  const loadAdmission = (id) => {
    const adm = pendingAdmissions.find(a => a.id === id);
    if (!adm) return;
    setForm(f => ({
      ...f,
      name: adm.name || '',
      gender: adm.gender === 'M' ? 'Male' : adm.gender === 'F' ? 'Female' : (adm.gender || 'Other'),
      class: adm.form || adm.Grade || adm.grade || '7A',
      dob: adm.dob || '',
      guardianName: adm.parentName || adm.guardianName || '',
      guardianPhone: adm.parentPhone || adm.guardianPhone || '',
      guardianEmail: adm.parentEmail || adm.guardianEmail || '',
    }));
  };

  const dynamicClasses = useMemo(() => {
    const saved = expandClassesWithStreams(store.settings?.classes || []);
    return [...new Set(saved)];
  }, [store.settings]);

  const upForm = (patch) => setForm(f => ({ ...f, ...patch }));

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { notify('File must be under 10MB', 'warning'); return; }
    setForm(f => ({ ...f, admissionLetterFile: file, admissionLetterName: file.name }));
  };

  const handleEnroll = async () => {
    if (!form.name.trim() || !form.adm.trim()) { notify('Name and Admission No. are required', 'warning'); return; }
    if (form.adm.trim().length < 7) { notify('Admission No. must be at least 7 characters (e.g., 26/1234) for secure passwords.', 'warning'); return; }
    const { data: existing } = await supabase.from('students').select('id').eq('adm', form.adm).maybeSingle();
    if (existing) { notify(`Adm No. ${form.adm} already exists`, 'warning'); return; }
    setSaving(true);

    const captured = { ...form };

    try {
      let admissionLetterUrl = null;
      if (captured.admissionLetterFile) {
        notify('Uploading admission letter...', 'info');
        admissionLetterUrl = await uploadStudentDocument(`new_${Date.now()}`, captured.admissionLetterFile);
      }

      const newStudent = {
        id: `s${Date.now()}`,
        name: captured.name,
        adm: captured.adm,
        class: captured.class,
        gender: captured.gender,
        birthCertNo: captured.birthCertNo,
        flagged: false,
        scores: {},
        guardianName: captured.guardianName,
        guardianPhone: captured.guardianPhone,
        guardianEmail: captured.guardianEmail,
        parentAddress: captured.parentAddress,
        admissionLetterUrl,
      };

      await upsertStudent(newStudent);
      
      setProvisionStep('password');
      const studentPassword = captured.adm;
      const studentAuthEmail = `${captured.adm.toLowerCase().replace(/[^a-z0-9]/g, '')}@edu1app.tech`;
      
      const { error: studentSignUpError, data: studentAuthData } = await secondaryAuthClient.auth.signUp({
        email: studentAuthEmail,
        password: studentPassword,
        options: { data: { role: 'student', full_name: captured.name } }
      });
      
      if (studentSignUpError && !studentSignUpError.message.includes('already')) {
        throw new Error(`Student Auth Error: ${studentSignUpError.message}`);
      } else if (studentAuthData?.user) {
        const { error: profileErr } = await supabase.from('profiles').upsert({
          id: studentAuthData.user.id,
          username: captured.adm,
          full_name: captured.name,
          role: 'student',
          student_id: newStudent.id,
          school_id: store.schoolId || null
        });
        if (profileErr) throw new Error(`Student Profile Error: ${profileErr.message}`);
      }
      
      if (captured.guardianEmail) {
        const tempPassword = generateSecurePassword(10);
        const username = await generateSequentialUsername('PRN');
        
        let parentUserId = null;
        
        const { error: signUpError, data: authData } = await secondaryAuthClient.auth.signUp({
          email: captured.guardianEmail,
          password: tempPassword,
          options: { data: { role: 'parent', full_name: captured.guardianName || 'Parent/Guardian' } }
        });
        
        const isExisting = signUpError && signUpError.message.toLowerCase().includes('already');
        if (isExisting) {
          const { data: existingId, error: fetchErr } = await supabase.rpc('get_user_id_by_email', { p_email: captured.guardianEmail });
          if (fetchErr) throw new Error(`Could not fetch existing parent: ${fetchErr.message}`);
          parentUserId = existingId;
        } else if (signUpError) {
          throw new Error(`Parent Auth Error: ${signUpError.message}`);
        } else {
          parentUserId = authData?.user?.id;
        }

        if (parentUserId) {
          const { error: profileErr } = await supabase.from('profiles').insert({
            id: parentUserId,
            username,
            full_name: captured.guardianName || 'Parent / Guardian',
            role: 'parent',
            student_id: newStudent.id,
            school_id: store.schoolId || null
          });
          if (profileErr && profileErr.code !== '23505') throw new Error(`Parent Profile Error: ${profileErr.message}`);

          if (!isExisting) {
            parentCredsRef.current = { username, password: tempPassword };
          }

          setProvisionStep('email');
          await provisionAccount({
            email: captured.guardianEmail,
            username,
            password: tempPassword,
            name: captured.guardianName || 'Parent/Guardian',
            role: 'parent',
            schoolName: store.settings?.name || 'EduOne'
          });
        }

        setProvisionStep('done');
        setForm(EMPTY_FORM);
        setTimeout(() => {
          setProvisionStep(null);
          if (isExisting) {
            notify(`${captured.name} enrolled. Note: Parent email already registered.`, 'warning', 'Registrar');
          } else {
            notify(`${captured.name} enrolled. Parent portal account provisioned!`, 'success', 'Parent Registered');
          }
          navigate('..');
        }, 1500);
      } else {
        setForm(EMPTY_FORM);
        setProvisionStep('done');
        setTimeout(() => {
          setProvisionStep(null);
          notify(`${captured.name} enrolled successfully in ${captured.class}`, 'success', 'Registrar');
          navigate('..');
        }, 1500);
      }
      
    } catch (e) {
      notify(`Enrolment failed: ${e.message}`, 'error');
      setProvisionStep(null);
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="card card-pad" style={{ maxWidth: 680 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Enrol New Student</h3>
          {pendingAdmissions.length > 0 && (
            <select className="select" style={{ maxWidth: 200 }} onChange={e => loadAdmission(e.target.value)} defaultValue="">
              <option value="" disabled>Auto-fill from Admission...</option>
              {pendingAdmissions.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.form || a.Grade || a.grade || '7A'})</option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Full Name *</label>
              <input className="input" placeholder="e.g. Jane Akinyi Otieno" value={form.name} onChange={e => upForm({ name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Admission No. *</label>
              <input className="input" placeholder="e.g. ADM/2026/001" value={form.adm} onChange={e => upForm({ adm: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Class</label>
              <select className="select" value={form.class} onChange={e => upForm({ class: e.target.value })}>
                {dynamicClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Gender</label>
              <select className="select" value={form.gender} onChange={e => upForm({ gender: e.target.value })}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-2">
            <div>
              <label className="field-label">NEMIS UPI Number</label>
              <input className="input" placeholder="e.g. XXX-XXXX" value={form.nemisUpi} onChange={e => upForm({ nemisUpi: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Birth Certificate No.</label>
              <input className="input" placeholder="e.g. 1234567" value={form.birthCertNo} onChange={e => upForm({ birthCertNo: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-3">
            <div>
              <label className="field-label">Date of Birth</label>
              <input type="date" className="input" value={form.dob} onChange={e => upForm({ dob: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Nationality</label>
              <input className="input" placeholder="e.g. Kenyan" value={form.nationality} onChange={e => upForm({ nationality: e.target.value })} />
            </div>
            <div>
              <label className="field-label">County</label>
              <input className="input" placeholder="e.g. Nairobi" value={form.county} onChange={e => upForm({ county: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Previous School</label>
            <input className="input" placeholder="Previous institution (if any)" value={form.previousSchool} onChange={e => upForm({ previousSchool: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Admission Letter (optional PDF/Image)</label>
            <label style={{ display: 'block', cursor: saving ? 'not-allowed' : 'pointer' }}>
              <div style={{ border: `2px dashed ${form.admissionLetterName ? '#0078D4' : 'var(--border)'}`, borderRadius: 8, padding: 20, textAlign: 'center', background: form.admissionLetterName ? '#e8f0fe' : '#f8fafc', transition: 'all 0.2s' }}>
                {form.admissionLetterName ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <FileText size={18} color="#0078D4" />
                    <span style={{ fontWeight: 600, color: '#0078D4', fontSize: 14 }}>{form.admissionLetterName}</span>
                  </div>
                ) : (
                  <>
                    <Upload size={24} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: 600, color: '#475569', fontSize: 13 }}>Click to attach admission letter</div>
                  </>
                )}
              </div>
              <input type="file" accept="application/pdf, image/jpeg, image/png" style={{ display: 'none' }} disabled={saving} onChange={handleFileSelect} />
            </label>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>Guardian / Parent Information</div>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Guardian Name</label>
              <input className="input" value={form.guardianName} onChange={e => upForm({ guardianName: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Guardian Phone</label>
              <input className="input" placeholder="+254 7XX XXX XXX" value={form.guardianPhone} onChange={e => upForm({ guardianPhone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Guardian Email</label>
              <input className="input" type="email" value={form.guardianEmail} onChange={e => upForm({ guardianEmail: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Parent Address</label>
              <input className="input" placeholder="P.O. Box or Physical Address" value={form.parentAddress} onChange={e => upForm({ parentAddress: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Medical Notes (optional)</label>
            <textarea className="input" rows={2} placeholder="Any medical conditions or special needs…" value={form.medicalNotes} onChange={e => upForm({ medicalNotes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn" onClick={() => navigate('..')}>Cancel</button>
            <button className="btn btn-primary" disabled={saving} style={{ gap: 6 }} onClick={handleEnroll}>
              <UserPlus size={15} /> {saving ? 'Saving…' : 'Enrol Student'}
            </button>
          </div>
        </div>
      </div>
      
      {provisionStep && (
        <RegistrationLoadingModal 
          isOpen={true} 
          step={provisionStep}
          studentName={form.name} 
          parentCreds={parentCredsRef.current} 
        />
      )}
    </>
  );
}
