import { useState, useEffect } from 'react';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow, updateRow } from '../../lib/api';
import { useOutletContext } from 'react-router-dom';

export default function PaymentsTab() {
  const { payments, invoices, setPayments, notify, params, students } = useOutletContext();
  const [modalOpen, setModalOpen] = useState(params.action === 'record_payment');
  const [form, setForm] = useState({ invoice_id: '', student_id: '', amount: '', method: 'M-Pesa', ref: '' });

  useEffect(() => {
    if (params.action === 'record_payment') setModalOpen(true);
  }, [params.action]);

  const handleRecord = async () => {
    if (!form.student_id || !form.amount) {
      notify('Student and amount are required.', 'error');
      return;
    }
    const payment = {
      id: `pay_${Date.now()}`,
      invoice_id: form.invoice_id || null,
      student_id: form.student_id,
      amount: Number(form.amount),
      method: form.method,
      ref: form.ref || '—',
      date: new Date().toISOString().slice(0,10),
      created_at: new Date().toISOString()
    };
    setPayments(prev => [payment, ...prev]);
    notify(`Payment of ${fmtKES(form.amount)} recorded successfully.`);
    setModalOpen(false);
    setForm({ invoice_id: '', student_id: '', amount: '', method: 'M-Pesa', ref: '' });
    try {
      await upsertRow('financePayments', payment);
    } catch (e) {
      console.warn('API error ignored for mock:', e.message);
    }
  };

  const handleConfirm = async (id) => {
    try {
      const payment = payments.find(p => p.id === id);
      if (!payment) return;
      const updated = { ...payment, status: 'Verified' };
      setPayments(prev => prev.map(p => p.id === id ? updated : p));
      notify('Payment confirmed.');
      await updateRow('financePayments', id, { status: 'Verified' });
    } catch (e) {
      notify(`Failed to confirm payment: ${e.message}`, 'error');
    }
  };

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title">Payments</div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Record Payment</button>
      </div>

      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Student</th><th>Method</th><th>Ref</th><th>Status</th><th>Action</th><th>Amount</th></tr>
          </thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>No payments recorded.</td></tr>}
            {payments.map(p => {
              const student = students.find(s => s.id === p.student_id);
              return (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td style={{ fontWeight: 600 }}>{student ? student.name : p.student_id}</td>
                  <td><Badge color={p.method === 'M-Pesa' ? 'green' : p.method === 'Bank' ? 'blue' : 'gray'}>{p.method}</Badge></td>
                  <td className="muted">{p.ref}</td>
                  <td>
                    <Badge color={p.status === 'Verification Pending' || p.status === 'Pending' ? 'yellow' : 'green'}>
                      {p.status || 'Verified'}
                    </Badge>
                  </td>
                  <td>
                    {(p.status === 'Verification Pending' || p.status === 'Pending') && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleConfirm(p.id)}>Confirm</button>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>{fmtKES(p.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title="Record Payment" onClose={() => setModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleRecord}>Save Payment</button>
          </>
        }>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Student</label>
              <select className="select" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                <option value="">-- Select Student --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.adm_no})</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Amount (KES)</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">Method</label>
              <select className="select" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                <option>M-Pesa</option><option>Bank</option><option>Cheque</option><option>Cash</option>
              </select>
            </div>
            <div>
              <label className="field-label">Reference</label>
              <input className="input" value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
