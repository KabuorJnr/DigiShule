import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  LineChart, Line
} from 'recharts';
import { PageHeader, KpiCard, Badge, ProgressBar } from '../components/widgets';
import Modal from '../components/Modal';
import { fmtKES } from '../data/modules';
import { fetchTable, upsertRow } from '../lib/api';
import { Icon } from '../components/icons';

const TABS = [
  { id: 'invoices', label: 'Invoices & Billing' },
  { id: 'payments', label: 'Payments' },
  { id: 'fee_structure', label: 'Statements & Print' },
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
      store.students // from global store
    ]).then(([invs, pays, exps]) => {
      setInvoices(invs);
      setPayments(pays);
      setExpenses(exps);
      setStudents(store.students || []);
    });
  }, [store.students]);

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
              color: activeTab === t.id ? '#047857' : '#64748b',
              borderBottom: activeTab === t.id ? '2px solid #047857' : '2px solid transparent'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'invoices' && <BillingTab invoices={invoices} setInvoices={setInvoices} notify={notify} params={params} students={students} />}
      {activeTab === 'payments' && <PaymentsTab payments={payments} invoices={invoices} setPayments={setPayments} notify={notify} params={params} students={students} />}
      {activeTab === 'fee_structure' && <StatementsTab students={students} invoices={invoices} payments={payments} store={store} />}
      {activeTab === 'expenses' && <ExpensesTab expenses={expenses} setExpenses={setExpenses} user={user} notify={notify} params={params} />}
      {activeTab === 'reports' && <ReportsTab invoices={invoices} payments={payments} expenses={expenses} />}

    </div>
  );
}

// -----------------------------------------------------------------------------
// INVOICES & BILLING TAB
// -----------------------------------------------------------------------------
function BillingTab({ invoices, setInvoices, notify, params, students }) {
  const [modalOpen, setModalOpen] = useState(params.action === 'generate_invoice');
  const [form, setForm] = useState({ student_id: '', amount: '', due_date: '', type: 'Term Fee' });

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
    try {
      await upsertRow('invoices', newInvoice);
      setInvoices(prev => [newInvoice, ...prev]);
      notify('Invoice generated successfully.');
      setModalOpen(false);
      setForm({ student_id: '', amount: '', due_date: '', type: 'Term Fee' });
    } catch (e) {
      notify(`Failed to generate invoice: ${e.message}`, 'error');
    }
  };

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title">Invoices</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => notify('Bulk Invoicing: Please select students first.', 'info')}>Bulk Invoicing</button>
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
    try {
      await upsertRow('financePayments', payment);
      setPayments(prev => [payment, ...prev]);
      notify(`Payment of ${fmtKES(form.amount)} recorded successfully.`);
      setModalOpen(false);
      setForm({ invoice_id: '', student_id: '', amount: '', method: 'M-Pesa', ref: '' });
    } catch (e) {
      notify(`Failed to record payment: ${e.message}`, 'error');
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
          {/* Letterhead */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {store.settings.logo && <img src={store.settings.logo} alt="School Logo" style={{ width: 80, height: 80, objectFit: 'contain' }} />}
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{store.settings.name || 'Your School Name'}</h1>
                <div style={{ fontSize: 13, color: '#333' }}>{store.settings.address || 'P.O Box 123, Nairobi'} | {store.settings.phone || '0700000000'} | {store.settings.email || 'info@school.com'}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: 20, color: '#000' }}>FEE STATEMENT</h2>
              <div style={{ fontSize: 13, marginTop: 4 }}>Date: {new Date().toLocaleDateString()}</div>
            </div>
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
          body * { visibility: hidden; }
          .printable-statement, .printable-statement * { visibility: visible; }
          .printable-statement { position: absolute; left: 0; top: 0; width: 100%; margin: 0; border: none; box-shadow: none; }
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
function ExpensesTab({ expenses, setExpenses, user, notify, params }) {
  const [modalOpen, setModalOpen] = useState(params.action === 'record_expense');
  const [form, setForm] = useState({ category: 'Office Supplies', amount: '', description: '' });

  useEffect(() => {
    if (params.action === 'record_expense') setModalOpen(true);
  }, [params.action]);

  const handleRecord = async () => {
    if (!form.amount || !form.description) {
      notify('Amount and description are required.', 'error');
      return;
    }
    const expense = {
      id: `exp_${Date.now()}`,
      category: form.category,
      amount: Number(form.amount),
      description: form.description,
      status: 'Pending',
      requested_by: user.name,
      date: new Date().toISOString().slice(0,10),
      created_at: new Date().toISOString()
    };
    try {
      await upsertRow('expenses', expense);
      setExpenses(prev => [expense, ...prev]);
      notify(`Expense of ${fmtKES(form.amount)} submitted for approval.`);
      setModalOpen(false);
      setForm({ category: 'Office Supplies', amount: '', description: '' });
    } catch (e) {
      notify(`Failed to record expense: ${e.message}`, 'error');
    }
  };

  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title">Expense Management</div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Record Expense</button>
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
                <option>Office Supplies</option>
                <option>Maintenance</option>
                <option>Utilities</option>
                <option>Staff Welfare</option>
                <option>Other</option>
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
          <div style={{ textAlign: 'center', padding: 40 }} className="muted">
            Interactive charts will appear here as more data is collected.
          </div>
        </div>
        <div className="card card-pad">
          <div className="section-title">Fee Collection Trend</div>
          <div style={{ textAlign: 'center', padding: 40 }} className="muted">
            Interactive charts will appear here as more data is collected.
          </div>
        </div>
      </div>
    </div>
  );
}
