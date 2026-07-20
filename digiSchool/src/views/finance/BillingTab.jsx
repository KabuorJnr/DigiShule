import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { expandClassesWithStreams } from '../../data/seed';
import { Search } from 'lucide-react';

const PAGE_SIZE = 25;

export default function BillingTab() {
  const { invoices, setInvoices, params, students, store } = useOutletContext();
  const notify = store?.notify || (() => {});
  const addAuditLog = store?.addAuditLog || (() => {});
  const [modalOpen, setModalOpen] = useState(params.action === 'generate_invoice');
  const [form, setForm] = useState({ student_id: '', amount: '', due_date: '', type: 'Term Fee' });
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ target_class: 'All', amount: '', due_date: '', type: 'Term Fee' });

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  const classes = useMemo(() => {
    const saved = expandClassesWithStreams(store?.settings?.classes || []);
    const cls = new Set([...saved, ...students.map(s => s.class)]);
    return Array.from(cls).filter(Boolean).sort();
  }, [students, store?.settings]);

  useEffect(() => {
    if (params.action === 'generate_invoice') setModalOpen(true);
  }, [params.action]);

  // Filtered & sorted invoices
  const displayInvoices = useMemo(() => {
    let list = [...invoices].sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (params.filter === 'overdue') {
      const today = new Date().toISOString().slice(0, 10);
      list = list.filter(i => i.status === 'Pending' && i.due_date < today);
    }
    if (statusFilter !== 'All') list = list.filter(i => i.status === statusFilter);
    if (dateFrom) list = list.filter(i => (i.due_date || i.created_at?.slice(0, 10)) >= dateFrom);
    if (dateTo) list = list.filter(i => (i.due_date || i.created_at?.slice(0, 10)) <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => {
        const student = students.find(s => s.id === i.student_id);
        return (
          student?.name?.toLowerCase().includes(q) ||
          student?.adm_no?.toLowerCase().includes(q) ||
          i.id?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [invoices, params.filter, statusFilter, dateFrom, dateTo, search, students]);

  const totalPages = Math.max(1, Math.ceil(displayInvoices.length / PAGE_SIZE));
  const pageData = displayInvoices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
    const newNotif = {
      id: `notif_inv_${Date.now()}`,
      title: 'New Invoice Issued',
      message: `A new invoice of KES ${form.amount} has been issued and is due on ${form.due_date}`,
      body: `A new invoice of KES ${form.amount} has been issued and is due on ${form.due_date}`,
      posted_by: 'Finance Department',
      role: 'Billing',
      audience: [form.student_id],
      read: false,
      created_at: new Date().toISOString()
    };

    setInvoices(prev => [newInvoice, ...prev]);
    if (store.setNotifications) {
      store.setNotifications(prev => [newNotif, ...(prev || [])]);
    }
    notify('Invoice generated successfully.');
    addAuditLog('Invoice Generated', `Invoice for ${students.find(s => s.id === form.student_id)?.name || form.student_id}`, form.amount);
    setModalOpen(false);
    setForm({ student_id: '', amount: '', due_date: '', type: 'Term Fee' });
    try {
      const { upsertRow } = await import('../../lib/api');
      await upsertRow('invoices', newInvoice);
      await upsertRow('notifications', newNotif);
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
    const newNotifs = targetStudents.map((s, idx) => ({
      id: `notif_inv_${Date.now()}_${idx}`,
      title: 'New Invoice Issued',
      message: `A new invoice of KES ${bulkForm.amount} has been issued and is due on ${bulkForm.due_date}`,
      body: `A new invoice of KES ${bulkForm.amount} has been issued and is due on ${bulkForm.due_date}`,
      posted_by: 'Finance Department',
      role: 'Billing',
      audience: [s.id],
      read: false,
      created_at: new Date().toISOString()
    }));

    setInvoices(prev => [...newInvoices, ...prev]);
    if (store.setNotifications) {
      store.setNotifications(prev => [...newNotifs, ...(prev || [])]);
    }
    notify(`Bulk Invoices generated for ${newInvoices.length} students.`, 'success');
    addAuditLog('Bulk Invoices', `Generated ${newInvoices.length} invoices for ${bulkForm.target_class === 'All' ? 'all classes' : bulkForm.target_class}`, Number(bulkForm.amount) * newInvoices.length);
    setBulkModalOpen(false);
    setBulkForm({ target_class: 'All', amount: '', due_date: '', type: 'Term Fee' });

    try {
      const { upsertRow } = await import('../../lib/api');
      await Promise.all(newInvoices.map(inv => upsertRow('invoices', inv)));
      await Promise.all(newNotifs.map(n => upsertRow('notifications', n)));
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" placeholder="Search by student, adm no, invoice ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: 36 }} />
          </div>
        </div>
        <select className="select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} style={{ minWidth: 120 }}>
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
        </select>
        <input type="date" className="input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} style={{ width: 140 }} title="From date" />
        <input type="date" className="input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} style={{ width: 140 }} title="To date" />
      </div>
      
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr><th>Invoice ID</th><th>Student</th><th>Amount</th><th>Due Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            {pageData.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>No invoices match your filters.</td></tr>}
            {pageData.map(i => {
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>â† Previous</button>
          <span className="muted" style={{ fontSize: 13 }}>Page {page + 1} of {totalPages} ({displayInvoices.length} total)</span>
          <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next â†’</button>
        </div>
      )}

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



