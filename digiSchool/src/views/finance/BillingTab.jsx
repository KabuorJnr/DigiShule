import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { expandClassesWithStreams } from '../../data/seed';

export default function BillingTab() {
  const { invoices, setInvoices, notify, params, students, store } = useOutletContext();
  const [modalOpen, setModalOpen] = useState(params.action === 'generate_invoice');
  const [form, setForm] = useState({ student_id: '', amount: '', due_date: '', type: 'Term Fee' });
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ target_class: 'All', amount: '', due_date: '', type: 'Term Fee' });

  const classes = useMemo(() => {
    const saved = expandClassesWithStreams(store?.settings?.classes || []);
    const cls = new Set([...saved, ...students.map(s => s.class)]);
    return Array.from(cls).filter(Boolean).sort();
  }, [students, store?.settings]);

  useEffect(() => {
    if (params.action === 'generate_invoice') setModalOpen(true);
  }, [params.action]);

  const displayInvoices = useMemo(() => {
    let list = [...invoices].sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (params.filter === 'overdue') {
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter(i => i.status === 'Pending' && i.due_date < today);
    }
    return list;
  }, [invoices, params.filter]);

  const handleGenerate = async () => {
    if (!form.student_id || !form.amount || !form.due_date) {
      notify('Please fill all required fields.', 'error');
      return;
    }
    const newInvoice = {
      id: `inv_${Date.now()}`,
      student_id: form.student_id,
      amount: Number(form.amount),
      status: 'Pending',
      due_date: form.due_date,
      created_at: new Date().toISOString()
    };
    
    setInvoices(prev => [newInvoice, ...prev]);
    notify('Invoice generated successfully.');
    setModalOpen(false);
    setForm({ student_id: '', amount: '', due_date: '', type: 'Term Fee' });
    try {
      const { upsertRow } = await import('../../lib/api');
      await upsertRow('invoices', newInvoice);
    } catch (e) {
      console.warn('API error ignored for mock:', e.message);
    }
  };

  const handleBulkGenerate = async () => {
    if (!bulkForm.amount || !bulkForm.due_date) {
      notify('Please fill all required fields.', 'error');
      return;
    }
    
    const targetStudents = students.filter(s => 
      (bulkForm.target_class === 'All' || s.class === bulkForm.target_class) && 
      s.status !== 'Inactive' && s.status !== 'Graduated'
    );

    if (targetStudents.length === 0) {
      notify('No active students found in the selected target.', 'warning');
      return;
    }

    const newInvoices = targetStudents.map((s, idx) => ({
      id: `inv_${Date.now()}_${idx}`,
      student_id: s.id,
      amount: Number(bulkForm.amount),
      status: 'Pending',
      due_date: bulkForm.due_date,
      created_at: new Date().toISOString()
    }));

    setInvoices(prev => [...newInvoices, ...prev]);
    notify(`Bulk Invoices generated for ${newInvoices.length} students.`, 'success');
    setBulkModalOpen(false);
    setBulkForm({ target_class: 'All', amount: '', due_date: '', type: 'Term Fee' });

    try {
      const { upsertRow } = await import('../../lib/api');
      await Promise.all(newInvoices.map(inv => upsertRow('invoices', inv)));
    } catch (e) {
      console.warn('API error ignored for mock bulk:', e.message);
    }
  };

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title">Invoices</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setBulkModalOpen(true)}>Bulk Invoicing</button>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Generate Invoice</button>
        </div>
      </div>
      
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr><th>Invoice ID</th><th>Student</th><th>Amount</th><th>Due Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            {displayInvoices.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>No invoices found.</td></tr>}
            {displayInvoices.map(i => {
              const student = students.find(s => s.id === i.student_id);
              return (
                <tr key={i.id}>
                  <td className="muted">{i.id}</td>
                  <td style={{ fontWeight: 600 }}>{student ? student.name : i.student_id}</td>
                  <td>{fmtKES(i.amount)}</td>
                  <td>{i.due_date}</td>
                  <td>
                    <Badge color={i.status === 'Paid' ? 'green' : i.status === 'Overdue' ? 'red' : 'amber'}>{i.status}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title="Generate Invoice" onClose={() => setModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleGenerate}>Save Invoice</button>
          </>
        }>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Student</label>
              <select className="select" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                <option value="">-- Select Student --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.adm_no || s.adm})</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Amount (KES)</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">Due Date</label>
              <input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Type</label>
              <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option>Term Fee</option>
                <option>Transport</option>
                <option>Uniform</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {bulkModalOpen && (
        <Modal title="Bulk Invoice Generation" onClose={() => setBulkModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setBulkModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleBulkGenerate}>Generate Invoices</button>
          </>
        }>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Target Audience</label>
              <select className="select" value={bulkForm.target_class} onChange={e => setBulkForm(f => ({ ...f, target_class: e.target.value }))}>
                <option value="All">All Active Students</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Amount (KES) per Student</label>
              <input type="number" className="input" value={bulkForm.amount} onChange={e => setBulkForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">Due Date</label>
              <input type="date" className="input" value={bulkForm.due_date} onChange={e => setBulkForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Type</label>
              <select className="select" value={bulkForm.type} onChange={e => setBulkForm(f => ({ ...f, type: e.target.value }))}>
                <option>Term Fee</option>
                <option>Transport</option>
                <option>Uniform</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
