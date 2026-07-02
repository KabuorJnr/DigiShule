import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  LineChart, Line, PieChart, Pie, Legend
} from 'recharts';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import Modal from '../components/Modal';
import { fmtKES } from '../data/modules';
import { fetchTable, upsertRow, getActiveSchoolId } from '../lib/api';
import { expandClassesWithStreams } from '../data/seed';
import { supabase } from '../lib/supabaseClient';
import { Icon } from '../components/icons';
import PrintHeader from '../components/PrintHeader';

const TABS = [
  { id: 'invoices', label: 'Invoices & Billing' },
  { id: 'payments', label: 'Payments' },
  { id: 'statements', label: 'Student Statements' },
  { id: 'fee_structure', label: 'School Fee Structure' },
  { id: 'expenses', label: 'Expense Management' },
  { id: 'reports', label: 'Reports & Analysis' }
];

export default function Finance({ store, user, params = {} }) {
  const { notify } = store;
  const [activeTab, setActiveTab] = useState(params.tab || 'invoices');

  // We will initialize state for our entities
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Sync tab if navigated from sidebar
  useEffect(() => {
    if (params.tab) setActiveTab(params.tab);
  }, [params.tab]);

  // Load basic data
  useEffect(() => {
    // In a real app we fetch invoices, finance_payments, expenses, and students
    // For now we'll fetch mock or empty tables from Supabase, or mock them if they fail
    Promise.all([
      fetchTable('invoices').catch(() => []),
      fetchTable('financePayments').catch(() => []),
      fetchTable('expenses').catch(() => []),
      import('../lib/api').then(({ fetchStudents }) => fetchStudents(0, 1000).then(r => r.data || [])).catch(() => [])
    ]).then(([invs, pays, exps, stus]) => {
      setInvoices(invs);
      setPayments(pays);
      setExpenses(exps);
      setStudents(stus || []);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Finance & Accounting"
        subtitle="Manage billing, payments, expenses, and fee structures."
      />

      <div className="tabs" style={{ marginBottom: 24, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 24 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: 'none', border: 'none', padding: '0 0 12px', cursor: 'pointer',
              fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? '#000000' : '#64748b',
              borderBottom: activeTab === t.id ? '2px solid #000000' : '2px solid transparent'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'invoices' && <BillingTab invoices={invoices} setInvoices={setInvoices} notify={notify} params={params} students={students} store={store} />}
      {activeTab === 'payments' && <PaymentsTab payments={payments} invoices={invoices} setPayments={setPayments} notify={notify} params={params} students={students} />}
      {activeTab === 'statements' && <StatementsTab students={students} invoices={invoices} payments={payments} store={store} />}
      {activeTab === 'fee_structure' && <FeeStructureTab store={store} user={user} />}
      {activeTab === 'expenses' && <ExpensesTab expenses={expenses} setExpenses={setExpenses} user={user} notify={notify} params={params} store={store} />}
      {activeTab === 'reports' && <ReportsTab invoices={invoices} payments={payments} expenses={expenses} />}

    </div>
  );
}

// -----------------------------------------------------------------------------
// INVOICES & BILLING TAB
// -----------------------------------------------------------------------------
function BillingTab({ invoices, setInvoices, notify, params, students, store }) {
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
    // Optimistically update UI so it works in session even without backend
    setInvoices(prev => [newInvoice, ...prev]);
    notify('Invoice generated successfully.');
    setModalOpen(false);
    setForm({ student_id: '', amount: '', due_date: '', type: 'Term Fee' });
    try {
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

// -----------------------------------------------------------------------------
// PAYMENTS TAB
// -----------------------------------------------------------------------------
function PaymentsTab({ payments, invoices, setPayments, notify, params, students }) {
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

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title">Payments</div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Record Payment</button>
      </div>

      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr><th>Date</th><th>Student</th><th>Method</th><th>Ref</th><th>Amount</th></tr>
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

// -----------------------------------------------------------------------------
// STATEMENTS & PRINT TAB (Printable Fee Balances)
// -----------------------------------------------------------------------------
function StatementsTab({ students, invoices, payments, store }) {
  const [selectedStudent, setSelectedStudent] = useState('');

  const student = students.find(s => s.id === selectedStudent);
  const myInvoices = invoices.filter(i => i.student_id === selectedStudent);
  const myPayments = payments.filter(p => p.student_id === selectedStudent);
  
  const totalBilled = myInvoices.reduce((acc, i) => acc + Number(i.amount), 0);
  const totalPaid = myPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const balance = totalBilled - totalPaid;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Configuration UI (hidden when printing) */}
      <div className="card card-pad no-print" style={{ marginBottom: 24 }}>
        <div className="section-title">Fee Statements</div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Select Student</label>
            <select className="select" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
              <option value="">-- Choose Student --</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.adm_no})</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={!selectedStudent} onClick={handlePrint}>
            <Icon name="file" size={16} style={{ marginRight: 6 }} /> Print Statement
          </button>
        </div>
      </div>

      {/* Printable Area */}
      {student && (
        <div className="printable-statement card card-pad" style={{ background: '#fff', color: '#000' }}>
          <PrintHeader />
          <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #000', paddingBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, color: '#000', textTransform: 'uppercase' }}>Fee Statement</h2>
            <div style={{ fontSize: 13, marginTop: 4 }}>Date: {new Date().toLocaleDateString()}</div>
          </div>

          {/* Student Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Student Name</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{student.name}</div>
              <div style={{ fontSize: 14 }}>Adm No: {student.adm_no}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Current Balance</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: balance > 0 ? '#dc2626' : '#16a34a' }}>{fmtKES(balance)}</div>
              {balance > 0 && <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>Due Immediately</div>}
            </div>
          </div>

          <p style={{ marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
            Dear Parent/Guardian,<br/>
            Below is the fee statement for your child <strong>{student.name}</strong>. Please ensure any outstanding balances are cleared promptly to avoid disruption of learning.
          </p>

          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Invoices / Charges</div>
          <table className="table" style={{ width: '100%', marginBottom: 24, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                <th style={{ padding: '8px 4px', textAlign: 'left' }}>Date/Ref</th>
                <th style={{ padding: '8px 4px', textAlign: 'left' }}>Due Date</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {myInvoices.map(i => (
                <tr key={i.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 4px' }}>Term Fee ({i.id})</td>
                  <td style={{ padding: '8px 4px' }}>{i.due_date}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{fmtKES(i.amount)}</td>
                </tr>
              ))}
              {myInvoices.length === 0 && <tr><td colSpan={3} style={{ padding: '8px 4px', textAlign: 'center' }}>No charges recorded</td></tr>}
            </tbody>
          </table>

          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Payments Received</div>
          <table className="table" style={{ width: '100%', marginBottom: 32, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                <th style={{ padding: '8px 4px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '8px 4px', textAlign: 'left' }}>Method/Ref</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {myPayments.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 4px' }}>{p.date}</td>
                  <td style={{ padding: '8px 4px' }}>{p.method} - {p.ref}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{fmtKES(p.amount)}</td>
                </tr>
              ))}
              {myPayments.length === 0 && <tr><td colSpan={3} style={{ padding: '8px 4px', textAlign: 'center' }}>No payments recorded</td></tr>}
            </tbody>
          </table>

          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: '#666', borderTop: '1px solid #ddd', paddingTop: 16 }}>
            For any queries regarding this statement, please contact the Accounts Office.<br/>
            <strong>Thank you for your prompt payment!</strong>
          </div>
        </div>
      )}

      {/* Inject print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden; }
          .printable-statement, .printable-statement * { visibility: visible; }
          .printable-statement { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 2cm !important; border: none; box-shadow: none; box-sizing: border-box; }
          .no-print { display: none !important; }
          .sidebar, .topbar { display: none !important; }
          .layout { display: block !important; padding: 0 !important; }
          .main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
        }
      `}} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// EXPENSES TAB
// -----------------------------------------------------------------------------
function ExpensesTab({ expenses, setExpenses, user, notify, params, store }) {
  const [modalOpen, setModalOpen] = useState(params.action === 'record_expense');
  const [catModalOpen, setCatModalOpen] = useState(params.action === 'categories');
  const [form, setForm] = useState({ category: '', amount: '', description: '' });

  const defaultCategories = ['Office Supplies', 'Maintenance', 'Utilities', 'Staff Welfare', 'Other'];
  const categories = (store.settings.expenseCategories && store.settings.expenseCategories.length > 0) 
    ? store.settings.expenseCategories 
    : defaultCategories;

  // Initialize Grade category when categories load
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
    // Optimistic update
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

// -----------------------------------------------------------------------------
// REPORTS & ANALYSIS TAB
// -----------------------------------------------------------------------------
function ReportsTab({ invoices, payments, expenses }) {
  const totalBilled = invoices.reduce((acc, i) => acc + Number(i.amount), 0);
  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalExpenses = expenses.filter(e => e.status === 'Approved').reduce((acc, e) => acc + Number(e.amount), 0);
  
  const cashFlow = totalCollected - totalExpenses;

  // Process Expense Breakdown
  const expenseBreakdown = useMemo(() => {
    const categories = {};
    expenses.filter(e => e.status === 'Approved').forEach(e => {
      categories[e.category] = (categories[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [expenses]);
  
  const COLORS = ['#0D9488', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

  // Process Fee Collection vs Expenses Trend
  const trendData = useMemo(() => {
    const timeline = {};
    payments.forEach(p => {
      const month = p.date.substring(0, 7); // YYYY-MM
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0 };
      timeline[month].Income += Number(p.amount);
    });
    expenses.filter(e => e.status === 'Approved').forEach(e => {
      const month = e.date.substring(0, 7); // YYYY-MM
      if (!timeline[month]) timeline[month] = { month, Income: 0, Expenses: 0 };
      timeline[month].Expenses += Number(e.amount);
    });
    return Object.values(timeline).sort((a, b) => a.month.localeCompare(b.month));
  }, [payments, expenses]);

  return (
    <div>
      <div className="stat-tiles" style={{ marginBottom: 24 }}>
        <KpiCard iconComponent={<Icon name="file" size={24} />} label="Total Billed" value={fmtKES(totalBilled)} accent="#0078D4" />
        <KpiCard iconComponent={<Icon name="finance" size={24} />} label="Total Collected" value={fmtKES(totalCollected)} accent="#10B981" />
        <KpiCard iconComponent={<Icon name="payment" size={24} />} label="Approved Expenses" value={fmtKES(totalExpenses)} accent="#EF4444" />
        <KpiCard iconComponent={<Icon name="analytics" size={24} />} label="Net Cash Flow" value={fmtKES(cashFlow)} accent={cashFlow >= 0 ? '#10B981' : '#EF4444'} />
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="section-title">Expense Breakdown</div>
          {expenseBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={expenseBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {expenseBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => fmtKES(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }} className="muted">No approved expenses yet.</div>
          )}
        </div>
        <div className="card card-pad">
          <div className="section-title">Income vs Expenses Trend</div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip formatter={(value) => fmtKES(value)} />
                <Legend />
                <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }} className="muted">No transactions recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// FEE STRUCTURE TAB
// -----------------------------------------------------------------------------
function FeeStructureTab({ store, user }) {
  const { notify } = store;
  const feeStructure = store.feeStructure || [];

  const handlePrint = () => {
    window.print();
  };

  const handleSendToParents = async () => {
    try {
      
      const row = {
        title: 'Fee Structure - Current Term',
        message: 'The official fee structure for this term is now available.',
        body: 'Dear Parents,\n\nPlease find attached the official fee structure for the current term. You can download the PDF by clicking the button below.\n\n[ATTACHMENT:FEE_STRUCTURE]',
        posted_by: user?.name || 'Administration',
        role: user?.dept || user?.role || 'Finance',
        audience: ['parents'],
        school_id: getActiveSchoolId(),
        created_at: new Date().toISOString()
      };
      
      await supabase.from('notifications').insert(row);
      notify('Fee structure sent to Parents Portal successfully!', 'success');
    } catch (e) {
      notify(`Failed to send notification: ${e.message}`, 'error');
    }
  };

  return (
    <div>
      <div className="card card-pad no-print" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-title" style={{ margin: 0 }}>School Fee Structure</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleSendToParents}>
              <Icon name="message" size={16} style={{ marginRight: 6 }} /> Send to Parents
            </button>
            <button className="btn" onClick={handlePrint}>
              <Icon name="print" size={16} style={{ marginRight: 6 }} /> Print / Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Printable Area */}
      <div className="printable-fee-structure card card-pad" style={{ background: '#fff', color: '#000' }}>
        <PrintHeader />
        <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '2px solid #000', paddingBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#000', textTransform: 'uppercase' }}>Official Fee Structure</h2>
          <div style={{ fontSize: 13, marginTop: 4 }}>Academic Year: {new Date().getFullYear()}</div>
        </div>

        {(() => {
          const classList = store.settings?.classes || [];
          const levels = classList.length > 0 ? classList.map(c => c.name) : (store.settings.levels || ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']);
          return (
            <table className="table" style={{ width: '100%', marginBottom: 32, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #000' }}>
              <th style={{ padding: '12px 8px', textAlign: 'left' }}>Fee Component</th>
              {levels.map(l => <th key={l} style={{ padding: '12px 8px', textAlign: 'right' }}>{l} (KES)</th>)}
            </tr>
          </thead>
          <tbody>
            {feeStructure.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px 8px', fontWeight: 600 }}>{item.component || item.type}</td>
                {levels.map(l => (
                  <td key={l} style={{ padding: '12px 8px', textAlign: 'right' }}>{fmtKES(item[l])}</td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #000', backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '12px 8px', fontWeight: 800 }}>TOTAL Term Fees</td>
              {levels.map(l => (
                <td key={l} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800 }}>
                  {fmtKES(feeStructure.reduce((s, f) => s + (f[l] || 0), 0))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        );
        })()}

        <div style={{ marginTop: 40 }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>Payment Methods:</h4>
          {store.settings?.paymentDetails ? (
            <div style={{ margin: 0, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {store.settings.paymentDetails}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13, fontStyle: 'italic' }}>
              No payment instructions configured. Please set them in School Settings.
            </p>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; }
          body * { visibility: hidden; }
          .printable-fee-structure, .printable-fee-structure * { visibility: visible; }
          .printable-fee-structure { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 2cm !important; border: none; box-shadow: none; box-sizing: border-box; }
          .no-print { display: none !important; }
          .sidebar, .topbar { display: none !important; }
          .layout { display: block !important; padding: 0 !important; }
          .main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
        }
      `}} />
    </div>
  );
}
