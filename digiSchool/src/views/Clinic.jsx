import { useState, useMemo, useEffect } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { fetchTable, upsertRow, fetchStudents } from '../lib/api';
import { Icon } from '../components/icons';
import PrintHeader from '../components/PrintHeader';

const OUTCOME_COLOR = { 'Returned to class': 'green', 'Sent home': 'amber', 'Referred to hospital': 'red' };

export default function Clinic({ store }) {
  const { notify } = store;
  const [students, setStudents] = useState([]);
  const [visits, setVisits] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({ student: '', adm: '', complaint: '', treatment: '', outcome: 'Returned to class' });
  const [notifyParentOpen, setNotifyParentOpen] = useState(null);
  const [parentMsg, setParentMsg] = useState('');
  const [activeTab, setActiveTab] = useState('directory');
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    let active = true;
    fetchTable('clinicVisits')
      .then((rows) => { if (active) setVisits(rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))); })
      .catch((e) => notify(`Failed to load clinic visits: ${e.message}`, 'error'));
      
    fetchStudents(0, 1000).then(res => {
      if (active) {
        const sorted = (res.data || []).sort((a, b) => a.name.localeCompare(b.name));
        setStudents(sorted);
        // Set default class if not set
        const classes = [...new Set(sorted.map(s => s.class || 'Unassigned'))].sort();
        if (classes.length > 0) setSelectedClass(classes[0]);
      }
    }).catch(() => {});
    
    return () => { active = false; };
  }, [notify]);

  const totals = useMemo(() => ({
    total: visits.length,
    today: visits.filter((v) => v.date === new Date().toISOString().slice(0, 10)).length,
    referred: visits.filter((v) => v.outcome === 'Referred to hospital').length,
  }), [visits]);

  const groupedStudents = useMemo(() => {
    const groups = {};
    students.forEach(s => {
      const c = s.class || 'Unassigned';
      if (!groups[c]) groups[c] = [];
      groups[c].push(s);
    });
    return groups;
  }, [students]);

  const openLogForStudent = (st) => {
    setForm({ student: st.name, adm: st.adm, student_id: st.id, medicalInfo: st.medicalInfo, complaint: '', treatment: '', outcome: 'Returned to class' });
    setLogOpen(true);
  };

  const logVisit = async () => {
    if (!form.student || !form.complaint) {
      notify('Student name and complaint are required.', 'error');
      return;
    }
    const visit = {
      id: `c${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      student: form.student,
      student_id: form.student_id,
      adm: form.adm || '—',
      complaint: form.complaint,
      treatment: form.treatment,
      outcome: form.outcome,
    };
    try {
      await upsertRow('clinicVisits', visit);
    } catch (e) {
      notify(`Could not log visit: ${e.message}`, 'error');
      return;
    }
    setVisits((vs) => [visit, ...vs]);
    setLogOpen(false);
    setForm({ student: '', adm: '', complaint: '', treatment: '', outcome: 'Returned to class' });
    notify(`Clinic visit logged for ${form.student}.`);
  };

  const sendParentNotice = async () => {
    if (!parentMsg) return;
    try {
      const payload = {
        id: `msg_${Date.now()}`,
        sender_role: 'nurse',
        sender_name: 'School Clinic',
        recipient_role: 'parent',
        student_id: notifyParentOpen.student_id,
        subject: `Clinic Update: ${notifyParentOpen.student}`,
        body: parentMsg,
        status: 'Unread',
        created_at: new Date().toISOString(),
      };
      await upsertRow('messages', payload);
      notify('Message sent to parent successfully.');
      setNotifyParentOpen(null);
      setParentMsg('');
    } catch (e) {
      notify(`Failed to send message: ${e.message}`, 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print-friendly">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden; }
          .print-friendly, .print-friendly * { visibility: visible; }
          .print-friendly { position: absolute; left: 0; top: 0; width: 100%; padding: 2cm !important; box-sizing: border-box; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .sidebar, .topbar { display: none !important; }
          .layout { display: block !important; padding: 0 !important; }
          .main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}} />
      <div className="no-print">
        <PageHeader
          title="Clinic & Health"
          subtitle="Student visits, treatments and medical directory"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={handlePrint}>
                <Icon name="clipboard" size={16} /> Print Report
              </button>
            </div>
          }
        />

        <div className="stat-tiles">
          <KpiCard iconComponent={<Icon name="clinic" size={24} />} label="Total Visits" value={totals.total} />
          <KpiCard iconComponent={<Icon name="calendar" size={24} />} label="Today" value={totals.today} accent="#0369A1" />
          <KpiCard iconComponent={<Icon name="warning" size={24} />} label="Referrals" value={totals.referred} accent="#EF4444" sub="To hospital" />
          <KpiCard iconComponent={<Icon name="check" size={24} />} label="Supplies Status" value="Adequate" accent="#10B981" />
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
          <button className={`tab ${activeTab === 'directory' ? 'active' : ''}`} onClick={() => setActiveTab('directory')}>
            <Icon name="users" size={16} style={{ marginRight: 6 }} /> Student Directory
          </button>
          <button className={`tab ${activeTab === 'visits' ? 'active' : ''}`} onClick={() => setActiveTab('visits')}>
            <Icon name="activity" size={16} style={{ marginRight: 6 }} /> Recent Visits
          </button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="print-only" style={{ marginBottom: 24 }}>
        <PrintHeader settings={store.settings} />
        <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #000', paddingBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#000', textTransform: 'uppercase' }}>Clinic & Health Report</h2>
          <div style={{ fontSize: 13, marginTop: 4 }}>Generated on {new Date().toLocaleDateString()}</div>
        </div>
      </div>

      {activeTab === 'directory' && (
        <div className="grid no-print" style={{ gridTemplateColumns: '220px 1fr', gap: 20 }}>
          <div className="card" style={{ padding: '8px 0', height: 'fit-content' }}>
            <h3 style={{ margin: '8px 16px', fontSize: 14, color: '#64748b' }}>Select Class</h3>
            {Object.keys(groupedStudents).sort().map(cls => (
              <button 
                key={cls} 
                className="btn" 
                style={{ 
                  display: 'flex', width: '100%', justifyContent: 'space-between', 
                  borderRadius: 0, border: 'none', 
                  background: selectedClass === cls ? '#e0f2fe' : 'transparent',
                  color: selectedClass === cls ? '#0369a1' : 'inherit'
                }}
                onClick={() => setSelectedClass(cls)}
              >
                <span>{cls}</span>
                <span className="muted" style={{ fontSize: 12 }}>{groupedStudents[cls].length}</span>
              </button>
            ))}
          </div>

          <div className="card card-pad fade-in">
            <h3 className="section-title">{selectedClass} — Medical Directory</h3>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Admission No.</th>
                    <th>Medical Information / Conditions</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedStudents[selectedClass]?.map(st => (
                    <tr key={st.id} style={{ cursor: 'pointer' }} onClick={() => openLogForStudent(st)} className="hoverable-row">
                      <td style={{ fontWeight: 600 }}>{st.name}</td>
                      <td className="muted">{st.adm}</td>
                      <td>
                        {st.medicalInfo ? (
                          <div style={{ color: '#991b1b', fontSize: 13, background: '#fef2f2', padding: '6px 10px', borderRadius: 6, display: 'inline-block' }}>
                            {st.medicalInfo}
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: 13 }}>None provided</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); openLogForStudent(st); }}>+ Log Visit</button>
                      </td>
                    </tr>
                  ))}
                  {!groupedStudents[selectedClass]?.length && (
                    <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>No students in this class.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'visits' && (
        <div className="card card-pad fade-in">
          <div className="section-title">Recent Visit Logs</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Student</th><th>Adm. No.</th><th>Complaint</th><th>Treatment</th><th>Outcome</th><th className="no-print">Action</th></tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td>{v.date}</td>
                    <td style={{ fontWeight: 600 }}>{v.student}</td>
                    <td className="muted">{v.adm}</td>
                    <td>{v.complaint}</td>
                    <td>{v.treatment}</td>
                    <td><Badge color={OUTCOME_COLOR[v.outcome] || 'gray'}>{v.outcome}</Badge></td>
                    <td className="no-print">
                      <button className="btn btn-sm" onClick={() => {
                        setNotifyParentOpen(v);
                        setParentMsg(`Dear Parent,\nYour child ${v.student} visited the clinic today for ${v.complaint}. Outcome: ${v.outcome}.\nPlease follow up if necessary.`);
                      }}>Notify Parent</button>
                    </td>
                  </tr>
                ))}
                {visits.length === 0 && (
                  <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 20 }}>No clinic visits logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Visit Modal */}
      {logOpen && (
        <Modal title="Log Clinic Visit" onClose={() => setLogOpen(false)} footer={
          <><button className="btn" onClick={() => setLogOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={logVisit}>Save Visit</button></>
        }>
          {form.medicalInfo ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ color: '#991b1b', fontWeight: 600, fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                <Icon name="warning" size={14} style={{ marginRight: 6 }} /> Known Medical Conditions / Allergies
              </div>
              <div style={{ color: '#7f1d1d', fontSize: 14 }}>{form.medicalInfo}</div>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ color: '#64748b', fontSize: 13 }}>No medical conditions recorded for this student.</div>
            </div>
          )}

          <div className="grid grid-2">
            <div>
              <label className="field-label">Student Name</label>
              <input className="input" value={form.student} disabled />
            </div>
            <div>
              <label className="field-label">Admission No.</label>
              <input className="input" value={form.adm} disabled />
            </div>
          </div>
          <label className="field-label" style={{ marginTop: 12 }}>Complaint / Symptoms</label>
          <input className="input" value={form.complaint} onChange={(e) => setForm((f) => ({ ...f, complaint: e.target.value }))} autoFocus />
          <label className="field-label" style={{ marginTop: 12 }}>Treatment / Action Taken</label>
          <input className="input" value={form.treatment} onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))} />
          <label className="field-label" style={{ marginTop: 12 }}>Outcome</label>
          <select className="select" value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}>
            <option>Returned to class</option><option>Sent home</option><option>Referred to hospital</option>
          </select>
        </Modal>
      )}

      {/* Notify Parent Modal */}
      {notifyParentOpen && (
        <Modal title={`Message Parent of ${notifyParentOpen.student}`} onClose={() => setNotifyParentOpen(null)} footer={
          <><button className="btn" onClick={() => setNotifyParentOpen(null)}>Cancel</button><button className="btn btn-primary" onClick={sendParentNotice}>Send Message</button></>
        }>
          <label className="field-label">Message Content</label>
          <textarea 
            className="input" 
            rows={5} 
            value={parentMsg} 
            onChange={(e) => setParentMsg(e.target.value)} 
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>This message will appear in the Parent Portal immediately.</div>
        </Modal>
      )}
    </div>
  );
}
