import { useState, useEffect } from 'react';
import { Badge } from '../../components/widgets';
import Modal from '../../components/Modal';
import { fmtKES } from '../../data/modules';
import { upsertRow } from '../../lib/api';
import { useOutletContext } from 'react-router-dom';

export default function ExpensesTab() {
  const { expenses, setExpenses, user, notify, params, store } = useOutletContext();
  const [modalOpen, setModalOpen] = useState(params.action === 'record_expense');
  const [catModalOpen, setCatModalOpen] = useState(params.action === 'categories');
  const [form, setForm] = useState({ category: '', amount: '', description: '' });

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
    setModalOpen(false);
    setForm({ category: categories[0] || '', amount: '', description: '' });
    try {
      await upsertRow('expenses', expense);
    } catch (e) {
      console.warn('API error ignored for mock:', e.message);
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

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title">Expense Management</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setCatModalOpen(true)}>Manage Categories</button>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Record Expense</button>
        </div>
      </div>

      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Category</th><th>Description</th><th>Requested By</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {expenses.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No expenses recorded.</td></tr>}
            {expenses.map(e => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td style={{ fontWeight: 600 }}>{e.category}</td>
                <td>{e.description}</td>
                <td>{e.requested_by}</td>
                <td style={{ fontWeight: 700 }}>{fmtKES(e.amount)}</td>
                <td>
                  <Badge color={e.status === 'Approved' ? 'green' : e.status === 'Rejected' ? 'red' : 'amber'}>{e.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
