import { useState, useMemo } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { ADMISSIONS } from '../data/modules';
import { CLASSES } from '../data/seed';

const STATUS_COLOR = { Admitted: 'green', Pending: 'amber', Waitlisted: 'blue', Rejected: 'red' };
const STATUS_CYCLE = ['Pending', 'Admitted', 'Waitlisted', 'Rejected'];

export default function Admissions({ store }) {
  const { notify, students } = store;
  const [apps, setApps] = useState(ADMISSIONS);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', kcpe: '', gender: 'M', form: 'Form 1' });

  const totals = useMemo(() => ({
    applicants: apps.length,
    admitted: apps.filter((a) => a.status === 'Admitted').length,
    pending: apps.filter((a) => a.status === 'Pending').length,
    enrolled: students.length,
  }), [apps, students]);

  const cycleStatus = (id) => {
    setApps((as) => as.map((a) => {
      if (a.id !== id) return a;
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(a.status) + 1) % STATUS_CYCLE.length];
      return { ...a, status: next };
    }));
  };

  const addApplicant = () => {
    if (!form.name || !form.kcpe) {
      notify('Name and KCPE marks are required.', 'error');
      return;
    }
    setApps((as) => [
      { id: `ad${Date.now()}`, name: form.name, kcpe: Number(form.kcpe), gender: form.gender, form: form.form, date: new Date().toISOString().slice(0, 10), status: 'Pending' },
      ...as,
    ]);
    setAddOpen(false);
    setForm({ name: '', kcpe: '', gender: 'M', form: 'Form 1' });
    notify(`Application for ${form.name} added.`);
  };

  // class roll counts from the live student registry
  const roll = CLASSES.map((c) => ({ cls: `Form ${c}`, count: students.filter((s) => s.class === c).length }));

  return (
    <div>
      <PageHeader
        title="Admissions & Registry"
        subtitle="Applications, enrolment and class rolls"
        actions={<button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ New Application</button>}
      />

      <div className="stat-tiles">
        <KpiCard icon="🧾" label="Applications" value={totals.applicants} />
        <KpiCard icon="✅" label="Admitted" value={totals.admitted} accent="#10B981" />
        <KpiCard icon="⏳" label="Pending Review" value={totals.pending} accent="#F59E0B" />
        <KpiCard icon="🎓" label="Enrolled Students" value={totals.enrolled} sub="Across all forms" />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18, alignItems: 'start' }}>
        <div className="card card-pad" style={{ gridColumn: 'span 1' }}>
          <div className="section-title">Applications</div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>KCPE</th><th>Gender</th><th>Form</th><th>Date</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td>{a.kcpe}</td>
                    <td>{a.gender}</td>
                    <td>{a.form}</td>
                    <td className="muted">{a.date}</td>
                    <td><Badge color={STATUS_COLOR[a.status]}>{a.status}</Badge></td>
                    <td><button className="btn btn-sm" onClick={() => cycleStatus(a.id)}>Change Status</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-title">Class Roll (live)</div>
          <div className="scroll-x">
            <table className="table">
              <thead><tr><th>Class</th><th>Students</th><th>Capacity</th></tr></thead>
              <tbody>
                {roll.map((r) => (
                  <tr key={r.cls}>
                    <td style={{ fontWeight: 600 }}>{r.cls}</td>
                    <td>{r.count}</td>
                    <td className="muted">40</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {addOpen && (
        <Modal title="New Application" onClose={() => setAddOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={addApplicant}>Add</button>
          </>
        }>
          <label className="field-label">Applicant Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-3" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">KCPE Marks</label>
              <input type="number" className="input" value={form.kcpe} onChange={(e) => setForm((f) => ({ ...f, kcpe: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Gender</label>
              <select className="select" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                <option value="M">M</option><option value="F">F</option>
              </select>
            </div>
            <div>
              <label className="field-label">Form</label>
              <select className="select" value={form.form} onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))}>
                <option>Form 1</option><option>Form 2 (Transfer)</option><option>Form 3 (Transfer)</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
