import { useState, useMemo, useEffect } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { fetchTable, upsertRow, fetchStudents } from '../lib/api';
import { Icon } from '../components/icons';

const OUTCOME_COLOR = { 'Returned to class': 'green', 'Sent home': 'amber', 'Referred to hospital': 'red' };

export default function Clinic({ store }) {
  const { notify } = store;
  const [students, setStudents] = useState([]);
  const [visits, setVisits] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({ student: '', adm: '', complaint: '', treatment: '', outcome: 'Returned to class' });
  const [notifyParentOpen, setNotifyParentOpen] = useState(null);
  const [parentMsg, setParentMsg] = useState('');

  useEffect(() => {
    let active = true;
    fetchTable('clinicVisits')
      .then((rows) => { if (active) setVisits(rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))); })
      .catch((e) => notify(`Failed to load clinic visits: ${e.message}`, 'error'));
      
    fetchStudents(0, 1000).then(res => {
      if (active) setStudents(res.data || []);
    }).catch(() => {});
    
    return () => { active = false; };
  }, [notify]);

  const totals = useMemo(() => ({
    total: visits.length,
    today: visits.filter((v) => v.date === '2026-06-09').length,
    referred: visits.filter((v) => v.outcome === 'Referred to hospital').length,
  }), [visits]);

  const logVisit = async () => {
    if (!form.student || !form.complaint) {
      notify('Student name and complaint are required.', 'error');
      return;
    }
    const visit = {
      id: `c${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      student: form.student,
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

  const handleStudentSelect = (e) => {
    const stId = e.target.value;
    const st = students.find(s => s.id === stId);
    if (st) {
      setForm(f => ({ ...f, student: st.name, adm: st.adm_no }));
    } else {
      setForm(f => ({ ...f, student: '', adm: '' }));
    }
  };

  const sendParentNotice = async () => {
    if (!parentMsg) return;
    try {
      const payload = {
        id: `notif_${Date.now()}`,
        title: `Clinic Update: ${notifyParentOpen.student}`,
        content: parentMsg,
        target_role: 'parent',
        date: new Date().toISOString().slice(0, 10),
      };
      await upsertRow('notifications', payload);
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
      <div className="no-print">
        <PageHeader
          title="Clinic & Health"
          subtitle="Student visits, treatments and referrals"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={handlePrint}>
                <Icon name="clipboard" size={16} /> Print Report
              </button>
              <button className="btn btn-primary" onClick={() => setLogOpen(true)}>+ Log Visit</button>
            </div>
          }
        />

        <div className="stat-tiles">
          <KpiCard iconComponent={<Icon name="clinic" size={24} />} label="Total Visits" value={totals.total} />
          <KpiCard iconComponent={<Icon name="calendar" size={24} />} label="Today" value={totals.today} accent="#0369A1" />
          <KpiCard iconComponent={<Icon name="warning" size={24} />} label="Referrals" value={totals.referred} accent="#EF4444" sub="To hospital" />
          <KpiCard iconComponent={<Icon name="check" size={24} />} label="Supplies Status" value="Adequate" accent="#10B981" />
        </div>
      </div>

      {/* Print-only Header */}
      <div className="print-only" style={{ marginBottom: 24, textAlign: 'center' }}>
        <h2>EduOne Clinic Report</h2>
        <p className="muted">Generated on {new Date().toLocaleDateString()}</p>
        <hr style={{ borderColor: 'var(--border-light)', margin: '16px 0' }} />
      </div>

      <div className="card card-pad">
        <div className="section-title">Visit Log</div>
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
            </tbody>
          </table>
        </div>
      </div>

      {logOpen && (
        <Modal title="Log Clinic Visit" onClose={() => setLogOpen(false)} footer={
          <><button className="btn" onClick={() => setLogOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={logVisit}>Save</button></>
        }>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Student Name</label>
              <select className="select" onChange={handleStudentSelect}>
                <option value="">Select a student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="field-label">Admission No.</label><input className="input" value={form.adm} disabled /></div>
          </div>
          <label className="field-label" style={{ marginTop: 12 }}>Complaint</label>
          <input className="input" value={form.complaint} onChange={(e) => setForm((f) => ({ ...f, complaint: e.target.value }))} />
          <label className="field-label" style={{ marginTop: 12 }}>Treatment</label>
          <input className="input" value={form.treatment} onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))} />
          <label className="field-label" style={{ marginTop: 12 }}>Outcome</label>
          <select className="select" value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}>
            <option>Returned to class</option><option>Sent home</option><option>Referred to hospital</option>
          </select>
        </Modal>
      )}

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
