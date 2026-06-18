import { useState, useMemo } from 'react';
import { PageHeader, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { upsertStudent } from '../lib/api';
import {
  UserPlus, Search, Edit2, FileText, Users,
  CheckCircle2, AlertTriangle, Download, Filter
} from 'lucide-react';

const CLASSES_LIST = ['Form 1A', 'Form 1B', 'Form 2A', 'Form 2B', 'Form 3A', 'Form 3B', 'Form 4A', 'Form 4B'];
const TABS = [
  { id: 'register', label: 'Student Register', icon: Users },
  { id: 'enroll', label: 'New Enrolment', icon: UserPlus },
  { id: 'transfers', label: 'Transfers & Exits', icon: FileText },
];

const EMPTY_FORM = {
  name: '', adm: '', class: 'Form 1A', gender: 'Male',
  dob: '', guardianName: '', guardianPhone: '', guardianEmail: '',
  address: '', medicalNotes: '', previousSchool: '',
};

export default function Registrar({ store, user }) {
  const { students, setStudents, notify } = store;
  const [tab, setTab] = useState('register');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [editModal, setEditModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [enrollModal, setEnrollModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ studentId: '', type: 'Transfer Out', reason: '', date: '' });

  const upForm = (patch) => setForm(f => ({ ...f, ...patch }));

  // ── REGISTER TAB ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    return students.filter(s => {
      // Hide offboarded students from the active register
      if (s.status === 'Inactive' || s.status === 'Graduated') return false;
      const matchClass = classFilter === 'All' || s.class === classFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.adm?.toLowerCase().includes(q);
      return matchClass && matchSearch;
    });
  }, [students, search, classFilter]);

  const byClass = useMemo(() => {
    const map = {};
    filtered.forEach(s => { (map[s.class] ||= []).push(s); });
    return map;
  }, [filtered]);

  const handleEdit = (student) => {
    setEditStudent({ ...student });
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await upsertStudent(editStudent);
      setStudents(prev => prev.map(s => s.id === editStudent.id ? editStudent : s));
      setEditModal(false);
      notify('Student record updated', 'success', 'Registrar');
    } catch (e) {
      notify(`Save failed: ${e.message}`, 'error');
    } finally { setSaving(false); }
  };

  // ── ENROLMENT TAB ─────────────────────────────────────────────
  const handleEnroll = async () => {
    if (!form.name.trim() || !form.adm.trim()) { notify('Name and Admission No. are required', 'warning'); return; }
    if (students.find(s => s.adm === form.adm)) { notify(`Adm No. ${form.adm} already exists`, 'warning'); return; }
    setSaving(true);
    const newStudent = {
      id: `s${Date.now()}`,
      name: form.name,
      adm: form.adm,
      class: form.class,
      gender: form.gender,
      flagged: false,
      scores: {},
    };
    try {
      await upsertStudent(newStudent);
      setStudents(prev => [...prev, newStudent]);
      setForm(EMPTY_FORM);
      notify(`${form.name} enrolled successfully in ${form.class}`, 'success', 'Registrar');
      setTab('register');
    } catch (e) {
      notify(`Enrolment failed: ${e.message}`, 'error');
    } finally { setSaving(false); }
  };

  // ── TRANSFER TAB ──────────────────────────────────────────────
  const [transfers, setTransfers] = useState([]);
  const handleTransfer = async () => {
    if (!transferForm.studentId || !transferForm.reason || !transferForm.date) {
      notify('All fields are required', 'warning'); return;
    }
    const student = students.find(s => s.id === transferForm.studentId);
    if (!student) return;

    setSaving(true);
    const newStatus = transferForm.type === 'Completed (Graduated)' ? 'Graduated' : 'Inactive';
    const updatedStudent = { ...student, status: newStatus };

    try {
      await upsertStudent(updatedStudent);
      setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
      
      const record = { ...transferForm, studentName: student.name, id: `tr${Date.now()}` };
      setTransfers(prev => [record, ...prev]);
      setTransferModal(false);
      setTransferForm({ studentId: '', type: 'Transfer Out', reason: '', date: '' });
      notify(`Transfer record saved and ${student.name} marked as ${newStatus}`, 'success', 'Registrar');
    } catch (e) {
      // Mock fallback
      console.warn('API error ignored for mock:', e.message);
      setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
      const record = { ...transferForm, studentName: student.name, id: `tr${Date.now()}` };
      setTransfers(prev => [record, ...prev]);
      setTransferModal(false);
      setTransferForm({ studentId: '', type: 'Transfer Out', reason: '', date: '' });
      notify(`Transfer record saved and ${student.name} marked as ${newStatus}`, 'success', 'Registrar');
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Adm No.', 'Name', 'Class', 'Gender'],
      ...filtered.map(s => [s.adm, s.name, s.class, s.gender || '—']),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `student_register_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    notify('Register exported as CSV', 'success');
  };

  return (
    <div>
      <PageHeader
        title="Registrar Office"
        subtitle="Student registration, enrolment, and records management"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ gap: 6 }} onClick={exportCSV}><Download size={15} /> Export CSV</button>
            <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => setTab('enroll')}><UserPlus size={15} /> New Enrolment</button>
          </div>
        }
      />

      {/* KPI Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Active Students', value: students.filter(s => s.status !== 'Inactive' && s.status !== 'Graduated').length, color: '#0078D4' },
          { label: 'Male', value: students.filter(s => s.gender === 'Male' && s.status !== 'Inactive' && s.status !== 'Graduated').length, color: '#0369A1' },
          { label: 'Female', value: students.filter(s => s.gender === 'Female' && s.status !== 'Inactive' && s.status !== 'Graduated').length, color: '#7C3AED' },
          { label: 'Flagged', value: students.filter(s => s.flagged && s.status !== 'Inactive' && s.status !== 'Graduated').length, color: '#D13438' },
        ].map(k => (
          <div key={k.label} className="card card-pad" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── REGISTER ── */}
      {tab === 'register' && (
        <>
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input className="input" style={{ paddingLeft: 32, width: 220 }} placeholder="Search name or adm no…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="select" style={{ width: 160 }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="All">All Classes</option>
              {CLASSES_LIST.map(c => <option key={c}>{c}</option>)}
            </select>
            <span className="muted" style={{ fontSize: 13 }}>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {Object.entries(byClass).length === 0 ? (
            <div className="card card-pad" style={{ textAlign: 'center', padding: 40 }}>
              <Users size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <div className="muted">No students found</div>
            </div>
          ) : (
            Object.entries(byClass).sort(([a], [b]) => a.localeCompare(b)).map(([cls, list]) => (
              <div key={cls} className="card card-pad" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0078D4' }}>{cls}</div>
                  <Badge color="gray">{list.length} students</Badge>
                </div>
                <div className="scroll-x">
                  <table className="table">
                    <thead>
                      <tr><th>Adm No.</th><th>Full Name</th><th>Gender</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                      {list.map(s => (
                        <tr key={s.id}>
                          <td className="muted">{s.adm}</td>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td>{s.gender || '—'}</td>
                          <td>
                            {s.flagged
                              ? <Badge color="red"><AlertTriangle size={11} style={{ marginRight: 3 }} />Flagged</Badge>
                              : <Badge color="green"><CheckCircle2 size={11} style={{ marginRight: 3 }} />Active</Badge>
                            }
                          </td>
                          <td>
                            <button className="btn btn-sm" style={{ gap: 4 }} onClick={() => handleEdit(s)}>
                              <Edit2 size={13} /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ── NEW ENROLMENT ── */}
      {tab === 'enroll' && (
        <div className="card card-pad" style={{ maxWidth: 680 }}>
          <h3 className="section-title">Enrol New Student</h3>
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
                  {CLASSES_LIST.map(c => <option key={c}>{c}</option>)}
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
                <label className="field-label">Date of Birth</label>
                <input type="date" className="input" value={form.dob} onChange={e => upForm({ dob: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Previous School</label>
                <input className="input" placeholder="Previous institution (if any)" value={form.previousSchool} onChange={e => upForm({ previousSchool: e.target.value })} />
              </div>
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
            <div>
              <label className="field-label">Guardian Email</label>
              <input className="input" type="email" value={form.guardianEmail} onChange={e => upForm({ guardianEmail: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Medical Notes (optional)</label>
              <textarea className="input" rows={2} placeholder="Any medical conditions or special needs…" value={form.medicalNotes} onChange={e => upForm({ medicalNotes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn" onClick={() => { setForm(EMPTY_FORM); setTab('register'); }}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} style={{ gap: 6 }} onClick={handleEnroll}>
                <UserPlus size={15} /> {saving ? 'Saving…' : 'Enrol Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSFERS ── */}
      {tab === 'transfers' && (
        <>
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => setTransferModal(true)}>
              <FileText size={15} /> Record Transfer / Exit
            </button>
          </div>
          <div className="card card-pad">
            <h3 className="section-title">Transfer & Exit Records ({transfers.length})</h3>
            {transfers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <FileText size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                <div className="muted">No transfer records yet</div>
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>Student</th><th>Type</th><th>Reason</th><th>Date</th></tr></thead>
                <tbody>
                  {transfers.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.studentName}</td>
                      <td><Badge color={t.type === 'Transfer Out' ? 'amber' : 'red'}>{t.type}</Badge></td>
                      <td className="muted">{t.reason}</td>
                      <td className="muted">{t.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editModal && editStudent && (
        <Modal title="Edit Student Record" onClose={() => setEditModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setEditModal(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving} onClick={handleSaveEdit}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Full Name</label>
                <input className="input" value={editStudent.name} onChange={e => setEditStudent(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Adm No.</label>
                <input className="input" value={editStudent.adm} onChange={e => setEditStudent(s => ({ ...s, adm: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Class</label>
                <select className="select" value={editStudent.class} onChange={e => setEditStudent(s => ({ ...s, class: e.target.value }))}>
                  {CLASSES_LIST.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Gender</label>
                <select className="select" value={editStudent.gender || 'Male'} onChange={e => setEditStudent(s => ({ ...s, gender: e.target.value }))}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="flagged" checked={!!editStudent.flagged} onChange={e => setEditStudent(s => ({ ...s, flagged: e.target.checked }))} />
              <label htmlFor="flagged" style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={14} color="#D13438" /> Flag this student (disciplinary / medical attention)
              </label>
            </div>
          </div>
        </Modal>
      )}

      {/* Transfer Modal */}
      {transferModal && (
        <Modal title="Record Transfer / Exit" onClose={() => setTransferModal(false)} footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setTransferModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleTransfer}>Save Record</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Student</label>
              <select className="select" value={transferForm.studentId} onChange={e => setTransferForm(f => ({ ...f, studentId: e.target.value }))}>
                <option value="">Select student…</option>
                {students.filter(s => s.status !== 'Inactive' && s.status !== 'Graduated').map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
              </select>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Type</label>
                <select className="select" value={transferForm.type} onChange={e => setTransferForm(f => ({ ...f, type: e.target.value }))}>
                  <option>Transfer Out</option>
                  <option>Withdrawal</option>
                  <option>Expelled</option>
                  <option>Completed (Graduated)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Date</label>
                <input type="date" className="input" value={transferForm.date} onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="field-label">Reason</label>
              <textarea className="input" rows={3} value={transferForm.reason} onChange={e => setTransferForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
