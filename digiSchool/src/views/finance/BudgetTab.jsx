import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import Modal from '../../components/Modal';
import { Badge } from '../../components/widgets';
import { fmtKES } from '../../data/modules';
import { Plus, Edit2, AlertTriangle, CheckCircle } from 'lucide-react';

export default function BudgetTab() {
  const { expenses, store, user } = useOutletContext();
  const notify = store?.notify || (() => {});
  const budgets = store?.settings?.budgets || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [form, setForm] = useState({ category: '', amount: '', period: 'Term' });

  // Get all expense categories
  const defaultCategories = ['Office Supplies', 'Maintenance', 'Utilities', 'Staff Welfare', 'Other'];
  const allCategories = store?.settings?.expenseCategories?.length > 0
    ? store.settings.expenseCategories
    : defaultCategories;

  // Calculate actual spending per category
  const approvedExpenses = useMemo(() =>
    expenses.filter(e => e.status === 'Approved'),
    [expenses]
  );

  const actualByCategory = useMemo(() => {
    const map = {};
    approvedExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return map;
  }, [approvedExpenses]);

  // Build budget vs actual data
  const budgetData = useMemo(() => {
    return budgets.map(b => {
      const actual = actualByCategory[b.category] || 0;
      const remaining = Math.max(0, b.amount - actual);
      const pct = b.amount > 0 ? (actual / b.amount) * 100 : 0;
      return { ...b, actual, remaining, pct };
    });
  }, [budgets, actualByCategory]);

  // Chart data
  const chartData = budgetData.map(b => ({
    name: b.category.length > 15 ? b.category.slice(0, 15) + '…' : b.category,
    Budget: b.amount,
    Actual: b.actual
  }));

  // Stats
  const totalBudget = budgetData.reduce((s, b) => s + b.amount, 0);
  const totalActual = budgetData.reduce((s, b) => s + b.actual, 0);
  const overBudgetCount = budgetData.filter(b => b.pct > 100).length;
  const warningCount = budgetData.filter(b => b.pct >= 80 && b.pct <= 100).length;

  const COLORS = ['#047857', '#047857', '#F59E0B', '#EF4444', '#047857', '#EC4899'];

  const handleSave = () => {
    if (!form.category || !form.amount) {
      notify('Category and amount are required.', 'error');
      return;
    }

    const newBudget = { category: form.category, amount: Number(form.amount), period: form.period, status: form.status || 'Draft' };
    let updated;
    if (editIndex !== null) {
      updated = [...budgets];
      updated[editIndex] = newBudget;
    } else {
      if (budgets.find(b => b.category === form.category)) {
        notify('Budget for this category already exists. Edit it instead.', 'warning');
        return;
      }
      updated = [...budgets, newBudget];
    }

    store.setSettings({ ...store.settings, budgets: updated });
    setModalOpen(false);
    setEditIndex(null);
    setForm({ category: '', amount: '', period: 'Term' });
    notify(editIndex !== null ? 'Budget updated.' : 'Budget added.', 'success');
  };

  const handleEdit = (idx) => {
    const b = budgets[idx];
    setForm({ category: b.category, amount: b.amount, period: b.period || 'Term' });
    setEditIndex(idx);
    setModalOpen(true);
  };

  const handleApprove = (idx) => {
    if (!confirm(`Approve budget for "${budgets[idx].category}"?`)) return;
    const updated = [...budgets];
    updated[idx] = { ...updated[idx], status: 'Active' };
    store.setSettings({ ...store.settings, budgets: updated });
    notify('Budget approved and activated.', 'success');
  };

  const handleDelete = (idx) => {
    if (!confirm(`Remove budget for "${budgets[idx].category}"?`)) return;
    const updated = budgets.filter((_, i) => i !== idx);
    store.setSettings({ ...store.settings, budgets: updated });
    notify('Budget removed.', 'info');
  };

  const getBarColor = (pct) => {
    if (pct > 100) return '#EF4444';
    if (pct >= 80) return '#F59E0B';
    return '#047857';
  };

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #047857' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Budget</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8 }}>{fmtKES(totalBudget)}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #047857' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Spent</div>
          <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8 }}>{fmtKES(totalActual)}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #F59E0B' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nearing Limit</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#F59E0B' }}>{warningCount}</div>
        </div>
        <div className="card" style={{ padding: '20px 16px', borderTop: '3px solid #EF4444' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Over Budget</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#EF4444' }}>{overBudgetCount}</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: 24, marginBottom: 24 }}>
        {/* Chart */}
        <div className="card card-pad">
          <div className="section-title">Budget vs Actual Spending</div>
          {chartData.length > 0 ? (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => `${v / 1000}k`} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={v => fmtKES(v)} contentStyle={{ backgroundColor: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="Budget" fill="#047857" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="Actual" fill="#047857" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              No budgets configured yet. Add your first budget to see the chart.
            </div>
          )}
        </div>

        {/* Utilization Cards */}
        <div className="card card-pad">
          <div className="section-title">Budget Utilization</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {budgetData.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No budgets set.</div>
            )}
            {budgetData.map((b, i) => (
              <div key={i} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: b.pct > 100 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{b.category}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: getBarColor(b.pct) }}>
                    {b.pct.toFixed(0)}%
                    {b.pct > 100 && <AlertTriangle size={14} style={{ marginLeft: 4, verticalAlign: 'text-bottom' }} />}
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{
                    width: `${Math.min(100, b.pct)}%`,
                    height: '100%',
                    background: getBarColor(b.pct),
                    borderRadius: 4,
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Spent: {fmtKES(b.actual)}</span>
                  <span>Budget: {fmtKES(b.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Budget Table */}
      <div className="card card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Budget Allocations</div>
          <button className="btn btn-primary" onClick={() => { setEditIndex(null); setForm({ category: '', amount: '', period: 'Term' }); setModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Add Budget
          </button>
        </div>

        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Period</th>
                <th style={{ textAlign: 'right' }}>Budget</th>
                <th style={{ textAlign: 'right' }}>Actual Spend</th>
                <th style={{ textAlign: 'right' }}>Remaining</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>% Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgetData.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 40 }}>
                  No budgets configured. Click "Add Budget" to set spending limits.
                </td></tr>
              )}
              {budgetData.map((b, i) => (
                <tr key={i} style={{ background: b.pct > 100 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                  <td style={{ fontWeight: 600 }}>{b.category}</td>
                  <td className="muted">{b.period || 'Term'}</td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(b.amount)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(b.actual)}</td>
                  <td style={{ textAlign: 'right', color: b.remaining === 0 ? '#EF4444' : 'var(--text)' }}>{fmtKES(b.remaining)}</td>
                  <td>
                    <Badge color={b.status === 'Active' ? 'green' : 'amber'}>{b.status || 'Active'}</Badge>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: 600, color: getBarColor(b.pct), fontSize: 13 }}>
                      {b.pct.toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(b.status === 'Draft' || !b.status) && user?.role === 'finance' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleApprove(i)}>Approve</button>
                      )}
                      <button className="btn btn-sm" onClick={() => handleEdit(i)}><Edit2 size={14} /></button>
                      <button className="btn btn-sm" onClick={() => handleDelete(i)} style={{ color: '#EF4444', borderColor: '#fca5a5' }}>Ã—</button>
                    </div>
                  </td>
                </tr>
              ))}
              {budgetData.length > 0 && (
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td>TOTAL</td>
                  <td></td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(totalBudget)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(totalActual)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtKES(Math.max(0, totalBudget - totalActual))}</td>
                  <td></td>
                  <td style={{ textAlign: 'center' }}>{totalBudget > 0 ? ((totalActual / totalBudget) * 100).toFixed(1) : 0}%</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <Modal title={editIndex !== null ? 'Edit Budget' : 'Add Budget'} onClose={() => setModalOpen(false)} footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>{editIndex !== null ? 'Update' : 'Add'} Budget</button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="field-label">Expense Category *</label>
              <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} disabled={editIndex !== null}>
                <option value="">-- Select Category --</option>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="field-label">Budget Amount (KES) *</label>
                <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">Period</label>
                <select className="select" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
                  <option>Term</option>
                  <option>Annual</option>
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}



