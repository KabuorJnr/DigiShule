import { useState, useMemo } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { CLINIC_VISITS } from '../data/modules';

const OUTCOME_COLOR = { 'Returned to class': 'green', 'Sent home': 'amber', 'Referred to hospital': 'red' };

export default function Clinic({ store }) {
  const { notify } = store;
  const [visits, setVisits] = useState(CLINIC_VISITS);
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState({ student: '', adm: '', complaint: '', treatment: '', outcome: 'Returned to class' });

  const totals = useMemo(() => ({
    total: visits.length,
    today: visits.filter((v) => v.date === '2026-06-09').length,
    referred: visits.filter((v) => v.outcome === 'Referred to hospital').length,
  }), [visits]);

  const logVisit = () => {
    if (!form.student || !form.complaint) {
      notify('Student name and complaint are required.', 'error');
      return;
    }
    setVisits((vs) => [{
      id: `c${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      student: form.student,
      adm: form.adm || '—',
      complaint: form.complaint,
      treatment: form.treatment,
      outcome: form.outcome,
    }, ...vs]);
    setLogOpen(false);
    setForm({ student: '', adm: '', complaint: '', treatment: '', outcome: 'Returned to class' });
    notify(`Clinic visit logged for ${form.student}.`);
  };

  return (
    <div>
      <PageHeader
        title="Clinic"
        subtitle="Student visits, treatments and referrals"
        actions={<button className="btn btn-primary" onClick={() => setLogOpen(true)}>+ Log Visit</button>}
      />

      <div className="stat-tiles">
        <KpiCard icon="🏥" label="Total Visits" value={totals.total} />
        <KpiCard icon="📅" label="Today" value={totals.today} accent="#0369A1" />
        <KpiCard icon="🚑" label="Referrals" value={totals.referred} accent="#EF4444" sub="To hospital" />
        <KpiCard icon="💊" label="Supplies Status" value="Adequate" accent="#10B981" />
      </div>

      <div className="card card-pad">
        <div className="section-title">Visit Log</div>
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Student</th><th>Adm. No.</th><th>Complaint</th><th>Treatment</th><th>Outcome</th></tr>
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
            <div><label className="field-label">Student Name</label><input className="input" value={form.student} onChange={(e) => setForm((f) => ({ ...f, student: e.target.value }))} /></div>
            <div><label className="field-label">Admission No.</label><input className="input" value={form.adm} onChange={(e) => setForm((f) => ({ ...f, adm: e.target.value }))} /></div>
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
    </div>
  );
}
