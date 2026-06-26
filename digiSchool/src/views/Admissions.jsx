import { useState, useMemo, useEffect } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { getDynamicClasses } from '../data/seed';
import { fetchTable, upsertRow, upsertStudent } from '../lib/api';
import { generateSecurePassword, provisionAccount, generateSequentialUsername } from '../utils/auth';
import { secondaryAuthClient, supabase } from '../lib/supabaseClient';
import { ClipboardList, CheckCircle2, Clock, GraduationCap } from 'lucide-react';

const STATUS_COLOR = { Admitted: 'green', Pending: 'amber', Waitlisted: 'blue', Rejected: 'red' };
const STATUS_CYCLE = ['Pending', 'Admitted', 'Waitlisted', 'Rejected'];

export default function Admissions({ store }) {
  const { notify, students, setStudents } = store;
  const [apps, setApps] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewStudent, setViewStudent] = useState(null);
  const dynamicClasses = useMemo(() => {
    const saved = (store.settings?.classes || []).map(c => c.name);
    const dynamic = getDynamicClasses(students);
    return [...new Set([...saved, ...dynamic])];
  }, [students, store.settings]);
  const [form, setForm] = useState({
    name: '', kcpe: '', gender: 'M', Grade: '7A',
    dob: '', parentName: '', parentPhone: '', parentEmail: '', boardingStatus: 'Day',
  });

  useEffect(() => {
    fetchTable('admissions')
      .then(rows => setApps(rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))))
      .catch(e => notify(`Failed to load admissions: ${e.message}`, 'error'));
  }, [notify]);

  const totals = useMemo(() => ({
    applicants: apps.length,
    admitted: apps.filter(a => a.status === 'Admitted').length,
    pending: apps.filter(a => a.status === 'Pending').length,
    enrolled: students.length,
  }), [apps, students]);

  const cycleStatus = async (id) => {
    const app = apps.find(a => a.id === id);
    if (!app) return;
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(app.status) + 1) % STATUS_CYCLE.length];
    const updated = { ...app, status: next };
    try { await upsertRow('admissions', updated); } catch (e) { notify(`Could not update status: ${e.message}`, 'error'); return; }
    setApps(as => as.map(a => a.id === id ? updated : a));

    // Auto-enroll into students table when admitted
    if (next === 'Admitted') {
      const newStudent = {
        id: `s_${app.id}`,
        name: app.name,
        adm: `ADM/${new Date().getFullYear()}/${String(Date.now()).slice(-4)}`,
        class: app.Grade || app.form || app.grade || '7A',
        gender: app.gender === 'M' ? 'Male' : app.gender === 'F' ? 'Female' : app.gender,
        scores: {},
        flagged: false,
        guardianName: app.parentName || '',
        guardianPhone: app.parentPhone || '',
        guardianEmail: app.parentEmail || '',
      };
      try {
        await upsertStudent(newStudent);
        setStudents(prev => [...prev, newStudent]);
        
        // ── 1. Create Student Portal Account ──
        const studentPassword = newStudent.adm;
        const studentAuthEmail = `${newStudent.adm.toLowerCase().replace(/[^a-z0-9]/g, '')}@edu1app.tech`;
        
        const { error: studentSignUpError, data: studentAuthData } = await secondaryAuthClient.auth.signUp({
          email: studentAuthEmail,
          password: studentPassword,
          options: { data: { role: 'student' } }
        });
        
        if (studentSignUpError && !studentSignUpError.message.includes('already')) {
          console.warn('Student Auth provision warning:', studentSignUpError.message);
        } else if (studentAuthData?.user) {
          await supabase.from('profiles').upsert({
            id: studentAuthData.user.id,
            username: newStudent.adm,
            full_name: newStudent.name,
            role: 'student',
            student_id: newStudent.id
          });
        }
        
        // ── 2. Create Parent Portal Account (If email provided) ──
        if (newStudent.guardianEmail) {
          const tempPassword = generateSecurePassword(10);
          const username = await generateSequentialUsername('PRN');
          
          const { error: signUpError, data: authData } = await secondaryAuthClient.auth.signUp({
            email: newStudent.guardianEmail,
            password: tempPassword,
            options: { data: { role: 'parent' } }
          });
          
          if (signUpError && !signUpError.message.includes('already')) {
            console.warn('Parent Auth provision warning:', signUpError.message);
          }

          if (authData?.user) {
            await supabase.from('profiles').upsert({
              id: authData.user.id,
              username,
              full_name: newStudent.guardianName || 'Parent / Guardian',
              role: 'parent',
              student_id: newStudent.id
            });

            // Send provisioning email
            provisionAccount({
              email: newStudent.guardianEmail,
              username,
              password: tempPassword,
              name: newStudent.guardianName || 'Parent / Guardian',
              role: 'parent'
            }).catch(e => console.warn('Email dispatch failed:', e.message));
          }
        }
        
        notify(`${app.name} admitted and enrolled in Grade ${app.Grade || app.form || app.grade || '7A'}`, 'success', 'Admissions');
      } catch (e) {
        notify(`Admitted but failed to enroll: ${e.message}`, 'warning');
      }
    } else {
      notify(`Status changed to ${next}`, 'info', 'Admissions');
    }
  };

  const addApplicant = async () => {
    if (!form.name || !form.kcpe) { notify('Name and KCPE marks are required.', 'error'); return; }
    const applicant = {
      id: `ad${Date.now()}`, name: form.name, kcpe: Number(form.kcpe), gender: form.gender,
      form: form.Grade, date: new Date().toISOString().slice(0, 10), status: 'Pending',
      dob: form.dob, parentName: form.parentName, parentPhone: form.parentPhone, parentEmail: form.parentEmail,
      boardingStatus: form.boardingStatus,
    };
    try { await upsertRow('admissions', applicant); } catch (e) { notify(`Could not add application: ${e.message}`, 'error'); return; }
    setApps(as => [applicant, ...as]);
    setAddOpen(false);
    setForm({ name: '', kcpe: '', gender: 'M', Grade: '7A', dob: '', parentName: '', parentPhone: '', parentEmail: '', boardingStatus: 'Day' });
    notify(`Application for ${form.name} added.`);
  };

  const roll = dynamicClasses.map(c => ({ cls: `Grade ${c}`, count: students.filter(s => s.class === c).length }));

  const filteredApps = apps.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <PageHeader
        title="Admissions & Registry"
        subtitle="Student registration, applications, and class rolls"
        actions={<button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Register New Student</button>}
      />

      <div className="stat-tiles">
        <KpiCard iconComponent={<ClipboardList size={20} />} label="Applications" value={totals.applicants} />
        <KpiCard iconComponent={<CheckCircle2 size={20} />} label="Admitted" value={totals.admitted} accent="#107C10" />
        <KpiCard iconComponent={<Clock size={20} />} label="Pending Review" value={totals.pending} accent="#FFB900" />
        <KpiCard iconComponent={<GraduationCap size={20} />} label="Enrolled Students" value={totals.enrolled} sub="Across all forms" />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18, alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <input className="input" placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
            <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 140 }}>
              <option value="All">All Status</option>
              {STATUS_CYCLE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>KCPE</th><th>Gender</th><th>Grade</th><th>Date</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {filteredApps.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, cursor: 'pointer', color: '#0078D4' }} onClick={() => setViewStudent(a)}>{a.name}</td>
                    <td>{a.kcpe}</td>
                    <td>{a.gender}</td>
                    <td>{a.Grade || a.form || a.grade}</td>
                    <td className="muted">{a.date}</td>
                    <td><Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge></td>
                    <td><button className="btn btn-sm" onClick={() => cycleStatus(a.id)}>Change</button></td>
                  </tr>
                ))}
                {filteredApps.length === 0 && (
                  <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>No results found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">Class Roll (live)</div>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Class</th><th>Students</th><th>Capacity</th><th>Fill Rate</th></tr></thead>
              <tbody>
                {roll.map(r => (
                  <tr key={r.cls}>
                    <td style={{ fontWeight: 600 }}>{r.cls}</td>
                    <td>{r.count}</td>
                    <td className="muted">40</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60 }}><div className="progress"><span style={{ width: `${(r.count / 40) * 100}%`, background: r.count >= 40 ? '#D13438' : '#107C10' }} /></div></div>
                        <span className="muted" style={{ fontSize: 11 }}>{Math.round((r.count / 40) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      {addOpen && (
        <Modal title="Register New Student" onClose={() => setAddOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={addApplicant}>Register</button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">KCPE Marks *</label>
                <input type="number" className="input" value={form.kcpe} onChange={e => setForm(f => ({ ...f, kcpe: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Date of Birth</label>
                <input type="date" className="input" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-3">
              <div>
                <label className="field-label">Gender</label>
                <select className="select" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                  <option value="M">Male</option><option value="F">Female</option>
                </select>
              </div>
              <div>
                <label className="field-label">Grade</label>
                <input className="input" list="admissions-classes" placeholder="e.g. 7A" value={form.Grade} onChange={e => setForm(f => ({ ...f, Grade: e.target.value }))} />
                <datalist id="admissions-classes">
                  {dynamicClasses.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="field-label">Boarding Status</label>
                <select className="select" value={form.boardingStatus} onChange={e => setForm(f => ({ ...f, boardingStatus: e.target.value }))}>
                  <option>Day</option><option>Boarding</option>
                </select>
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Parent/Guardian Name</label>
                <input className="input" placeholder="Parent full name" value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Parent Phone</label>
                <input className="input" placeholder="07XX XXX XXX" value={form.parentPhone} onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="field-label">Parent Email (Optional)</label>
              <input type="email" className="input" placeholder="For parent portal access" value={form.parentEmail} onChange={e => setForm(f => ({ ...f, parentEmail: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}

      {/* Student Profile Modal */}
      {viewStudent && (
        <Modal title="Student Profile" onClose={() => setViewStudent(null)} footer={
          <button className="btn btn-primary" onClick={() => setViewStudent(null)}>Close</button>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><span className="field-label">Name</span><div style={{ fontWeight: 600, fontSize: 16 }}>{viewStudent.name}</div></div>
            <div className="grid grid-2">
              <div><span className="field-label">KCPE</span><div>{viewStudent.kcpe}</div></div>
              <div><span className="field-label">Gender</span><div>{viewStudent.gender}</div></div>
            </div>
            <div className="grid grid-2">
              <div><span className="field-label">Grade</span><div>{viewStudent.Grade || viewStudent.form || viewStudent.grade}</div></div>
              <div><span className="field-label">Application Date</span><div>{viewStudent.date}</div></div>
            </div>
            {viewStudent.dob && <div><span className="field-label">Date of Birth</span><div>{viewStudent.dob}</div></div>}
            {viewStudent.parentName && <div><span className="field-label">Parent/Guardian</span><div>{viewStudent.parentName}</div></div>}
            <div className="grid grid-2">
              {viewStudent.parentPhone && <div><span className="field-label">Parent Phone</span><div>{viewStudent.parentPhone}</div></div>}
              {viewStudent.parentEmail && <div><span className="field-label">Parent Email</span><div>{viewStudent.parentEmail}</div></div>}
            </div>
            {viewStudent.boardingStatus && <div><span className="field-label">Boarding Status</span><div><Badge color="blue">{viewStudent.boardingStatus}</Badge></div></div>}
            <div><span className="field-label">Status</span><div><Badge color={STATUS_COLOR[viewStudent.status]}>{viewStudent.status}</Badge></div></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
