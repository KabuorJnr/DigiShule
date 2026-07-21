import { useState, useEffect, useMemo } from 'react';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow, updateRow, fetchTable } from '../../lib/api';
import { printReceipt } from '../../lib/printReceipt';
import { useOutletContext } from 'react-router-dom';
import { Search, Link2, AlertCircle, Printer } from 'lucide-react';

const PAGE_SIZE = 25;

export default function PaymentsTab() {
  const { store, payments, invoices, setPayments, params, students, user } = useOutletContext();
  const notify = store?.notify || (() => {});
  const addAuditLog = store?.addAuditLog || (() => {});
  const [modalOpen, setModalOpen] = useState(params.action === 'record_payment');
  const [form, setForm] = useState({ invoice_id: '', student_id: '', amount: '', method: 'M-Pesa', ref: '' });

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (params.action === 'record_payment') setModalOpen(true);
  }, [params.action]);

  // Invoices for selected student
  const studentInvoices = useMemo(() => {
    if (!form.student_id) return [];
    return invoices.filter(i => i.student_id === form.student_id && i.status !== 'Paid');
  }, [form.student_id, invoices]);

  // Reconciliation data: compute how much has been paid per invoice
  const invoicePaymentMap = useMemo(() => {
    const map = {};
    payments.forEach(p => {
      if (p.invoice_id) {
        map[p.invoice_id] = (map[p.invoice_id] || 0) + Number(p.amount);
      }
    });
    return map;
  }, [payments]);

  // Reconciliation status per payment
  const getReconStatus = (payment) => {
    if (!payment.invoice_id) return 'Unmatched';
    const inv = invoices.find(i => i.id === payment.invoice_id);
    if (!inv) return 'Unmatched';
    const totalPaid = invoicePaymentMap[payment.invoice_id] || 0;
    if (totalPaid >= Number(inv.amount)) return 'Matched';
    return 'Partial';
  };

  // Summary stats
  const unmatchedCount = payments.filter(p => !p.invoice_id).length;
  const partialInvoices = invoices.filter(i => {
    const paid = invoicePaymentMap[i.id] || 0;
    return paid > 0 && paid < Number(i.amount);
  }).length;

  // Filter payments
  const filtered = useMemo(() => {
    let list = [...payments];
    if (dateFrom) list = list.filter(p => (p.date || p.created_at?.slice(0, 10)) >= dateFrom);
    if (dateTo) list = list.filter(p => (p.date || p.created_at?.slice(0, 10)) <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => {
        const student = students.find(s => s.id === p.student_id);
        return (
          student?.name?.toLowerCase().includes(q) ||
          student?.adm_no?.toLowerCase().includes(q) ||
          p.ref?.toLowerCase().includes(q) ||
          p.method?.toLowerCase().includes(q)
        );
      });
    }
    return list.sort((a, b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));
  }, [payments, dateFrom, dateTo, search, students]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /** Re-fetch payments from DB and update parent state */
  const refreshPayments = async () => {
    try {
      const fresh = await fetchTable('financePayments');
      setPayments(fresh || []);
    } catch (e) {
      console.warn('Could not refresh payments:', e.message);
    }
  };

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
      ref: form.ref || '-',
      date: new Date().toISOString().slice(0,10),
      created_at: new Date().toISOString()
    };
    try {
      await upsertRow('financePayments', payment);
      await refreshPayments();
      notify(`Payment of ${fmtKES(form.amount)} recorded successfully.`);
      addAuditLog('Payment Recorded', `${form.method} payment for student ${students.find(s => s.id === form.student_id)?.name || form.student_id}`, form.amount);
      setModalOpen(false);
      setForm({ invoice_id: '', student_id: '', amount: '', method: 'M-Pesa', ref: '' });
    } catch (e) {
      // Fallback: add locally if DB write fails
      setPayments(prev => [payment, ...prev]);
      notify(`Payment saved locally. Sync may be needed: ${e.message}`, 'warning');
      setModalOpen(false);
      setForm({ invoice_id: '', student_id: '', amount: '', method: 'M-Pesa', ref: '' });
    }
  };

  const handleConfirm = async (id, isBursarApprove = false) => {
    try {
      const payment = payments.find(p => p.id === id);
      if (!payment) return;

      let newStatus = 'Verified';
      if (!isBursarApprove && payment.amount >= 100000 && payment.status !== 'Pending Bursar Approval') {
        newStatus = 'Pending Bursar Approval';
      }

      await updateRow('financePayments', id, { status: newStatus });
      await refreshPayments();
      
      if (newStatus === 'Pending Bursar Approval') {
        notify('Payment requires Bursar approval due to high value.', 'warning');
        addAuditLog('Bursar Approval Requested', `Requested approval for payment ${payment.ref}`, payment.amount);
      } else {
        notify('Payment verified successfully.');
        addAuditLog('Payment Verified', `Verified payment ${payment.ref} of ${fmtKES(payment.amount)}`, payment.amount);

        // Trigger receipt + SMS/Email notification to parent
        try {
          const { supabase } = await import('../../lib/supabaseClient');
          await supabase.functions.invoke('send-receipt', {
            body: {
              payment_id: payment.id,
              receipt_number: payment.ref,
              amount: payment.amount,
              phone_number: null, // Will be looked up from parent profile
              student_id: payment.student_id,
              invoice_id: payment.invoice_id || null,
              school_id: store?.schoolId || null,
              date: payment.date || payment.created_at
            }
          });
        } catch (receiptErr) {
          console.warn('Receipt notification failed (non-fatal):', receiptErr);
        }
      }
    } catch (e) {
      notify(`Failed to verify payment: ${e.message}`, 'error');
    }
  };

  const reconColor = { Matched: 'green', Partial: 'amber', Unmatched: 'gray' };

  return (
    <div>
      {/* Reconciliation Summary */}
      {(unmatchedCount > 0 || partialInvoices > 0) && (
        <div style={{ padding: '12px 20px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 8, marginBottom: 16, display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link2 size={18} style={{ color: '#047857' }} />
          <span style={{ fontSize: 13 }}>
            <strong>{unmatchedCount}</strong> payment{unmatchedCount !== 1 ? 's' : ''} unmatched to invoices
            {partialInvoices > 0 && <> · <strong>{partialInvoices}</strong> invoice{partialInvoices !== 1 ? 's' : ''} partially paid</>}
          </span>
        </div>
      )}

      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Payments</div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Record Payment</button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" placeholder="Search by student, ref, method..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: 36 }} />
            </div>
          </div>
          <input type="date" className="input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} style={{ width: 140 }} title="From date" />
          <input type="date" className="input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} style={{ width: 140 }} title="To date" />
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Student</th><th>Method</th><th>Ref</th><th>Reconciliation</th><th>Status</th><th>Action</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {pageData.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>No payments match your filters.</td></tr>}
              {pageData.map(p => {
                const student = students.find(s => s.id === p.student_id);
                const recon = getReconStatus(p);
                return (
                  <tr key={p.id}>
                    <td>{p.date}</td>
                    <td style={{ fontWeight: 600 }}>{student ? student.name : p.student_id}</td>
                    <td><Badge color={p.method === 'M-Pesa' ? 'green' : p.method === 'Bank' ? 'blue' : 'gray'}>{p.method}</Badge></td>
                    <td className="muted">{p.ref}</td>
                    <td>
                      <Badge color={reconColor[recon]}>{recon}</Badge>
                    </td>
                    <td>
                      <Badge color={p.status === 'Verification Pending' || p.status === 'Pending' ? 'yellow' : 'green'}>
                        {p.status || 'Verified'}
                      </Badge>
                    </td>
                    <td>
                      {p.status === 'Pending Bursar Approval' ? (
                        ['finance', 'principal'].includes(user?.role) ? (
                          <button className="btn btn-sm" style={{ background: '#047857', color: 'white', borderColor: '#047857' }} onClick={() => handleConfirm(p.id, true)}>Bursar Approve</button>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>Pending Approval</span>
                        )
                      ) : (p.status === 'Verification Pending' || p.status === 'Pending') ? (
                        <button className="btn btn-sm btn-primary" onClick={() => handleConfirm(p.id)}>
                          {p.amount >= 100000 ? 'Req. Approval' : 'Confirm'}
                        </button>
                      ) : (
                        <button className="btn btn-sm" onClick={() => printReceipt(p, student, store.settings)}>
                          <Printer size={16} />
                          <span>Receipt</span>
                        </button>
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>{fmtKES(p.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>â† Previous</button>
            <span className="muted" style={{ fontSize: 13 }}>Page {page + 1} of {totalPages}</span>
            <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
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
              <select className="select" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value, invoice_id: '' }))}>
                <option value="">-- Select Student --</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.adm_no})</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Link to Invoice (optional)</label>
              <select className="select" value={form.invoice_id} onChange={e => setForm(f => ({ ...f, invoice_id: e.target.value }))}>
                <option value="">- No invoice (unmatched) -</option>
                {studentInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.id} - {fmtKES(inv.amount)} (due {inv.due_date})
                  </option>
                ))}
              </select>
              {form.student_id && studentInvoices.length === 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>No pending invoices for this student.</div>
              )}
            </div>
          </div>
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="field-label">Amount (KES)</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Method</label>
              <select className="select" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                <option>M-Pesa</option><option>Bank</option><option>Cheque</option><option>Cash</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="field-label">Reference</label>
            <input className="input" value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}



