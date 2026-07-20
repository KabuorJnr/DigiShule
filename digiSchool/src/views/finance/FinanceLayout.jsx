import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/widgets';
import { fetchTable } from '../../lib/api';

const TABS = [
  { id: '', label: 'Dashboard', path: '.' },
  { id: 'billing', label: 'Invoices & Billing', path: 'billing' },
  { id: 'payments', label: 'Payments', path: 'payments' },
  { id: 'defaulters', label: 'Defaulters', path: 'defaulters' },
  { id: 'statements', label: 'Statements', path: 'statements' },
  { id: 'fee_structure', label: 'Fee Structure', path: 'fee_structure' },
  { id: 'expenses', label: 'Expenses', path: 'expenses' },
  { id: 'payment_plans', label: 'Payment Plans', path: 'payment_plans' },
  { id: 'budget', label: 'Budget', path: 'budget' },
  { id: 'scholarships', label: 'Scholarships', path: 'scholarships' },
  { id: 'reports', label: 'Reports', path: 'reports' },
  { id: 'audit', label: 'Audit Trail', path: 'audit' },
  { id: 'procurement', label: 'Procurement', path: 'procurement' },
  { id: 'payroll', label: 'Payroll', path: 'payroll' },
  { id: 'assets', label: 'Assets', path: 'assets' },
  { id: 'journal', label: 'Journal Entries', path: 'journal' },
  { id: 'tax', label: 'Tax & Statutory', path: 'tax' },
  { id: 'ai', label: 'AI Assistant', path: 'ai' },
  { id: 'permissions', label: 'Permissions', path: 'permissions' }
];

export default function FinanceLayout() {
  const { store, user, params } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [students, setStudents] = useState([]);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [scholarships, setScholarships] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    if (params?.tab) {
      const targetPath = params.tab === 'finance_dashboard' ? '/portal/finance' : `/portal/finance/${params.tab}`;
      if (location.pathname !== targetPath && location.pathname !== targetPath + '/') {
        navigate(targetPath, { replace: true });
      }
    }
  }, [params?.tab, location.pathname, navigate]);

  useEffect(() => {
    Promise.all([
      fetchTable('invoices').catch(() => []),
      fetchTable('financePayments').catch(() => []),
      fetchTable('expenses').catch(() => []),
      import('../../lib/api').then(({ fetchStudents }) => fetchStudents(0, 1000).then(r => r.data || [])).catch(() => []),
      fetchTable('payment_plans').catch(() => []),
      fetchTable('scholarships').catch(() => []),
      fetchTable('finance_audit_log').catch(() => [])
    ]).then(([invs, pays, exps, stus, plans, schs, logs]) => {
      setInvoices(invs);
      setPayments(pays);
      setExpenses(exps);
      setStudents(stus || []);
      setPaymentPlans(plans || []);
      setScholarships(schs || []);
      setAuditLogs(logs || []);
    });
  }, []);

  // Audit log helper - passed to child tabs via context
  const addAuditLog = useCallback((action, details, amount) => {
    const log = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action,
      details,
      amount: amount ? Number(amount) : null,
      user: user?.name || 'System',
      timestamp: new Date().toISOString()
    };
    setAuditLogs(prev => [log, ...prev]);

    // Persist to DB (fire and forget)
    import('../../lib/api').then(({ upsertRow }) => {
      upsertRow('finance_audit_log', log).catch(() => {});
    });
  }, [user?.name]);

  // Use params.tab for an instant synchronous check, avoiding React Router's async location.pathname flicker
  const isDashboard = !params?.tab;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {!isDashboard && (
        <>
          <PageHeader
            title="Finance & Accounting"
            subtitle="Manage billing, payments, expenses, and fee structures."
          />
        </>
      )}

      <Outlet context={{ 
        store: { ...store, addAuditLog, paymentPlans, setPaymentPlans, scholarships, setScholarships, auditLogs, setAuditLogs },
        user, params, 
        invoices, setInvoices, 
        payments, setPayments, 
        expenses, setExpenses, 
        students, setStudents,
        paymentPlans, setPaymentPlans,
        scholarships, setScholarships,
        auditLogs, setAuditLogs,
        addAuditLog
      }} />
    </div>
  );
}



