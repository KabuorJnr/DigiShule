import { useState, useMemo } from 'react';
import { PageHeader, KpiCard, Badge } from '../components/widgets';
import Modal from '../components/Modal';
import { FACILITIES } from '../data/modules';

const STATUS_COLOR = { Operational: 'green', Maintenance: 'amber', 'Out of Service': 'red' };
const STATUS_CYCLE = ['Operational', 'Maintenance', 'Out of Service'];

export default function Facilities({ store }) {
  const { notify } = store;
  const [facilities, setFacilities] = useState(FACILITIES);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Room', capacity: '', note: '' });

  const totals = useMemo(() => ({
    total: facilities.length,
    operational: facilities.filter((f) => f.status === 'Operational').length,
    maintenance: facilities.filter((f) => f.status === 'Maintenance').length,
    cap: facilities.reduce((s, f) => s + (f.capacity || 0), 0),
  }), [facilities]);

  const cycleStatus = (id) => {
    setFacilities((fs) => fs.map((f) => {
      if (f.id !== id) return f;
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(f.status) + 1) % STATUS_CYCLE.length];
      return { ...f, status: next };
    }));
    notify('Facility status updated.', 'info', 'Facilities');
  };

  const addFacility = () => {
    if (!form.name) { notify('Name is required.', 'error'); return; }
    setFacilities((fs) => [
      ...fs,
      { id: `f${Date.now()}`, name: form.name, type: form.type, capacity: Number(form.capacity) || 0, status: 'Operational', note: form.note },
    ]);
    setAddOpen(false);
    setForm({ name: '', type: 'Room', capacity: '', note: '' });
    notify(`Facility "${form.name}" added.`);
  };

  return (
    <div>
      <PageHeader
        title="Facilities"
        subtitle="Campus buildings, rooms and amenities"
        actions={<button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Add Facility</button>}
      />

      <div className="stat-tiles">
        <KpiCard icon="🏛️" label="Total Facilities" value={totals.total} />
        <KpiCard icon="✅" label="Operational" value={totals.operational} accent="#10B981" />
        <KpiCard icon="🔧" label="Under Maintenance" value={totals.maintenance} accent="#F59E0B" />
        <KpiCard icon="🪑" label="Total Capacity" value={totals.cap} />
      </div>

      <div className="card card-pad">
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Facility</th><th>Type</th><th>Capacity</th><th>Status</th><th>Notes</th><th></th></tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>{f.name}</td>
                  <td>{f.type}</td>
                  <td>{f.capacity || '—'}</td>
                  <td><Badge color={STATUS_COLOR[f.status] || 'gray'}>{f.status}</Badge></td>
                  <td className="muted">{f.note || '—'}</td>
                  <td><button className="btn btn-sm" onClick={() => cycleStatus(f.id)}>Change Status</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <Modal title="Add Facility" onClose={() => setAddOpen(false)} footer={
          <><button className="btn" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={addFacility}>Save</button></>
        }>
          <label className="field-label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">Type</label>
              <select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option>Room</option><option>Hall</option><option>Laboratory</option><option>Dormitory</option><option>Outdoor</option>
              </select>
            </div>
            <div>
              <label className="field-label">Capacity</label>
              <input type="number" className="input" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          <label className="field-label" style={{ marginTop: 12 }}>Notes</label>
          <input className="input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </Modal>
      )}
    </div>
  );
}
