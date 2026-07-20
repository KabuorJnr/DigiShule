import { useState, useEffect, useMemo } from 'react';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow, updateRow } from '../../lib/api';
import { useOutletContext } from 'react-router-dom';
import { Search, CheckCircle, XCircle } from 'lucide-react';

const PAGE_SIZE = 25;

export default function ExpensesTab() {
  const { expenses, setExpenses, user, params, store } = useOutletContext();
  const notify = store?.notify || (() => {});
  const addAuditLog = store?.addAuditLog || (() => {});
  const [modalOpen, setModalOpen] = useState(params.action === 'record_expense');
  const [catModalOpen, setCatModalOpen] = useState(params.action === 'categories');
  const [rejectModalOpen, setRejectModalOpen] = useState(null); // holds expense id
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({ category: '', amount: '', description: '' });

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  const isApprover = ['principal', 'admin', 'deputy_admin'].includes(user?.role);

  const defaultCategories = ['Office Supplies', 'Maintenance', 'Utilities', 'Staff Welfare', 'Other'];
  const categories = (store.settings.expenseCategories && store.settings.expenseCategories.length > 0) 
    ? store.settings.expenseCategories 
    : defaultCategories;

  useEffect(() => {
    if (!form.category && categories.length > 0) {
      setForm(f => ({ ...f, category: categories[0] }));
    }
  }, [categories, form.category]);

  useEffect(() => {
    if (params.action === 'record_expense') setModalOpen(true);
    if (params.action === 'categories') setCatModalOpen(true);
  }, [params.action]);

  // Filtered expenses
  const filtered = useMemo(() => {
    let list = [...expenses];
    if (statusFilter !== 'All') list = list.filter(e => e.status === statusFilter);
    if (dateFrom) list = list.filter(e => (e.date || e.created_at?.slice(0, 10)) >= dateFrom);
    if (dateTo) list = list.filter(e => (e.date || e.created_at?.slice(0, 10)) <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.category?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.requested_by?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));
  }, [expenses, statusFilter, dateFrom, dateTo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleRecord = async () => {
    if (!form.amount || !form.description || !form.category) {
      notify('Category, amount and description are required.', 'error');
      return;
    }
    const expense = {
      id: `exp_${Date.now()}`,
      category: form.category,
      amount: Number(form.amount),
      description: form.description,
      status: 'Pending',
      requested_by: user?.name || 'User',
      date: new Date().toISOString().slice(0,10),
      created_at: new Date().toISOString()
    };
    setExpenses(prev => [expense, ...prev]);
    notify(`Expense of ${fmtKES(form.amount)} submitted for approval.`);
    addAuditLog('Expense Submitted', `${form.category}: ${form.description}`, form.amount);
    setModalOpen(false);
    setForm({ category: categories[0] || '', amount: '', description: '' });
    try {
      await upsertRow('expenses', expense);
    } catch (e) {
      console.warn('API error ignored for mock:', e.message);
    }
  };

  const handleApprove = async (expenseId) => {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const updated = expenses.map(e =>
      e.id === expenseId
        ? { ...e, status: 'Approved', approved_by: user?.name || 'Admin', approved_at: new Date().toISOString() }
        : e
    );
    setExpenses(updated);
    notify(`Expense "${expense.description}" approved.`, 'success');
    addAuditLog('Expense Approved', `${expense.category}: ${expense.description} (by ${user?.name})`, expense.amount);

    try {
      await updateRow('expenses', expenseId, {
        status: 'Approved',
        approved_by: user?.name || 'Admin',
        approved_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('API error:', e.message);
    }
  };

  const handleReject = async () => {
    const expenseId = rejectModalOpen;
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    const updated = expenses.map(e =>
      e.id === expenseId
        ? { ...e, status: 'Rejected', rejected_by: user?.name || 'Admin', rejected_at: new Date().toISOString(), rejection_reason: rejectReason }
        : e
    );
    setExpenses(updated);
    notify(`Expense "${expense.description}" rejected.`, 'info');
    addAuditLog('Expense Rejected', `${expense.category}: ${expense.description} - Reason: ${rejectReason}`, expense.amount);
    setRejectModalOpen(null);
    setRejectReason('');

    try {
      await updateRow('expenses', expenseId, {
        status: 'Rejected',
        rejected_by: user?.name || 'Admin',
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectReason
      });
    } catch (e) {
      console.warn('API error:', e.message);
    }
  };

  const handleAddCategory = () => {
    const newCat = prompt('Enter new expense category:');
    if (newCat && !categories.includes(newCat)) {
      const newCategories = [...categories, newCat];
      store.setSettings({ ...store.settings, expenseCategories: newCategories });
      notify('Category added successfully.', 'success');
    }
  };

  const handleDeleteCategory = (catToRemove) => {
    if (confirm(`Remove category "${catToRemove}"?`)) {
      const newCategories = categories.filter(c => c !== catToRemove);
      store.setSettings({ ...store.settings, expenseCategories: newCategories });
      if (form.category === catToRemove) setForm(f => ({ ...f, category: newCategories[0] || '' }));
      notify('Category removed.', 'info');
    }
  };

  // Summary stats
  const pendingCount = expenses.filter(e => e.status === 'Pending').length;
  const pendingTotal = expenses.filter(e => e.status === 'Pending').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      {/* Pending approval banner */}
      {isApprover && pendingCount > 0 && (
        <div style={{ padding: '12px 20px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14 }}>
            <strong>{pendingCount}</strong> expense{pendingCount !== 1 ? 's' : ''} awaiting your approval totalling <strong>{fmtKES(pendingTotal)}</strong>
          </span>
          <button className="btn btn-sm" onClick={() => { setStatusFilter('Pending'); setPage(0); }}>Show Pending Only</button>
        </div>
      )}

      <div className="card card-pad">
        {/* Header with search/filter bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Expense Management</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setCatModalOpen(true)}>Manage Categories</button>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Record Expense</button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" placeholder="Search expenses..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: 36 }} />
            </div>
          </div>
          <select className="select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }} style={{ minWidth: 120 }}>
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <input type="date" className="input" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} style={{ width: 140 }} title="From date" />
          <input type="date" className="input" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} style={{ width: 140 }} title="To date" />
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Requested By</th>
                <th>Amount</th>
                <th>Status</th>
                {isApprover && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 && <tr><td colSpan={isApprover ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No expenses match your filters.</td></tr>}
              {pageData.map(e => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td style={{ fontWeight: 600 }}>{e.category}</td>
                  <td>
                    <div>{e.description}</div>
                    {e.status === 'Approved' && e.approved_by && (
                      <div className="muted" style={{ fontSize: 11 }}>Approved by {e.approved_by} on {e.approved_at ? new Date(e.approved_at).toLocaleDateString() : '-'}</div>
                    )}
                    {e.status === 'Rejected' && e.rejection_reason && (
                      <div style={{ fontSize: 11, color: '#EF4444' }}>Rejected: {e.rejection_reason}</div>
                    )}
                  </td>
                  <td>{e.requested_by}</td>
                  <td style={{ fontWeight: 700 }}>{fmtKES(e.amount)}</td>
                  <td>
                    <Badge color={e.status === 'Approved' ? 'green' : e.status === 'Rejected' ? 'red' : 'amber'}>{e.status}</Badge>
                  </td>
                  {isApprover && (
                    <td>
                      {e.status === 'Pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => handleApprove(e.id)} style={{ color: '#047857', borderColor: '#86efac', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <CheckCircle size={14} /> Approve
                          </button>
                          <button className="btn btn-sm" onClick={() => { setRejectModalOpen(e.id); setRejectReason(''); }} style={{ color: '#EF4444', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>â† Previous</button>
            <span className="muted" style={{ fontSize: 13 }}>Page {page + 1} of {totalPages}</span>
            <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next \u2192</button>
          </div>
        )}
      </div>

      {/* Record Expense Modal */}
      {modalOpen && (
        <Modal title="Record Expense" onClose={() => setModalOpen(false)} footer={
          <>
            <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleRecord}>Submit Request</button>
          </>
        }>
          <div className="grid grid-2">
            <div>
              <label className="field-label">Category</label>
              <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Amount (KES)</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="field-label">Description / Purpose</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>This will be visible to the Principal for approval.</div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <Modal title="Reject Expense" onClose={() => setRejectModalOpen(null)} footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setRejectModalOpen(null)}>Cancel</button>
            <button className="btn" style={{ background: '#EF4444', color: '#fff', borderColor: '#EF4444' }} onClick={handleReject}>Reject Expense</button>
          </div>
        }>
          <div>
            <label className="field-label">Reason for Rejection *</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Provide a reason for rejecting this expense..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>
        </Modal>
      )}

      {/* Categories Modal */}
      {catModalOpen && (
        <Modal title="Expense Categories" onClose={() => setCatModalOpen(false)} footer={
          <button className="btn btn-primary" onClick={() => setCatModalOpen(false)}>Done</button>
        }>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Manage categories for logging expenses.</span>
            <button className="btn btn-sm btn-primary" onClick={handleAddCategory}>+ Add Category</button>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {categories.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < categories.length - 1 ? '1px solid var(--border-light)' : 'none', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{c}</span>
                <button className="btn btn-sm" style={{ padding: '2px 8px', color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDeleteCategory(c)}>Remove</button>
              </div>
            ))}
            {categories.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>No categories configured.</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}



